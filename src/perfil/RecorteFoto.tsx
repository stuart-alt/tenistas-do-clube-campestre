import { useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { AreaRecorte } from './recortar'

type Props = {
  url: string
  enviando: boolean
  erro: string | null
  onCancelar: () => void
  onConfirmar: (area: AreaRecorte) => void
}

export default function RecorteFoto({ url, enviando, erro, onCancelar, onConfirmar }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<AreaRecorte | null>(null)

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar foto"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between gap-3 overflow-hidden bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="relative mx-auto my-auto aspect-square w-[min(90vw,70vh)] shrink-0 overflow-hidden bg-black">
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={4}
          aspect={1}
          cropShape="rect"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border border-white/50"
        />
      </div>
      <div className="flex w-full max-w-md flex-col gap-3">
        <label className="flex items-center gap-3 text-sm text-white">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
        </label>
        {erro && (
          <p role="alert" className="rounded bg-white p-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="flex-1 rounded border border-white px-3 py-2 text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => area && onConfirmar(area)}
            disabled={enviando || !area}
            className="flex-1 rounded bg-green-700 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Usar foto'}
          </button>
        </div>
      </div>
    </div>
  )
}
