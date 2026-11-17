export async function svgParaPng(svg: SVGSVGElement, largura = 1500): Promise<Blob> {
  const altura = Math.round((largura * 7) / 5)
  const xml = new XMLSerializer().serializeToString(svg)
  const img = new Image()
  img.width = largura
  img.height = altura
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao carregar o SVG'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  })
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(img, 0, 0, largura, altura)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG'))), 'image/png')
  })
}

export async function fotoComoDataUrl(url: string): Promise<string | undefined> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return undefined
    const blob = await resp.blob()
    return await new Promise<string | undefined>((resolve) => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(typeof leitor.result === 'string' ? leitor.result : undefined)
      leitor.onerror = () => resolve(undefined)
      leitor.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export async function compartilharOuBaixar(blob: Blob, nomeArquivo: string): Promise<void> {
  const file = new File([blob], nomeArquivo, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Meu card – Tenistas do Campestre' })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
