const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const dois = (n: number) => String(n).padStart(2, '0')

export function mensagemConvite(
  sala: { id: string; modalidade: 'simples' | 'duplas'; data_hora: string; vagasLivres: number },
  urlBase: string,
): string {
  const d = new Date(sala.data_hora)
  const minutos = d.getMinutes() === 0 ? '' : dois(d.getMinutes())
  const quando = `${DIAS[d.getDay()]}, ${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}h${minutos}`
  const falta =
    sala.vagasLivres === 1 ? 'Falta 1 vaga.' : `Faltam ${sala.vagasLivres} vagas.`
  return [
    `🎾 Bora jogar? Sala de ${sala.modalidade} – ${quando}`,
    `${falta} Entre pelo link e garanta a sua:`,
    `${urlBase}salas/${sala.id}`,
  ].join('\n')
}
