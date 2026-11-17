import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { CLASSE_BOTAO, Campo } from '../auth/Campo'

export type Regra = {
  modalidade: string
  pts_vitoria: number | string
  pts_set: number | string
  pts_game: number | string
  bonus_pct: number | string
  bonus_teto: number | string
  janela_meses: number | string
  max_partidas_semana: number | string
}

export default function RegrasForm({ regra }: { regra: Regra }) {
  const qc = useQueryClient()
  const [v, setV] = useState({
    pts_vitoria: String(Number(regra.pts_vitoria)),
    pts_set: String(Number(regra.pts_set)),
    pts_game: String(Number(regra.pts_game)),
    bonus_pct: String(Math.round(Number(regra.bonus_pct) * 100)),
    bonus_teto: String(Number(regra.bonus_teto)),
    janela_meses: String(Number(regra.janela_meses)),
    max_partidas_semana: String(Number(regra.max_partidas_semana)),
  })
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const nome = regra.modalidade === 'duplas' ? 'duplas' : 'simples'

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('atualizar_regras', {
        p_modalidade: regra.modalidade,
        p_pts_vitoria: Number(v.pts_vitoria),
        p_pts_set: Number(v.pts_set),
        p_pts_game: Number(v.pts_game),
        p_bonus_pct: Math.round(Number(v.bonus_pct)) / 100,
        p_bonus_teto: Number(v.bonus_teto),
        p_janela_meses: Number(v.janela_meses),
        p_max_partidas_semana: Number(v.max_partidas_semana),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setErro('')
      setMsg('Regras salvas.')
      void qc.invalidateQueries({ queryKey: ['regras'] })
      void qc.invalidateQueries({ queryKey: ['ranking'] })
      void qc.invalidateQueries({ queryKey: ['partidas'] })
    },
    onError: (e) => {
      setMsg('')
      setErro(traduzirErro(e))
    },
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!window.confirm(`Isso vai recalcular todo o ranking de ${nome}. Continuar?`)) return
    salvar.mutate()
  }
  const campo = (rotulo: string, chave: keyof typeof v) => (
    <Campo
      rotulo={rotulo}
      type="number"
      min={0}
      step="any"
      value={v[chave]}
      onChange={(e) => setV({ ...v, [chave]: e.target.value })}
    />
  )

  return (
    <form onSubmit={enviar} className="space-y-3 rounded border border-gray-200 p-3">
      <h3 className="font-semibold capitalize">{nome}</h3>
      {campo('Pontos por vitória', 'pts_vitoria')}
      {campo('Pontos por set', 'pts_set')}
      {campo('Pontos por game', 'pts_game')}
      {campo('Bônus (%)', 'bonus_pct')}
      {campo('Teto do bônus', 'bonus_teto')}
      {campo('Janela (meses)', 'janela_meses')}
      {campo('Partidas por semana que contam no ranking (0 = sem limite)', 'max_partidas_semana')}
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      {msg && <p className="text-sm text-green-800">{msg}</p>}
      <button type="submit" disabled={salvar.isPending} className={CLASSE_BOTAO}>
        Salvar
      </button>
    </form>
  )
}
