import { recortarImagem } from './recortar'

const drawImage = vi.fn()
let blobSaida: Blob | null = null

beforeEach(() => {
  drawImage.mockReset()
  blobSaida = new Blob(['x'], { type: 'image/jpeg' })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blobSaida))
})
afterEach(() => vi.restoreAllMocks())

describe('recortarImagem', () => {
  it('desenha a area escolhida num canvas 512x512 e devolve um Blob', async () => {
    const fonte = { width: 2000, height: 1000 } as ImageBitmap
    const blob = await recortarImagem(fonte, { x: 100, y: 50, width: 800, height: 800 })
    expect(drawImage).toHaveBeenCalledWith(fonte, 100, 50, 800, 800, 0, 0, 512, 512)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('rejeita quando toBlob devolve null', async () => {
    blobSaida = null
    await expect(
      recortarImagem({ width: 10, height: 10 } as ImageBitmap, { x: 0, y: 0, width: 10, height: 10 }),
    ).rejects.toThrow()
  })
})
