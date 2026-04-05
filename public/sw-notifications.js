// Notification message handler — injected into service worker context
// This file is imported by the Workbox-generated SW via importScripts

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, options } = event.data;
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title, { body, ...options });
    }
  }
});

// Notification click → focus / open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
