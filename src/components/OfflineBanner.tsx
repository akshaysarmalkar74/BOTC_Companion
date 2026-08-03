import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Fixed banner shown at the top of the page when the browser goes offline.
 * Disappears automatically when connectivity is restored.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      No internet connection — changes may not be saved.
    </div>
  );
}
