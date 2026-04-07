/**
 * Push notification service using Web Push + Firebase Cloud Messaging
 */
import webpush from 'web-push';
import { prisma } from '@/lib/db';

// Configure web-push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@safedoor.com.br',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Send push notification to all parents of a student
 */
export async function notifyParentsOfStudent(
  studentId: string,
  payload: NotificationPayload
): Promise<void> {
  const studentParents = await prisma.studentParent.findMany({
    where: { studentId },
    include: {
      parent: {
        include: {
          pushSubscriptions: true,
        },
      },
    },
  });

  const sendPromises: Promise<void>[] = [];

  for (const sp of studentParents) {
    for (const sub of sp.parent.pushSubscriptions) {
      sendPromises.push(
        sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          sub.id
        )
      );
    }
  }

  await Promise.allSettled(sendPromises);
}

/**
 * Send a single push notification
 */
async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: NotificationPayload,
  subscriptionId: string
): Promise<void> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        data: payload.data || {},
        tag: payload.tag,
        requireInteraction: payload.requireInteraction || false,
      })
    );
  } catch (error: any) {
    // Remove invalid subscriptions (410 Gone, 404 Not Found)
    if (error.statusCode === 410 || error.statusCode === 404) {
      await prisma.pushSubscription.delete({
        where: { id: subscriptionId },
      }).catch(() => {});
    }
    console.error(`Push notification failed for ${subscriptionId}:`, error.message);
  }
}

/**
 * Format attendance event notification
 */
export function formatAttendanceNotification(
  studentName: string,
  eventType: 'ENTRY' | 'EXIT',
  timestamp: Date,
  schoolName: string,
  notes?: string | null
): NotificationPayload {
  const time = timestamp.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const isEntry = eventType === 'ENTRY';
  const isLate = notes?.includes('ATRASO');
  const isEarlyExit = notes?.includes('SAIDA_ANTECIPADA');

  let title: string;
  let body: string;

  if (isLate) {
    title = `Safe Door — Atraso Registrado`;
    body = `${studentName} chegou com atraso na ${schoolName} às ${time}`;
  } else if (isEarlyExit) {
    title = `Safe Door — Saída Antecipada`;
    body = `${studentName} saiu antecipadamente da ${schoolName} às ${time}`;
  } else {
    title = `Safe Door — ${isEntry ? 'Entrada' : 'Saída'} Registrada`;
    body = isEntry
      ? `${studentName} entrou na ${schoolName} às ${time}`
      : `${studentName} saiu da ${schoolName} às ${time}`;
  }

  return {
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `attendance-${eventType.toLowerCase()}-${timestamp.toISOString().slice(0, 10)}`,
    data: {
      type: 'attendance',
      eventType,
      studentName,
      timestamp: timestamp.toISOString(),
      isLate,
    },
    requireInteraction: isLate || isEarlyExit, // Require interaction for important events
  };
}
