import { aoMudarEventoInstalacao, __reiniciarInstalacaoParaTestes, obterEventoInstalacao } from './instalacao'

function disparar(nome: string) {
  const ev = new Event(nome, { cancelable: true })
  window.dispatchEvent(ev)
  return ev
}

afterEach(() => __reiniciarInstalacaoParaTestes())

test('guarda o beforeinstallprompt e chama preventDefault', () => {
  expect(obterEventoInstalacao()).toBeNull()
  const ev = disparar('beforeinstallprompt')
  expect(ev.defaultPrevented).toBe(true)
  expect(obterEventoInstalacao()).toBe(ev)
})

test('appinstalled limpa o evento', () => {
  disparar('beforeinstallprompt')
  disparar('appinstalled')
  expect(obterEventoInstalacao()).toBeNull()
})

test('avisa quem assinou e para de avisar após cancelar', () => {
  const cb = vi.fn()
  const cancelar = aoMudarEventoInstalacao(cb)
  disparar('beforeinstallprompt')
  expect(cb).toHaveBeenCalledTimes(1)
  cancelar()
  disparar('appinstalled')
  expect(cb).toHaveBeenCalledTimes(1)
})
