import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import InstalarBanner from '../layout/InstalarBanner'

export const CLASSE_INPUT =
  'w-full rounded border border-gray-300 px-3 py-2 focus:border-green-700 focus:outline-none'
export const CLASSE_BOTAO =
  'w-full rounded bg-green-800 px-4 py-2 font-semibold text-white disabled:opacity-50'

export function Campo({ rotulo, ...props }: { rotulo: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {rotulo}
      </label>
      <input id={id} className={CLASSE_INPUT} {...props} />
    </div>
  )
}

export function CartaoAuth({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <InstalarBanner />
      <main className="mx-auto max-w-sm p-6">
        <h1 className="mb-6 text-2xl font-bold text-green-800">{titulo}</h1>
        {children}
      </main>
    </div>
  )
}
