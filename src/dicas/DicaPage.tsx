import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ORDEM_PAGINAS, tituloDaPagina } from './indice'

const base = import.meta.env.BASE_URL

export default function DicaPage() {
  const { pagina } = useParams()
  const navigate = useNavigate()
  const [ampliada, setAmpliada] = useState(false)
  const n = /^\d+$/.test(pagina ?? '') ? Number(pagina) : NaN
  const pos = ORDEM_PAGINAS.indexOf(n)

  if (pos < 0) {
    return (
      <div className="space-y-2">
        <p>Dica não encontrada</p>
        <Link to="/dicas" className="text-green-800 underline">
          Voltar ao índice
        </Link>
      </div>
    )
  }

  const anterior = ORDEM_PAGINAS[pos - 1]
  const proxima = ORDEM_PAGINAS[pos + 1]
  const titulo = tituloDaPagina(n)
  const botao = 'rounded border px-3 py-2 text-sm disabled:opacity-40'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Link to="/dicas" className="text-sm text-green-800 underline">
          ‹ Índice
        </Link>
        <h2 className="flex-1 truncate font-bold">{titulo}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={botao}
          disabled={anterior === undefined}
          onClick={() => navigate(`/dicas/${anterior}`)}
        >
          ‹ Anterior
        </button>
        <button
          type="button"
          className={botao}
          disabled={proxima === undefined}
          onClick={() => navigate(`/dicas/${proxima}`)}
        >
          Próxima ›
        </button>
        <button type="button" className={`${botao} ml-auto`} onClick={() => setAmpliada((a) => !a)}>
          {ampliada ? 'Reduzir' : 'Ampliar'}
        </button>
      </div>
      <div className="overflow-x-auto rounded border">
        <img
          src={`${base}dicas/pagina-${String(n).padStart(2, '0')}.png`}
          alt={titulo}
          loading="lazy"
          className="max-w-none"
          style={{ width: ampliada ? '200%' : '100%' }}
        />
      </div>
    </div>
  )
}
