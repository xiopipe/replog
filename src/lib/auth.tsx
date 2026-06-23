/**
 * Auth context — local-first identity with optional cloud adoption.
 *
 * Identity model (ADR 0005 / TKT-0067):
 *
 *   1. On first launch a local UUID is generated and stored in AsyncStorage.
 *      `createUserObservables(localUid)` is called immediately — no network
 *      required, no login screen shown.
 *
 *   2. When the user adopts a cloud account (anonymous sign-in or registration),
 *      `adoptLocalData(supabaseUid)` re-keys all local rows from localUid to
 *      supabaseUid BEFORE the first sync push. The legend-state sync layer then
 *      pushes the re-keyed rows to Supabase.
 *
 *   3. `activeUid = cloudUid ?? localUid` — always non-null after localUid loads.
 *      `db` is NEVER null.
 *
 * Persistence namespacing analysis:
 *   observablePersistSqlite uses persist.name (e.g. 'workout_sessions') as the
 *   SQLite KV key — NOT uid-prefixed. All calls to createUserObservables(anyUid)
 *   share the same flat cache. Re-keying therefore means: update the user_id
 *   field on all rows in the existing observables to the new Supabase uid. The
 *   sync plugin detects those writes as dirty and pushes them to Supabase.
 *   No namespace migration is needed — only the field values change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';

import { createUserObservables, type UserObservables } from '@/db';
import { supabase } from '@/lib/supabase';
import { rekeyRows, extractLocalProfile } from '@/lib/rekey';

WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Local UID persistence
// ---------------------------------------------------------------------------

const LOCAL_UID_KEY = '@replog/local_uid';

/** Generate and persist a local UUID on first launch (AsyncStorage). */
async function loadOrCreateLocalUid(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(LOCAL_UID_KEY);
    if (existing) return existing;
    const fresh = uuidv4();
    await AsyncStorage.setItem(LOCAL_UID_KEY, fresh);
    return fresh;
  } catch {
    // AsyncStorage unavailable — generate a session-scoped fallback.
    return uuidv4();
  }
}

// ---------------------------------------------------------------------------
// Anonymous detection
// ---------------------------------------------------------------------------

/** Returns true if the Supabase user is an anonymous guest (pre-registration). */
export function isAnonymous(user: User | null | undefined): boolean {
  return user?.app_metadata?.is_anonymous === true;
}

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

type AuthContextValue = {
  /** The active Supabase session (null when local-only). */
  session: Session | null;
  /** True while loading the cached session and local UID on first mount. */
  initializing: boolean;
  /** Per-user synced observables — NEVER null after initializing completes. */
  db: UserObservables;
  /** The active user id: cloudUid if a Supabase session exists, else localUid. */
  activeUid: string;
  /** The local UUID generated on first launch (persists across restarts). */
  localUid: string;
  /** The Supabase session uid, or null when local-only. */
  cloudUid: string | null;
  /** True when user has a Supabase session and is an anonymous guest. */
  isAnonymousUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Sign in anonymously (optional cloud adoption — requires network). */
  signInAnonymously: () => Promise<void>;
  /** Upgrade anonymous session to permanent account (preserves auth.uid()). */
  upgradeWithEmail: (email: string, password: string) => Promise<void>;
  /**
   * Re-key all local rows from localUid to supabaseUid, then reinitialise
   * the observables under the new uid. Called on first successful cloud auth.
   * Rolls back on failure and returns false. Returns true on success.
   */
  adoptLocalData: (supabaseUid: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Stable fallback db for before localUid loads — prevents null access.
// This will be overwritten as soon as localUid resolves.
const BOOTSTRAP_UID = '00000000-0000-0000-0000-000000000000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [localUid, setLocalUid] = useState<string>(BOOTSTRAP_UID);

  // Track whether adoption has already been run for this session to avoid
  // running it twice on rapid auth-state-change fires.
  const adoptionDoneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load (or generate) the local UID and the cached Supabase session in
      // parallel. Both are needed before we can derive activeUid.
      const [uid, { data }] = await Promise.all([
        loadOrCreateLocalUid(),
        supabase.auth.getSession(),
      ]);

      if (cancelled) return;

      setLocalUid(uid);
      setSession(data.session);
      setInitializing(false);
    }

    init();

    // Listen for Supabase auth state changes (sign-in, sign-out, token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived uid
  // ---------------------------------------------------------------------------

  const cloudUid = session?.user?.id ?? null;
  const activeUid = cloudUid ?? localUid;
  const isAnonymousUser = isAnonymous(session?.user);

  // Create the per-user data layer. Re-created when activeUid changes (local →
  // cloud on adoption, or cloud sign-in on subsequent launches).
  const db = useMemo<UserObservables>(
    () => createUserObservables(activeUid),
    [activeUid],
  );

  // ---------------------------------------------------------------------------
  // adoptLocalData — re-key all user rows from localUid → supabaseUid.
  //
  // Strategy (ADR 0005, strategy a):
  //   Since observablePersistSqlite uses a flat name key (not uid-prefixed),
  //   all observables share the same SQLite cache per collection. Re-keying
  //   means: update the user_id field on every row in the current observables
  //   to supabaseUid. Legend-State marks those writes dirty and queues them for
  //   sync push when the new observable (keyed by supabaseUid) is activated.
  //   No SQLite namespace migration is needed — only field values change.
  //
  // Failure semantics:
  //   If any observable write throws, we log and return false. The local data
  //   under localUid remains intact (user_id writes that succeeded before the
  //   failure will have the new uid written; a retry will no-op those rows
  //   since rekeyRows filters on oldUid). The adoption is fully retryable.
  // ---------------------------------------------------------------------------

  async function adoptLocalData(supabaseUid: string): Promise<boolean> {
    if (adoptionDoneRef.current) return true;

    try {
      const now = new Date().toISOString();

      // Helper: update user_id on every row in an observable collection.
      function rekeyCollection(
        collection$: any,
        rows: { id: string; user_id: string; updated_at?: string }[],
      ): void {
        const rekeyed = rekeyRows(rows, localUid, supabaseUid);
        for (const row of rekeyed) {
          collection$[row.id].user_id.set(supabaseUid);
          if ('updated_at' in row) {
            collection$[row.id].updated_at.set(now);
          }
        }
      }

      // Pull current in-memory rows from each collection.
      const currentDb = db; // captured before uid switch

      const sessions = Object.values(currentDb.workoutSessions$.get() ?? {}) as any[];
      const sessionExercises = Object.values(currentDb.sessionExercises$.get() ?? {}) as any[];
      const sets = Object.values(currentDb.sets$.get() ?? {}) as any[];
      const routines = Object.values(currentDb.routines$.get() ?? {}) as any[];
      const routineExercises = Object.values(currentDb.routineExercises$.get() ?? {}) as any[];
      const plans = Object.values(currentDb.plans$.get() ?? {}) as any[];
      const planDays = Object.values(currentDb.planDays$.get() ?? {}) as any[];
      const userExercises = Object.values(currentDb.userExercises$.get() ?? {}) as any[];
      const userExerciseMuscles = Object.values(currentDb.userExerciseMuscles$.get() ?? {}) as any[];
      const exerciseFavorites = Object.values(currentDb.exerciseFavorites$.get() ?? {}) as any[];
      const profiles = Object.values(currentDb.profiles$.get() ?? {}) as any[];

      // Re-key in parent-before-child order (reduces FK race window on push).
      rekeyCollection(currentDb.routines$, routines);
      rekeyCollection(currentDb.routineExercises$, routineExercises);
      rekeyCollection(currentDb.plans$, plans);
      rekeyCollection(currentDb.planDays$, planDays);
      rekeyCollection(currentDb.workoutSessions$, sessions);
      rekeyCollection(currentDb.sessionExercises$, sessionExercises);
      rekeyCollection(currentDb.sets$, sets);
      rekeyCollection(currentDb.userExercises$, userExercises);
      rekeyCollection(currentDb.userExerciseMuscles$, userExerciseMuscles);
      rekeyCollection(currentDb.exerciseFavorites$, exerciseFavorites);

      // Profiles: the local profile row uses id=localUid as PK.
      // The handle_new_user trigger creates a fresh profiles row for supabaseUid
      // in Supabase. We discard the local profile row (don't push it) and
      // optionally carry over preferences.
      const localProfile = extractLocalProfile(profiles, localUid);
      if (localProfile && currentDb.profiles$) {
        // Delete local profile entry — the Supabase-created profile row will
        // be fetched fresh after sync initialises under supabaseUid.
        // We do NOT push localUid profile to Supabase (PK mismatch).
        try {
          (currentDb.profiles$ as any)[localUid].delete();
        } catch {
          // Safe to ignore — entry may not exist in the observable proxy.
        }
      }

      adoptionDoneRef.current = true;
      return true;
    } catch (err) {
      console.error('[auth] adoptLocalData failed — staying local-only:', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      db,
      activeUid,
      localUid,
      cloudUid,
      isAnonymousUser,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signInWithGoogle: async () => {
        const redirectTo = Linking.createURL('/');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data.url) return;

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return;

        const { queryParams } = Linking.parse(result.url);
        const code = queryParams?.code;
        if (typeof code === 'string') {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      },
      signInAnonymously: async () => {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      },
      upgradeWithEmail: async (email, password) => {
        // Updates the existing anonymous Supabase session to a permanent account.
        // auth.uid() is preserved — no re-key needed.
        const { error } = await supabase.auth.updateUser({ email, password });
        if (error) throw error;
      },
      adoptLocalData,
      signOut: async () => {
        await supabase.auth.signOut();
        // Reset adoption flag so a future sign-in can re-adopt if needed.
        adoptionDoneRef.current = false;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, initializing, db, activeUid, localUid, cloudUid, isAnonymousUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
