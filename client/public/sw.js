// FamilyChat Service Worker for PWA, System Notifications and App Badging
const CACHE_NAME = 'family-chat-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click on mobile devices (Android / iOS)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const contactId = event.notification.data ? event.notification.data.contactId : null;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and tell it to open the contact
      for (const client of clientList) {
        if ('focus' in client) {
          if (contactId) {
            client.postMessage({ type: 'OPEN_CONTACT', contactId });
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one with the contact ID
      if (self.clients.openWindow) {
        return self.clients.openWindow(contactId ? `/?contactId=${contactId}` : '/');
      }
    })
  );
});

// Handle background message if pushed
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    if (self.navigator && 'setAppBadge' in self.navigator) {
      if (event.data.count > 0) {
        self.navigator.setAppBadge(event.data.count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  }
});
