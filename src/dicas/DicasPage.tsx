import { Link } from 'react-router-dom'
import { SECOES, PAGINA_FONTES } from './indice'

const base = import.meta.env.BASE_URL

export default function DicasPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-bold">Dicas</h2>
      <Link to="/dicas/1" aria-label="Abrir a capa">
        <img
          src={`${base}dicas/pagina-01.png`}
          alt="Capa: Padrões de Jogo"
          className="mx-auto w-40 rounded border shadow-sm"
        />
      </Link>
      {SECOES.map((s) => (
        <section key={s.titulo} className="overflow-hidden rounded border">
          {s.pagina ? (
            <Link
              to={`/dicas/${s.pagina}`}
              style={{ backgroundColor: s.cor }}
              className="block px-3 py-2 font-bold text-white"
            >
              {s.titulo}
            </Link>
          ) : (
            <h3 style={{ backgroundColor: s.cor }} className="px-3 py-2 font-bold text-white">
              {s.titulo}
            </h3>
          )}
          <ul className="divide-y">
            {s.itens.map((it) => (
              <li key={it.pagina}>
                <Link to={`/dicas/${it.pagina}`} className="flex gap-3 px-3 py-3 text-sm">
                  <span className="w-8 shrink-0 font-bold" style={{ color: s.cor }}>
                    {it.numero}
                  </span>
                  <span>{it.titulo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link to={`/dicas/${PAGINA_FONTES}`} className="block rounded border px-3 py-3 text-sm">
        Fontes e leituras
      </Link>
    </div>
  )
}
