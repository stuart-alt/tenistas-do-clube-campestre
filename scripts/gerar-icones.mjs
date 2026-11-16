import sharp from 'sharp'

const origem = 'public/logo.svg'
const saidas = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 }
for (const [arquivo, tam] of Object.entries(saidas)) {
  await sharp(origem, { density: 300 }).resize(tam, tam).png().toFile(`public/${arquivo}`)
}
