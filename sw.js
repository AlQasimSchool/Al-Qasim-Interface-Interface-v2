/* Service Worker for Scouts PC Interface */
const CACHE_NAME = 'scouts-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Handle Background Push Notifications
self.addEventListener('push', (event) => {
    let data = { title: 'تنبيه جديد', body: 'لديك إشعار جديد من كشافة عبدالرحمن بن القasim' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'ico.png',
        badge: 'ico.png',
        visualInformation: true,
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
