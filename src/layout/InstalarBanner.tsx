import { useEffect, useState, useSyncExternalStore } from 'react'
import { detectarPlataforma, estaInstalado } from '../lib/plataforma'
import {
  aoMudarEventoInstalacao,
  limparEventoInstalacao,
  obterEventoInstalacao,
} from '../lib/instalacao'

const CHAVE = 'instalar-banner-dispensado'

function jaDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

export default function InstalarBanner() {
  const [dispensado, setDispensado] = useState(jaDispensado)
  const [esperou, setEsperou] = useState(false)
  const evento = useSyncExternalStore(aoMudarEventoInstalacao, obterEventoInstalacao)
  const plataforma = detectarPlataforma(navigator.userAgent, navigator.maxTouchPoints)
  const safariIos = !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent)

  useEffect(() => {
    if (plataforma !== 'android' || evento) return
    const t = setTimeout(() => setEsperou(true), 4000)
    return () => clearTimeout(t)
  }, [plataforma, evento])

  if (dispensado || estaInstalado()) return null
  if (!evento && (plataforma === 'outro' || (plataforma === 'android' && !esperou))) return null

  function dispensar() {
    try {
      localStorage.setItem(CHAVE, '1')
    } catch {
      // sem armazenamento: o aviso some só nesta visita
    }
    setDispensado(true)
  }

  async function instalar() {
    if (!evento) return
    try {
      await evento.prompt()
      await evento.userChoice
    } finally {
      // o evento só vale uma vez; esconde o aviso nesta visita
      limparEventoInstalacao()
    }
  }

  return (
    <div className="flex items-center gap-3 bg-green-50 px-4 py-3 text-sm">
      <div className="flex-1">
        {evento ? (
          <p>Instale o app</p>
        ) : plataforma === 'ios' && !safariIos ? (
          <p>Para instalar, abra este link no Safari.</p>
        ) : plataforma === 'ios' ? (
          <p>
            Instale o app: toque em <strong>Compartilhar</strong> e depois em{' '}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        ) : (
          <p>
            Para instalar: abra o menu do navegador (⋮ ou ☰) e escolha "Instalar app" ou "Adicionar à
            tela inicial".
          </p>
        )}
      </div>
      {evento && (
        <button
          type="button"
          className="rounded bg-green-800 px-3 py-1 font-semibold text-white"
          onClick={() => void instalar()}
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
