import { DIAS, PERIODOS, ROTULO_DIA, ROTULO_PERIODO, slot } from '../lib/disponibilidade'

type Props = { valor: string[]; onChange?: (v: string[]) => void }

export default function GradeDisponibilidade({ valor, onChange }: Props) {
  function alternar(s: string) {
    onChange?.(valor.includes(s) ? valor.filter((x) => x !== s) : [...valor, s])
  }
  return (
    <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1 text-center text-sm">
      <span />
      {PERIODOS.map((p) => (
        <span key={p} className="font-medium">
          {ROTULO_PERIODO[p]}
        </span>
      ))}
      {DIAS.map((d) => (
        <div key={d} className="contents">
          <span className="self-center pr-2 text-left font-medium">{ROTULO_DIA[d]}</span>
          {PERIODOS.map((p) => {
            const s = slot(d, p)
            const marcado = valor.includes(s)
            const cor = marcado ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-400'
            return onChange ? (
              <button
                key={s}
                type="button"
                aria-label={`${ROTULO_DIA[d]} / ${ROTULO_PERIODO[p]}`}
                aria-pressed={marcado}
                onClick={() => alternar(s)}
                className={`rounded py-2 ${cor}`}
              >
                {marcado ? '✓' : ''}
              </button>
            ) : (
              <span key={s} className={`rounded py-2 ${cor}`}>
                {marcado ? '✓' : '·'}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
