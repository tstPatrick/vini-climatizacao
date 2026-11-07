import { describe, expect, it } from 'vitest'
import { conflita, gerarHorarios, horarioValido } from './horarios'
import { somarMeses, inicioSemana, chaveDia, isoLocal } from './tempo'
import type { Disponibilidade } from '../data/types'

const disp: Disponibilidade[] = [
  { dia_semana: 2, hora_inicio: '08:00', hora_fim: '12:00' }, // terça
  { dia_semana: 2, hora_inicio: '13:00', hora_fim: '18:00' },
]
const ajustes = { intervalo_deslocamento_min: 30, antecedencia_minima_horas: 2, dias_a_frente: 30, passo_min: 60 }
// Segunda, 9 nov 2026, 10:00 em Salvador
const agora = new Date('2026-11-09T10:00:00-03:00')
const DIA = '2026-11-10' // terça

const livres = (h: ReturnType<typeof gerarHorarios>) => h.filter((x) => x.disponivel).map((x) => x.hora)

describe('gerarHorarios', () => {
  it('gera horários dentro das janelas, respeitando a duração', () => {
    const h = gerarHorarios({ dia: DIA, duracaoMin: 90, disponibilidade: disp, ocupados: [], ajustes, agora })
    // 08,09,10 (10:00+1:30=11:30 ok) | 11:00 não cabe | 13..16 (16:00+1:30=17:30)
    expect(h.map((x) => x.hora)).toEqual(['08:00', '09:00', '10:00', '13:00', '14:00', '15:00', '16:00'])
    expect(h.every((x) => x.disponivel)).toBe(true)
  })

  it('usa o fuso de Salvador (UTC-3)', () => {
    const h = gerarHorarios({ dia: DIA, duracaoMin: 60, disponibilidade: disp, ocupados: [], ajustes, agora })
    expect(h[0].inicio).toBe('2026-11-10T08:00:00-03:00')
    expect(new Date(h[0].inicio).toISOString()).toBe('2026-11-10T11:00:00.000Z')
  })

  it('não oferece dias sem expediente', () => {
    expect(gerarHorarios({ dia: '2026-11-08', duracaoMin: 60, disponibilidade: disp, ocupados: [], ajustes, agora })).toEqual([])
  })

  it('bloqueia horários que conflitam com agendamentos + deslocamento', () => {
    const ocupados = [{ inicio: '2026-11-10T09:00:00-03:00', fim: '2026-11-10T10:00:00-03:00' }]
    const h = gerarHorarios({ dia: DIA, duracaoMin: 60, disponibilidade: disp, ocupados, ajustes, agora })
    // 08:00-09:00 não deixa 30 min de deslocamento; 10:00 também não (termina 10:00 + 30)
    expect(livres(h)).toEqual(['11:00', '13:00', '14:00', '15:00', '16:00', '17:00'])
    const riscados = h.filter((x) => !x.disponivel).map((x) => x.hora)
    expect(riscados).toEqual(['08:00', '09:00', '10:00'])
  })

  it('com deslocamento zero, horários colados são permitidos', () => {
    const ocupados = [{ inicio: '2026-11-10T09:00:00-03:00', fim: '2026-11-10T10:00:00-03:00' }]
    const h = gerarHorarios({ dia: DIA, duracaoMin: 60, disponibilidade: disp, ocupados, ajustes: { ...ajustes, intervalo_deslocamento_min: 0 }, agora })
    expect(livres(h)).toContain('08:00')
    expect(livres(h)).toContain('10:00')
    expect(livres(h)).not.toContain('09:00')
  })

  it('respeita bloqueios de datas', () => {
    const bloqueios = [{ inicio: '2026-11-10T13:00:00-03:00', fim: '2026-11-10T18:00:00-03:00' }]
    const h = gerarHorarios({ dia: DIA, duracaoMin: 60, disponibilidade: disp, ocupados: [], bloqueios, ajustes, agora })
    expect(livres(h)).toEqual(['08:00', '09:00', '10:00', '11:00'])
  })

  it('respeita a antecedência mínima', () => {
    const cedo = new Date('2026-11-10T07:30:00-03:00')
    const h = gerarHorarios({ dia: DIA, duracaoMin: 60, disponibilidade: disp, ocupados: [], ajustes, agora: cedo })
    expect(livres(h)[0]).toBe('10:00') // 07:30 + 2h = 09:30
  })

  it('respeita o limite de dias à frente', () => {
    const longe = '2026-12-15' // terça, 36 dias depois
    expect(gerarHorarios({ dia: longe, duracaoMin: 60, disponibilidade: disp, ocupados: [], ajustes, agora })).toEqual([])
  })

  it('não aceita dias no passado', () => {
    expect(gerarHorarios({ dia: '2026-11-03', duracaoMin: 60, disponibilidade: disp, ocupados: [], ajustes, agora })).toEqual([])
  })

  it('ignora o próprio agendamento ao remarcar', () => {
    const proprio = { inicio: '2026-11-10T09:00:00-03:00', fim: '2026-11-10T10:00:00-03:00' }
    const h = gerarHorarios({ dia: DIA, duracaoMin: 60, disponibilidade: disp, ocupados: [proprio], ignorar: proprio, ajustes, agora })
    expect(livres(h)).toContain('09:00')
  })
})

describe('horarioValido', () => {
  const base = { duracaoMin: 60, disponibilidade: disp, ajustes, agora }
  it('aceita um horário livre', () => {
    expect(horarioValido({ ...base, ocupados: [], inicio: '2026-11-10T08:00:00-03:00' })).toBe(true)
  })
  it('aceita o mesmo instante em UTC', () => {
    expect(horarioValido({ ...base, ocupados: [], inicio: '2026-11-10T11:00:00.000Z' })).toBe(true)
  })
  it('recusa conflito (dois clientes no mesmo horário)', () => {
    const ocupados = [{ inicio: '2026-11-10T08:00:00-03:00', fim: '2026-11-10T09:00:00-03:00' }]
    expect(horarioValido({ ...base, ocupados, inicio: '2026-11-10T08:00:00-03:00' })).toBe(false)
  })
  it('recusa horários fora da grade', () => {
    expect(horarioValido({ ...base, ocupados: [], inicio: '2026-11-10T08:17:00-03:00' })).toBe(false)
    expect(horarioValido({ ...base, ocupados: [], inicio: '2026-11-10T12:00:00-03:00' })).toBe(false)
  })
})

describe('conflita', () => {
  it('é simétrico', () => {
    const a = { inicio: 0, fim: 60 * 60_000 }
    const b = { inicio: 75 * 60_000, fim: 120 * 60_000 }
    expect(conflita(a, b, 30)).toBe(true)
    expect(conflita(b, a, 30)).toBe(true)
    expect(conflita(a, b, 15)).toBe(false)
  })
})

describe('tempo', () => {
  it('soma meses sem estourar o fim do mês', () => {
    expect(somarMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(somarMeses('2026-05-10', 6)).toBe('2026-11-10')
  })
  it('acha a segunda-feira da semana', () => {
    expect(inicioSemana('2026-11-08')).toBe('2026-11-02') // domingo → segunda anterior
    expect(inicioSemana('2026-11-11')).toBe('2026-11-09')
  })
  it('converte instantes para o dia de Salvador', () => {
    expect(chaveDia('2026-11-10T02:00:00Z')).toBe('2026-11-09')
    expect(isoLocal('2026-11-10', 13 * 60 + 30)).toBe('2026-11-10T13:30:00-03:00')
  })
})

import { duracaoVisita, textoDuracao } from './horarios'

describe('duracaoVisita', () => {
  const limpeza = { duracao_min: 60, duracao_adicional_min: 40, extra_grande_min: 20 }
  it('um aparelho pequeno = duração do serviço', () => {
    expect(duracaoVisita(limpeza, 1, 12000)).toBe(60)
    expect(duracaoVisita(limpeza)).toBe(60)
  })
  it('cada aparelho a mais soma a duração adicional', () => {
    expect(duracaoVisita(limpeza, 3, 9000)).toBe(60 + 40 + 40)
  })
  it('aparelho grande soma o extra em cada unidade', () => {
    expect(duracaoVisita(limpeza, 1, 18000)).toBe(80)
    expect(duracaoVisita(limpeza, 2, 24000)).toBe(80 + 60)
  })
  it('limita a quantidade entre 1 e 6', () => {
    expect(duracaoVisita(limpeza, 0)).toBe(60)
    expect(duracaoVisita(limpeza, 50)).toBe(60 + 5 * 40)
  })
  it('sem duração adicional cadastrada, usa a duração do serviço', () => {
    expect(duracaoVisita({ duracao_min: 90 }, 2)).toBe(180)
  })
  it('formata a duração', () => {
    expect(textoDuracao(60)).toBe('1h')
    expect(textoDuracao(90)).toBe('1h30')
    expect(textoDuracao(45)).toBe('45 min')
  })
})
