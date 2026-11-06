import { useEffect, useState } from 'react'
import { Icone } from './Icone'
import { Modal } from './ui'

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let guardado: EventoInstalar | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  guardado = e as EventoInstalar
})

const instalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Botão "Instalar app" (Android/Chrome) ou orientação "Adicionar à tela inicial" (iPhone). */
export function BotaoInstalar({ classe = 'btn btn-secundario' }: { classe?: string }) {
  const [evento, setEvento] = useState<EventoInstalar | null>(guardado)
  const [ajuda, setAjuda] = useState(false)
  const [jaInstalado, setJaInstalado] = useState(instalado)

  useEffect(() => {
    const f = (e: Event) => {
      e.preventDefault()
      guardado = e as EventoInstalar
      setEvento(guardado)
    }
    const fim = () => setJaInstalado(true)
    window.addEventListener('beforeinstallprompt', f)
    window.addEventListener('appinstalled', fim)
    return () => {
      window.removeEventListener('beforeinstallprompt', f)
      window.removeEventListener('appinstalled', fim)
    }
  }, [])

  if (jaInstalado) return null

  return (
    <>
      <button
        className={classe}
        onClick={async () => {
          if (evento) {
            await evento.prompt()
            const r = await evento.userChoice
            if (r.outcome === 'accepted') setJaInstalado(true)
            guardado = null
            setEvento(null)
          } else setAjuda(true)
        }}
      >
        <Icone nome="instalar" /> Instalar app
      </button>
      <Modal titulo="Adicionar à tela inicial" aberto={ajuda} fechar={() => setAjuda(false)}>
        {ehIOS() ? (
          <ol className="coluna" style={{ paddingLeft: 20, margin: 0 }}>
            <li>No Safari, toque em <strong>Compartilhar</strong> (quadrado com seta).</li>
            <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Toque em <strong>Adicionar</strong>.</li>
          </ol>
        ) : (
          <ol className="coluna" style={{ paddingLeft: 20, margin: 0 }}>
            <li>Abra o menu do navegador (<strong>⋮</strong>).</li>
            <li>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
          </ol>
        )}
        <button className="btn btn-primario" onClick={() => setAjuda(false)}>
          Entendi
        </button>
      </Modal>
    </>
  )
}
