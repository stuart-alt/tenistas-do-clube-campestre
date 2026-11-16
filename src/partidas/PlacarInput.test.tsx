import { useState } from 'react'
import { render, screen } from '@testing-library/react'
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
