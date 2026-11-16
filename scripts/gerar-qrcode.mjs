import QRCode from 'qrcode'
import { mkdirSync } from 'node:fs'

export const URL_APP = 'https://stuart-alt.github.io/tenistas-do-clube-campestre/'

mkdirSync('docs', { recursive: true })
await QRCode.toFile('docs/qrcode.png', URL_APP, {
  width: 1024,
  margin: 2,
  errorCorrectionLevel: 'M',
})
console.log('docs/qrcode.png gerado para', URL_APP)
