export function detectarPlataforma(ua: string): 'ios' | 'android' | 'outro' {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'outro'
}

export function estaInstalado(): boolean {
  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const standalone =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return standalone || standaloneIos
}
