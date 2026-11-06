import type { Ajustes, Disponibilidade, Servico } from './types'

// Valores iniciais. [PREÇOS], [HORÁRIO DE TRABALHO], [DURAÇÃO], [WHATSAPP] e
// [INTERVALO DE RETORNO] ainda precisam ser confirmados com o dono — todos são
// editáveis no painel do técnico (Serviços e Ajustes).
export const SERVICOS_PADRAO: Servico[] = [
  { id: 'instalacao', nome: 'Instalação', descricao: 'Split e janela', duracao_min: 180, intervalo_retorno_meses: null, preco_base: null, ordem: 1, ativo: true },
  { id: 'limpeza', nome: 'Limpeza', descricao: 'Higienização completa', duracao_min: 90, intervalo_retorno_meses: 6, preco_base: null, ordem: 2, ativo: true },
  { id: 'manutencao', nome: 'Manutenção', descricao: 'Diagnóstico e reparo', duracao_min: 120, intervalo_retorno_meses: 12, preco_base: null, ordem: 3, ativo: true },
  { id: 'carga-gas', nome: 'Carga de gás', descricao: 'Recarga e teste', duracao_min: 60, intervalo_retorno_meses: null, preco_base: null, ordem: 4, ativo: true },
  { id: 'orcamento', nome: 'Orçamento', descricao: 'Avaliação no local', duracao_min: 60, intervalo_retorno_meses: null, preco_base: null, ordem: 5, ativo: true },
]

export const DISPONIBILIDADE_PADRAO: Disponibilidade[] = [
  ...[1, 2, 3, 4, 5].flatMap((d) => [
    { dia_semana: d, hora_inicio: '08:00', hora_fim: '12:00' },
    { dia_semana: d, hora_inicio: '13:00', hora_fim: '18:00' },
  ]),
  { dia_semana: 6, hora_inicio: '08:00', hora_fim: '12:00' },
]

export const AJUSTES_PADRAO: Ajustes = {
  whatsapp_tecnico: '5571999999999',
  nome_tecnico: 'Vinícius',
  intervalo_deslocamento_min: 30,
  antecedencia_minima_horas: 12,
  dias_a_frente: 30,
  passo_min: 60,
}
