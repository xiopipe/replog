/**
 * Sync status derivation — pure helper (TKT-0047).
 *
 * Derives a global sync status from a list of per-collection sync state
 * snapshots.  No React, no React Native, no Legend-State imports — fully
 * testable in the Node environment.
 */

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

export interface SyncStateSnapshot {
  /** True while a GET (fetch) is in flight. */
  isGetting?: boolean;
  /** True while a SET (push) is in flight. */
  isSetting?: boolean;
  /** Number of pending remote pushes. */
  numPendingSets?: number;
  /** Number of pending remote fetches. */
  numPendingGets?: number;
  /** Non-null when a non-transient error occurred. */
  error?: Error | null;
  /** True when the observable is fully loaded. */
  isLoaded?: boolean;
}

/**
 * Derive a single aggregate sync status from multiple collection snapshots.
 *
 * Priority (highest → lowest):
 *   error   — any collection has a non-null error
 *   syncing — any collection is currently getting or setting
 *   pending — any collection has pending sets/gets not yet dispatched
 *   synced  — all collections are loaded with no pending work
 *
 * @param snapshots - Array of sync state snapshots from individual collections.
 * @param isOffline - When true, suppress the error state (network errors
 *                    are expected and shown via the offline banner instead).
 */
export function deriveSyncStatus(
  snapshots: SyncStateSnapshot[],
  isOffline: boolean,
): SyncStatus {
  let hasError = false;
  let isSyncing = false;
  let hasPending = false;

  for (const s of snapshots) {
    if (s.error && !isOffline) {
      hasError = true;
    }
    if (s.isGetting || s.isSetting) {
      isSyncing = true;
    }
    if ((s.numPendingSets ?? 0) > 0 || (s.numPendingGets ?? 0) > 0) {
      hasPending = true;
    }
  }

  if (hasError) return 'error';
  if (isSyncing) return 'syncing';
  if (hasPending) return 'pending';
  return 'synced';
}
