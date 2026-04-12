// ── Push notification service (local, no server required) ──────────────────

export type NotificationPermission = 'default' | 'granted' | 'denied';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission() as NotificationPermission;
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission as NotificationPermission;
}

function sendNotification(title: string, body: string, options?: NotificationOptions) {
  if (getNotificationPermission() !== 'granted') return;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      options: { icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png', ...options },
    });
  } else {
    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options,
    });
  }
}

// ── Schedule helpers ───────────────────────────────────────────────────────

const STORAGE_KEY = 'pwa_notification_timers';

interface ScheduledNotif {
  id: string;
  nextTs: number; // epoch ms
  intervalMs: number; // 0 = one-shot
  title: string;
  body: string;
}

function loadScheduled(): ScheduledNotif[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveScheduled(list: ScheduledNotif[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function upsertScheduled(notif: ScheduledNotif) {
  const list = loadScheduled().filter(n => n.id !== notif.id);
  list.push(notif);
  saveScheduled(list);
}

/** Called once at app boot — fires any overdue scheduled notifications */
export function checkScheduledNotifications() {
  if (getNotificationPermission() !== 'granted') return;
  const now = Date.now();
  const updated: ScheduledNotif[] = [];

  for (const n of loadScheduled()) {
    if (now >= n.nextTs) {
      sendNotification(n.title, n.body);
      if (n.intervalMs > 0) {
        updated.push({ ...n, nextTs: now + n.intervalMs });
      }
      // one-shot: drop from list
    } else {
      updated.push(n);
    }
  }
  saveScheduled(updated);
}

// ── Specific notification registrations ───────────────────────────────────

/** Check suscripciones próximas a cobrar (≤3 días) */
export function checkSuscripcionesAlert(suscripciones: { nombre: string; activa: boolean; fechaProximoCobro: string; importe: number }[]) {
  if (getNotificationPermission() !== 'granted') return;
  const now = Date.now();
  suscripciones.filter(s => s.activa).forEach(s => {
    const daysLeft = Math.round((new Date(s.fechaProximoCobro).getTime() - now) / 86_400_000);
    if (daysLeft >= 0 && daysLeft <= 3) {
      sendNotification(
        `Cobro próximo: ${s.nombre}`,
        `${s.importe.toFixed(2)} € se cobran en ${daysLeft === 0 ? 'hoy' : `${daysLeft} día${daysLeft > 1 ? 's' : ''}`}.`,
        { tag: `suscripcion-${s.nombre}` },
      );
    }
  });
}

/** Alert if a position has dropped >10% from purchase price */
export function checkPortfolioDropAlert(posiciones: { simbolo: string; precioMedio: number }[], precios: Record<string, { precio: number }>) {
  if (getNotificationPermission() !== 'granted') return;
  posiciones.forEach(p => {
    const precio = precios[p.simbolo]?.precio;
    if (!precio || !p.precioMedio) return;
    const drop = ((precio - p.precioMedio) / p.precioMedio) * 100;
    if (drop <= -10) {
      const storageKey = `notif_drop_${p.simbolo}`;
      // Only notify once per day per symbol
      const last = parseInt(localStorage.getItem(storageKey) ?? '0', 10);
      if (Date.now() - last < 86_400_000) return;
      localStorage.setItem(storageKey, String(Date.now()));
      sendNotification(
        `Caída >10%: ${p.simbolo}`,
        `${p.simbolo} ha caído ${drop.toFixed(1)}% desde tu precio de compra.`,
        { tag: `drop-${p.simbolo}` },
      );
    }
  });
}

/** Schedule weekly digest every Sunday at 10:00 */
export function scheduleWeeklyDigest() {
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setHours(10, 0, 0, 0);
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? (now.getHours() >= 10 ? 7 : 0) : 7 - day;
  nextSunday.setDate(now.getDate() + daysUntilSunday);

  upsertScheduled({
    id: 'weekly-digest',
    nextTs: nextSunday.getTime(),
    intervalMs: 7 * 24 * 60 * 60 * 1000, // weekly
    title: 'Resumen semanal',
    body: 'Revisa tu progreso financiero esta semana en In-Control.',
  });
}

/** Schedule quarterly tax reminders (ES dates: Apr 20, Jul 20, Oct 20, Jan 20) */
export function scheduleQuarterlyReminders() {
  const year = new Date().getFullYear();
  const deadlines = [
    new Date(year, 3, 20, 9, 0),  // Apr 20
    new Date(year, 6, 20, 9, 0),  // Jul 20
    new Date(year, 9, 20, 9, 0),  // Oct 20
    new Date(year + 1, 0, 20, 9, 0), // Jan 20
  ];

  deadlines.forEach((d, i) => {
    if (d.getTime() > Date.now()) {
      const reminderTs = d.getTime() - 7 * 24 * 60 * 60 * 1000; // 1 week before
      if (reminderTs > Date.now()) {
        upsertScheduled({
          id: `quarterly-tax-${i}`,
          nextTs: reminderTs,
          intervalMs: 0,
          title: 'Declaración trimestral próxima',
          body: `Presentación de impuestos (modelo 130/303) antes del ${d.toLocaleDateString('es-ES')}. Prepara tus datos.`,
        });
      }
    }
  });
}

/** Call this once after permission is granted to set up all scheduled notifications */
export function initNotifications() {
  checkScheduledNotifications();
  scheduleWeeklyDigest();
  scheduleQuarterlyReminders();
}
