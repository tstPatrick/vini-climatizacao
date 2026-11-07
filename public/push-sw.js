// Notificações push (carregado pelo service worker do app).
self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { corpo: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.titulo || 'Vini Climatização', {
      body: d.corpo || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: d.tag,
      data: { url: d.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ('focus' in j) {
          j.navigate(url).catch(() => {})
          return j.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
