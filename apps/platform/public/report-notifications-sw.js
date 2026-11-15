// Notification-only worker: no fetch, cache, sync, media or credential persistence.
self.addEventListener('install', (event) =>
    event.waitUntil(self.skipWaiting()),
);
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(async (clients) => {
                const employee = clients.find((client) =>
                    new URL(client.url).pathname.startsWith('/employee'),
                );
                if (employee) return employee.focus();
                return self.clients.openWindow('/employee');
            }),
    );
});
