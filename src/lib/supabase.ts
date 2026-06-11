import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced loudly in dev so missing .env values are caught immediately.
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill your Supabase project values.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // Persist the session locally so the app opens offline after the first login.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection in a native app.
    detectSessionInUrl: false,
    // Google OAuth uses the code+exchange flow (WebBrowser + exchangeCodeForSession).
    // PKCE returns a `code` to the deep link; implicit would return tokens in the
    // URL fragment and the exchange step would never run.
    flowType: 'pkce',
  },
});

// Refresh the auth token only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
