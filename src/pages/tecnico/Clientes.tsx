import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icone, iconeServico } from '../../components/Icone'
import { Cabecalho, Carregando, ChipStatus, Erro, Modal, Vazio } from '../../components/ui'
import { useEstado } from '../../estado'
import type { ClienteResumo, PerfilCliente, Retorno, RetornoDetalhado } from '../../data/types'
import { aparelhoTexto, enderecoTexto, formatarWhats, moeda, soDigitos } from '../../lib/formato'
import { chaveDia, dataCurta, dataHoraLonga, diferencaDias, hojeChave } from '../../lib/tempo'
import { linkApp, linkWhats, mensagens } from '../../lib/whatsapp'

/** Etiqueta do retorno: Retorno hoje, Vencido, Em N dias/meses, Em dia. */
export function etiquetaRetorno(r: Pick<Retorno, 'data_prevista' | 'status'> | null): { texto: string; classe: string } {
  if (!r) return { texto: 'Em dia', classe: 'ok' }
  const d = diferencaDias(hojeChave(), r.data_prevista)
  if (d < 0) return { texto: r.status === 'avisado' ? 'Vencido · avisado' : 'Vencido', classe: 'erro' }
  if (d === 0) return { texto: 'Retorno hoje', classe: 'atencao' }
  if (d <= 30) return { texto: `Em ${d} dia${d === 1 ? '' : 's'}`, classe: d <= 7 ? 'atencao' : '' }
  const m = Math.round(d / 30)
  return { texto: `Em ${m} ${m === 1 ? 'mês' : 'meses'}`, classe: 'ok' }
}

const paraChamar = (r: RetornoDetalhado) => r.status === 'pendente' && diferencaDias(hojeChave(), r.data_prevista) <= 0

export function ClientesTecnico() {
  const { api } = useEstado()
  const [clientes, setClientes] = useState<ClienteResumo[] | null>(null)
  const [retornos, setRetornos] = useState<RetornoDetalhado[]>([])
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([api.tecClientes(), api.tecRetornos()])
      setClientes(c)
      setRetornos(r)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])
  useEffect(() => {
    carregar()
  }, [carregar])

  const chamar = retornos.filter(paraChamar)
  const termo = busca.trim().toLowerCase()
  const digitos = soDigitos(busca)
  const filtrados = (clientes ?? []).filter(
    (c) =>
      !termo ||
      c.cliente.nome.toLowerCase().includes(termo) ||
      (c.bairro ?? '').toLowerCase().includes(termo) ||
      (digitos.length >= 3 && c.cliente.whatsapp.includes(digitos)),
  )

  return (
    <main className="tela larga">
      <Cabecalho titulo="Clientes e retornos" />
      <div className="busca">
        <Icone nome="busca" />
        <input className="entrada" type="search" placeholder="Buscar por nome, bairro ou telefone" aria-label="Buscar clientes" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {chamar.length > 0 && (
        <section className="cartao-destaque coluna" aria-label="Retornos para chamar">
          <Icone nome="sino" tamanho={120} className="floco" />
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>
            {chamar.length} retorno{chamar.length === 1 ? '' : 's'} para chamar
          </h2>
          <p style={{ opacity: 0.9 }}>Clientes com limpeza ou manutenção vencendo.</p>
          <button className="btn" onClick={() => setModal(true)}>
            <Icone nome="enviar" /> Enviar lembretes
          </button>
        </section>
      )}

      <Erro>{erro}</Erro>
      <h2 className="secao">Clientes recentes</h2>
      {!clientes ? (
        <Carregando />
      ) : filtrados.length === 0 ? (
        <Vazio icone="clientes">{termo ? 'Nenhum cliente encontrado.' : 'Os clientes aparecem aqui após o primeiro agendamento.'}</Vazio>
      ) : (
        <div className="grade-desk coluna">
          {filtrados.map((c) => {
            const et = etiquetaRetorno(c.proximo_retorno)
            return (
              <Link key={c.cliente.id} to={`/tecnico/clientes/${c.cliente.id}`} className="cartao clicavel p linha">
                <span className="icone-bola">
                  <Icone nome="perfil" />
                </span>
                <div className="cresce coluna p">
                  <strong>{c.cliente.nome}</strong>
                  <span className="mutado peq">
                    {c.ultimo_servico ? `${c.ultimo_servico.nome} · ${dataCurta(c.ultimo_servico.data)}` : 'Sem serviço concluído'}
                    {c.bairro ? ` · ${c.bairro}` : ''}
                  </span>
                </div>
                <span className={`chip ${et.classe}`}>{et.texto}</span>
              </Link>
            )
          })}
        </div>
      )}

      <ModalRetornos aberto={modal} fechar={() => setModal(false)} retornos={chamar} aposAtualizar={carregar} />
    </main>
  )
}

function ModalRetornos({ aberto, fechar, retornos, aposAtualizar }: { aberto: boolean; fechar: () => void; retornos: RetornoDetalhado[]; aposAtualizar: () => void }) {
  return (
    <Modal titulo="Lembretes de retorno" aberto={aberto} fechar={fechar}>
      <p className="mutado peq">Toque em "Avisar" para abrir o WhatsApp com a mensagem pronta.</p>
      {retornos.length === 0 && <p className="mutado">Tudo em dia!</p>}
      {retornos.map((r) => (
        <ItemRetorno key={r.id} r={r} aposAtualizar={aposAtualizar} />
      ))}
    </Modal>
  )
}

function ItemRetorno({ r, aposAtualizar }: { r: RetornoDetalhado; aposAtualizar: () => void }) {
  const { api, toast } = useEstado()
  const et = etiquetaRetorno(r)
  return (
    <div className="cartao p coluna">
      <div className="linha">
        <div className="cresce coluna p">
          <strong>{r.cliente.nome}</strong>
          <span className="mutado peq">
            {r.servico.nome} · previsto {dataCurta(r.data_prevista)}
            {r.aparelho ? ` · ${r.aparelho.marca}` : ''}
          </span>
        </div>
        <span className={`chip ${et.classe}`}>{et.texto}</span>
      </div>
      <div className="grade-2">
        <a
          className="btn btn-primario btn-p"
          style={{ width: '100%' }}
          href={linkWhats(r.cliente.whatsapp, mensagens.retorno(r, linkApp('/inicio')))}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            api.tecAtualizarRetorno(r.id, 'avisado').then(aposAtualizar)
          }}
        >
          <Icone nome="enviar" tamanho={18} /> Avisar
        </a>
        <button
          className="btn btn-secundario btn-p"
          style={{ width: '100%' }}
          onClick={async () => {
            await api.tecAtualizarRetorno(r.id, 'dispensado')
            toast('Retorno dispensado.')
            aposAtualizar()
          }}
        >
          Dispensar
        </button>
      </div>
    </div>
  )
}

export function DetalheClienteTec() {
  const { id } = useParams()
  const { api } = useEstado()
  const [p, setP] = useState<(PerfilCliente & { retornos: RetornoDetalhado[] }) | null | undefined>(undefined)
  const carregar = useCallback(async () => {
    if (id) setP(await api.tecCliente(id))
  }, [api, id])
  useEffect(() => {
    carregar().catch(() => setP(null))
  }, [carregar])

  if (p === undefined) return <Carregando />
  if (!p)
    return (
      <main className="tela">
        <Cabecalho voltar="/tecnico/clientes" titulo="Cliente" />
        <p className="mutado">Cliente não encontrado.</p>
      </main>
    )

  const w = p.cliente.whatsapp
  const ativos = p.retornos.filter((r) => r.status === 'pendente' || r.status === 'avisado')
  const total = p.agendamentos.reduce((s, a) => s + (a.atendimento?.valor ?? 0), 0)

  return (
    <main className="tela larga">
      <Cabecalho voltar="/tecnico/clientes" titulo="Cliente" />
      <div className="grade-desk coluna">
        <div className="coluna">
          <section className="cartao coluna">
            <div className="linha">
              <span className="icone-bola g">
                <Icone nome="perfil" tamanho={30} />
              </span>
              <div className="cresce coluna p">
                <strong className="subtitulo">{p.cliente.nome}</strong>
                <span className="mutado">{formatarWhats(w)}</span>
                <span className="mutado peq">Cliente desde {dataCurta(chaveDia(p.cliente.criado_em))}</span>
              </div>
            </div>
            <div className="grade-2">
              <a className="btn btn-claro btn-p" style={{ width: '100%' }} href={linkWhats(w, `Olá, ${p.cliente.nome.split(' ')[0]}! `)} target="_blank" rel="noreferrer">
                <Icone nome="mensagem" tamanho={18} /> WhatsApp
              </a>
              <a className="btn btn-claro btn-p" style={{ width: '100%' }} href={`tel:+${soDigitos(w)}`}>
                <Icone nome="telefone" tamanho={18} /> Ligar
              </a>
            </div>
            {total > 0 && <p className="mutado peq">Total em serviços: {moeda(total)}</p>}
          </section>

          {ativos.length > 0 && (
            <section className="coluna">
              <h2 className="secao">Retornos</h2>
              {ativos.map((r) => (
                <ItemRetorno key={r.id} r={r} aposAtualizar={carregar} />
              ))}
            </section>
          )}

          <section className="coluna">
            <h2 className="secao">Endereços</h2>
            {p.enderecos.map((e) => (
              <div key={e.id} className="cartao p linha">
                <Icone nome="local" />
                <span className="cresce">{enderecoTexto(e)}</span>
              </div>
            ))}
          </section>

          <section className="coluna">
            <h2 className="secao">Aparelhos</h2>
            {p.aparelhos.map((x) => (
              <div key={x.id} className="cartao p linha">
                {x.foto_url ? <img src={x.foto_url} alt={`Foto do aparelho ${x.marca}`} className="foto-mini" /> : <Icone nome="aparelho" />}
                <span className="cresce">{aparelhoTexto(x)}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="coluna">
          <h2 className="secao">Histórico de serviços</h2>
          {p.agendamentos.length === 0 && <p className="mutado">Nenhum serviço ainda.</p>}
          {p.agendamentos.map((a) => (
            <Link key={a.id} to={`/tecnico/agendamento/${a.id}`} className="cartao clicavel p coluna">
              <div className="linha">
                <span className="icone-bola">
                  <Icone nome={iconeServico(a.servico_id)} />
                </span>
                <div className="cresce coluna p">
                  <strong>{a.servico.nome}</strong>
                  <span className="mutado peq">{dataHoraLonga(a.inicio)}</span>
                </div>
                <ChipStatus status={a.status} />
              </div>
              {a.atendimento?.descricao && <span className="mutado peq">{a.atendimento.descricao}</span>}
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
