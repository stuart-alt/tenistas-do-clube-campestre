import { useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { traduzirErro } from '../lib/erros'
import { carregarImagem, recortarImagem, type AreaRecorte, type ImagemCarregada } from './recortar'
import RecorteFoto from './RecorteFoto'

export default function FotoUpload({ onEnviada }: { onEnviada: (url: string) => void }) {
  const { session } = useAuth()
  const [imagem, setImagem] = useState<ImagemCarregada | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const arquivo = input.files?.[0]
    input.value = ''
    if (!arquivo || !session?.user.id) return
    setErro(null)
    try {
      setImagem(await carregarImagem(arquivo))
    } catch (err) {
      setErro(traduzirErro(err))
    }
  }

  function fechar() {
    imagem?.liberar()
    setImagem(null)
    setErro(null)
  }

  async function usar(area: AreaRecorte) {
    const uid = session?.user.id
    if (!imagem || !uid) return
    setErro(null)
    setEnviando(true)
    try {
      const blob = await recortarImagem(imagem.fonte, area)
      const caminho = `${uid}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      onEnviada(supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl)
      fechar()
    } catch (err) {
      setErro(traduzirErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <label className="inline-block cursor-pointer rounded border border-green-800 px-3 py-1 text-sm text-green-800">
        Trocar foto
        <input type="file" accept="image/*" className="hidden" onChange={escolher} />
      </label>
      {erro && !imagem && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {erro}
        </p>
      )}
      {imagem && (
        <RecorteFoto url={imagem.url} enviando={enviando} erro={erro} onCancelar={fechar} onConfirmar={usar} />
      )}
    </div>
  )
}
