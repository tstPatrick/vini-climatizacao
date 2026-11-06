// Datas e horas no fuso America/Bahia (UTC-3, sem horário de verão).
// Trabalhamos com "chave de dia" (YYYY-MM-DD) e minutos do dia no fuso local.

export const OFFSET_MIN = -180
const OFFSET_MS = OFFSET_MIN * 60_000

const pad = (n: number) => String(n).padStart(2, '0')

export const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
export const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Date "deslocada": os getters UTC retornam a hora de Salvador. */
function local(d: Date | string | number): Date {
  return new Date(new Date(d).getTime() + OFFSET_MS)
}

export function chaveDia(d: Date | string | number): string {
  const l = local(d)
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`
}

export function hojeChave(agora: Date = new Date()): string {
  return chaveDia(agora)
}

export function minutosDoDia(d: Date | string | number): number {
  const l = local(d)
  return l.getUTCHours() * 60 + l.getUTCMinutes()
}

export function hhmm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export function paraMinutos(h: string): number {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + (b || 0)
}

/** ISO com o fuso de Salvador, ex.: 2026-11-10T08:00:00-03:00 */
export function isoLocal(dia: string, minutos: number): string {
  return `${dia}T${hhmm(minutos)}:00-03:00`
}

export function horaDe(iso: string): string {
  return hhmm(minutosDoDia(iso))
}

/** Dia da semana (0 = domingo) de uma chave YYYY-MM-DD. */
export function diaSemana(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay()
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function somarMeses(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1, 12))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0, 12)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}

export function diferencaDias(de: string, ate: string): number {
  return Math.round((new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000)
}

/** Segunda-feira da semana do dia informado. */
export function inicioSemana(dia: string): string {
  const ds = diaSemana(dia)
  return somarDias(dia, ds === 0 ? -6 : 1 - ds)
}

export function dataCurta(dia: string): string {
  const [, m, d] = dia.split('-').map(Number)
  return `${d} ${MESES_CURTOS[m - 1]}`
}

export function dataLonga(dia: string): string {
  const [, m, d] = dia.split('-').map(Number)
  return `${DIAS_LONGOS[diaSemana(dia)]}, ${d} de ${MESES[m - 1]}`
}

export function dataHoraLonga(iso: string): string {
  return `${dataLonga(chaveDia(iso))} · ${horaDe(iso)}`
}

export function relativoDia(dia: string, hoje = hojeChave()): string {
  const diff = diferencaDias(hoje, dia)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  return dataCurta(dia)
}
