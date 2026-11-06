// Regras de horários livres. Mesma lógica é aplicada no servidor (supabase/schema.sql).
import type { Ajustes, Disponibilidade, Ocupado } from '../data/types'
import { chaveDia, diaSemana, diferencaDias, hojeChave, isoLocal, paraMinutos } from './tempo'

export interface Horario {
  hora: string
  inicio: string // ISO
  fim: string // ISO
  disponivel: boolean
}

export interface EntradaHorarios {
  dia: string
  duracaoMin: number
  disponibilidade: Disponibilidade[]
  /** Agendamentos ativos (pendente/confirmado/remarcado) e bloqueios. */
  ocupados: Ocupado[]
  ajustes: Pick<Ajustes, 'intervalo_deslocamento_min' | 'antecedencia_minima_horas' | 'dias_a_frente' | 'passo_min'>
  agora?: Date
  /** Ignora este intervalo (útil ao remarcar o próprio agendamento). */
  ignorar?: Ocupado
}

const ms = (iso: string) => new Date(iso).getTime()
const MIN = 60_000

/** Os dois atendimentos conflitam se não houver o intervalo de deslocamento entre eles. */
export function conflita(
  a: { inicio: number; fim: number },
  b: { inicio: number; fim: number },
  deslocamentoMin: number,
): boolean {
  const d = deslocamentoMin * MIN
  return a.inicio < b.fim + d && b.inicio < a.fim + d
}

/** Um bloqueio (folga, feriado) não exige deslocamento. */
function sobrepoe(a: { inicio: number; fim: number }, b: { inicio: number; fim: number }) {
  return a.inicio < b.fim && b.inicio < a.fim
}

export function diaDentroDoLimite(dia: string, ajustes: EntradaHorarios['ajustes'], agora = new Date()): boolean {
  const diff = diferencaDias(hojeChave(agora), dia)
  return diff >= 0 && diff <= ajustes.dias_a_frente
}

export function diaAtende(dia: string, disponibilidade: Disponibilidade[]): boolean {
  const ds = diaSemana(dia)
  return disponibilidade.some((d) => d.dia_semana === ds)
}

export function gerarHorarios(e: EntradaHorarios & { bloqueios?: Ocupado[] }): Horario[] {
  const agora = e.agora ?? new Date()
  if (!diaDentroDoLimite(e.dia, e.ajustes, agora)) return []
  const ds = diaSemana(e.dia)
  const janelas = e.disponibilidade
    .filter((d) => d.dia_semana === ds)
    .sort((a, b) => paraMinutos(a.hora_inicio) - paraMinutos(b.hora_inicio))
  const passo = Math.max(15, e.ajustes.passo_min || 60)
  const limiteAntecedencia = agora.getTime() + e.ajustes.antecedencia_minima_horas * 60 * MIN
  const ocupados = e.ocupados
    .filter((o) => !(e.ignorar && o.inicio === e.ignorar.inicio && o.fim === e.ignorar.fim))
    .map((o) => ({ inicio: ms(o.inicio), fim: ms(o.fim) }))
  const bloqueios = (e.bloqueios ?? []).map((o) => ({ inicio: ms(o.inicio), fim: ms(o.fim) }))

  const lista: Horario[] = []
  for (const j of janelas) {
    const ini = paraMinutos(j.hora_inicio)
    const fimJanela = paraMinutos(j.hora_fim)
    for (let t = ini; t + e.duracaoMin <= fimJanela; t += passo) {
      const inicio = isoLocal(e.dia, t)
      const fim = new Date(ms(inicio) + e.duracaoMin * MIN).toISOString()
      const c = { inicio: ms(inicio), fim: ms(fim) }
      const disponivel =
        c.inicio >= limiteAntecedencia &&
        !ocupados.some((o) => conflita(c, o, e.ajustes.intervalo_deslocamento_min)) &&
        !bloqueios.some((b) => sobrepoe(c, b))
      lista.push({ hora: inicio.slice(11, 16), inicio, fim, disponivel })
    }
  }
  return lista
}

/** Valida um horário escolhido (usado pelo "servidor" do modo demonstração). */
export function horarioValido(e: Omit<EntradaHorarios, 'dia'> & { bloqueios?: Ocupado[]; inicio: string }): boolean {
  const alvo = new Date(e.inicio).getTime()
  return gerarHorarios({ ...e, dia: chaveDia(e.inicio) }).some(
    (h) => h.disponivel && new Date(h.inicio).getTime() === alvo,
  )
}
