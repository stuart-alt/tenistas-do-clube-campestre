import { linkWhatsApp } from './whatsapp'

test.each([
  ['(11) 98765-4321', 'https://wa.me/5511987654321'],
  ['+55 11 98765-4321', 'https://wa.me/5511987654321'],
  ['11987654321', 'https://wa.me/5511987654321'],
  ['5511987654321', 'https://wa.me/5511987654321'],
  ['1133334444', 'https://wa.me/551133334444'],
  ['123', null],
  ['', null],
])('linkWhatsApp(%j)', (entrada, esperado) => {
  expect(linkWhatsApp(entrada)).toBe(esperado)
})
