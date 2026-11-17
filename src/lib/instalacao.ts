export type EventoInstalacao = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalacao | null = null
let concluida = false
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
    concluida = true
    avisar()
  })
}

export function obterEventoInstalacao(): EventoInstalacao | null {
  return evento
}

// Consome o evento (que só vale uma vez).
export function limparEventoInstalacao(): void {
  evento = null
  avisar()
}

// Tentativa de instalação terminada nesta visita (aceita, recusada, falhou ou appinstalled).
export function instalacaoConcluida(): boolean {
  return concluida
}

export function concluirInstalacao(): void {
  concluida = true
  evento = null
  avisar()
}

// Somente para testes.
export function __reiniciarInstalacaoParaTestes(): void {
  evento = null
  concluida = false
  avisar()
}

export function aoMudarEventoInstalacao(cb: () => void): () => void {
  ouvintes.add(cb)
  return () => {
    ouvintes.delete(cb)
  }
}
