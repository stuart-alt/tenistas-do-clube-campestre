export type EventoInstalacao = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalacao | null = null
const ouvintes = new Set<() => void>()

function avisar() {
  ouvintes.forEach((cb) => cb())
}

// Registrado na importação: o Chrome pode disparar o evento antes do React montar.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    evento = e as EventoInstalacao
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    avisar()
  })
}

export function obterEventoInstalacao(): EventoInstalacao | null {
  return evento
}

// Usado após consumir o evento (que só vale uma vez) e para reiniciar o estado nos testes.
export function limparEventoInstalacao(): void {
  evento = null
  avisar()
}

export function aoMudarEventoInstalacao(cb: () => void): () => void {
  ouvintes.add(cb)
  return () => {
    ouvintes.delete(cb)
  }
}
