import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icone, iconeServico } from '../../components/Icone'
import { SeletorHorario } from '../../components/SeletorHorario'
import { BTUS_GRANDE, MAX_APARELHOS, duracaoVisita, textoDuracao } from '../../lib/horarios'
import { AtivarAvisos } from '../../components/Avisos'
import { CampoFoto, Cabecalho, Carregando, Erro, useAcao } from '../../components/ui'
import { useEstado, useRascunho } from '../../estado'
import type { AgendamentoDetalhado, Aparelho, Endereco } from '../../data/types'
import { aparelhoTexto, enderecoTexto, formatarWhats, mascaraWhats, precoTexto } from '../../lib/formato'
import { baixarIcs } from '../../lib/ics'
import { dataHoraLonga, dataLonga, chaveDia, horaDe } from '../../lib/tempo'
import { linkWhats } from '../../lib/whatsapp'

// ---------------- Passo 1: serviço ----------------
export function EscolherServico() {
  const { config } = useEstado()
  const [r, atualizar] = useRascunho()
  const nav = useNavigate()
  return (
    <main className="tela sem-nav">
      <Cabecalho voltar="/inicio" titulo="" />
      <div className="coluna p">
        <span className="passo">Passo 1 de 3</span>
        <h1 className="titulo">Qual serviço?</h1>
      </div>
      <div className="coluna" role="radiogroup" aria-label="Serviço">
        {config.servicos.map((s) => (
          <button key={s.id} className="opcao" role="radio" aria-checked={r.servico_id === s.id} onClick={() => atualizar({ servico_id: s.id, inicio: undefined })}>
            <span className="icone-bola">
              <Icone nome={iconeServico(s.id)} />
            </span>
            <span className="cresce coluna p">
              <strong>{s.nome}</strong>
              <span className="mutado">{s.descricao}</span>
              {s.preco_base != null && <span className="peq forte" style={{ color: 'var(--acao)' }}>{precoTexto(s.preco_base)}</span>}
            </span>
            <span className="radio" />
          </button>
        ))}
      </div>
      <button className="btn btn-primario mt-auto" disabled={!r.servico_id} onClick={() => nav('/agendar/horario')}>
        Continuar
      </button>
    </main>
  )
}

// ---------------- Passo 2: dia e horário ----------------
export function EscolherHorario() {
  const { api, config, perfil, token, recarregarPerfil, toast } = useEstado()
  const [r, atualizar, limpar] = useRascunho()
  const nav = useNavigate()
  const { ocupado, erro, rodar } = useAcao()
  const servico = config.servicos.find((s) => s.id === r.servico_id)
  const remarcando = r.remarcar_id ? perfil?.agendamentos.find((a) => a.id === r.remarcar_id) : undefined

  const endereco = perfil?.enderecos.find((e) => e.id === r.endereco_id) ?? perfil?.enderecos[0]
  const aparelho = perfil?.aparelhos.find((a) => a.id === r.aparelho_id) ?? perfil?.aparelhos[0]

  if (!servico) return <Navigate to="/agendar" replace />

  const quantidade = r.quantidade ?? 1
  const btus = aparelho ? aparelho.btus : r.grande ? BTUS_GRANDE : null
  const duracao = remarcando
    ? Math.round((new Date(remarcando.fim).getTime() - new Date(remarcando.inicio).getTime()) / 60_000)
    : duracaoVisita(servico, quantidade, btus)

  async function confirmar() {
    if (!r.inicio) return
    if (!token || !endereco) return nav('/agendar/dados?confirmar=1')
    await rodar(async () => {
      const a = await api.criarAgendamento(token, {
        servico_id: servico!.id,
        endereco_id: endereco.id,
        aparelho_id: aparelho?.id ?? null,
        inicio: r.inicio!,
        observacao_cliente: r.observacao ?? '',
        quantidade,
      })
      await recarregarPerfil()
      limpar()
      nav(`/agendar/feito/${a.id}`, { replace: true })
    })
  }

  async function confirmarRemarcacao() {
    if (!remarcando || !token || !r.inicio) return
    await rodar(async () => {
      await api.clienteRemarcar(token, remarcando.id, r.inicio!)
      await recarregarPerfil()
      limpar()
      toast('Novo horário enviado ao técnico.')
      nav(`/meus/${remarcando.id}`, { replace: true })
    })
  }

  return (
    <main className="tela sem-nav">
      <Cabecalho voltar={remarcando ? `/meus/${remarcando.id}` : '/agendar'} titulo="" />
      <div className="coluna p">
        {!remarcando && <span className="passo">Passo 2 de 3</span>}
        <h1 className="titulo">{remarcando ? 'Escolha outro horário' : 'Dia e horário'}</h1>
        <p className="mutado">
          {servico.nome}
          {(remarcando?.quantidade ?? quantidade) > 1 ? ` · ${remarcando?.quantidade ?? quantidade} aparelhos` : ''} · cerca de {textoDuracao(duracao)}
        </p>
      </div>

      {!remarcando && (
        <section className="cartao coluna" aria-label="Aparelhos">
          <div className="linha entre">
            <span className="forte">Quantos aparelhos?</span>
            <div className="linha" style={{ gap: 8 }}>
              <button className="btn-icone" aria-label="Menos um aparelho" disabled={quantidade <= 1} style={{ opacity: quantidade <= 1 ? 0.4 : 1 }} onClick={() => atualizar({ quantidade: quantidade - 1, inicio: undefined })}>
                <Icone nome="menos" />
              </button>
              <strong style={{ minWidth: 28, textAlign: 'center', fontSize: 20 }} aria-live="polite">{quantidade}</strong>
              <button className="btn-icone" aria-label="Mais um aparelho" disabled={quantidade >= MAX_APARELHOS} style={{ opacity: quantidade >= MAX_APARELHOS ? 0.4 : 1 }} onClick={() => atualizar({ quantidade: quantidade + 1, inicio: undefined })}>
                <Icone nome="mais" />
              </button>
            </div>
          </div>
          {!aparelho && (
            <div className="coluna p">
              <span className="rotulo">Tamanho do aparelho</span>
              <div className="grade-2" role="radiogroup" aria-label="Tamanho do aparelho">
                <button className={`opcao ${!r.grande ? 'ativa' : ''}`} role="radio" aria-checked={!r.grande} style={{ minHeight: 52, justifyContent: 'center' }} onClick={() => atualizar({ grande: false, inicio: undefined })}>
                  Até 12 mil BTUs
                </button>
                <button className={`opcao ${r.grande ? 'ativa' : ''}`} role="radio" aria-checked={!!r.grande} style={{ minHeight: 52, justifyContent: 'center' }} onClick={() => atualizar({ grande: true, inicio: undefined })}>
                  18 mil ou mais
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <SeletorHorario
        duracaoMin={duracao}
        valor={r.inicio}
        mudar={(inicio) => atualizar({ inicio })}
        ignorar={remarcando ? { inicio: remarcando.inicio, fim: remarcando.fim } : undefined}
      />

      {!remarcando && (
        <section className="cartao coluna" aria-label="Local e aparelho">
          <div className="linha">
            <Icone nome="local" />
            <div className="cresce coluna p">
              <span className="rotulo">Endereço</span>
              <span>{endereco ? enderecoTexto(endereco) : 'Informe no próximo passo'}</span>
            </div>
          </div>
          <div className="divisor" />
          <div className="linha">
            <Icone nome="aparelho" />
            <div className="cresce coluna p">
              <span className="rotulo">Aparelho</span>
              <span>{aparelho ? aparelhoTexto(aparelho) : 'Informe no próximo passo'}</span>
            </div>
          </div>
          {perfil && (
            <Link to="/agendar/dados" className="btn btn-claro btn-p" style={{ alignSelf: 'flex-start' }}>
              <Icone nome="editar" tamanho={18} /> Editar
            </Link>
          )}
        </section>
      )}

      <Erro>{erro}</Erro>
      <button className="btn btn-primario" disabled={!r.inicio || ocupado} onClick={remarcando ? confirmarRemarcacao : confirmar}>
        {ocupado ? 'Enviando…' : r.inicio ? `Confirmar ${horaDe(r.inicio)}` : 'Confirmar horário'}
      </button>
    </main>
  )
}

// ---------------- Dados do cliente, endereço e aparelho ----------------
const TIPOS = ['Split', 'Janela', 'Portátil', 'Piso-teto', 'Cassete', 'Outro']
const BTUS = [7000, 9000, 12000, 18000, 22000, 24000, 30000, 36000, 48000, 60000]

export function DadosCliente() {
  const { api, perfil, token, setToken, recarregarPerfil } = useEstado()
  const [r, atualizar, limpar] = useRascunho()
  const nav = useNavigate()
  const [busca] = useSearchParams()
  const confirmarDepois = busca.get('confirmar') === '1'
  const doPerfil = busca.get('perfil') === '1'
  const { ocupado, erro, rodar } = useAcao()

  const endAtual = perfil?.enderecos.find((e) => e.id === r.endereco_id) ?? perfil?.enderecos[0]
  const apaAtual = perfil?.aparelhos.find((a) => a.id === r.aparelho_id) ?? perfil?.aparelhos[0]

  const [nome, setNome] = useState(perfil?.cliente.nome ?? '')
  const [whats, setWhats] = useState(perfil ? formatarWhats(perfil.cliente.whatsapp) : '')
  const [endId, setEndId] = useState<string>(endAtual?.id ?? 'novo')
  const [end, setEnd] = useState<Omit<Endereco, 'id' | 'cliente_id'>>(
    endAtual ?? { rua: '', numero: '', bairro: '', complemento: '', observacoes: '' },
  )
  const [apaId, setApaId] = useState<string>(apaAtual?.id ?? 'novo')
  const [apa, setApa] = useState<Omit<Aparelho, 'id' | 'cliente_id'>>(
    apaAtual ?? { tipo: 'Split', marca: '', btus: r.grande ? 18000 : 12000, foto_url: null },
  )
  const [obs, setObs] = useState(r.observacao ?? '')

  useEffect(() => {
    if (!perfil) return
    setNome((n) => n || perfil.cliente.nome)
    setWhats((w) => w || formatarWhats(perfil.cliente.whatsapp))
  }, [perfil])

  function escolherEndereco(id: string) {
    setEndId(id)
    const e = perfil?.enderecos.find((x) => x.id === id)
    setEnd(e ?? { rua: '', numero: '', bairro: '', complemento: '', observacoes: '' })
  }
  function escolherAparelho(id: string) {
    setApaId(id)
    const a = perfil?.aparelhos.find((x) => x.id === id)
    setApa(a ?? { tipo: 'Split', marca: '', btus: 12000, foto_url: null })
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await rodar(async () => {
      const res = await api.salvarDadosCliente(token, {
        nome,
        whatsapp: whats,
        endereco: { ...end, id: endId === 'novo' ? undefined : endId },
        aparelho: { ...apa, id: apaId === 'novo' ? undefined : apaId },
      })
      setToken(res.token)
      atualizar({ endereco_id: res.endereco_id, aparelho_id: res.aparelho_id, observacao: obs })
      if (confirmarDepois && r.servico_id && r.inicio) {
        const a = await api.criarAgendamento(res.token, {
          servico_id: r.servico_id,
          endereco_id: res.endereco_id,
          aparelho_id: res.aparelho_id,
          inicio: r.inicio,
          observacao_cliente: obs,
          quantidade: r.quantidade ?? 1,
        })
        limpar()
        nav(`/agendar/feito/${a.id}`, { replace: true })
        return
      }
      await recarregarPerfil()
      nav(doPerfil ? '/perfil' : '/agendar/horario', { replace: true })
    })
  }

  const definir = <K extends keyof typeof end>(k: K) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEnd({ ...end, [k]: ev.target.value })

  return (
    <main className="tela sem-nav">
      <Cabecalho voltar={true} titulo="" />
      <div className="coluna p">
        <h1 className="titulo">{doPerfil ? 'Meus dados' : 'Seus dados'}</h1>
        {!doPerfil && <p className="mutado">Para o técnico chegar até você.</p>}
      </div>
      <form className="coluna" style={{ gap: 18 }} onSubmit={salvar}>
        <section className="cartao coluna">
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input id="nome" className="entrada" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="whats">WhatsApp</label>
            <input id="whats" className="entrada" inputMode="tel" autoComplete="tel" placeholder="(71) 90000-0000" value={whats} onChange={(e) => setWhats(mascaraWhats(e.target.value))} required minLength={14} />
          </div>
        </section>

        <section className="cartao coluna" aria-label="Endereço">
          <h2 className="subtitulo linha"><Icone nome="local" /> Endereço</h2>
          {perfil && perfil.enderecos.length > 0 && (
            <div className="campo">
              <label htmlFor="endsel">Usar endereço</label>
              <select id="endsel" className="entrada" value={endId} onChange={(e) => escolherEndereco(e.target.value)}>
                {perfil.enderecos.map((e) => (
                  <option key={e.id} value={e.id}>{enderecoTexto(e)}</option>
                ))}
                <option value="novo">+ Novo endereço</option>
              </select>
            </div>
          )}
          <div className="campo">
            <label htmlFor="rua">Rua</label>
            <input id="rua" className="entrada" autoComplete="address-line1" value={end.rua} onChange={definir('rua')} required />
          </div>
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="num">Número</label>
              <input id="num" className="entrada" inputMode="numeric" value={end.numero} onChange={definir('numero')} />
            </div>
            <div className="campo">
              <label htmlFor="compl">Complemento</label>
              <input id="compl" className="entrada" placeholder="Apto, bloco" value={end.complemento} onChange={definir('complemento')} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="bairro">Bairro</label>
            <input id="bairro" className="entrada" value={end.bairro} onChange={definir('bairro')} required />
          </div>
          <div className="campo">
            <label htmlFor="ref">Ponto de referência</label>
            <input id="ref" className="entrada" value={end.observacoes} onChange={definir('observacoes')} />
          </div>
        </section>

        <section className="cartao coluna" aria-label="Aparelho">
          <h2 className="subtitulo linha"><Icone nome="aparelho" /> Aparelho</h2>
          {perfil && perfil.aparelhos.length > 0 && (
            <div className="campo">
              <label htmlFor="apasel">Qual aparelho?</label>
              <select id="apasel" className="entrada" value={apaId} onChange={(e) => escolherAparelho(e.target.value)}>
                {perfil.aparelhos.map((a) => (
                  <option key={a.id} value={a.id}>{aparelhoTexto(a)}</option>
                ))}
                <option value="novo">+ Outro aparelho</option>
              </select>
            </div>
          )}
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" className="entrada" value={apa.tipo} onChange={(e) => setApa({ ...apa, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="btus">BTUs</label>
              <select id="btus" className="entrada" value={apa.btus ?? ''} onChange={(e) => setApa({ ...apa, btus: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Não sei</option>
                {BTUS.map((b) => <option key={b} value={b}>{b.toLocaleString('pt-BR')}</option>)}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="marca">Marca</label>
            <input id="marca" className="entrada" placeholder="Ex.: LG, Samsung" value={apa.marca} onChange={(e) => setApa({ ...apa, marca: e.target.value })} />
          </div>
          <CampoFoto valor={apa.foto_url} mudar={(v) => setApa({ ...apa, foto_url: v })} rotulo="Foto do aparelho (opcional)" />
        </section>

        {!doPerfil && (
          <div className="campo">
            <label htmlFor="obs">Observação para o técnico (opcional)</label>
            <textarea id="obs" className="entrada" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: ar pingando, barulho…" />
          </div>
        )}

        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Salvando…' : confirmarDepois ? 'Confirmar agendamento' : 'Salvar'}
        </button>
      </form>
    </main>
  )
}

// ---------------- Passo 3: confirmação ----------------
export function Confirmacao() {
  const { id } = useParams()
  const { perfil, recarregarPerfil } = useEstado()
  const a = perfil?.agendamentos.find((x) => x.id === id)

  useEffect(() => {
    if (!a) recarregarPerfil()
  }, [a, recarregarPerfil])

  if (!a) return <Carregando />
  return (
    <main className="tela sem-nav">
      <div className="coluna p centro">
        <span className="passo">Passo 3 de 3</span>
        <div className="sucesso">
          <Icone nome="check" tamanho={44} />
        </div>
        <h1 className="titulo marinho" style={{ marginTop: 8 }}>Agendado!</h1>
        <p className="mutado">Você vai receber a confirmação no WhatsApp.</p>
      </div>
      <AtivarAvisos tipo="cliente" />
      <ResumoAgendamento a={a} />
      <CartaoTecnico a={a} />
      <BotaoCalendario a={a} />
      <Link to="/inicio" className="btn-link">
        Voltar ao início
      </Link>
    </main>
  )
}

export function ResumoAgendamento({ a }: { a: AgendamentoDetalhado }) {
  return (
    <section className="cartao lista-info" aria-label="Resumo">
      <div className="info">
        <Icone nome={iconeServico(a.servico_id)} />
        <div className="coluna p"><span className="rotulo">Serviço</span><strong>{a.servico.nome}</strong></div>
      </div>
      <div className="info">
        <Icone nome="agenda" />
        <div className="coluna p"><span className="rotulo">Data</span><strong>{dataLonga(chaveDia(a.inicio))} · {horaDe(a.inicio)}</strong></div>
      </div>
      <div className="info">
        <Icone nome="local" />
        <div className="coluna p"><span className="rotulo">Local</span><strong>{enderecoTexto(a.endereco)}</strong></div>
      </div>
      <div className="info">
        <Icone nome="aparelho" />
        <div className="coluna p"><span className="rotulo">{(a.quantidade ?? 1) > 1 ? `${a.quantidade} aparelhos` : 'Aparelho'}</span><strong>{aparelhoTexto(a.aparelho)}</strong></div>
      </div>
    </section>
  )
}

export function CartaoTecnico({ a }: { a: AgendamentoDetalhado }) {
  const { config } = useEstado()
  const texto = `Olá! Sou ${a.cliente.nome} e agendei ${a.servico.nome.toLowerCase()} para ${dataHoraLonga(a.inicio).toLowerCase()}.`
  return (
    <section className="cartao linha" aria-label="Técnico">
      <img src={`${import.meta.env.BASE_URL}vini-mark.png`} alt="" className="foto-mini" style={{ objectFit: 'contain', background: 'var(--gelo)', padding: 8 }} />
      <div className="cresce coluna p">
        <strong>{config.ajustes.nome_tecnico}</strong>
        <span className="mutado">Técnico · Vini Climatização</span>
      </div>
      <a className="btn-icone" href={linkWhats(config.ajustes.whatsapp_tecnico, texto)} target="_blank" rel="noreferrer" aria-label="Enviar mensagem ao técnico no WhatsApp">
        <Icone nome="mensagem" />
      </a>
    </section>
  )
}

export function BotaoCalendario({ a }: { a: AgendamentoDetalhado }) {
  const titulo = useMemo(() => `${a.servico.nome} · Vini Climatização`, [a])
  return (
    <button
      className="btn btn-secundario"
      onClick={() =>
        baixarIcs({ id: a.id, titulo, inicio: a.inicio, fim: a.fim, local: `${enderecoTexto(a.endereco)}, Salvador - BA`, descricao: `Aparelho: ${aparelhoTexto(a.aparelho)}` })
      }
    >
      <Icone nome="agenda" /> Adicionar à agenda
    </button>
  )
}
