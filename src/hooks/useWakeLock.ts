import { useRef, useCallback, useEffect } from 'react';

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    if (sentinelRef.current) return; // already held
    try {
      sentinelRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      sentinelRef.current.addEventListener('release', () => {
        sentinelRef.current = null;
      });
    } catch {
      // Device refused wake lock (e.g. battery saver) — fail silently
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await sentinelRef.current?.release();
    } catch {
      // Already released — fail silently
    } finally {
      sentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return { acquireWakeLock, releaseWakeLock };
}
