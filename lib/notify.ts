/**
 * Camada de canais de notificação ao responsável.
 *
 * Hoje: Web Push (implementado). Amanhã: WhatsApp — a interface já está
 * pronta; quando as credenciais chegarem, basta preencher sendWhatsApp()
 * e definir as variáveis de ambiente. Nenhum chamador precisa mudar.
 *
 * Env esperadas para o WhatsApp (Meta Cloud API):
 *   WHATSAPP_TOKEN            token permanente da app Meta
 *   WHATSAPP_PHONE_NUMBER_ID  id do número emissor
 * (Para um BSP tipo Twilio/Z-API, adapte sendWhatsApp — a assinatura serve.)
 */
import { prisma } from '@/lib/db';
import { notifyParentsOfStudent, type NotificationPayload } from '@/lib/notifications';

export interface ParentMessage {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
}

export interface DeliveryResult {
  /** canais que aceitaram ao menos um envio, ex.: ['push'] */
  channels: string[];
}

function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Envia texto via WhatsApp para um telefone BR (dígitos, com DDD).
 * Retorna true se o provedor aceitou.
 */
async function sendWhatsApp(phoneDigits: string, text: string): Promise<boolean> {
  if (!whatsappConfigured()) return false;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `55${phoneDigits}`,
          type: 'text',
          text: { body: text },
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('WhatsApp send failed:', err);
    return false;
  }
}

/**
 * Notifica todos os responsáveis de um aluno por todos os canais ativos.
 * Push sempre tenta; WhatsApp entra automaticamente quando configurado.
 */
export async function notifyGuardians(
  studentId: string,
  message: ParentMessage
): Promise<DeliveryResult> {
  const channels: string[] = [];

  const payload: NotificationPayload = {
    title: message.title,
    body: message.body,
    tag: message.tag,
    data: message.data,
    requireInteraction: message.requireInteraction,
  };
  const pushSent = await notifyParentsOfStudent(studentId, payload).catch(() => 0);
  if (pushSent > 0) channels.push('push');

  if (whatsappConfigured()) {
    const links = await prisma.studentParent.findMany({
      where: { studentId },
      select: { parent: { select: { phone: true } } },
    });
    let waSent = false;
    for (const l of links) {
      const digits = l.parent.phone?.replace(/\D/g, '');
      if (digits && digits.length >= 10) {
        waSent = (await sendWhatsApp(digits, `${message.title}\n${message.body}`)) || waSent;
      }
    }
    if (waSent) channels.push('whatsapp');
  }

  return { channels };
}
