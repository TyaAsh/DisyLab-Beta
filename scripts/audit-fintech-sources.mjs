import sharp from 'sharp'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = join(root, 'scripts', 'industry-source')
const files = (await readdir(dir)).filter((file) => /^(moomoo-au|tiger-.+-\d+)\-.+\.source$/.test(file) || /^moomoo-au-\d+\.source$/.test(file))
for (const file of files) {
  try {
    const metadata = await sharp(join(dir, file)).metadata()
    console.log(`${file}\t${metadata.width}x${metadata.height}\t${metadata.format}`)
  } catch {}
}
