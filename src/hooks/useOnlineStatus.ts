import { useState, useEffect } from 'react';

/**
 * Returns true when the browser has network connectivity.
 * Updates reactively on window online/offline events.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
