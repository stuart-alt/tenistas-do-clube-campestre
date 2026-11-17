import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import EditarPerfilPage from './EditarPerfilPage'

const eq = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (v: unknown) => {
        update(v)
        return { eq }
      },
    }),
  },
}))
let admin = false
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    perfil: { id: 'eu-123', is_admin: admin, nome: 'Ana', telefone: '11987654321', data_nascimento: '1990-05-20', disponibilidade: [] },
    recarregarPerfil: async () => {},
  }),
}))

function montar() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EditarPerfilPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  admin = false
  update.mockReset()
  eq.mockReset()
  eq.mockResolvedValue({ error: null })
})

test('tem link para ver o próprio perfil', () => {
  montar()
  expect(screen.getByRole('link', { name: 'Ver meu perfil' })).toHaveAttribute('href', '/jogadores/eu-123')
})

test('telefone inválido mostra erro e não salva', async () => {
  montar()
  const campo = screen.getByLabelText('Telefone (WhatsApp)')
  await userEvent.clear(campo)
  await userEvent.type(campo, '(11) 3333-4444')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(update).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('Informe um celular com DDD, ex.: (11) 98765-4321')
})

test('telefone válido formatado é salvo normalizado', async () => {
  montar()
  const campo = screen.getByLabelText('Telefone (WhatsApp)')
  await userEvent.clear(campo)
  await userEvent.type(campo, '+55 (21) 98765-4321')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ telefone: '21987654321' }))
})

test('jogador vê link Fale com o administrador', () => {
  montar()
  expect(screen.getByRole('link', { name: 'Fale com o administrador' })).toHaveAttribute('href', '/contato')
})

test('administrador não vê link Fale com o administrador', () => {
  admin = true
  montar()
  expect(screen.queryByRole('link', { name: 'Fale com o administrador' })).toBeNull()
})
