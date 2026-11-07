// Edge Function "notificar": envia notificações push do agendamento.
// Chamada pelo gatilho notificar_agendamento (banco), com o cabeçalho x-vini-segredo.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const PARA_TECNICO = new Set(['novo', 'mudou_horario', 'cliente_aceitou', 'cancelado_pelo_cliente'])

function quando(iso: string) {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia', weekday: 'long', day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' })
  return `${dia} às ${hora}`
}

function mensagem(evento: string, a: any) {
  const s = a.servicos?.nome ?? 'Serviço'
  const nome = a.clientes?.nome ?? 'Cliente'
  const bairro = a.enderecos?.bairro ? ` · ${a.enderecos.bairro}` : ''
  const q = quando(a.inicio)
  const tec = `./#/tecnico/agendamento/${a.id}`
  const cli = `./#/meus/${a.id}`
  switch (evento) {
    case 'novo':
      return { titulo: `Novo pedido: ${s}`, corpo: `${nome} · ${q}${bairro}`, url: tec }
    case 'mudou_horario':
      return { titulo: 'Cliente mudou o horário', corpo: `${nome} · ${s} · ${q}`, url: tec }
    case 'cliente_aceitou':
      return { titulo: 'Cliente aceitou o novo horário', corpo: `${nome} · ${s} · ${q}`, url: tec }
    case 'cancelado_pelo_cliente':
      return { titulo: 'Cliente cancelou', corpo: `${nome} · ${s} · ${q}`, url: tec }
    case 'confirmado':
      return { titulo: 'Agendamento confirmado', corpo: `${s} · ${q}. Até lá!`, url: cli }
    case 'remarcado':
      return { titulo: 'Novo horário sugerido', corpo: `${s} · ${q}. Toque para aceitar ou escolher outro.`, url: cli }
    case 'cancelado':
      return { titulo: 'Agendamento cancelado', corpo: `${s} · ${q}. Toque para escolher outro horário.`, url: cli }
    default:
      return null
  }
}

Deno.serve(async (req) => {
  const { data: cfg } = await sb.from('notificacao_config').select('*').eq('id', 1).single()
  if (!cfg?.segredo || req.headers.get('x-vini-segredo') !== cfg.segredo) {
    return new Response('não autorizado', { status: 401 })
  }
  const { agendamento_id, evento } = await req.json().catch(() => ({}))
  const { data: a } = await sb
    .from('agendamentos')
    .select('id, inicio, cliente_id, servicos(nome), clientes(nome), enderecos(bairro)')
    .eq('id', agendamento_id)
    .single()
  const msg = a && mensagem(evento, a)
  if (!msg) return Response.json({ enviados: 0, motivo: 'sem mensagem' })

  let q = sb.from('push_inscricoes').select('*')
  q = PARA_TECNICO.has(evento) ? q.eq('tecnico', true) : q.eq('cliente_id', a.cliente_id)
  const { data: inscricoes } = await q

  webpush.setVapidDetails(cfg.contato || 'https://vini-climatizacao.tstpatrickernandes.workers.dev', cfg.vapid_publica, cfg.vapid_privada)
  const payload = JSON.stringify({ ...msg, tag: `ag-${a.id}` })
  let enviados = 0
  const erros: string[] = []
  for (const i of inscricoes ?? []) {
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload, { TTL: 86400 })
      enviados++
    } catch (e: any) {
      // Inscrição expirada ou removida: apaga.
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from('push_inscricoes').delete().eq('endpoint', i.endpoint)
      else erros.push(String(e?.statusCode ?? e?.message ?? e))
    }
  }
  return Response.json({ evento, enviados, erros })
})
