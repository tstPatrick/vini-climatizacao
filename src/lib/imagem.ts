// Reduz a foto antes de salvar (economiza dados e armazenamento).
export async function reduzirFoto(arquivo: File, maxLado = 1024, qualidade = 0.78): Promise<string> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error('Não foi possível abrir a foto.'))
      i.src = url
    })
    const r = Math.min(1, maxLado / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * r)
    c.height = Math.round(img.height * r)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', qualidade)
  } finally {
    URL.revokeObjectURL(url)
  }
}
