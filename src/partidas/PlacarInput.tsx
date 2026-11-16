export type SetPlacar = { l1: number; l2: number; stb: boolean }

const CLASSE_NUM = 'w-16 rounded border border-gray-300 px-2 py-1 text-center'

export default function PlacarInput({
  valor,
  onChange,
}: {
  valor: SetPlacar[]
  onChange: (v: SetPlacar[]) => void
}) {
  const alterar = (i: number, parte: Partial<SetPlacar>) =>
    onChange(valor.map((s, j) => (j === i ? { ...s, ...parte } : s)))
  const num = (v: string) => Math.max(0, Math.min(99, Math.trunc(Number(v)) || 0))

  return (
    <div className="space-y-3">
      {valor.map((s, i) => {
        const ultimo = i === valor.length - 1
        return (
          <div key={i} className="rounded border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <span className="w-12 text-sm font-medium">Set {i + 1}</span>
              <input
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                aria-label={`Set ${i + 1} - games do lado 1`}
                className={CLASSE_NUM}
                value={s.l1}
                onChange={(e) => alterar(i, { l1: num(e.target.value) })}
              />
              <span aria-hidden>x</span>
              <input
                type="number"
                min={0}
                max={99}
                inputMode="numeric"
                aria-label={`Set ${i + 1} - games do lado 2`}
                className={CLASSE_NUM}
                value={s.l2}
                onChange={(e) => alterar(i, { l2: num(e.target.value) })}
              />
              {valor.length > 1 && ultimo && (
                <button
                  type="button"
                  className="ml-auto text-sm text-red-700"
                  onClick={() => onChange(valor.slice(0, -1).map((s, i, a) => (i === a.length - 1 ? s : { ...s, stb: false })))}
                >
                  Remover set
                </button>
              )}
            </div>
            {ultimo && i > 0 && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.stb}
                  onChange={(e) => alterar(i, { stb: e.target.checked })}
                />
                Super tie-break
              </label>
            )}
          </div>
        )
      })}
      <button
        type="button"
        disabled={valor.length >= 3}
        className="rounded border border-green-800 px-3 py-1 text-sm font-medium text-green-800 disabled:opacity-50"
        onClick={() => onChange([...valor.map((s) => ({ ...s, stb: false })), { l1: 0, l2: 0, stb: false }])}
      >
        + set
      </button>
    </div>
  )
}
