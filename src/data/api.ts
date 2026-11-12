import type {
  Agendamento,
  AgendamentoDetalhado,
  Ajustes,
  Bloqueio,
  ClienteResumo,
  DadosCliente,
  DadosConclusao,
  DadosPedidoOrcamento,
  PedidoDetalhado,
  Disponibilidade,
  NovoAgendamento,
  Ocupado,
  PerfilCliente,
  RetornoDetalhado,
  Servico,
  StatusRetorno,
} from './types'

export interface ConfigPublica {
  servicos: Servico[]
  disponibilidade: Disponibilidade[]
  ajustes: Ajustes
}

export interface Api {
  modo: 'demo' | 'supabase'

  // Público
  getConfig(): Promise<ConfigPublica>
  /** Agendamentos ativos e bloqueios entre duas datas (sem dados pessoais). */
  getOcupados(de: string, ate: string): Promise<{ agendamentos: Ocupado[]; bloqueios: Ocupado[] }>

  // Cliente (identificado por um token guardado no aparelho)
  entrarCliente(whatsapp: string): Promise<string | null>
  getPerfil(token: string): Promise<PerfilCliente | null>
  salvarDadosCliente(token: string | null, dados: DadosCliente): Promise<{ token: string; endereco_id: string; aparelho_id: string }>
  criarAgendamento(token: string, novo: NovoAgendamento): Promise<Agendamento>
  clienteResponderRemarcacao(token: string, id: string, aceitar: boolean): Promise<void>
  clienteRemarcar(token: string, id: string, inicio: string): Promise<void>
  clienteCancelar(token: string, id: string): Promise<void>
  pedirOrcamento(token: string | null, dados: DadosPedidoOrcamento): Promise<{ token: string; pedido_id: string }>
  /** Registra este aparelho para receber notificações (null no modo demonstração). */
  salvarPushCliente(token: string, inscricao: PushSubscriptionJSON): Promise<void>

  // Técnico
  login(email: string, senha: string): Promise<void>
  logout(): Promise<void>
  logado(): Promise<boolean>
  /** E-mail de acesso do técnico logado. */
  tecEmail(): Promise<string | null>
  tecTrocarSenha(atual: string, nova: string): Promise<void>
  tecTrocarEmail(novo: string, senha: string): Promise<void>
  tecAgendamentos(de: string, ate: string): Promise<AgendamentoDetalhado[]>
  tecAgendamento(id: string): Promise<AgendamentoDetalhado | null>
  tecConfirmar(id: string): Promise<void>
  tecCancelar(id: string): Promise<void>
  tecRemarcar(id: string, inicio: string): Promise<void>
  tecConcluir(id: string, dados: DadosConclusao): Promise<void>
  tecClientes(): Promise<ClienteResumo[]>
  tecCliente(id: string): Promise<(PerfilCliente & { retornos: RetornoDetalhado[] }) | null>
  tecRetornos(): Promise<RetornoDetalhado[]>
  tecPedidos(): Promise<PedidoDetalhado[]>
  tecPedidoStatus(id: string, status: 'contatado' | 'dispensado'): Promise<void>
  tecAgendarPedido(id: string, inicio: string): Promise<string>
  tecSalvarPush(inscricao: PushSubscriptionJSON): Promise<void>
  tecAtualizarRetorno(id: string, status: StatusRetorno): Promise<void>
  tecServicos(): Promise<Servico[]>
  tecSalvarServico(s: Servico): Promise<void>
  tecSalvarDisponibilidade(d: Disponibilidade[]): Promise<void>
  tecSalvarAjustes(a: Ajustes): Promise<void>
  tecBloqueios(): Promise<Bloqueio[]>
  tecCriarBloqueio(b: Omit<Bloqueio, 'id'>): Promise<void>
  tecRemoverBloqueio(id: string): Promise<void>
  /** Só no modo demonstração. */
  reiniciarDemo?(): Promise<void>
}

export class ErroApp extends Error {}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let instancia: Promise<Api> | null = null

export function getApi(): Promise<Api> {
  if (!instancia) {
    instancia =
      url && chave
        ? import('./supabaseApi').then((m) => m.criarSupabaseApi(url, chave))
        : import('./localApi').then((m) => m.criarLocalApi())
  }
  return instancia
}

export const MODO_DEMO = !(url && chave)
