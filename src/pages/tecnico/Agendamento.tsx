import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icone, iconeServico } from '../../components/Icone'
import { Cabecalho, CampoFoto, Carregando, ChipStatus, Erro, Modal, useAcao } from '../../components/ui'
import { useEstado } from '../../estado'
import { STATUS_ATIVOS, type AgendamentoDetalhado } from '../../data/types'
import { aparelhoTexto, enderecoTexto, formatarWhats, linkMapa, moeda, soDigitos } from '../../lib/formato'
import { chaveDia, dataHoraLonga, dataLonga, horaDe, somarMeses, hojeChave } from '../../lib/tempo'
import { linkApp, linkWhats, mensagens } from '../../lib/whatsapp'
import { avisarMudanca, useAcoesAgendamento } from './comum'

function useAgendamento(id: string | undefined) {
  const { api } = useEstado()
  const [a, setA] = useState<AgendamentoDetalhado | null | undefined>(undefined)
  const carregar = useCallback(async () => {
    if (id) setA(await api.tecAgendamento(id))
  }, [api, id])
  useEffect(() => {
    carregar().catch(() => setA(null))
  }, [carregar])
  return { a, carregar }
}

export function DetalheAgendamentoTec() {
  const { id } = useParams()
  const { api, toast } = useEstado()
  const { a, carregar } = useAgendamento(id)
  const acoes = useAcoesAgendamento(carregar)
  const [cancelar, setCancelar] = useState(false)
  const { ocupado, erro, rodar } = useAcao()

  if (a === undefined) return <Carregando />
  if (a === null)
    return (
      <main className="tela">
        <Cabecalho voltar="/tecnico" titulo="Agendamento" />
        <p className="mutado">Agendamento não encontrado.</p>
      </main>
    )

  const ativo = STATUS_ATIVOS.includes(a.status)
  const w = a.cliente.whatsapp

  return (
    <main className="tela">
      <Cabecalho voltar={true} titulo="Agendamento" direita={<ChipStatus status={a.status} />} />

      <div className="grade-desk coluna">
        <div className="coluna">
          <section className="cartao coluna">
            <div className="linha">
              <span className="icone-bola g">
                <Icone nome={iconeServico(a.servico_id)} tamanho={30} />
              </span>
              <div className="cresce coluna p">
                <strong className="subtitulo">{a.servico.nome}</strong>
                {(a.quantidade ?? 1) > 1 && <span className="chip" style={{ alignSelf: 'flex-start' }}>{a.quantidade} aparelhos</span>}
                <span className="mutado">{dataLonga(chaveDia(a.inicio))}</span>
                <span className="forte">
                  {horaDe(a.inicio)} – {horaDe(a.fim)}
                </span>
              </div>
            </div>
            {a.status === 'remarcado' && <div className="aviso-msg">Aguardando o cliente aceitar o novo horário.</div>}
          </section>

          <section className="cartao lista-info" aria-label="Cliente">
            <Link to={`/tecnico/clientes/${a.cliente_id}`} className="info" style={{ color: 'inherit', textDecoration: 'none' }}>
              <Icone nome="perfil" />
              <div className="cresce coluna p">
                <span className="rotulo">Cliente</span>
                <strong>{a.cliente.nome}</strong>
                <span className="mutado">{formatarWhats(w)}</span>
              </div>
              <Icone nome="direita" />
            </Link>
            <div className="grade-2">
              <a className="btn btn-claro btn-p" style={{ width: '100%' }} href={linkWhats(w, `Olá, ${a.cliente.nome.split(' ')[0]}! `)} target="_blank" rel="noreferrer">
                <Icone nome="mensagem" tamanho={18} /> WhatsApp
              </a>
              <a className="btn btn-claro btn-p" style={{ width: '100%' }} href={`tel:+${soDigitos(w)}`}>
                <Icone nome="telefone" tamanho={18} /> Ligar
              </a>
            </div>
            <div className="divisor" />
            <div className="info">
              <Icone nome="local" />
              <div className="cresce coluna p">
                <span className="rotulo">Endereço</span>
                <strong>{enderecoTexto(a.endereco)}</strong>
                {a.endereco.observacoes && <span className="mutado">{a.endereco.observacoes}</span>}
              </div>
            </div>
            <a className="btn btn-claro btn-p" href={linkMapa(a.endereco)} target="_blank" rel="noreferrer">
              <Icone nome="externo" tamanho={18} /> Abrir no mapa
            </a>
            <div className="divisor" />
            <div className="info">
              <Icone nome="aparelho" />
              <div className="cresce coluna p">
                <span className="rotulo">Aparelho</span>
                <strong>{aparelhoTexto(a.aparelho)}</strong>
              </div>
            </div>
            {a.aparelho?.foto_url && <img src={a.aparelho.foto_url} alt="Foto do aparelho enviada pelo cliente" className="foto-previa" />}
            {a.observacao_cliente && (
              <>
                <div className="divisor" />
                <div className="info">
                  <Icone nome="mensagem" />
                  <div className="cresce coluna p">
                    <span className="rotulo">Observação do cliente</span>
                    <span>{a.observacao_cliente}</span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="coluna">
          {a.atendimento && (
            <section className="cartao coluna">
              <h2 className="subtitulo">Serviço realizado</h2>
              <p>{a.atendimento.descricao || '—'}</p>
              {a.atendimento.pecas && <p className="mutado">Peças/gás: {a.atendimento.pecas}</p>}
              {a.atendimento.valor != null && <p className="forte">Valor cobrado: {moeda(a.atendimento.valor)}</p>}
              <p className="mutado peq">Concluído em {dataHoraLonga(a.atendimento.concluido_em)}</p>
              {a.atendimento.fotos.map((f, i) => (
                <img key={i} src={f} alt={`Foto do serviço ${i + 1}`} className="foto-previa" />
              ))}
            </section>
          )}

          <Erro>{erro || acoes.erro}</Erro>
          {ativo && (
            <section className="coluna" aria-label="Ações">
              {(a.status === 'pendente' || a.status === 'remarcado') && (
                <button className="btn btn-ok" disabled={acoes.ocupado} onClick={() => acoes.confirmar(a)}>
                  <Icone nome="check" /> Confirmar
                </button>
              )}
              {a.status === 'confirmado' && (
                <Link className="btn btn-primario" to={`/tecnico/agendamento/${a.id}/concluir`}>
                  <Icone nome="checkCirculo" /> Concluir serviço
                </Link>
              )}
              {a.status === 'confirmado' && (
                <button className="btn btn-secundario" onClick={() => acoes.setMsg({ titulo: 'Lembrete', numero: w, texto: mensagens.lembrete(a) })}>
                  <Icone nome="sino" /> Enviar lembrete
                </button>
              )}
              {a.status === 'remarcado' && (
                <button
                  className="btn btn-secundario"
                  onClick={() => acoes.setMsg({ titulo: 'Reenviar sugestão', numero: w, texto: mensagens.remarcacao(a, linkApp(`/meus/${a.id}`)) })}
                >
                  <Icone nome="enviar" /> Reenviar sugestão
                </button>
              )}
              <button className="btn btn-secundario" onClick={() => acoes.remarcar(a)}>
                <Icone nome="relogio" /> {a.status === 'remarcado' ? 'Sugerir outro horário' : 'Remarcar'}
              </button>
              <button className="btn btn-perigo" onClick={() => setCancelar(true)}>
                Cancelar
              </button>
            </section>
          )}
          {a.status === 'concluido' && (
            <button className="btn btn-secundario" onClick={() => acoes.setMsg({ titulo: 'Agradecer o cliente', numero: w, texto: mensagens.concluido(a) })}>
              <Icone nome="enviar" /> Enviar agradecimento
            </button>
          )}
        </div>
      </div>

      {acoes.elementos}

      <Modal titulo="Cancelar agendamento?" aberto={cancelar} fechar={() => setCancelar(false)}>
        <p className="mutado">
          {a.cliente.nome} · {dataHoraLonga(a.inicio)}
        </p>
        <button
          className="btn btn-perigo"
          disabled={ocupado}
          onClick={() =>
            rodar(async () => {
              await api.tecCancelar(a.id)
              avisarMudanca()
              setCancelar(false)
              await carregar()
              toast('Agendamento cancelado.')
              acoes.setMsg({ titulo: 'Avisar o cliente', numero: w, texto: mensagens.cancelamento(a, linkApp('/agendar')) })
            })
          }
        >
          Sim, cancelar
        </button>
        <button className="btn btn-secundario" onClick={() => setCancelar(false)}>
          Voltar
        </button>
      </Modal>
    </main>
  )
}

export function ConcluirServico() {
  const { id } = useParams()
  const { api, toast } = useEstado()
  const { a } = useAgendamento(id)
  const nav = useNavigate()
  const [descricao, setDescricao] = useState('')
  const [pecas, setPecas] = useState('')
  const [valor, setValor] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [feito, setFeito] = useState(false)
  const { ocupado, erro, rodar } = useAcao()

  if (a === undefined) return <Carregando />
  if (!a) return <p className="mutado">Agendamento não encontrado.</p>

  const meses = a.servico.intervalo_retorno_meses
  const retorno = meses ? somarMeses(hojeChave(), meses) : null

  if (feito)
    return (
      <main className="tela">
        <div className="sucesso">
          <Icone nome="check" tamanho={44} />
        </div>
        <h1 className="titulo marinho centro">Serviço concluído!</h1>
        {retorno && (
          <div className="cartao linha">
            <span className="icone-bola">
              <Icone nome="sino" />
            </span>
            <span className="cresce">
              Retorno agendado para <strong>{dataLonga(retorno).toLowerCase()}</strong>. O app vai te avisar.
            </span>
          </div>
        )}
        <a className="btn btn-primario" href={linkWhats(a.cliente.whatsapp, mensagens.concluido(a))} target="_blank" rel="noreferrer">
          <Icone nome="enviar" /> Agradecer no WhatsApp
        </a>
        <Link className="btn btn-secundario" to="/tecnico">
          Voltar à agenda
        </Link>
      </main>
    )

  return (
    <main className="tela">
      <Cabecalho voltar={true} titulo="Concluir serviço" />
      <p className="mutado">
        {a.servico.nome} · {a.cliente.nome}
      </p>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            const v = valor.trim() ? Number(valor.replace(/\./g, '').replace(',', '.')) : null
            if (v != null && (isNaN(v) || v < 0)) throw new Error('Valor inválido.')
            await api.tecConcluir(a.id, { descricao: descricao.trim(), pecas: pecas.trim(), valor: v, fotos: foto ? [foto] : [] })
            avisarMudanca()
            toast('Serviço concluído.')
            setFeito(true)
          })
        }}
      >
        <div className="campo">
          <label htmlFor="desc">O que foi feito</label>
          <textarea id="desc" className="entrada" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: higienização completa, troca do capacitor…" required />
        </div>
        <div className="campo">
          <label htmlFor="pecas">Peças ou gás usados</label>
          <input id="pecas" className="entrada" value={pecas} onChange={(e) => setPecas(e.target.value)} placeholder="Ex.: R410A 400 g, capacitor 35 µF" />
        </div>
        <div className="campo">
          <label htmlFor="valor">Valor cobrado (R$)</label>
          <input id="valor" className="entrada" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="0,00" />
        </div>
        <CampoFoto valor={foto} mudar={setFoto} rotulo="Foto do serviço (opcional)" />
        {retorno && <p className="mutado">Retorno será criado para {dataLonga(retorno).toLowerCase()} ({meses} meses).</p>}
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Marcar como concluído'}
        </button>
        <button type="button" className="btn-link" onClick={() => nav(-1)}>
          Voltar
        </button>
      </form>
    </main>
  )
}
