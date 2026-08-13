import fs from 'node:fs';

const decode = (raw = '') => {
  try { return JSON.parse(`"${raw}"`); } catch { return raw.replaceAll('\\\\n', '\n').replaceAll('\\\\"', '"').replaceAll('\\\\/', '/'); }
};

export function parseYouMindSsr(html) {
  const start = html.lastIndexOf('\\"prompts\\":[');
  const section = start >= 0 ? html.slice(start) : html;
  const matches = [...section.matchAll(/\{\\"id\\":(\d+),\\"title\\":\\"((?:\\\\.|[^\\"])*)\\"([\s\S]*?)(?=\},\{\\"id\\":|\]\s*,\\"pagination\\"|\]\}\]\}\]\}\]\}\]\}\]\}\]\}\]\}\])/g)];
  return matches.map((match) => {
    const body = match[3];
    const get = (key) => {
      const value = body.match(new RegExp(`\\\\"${key}\\\\":\\\\"((?:\\\\\\\\.|[^\\\\"])*)\\\\"`));
      return value ? decode(value[1]) : '';
    };
    const image = body.match(/\\"mediaThumbnails\\":\[\\"((?:\\\\.|[^\\"])*)\\"/)?.[1]
      || body.match(/\\"media\\":\[\\"((?:\\\\.|[^\\"])*)\\"/)?.[1]
      || '';
    return {
      id: Number(match[1]),
      title: decode(match[2]),
      description: get('description'),
      slug: get('slug'),
      sourceLink: get('sourceLink'),
      content: get('translatedContent') || get('content'),
      image: decode(image),
    };
  }).filter((item) => item.title && item.content && item.image);
}

if (process.argv[1] === new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')) {
  for (const file of process.argv.slice(2)) {
    const items = parseYouMindSsr(fs.readFileSync(file, 'utf8'));
    console.log(file, items.length, items.slice(0, 3).map((item) => item.id));
  }
}
