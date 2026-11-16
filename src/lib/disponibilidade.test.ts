import { emComum, slot } from './disponibilidade'

test('slot monta a chave dia_periodo', () => {
  expect(slot('seg', 'noite')).toBe('seg_noite')
})

test('emComum conta slots iguais', () => {
  expect(emComum(['seg_noite', 'sab_manha'], ['sab_manha', 'dom_manha'])).toBe(1)
})
