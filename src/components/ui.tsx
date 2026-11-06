import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icone } from './Icone'
import type { StatusAgendamento } from '../data/types'
import { reduzirFoto } from '../lib/imagem'

export function Cabecalho({ titulo, voltar, direita }: { titulo?: ReactNode; voltar?: string | true; direita?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="cabecalho">
      {voltar && (
        <button
          className="btn-icone"
          aria-label="Voltar"
          onClick={() => (voltar === true ? nav(-1) : nav(voltar))}
        >
          <Icone nome="esquerda" />
        </button>
      )}
      <h1>{titulo}</h1>
      {direita}
    </header>
  )
}

export function Carregando() {
  return (
    <div className="carregando">
      <div className="spinner" role="status" aria-label="Carregando" />
    </div>
  )
}

export function Vazio({ icone = 'floco', children }: { icone?: string; children: ReactNode }) {
  return (
    <div className="vazio">
      <span className="icone-bola">
        <Icone nome={icone} />
      </span>
      <div>{children}</div>
    </div>
  )
}

export function Erro({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div className="erro-msg" role="alert">
      {children}
    </div>
  )
}

const ROTULO_STATUS: Record<StatusAgendamento, [string, string]> = {
  pendente: ['Pendente', 'atencao'],
  confirmado: ['Confirmado', 'ok'],
  concluido: ['Concluído', 'neutro'],
  cancelado: ['Cancelado', 'erro'],
  remarcado: ['Novo horário sugerido', ''],
}

export function ChipStatus({ status }: { status: StatusAgendamento }) {
  const [t, c] = ROTULO_STATUS[status]
  return <span className={`chip ${c}`}>{t}</span>
}

export function BarraNav({ itens }: { itens: { para: string; rotulo: string; icone: string; fim?: boolean; contador?: number }[] }) {
  return (
    <nav className="barra" aria-label="Navegação principal">
      {itens.map((i) => (
        <NavLink key={i.para} to={i.para} end={i.fim}>
          <Icone nome={i.icone} />
          {i.rotulo}
          {!!i.contador && (
            <span className="contador" aria-label={`${i.contador} novos`}>
              {i.contador}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Modal({ titulo, aberto, fechar, children }: { titulo: string; aberto: boolean; fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [aberto, fechar])
  if (!aberto) return null
  return (
    <div className="modal-fundo" onClick={fechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="linha entre">
          <h2 className="subtitulo">{titulo}</h2>
          <button className="btn-icone" aria-label="Fechar" onClick={fechar}>
            <Icone nome="fechar" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CampoFoto({ valor, mudar, rotulo = 'Adicionar foto' }: { valor: string | null; mudar: (v: string | null) => void; rotulo?: string }) {
  const [erro, setErro] = useState<string | null>(null)
  return (
    <div className="coluna p">
      {valor ? (
        <div className="coluna p">
          <img className="foto-previa" src={valor} alt="Foto selecionada" />
          <button type="button" className="btn-link" onClick={() => mudar(null)}>
            <Icone nome="lixo" tamanho={18} /> Remover foto
          </button>
        </div>
      ) : (
        <label className="foto-campo">
          <Icone nome="camera" />
          {rotulo}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label={rotulo}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                setErro(null)
                mudar(await reduzirFoto(f, 900, 0.72))
              } catch (err) {
                setErro((err as Error).message)
              }
            }}
          />
        </label>
      )}
      <Erro>{erro}</Erro>
    </div>
  )
}

export function Campo({
  rotulo,
  id,
  ...p
}: { rotulo: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} className="entrada" {...p} />
    </div>
  )
}

/** Executa uma ação assíncrona mostrando erro e estado "ocupado". */
export function useAcao() {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function rodar<T>(f: () => Promise<T>): Promise<T | undefined> {
    setOcupado(true)
    setErro(null)
    try {
      return await f()
    } catch (e) {
      setErro(navigator.onLine ? (e as Error).message : 'Sem internet. Conecte-se e tente de novo.')
      return undefined
    } finally {
      setOcupado(false)
    }
  }
  return { ocupado, erro, setErro, rodar }
}

export function FaixaOffline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div className="faixa-offline" role="status">
      Você está offline. Para agendar, conecte-se à internet.
    </div>
  )
}
