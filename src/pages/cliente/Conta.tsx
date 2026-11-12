import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icone, iconeServico } from '../../components/Icone'
import { BotaoInstalar } from '../../components/Instalar'
import { AtivarAvisos } from '../../components/Avisos'
import { Cabecalho, Carregando, ChipStatus, Erro, Modal, RodapeVersao, useAcao } from '../../components/ui'
import { salvarRascunho, useEstado } from '../../estado'
import { STATUS_ATIVOS, type AgendamentoDetalhado } from '../../data/types'
import { aparelhoTexto, enderecoTexto, formatarWhats, moeda } from '../../lib/formato'
import { chaveDia, dataCurta, dataHoraLonga, horaDe, relativoDia } from '../../lib/tempo'
import { BotaoCalendario, CartaoTecnico, ResumoAgendamento } from './Agendar'
import { ErroSemPerfil } from './Inicio'

function ItemAgendamento({ a }: { a: AgendamentoDetalhado }) {
  return (
    <Link to={`/meus/${a.id}`} className="cartao clicavel p">
      <div className="linha">
        <span className="icone-bola">
          <Icone nome={iconeServico(a.servico_id)} />
        </span>
        <div className="cresce coluna p">
          <strong>{a.servico.nome}</strong>
          <span className="mutado">
            {relativoDia(chaveDia(a.inicio))} · {horaDe(a.inicio)}
          </span>
        </div>
        <ChipStatus status={a.status} />
      </div>
    </Link>
  )
}

function useAtualizarAoAbrir() {
  const { recarregarPerfil } = useEstado()
  useEffect(() => {
    recarregarPerfil().catch(() => {})
  }, [recarregarPerfil])
}

export function MinhaAgenda() {
  const { perfil } = useEstado()
  useAtualizarAoAbrir()
  const agora = Date.now()
  const lista = (perfil?.agendamentos ?? [])
    .filter((a) => STATUS_ATIVOS.includes(a.status) && new Date(a.fim).getTime() > agora)
    .sort((x, y) => new Date(x.inicio).getTime() - new Date(y.inicio).getTime())
  return (
    <main className="tela">
      <Cabecalho titulo="Agenda" />
      {(perfil?.pedidos ?? []).map((p) => (
        <section key={p.id} className="cartao p coluna" aria-label="Pedido de orçamento">
          <div className="linha">
            <span className="icone-bola">
              <Icone nome="orcamento" />
            </span>
            <div className="cresce coluna p">
              <strong>Orçamento solicitado</strong>
              <span className="mutado peq">{p.status === 'contatado' ? 'O técnico já entrou em contato.' : 'O técnico vai chamar você no WhatsApp.'}</span>
            </div>
            <span className="chip atencao">Aguardando</span>
          </div>
          <span className="peq">"{p.descricao}"</span>
        </section>
      ))}
      {!perfil ? (
        <ErroSemPerfil />
      ) : lista.length === 0 && (perfil.pedidos ?? []).length > 0 ? null : lista.length === 0 ? (
        <div className="cartao coluna centro">
          <p className="mutado">Nenhum agendamento futuro.</p>
          <Link className="btn btn-primario" to="/agendar" onClick={() => salvarRascunho({})}>
            Agendar serviço
          </Link>
        </div>
      ) : (
        <div className="coluna">
          {lista.some((a) => a.status === 'remarcado') && (
            <div className="aviso-msg">O técnico sugeriu um novo horário. Toque no agendamento para responder.</div>
          )}
          {lista.map((a) => (
            <ItemAgendamento key={a.id} a={a} />
          ))}
        </div>
      )}
    </main>
  )
}

export function Historico() {
  const { perfil } = useEstado()
  useAtualizarAoAbrir()
  const agora = Date.now()
  const lista = (perfil?.agendamentos ?? []).filter((a) => !STATUS_ATIVOS.includes(a.status) || new Date(a.fim).getTime() <= agora)
  return (
    <main className="tela">
      <Cabecalho titulo="Histórico" />
      {!perfil ? (
        <ErroSemPerfil />
      ) : lista.length === 0 ? (
        <div className="cartao centro mutado">Seus serviços concluídos aparecem aqui.</div>
      ) : (
        <div className="coluna">
          {lista.map((a) => (
            <ItemAgendamento key={a.id} a={a} />
          ))}
        </div>
      )}
    </main>
  )
}

export function DetalheCliente() {
  const { id } = useParams()
  const { api, perfil, token, recarregarPerfil, toast } = useEstado()
  const nav = useNavigate()
  const { ocupado, erro, rodar } = useAcao()
  const [cancelar, setCancelar] = useState(false)
  const a = perfil?.agendamentos.find((x) => x.id === id)
  useAtualizarAoAbrir()

  if (!perfil) return <Carregando />
  if (!a)
    return (
      <main className="tela sem-nav">
        <Cabecalho voltar="/agenda" titulo="Agendamento" />
        <p className="mutado">Agendamento não encontrado.</p>
      </main>
    )

  const ativo = STATUS_ATIVOS.includes(a.status) && new Date(a.fim).getTime() > Date.now()

  function escolherOutro() {
    salvarRascunho({ servico_id: a!.servico_id, remarcar_id: a!.id })
    nav('/agendar/horario')
  }

  return (
    <main className="tela sem-nav">
      <Cabecalho voltar="/agenda" titulo="Agendamento" direita={<ChipStatus status={a.status} />} />

      {a.status === 'remarcado' && (
        <section className="cartao coluna" style={{ borderColor: 'var(--vivo)' }}>
          <strong>Novo horário sugerido</strong>
          <p className="subtitulo marinho">{dataHoraLonga(a.inicio)}</p>
          <p className="mutado">O técnico não pode no horário que você escolheu.</p>
          <Erro>{erro}</Erro>
          <button
            className="btn btn-primario"
            disabled={ocupado}
            onClick={() =>
              rodar(async () => {
                await api.clienteResponderRemarcacao(token!, a.id, true)
                await recarregarPerfil()
                toast('Horário aceito!')
              })
            }
          >
            Aceitar novo horário
          </button>
          <button className="btn btn-secundario" onClick={escolherOutro}>
            Escolher outro
          </button>
        </section>
      )}

      <ResumoAgendamento a={a} />

      {a.atendimento && (
        <section className="cartao coluna">
          <h2 className="subtitulo">O que foi feito</h2>
          <p>{a.atendimento.descricao || '—'}</p>
          {a.atendimento.pecas && <p className="mutado">Peças/gás: {a.atendimento.pecas}</p>}
          {a.atendimento.valor != null && <p className="forte">Valor: {moeda(a.atendimento.valor)}</p>}
          {a.atendimento.fotos.map((f, i) => (
            <img key={i} src={f} alt={`Foto do serviço ${i + 1}`} className="foto-previa" />
          ))}
        </section>
      )}

      <CartaoTecnico a={a} />

      {ativo && (
        <>
          <BotaoCalendario a={a} />
          {a.status !== 'remarcado' && (
            <button className="btn btn-secundario" onClick={escolherOutro}>
              <Icone nome="relogio" /> Mudar horário
            </button>
          )}
          <button className="btn btn-perigo" onClick={() => setCancelar(true)}>
            Cancelar agendamento
          </button>
        </>
      )}
      {a.status === 'concluido' && (
        <button
          className="btn btn-primario"
          onClick={() => {
            salvarRascunho({ servico_id: a.servico_id, aparelho_id: a.aparelho_id, endereco_id: a.endereco_id })
            nav('/agendar/horario')
          }}
        >
          Agendar de novo
        </button>
      )}

      <Modal titulo="Cancelar agendamento?" aberto={cancelar} fechar={() => setCancelar(false)}>
        <p className="mutado">
          {a.servico.nome} · {dataHoraLonga(a.inicio)}
        </p>
        <Erro>{erro}</Erro>
        <button
          className="btn btn-perigo"
          disabled={ocupado}
          onClick={() =>
            rodar(async () => {
              await api.clienteCancelar(token!, a.id)
              await recarregarPerfil()
              setCancelar(false)
              toast('Agendamento cancelado.')
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

export function Perfil() {
  const { perfil, setToken } = useEstado()
  const nav = useNavigate()
  const [sair, setSair] = useState(false)
  return (
    <main className="tela">
      <Cabecalho titulo="Perfil" />
      {!perfil ? (
        <ErroSemPerfil />
      ) : (
        <>
          <section className="cartao linha">
            <span className="icone-bola g">
              <Icone nome="perfil" tamanho={30} />
            </span>
            <div className="cresce coluna p">
              <strong className="subtitulo">{perfil.cliente.nome}</strong>
              <span className="mutado">{formatarWhats(perfil.cliente.whatsapp)}</span>
            </div>
          </section>
          <section className="coluna">
            <h2 className="secao">Endereços</h2>
            {perfil.enderecos.map((e) => (
              <div key={e.id} className="cartao p linha">
                <Icone nome="local" />
                <span className="cresce">{enderecoTexto(e)}</span>
              </div>
            ))}
          </section>
          <section className="coluna">
            <h2 className="secao">Aparelhos</h2>
            {perfil.aparelhos.map((x) => (
              <div key={x.id} className="cartao p linha">
                {x.foto_url ? <img src={x.foto_url} alt="Foto do aparelho" className="foto-mini" /> : <Icone nome="aparelho" />}
                <span className="cresce">{aparelhoTexto(x)}</span>
              </div>
            ))}
          </section>
          <Link className="btn btn-secundario" to="/agendar/dados?perfil=1">
            <Icone nome="editar" /> Editar dados
          </Link>
          <p className="mutado peq centro">Cliente desde {dataCurta(chaveDia(perfil.cliente.criado_em))}</p>
        </>
      )}
      {perfil && <AtivarAvisos tipo="cliente" mostrarAtivo />}
      <BotaoInstalar />
      {perfil && (
        <button className="btn-link" onClick={() => setSair(true)}>
          <Icone nome="sair" tamanho={20} /> Sair deste aparelho
        </button>
      )}
      <Link className="btn-link peq" to="/tecnico" style={{ color: 'var(--texto-2)' }}>
        Área do técnico
      </Link>
      <RodapeVersao />
      <Modal titulo="Sair deste aparelho?" aberto={sair} fechar={() => setSair(false)}>
        <p className="mutado">Seus agendamentos continuam salvos. Para voltar, use "Já tenho conta" com seu WhatsApp.</p>
        <button
          className="btn btn-perigo"
          onClick={() => {
            setToken(null)
            nav('/', { replace: true })
          }}
        >
          Sair
        </button>
      </Modal>
    </main>
  )
}
