import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlacarInput, { type SetPlacar } from './PlacarInput'

function Wrapper() {
  const [v, setV] = useState<SetPlacar[]>([{ l1: 0, l2: 0, stb: false }])
  return <PlacarInput valor={v} onChange={setV} />
}

test('começa com 1 set e permite até 3', async () => {
  render(<Wrapper />)
  expect(screen.getAllByText(/^Set \d$/)).toHaveLength(1)
  const mais = screen.getByRole('button', { name: '+ set' })
  await userEvent.click(mais)
  await userEvent.click(mais)
  expect(screen.getAllByText(/^Set \d$/)).toHaveLength(3)
  expect(mais).toBeDisabled()
})

test('super tie-break aparece só no último set', async () => {
  render(<Wrapper />)
  expect(screen.queryByLabelText('Super tie-break')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: '+ set' }))
  expect(screen.getAllByLabelText('Super tie-break')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: '+ set' }))
  expect(screen.getAllByLabelText('Super tie-break')).toHaveLength(1)
})

test('ao adicionar set, só o último pode ter super tie-break', async () => {
  const onChange = vi.fn()
  render(
    <PlacarInput
      valor={[
        { l1: 6, l2: 4, stb: false },
        { l1: 1, l2: 0, stb: true },
      ]}
      onChange={onChange}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: '+ set' }))
  const v = onChange.mock.calls[0][0] as SetPlacar[]
  expect(v).toHaveLength(3)
  expect(v.slice(0, -1).every((s) => !s.stb)).toBe(true)
})

test('ao focar um campo de games, o conteúdo é selecionado e digitar substitui o 0', async () => {
  const onChange = vi.fn()
  render(<PlacarInput valor={[{ l1: 0, l2: 0, stb: false }]} onChange={onChange} />)
  const campo = screen.getByLabelText('Set 1 - games do lado 1') as HTMLInputElement
  expect(campo).toHaveAttribute('inputmode', 'numeric')
  expect(campo).toHaveAttribute('pattern', '[0-9]*')
  await userEvent.click(campo)
  expect(campo.selectionStart).toBe(0)
  expect(campo.selectionEnd).toBe(1)
  await userEvent.keyboard('6')
  expect(onChange).toHaveBeenLastCalledWith([{ l1: 6, l2: 0, stb: false }])
})

test('não mantém zero à esquerda no valor exibido', async () => {
  render(<Wrapper />)
  const campo = screen.getByLabelText('Set 1 - games do lado 1') as HTMLInputElement
  fireEvent.change(campo, { target: { value: '06' } })
  expect(campo.value).toBe('6')
})
