import { useCallback, useEffect, useState } from 'react'
import { Icone } from '../../components/Icone'
import { SeletorHorario } from '../../components/SeletorHorario'
import { Erro, Modal, useAcao } from '../../components/ui'
import { useEstado } from '../../estado'
import type { PedidoDetalhado } from '../../data/types'
import { primeiroNome } from '../../lib/formato'
import { linkWhats } from '../../lib/whatsapp'
import { avisarMudanca } from './comum'

function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} dia${d === 1 ? '' : 's'}`
}

/** Quadro "Pedidos de orçamento" no topo da Agenda do técnico. */
export function PedidosOrcamento({ aposAgendar }: { aposAgendar: () => void }) {
  const { api, config, toast } = useEstado()
  const [pedidos, setPedidos] = useState<PedidoDetalhado[]>([])
  const [marcar, setMarcar] = useState<PedidoDetalhado | null>(null)

  const carregar = useCallback(() => {
    api.tecPedidos().then(setPedidos).catch(() => {})
  }, [api])
  useEffect(() => {
    carregar()
    window.addEventListener('vini:atualizar', carregar)
    return () => window.removeEventListener('vini:atualizar', carregar)
  }, [carregar])

  if (pedidos.length === 0) return null
  const novos = pedidos.filter((p) => p.status === 'novo').length
  const duracao = config.servicos.find((s) => s.id === 'orcamento')?.duracao_min ?? 60

  return (
    <section className="cartao coluna" style={{ borderColor: novos ? '#f0a500' : undefined }} aria-label="Pedidos de orçamento">
      <div className="linha entre">
        <h2 className="subtitulo linha">
          <Icone nome="orcamento" /> Pedidos de orçamento
        </h2>
        {novos > 0 && <span className="chip atencao">{novos} novo{novos === 1 ? '' : 's'}</span>}
      </div>
      {pedidos.map((p) => (
        <div key={p.id} className="cartao p coluna">
          <div className="linha entre" style={{ alignItems: 'flex-start' }}>
            <strong>{p.cliente.nome}</strong>
            <span className="mutado peq">{p.status === 'contatado' ? 'Contatado' : haQuanto(p.criado_em)}</span>
          </div>
          <span className="mutado peq linha" style={{ gap: 4 }}>
            <Icone nome="local" tamanho={16} /> {p.endereco.rua}
            {p.endereco.numero ? `, ${p.endereco.numero}` : ''} · {p.endereco.bairro} · {p.endereco.cidade ?? 'Salvador'}
          </span>
          <span className="peq">"{p.descricao}"</span>
          {p.foto_url && <img src={p.foto_url} alt="Foto enviada pelo cliente" className="foto-previa" />}
          <div className="grade-2">
            <a
              className="btn btn-primario btn-p"
              style={{ width: '100%' }}
              href={linkWhats(p.cliente.whatsapp, `Olá, ${primeiroNome(p.cliente.nome)}! Recebi seu pedido de orçamento pelo app. Qual o melhor dia para eu fazer a visita?\n\n— Vini Climatização`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (p.status === 'novo') api.tecPedidoStatus(p.id, 'contatado').then(() => { carregar(); avisarMudanca() })
              }}
            >
              <Icone nome="mensagem" tamanho={18} /> WhatsApp
            </a>
            <button className="btn btn-secundario btn-p" style={{ width: '100%' }} onClick={() => setMarcar(p)}>
              <Icone nome="agenda" tamanho={18} /> Marcar visita
            </button>
          </div>
          <button
            className="btn-link peq"
            style={{ color: 'var(--texto-2)', minHeight: 36 }}
            onClick={async () => {
              await api.tecPedidoStatus(p.id, 'dispensado')
              toast('Pedido dispensado.')
              carregar()
              avisarMudanca()
            }}
          >
            Dispensar pedido
          </button>
        </div>
      ))}
      {marcar && (
        <ModalMarcarVisita
          pedido={marcar}
          duracao={duracao}
          fechar={() => setMarcar(null)}
          pronto={() => {
            setMarcar(null)
            toast('Visita marcada. O cliente foi avisado.')
            carregar()
            avisarMudanca()
            aposAgendar()
          }}
        />
      )}
    </section>
  )
}

function ModalMarcarVisita({ pedido, duracao, fechar, pronto }: { pedido: PedidoDetalhado; duracao: number; fechar: () => void; pronto: () => void }) {
  const { api } = useEstado()
  const [inicio, setInicio] = useState<string | undefined>()
  const { ocupado, erro, rodar } = useAcao()
  return (
    <Modal titulo="Marcar visita de orçamento" aberto fechar={fechar}>
      <p className="mutado">
        {pedido.cliente.nome} · {pedido.endereco.bairro} · {pedido.endereco.cidade ?? 'Salvador'}
      </p>
      <SeletorHorario duracaoMin={duracao} valor={inicio} mudar={setInicio} />
      <Erro>{erro}</Erro>
      <button
        className="btn btn-primario"
        disabled={!inicio || ocupado}
        onClick={() =>
          rodar(async () => {
            await api.tecAgendarPedido(pedido.id, inicio!)
            pronto()
          })
        }
      >
        {ocupado ? 'Salvando…' : 'Marcar visita'}
      </button>
    </Modal>
  )
}
