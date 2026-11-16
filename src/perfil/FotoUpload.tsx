import { useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { traduzirErro } from '../lib/erros'

const MAX = 512

async function redimensionar(arquivo: File): Promise<Blob> {
  const img = await createImageBitmap(arquivo)
  const escala = Math.min(1, MAX / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error('imagem'))), 'image/jpeg', 0.85),
  )
}

export default function FotoUpload({ onEnviada }: { onEnviada: (url: string) => void }) {
  const { session } = useAuth()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    const uid = session?.user.id
    if (!arquivo || !uid) return
    setErro(null)
    setEnviando(true)
    try {
      const blob = await redimensionar(arquivo)
      const caminho = `${uid}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      onEnviada(supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl)
    } catch (err) {
      setErro(traduzirErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <label className="inline-block cursor-pointer rounded border border-green-800 px-3 py-1 text-sm text-green-800">
        {enviando ? 'Enviando...' : 'Trocar foto'}
        <input type="file" accept="image/*" className="hidden" disabled={enviando} onChange={escolher} />
      </label>
      {erro && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  )
}
