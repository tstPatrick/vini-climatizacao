export type StatusAgendamento = 'pendente' | 'confirmado' | 'concluido' | 'cancelado' | 'remarcado'
export type StatusRetorno = 'pendente' | 'avisado' | 'agendado' | 'dispensado'

export interface Servico {
  id: string
  nome: string
  descricao: string
  duracao_min: number
  intervalo_retorno_meses: number | null
  preco_base: number | null
  ordem: number
  ativo: boolean
}

export interface Cliente {
  id: string
  nome: string
  whatsapp: string
  criado_em: string
}

export interface Endereco {
  id: string
  cliente_id: string
  rua: string
  numero: string
  bairro: string
  complemento: string
  observacoes: string
}

export interface Aparelho {
  id: string
  cliente_id: string
  tipo: string
  marca: string
  btus: number | null
  foto_url: string | null
}

export interface Agendamento {
  id: string
  cliente_id: string
  servico_id: string
  endereco_id: string
  aparelho_id: string | null
  inicio: string
  fim: string
  status: StatusAgendamento
  observacao_cliente: string
  criado_em: string
}

export interface Atendimento {
  id: string
  agendamento_id: string
  descricao: string
  pecas: string
  valor: number | null
  fotos: string[]
  concluido_em: string
}

export interface Retorno {
  id: string
  cliente_id: string
  aparelho_id: string | null
  servico_id: string
  data_prevista: string // YYYY-MM-DD
  status: StatusRetorno
}

export interface Disponibilidade {
  dia_semana: number // 0 = domingo … 6 = sábado
  hora_inicio: string // "08:00"
  hora_fim: string // "12:00"
}

export interface Bloqueio {
  id: string
  inicio: string
  fim: string
  motivo: string
}

export interface Ajustes {
  whatsapp_tecnico: string
  nome_tecnico: string
  intervalo_deslocamento_min: number
  antecedencia_minima_horas: number
  dias_a_frente: number
  passo_min: number
  /** Chave pública das notificações push (vem do servidor). */
  vapid_publica?: string
}

/** Intervalo ocupado (agendamento ativo já com o deslocamento somado, ou bloqueio). */
export interface Ocupado {
  inicio: string
  fim: string
}

/** Agendamento com os dados relacionados, para exibir nas telas. */
export interface AgendamentoDetalhado extends Agendamento {
  servico: Servico
  cliente: Cliente
  endereco: Endereco
  aparelho: Aparelho | null
  atendimento: Atendimento | null
}

export interface PerfilCliente {
  cliente: Cliente
  enderecos: Endereco[]
  aparelhos: Aparelho[]
  agendamentos: AgendamentoDetalhado[]
}

export interface ClienteResumo {
  cliente: Cliente
  ultimo_servico: { nome: string; data: string } | null
  proximo_retorno: Retorno | null
  bairro: string | null
}

export interface RetornoDetalhado extends Retorno {
  cliente: Cliente
  servico: Servico
  aparelho: Aparelho | null
}

export interface DadosCliente {
  nome: string
  whatsapp: string
  endereco: Omit<Endereco, 'id' | 'cliente_id'> & { id?: string }
  aparelho: Omit<Aparelho, 'id' | 'cliente_id'> & { id?: string }
}

export interface NovoAgendamento {
  servico_id: string
  endereco_id: string
  aparelho_id: string | null
  inicio: string
  observacao_cliente: string
}

export interface DadosConclusao {
  descricao: string
  pecas: string
  valor: number | null
  fotos: string[]
}

export const STATUS_ATIVOS: StatusAgendamento[] = ['pendente', 'confirmado', 'remarcado']
