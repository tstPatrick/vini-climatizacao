import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from './Icone'
import { Carregando, Erro } from './ui'
import { useEstado } from '../estado'
import { diaAtende, diaDentroDoLimite, gerarHorarios, type Horario } from '../lib/horarios'
import { DIAS_CURTOS, MESES, chaveDia, diferencaDias, hojeChave, inicioSemana, somarDias } from '../lib/tempo'
import type { Ocupado } from '../data/types'

interface Props {
  duracaoMin: number
  valor?: string
  mudar: (inicio: string) => void
  /** Intervalo do próprio agendamento (ao remarcar), para não contar como ocupado. */
  ignorar?: Ocupado
}

export function SeletorHorario({ duracaoMin, valor, mudar, ignorar }: Props) {
  const { api, config } = useEstado()
  const hoje = hojeChave()
  const { disponibilidade, ajustes } = config

  const primeiroDiaUtil = useMemo(() => {
    for (let i = 0; i <= ajustes.dias_a_frente; i++) {
      const d = somarDias(hoje, i)
      const h = gerarHorarios({ dia: d, duracaoMin, disponibilidade, ocupados: [], ajustes })
      if (h.some((x) => x.disponivel)) return d
    }
    return hoje
  }, [hoje, duracaoMin, disponibilidade, ajustes])

  const [dia, setDia] = useState<string>(() => (valor ? chaveDia(valor) : primeiroDiaUtil))
  const [semana, setSemana] = useState<string>(() => inicioSemana(valor ? chaveDia(valor) : primeiroDiaUtil))
  const [ocupados, setOcupados] = useState<{ agendamentos: Ocupado[]; bloqueios: Ocupado[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let vivo = true
    setOcupados(null)
    setErro(null)
    const de = new Date(`${semana}T00:00:00-03:00`).toISOString()
    const ate = new Date(`${somarDias(semana, 7)}T00:00:00-03:00`).toISOString()
    api
      .getOcupados(de, ate)
      .then((o) => vivo && setOcupados(o))
      .catch((e) => vivo && setErro(navigator.onLine ? e.message : 'Sem internet para carregar os horários.'))
    return () => {
      vivo = false
    }
  }, [api, semana, versao])

  // Recarrega ao voltar para a aba (horários podem ter sido ocupados).
  useEffect(() => {
    const f = () => document.visibilityState === 'visible' && setVersao((v) => v + 1)
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const dias = Array.from({ length: 6 }, (_, i) => somarDias(semana, i)) // SEG a SÁB

  // Sem horário escolhido: pula para o primeiro dia com vaga (na semana ou na seguinte).
  const autoPulou = useRef(false)
  useEffect(() => {
    if (!ocupados || valor || autoPulou.current) return
    const livres = (d: string) =>
      gerarHorarios({ dia: d, duracaoMin, disponibilidade, ocupados: ocupados.agendamentos, bloqueios: ocupados.bloqueios, ajustes, ignorar }).some((h) => h.disponivel)
    if (livres(dia)) {
      autoPulou.current = true
      return
    }
    const proximo = Array.from({ length: 7 }, (_, i) => somarDias(semana, i)).find((d) => d > dia && livres(d))
    if (proximo) {
      autoPulou.current = true
      setDia(proximo)
    } else if (diferencaDias(hoje, somarDias(semana, 7)) <= ajustes.dias_a_frente && diferencaDias(hoje, semana) < 14) {
      const s = somarDias(semana, 7)
      setSemana(s)
      setDia(s)
    } else autoPulou.current = true
  }, [ocupados, valor, dia, semana, duracaoMin, disponibilidade, ajustes, ignorar, hoje])

  const horarios: Horario[] = ocupados
    ? gerarHorarios({ dia, duracaoMin, disponibilidade, ocupados: ocupados.agendamentos, bloqueios: ocupados.bloqueios, ajustes, ignorar })
    : []
  const podeVoltar = semana > inicioSemana(hoje)
  const podeAvancar = diferencaDias(hoje, somarDias(semana, 7)) <= ajustes.dias_a_frente
  const [, m] = semana.split('-').map(Number)
  const valorMs = valor ? new Date(valor).getTime() : null

  function trocarSemana(n: number) {
    const s = somarDias(semana, 7 * n)
    setSemana(s)
    const novo = Array.from({ length: 6 }, (_, i) => somarDias(s, i)).find(
      (d) => diaAtende(d, disponibilidade) && diaDentroDoLimite(d, ajustes),
    )
    if (novo) setDia(novo)
  }

  return (
    <div className="coluna" style={{ gap: 16 }}>
      <div className="linha entre">
        <button className="btn-icone" aria-label="Semana anterior" disabled={!podeVoltar} onClick={() => trocarSemana(-1)} style={{ opacity: podeVoltar ? 1 : 0.4 }}>
          <Icone nome="esquerda" />
        </button>
        <span className="forte" aria-live="polite">
          {MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} · semana de {Number(semana.slice(8))}
        </span>
        <button className="btn-icone" aria-label="Próxima semana" disabled={!podeAvancar} onClick={() => trocarSemana(1)} style={{ opacity: podeAvancar ? 1 : 0.4 }}>
          <Icone nome="direita" />
        </button>
      </div>

      <div className="dias" role="group" aria-label="Dia">
        {dias.map((d) => {
          const ativo = diaAtende(d, disponibilidade) && diaDentroDoLimite(d, ajustes)
          const ds = new Date(`${d}T12:00:00Z`).getUTCDay()
          return (
            <button key={d} className="dia" aria-pressed={d === dia} disabled={!ativo} onClick={() => setDia(d)} aria-label={`${DIAS_CURTOS[ds]} ${Number(d.slice(8))}`}>
              <small>{DIAS_CURTOS[ds]}</small>
              <strong>{Number(d.slice(8))}</strong>
            </button>
          )
        })}
      </div>

      <Erro>{erro}</Erro>
      {!ocupados && !erro ? (
        <Carregando />
      ) : horarios.length === 0 ? (
        <p className="mutado centro">Sem atendimento neste dia. Escolha outro.</p>
      ) : (
        <>
          <div className="horarios" role="group" aria-label="Horário">
            {horarios.map((h) => (
              <button
                key={h.inicio}
                className="horario"
                disabled={!h.disponivel}
                aria-pressed={valorMs === new Date(h.inicio).getTime()}
                aria-label={h.disponivel ? h.hora : `${h.hora}, indisponível`}
                onClick={() => mudar(h.inicio)}
              >
                {h.hora}
              </button>
            ))}
          </div>
          {!horarios.some((h) => h.disponivel) && <p className="mutado centro">Todos os horários deste dia estão ocupados.</p>}
        </>
      )}
    </div>
  )
}
