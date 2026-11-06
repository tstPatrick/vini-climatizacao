import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Icone, iconeServico } from '../../components/Icone'
import { BotaoInstalar } from '../../components/Instalar'
import { ChipStatus, Erro, useAcao } from '../../components/ui'
import { useEstado, salvarRascunho } from '../../estado'
import { STATUS_ATIVOS } from '../../data/types'
import { chaveDia, horaDe, relativoDia } from '../../lib/tempo'
import { mascaraWhats, primeiroNome } from '../../lib/formato'

const logo = `${import.meta.env.BASE_URL}vini-logo.png`

export function Abertura() {
  const { token } = useEstado()
  if (token) return <Navigate to="/inicio" replace />
  return (
    <main className="abertura">
      <img className="logo" src={logo} alt="Vini Climatização" />
      <p className="frase">Seu ar condicionado em boas mãos.</p>
      <div className="coluna" style={{ width: '100%' }}>
        <Link className="btn btn-primario" to="/inicio">
          Começar
        </Link>
        <Link className="btn-link" to="/entrar">
          Já tenho conta
        </Link>
      </div>
      <BotaoInstalar classe="btn-link" />
    </main>
  )
}

export function Entrar() {
  const { api, setToken } = useEstado()
  const nav = useNavigate()
  const [whats, setWhats] = useState('')
  const { ocupado, erro, setErro, rodar } = useAcao()
  return (
    <main className="tela sem-nav">
      <header className="cabecalho">
        <Link className="btn-icone" to="/" aria-label="Voltar">
          <Icone nome="esquerda" />
        </Link>
      </header>
      <h1 className="titulo">Bem-vindo de volta</h1>
      <p className="mutado">Informe o WhatsApp que você usou para agendar.</p>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            const t = await api.entrarCliente(whats)
            if (!t) return setErro('Não encontramos esse número. Faça seu primeiro agendamento!')
            setToken(t)
            nav('/inicio', { replace: true })
          })
        }}
      >
        <div className="campo">
          <label htmlFor="whats">WhatsApp</label>
          <input id="whats" className="entrada" inputMode="tel" autoComplete="tel" placeholder="(71) 90000-0000" value={whats} onChange={(e) => setWhats(mascaraWhats(e.target.value))} required />
        </div>
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado || whats.replace(/\D/g, '').length < 10}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
        <Link className="btn-link" to="/agendar">
          Primeira vez? Agendar agora
        </Link>
      </form>
    </main>
  )
}

export function Inicio() {
  const { config, perfil } = useEstado()
  const nav = useNavigate()
  const agora = Date.now()
  const proximo = perfil?.agendamentos
    .filter((a) => STATUS_ATIVOS.includes(a.status) && new Date(a.fim).getTime() > agora)
    .sort((x, y) => new Date(x.inicio).getTime() - new Date(y.inicio).getTime())[0]
  const temAviso = perfil?.agendamentos.some((a) => a.status === 'remarcado')

  function agendar(servico_id?: string) {
    salvarRascunho(servico_id ? { servico_id } : {})
    nav(servico_id ? '/agendar/horario' : '/agendar')
  }

  return (
    <main className="tela">
      <header className="linha entre">
        <img src={logo} alt="Vini Climatização" style={{ height: 44, width: 'auto' }} />
        <Link className="btn-icone" to="/agenda" aria-label={temAviso ? 'Notificações: há uma novidade' : 'Notificações'}>
          <Icone nome="sino" />
          {temAviso && <span className="ponto" />}
        </Link>
      </header>
      <h1 className="titulo">Olá{perfil ? `, ${primeiroNome(perfil.cliente.nome)}` : ''}!</h1>

      <section className="cartao-destaque coluna" aria-label="Agendar serviço">
        <Icone nome="floco" tamanho={140} className="floco" />
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Agendar serviço</h2>
        <p style={{ opacity: 0.9, maxWidth: 240 }}>Escolha o serviço e o melhor horário.</p>
        <button className="btn" onClick={() => agendar()}>
          Agendar agora
        </button>
      </section>

      <section className="atalhos" aria-label="Serviços">
        {config.servicos
          .filter((s) => s.id !== 'orcamento')
          .slice(0, 4)
          .map((s) => (
            <button key={s.id} className="atalho" onClick={() => agendar(s.id)}>
              <span className="icone-bola">
                <Icone nome={iconeServico(s.id)} />
              </span>
              {s.nome}
            </button>
          ))}
      </section>

      <section className="coluna">
        <h2 className="secao">Próximo agendamento</h2>
        {proximo ? (
          <Link to={`/meus/${proximo.id}`} className="cartao clicavel">
            <div className="linha">
              <span className="icone-bola">
                <Icone nome={iconeServico(proximo.servico_id)} />
              </span>
              <div className="cresce coluna p">
                <strong>{proximo.servico.nome}</strong>
                <span className="mutado">
                  {relativoDia(chaveDia(proximo.inicio))} · {horaDe(proximo.inicio)}
                </span>
              </div>
              <ChipStatus status={proximo.status} />
            </div>
          </Link>
        ) : (
          <div className="cartao centro mutado">Nenhum agendamento por enquanto.</div>
        )}
      </section>
    </main>
  )
}

export function ErroSemPerfil() {
  return (
    <div className="cartao coluna centro">
      <p className="mutado">Você ainda não tem agendamentos neste aparelho.</p>
      <Link className="btn btn-primario" to="/agendar">
        Agendar agora
      </Link>
      <Link className="btn-link" to="/entrar">
        Já agendei antes
      </Link>
    </div>
  )
}
