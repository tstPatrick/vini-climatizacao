import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Api } from './api'
import { ErroApp } from './api'
import type { Ajustes, AgendamentoDetalhado, Bloqueio, Disponibilidade, PerfilCliente, Servico } from './types'
import { normalizarWhats } from '../lib/formato'

const hora = (t: string) => t.slice(0, 5)

export function criarSupabaseApi(url: string, chave: string): Api {
  const sb: SupabaseClient = createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true } })

  async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    // Funções só de leitura vão por GET (mais compatível com navegadores e bloqueadores).
    const { data, error } = await sb.rpc(fn, args, { get: LEITURA.has(fn) })
    if (error) throw new ErroApp(traduzir(error.message, fn))
    return data as T
  }
  async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p
    if (error) throw new ErroApp(traduzir(error.message, 'tabela'))
    return data
  }

  const numero = (v: unknown) => (v == null ? null : Number(v))
  const servico = (s: Servico): Servico => ({ ...s, preco_base: numero(s.preco_base) })
  const detalhado = (a: AgendamentoDetalhado): AgendamentoDetalhado => ({
    ...a,
    servico: servico(a.servico),
    atendimento: a.atendimento ? { ...a.atendimento, valor: numero(a.atendimento.valor) } : null,
  })
  const perfil = (p: PerfilCliente | null) => (p ? { ...p, agendamentos: p.agendamentos.map(detalhado) } : null)

  return {
    modo: 'supabase',

    async getConfig() {
      const [servicos, disp, ajustes] = await Promise.all([
        ok(sb.from('servicos').select('*').eq('ativo', true).order('ordem')),
        ok(sb.from('disponibilidade').select('dia_semana,hora_inicio,hora_fim')),
        ok(sb.from('ajustes').select('*').eq('id', 1).single()),
      ])
      return {
        servicos: (servicos as Servico[]).map(servico),
        disponibilidade: (disp as Disponibilidade[]).map((d) => ({ ...d, hora_inicio: hora(d.hora_inicio), hora_fim: hora(d.hora_fim) })),
        ajustes: ajustes as Ajustes,
      }
    },

    async getOcupados(de, ate) {
      const linhas = await rpc<{ tipo: string; inicio: string; fim: string }[]>('horarios_ocupados', { p_de: de, p_ate: ate })
      return {
        agendamentos: linhas.filter((l) => l.tipo === 'agendamento').map(({ inicio, fim }) => ({ inicio, fim })),
        bloqueios: linhas.filter((l) => l.tipo === 'bloqueio').map(({ inicio, fim }) => ({ inicio, fim })),
      }
    },

    entrarCliente: (whatsapp) => rpc<string | null>('entrar_cliente', { p_whatsapp: whatsapp }),
    getPerfil: async (token) => perfil(await rpc<PerfilCliente | null>('perfil_cliente', { p_token: token })),
    salvarDadosCliente: (token, dados) =>
      rpc('salvar_dados_cliente', { p_token: token, p_dados: { ...dados, whatsapp: normalizarWhats(dados.whatsapp) } }),
    criarAgendamento: (token, n) =>
      rpc('criar_agendamento', {
        p_token: token,
        p_servico: n.servico_id,
        p_endereco: n.endereco_id,
        p_aparelho: n.aparelho_id,
        p_inicio: n.inicio,
        p_observacao: n.observacao_cliente,
        p_quantidade: n.quantidade ?? 1,
      }),
    clienteResponderRemarcacao: (token, id, aceitar) => rpc('cliente_responder_remarcacao', { p_token: token, p_id: id, p_aceitar: aceitar }),
    clienteRemarcar: (token, id, inicio) => rpc('cliente_remarcar', { p_token: token, p_id: id, p_inicio: inicio }),
    clienteCancelar: (token, id) => rpc('cliente_cancelar', { p_token: token, p_id: id }),
    salvarPushCliente: (token, inscricao) => rpc('salvar_push_cliente', { p_token: token, p_inscricao: inscricao }),

    async login(email, senha) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) throw new ErroApp('E-mail ou senha incorretos.')
      const ehTec = await rpc<boolean>('eh_tecnico')
      if (!ehTec) {
        await sb.auth.signOut()
        throw new ErroApp('Este usuário não está cadastrado como técnico.')
      }
    },
    async logout() {
      await sb.auth.signOut()
    },
    async logado() {
      const { data } = await sb.auth.getSession()
      return !!data.session
    },
    async tecEmail() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.email ?? null
    },
    async tecTrocarSenha(atual, nova) {
      const email = (await sb.auth.getSession()).data.session?.user.email
      if (!email) throw new ErroApp('Entre como técnico para continuar.')
      const conferir = await sb.auth.signInWithPassword({ email, password: atual })
      if (conferir.error) throw new ErroApp('Senha atual incorreta.')
      const { error } = await sb.auth.updateUser({ password: nova })
      if (error) throw new ErroApp(/weak|short|characters/i.test(error.message) ? 'Senha fraca: use pelo menos 10 caracteres, com letras e números.' : /same|different/i.test(error.message) ? 'A nova senha deve ser diferente da atual.' : error.message)
    },
    async tecTrocarEmail(novo, senha) {
      const email = (await sb.auth.getSession()).data.session?.user.email
      if (!email) throw new ErroApp('Entre como técnico para continuar.')
      const conferir = await sb.auth.signInWithPassword({ email, password: senha })
      if (conferir.error) throw new ErroApp('Senha incorreta.')
      await rpc('tec_trocar_email', { p_email: novo })
      // Entra de novo para a sessão já mostrar o e-mail novo.
      await sb.auth.signInWithPassword({ email: novo.trim().toLowerCase(), password: senha })
    },

    tecAgendamentos: async (de, ate) => (await rpc<AgendamentoDetalhado[]>('tec_agendamentos', { p_de: de, p_ate: ate })).map(detalhado),
    tecAgendamento: async (id) => {
      const a = await rpc<AgendamentoDetalhado | null>('tec_agendamento', { p_id: id })
      return a ? detalhado(a) : null
    },
    tecConfirmar: (id) => rpc('tec_status', { p_id: id, p_status: 'confirmado' }),
    tecCancelar: (id) => rpc('tec_status', { p_id: id, p_status: 'cancelado' }),
    tecRemarcar: (id, inicio) => rpc('tec_remarcar', { p_id: id, p_inicio: inicio }),
    tecConcluir: (id, d) =>
      rpc('tec_concluir', { p_id: id, p_descricao: d.descricao, p_pecas: d.pecas, p_valor: d.valor, p_fotos: d.fotos }),
    tecClientes: () => rpc('tec_clientes'),
    tecCliente: async (id) => {
      const p = await rpc<(PerfilCliente & { retornos: [] }) | null>('tec_cliente', { p_id: id })
      return p && p.cliente ? { ...perfil(p)!, retornos: p.retornos } : null
    },
    tecRetornos: () => rpc('tec_retornos'),
    tecSalvarPush: (inscricao) => rpc('tec_salvar_push', { p_inscricao: inscricao }),
    async tecAtualizarRetorno(id, status) {
      await ok(sb.from('retornos').update({ status }).eq('id', id))
    },
    tecServicos: async () => ((await ok(sb.from('servicos').select('*').order('ordem'))) as Servico[]).map(servico),
    async tecSalvarServico(s) {
      await ok(sb.from('servicos').upsert(s))
    },
    async tecSalvarDisponibilidade(d) {
      await ok(sb.from('disponibilidade').delete().gte('id', 0))
      if (d.length) await ok(sb.from('disponibilidade').insert(d))
    },
    async tecSalvarAjustes(a) {
      await ok(sb.from('ajustes').update({ ...a, whatsapp_tecnico: normalizarWhats(a.whatsapp_tecnico) }).eq('id', 1))
    },
    tecBloqueios: async () => (await ok(sb.from('bloqueios').select('*').order('inicio'))) as Bloqueio[],
    async tecCriarBloqueio(b) {
      await ok(sb.from('bloqueios').insert(b))
    },
    async tecRemoverBloqueio(id) {
      await ok(sb.from('bloqueios').delete().eq('id', id))
    },
  }
}

const LEITURA = new Set([
  'horarios_ocupados', 'entrar_cliente', 'perfil_cliente', 'eh_tecnico',
  'tec_agendamentos', 'tec_agendamento', 'tec_clientes', 'tec_cliente', 'tec_retornos',
])

function traduzir(msg: string, origem: string): string {
  if (/sem_conflito|exclusion/i.test(msg)) return 'Esse horário acabou de ser ocupado. Escolha outro, por favor.'
  if (/fetch|load failed|network/i.test(msg)) {
    if (!navigator.onLine) return 'Sem conexão com a internet. Tente de novo.'
    return `Não foi possível falar com o servidor. Tente de novo. (${origem}: ${msg})`
  }
  if (/could not find the function|schema cache|does not exist/i.test(msg))
    return `O banco não está completo: rode o arquivo supabase/schema.sql de novo no Supabase. (${origem}: ${msg})`
  if (/permission denied/i.test(msg)) return `Sem permissão no banco. (${origem}: ${msg})`
  return msg
}
