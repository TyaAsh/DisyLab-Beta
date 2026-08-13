import sharp from 'sharp'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = join(root, 'scripts', 'industry-source')
const chosen = [1,2,3,4,5,9,10,11,12,14,15,16,17,18,22,23,24,25,26,30,31,32,33,34,35,36,37,39,42,43,44]
const tiles = await Promise.all(chosen.map(async (number) => {
  const file = join(dir, `moomoo-au-${String(number).padStart(2,'0')}.source`)
  const image = await sharp(file).resize(240, 150, { fit:'contain', background:'#171717' }).png().toBuffer()
  const label = Buffer.from(`<svg width="240" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="240" height="24" fill="#111"/><text x="8" y="17" fill="white" font-size="14">${number}</text></svg>`)
  return sharp({ create:{ width:240,height:174,channels:3,background:'#111' } }).composite([{input:image,top:24,left:0},{input:label,top:0,left:0}]).png().toBuffer()
}))
await sharp({ create:{width:1200,height:Math.ceil(tiles.length/5)*174,channels:3,background:'#090909'} }).composite(tiles.map((input,i)=>({input,left:(i%5)*240,top:Math.floor(i/5)*174}))).png().toFile(join(root,'fintech-contact.png'))
