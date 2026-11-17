import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FotoUpload from './FotoUpload'

const upload = vi.hoisted(() => vi.fn())
const recortarImagem = vi.hoisted(() => vi.fn())
const carregarImagem = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload,
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }),
      }),
    },
  },
}))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}))
vi.mock('./recortar', () => ({ recortarImagem, carregarImagem }))
vi.mock('react-easy-crop', async () => {
  const React = await import('react')
  return {
    default: ({ onCropComplete }: { onCropComplete: (a: unknown, p: unknown) => void }) => {
      React.useEffect(() => {
        onCropComplete({}, { x: 1, y: 2, width: 300, height: 300 })
      }, [])
      return <div data-testid="cropper" />
    },
  }
})

beforeEach(() => {
  upload.mockReset()
  recortarImagem.mockReset()
  carregarImagem.mockReset()
  carregarImagem.mockResolvedValue({ fonte: { width: 1, height: 1 }, url: 'blob:x', liberar: () => {} })
  recortarImagem.mockResolvedValue(new Blob(['x']))
  upload.mockResolvedValue({ error: null })
})

async function escolher(onEnviada = vi.fn()) {
  const user = userEvent.setup()
  const { container } = render(<FotoUpload onEnviada={onEnviada} />)
  const input = container.querySelector('input[type=file]') as HTMLInputElement
  await user.upload(input, new File(['a'], 'a.png', { type: 'image/png' }))
  return { user, onEnviada, input }
}

describe('FotoUpload', () => {
  it('escolher arquivo abre o dialogo sem enviar', async () => {
    await escolher()
    expect(await screen.findByRole('dialog', { name: 'Ajustar foto' })).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
  })

  it('Cancelar fecha sem enviar', async () => {
    const { user } = await escolher()
    await screen.findByRole('dialog', { name: 'Ajustar foto' })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
  })

  it('Usar foto envia o recorte e chama onEnviada', async () => {
    const { user, onEnviada } = await escolher()
    await screen.findByRole('dialog', { name: 'Ajustar foto' })
    await user.click(screen.getByRole('button', { name: 'Usar foto' }))
    await waitFor(() => expect(onEnviada).toHaveBeenCalled())
    expect(recortarImagem).toHaveBeenCalledWith(expect.anything(), { x: 1, y: 2, width: 300, height: 300 })
    expect(upload.mock.calls[0][0]).toMatch(/^u1\/\d+\.jpg$/)
    expect(onEnviada.mock.calls[0][0]).toMatch(/^https:\/\/cdn\/u1\/\d+\.jpg$/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('erro de envio aparece dentro do dialogo', async () => {
    upload.mockResolvedValue({ error: { message: 'x' } })
    const { user, onEnviada } = await escolher()
    const dialogo = await screen.findByRole('dialog', { name: 'Ajustar foto' })
    await user.click(screen.getByRole('button', { name: 'Usar foto' }))
    const alerta = await screen.findByRole('alert')
    expect(dialogo).toContainElement(alerta)
    expect(onEnviada).not.toHaveBeenCalled()
  })
})
