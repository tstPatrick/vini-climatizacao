import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { SeletorHorario } from '../../components/SeletorHorario'
import { useSincronizarPush } from '../../components/Avisos'
import { BarraNav, Carregando, Erro, Modal, useAcao, RodapeVersao, EntradaSenha } from '../../components/ui'
import { useEstado } from '../../estado'
import type { AgendamentoDetalhado } from '../../data/types'
import { DEMO_EMAIL, DEMO_SENHA } from '../../data/localApi'
import { dataHoraLonga } from '../../lib/tempo'
import { linkWhats, mensagens, linkApp } from '../../lib/whatsapp'

/** Protege as rotas do técnico, mostra a barra e avisa sobre novos pedidos. */
export function LayoutTecnico() {
  const { api, toast } = useEstado()
  const [logado, setLogado] = useState<boolean | null>(null)
  const [pendentes, setPendentes] = useState(0)
  const anterior = useRef<number | null>(null)
  const local = useLocation()

  useEffect(() => {
    api.logado().then(setLogado)
  }, [api, local.pathname])

  useEffect(() => {
    if (!logado) return
    let vivo = true
    async function verificar() {
      try {
        const agora = new Date()
        const ate = new Date(agora.getTime() + 90 * 86_400_000)
        const [lista, pedidos] = await Promise.all([
          api.tecAgendamentos(agora.toISOString(), ate.toISOString()),
          api.tecPedidos().catch(() => []),
        ])
        const n = lista.filter((a) => a.status === 'pendente').length + pedidos.filter((p) => p.status === 'novo').length
        if (!vivo) return
        if (anterior.current != null && n > anterior.current) {
          toast('Novo pedido!')
          if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker?.ready
              .then((r) => r.showNotification('Vini Climatização', { body: 'Novo pedido de agendamento pendente.', icon: `${import.meta.env.BASE_URL}icon-192.png` }))
              .catch(() => new Notification('Vini Climatização', { body: 'Novo pedido de agendamento pendente.' }))
          }
        }
        anterior.current = n
        setPendentes(n)
      } catch {
        /* sem conexão: tenta de novo depois */
      }
    }
    verificar()
    const t = window.setInterval(verificar, 60_000)
    const f = () => document.visibilityState === 'visible' && verificar()
    document.addEventListener('visibilitychange', f)
    window.addEventListener('vini:atualizar', verificar)
    return () => {
      vivo = false
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', f)
      window.removeEventListener('vini:atualizar', verificar)
    }
  }, [api, logado, toast])

  useSincronizarPush('tecnico', !!logado)

  if (logado === null) return <Carregando />
  if (!logado) return <Navigate to="/tecnico/login" replace state={{ de: local.pathname }} />
  return (
    <div className="painel">
      <Outlet />
      <BarraNav
        itens={[
          { para: '/tecnico', rotulo: 'Agenda', icone: 'agenda', fim: true, contador: pendentes },
          { para: '/tecnico/clientes', rotulo: 'Clientes', icone: 'clientes' },
          { para: '/tecnico/servicos', rotulo: 'Serviços', icone: 'servicos' },
          { para: '/tecnico/ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
        ]}
      />
    </div>
  )
}

/** Dispara a atualização do contador de pendentes. */
export const avisarMudanca = () => window.dispatchEvent(new Event('vini:atualizar'))

export function LoginTecnico() {
  const { api } = useEstado()
  const nav = useNavigate()
  const local = useLocation()
  const [email, setEmail] = useState(api.modo === 'demo' ? DEMO_EMAIL : '')
  const [senha, setSenha] = useState(api.modo === 'demo' ? DEMO_SENHA : '')
  const { ocupado, erro, rodar } = useAcao()
  const destino = (local.state as { de?: string } | null)?.de ?? '/tecnico'
  return (
    <main className="tela sem-nav">
      <header className="cabecalho">
        <Link className="btn-icone" to="/inicio" aria-label="Voltar ao início">
          <Icone nome="esquerda" />
        </Link>
      </header>
      <img src={`${import.meta.env.BASE_URL}vini-logo.png`} alt="Vini Climatização" style={{ width: 220, margin: '0 auto' }} />
      <h1 className="titulo centro">Área do técnico</h1>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            await api.login(email, senha)
            nav(destino, { replace: true })
          })
        }}
      >
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" className="entrada" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <EntradaSenha id="senha" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {api.modo === 'demo' && (
          <p className="aviso-msg peq">
            Modo demonstração: {DEMO_EMAIL} / {DEMO_SENHA}
          </p>
        )}
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
        <Link className="btn-link" to="/inicio">
          Voltar ao início
        </Link>
      </form>
      <RodapeVersao />
    </main>
  )
}

/** Modal com a mensagem pronta para enviar no WhatsApp do cliente. */
export function ModalWhats({
  titulo,
  numero,
  texto,
  fechar,
  aoEnviar,
}: {
  titulo: string
  numero: string
  texto: string | null
  fechar: () => void
  aoEnviar?: () => void
}) {
  return (
    <Modal titulo={titulo} aberto={!!texto} fechar={fechar}>
      <div className="cartao p" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
        {texto}
      </div>
      <a
        className="btn btn-primario"
        href={texto ? linkWhats(numero, texto) : '#'}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          aoEnviar?.()
          setTimeout(fechar, 300)
        }}
      >
        <Icone nome="enviar" /> Enviar no WhatsApp
      </a>
      <button className="btn btn-secundario" onClick={fechar}>
        Agora não
      </button>
    </Modal>
  )
}

/** Remarcar: técnico escolhe outro horário e já envia a sugestão ao cliente. */
export function ModalRemarcar({
  agendamento,
  fechar,
  pronto,
}: {
  agendamento: AgendamentoDetalhado | null
  fechar: () => void
  pronto: (a: AgendamentoDetalhado) => void
}) {
  const { api } = useEstado()
  const [inicio, setInicio] = useState<string | undefined>()
  const { ocupado, erro, rodar } = useAcao()
  useEffect(() => setInicio(undefined), [agendamento?.id])
  if (!agendamento) return null
  return (
    <Modal titulo="Sugerir outro horário" aberto fechar={fechar}>
      <p className="mutado">
        {agendamento.cliente.nome} · {agendamento.servico.nome}
        <br />
        Atual: {dataHoraLonga(agendamento.inicio)}
      </p>
      <SeletorHorario
        duracaoMin={Math.round((new Date(agendamento.fim).getTime() - new Date(agendamento.inicio).getTime()) / 60_000)}
        valor={inicio}
        mudar={setInicio}
        ignorar={{ inicio: agendamento.inicio, fim: agendamento.fim }}
      />
      <Erro>{erro}</Erro>
      <button
        className="btn btn-primario"
        disabled={!inicio || ocupado}
        onClick={() =>
          rodar(async () => {
            await api.tecRemarcar(agendamento.id, inicio!)
            const novo = await api.tecAgendamento(agendamento.id)
            avisarMudanca()
            if (novo) pronto(novo)
          })
        }
      >
        {ocupado ? 'Salvando…' : 'Sugerir este horário'}
      </button>
    </Modal>
  )
}

/** Ações rápidas de confirmar/remarcar com o envio da mensagem no WhatsApp. */
export function useAcoesAgendamento(recarregar: () => void) {
  const { api, toast } = useEstado()
  const [msg, setMsg] = useState<{ titulo: string; numero: string; texto: string } | null>(null)
  const [remarcar, setRemarcar] = useState<AgendamentoDetalhado | null>(null)
  const { ocupado, erro, rodar } = useAcao()

  async function confirmar(a: AgendamentoDetalhado) {
    await rodar(async () => {
      await api.tecConfirmar(a.id)
      avisarMudanca()
      recarregar()
      toast('Agendamento confirmado.')
      setMsg({ titulo: 'Avisar o cliente', numero: a.cliente.whatsapp, texto: mensagens.confirmacao({ ...a, status: 'confirmado' }) })
    })
  }

  const elementos = (
    <>
      <ModalRemarcar
        agendamento={remarcar}
        fechar={() => setRemarcar(null)}
        pronto={(novo) => {
          setRemarcar(null)
          recarregar()
          setMsg({ titulo: 'Enviar sugestão ao cliente', numero: novo.cliente.whatsapp, texto: mensagens.remarcacao(novo, linkApp(`/meus/${novo.id}`)) })
        }}
      />
      <ModalWhats titulo={msg?.titulo ?? ''} numero={msg?.numero ?? ''} texto={msg?.texto ?? null} fechar={() => setMsg(null)} />
    </>
  )
  return { confirmar, remarcar: setRemarcar, setMsg, ocupado, erro, elementos }
}
