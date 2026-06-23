/**
 * useNetworkState — connectivity detection hook (TKT-0048).
 *
 * Uses expo-network to detect whether the device has internet connectivity.
 * Returns a stable `isOffline` boolean that reflects the current network state.
 *
 * - Initial state is determined asynchronously via getNetworkStateAsync().
 * - Subsequent changes are tracked via addNetworkStateListener().
 * - `isOffline` is true when isConnected === false OR isInternetReachable === false.
 *
 * Safe to call from multiple components — each call creates its own listener
 * but they all converge on the same underlying platform event.
 *
 * NOTE: This hook does NOT use synchronous setState in useEffect (React-19 rule).
 * The initial async check uses a promise callback; the listener uses an event handler.
 */

import * as Network from 'expo-network';
import { useEffect, useRef, useState } from 'react';

function isNetworkOffline(state: Network.NetworkState): boolean {
  // Treat not-connected OR not-internet-reachable as offline.
  // A device may be connected to WiFi but have no internet (captive portal etc).
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export interface UseNetworkState {
  isOffline: boolean;
}

export function useNetworkState(): UseNetworkState {
  // Start optimistic (assume online) — we'll correct once the async check resolves.
  const [isOffline, setIsOffline] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Async initial check — not synchronous setState in effect body (React-19 safe).
    Network.getNetworkStateAsync().then((state) => {
      if (mountedRef.current) {
        setIsOffline(isNetworkOffline(state));
      }
    });

    // Subscribe to subsequent changes.
    const subscription = Network.addNetworkStateListener((event) => {
      if (mountedRef.current) {
        setIsOffline(isNetworkOffline(event));
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, []);

  return { isOffline };
}
