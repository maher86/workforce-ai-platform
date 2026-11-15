export const notificationsSupported = () =>
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator;

// This worker only displays generic notifications. It never handles/caches media or requests.
export async function enableReportNotifications(): Promise<boolean> {
    if (!notificationsSupported()) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    await navigator.serviceWorker.register('/report-notifications-sw.js', {
        scope: '/employee/',
    });
    return true;
}

export async function notifyReportReceived() {
    if (!notificationsSupported() || Notification.permission !== 'granted')
        return;
    const registration =
        await navigator.serviceWorker.getRegistration('/employee/');
    if (!registration?.active) return;
    await registration.showNotification('اكتملت معالجة التقرير', {
        body: 'Report ready',
        icon: '/icons/workforce-192.png',
        tag: 'workforce-report-received',
        silent: true,
    });
}
