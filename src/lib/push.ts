// Inscrição em notificações push (Web Push).

export type EstadoPush = 'ativo' | 'desativado' | 'bloqueado' | 'instalar-iphone' | 'sem-suporte'

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export function suportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!suportaPush()) return ehIOS() && !instalado() ? 'instalar-iphone' : 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission !== 'granted') return 'desativado'
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) ? 'ativo' : 'desativado'
  } catch {
    return 'desativado'
  }
}

function chaveParaBytes(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

/** Pede permissão (precisa ser chamado num toque do usuário) e devolve a inscrição. */
export async function inscreverPush(chavePublica: string): Promise<PushSubscriptionJSON> {
  if (!suportaPush()) throw new Error('Este navegador não aceita notificações.')
  if (!chavePublica) throw new Error('Notificações ainda não configuradas no servidor.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão de notificação não concedida.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub)
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) as BufferSource })
  return sub.toJSON()
}

/** Se já tem permissão, devolve a inscrição atual (para re-sincronizar com o servidor). */
export async function inscricaoAtual(): Promise<PushSubscriptionJSON | null> {
  if (!suportaPush() || Notification.permission !== 'granted') return null
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? sub.toJSON() : null
  } catch {
    return null
  }
}
