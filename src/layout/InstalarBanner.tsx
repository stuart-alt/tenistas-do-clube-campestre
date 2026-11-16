import { useEffect, useState } from 'react'
import { detectarPlataforma, estaInstalado } from '../lib/plataforma'

const CHAVE = 'instalar-banner-dispensado'

type EventoInstalacao = Event & { prompt(): Promise<void> }

function jaDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

export default function InstalarBanner() {
  const [dispensado, setDispensado] = useState(jaDispensado)
  const [evento, setEvento] = useState<EventoInstalacao | null>(null)
  const plataforma = detectarPlataforma(navigator.userAgent)

  useEffect(() => {
    const aoReceber = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstalacao)
    }
    window.addEventListener('beforeinstallprompt', aoReceber)
    return () => window.removeEventListener('beforeinstallprompt', aoReceber)
  }, [])

  if (dispensado || estaInstalado()) return null
  if (plataforma === 'outro' || (plataforma === 'android' && !evento)) return null

  function dispensar() {
    try {
      localStorage.setItem(CHAVE, '1')
    } catch {
      // sem armazenamento: o aviso some só nesta visita
    }
    setDispensado(true)
  }

  return (
    <div className="flex items-center gap-3 bg-green-50 px-4 py-3 text-sm">
      <div className="flex-1">
        {plataforma === 'ios' ? (
          <p>
            Instale o app: toque em <strong>Compartilhar</strong> e depois em{' '}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        ) : (
          <p>Instale o app no seu celular.</p>
        )}
      </div>
      {plataforma === 'android' && evento && (
        <button
          type="button"
          className="rounded bg-green-800 px-3 py-1 font-semibold text-white"
          onClick={() => void evento.prompt()}
        >
          Instalar app
        </button>
      )}
      <button type="button" className="text-gray-600 underline" onClick={dispensar}>
        Agora não
      </button>
    </div>
  )
}
