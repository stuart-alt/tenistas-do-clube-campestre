export function detectarPlataforma(ua: string, maxTouchPoints = 0): 'ios' | 'android' | 'outro' {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPadOS se apresenta como Macintosh; só ele tem tela de toque
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  // tablets Android no modo "site para computador" omitem Android do UA
  if (/Linux/i.test(ua) && maxTouchPoints > 1) return 'android'
  return 'outro'
}

export function estaInstalado(): boolean {
  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const standalone =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return standalone || standaloneIos
}
