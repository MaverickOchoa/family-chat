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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers Web Push subscription with the server so background push notifications
 * wake up the phone in real time even when screen is locked or browser is closed.
 */
export async function subscribeToPushNotifications(userId: string, apiBase: string) {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    if (Notification.permission !== 'granted') return false;

    const res = await fetch(`${apiBase}/api/push/vapid-public-key`);
    if (!res.ok) return false;
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    await fetch(`${apiBase}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: sub })
    });

    console.log('✅ Dispositivo suscrito a Web Push en segundo plano.');
    return true;
  } catch (err) {
    console.warn('Error subscribing to push notifications:', err);
    return false;
  }
}
