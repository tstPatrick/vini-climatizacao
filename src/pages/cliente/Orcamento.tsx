import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { AtivarAvisos } from '../../components/Avisos'
import { Cabecalho, CampoFoto, Erro, useAcao } from '../../components/ui'
import { useEstado } from '../../estado'
import { formatarWhats, mascaraWhats } from '../../lib/formato'
import { linkWhats } from '../../lib/whatsapp'

export function AvisoTaxa() {
  return (
    <div className="aviso-msg linha" style={{ alignItems: 'flex-start', gap: 10 }} role="note">
      <Icone nome="alerta" tamanho={22} style={{ minWidth: 22 }} />
      <span>
        <strong>Taxa de deslocamento:</strong> a visita para orçamento tem uma taxa de deslocamento.
      </span>
    </div>
  )
}

/** Pedido de orçamento: sem horário; o técnico combina a visita pelo WhatsApp. */
export function PedirOrcamento() {
  const { api, perfil, token, setToken, recarregarPerfil } = useEstado()
  const nav = useNavigate()
  const { ocupado, erro, rodar } = useAcao()
  const end = perfil?.enderecos[0]
  const [nome, setNome] = useState(perfil?.cliente.nome ?? '')
  const [whats, setWhats] = useState(perfil ? formatarWhats(perfil.cliente.whatsapp) : '')
  const [e, setE] = useState({
    rua: end?.rua ?? '',
    numero: end?.numero ?? '',
    complemento: end?.complemento ?? '',
    bairro: end?.bairro ?? '',
    cidade: end?.cidade ?? 'Salvador',
    observacoes: end?.observacoes ?? '',
  })
  const [descricao, setDescricao] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const set = (k: keyof typeof e) => (ev: React.ChangeEvent<HTMLInputElement>) => setE({ ...e, [k]: ev.target.value })

  return (
    <main className="tela sem-nav">
      <Cabecalho voltar="/inicio" titulo="" />
      <div className="coluna p">
        <span className="icone-bola g">
          <Icone nome="orcamento" tamanho={30} />
        </span>
        <h1 className="titulo" style={{ marginTop: 8 }}>
          Pedir orçamento
        </h1>
        <p className="mutado">
          O técnico vai até você avaliar o serviço e passar o valor. Não precisa escolher horário: ele combina a visita com você pelo WhatsApp.
        </p>
      </div>
      <AvisoTaxa />
      <form
        className="coluna"
        style={{ gap: 18 }}
        onSubmit={(ev) => {
          ev.preventDefault()
          rodar(async () => {
            const r = await api.pedirOrcamento(token, {
              nome,
              whatsapp: whats,
              endereco: { ...e, id: end?.id },
              descricao,
              foto_url: foto,
            })
            setToken(r.token)
            await recarregarPerfil().catch(() => {})
            nav(`/orcamento/enviado?id=${r.pedido_id}`, { replace: true })
          })
        }}
      >
        <section className="cartao coluna">
          <div className="campo">
            <label htmlFor="on">Nome</label>
            <input id="on" className="entrada" autoComplete="name" value={nome} onChange={(ev) => setNome(ev.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="ow">WhatsApp</label>
            <input id="ow" className="entrada" inputMode="tel" autoComplete="tel" placeholder="(71) 90000-0000" value={whats} onChange={(ev) => setWhats(mascaraWhats(ev.target.value))} required minLength={14} />
          </div>
        </section>

        <section className="cartao coluna" aria-label="Endereço">
          <h2 className="subtitulo linha">
            <Icone nome="local" /> Endereço
          </h2>
          <div className="campo">
            <label htmlFor="or">Rua</label>
            <input id="or" className="entrada" autoComplete="address-line1" value={e.rua} onChange={set('rua')} required />
          </div>
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="onu">Número</label>
              <input id="onu" className="entrada" inputMode="numeric" value={e.numero} onChange={set('numero')} />
            </div>
            <div className="campo">
              <label htmlFor="oc">Complemento</label>
              <input id="oc" className="entrada" placeholder="Apto, bloco" value={e.complemento} onChange={set('complemento')} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="ob">Bairro</label>
            <input id="ob" className="entrada" value={e.bairro} onChange={set('bairro')} required />
          </div>
          <div className="campo">
            <label htmlFor="oci">Cidade</label>
            <input id="oci" className="entrada" autoComplete="address-level2" value={e.cidade} onChange={set('cidade')} required />
          </div>
          <div className="campo">
            <label htmlFor="ore">Ponto de referência</label>
            <input id="ore" className="entrada" placeholder="Ex.: perto da farmácia" value={e.observacoes} onChange={set('observacoes')} />
          </div>
        </section>

        <section className="cartao coluna">
          <div className="campo">
            <label htmlFor="od">O que você precisa?</label>
            <textarea id="od" className="entrada" placeholder="Conte o problema ou o serviço desejado" value={descricao} onChange={(ev) => setDescricao(ev.target.value)} required />
          </div>
          <CampoFoto valor={foto} mudar={setFoto} rotulo="Foto do aparelho (opcional)" />
        </section>

        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Enviando…' : 'Enviar pedido de orçamento'}
        </button>
      </form>
    </main>
  )
}

export function OrcamentoEnviado() {
  const { perfil, config } = useEstado()
  const [busca] = useSearchParams()
  const p = perfil?.pedidos?.find((x) => x.id === busca.get('id')) ?? perfil?.pedidos?.[0]
  const end = perfil?.enderecos.find((e) => e.id === p?.endereco_id)
  const texto = `Olá! Sou ${perfil?.cliente.nome ?? ''} e pedi um orçamento pelo app${p ? `: "${p.descricao}"` : ''}.`
  return (
    <main className="tela sem-nav">
      <div className="coluna p centro">
        <div className="sucesso">
          <Icone nome="check" tamanho={44} />
        </div>
        <h1 className="titulo marinho" style={{ marginTop: 8 }}>
          Pedido enviado!
        </h1>
        <p className="mutado">O técnico vai chamar você no WhatsApp para combinar o dia da visita.</p>
      </div>
      <section className="cartao lista-info" aria-label="Resumo">
        <div className="info">
          <Icone nome="orcamento" />
          <div className="coluna p">
            <span className="rotulo">Serviço</span>
            <strong>Orçamento (visita no local)</strong>
          </div>
        </div>
        {end && (
          <div className="info">
            <Icone nome="local" />
            <div className="coluna p">
              <span className="rotulo">Local</span>
              <strong>
                {end.rua}
                {end.numero ? `, ${end.numero}` : ''} · {end.bairro} · {end.cidade ?? 'Salvador'}
              </strong>
            </div>
          </div>
        )}
        {p && (
          <div className="info">
            <Icone nome="mensagem" />
            <div className="coluna p">
              <span className="rotulo">O que precisa</span>
              <strong>{p.descricao}</strong>
            </div>
          </div>
        )}
      </section>
      <AvisoTaxa />
      <AtivarAvisos tipo="cliente" />
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
      <Link to="/inicio" className="btn-link">
        Voltar ao início
      </Link>
    </main>
  )
}
