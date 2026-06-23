/**
 * Tests for deriveSyncStatus — TKT-0047.
 * Pure node environment — no RN or Legend-State imports.
 */
import { deriveSyncStatus, type SyncStateSnapshot } from '../syncStatus';

describe('deriveSyncStatus', () => {
  const empty: SyncStateSnapshot[] = [];

  it('returns synced when there are no collections', () => {
    expect(deriveSyncStatus(empty, false)).toBe('synced');
  });

  it('returns synced when all collections are idle', () => {
    const snapshots: SyncStateSnapshot[] = [
      { isLoaded: true },
      { isLoaded: true, numPendingSets: 0 },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('synced');
  });

  it('returns syncing when any collection isGetting', () => {
    const snapshots: SyncStateSnapshot[] = [
      { isGetting: true },
      { isLoaded: true },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('syncing');
  });

  it('returns syncing when any collection isSetting', () => {
    const snapshots: SyncStateSnapshot[] = [
      { isSetting: true },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('syncing');
  });

  it('returns pending when numPendingSets > 0', () => {
    const snapshots: SyncStateSnapshot[] = [
      { numPendingSets: 3 },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('pending');
  });

  it('returns pending when numPendingGets > 0', () => {
    const snapshots: SyncStateSnapshot[] = [
      { numPendingGets: 1 },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('pending');
  });

  it('returns error when any collection has error (and online)', () => {
    const snapshots: SyncStateSnapshot[] = [
      { error: new Error('auth failed') },
      { isLoaded: true },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('error');
  });

  it('suppresses error when offline (isOffline = true)', () => {
    const snapshots: SyncStateSnapshot[] = [
      { error: new Error('network failed') },
    ];
    expect(deriveSyncStatus(snapshots, true)).toBe('synced');
  });

  it('error takes priority over syncing', () => {
    const snapshots: SyncStateSnapshot[] = [
      { error: new Error('rls error'), isGetting: true },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('error');
  });

  it('syncing takes priority over pending', () => {
    const snapshots: SyncStateSnapshot[] = [
      { isGetting: true, numPendingSets: 5 },
    ];
    expect(deriveSyncStatus(snapshots, false)).toBe('syncing');
  });
});
