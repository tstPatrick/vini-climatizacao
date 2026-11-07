// Ícones lineares, traço 1,8 px. Decorativos por padrão (aria-hidden).
import type { SVGProps } from 'react'

const caminhos: Record<string, JSX.Element> = {
  inicio: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></>,
  agenda: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  historico: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v4.5h4.5" /><path d="M12 7.5V12l3 2" /></>,
  perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 20.5c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  sino: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  floco: <><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" /><path d="m9.5 4 2.5 2 2.5-2M9.5 20l2.5-2 2.5 2M4.2 10.2l3-.7-1-3M19.8 13.8l-3 .7 1 3M4.2 13.8l3 .7-1 3M19.8 10.2l-3-.7 1-3" /></>,
  instalacao: <><rect x="2.5" y="5" width="19" height="8.5" rx="2.5" /><path d="M6 10h12M7 17l-1 3M12 17v3M17 17l1 3" /></>,
  limpeza: <><path d="M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3Z" /><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" /></>,
  manutencao: <><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3Z" /><path d="M14.5 6.5 17 4l3 3-2.5 2.5" /></>,
  gas: <><rect x="7" y="7" width="10" height="14" rx="3" /><path d="M10 7V4h4v3M12 11v4M10 13h4" /></>,
  orcamento: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 3.5V6h6V3.5M8.5 11h7M8.5 15h4.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCirculo: <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.7L16 9.5" /></>,
  esquerda: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  direita: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  local: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  mensagem: <><path d="M4 18.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H8Z" /><path d="M8.5 9h7M8.5 12.5h4.5" /></>,
  telefone: <path d="M5 4h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6 6l1.5-2 4.5 1.5V19a1.5 1.5 0 0 1-1.6 1.5C10.5 20 4 13.5 3.5 5.6A1.5 1.5 0 0 1 5 4Z" />,
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  busca: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  clientes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 19.5c1-3.3 3.5-5 6.5-5s5.5 1.7 6.5 5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.6c1.7.7 2.9 2.3 3.5 4.9" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" /></>,
  servicos: <><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" /></>,
  fechar: <path d="m6 6 12 12M18 6 6 18" />,
  camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" /><circle cx="12" cy="13" r="3.5" /></>,
  sair: <><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></>,
  alerta: <><path d="M12 3.5 2.5 20h19Z" /><path d="M12 10v4.5M12 17.5v.1" /></>,
  relogio: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  editar: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  baixar: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  enviar: <><path d="M21 3 10 14" /><path d="M21 3 14.5 21l-4.5-7-7-4.5Z" /></>,
  aparelho: <><rect x="2.5" y="5" width="19" height="9" rx="2.5" /><path d="M6 10.5h12" /></>,
  lixo: <><path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  wifi: <><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 15.8a4.5 4.5 0 0 1 6.4 0" /><path d="M12 19.5v.1" /><path d="m3 3 18 18" /></>,
  instalar: <><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M12 7.5v7M9 11.5l3 3 3-3" /></>,
  externo: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>,
}

export type NomeIcone = keyof typeof caminhos

export function Icone({ nome, tamanho = 24, rotulo, ...resto }: { nome: string; tamanho?: number; rotulo?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rotulo ? undefined : true}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      focusable="false"
      {...resto}
    >
      {caminhos[nome] ?? caminhos.floco}
    </svg>
  )
}

export const ICONE_SERVICO: Record<string, string> = {
  instalacao: 'instalacao',
  limpeza: 'limpeza',
  manutencao: 'manutencao',
  'carga-gas': 'gas',
  orcamento: 'orcamento',
}
export const iconeServico = (id: string) => ICONE_SERVICO[id] ?? 'floco'
