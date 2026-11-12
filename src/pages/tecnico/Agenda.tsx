import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { Carregando, ChipStatus, Erro, Modal, Vazio } from '../../components/ui'
import { useEstado } from '../../estado'
import type { AgendamentoDetalhado } from '../../data/types'
import { chaveDia, dataLonga, DIAS_LONGOS, diaSemana, hojeChave, horaDe, inicioSemana, relativoDia, somarDias } from '../../lib/tempo'
import { linkWhats, mensagens } from '../../lib/whatsapp'
import { useAcoesAgendamento } from './comum'
import { AtivarAvisos } from '../../components/Avisos'
import { PedidosOrcamento } from './Pedidos'

const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`).toISOString()

export function AgendaTecnico() {
  const { api } = useEstado()
  const hoje = hojeChave()
  const [modo, setModo] = useState<'dia' | 'semana'>(() => (window.innerWidth >= 900 ? 'semana' : 'dia'))
  const [dia, setDia] = useState(hoje)
  const [lista, setLista] = useState<AgendamentoDetalhado[] | null>(null)
  const [amanha, setAmanha] = useState<AgendamentoDetalhado[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [lembretes, setLembretes] = useState(false)
  const [enviados, setEnviados] = useState<string[]>([])

  const de = modo === 'dia' ? dia : inicioSemana(dia)
  const ate = somarDias(de, modo === 'dia' ? 1 : 7)

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const [l, am] = await Promise.all([
        api.tecAgendamentos(inicioDoDia(de), inicioDoDia(ate)),
        api.tecAgendamentos(inicioDoDia(somarDias(hoje, 1)), inicioDoDia(somarDias(hoje, 2))),
      ])
      setLista(l)
      setAmanha(am.filter((a) => a.status === 'confirmado'))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api, de, ate, hoje])

  useEffect(() => {
    setLista(null)
    carregar()
  }, [carregar])

  const acoes = useAcoesAgendamento(carregar)
  const visiveis = (lista ?? []).filter((a) => a.status !== 'cancelado')
  const pendentes = visiveis.filter((a) => a.status === 'pendente').length

  return (
    <main className="tela larga">
      <header className="linha entre">
        <div className="coluna p">
          <span className="mutado">{modo === 'dia' ? dataLonga(dia) : `Semana de ${relativoDia(de).toLowerCase()}`}</span>
          <h1 className="titulo">{modo === 'dia' ? (dia === hoje ? 'Agenda de hoje' : relativoDia(dia)) : 'Agenda da semana'}</h1>
        </div>
        <div className="alternar" role="group" aria-label="Visualização">
          <button aria-pressed={modo === 'dia'} onClick={() => setModo('dia')}>
            Dia
          </button>
          <button aria-pressed={modo === 'semana'} onClick={() => setModo('semana')}>
            Semana
          </button>
        </div>
      </header>

      <div className="linha entre">
        <button className="btn-icone" aria-label={modo === 'dia' ? 'Dia anterior' : 'Semana anterior'} onClick={() => setDia(somarDias(dia, modo === 'dia' ? -1 : -7))}>
          <Icone nome="esquerda" />
        </button>
        <button className="btn btn-claro btn-p" onClick={() => setDia(hoje)} disabled={dia === hoje}>
          Hoje
        </button>
        <button className="btn-icone" aria-label={modo === 'dia' ? 'Próximo dia' : 'Próxima semana'} onClick={() => setDia(somarDias(dia, modo === 'dia' ? 1 : 7))}>
          <Icone nome="direita" />
        </button>
      </div>

      {lista && (
        <div className="linha" style={{ flexWrap: 'wrap' }}>
          <span className="chip">{visiveis.length} atendimento{visiveis.length === 1 ? '' : 's'}</span>
          {pendentes > 0 && <span className="chip atencao">{pendentes} pendente{pendentes === 1 ? '' : 's'}</span>}
        </div>
      )}

      <AtivarAvisos tipo="tecnico" />

      <PedidosOrcamento aposAgendar={carregar} />

      {amanha.length > 0 && (
        <button className="cartao clicavel linha" onClick={() => setLembretes(true)}>
          <span className="icone-bola">
            <Icone nome="sino" />
          </span>
          <span className="cresce coluna p">
            <strong>Lembretes de amanhã</strong>
            <span className="mutado">
              {amanha.length} cliente{amanha.length === 1 ? '' : 's'} para lembrar
            </span>
          </span>
          <Icone nome="direita" />
        </button>
      )}

      <Erro>{erro || acoes.erro}</Erro>
      {!lista ? (
        <Carregando />
      ) : modo === 'dia' ? (
        <LinhaDoTempo lista={visiveis} acoes={acoes} />
      ) : (
        <div className="semana">
          {Array.from({ length: 7 }, (_, i) => somarDias(de, i)).map((d) => {
            const doDia = visiveis.filter((a) => chaveDia(a.inicio) === d)
            if (diaSemana(d) === 0 && doDia.length === 0) return null
            return (
              <section key={d} className="coluna">
                <h2 className="secao" style={{ color: d === hoje ? 'var(--acao)' : undefined }}>
                  {DIAS_LONGOS[diaSemana(d)]} · {relativoDia(d)}
                </h2>
                {doDia.length ? <LinhaDoTempo lista={doDia} acoes={acoes} /> : <p className="mutado peq">Livre</p>}
              </section>
            )
          })}
        </div>
      )}

      {acoes.elementos}

      <Modal titulo="Lembretes de amanhã" aberto={lembretes} fechar={() => setLembretes(false)}>
        {amanha.map((a) => (
          <div key={a.id} className="cartao p linha">
            <div className="cresce coluna p">
              <strong>{a.cliente.nome}</strong>
              <span className="mutado">
                {horaDe(a.inicio)} · {a.servico.nome}
              </span>
            </div>
            <a
              className={`btn btn-p ${enviados.includes(a.id) ? 'btn-claro' : 'btn-primario'}`}
              href={linkWhats(a.cliente.whatsapp, mensagens.lembrete(a))}
              target="_blank"
              rel="noreferrer"
              onClick={() => setEnviados((e) => [...e, a.id])}
            >
              {enviados.includes(a.id) ? <><Icone nome="check" tamanho={18} /> Enviado</> : <><Icone nome="enviar" tamanho={18} /> Lembrar</>}
            </a>
          </div>
        ))}
      </Modal>
    </main>
  )
}

function LinhaDoTempo({ lista, acoes }: { lista: AgendamentoDetalhado[]; acoes: ReturnType<typeof useAcoesAgendamento> }) {
  if (!lista.length) return <Vazio icone="agenda">Nenhum atendimento neste dia.</Vazio>
  return (
    <ol className="timeline" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {lista.map((a) => (
        <li key={a.id} className={`evento ${a.status}`}>
          <span className="hora">{horaDe(a.inicio)}</span>
          <div className="cartao p coluna">
            <Link to={`/tecnico/agendamento/${a.id}`} className="coluna p" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="linha entre" style={{ alignItems: 'flex-start' }}>
                <strong>
                  {a.servico.nome}
                  {(a.quantidade ?? 1) > 1 ? ` · ${a.quantidade} aparelhos` : ''}
                </strong>
                <ChipStatus status={a.status} />
              </div>
              <span>{a.cliente.nome}</span>
              <span className="mutado linha" style={{ gap: 4 }}>
                <Icone nome="local" tamanho={16} /> {a.endereco.bairro} · até {horaDe(a.fim)}
              </span>
            </Link>
            {a.status === 'pendente' && (
              <div className="grade-2">
                <button className="btn btn-ok btn-p" style={{ width: '100%' }} disabled={acoes.ocupado} onClick={() => acoes.confirmar(a)}>
                  <Icone nome="check" tamanho={18} /> Confirmar
                </button>
                <button className="btn btn-secundario btn-p" style={{ width: '100%' }} onClick={() => acoes.remarcar(a)}>
                  <Icone nome="relogio" tamanho={18} /> Remarcar
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
