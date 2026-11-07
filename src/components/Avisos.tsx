import { useEffect, useState } from 'react'
import { Icone } from './Icone'
import { Erro, useAcao } from './ui'
import { useEstado } from '../estado'
import { estadoPush, inscreverPush, inscricaoAtual, type EstadoPush } from '../lib/push'

type Tipo = 'cliente' | 'tecnico'

const TEXTOS: Record<Tipo, { titulo: string; desc: string }> = {
  cliente: { titulo: 'Receber avisos', desc: 'Saiba na hora quando o técnico confirmar ou mudar seu horário.' },
  tecnico: { titulo: 'Avisos de novos pedidos', desc: 'Receba uma notificação assim que um cliente agendar, mesmo com o app fechado.' },
}

/** Cartão para ativar as notificações push. Some quando já estão ativas (a não ser que mostrarAtivo). */
export function AtivarAvisos({ tipo, mostrarAtivo = false }: { tipo: Tipo; mostrarAtivo?: boolean }) {
  const { api, config, token, toast } = useEstado()
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const { ocupado, erro, rodar } = useAcao()

  useEffect(() => {
    estadoPush().then(setEstado)
  }, [])

  if (!estado || api.modo === 'demo') return null
  if (estado === 'ativo')
    return mostrarAtivo ? (
      <p className="mutado peq linha" style={{ gap: 6 }}>
        <Icone nome="checkCirculo" tamanho={18} /> Avisos ativados neste aparelho.
      </p>
    ) : null

  const t = TEXTOS[tipo]
  return (
    <section className="cartao coluna" aria-label={t.titulo}>
      <div className="linha">
        <span className="icone-bola">
          <Icone nome="sino" />
        </span>
        <div className="cresce coluna p">
          <strong>{t.titulo}</strong>
          <span className="mutado peq">{t.desc}</span>
        </div>
      </div>
      {estado === 'instalar-iphone' ? (
        <p className="aviso-msg peq">
          No iPhone, os avisos só funcionam com o app instalado: toque em <strong>Compartilhar</strong> →{' '}
          <strong>Adicionar à Tela de Início</strong> e abra o app pelo ícone.
        </p>
      ) : estado === 'bloqueado' ? (
        <p className="aviso-msg peq">
          As notificações estão bloqueadas. Libere nas configurações do navegador ou do celular para este site.
        </p>
      ) : estado === 'sem-suporte' ? (
        <p className="mutado peq">Este navegador não aceita notificações. Tente pelo Chrome ou com o app instalado.</p>
      ) : (
        <>
          <Erro>{erro}</Erro>
          <button
            className="btn btn-primario btn-p"
            style={{ width: '100%' }}
            disabled={ocupado}
            onClick={() =>
              rodar(async () => {
                const sub = await inscreverPush(config.ajustes.vapid_publica ?? '')
                if (tipo === 'tecnico') await api.tecSalvarPush(sub)
                else if (token) await api.salvarPushCliente(token, sub)
                setEstado('ativo')
                toast('Avisos ativados!')
              })
            }
          >
            <Icone nome="sino" tamanho={18} /> {ocupado ? 'Ativando…' : 'Ativar avisos'}
          </button>
        </>
      )}
    </section>
  )
}

/** Se o aparelho já deu permissão, reenvia a inscrição ao servidor (ela pode mudar com o tempo). */
export function useSincronizarPush(tipo: Tipo, ativo: boolean) {
  const { api, token } = useEstado()
  useEffect(() => {
    if (!ativo || api.modo === 'demo') return
    inscricaoAtual().then((sub) => {
      if (!sub) return
      if (tipo === 'tecnico') api.tecSalvarPush(sub).catch(() => {})
      else if (token) api.salvarPushCliente(token, sub).catch(() => {})
    })
  }, [api, token, tipo, ativo])
}
