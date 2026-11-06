// Mensagens prontas enviadas por links wa.me (versão 1: o técnico dispara com um toque).
import type { AgendamentoDetalhado, RetornoDetalhado } from '../data/types'
import { chaveDia, dataLonga, horaDe } from './tempo'
import { primeiroNome } from './formato'
import { normalizarWhats } from './formato'

export function linkWhats(numero: string, texto: string): string {
  return `https://wa.me/${normalizarWhats(numero)}?text=${encodeURIComponent(texto)}`
}

const quando = (a: AgendamentoDetalhado) => `${dataLonga(chaveDia(a.inicio)).toLowerCase()}, às ${horaDe(a.inicio)}`
const assinatura = '\n\n— Vini Climatização'

export const mensagens = {
  confirmacao: (a: AgendamentoDetalhado) =>
    `Olá, ${primeiroNome(a.cliente.nome)}! Seu agendamento de *${a.servico.nome}* está *confirmado* para ${quando(a)}.\nEndereço: ${a.endereco.rua}, ${a.endereco.numero} - ${a.endereco.bairro}.${assinatura}`,
  lembrete: (a: AgendamentoDetalhado) =>
    `Olá, ${primeiroNome(a.cliente.nome)}! Passando para lembrar do seu serviço de *${a.servico.nome}* amanhã (${quando(a)}). Qualquer imprevisto, é só avisar por aqui.${assinatura}`,
  remarcacao: (a: AgendamentoDetalhado, link: string) =>
    `Olá, ${primeiroNome(a.cliente.nome)}! Não vou conseguir atender no horário escolhido. Sugiro *${quando(a)}* para a ${a.servico.nome.toLowerCase()}. Pode aceitar ou escolher outro horário no app: ${link}${assinatura}`,
  cancelamento: (a: AgendamentoDetalhado, link: string) =>
    `Olá, ${primeiroNome(a.cliente.nome)}. Infelizmente precisei cancelar o serviço de ${a.servico.nome.toLowerCase()} de ${quando(a)}. Desculpe o transtorno! Você pode escolher outro horário aqui: ${link}${assinatura}`,
  retorno: (r: RetornoDetalhado, link: string) =>
    `Olá, ${primeiroNome(r.cliente.nome)}! Já está na hora de fazer a *${r.servico.nome.toLowerCase()}* do seu ar condicionado${r.aparelho ? ` (${r.aparelho.marca})` : ''}. Manter em dia economiza energia e evita defeitos. Agende em poucos toques: ${link}${assinatura}`,
  concluido: (a: AgendamentoDetalhado) =>
    `Olá, ${primeiroNome(a.cliente.nome)}! Serviço de ${a.servico.nome.toLowerCase()} concluído. Obrigado pela confiança! Quando chegar a hora da próxima manutenção eu te aviso.${assinatura}`,
}

/** Link para abrir o app do cliente (HashRouter). */
export function linkApp(caminho = '/'): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#${caminho}`
}
