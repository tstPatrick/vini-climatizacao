// MODO DEMONSTRAÇÃO: simula o servidor guardando tudo no próprio aparelho (localStorage).
// Serve para testar o app sem configurar o Supabase. As mesmas validações do servidor
// (conflito de horário, antecedência, limite de dias) são feitas aqui.
import type { Api, ConfigPublica } from './api'
import { ErroApp } from './api'
import { AJUSTES_PADRAO, DISPONIBILIDADE_PADRAO, SERVICOS_PADRAO } from './padroes'
import type {
  Agendamento,
  AgendamentoDetalhado,
  Ajustes,
  Aparelho,
  Atendimento,
  Bloqueio,
  Cliente,
  ClienteResumo,
  Disponibilidade,
  Endereco,
  Retorno,
  RetornoDetalhado,
  Servico,
} from './types'
import { STATUS_ATIVOS } from './types'
import { MAX_APARELHOS, duracaoVisita, horarioValido } from '../lib/horarios'
import { chaveDia, hojeChave, isoLocal, somarDias, somarMeses } from '../lib/tempo'
import { normalizarWhats } from '../lib/formato'

interface Banco {
  versao: number
  servicos: Servico[]
  clientes: (Cliente & { token: string })[]
  enderecos: Endereco[]
  aparelhos: Aparelho[]
  agendamentos: Agendamento[]
  atendimentos: Atendimento[]
  retornos: Retorno[]
  disponibilidade: Disponibilidade[]
  bloqueios: Bloqueio[]
  ajustes: Ajustes
}

const CHAVE = 'vini-demo-banco'
const CHAVE_SESSAO = 'vini-demo-tecnico'
export const DEMO_EMAIL = 'tecnico@vini.app'
export const DEMO_SENHA = 'vini123'
const CHAVE_CREDENCIAIS = 'vini-demo-credenciais'

function credenciaisDemo(): { email: string; senha: string } {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CREDENCIAIS) || 'null')
    if (c?.email && c?.senha) return c
  } catch {
    /* ignora */
  }
  return { email: DEMO_EMAIL, senha: DEMO_SENHA }
}

const id = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
const agoraIso = () => new Date().toISOString()
const espera = () => new Promise((r) => setTimeout(r, 120))

function semente(): Banco {
  const hoje = hojeChave()
  const b: Banco = {
    versao: 1,
    servicos: structuredClone(SERVICOS_PADRAO),
    clientes: [],
    enderecos: [],
    aparelhos: [],
    agendamentos: [],
    atendimentos: [],
    retornos: [],
    disponibilidade: structuredClone(DISPONIBILIDADE_PADRAO),
    bloqueios: [],
    ajustes: { ...AJUSTES_PADRAO },
  }
  const pessoas: [string, string, string, string, string, number][] = [
    ['Mariana Souza', '71988881111', 'Rua das Hortênsias', '120', 'Pituba', 12000],
    ['Carlos Lima', '71988882222', 'Av. Oceânica', '845', 'Barra', 9000],
    ['Juliana Rocha', '71988883333', 'Rua Alceu Amoroso Lima', '470', 'Caminho das Árvores', 18000],
    ['Roberto Alves', '71988884444', 'Rua Rio Grande do Sul', '33', 'Pituba', 12000],
    ['Ana Paula Mendes', '71988885555', 'Av. Tancredo Neves', '1500', 'Stiep', 24000],
    ['Felipe Santos', '71988886666', 'Rua da Paciência', '210', 'Rio Vermelho', 9000],
  ]
  const ids = pessoas.map(([nome, wa, rua, numero, bairro, btus], i) => {
    const c = { id: id(), nome, whatsapp: '55' + wa, criado_em: agoraIso(), token: id() }
    const e = { id: id(), cliente_id: c.id, rua, numero, bairro, complemento: i % 2 ? 'Apto 302' : '', observacoes: '' }
    const a = { id: id(), cliente_id: c.id, tipo: 'Split', marca: ['LG', 'Samsung', 'Midea', 'Gree', 'Elgin', 'Daikin'][i], btus, foto_url: null }
    b.clientes.push(c)
    b.enderecos.push(e)
    b.aparelhos.push(a)
    return { c, e, a }
  })
  const dur = (s: string) => b.servicos.find((x) => x.id === s)!.duracao_min
  const ag = (i: number, servico: string, dia: string, min: number, status: Agendamento['status']) => {
    const inicio = new Date(isoLocal(dia, min)).toISOString()
    const a: Agendamento = {
      id: id(),
      cliente_id: ids[i].c.id,
      servico_id: servico,
      endereco_id: ids[i].e.id,
      aparelho_id: ids[i].a.id,
      inicio,
      fim: new Date(new Date(inicio).getTime() + dur(servico) * 60_000).toISOString(),
      status,
      observacao_cliente: '',
      quantidade: 1,
      criado_em: agoraIso(),
    }
    b.agendamentos.push(a)
    return a
  }
  // Agenda de hoje e amanhã
  ag(0, 'limpeza', hoje, 8 * 60, 'confirmado')
  ag(1, 'manutencao', hoje, 10 * 60, 'pendente')
  ag(2, 'instalacao', hoje, 14 * 60, 'confirmado')
  ag(3, 'carga-gas', somarDias(hoje, 1), 9 * 60, 'pendente')
  // Histórico com retornos
  const concluido = (i: number, servico: string, diasAtras: number, desc: string, valor: number, retornoEm: string | null) => {
    const a = ag(i, servico, somarDias(hoje, -diasAtras), 9 * 60, 'concluido')
    b.atendimentos.push({ id: id(), agendamento_id: a.id, descricao: desc, pecas: '', valor, fotos: [], concluido_em: a.fim })
    if (retornoEm)
      b.retornos.push({ id: id(), cliente_id: ids[i].c.id, aparelho_id: ids[i].a.id, servico_id: servico, data_prevista: retornoEm, status: 'pendente' })
  }
  concluido(4, 'limpeza', 182, 'Higienização completa da evaporadora e condensadora.', 180, hoje)
  concluido(5, 'limpeza', 200, 'Limpeza com bactericida e troca do dreno.', 160, somarDias(hoje, -12))
  concluido(0, 'manutencao', 90, 'Troca do capacitor. Testado e funcionando.', 250, somarMeses(somarDias(hoje, -90), 12))
  concluido(1, 'limpeza', 60, 'Higienização completa.', 180, somarMeses(somarDias(hoje, -60), 6))
  return b
}

function ler(): Banco {
  try {
    const s = localStorage.getItem(CHAVE)
    if (s) return JSON.parse(s) as Banco
  } catch {
    /* ignora */
  }
  const b = semente()
  gravar(b)
  return b
}

function gravar(b: Banco) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(b))
  } catch {
    throw new ErroApp('Não foi possível salvar neste aparelho (armazenamento cheio?).')
  }
}

function detalhar(b: Banco, a: Agendamento): AgendamentoDetalhado {
  const { token: _t, ...cliente } = b.clientes.find((c) => c.id === a.cliente_id)!
  return {
    ...a,
    servico: b.servicos.find((s) => s.id === a.servico_id)!,
    cliente,
    endereco: b.enderecos.find((e) => e.id === a.endereco_id)!,
    aparelho: b.aparelhos.find((x) => x.id === a.aparelho_id) ?? null,
    atendimento: b.atendimentos.find((x) => x.agendamento_id === a.id) ?? null,
  }
}

function detalharRetorno(b: Banco, r: Retorno): RetornoDetalhado {
  const { token: _t, ...cliente } = b.clientes.find((c) => c.id === r.cliente_id)!
  return {
    ...r,
    cliente,
    servico: b.servicos.find((s) => s.id === r.servico_id)!,
    aparelho: b.aparelhos.find((x) => x.id === r.aparelho_id) ?? null,
  }
}

function validarHorario(b: Banco, servico_id: string, inicio: string, ignorarId?: string, duracao?: number) {
  const s = b.servicos.find((x) => x.id === servico_id && x.ativo)
  if (!s) throw new ErroApp('Serviço não encontrado.')
  const dur = duracao ?? s.duracao_min
  const ocupados = b.agendamentos
    .filter((a) => STATUS_ATIVOS.includes(a.status) && a.id !== ignorarId)
    .map((a) => ({ inicio: a.inicio, fim: a.fim }))
  const ok = horarioValido({
    inicio,
    duracaoMin: dur,
    disponibilidade: b.disponibilidade,
    ocupados,
    bloqueios: b.bloqueios,
    ajustes: b.ajustes,
  })
  if (!ok) throw new ErroApp('Esse horário acabou de ser ocupado. Escolha outro, por favor.')
  return { inicio: new Date(inicio).toISOString(), fim: new Date(new Date(inicio).getTime() + dur * 60_000).toISOString() }
}

const minutosDe = (a: Agendamento) => Math.round((new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60_000)

function clienteDoToken(b: Banco, token: string) {
  const c = b.clientes.find((x) => x.token === token)
  if (!c) throw new ErroApp('Cadastro não encontrado. Informe seus dados novamente.')
  return c
}

function agendamentoDoCliente(b: Banco, token: string, ag: string) {
  const c = clienteDoToken(b, token)
  const a = b.agendamentos.find((x) => x.id === ag && x.cliente_id === c.id)
  if (!a) throw new ErroApp('Agendamento não encontrado.')
  return a
}

function exigirTecnico() {
  if (localStorage.getItem(CHAVE_SESSAO) !== '1') throw new ErroApp('Entre como técnico para continuar.')
}

export function criarLocalApi(): Api {
  const api: Api = {
    modo: 'demo',

    async getConfig(): Promise<ConfigPublica> {
      const b = ler()
      return {
        servicos: b.servicos.filter((s) => s.ativo).sort((x, y) => x.ordem - y.ordem),
        disponibilidade: b.disponibilidade,
        ajustes: b.ajustes,
      }
    },

    async getOcupados(de, ate) {
      const b = ler()
      const dentro = (x: { inicio: string; fim: string }) => x.fim > de && x.inicio < ate
      return {
        agendamentos: b.agendamentos
          .filter((a) => STATUS_ATIVOS.includes(a.status))
          .map((a) => ({ inicio: new Date(a.inicio).toISOString(), fim: a.fim }))
          .filter(dentro),
        bloqueios: b.bloqueios.map((x) => ({ inicio: new Date(x.inicio).toISOString(), fim: new Date(x.fim).toISOString() })).filter(dentro),
      }
    },

    async entrarCliente(whatsapp) {
      await espera()
      const b = ler()
      const w = normalizarWhats(whatsapp)
      return b.clientes.find((c) => c.whatsapp === w)?.token ?? null
    },

    async getPerfil(token) {
      const b = ler()
      const c = b.clientes.find((x) => x.token === token)
      if (!c) return null
      const { token: _t, ...cliente } = c
      return {
        cliente,
        enderecos: b.enderecos.filter((e) => e.cliente_id === c.id),
        aparelhos: b.aparelhos.filter((e) => e.cliente_id === c.id),
        agendamentos: b.agendamentos
          .filter((a) => a.cliente_id === c.id)
          .map((a) => detalhar(b, a))
          .sort((x, y) => (x.inicio < y.inicio ? 1 : -1)),
      }
    },

    async salvarDadosCliente(token, dados) {
      await espera()
      const b = ler()
      const whatsapp = normalizarWhats(dados.whatsapp)
      if (whatsapp.length < 12) throw new ErroApp('Informe um WhatsApp válido com DDD.')
      let c = token ? b.clientes.find((x) => x.token === token) : undefined
      c ??= b.clientes.find((x) => x.whatsapp === whatsapp)
      if (!c) {
        c = { id: id(), nome: dados.nome.trim(), whatsapp, criado_em: agoraIso(), token: id() }
        b.clientes.push(c)
      }
      c.nome = dados.nome.trim()
      c.whatsapp = whatsapp
      const cid = c.id
      const { id: eid, ...end } = dados.endereco
      let e = eid ? b.enderecos.find((x) => x.id === eid && x.cliente_id === cid) : undefined
      if (e) Object.assign(e, end)
      else {
        e = { id: id(), cliente_id: cid, ...end }
        b.enderecos.push(e)
      }
      const { id: aid, ...apa } = dados.aparelho
      let a = aid ? b.aparelhos.find((x) => x.id === aid && x.cliente_id === cid) : undefined
      if (a) Object.assign(a, apa)
      else {
        a = { id: id(), cliente_id: cid, ...apa }
        b.aparelhos.push(a)
      }
      gravar(b)
      return { token: c.token, endereco_id: e.id, aparelho_id: a.id }
    },

    async criarAgendamento(token, novo) {
      await espera()
      const b = ler()
      const c = clienteDoToken(b, token)
      if (!b.enderecos.some((e) => e.id === novo.endereco_id && e.cliente_id === c.id)) throw new ErroApp('Informe o endereço.')
      const qtd = novo.quantidade ?? 1
      if (qtd < 1 || qtd > MAX_APARELHOS) throw new ErroApp('Quantidade de aparelhos entre 1 e 6.')
      const s = b.servicos.find((x) => x.id === novo.servico_id)
      const btus = b.aparelhos.find((x) => x.id === novo.aparelho_id)?.btus ?? null
      const h = validarHorario(b, novo.servico_id, novo.inicio, undefined, s ? duracaoVisita(s, qtd, btus) : undefined)
      const a: Agendamento = {
        id: id(),
        cliente_id: c.id,
        servico_id: novo.servico_id,
        endereco_id: novo.endereco_id,
        aparelho_id: novo.aparelho_id,
        ...h,
        status: 'pendente',
        observacao_cliente: novo.observacao_cliente,
        quantidade: qtd,
        criado_em: agoraIso(),
      }
      b.agendamentos.push(a)
      // Se havia um retorno aguardando para este serviço, marca como agendado.
      for (const r of b.retornos)
        if (r.cliente_id === c.id && r.servico_id === novo.servico_id && (r.status === 'pendente' || r.status === 'avisado'))
          r.status = 'agendado'
      gravar(b)
      return a
    },

    async clienteResponderRemarcacao(token, agId, aceitar) {
      const b = ler()
      const a = agendamentoDoCliente(b, token, agId)
      if (a.status !== 'remarcado') throw new ErroApp('Este agendamento não tem sugestão de novo horário.')
      if (aceitar) a.status = 'confirmado'
      gravar(b)
    },

    async clienteRemarcar(token, agId, inicio) {
      const b = ler()
      const a = agendamentoDoCliente(b, token, agId)
      if (!STATUS_ATIVOS.includes(a.status)) throw new ErroApp('Este agendamento não pode mais ser alterado.')
      Object.assign(a, validarHorario(b, a.servico_id, inicio, a.id, minutosDe(a)), { status: 'pendente' })
      gravar(b)
    },

    async clienteCancelar(token, agId) {
      const b = ler()
      const a = agendamentoDoCliente(b, token, agId)
      if (!STATUS_ATIVOS.includes(a.status)) throw new ErroApp('Este agendamento não pode mais ser cancelado.')
      a.status = 'cancelado'
      gravar(b)
    },

    // Modo demonstração: sem servidor, não há push (o app mostra avisos só com ele aberto).
    async salvarPushCliente() {},
    async tecSalvarPush() {},

    async login(email, senha) {
      await espera()
      const c = credenciaisDemo()
      if (email.trim().toLowerCase() !== c.email || senha !== c.senha) throw new ErroApp('E-mail ou senha incorretos.')
      localStorage.setItem(CHAVE_SESSAO, '1')
    },
    async logout() {
      localStorage.removeItem(CHAVE_SESSAO)
    },
    async logado() {
      return localStorage.getItem(CHAVE_SESSAO) === '1'
    },
    async tecEmail() {
      return localStorage.getItem(CHAVE_SESSAO) === '1' ? credenciaisDemo().email : null
    },
    async tecTrocarSenha(atual, nova) {
      exigirTecnico()
      await espera()
      const c = credenciaisDemo()
      if (atual !== c.senha) throw new ErroApp('Senha atual incorreta.')
      if (nova === c.senha) throw new ErroApp('A nova senha deve ser diferente da atual.')
      localStorage.setItem(CHAVE_CREDENCIAIS, JSON.stringify({ ...c, senha: nova }))
    },
    async tecTrocarEmail(novo, senha) {
      exigirTecnico()
      await espera()
      const c = credenciaisDemo()
      if (senha !== c.senha) throw new ErroApp('Senha incorreta.')
      localStorage.setItem(CHAVE_CREDENCIAIS, JSON.stringify({ ...c, email: novo.trim().toLowerCase() }))
    },

    async tecAgendamentos(de, ate) {
      exigirTecnico()
      const b = ler()
      return b.agendamentos
        .filter((a) => new Date(a.inicio).toISOString() >= de && new Date(a.inicio).toISOString() < ate)
        .map((a) => detalhar(b, a))
        .sort((x, y) => new Date(x.inicio).getTime() - new Date(y.inicio).getTime())
    },

    async tecAgendamento(agId) {
      exigirTecnico()
      const b = ler()
      const a = b.agendamentos.find((x) => x.id === agId)
      return a ? detalhar(b, a) : null
    },

    async tecConfirmar(agId) {
      exigirTecnico()
      const b = ler()
      const a = b.agendamentos.find((x) => x.id === agId)
      if (!a || !STATUS_ATIVOS.includes(a.status)) throw new ErroApp('Agendamento não pode ser confirmado.')
      a.status = 'confirmado'
      gravar(b)
    },

    async tecCancelar(agId) {
      exigirTecnico()
      const b = ler()
      const a = b.agendamentos.find((x) => x.id === agId)
      if (!a || !STATUS_ATIVOS.includes(a.status)) throw new ErroApp('Agendamento não pode ser cancelado.')
      a.status = 'cancelado'
      gravar(b)
    },

    async tecRemarcar(agId, inicio) {
      exigirTecnico()
      const b = ler()
      const a = b.agendamentos.find((x) => x.id === agId)
      if (!a || !STATUS_ATIVOS.includes(a.status)) throw new ErroApp('Agendamento não pode ser remarcado.')
      Object.assign(a, validarHorario(b, a.servico_id, inicio, a.id, minutosDe(a)), { status: 'remarcado' })
      gravar(b)
    },

    async tecConcluir(agId, dados) {
      exigirTecnico()
      const b = ler()
      const a = b.agendamentos.find((x) => x.id === agId)
      if (!a || a.status === 'cancelado' || a.status === 'concluido') throw new ErroApp('Agendamento não pode ser concluído.')
      a.status = 'concluido'
      const concluido_em = agoraIso()
      b.atendimentos.push({ id: id(), agendamento_id: a.id, ...dados, concluido_em })
      for (const r of b.retornos)
        if (r.cliente_id === a.cliente_id && r.servico_id === a.servico_id && r.aparelho_id === a.aparelho_id && r.status !== 'dispensado')
          r.status = 'agendado'
      const s = b.servicos.find((x) => x.id === a.servico_id)
      if (s?.intervalo_retorno_meses)
        b.retornos.push({
          id: id(),
          cliente_id: a.cliente_id,
          aparelho_id: a.aparelho_id,
          servico_id: a.servico_id,
          data_prevista: somarMeses(chaveDia(concluido_em), s.intervalo_retorno_meses),
          status: 'pendente',
        })
      gravar(b)
    },

    async tecClientes() {
      exigirTecnico()
      const b = ler()
      return b.clientes
        .map((c): ClienteResumo & { ordem: string } => {
          const feitos = b.agendamentos
            .filter((a) => a.cliente_id === c.id && a.status === 'concluido')
            .sort((x, y) => (x.inicio < y.inicio ? 1 : -1))
          const ult = feitos[0]
          const ret = b.retornos
            .filter((r) => r.cliente_id === c.id && (r.status === 'pendente' || r.status === 'avisado'))
            .sort((x, y) => (x.data_prevista < y.data_prevista ? -1 : 1))[0]
          const { token: _t, ...cliente } = c
          const ultimoAg = b.agendamentos.filter((a) => a.cliente_id === c.id).sort((x, y) => (x.criado_em < y.criado_em ? 1 : -1))[0]
          return {
            cliente,
            ultimo_servico: ult ? { nome: b.servicos.find((s) => s.id === ult.servico_id)?.nome ?? '', data: chaveDia(ult.inicio) } : null,
            proximo_retorno: ret ?? null,
            bairro: b.enderecos.find((e) => e.cliente_id === c.id)?.bairro ?? null,
            ordem: ultimoAg?.inicio ?? c.criado_em,
          }
        })
        .sort((x, y) => (x.ordem < y.ordem ? 1 : -1))
        .map(({ ordem: _o, ...r }) => r)
    },

    async tecCliente(cid) {
      exigirTecnico()
      const b = ler()
      const c = b.clientes.find((x) => x.id === cid)
      if (!c) return null
      const perfil = await api.getPerfil(c.token)
      return perfil
        ? { ...perfil, retornos: b.retornos.filter((r) => r.cliente_id === cid).map((r) => detalharRetorno(b, r)) }
        : null
    },

    async tecRetornos() {
      exigirTecnico()
      const b = ler()
      return b.retornos
        .filter((r) => r.status === 'pendente' || r.status === 'avisado')
        .map((r) => detalharRetorno(b, r))
        .sort((x, y) => (x.data_prevista < y.data_prevista ? -1 : 1))
    },

    async tecAtualizarRetorno(rid, status) {
      exigirTecnico()
      const b = ler()
      const r = b.retornos.find((x) => x.id === rid)
      if (r) r.status = status
      gravar(b)
    },

    async tecServicos() {
      exigirTecnico()
      return ler().servicos.sort((x, y) => x.ordem - y.ordem)
    },

    async tecSalvarServico(s) {
      exigirTecnico()
      const b = ler()
      const i = b.servicos.findIndex((x) => x.id === s.id)
      if (i >= 0) b.servicos[i] = s
      else b.servicos.push(s)
      gravar(b)
    },

    async tecSalvarDisponibilidade(d) {
      exigirTecnico()
      const b = ler()
      b.disponibilidade = d
      gravar(b)
    },

    async tecSalvarAjustes(a) {
      exigirTecnico()
      const b = ler()
      b.ajustes = { ...a, whatsapp_tecnico: normalizarWhats(a.whatsapp_tecnico) }
      gravar(b)
    },

    async tecBloqueios() {
      exigirTecnico()
      return ler().bloqueios.sort((x, y) => (x.inicio < y.inicio ? -1 : 1))
    },

    async tecCriarBloqueio(x) {
      exigirTecnico()
      const b = ler()
      b.bloqueios.push({ id: id(), ...x })
      gravar(b)
    },

    async tecRemoverBloqueio(bid) {
      exigirTecnico()
      const b = ler()
      b.bloqueios = b.bloqueios.filter((x) => x.id !== bid)
      gravar(b)
    },

    async reiniciarDemo() {
      localStorage.removeItem(CHAVE_CREDENCIAIS)
      gravar(semente())
    },
  }
  return api
}
