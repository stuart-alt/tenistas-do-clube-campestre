type Props = { valor: number; onChange?: (n: number) => void; rotulo: string }

export default function Estrelas({ valor, onChange, rotulo }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">{rotulo}</span>
      <span role="group" aria-label={rotulo} className="flex">
        {[1, 2, 3, 4, 5].map((n) => {
          const cheia = n <= valor
          const estrela = (
            <span className={cheia ? 'text-yellow-500' : 'text-gray-300'}>{cheia ? '★' : '☆'}</span>
          )
          return onChange ? (
            <button
              key={n}
              type="button"
              aria-label={`${rotulo} ${n}`}
              aria-pressed={n === valor}
              onClick={() => onChange(n)}
              className="px-0.5 text-2xl"
            >
              {estrela}
            </button>
          ) : (
            <span key={n} className="px-0.5 text-2xl">
              {estrela}
            </span>
          )
        })}
      </span>
    </div>
  )
}
