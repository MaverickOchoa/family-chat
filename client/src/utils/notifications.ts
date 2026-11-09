/**
 * Mobile-First Notification and Badging Utility
 * Supports Android Chrome Service Worker notifications, iOS PWA, and desktop fallbacks.
 */

export async function triggerDeviceNotification(title: string, options: any = {}) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const defaultOptions = {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    ...options
  };

  // 1. Android Chrome / Mobile PWA Service Worker (Standard and mandatory on mobile)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    }
  } catch (err) {
    console.warn('ServiceWorker showNotification failed:', err);
  }

  // 2. Desktop Browser window.Notification fallback
  try {
    const notif = new Notification(title, defaultOptions);
    if (options.onclick) {
      notif.onclick = options.onclick;
    }
  } catch (err) {
    console.warn('window.Notification constructor fallback failed:', err);
  }
}

/**
 * Updates the unread badge directly on the user's phone home screen icon (Badging API).
 */
export function updateAppBadge(unreadCount: number) {
  if (typeof window === 'undefined') return;

  if ('setAppBadge' in navigator) {
    if (unreadCount > 0) {
      navigator.setAppBadge(unreadCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  // Also post to Service Worker if active
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_BADGE',
      count: unreadCount
    });
  }

  // Update document title for background browser tabs
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) FamilyChat`;
  } else {
    document.title = 'FamilyChat - Bóveda y Mensajería Familiar';
  }
}
