/* Notifications and Median Bridge Logic */
import { getTasks, saveTasks } from './tasks.js';

export async function initNotifications() {
    if (!('Notification' in window)) {
        console.warn('الإشعارات غير مدعومة في هذا المتصفح.');
    }

    // Register Service Worker for PWA/Push
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration);
        } catch (err) {
            console.warn('SW registration failed:', err);
        }
    }

    // Check Median/OneSignal Bridge
    initPushBridges();

    // Start checking for scheduled reminders
    startReminderMonitor();
}

/**
 * Handle Native App (Median) and Web Push (OneSignal) registration
 */
function initPushBridges() {
    // 1. Median Native Push Registration
    if (window.median) {
        console.log('Median detected, registering for native push...');
        // Median documentation: median.push.register() initiates registration
        window.median.push.register();
    }

    // 2. OneSignal Handshake
    if (window.OneSignal) {
        console.log('OneSignal detected, initializing handshake...');
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
            const isPushSupported = OneSignal.Notifications.isPushSupported();
            if (isPushSupported) {
                console.log('OneSignal Push is supported.');
            }
        });
    }
}

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;

    // Check OneSignal permission first if available
    if (window.OneSignal) {
        return await window.OneSignal.Notifications.requestPermission();
    }

    if (Notification.permission === 'granted') return true;

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (e) {
        return false;
    }
}

/**
 * Robust notification delivery across all platforms
 */
export async function sendNotification(title, body) {
    console.log(`Sending notification: ${title} - ${body}`);

    // Priority 1: OneSignal Native/Web Push (Strongest)
    if (window.OneSignal && OneSignal.Notifications.permission) {
        try {
            // OneSignal displaySelfHostedNotification is good for local triggers that should look native
            window.OneSignal.displaySelfHostedNotification(title, body, 'ico.png');
            return;
        } catch (e) {
            console.warn('OneSignal direct notification failed, falling back.');
        }
    }

    // Priority 2: Service Worker (Good for background)
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg) {
                reg.showNotification(title, {
                    body: body,
                    icon: 'ico.png',
                    badge: 'ico.png',
                    vibrate: [200, 100, 200]
                });
                return;
            }
        } catch (e) {
            console.warn('SW Notification failed, using fallback.');
        }
    }

    // Priority 3: Browser API (Foreground)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: 'ico.png' });
    } else {
        // Ultimate fallback: Alert (to ensure user sees it somehow)
        // alert(`${title}\n${body}`); 
    }
}

let monitorInterval = null;
export function startReminderMonitor() {
    if (monitorInterval) clearInterval(monitorInterval);

    console.log('Reminder monitor active.');
    monitorInterval = setInterval(async () => {
        const tasks = getTasks();
        const now = new Date();
        let changed = false;

        for (const task of tasks) {
            if (task.reminderTime && !task.notified) {
                const reminderDate = new Date(task.reminderTime);
                if (now >= reminderDate) {
                    await sendNotification(
                        task.type === 'task' ? 'تنبيه مهمة 📅' : 'تنبيه ملاحظة 📝',
                        task.text
                    );
                    task.notified = true;
                    changed = true;
                }
            }
        }

        if (changed) {
            saveTasks(tasks);
        }
    }, 30000);
}

// Global helper for testing
window.testNotification = () => {
    sendNotification('اختبار الإشعارات 🚀', 'هذا الإشعار لتأكيد عمل النظام بنجاح على هذا الجهاز.');
};
