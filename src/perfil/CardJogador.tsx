import { forwardRef, useId } from 'react'
import { corDaCategoria, melhorRanking, notasDoJogador, type Categoria, type LinhaRanking } from './card'

export type PerfilCard = {
  id: string
  nome: string
  categoria: string | null
  foto_url: string | null
  forehand: number
  backhand: number
  saque: number
  voleio: number
  velocidade: number
  resistencia: number
}

const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
const FILAS = [
  ['FOR', 'BAC', 'SAQ'],
  ['VOL', 'VEL', 'RES'],
] as const

function nomeCurto(nome: string) {
  return nome.length > 22 ? `${nome.slice(0, 21).trimEnd()}…` : nome
}

const CardJogador = forwardRef<SVGSVGElement, { perfil: PerfilCard; ranking: LinhaRanking[]; fotoDataUrl?: string; semFoto?: boolean }>(
  function CardJogador({ perfil, ranking, fotoDataUrl, semFoto }, ref) {
    const uid = useId().replace(/:/g, '')
    const cat = (['A', 'B', 'C', 'D'].includes(perfil.categoria ?? '') ? perfil.categoria : 'D') as Categoria
    const cor = corDaCategoria(cat)
    const notas = notasDoJogador(perfil)
    const foto = semFoto ? null : (fotoDataUrl ?? perfil.foto_url)
    // Retângulo arredondado com um canto superior esquerdo chanfrado.
    const forma = 'M 70 0 H 680 A 70 70 0 0 1 750 70 V 980 A 70 70 0 0 1 680 1050 H 70 A 70 70 0 0 1 0 980 V 150 Z'
    const iniciais = perfil.nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 750 1050"
        role="img"
        aria-label={`Card de ${perfil.nome}`}
        style={{ fontFamily: FONTE }}
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={cor.de} />
            <stop offset="1" stopColor={cor.ate} />
          </linearGradient>
          <clipPath id={`c${uid}`}>
            <path d={forma} />
          </clipPath>
          <clipPath id={`f${uid}`}>
            <rect x="185" y="260" width="380" height="380" rx="36" />
          </clipPath>
        </defs>
        <path d={forma} fill={`url(#g${uid})`} />
        <g clipPath={`url(#c${uid})`} fill="none" stroke={cor.destaque} strokeOpacity="0.35" strokeWidth="26">
          <path d="M -80 760 C 200 560 420 700 830 420" />
          <path d="M -80 1010 C 220 800 460 930 830 690" />
        </g>
        <path d={forma} fill="none" stroke={cor.texto} strokeOpacity="0.45" strokeWidth="6" />

        <text x="60" y="190" fontSize="130" fontWeight="800" fill={cor.texto} data-testid="nota-geral">
          {notas.geral}
        </text>
        <text x="62" y="240" fontSize="38" fontWeight="800" fill={cor.texto} letterSpacing="3">
          {`CAT ${cat}`}
        </text>
        <text x="690" y="70" fontSize="26" fontWeight="700" fill={cor.texto} textAnchor="end">
          Tenistas do Campestre
        </text>

        <rect x="185" y="260" width="380" height="380" rx="36" fill={cor.destaque} fillOpacity="0.5" />
        {foto ? (
          <image
            href={foto}
            x="185"
            y="260"
            width="380"
            height="380"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#f${uid})`}
          />
        ) : (
          <text x="375" y="450" fontSize="190" fontWeight="800" fill={cor.texto} textAnchor="middle" dominantBaseline="middle">
            {iniciais}
          </text>
        )}
        <rect x="185" y="260" width="380" height="380" rx="36" fill="none" stroke={cor.texto} strokeOpacity="0.5" strokeWidth="6" />

        <text x="375" y="715" fontSize={Math.min(58, Math.floor(560 / (Math.max(perfil.nome.length, 1) * 0.62)))} fontWeight="800" fill={cor.texto} textAnchor="middle">
          {nomeCurto(perfil.nome)}
        </text>
        <line x1="120" y1="740" x2="630" y2="740" stroke={cor.texto} strokeOpacity="0.5" strokeWidth="3" />

        {FILAS.map((fila, r) =>
          fila.map((k, c) => {
            const x = 175 + c * 200
            const y = 795 + r * 100
            return (
              <g key={k}>
                <text x={x} y={y} fontSize="32" fontWeight="700" fill={cor.texto} fillOpacity="0.8" textAnchor="middle">
                  {k}
                </text>
                <text x={x} y={y + 50} fontSize="54" fontWeight="800" fill={cor.texto} textAnchor="middle" data-testid={`nota-${k}`}>
                  {notas[k]}
                </text>
              </g>
            )
          }),
        )}

        <rect x="0" y="965" width="750" height="85" fill={cor.texto} fillOpacity="0.85" clipPath={`url(#c${uid})`} />
        <text x="375" y="1020" fontSize="34" fontWeight="700" fill={cor.destaque} textAnchor="middle">
          {melhorRanking(ranking)}
        </text>
      </svg>
    )
  },
)

export default CardJogador
