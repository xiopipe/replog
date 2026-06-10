/**
 * useRows — reactive read of a Legend-State collection observable.
 *
 * WHY THIS EXISTS
 * ---------------
 * Legend-State stores each observable's value in a plain object that it mutates
 * **in place**. `use$(collection$)` therefore returns a *reference-stable*
 * object: when a row is added, removed, or a field changes, `.get()` keeps
 * returning the very same object reference.
 *
 * Screens derive view-models from these collections with
 * `useMemo(() => derive(raw), [raw])`. Because `raw` never changes its
 * reference, those memos never recompute — so newly added rows (a logged set,
 * a created plan, an added session exercise) do **not** appear until the screen
 * is remounted. The component still re-renders (Legend fires the change), but
 * the memoized derivation is stale.
 *
 * THE FIX
 * -------
 * Read the collection through a `use$` selector that returns a fresh shallow
 * copy on every emission. The copy is a new reference whenever Legend notifies
 * a change, so `useMemo([rows])` invalidates correctly and the derived data
 * reflects adds/removes/updates live. The shallow copy is cheap (top-level key
 * spread) and the child row objects are shared, so deep field reads are
 * unaffected.
 *
 * Returns `undefined` while the observable is not yet available/loaded (e.g.
 * before auth resolves `db`), preserving the original `use$(db?.x$)` contract
 * so existing `?? {}` fallbacks and loading checks keep working.
 */

import { type Observable } from '@legendapp/state';
import { use$ } from '@legendapp/state/react';

export function useRows<T>(
  collection$: Observable<Record<string, T>> | undefined | null,
): Record<string, T> | undefined {
  return use$(() => {
    const value = collection$?.get() as Record<string, T> | undefined;
    // Fresh reference on every emission → downstream useMemo invalidates.
    return value ? { ...value } : value;
  }) as Record<string, T> | undefined;
}
