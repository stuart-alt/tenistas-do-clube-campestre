import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CadastroPage from './CadastroPage'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp: vi.fn() } },
}))

const signUp = vi.mocked(supabase.auth.signUp)

async function preencher(senha: string, telefone = '(11) 98765-4321') {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText('Nome'), 'Maria Silva')
  await u.type(screen.getByLabelText('Data de nascimento'), '1990-05-20')
  await u.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com')
  await u.type(screen.getByLabelText('Telefone (WhatsApp)'), telefone)
  await u.selectOptions(screen.getByLabelText('Gênero'), 'feminino')
  await u.selectOptions(screen.getByLabelText('Categoria'), 'B')
  await u.type(screen.getByLabelText('Senha'), senha)
  await u.click(screen.getByRole('button', { name: 'Cadastrar' }))
}

function montar(state?: unknown) {
  render(
    <MemoryRouter
      initialEntries={[{ pathname: '/cadastro', state }]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/salas/abc" element={<p>sala abc</p>} />
        <Route path="/" element={<p>inicio</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  signUp.mockReset()
  signUp.mockResolvedValue({ data: { user: null, session: null }, error: null } as never)
})

test('envia os dados do cadastro como metadata', async () => {
  montar()
  await preencher('segredo123')
  expect(signUp).toHaveBeenCalledWith({
    email: 'maria@exemplo.com',
    password: 'segredo123',
    options: {
      data: {
        nome: 'Maria Silva',
        data_nascimento: '1990-05-20',
        telefone: '11987654321',
        genero: 'feminino',
        categoria: 'B',
      },
    },
  })
})

test('senha curta mostra erro sem chamar o Supabase', async () => {
  montar()
  await preencher('123')
  expect(signUp).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('A senha deve ter pelo menos 6 caracteres.')
})

test('sem sessão após o cadastro, mostra mensagem em vez de navegar', async () => {
  montar()
  await preencher('segredo123')
  expect(await screen.findByText('Cadastro feito. Entre com seu e-mail e senha.')).toBeInTheDocument()
})

test('telefone inválido mostra erro e não chama o Supabase', async () => {
  montar()
  await preencher('segredo123', '(11) 3333-4444')
  expect(signUp).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('Informe um celular com DDD, ex.: (11) 98765-4321')
})

test('com sessão após o cadastro, volta para a página de origem', async () => {
  signUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null } as never)
  montar({ de: { pathname: '/salas/abc', search: '' } })
  await preencher('segredo123')
  expect(await screen.findByText('sala abc')).toBeInTheDocument()
})

test('com sessão e sem origem, vai para a raiz', async () => {
  signUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null } as never)
  montar()
  await preencher('segredo123')
  expect(await screen.findByText('inicio')).toBeInTheDocument()
})
