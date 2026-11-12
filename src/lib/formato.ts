export const soDigitos = (s: string) => s.replace(/\D/g, '')

/** Guarda o WhatsApp sempre com o código do país (55). */
export function normalizarWhats(w: string): string {
  const d = soDigitos(w)
  if (d.length === 10 || d.length === 11) return '55' + d
  return d
}

/** (71) 98888-1111 */
export function formatarWhats(w: string): string {
  let d = soDigitos(w)
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return w
}

/** Máscara enquanto digita. */
export function mascaraWhats(v: string): string {
  const d = soDigitos(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function precoTexto(v: number | null): string {
  return v == null ? 'Sob orçamento' : `A partir de ${moeda(v)}`
}

export const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? ''

export function enderecoTexto(e: { rua: string; numero: string; bairro: string; complemento?: string; cidade?: string }): string {
  const cidade = e.cidade && e.cidade.trim().toLowerCase() !== 'salvador' ? e.cidade : ''
  return [`${e.rua}${e.numero ? ', ' + e.numero : ''}`, e.complemento, e.bairro, cidade].filter(Boolean).join(' · ')
}

export function aparelhoTexto(a: { tipo: string; marca: string; btus: number | null } | null): string {
  if (!a) return 'Não informado'
  return [a.tipo, a.marca, a.btus ? `${(a.btus / 1000).toLocaleString('pt-BR')} mil BTUs` : ''].filter(Boolean).join(' · ')
}

export function linkMapa(e: { rua: string; numero: string; bairro: string; cidade?: string }): string {
  const q = `${e.rua}, ${e.numero}, ${e.bairro}, ${e.cidade || 'Salvador'} - BA`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
