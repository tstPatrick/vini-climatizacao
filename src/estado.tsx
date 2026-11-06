import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getApi, type Api, type ConfigPublica } from './data/api'
import type { PerfilCliente } from './data/types'

interface Estado {
  api: Api
  config: ConfigPublica
  recarregarConfig: () => Promise<void>
  token: string | null
  setToken: (t: string | null) => void
  perfil: PerfilCliente | null
  recarregarPerfil: () => Promise<void>
  toast: (msg: string) => void
}

const Ctx = createContext<Estado | null>(null)
const CHAVE_TOKEN = 'vini-cliente-token'

function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null)
  const [config, setConfig] = useState<ConfigPublica | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [token, setTokenState] = useState<string | null>(lerToken)
  const [perfil, setPerfil] = useState<PerfilCliente | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const a = await getApi()
      setApi(a)
      setConfig(await a.getConfig())
    } catch (e) {
      setErro(navigator.onLine ? (e as Error).message : 'offline')
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const setToken = useCallback((t: string | null) => {
    try {
      if (t) localStorage.setItem(CHAVE_TOKEN, t)
      else localStorage.removeItem(CHAVE_TOKEN)
    } catch {
      /* ignora */
    }
    setTokenState(t)
    if (!t) setPerfil(null)
  }, [])

  const recarregarPerfil = useCallback(async () => {
    if (!api || !token) return
    const p = await api.getPerfil(token)
    if (!p) setToken(null)
    setPerfil(p)
  }, [api, token, setToken])

  useEffect(() => {
    recarregarPerfil().catch(() => {})
  }, [recarregarPerfil])

  const toast = useCallback((m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((atual) => (atual === m ? null : atual)), 3200)
  }, [])

  if (erro) return <TelaErroInicial offline={erro === 'offline'} mensagem={erro} tentar={carregar} />
  if (!api || !config)
    return (
      <div className="carregando" style={{ minHeight: '100dvh' }}>
        <div className="spinner" role="status" aria-label="Carregando" />
      </div>
    )

  return (
    <Ctx.Provider
      value={{
        api,
        config,
        recarregarConfig: async () => setConfig(await api.getConfig()),
        token,
        setToken,
        perfil,
        recarregarPerfil,
        toast,
      }}
    >
      {children}
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useEstado() {
  const c = useContext(Ctx)
  if (!c) throw new Error('ProvedorEstado ausente')
  return c
}

function TelaErroInicial({ offline, mensagem, tentar }: { offline: boolean; mensagem: string; tentar: () => void }) {
  return (
    <main className="abertura">
      <img className="logo" src={`${import.meta.env.BASE_URL}vini-logo.png`} alt="Vini Climatização" />
      <h1 className="frase">{offline ? 'Você está sem internet' : 'Não foi possível abrir o app'}</h1>
      <p className="mutado">{offline ? 'Para ver horários e agendar, conecte-se à internet.' : mensagem}</p>
      <button className="btn btn-primario" onClick={tentar}>
        Tentar de novo
      </button>
    </main>
  )
}

// ---------- Rascunho do agendamento (fluxo de 3 passos) ----------

export interface Rascunho {
  servico_id?: string
  inicio?: string
  endereco_id?: string
  aparelho_id?: string | null
  observacao?: string
  /** Quando o cliente está escolhendo outro horário para um agendamento existente. */
  remarcar_id?: string
}

const CHAVE_RASCUNHO = 'vini-rascunho'

export function lerRascunho(): Rascunho {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHO) || '{}')
  } catch {
    return {}
  }
}

export function salvarRascunho(r: Rascunho) {
  try {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r))
  } catch {
    /* ignora */
  }
}

export function useRascunho(): [Rascunho, (r: Partial<Rascunho>) => void, () => void] {
  const [r, setR] = useState<Rascunho>(lerRascunho)
  const atualizar = useCallback((p: Partial<Rascunho>) => {
    setR((a) => {
      const n = { ...a, ...p }
      salvarRascunho(n)
      return n
    })
  }, [])
  const limpar = useCallback(() => {
    salvarRascunho({})
    setR({})
  }, [])
  return [r, atualizar, limpar]
}
