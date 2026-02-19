/* Notifications Logic — Simplified for Local Reminders */
import { getTasks, saveTasks } from './tasks.js';

export async function initNotifications() {
    if (!('Notification' in window)) {
        console.warn('الإشعارات غير مدعومة في هذا المتصفح.');
        return;
    }

    // Start checking for scheduled reminders
    startReminderMonitor();
}

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (e) {
        return false;
    }
}

/**
 * Robust notification delivery for internal browser notifications
 */
export async function sendNotification(title, body) {
    console.log(`Sending notification: ${title} - ${body}`);

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, { body: body, icon: 'ico.png' });
        } catch (e) {
            // Some mobile browsers might require SW to show notifications even if in foreground
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg) {
                    reg.showNotification(title, { body: body, icon: 'ico.png' });
                }
            }
        }
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
