'use client';

/**
 * Inscrição em push num lugar só.
 *
 * Antes existiam duas implementações divergentes (children-client passava a
 * chave VAPID como string crua; o perfil convertia certo) e nenhuma tinha
 * timeout: qualquer soluço na instalação do service worker deixava o botão
 * "Ativar Notificações" pendurado para sempre, sem nenhuma mensagem.
 *
 * Este helper devolve um resultado tipado com a mensagem certa para o
 * usuário em cada falha — incluindo o caso do iPhone, onde o push só existe
 * com o app instalado na tela de início.
 */

export type PushResult =
  | { ok: true }
  | { ok: false; reason: string; hint?: string };

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

export async function subscribeToPush(): Promise<PushResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (isIOS() && !isStandalone()) {
      return {
        ok: false,
        reason: 'No iPhone, instale o app primeiro',
        hint: 'Toque em Compartilhar e depois em "Adicionar à Tela de Início". As notificações funcionam pelo app instalado.',
      };
    }
    return { ok: false, reason: 'Este navegador não suporta notificações' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: 'Permissão de notificação negada',
      hint: 'Libere as notificações para este site nas configurações do navegador.',
    };
  }

  // Garante um registro e espera ficar pronto — com prazo. Sem o timeout,
  // uma instalação travada deixava o botão girando eternamente.
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    return { ok: false, reason: 'Não foi possível preparar as notificações', hint: 'Recarregue a página e tente de novo.' };
  }
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
  ]);
  if (!reg) {
    return { ok: false, reason: 'As notificações demoraram para preparar', hint: 'Recarregue a página e tente de novo.' };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) {
    return { ok: false, reason: 'Notificações indisponíveis no momento', hint: 'Tente novamente mais tarde.' };
  }

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
    });
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    if (!res.ok) {
      return { ok: false, reason: 'Não foi possível salvar sua inscrição', hint: 'Tente novamente.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Não foi possível ativar as notificações', hint: 'Recarregue a página e tente de novo.' };
  }
}
