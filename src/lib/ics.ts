// Gera um arquivo .ics para "Adicionar à agenda".
const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/[\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n')

export function baixarIcs(o: { id: string; titulo: string; inicio: string; fim: string; local: string; descricao: string }) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vini Climatizacao//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${o.id}@vini-climatizacao`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(o.inicio)}`,
    `DTEND:${fmt(o.fim)}`,
    `SUMMARY:${esc(o.titulo)}`,
    `LOCATION:${esc(o.local)}`,
    `DESCRIPTION:${esc(o.descricao)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(o.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'vini-climatizacao.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
