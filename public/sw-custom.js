/**
 * Porta Segura — Custom Service Worker Extension
 * Handles push notifications with iOS-style formatting.
 * next-pwa generates the main SW; this is imported as a custom worker.
 */

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Porta Segura',
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    tag: payload.tag || 'safedoor-notification',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'Ver Timeline',
        icon: '/icons/action-view.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/pwa/children';

  // Deep-link explícito tem prioridade (o digest manda /admin/attendance).
  if (data.url) {
    url = data.url;
  }
  // Presença e ausência levam à timeline do aluno específico.
  if ((data.type === 'attendance' || data.type === 'absence') && data.studentId) {
    url = `/pwa/timeline?studentId=${data.studentId}`;
  }

  // Botão "Ver Timeline": vai ao aluno se a notificação carregava um.
  if (event.action === 'view') {
    url = data.studentId ? `/pwa/timeline?studentId=${data.studentId}` : '/pwa/timeline';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('/pwa') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync (for offline event queue)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-events') {
    event.waitUntil(
      fetch('/api/events/sync', { method: 'POST' }).catch(() => {})
    );
  }
});
