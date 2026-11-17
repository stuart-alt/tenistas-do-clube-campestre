// Gera public/dicas/pagina-NN.png a partir de docs/padroes.html (uma imagem por página A4).
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origem = path.join(raiz, 'docs', 'padroes.html')
const destino = path.join(raiz, 'public', 'dicas')
await mkdir(destino, { recursive: true })

const navegador = await chromium.launch({ channel: 'msedge', args: ['--disable-gpu', '--force-color-profile=srgb'] })
try {
  const pagina = await navegador.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 2,
  })
  await pagina.goto(pathToFileURL(origem).href)
  await pagina.evaluate(() => document.fonts.ready)
  const secoes = await pagina.locator('section.page').all()
  for (const [i, secao] of secoes.entries()) {
    const bruto = await secao.screenshot({ type: 'png' })
    const nome = `pagina-${String(i + 1).padStart(2, '0')}.png`
    await sharp(bruto)
      .resize({ width: 1240 })
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(destino, nome))
    console.log(nome)
  }
  console.log(`${secoes.length} páginas geradas`)
} finally {
  await navegador.close()
}
