export default function Avatar({
  url,
  nome,
  tamanho = 'h-16 w-16',
}: {
  url: string | null
  nome: string
  tamanho?: string
}) {
  return url ? (
    <img src={url} alt="" className={`${tamanho} rounded-full object-cover`} />
  ) : (
    <span className={`${tamanho} flex items-center justify-center rounded-full bg-green-800 font-bold text-white`}>
      {nome[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
