export type AreaRecorte = { x: number; y: number; width: number; height: number }
export type ImagemCarregada = {
  fonte: ImageBitmap | HTMLImageElement
  /** URL de objeto para exibir a imagem (ja com a orientacao EXIF aplicada pelo navegador). */
  url: string
  liberar: () => void
}

function carregarElemento(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => falha(new Error('imagem'))
    img.src = url
  })
}

/** Carrega o arquivo respeitando a orientacao EXIF; cai para <img> se o navegador nao suportar. */
export async function carregarImagem(arquivo: File): Promise<ImagemCarregada> {
  const url = URL.createObjectURL(arquivo)
  const liberar = () => URL.revokeObjectURL(url)
  try {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      return {
        fonte: bmp,
        url,
        liberar: () => {
          bmp.close?.()
          liberar()
        },
      }
    } catch {
      return { fonte: await carregarElemento(url), url, liberar }
    }
  } catch (e) {
    liberar()
    throw e
  }
}

export function recortarImagem(
  fonte: ImageBitmap | HTMLImageElement,
  area: AreaRecorte,
  tamanho = 512,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = tamanho
  canvas.height = tamanho
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('imagem'))
  ctx.drawImage(fonte, area.x, area.y, area.width, area.height, 0, 0, tamanho, tamanho)
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error('imagem'))), 'image/jpeg', 0.85),
  )
}
