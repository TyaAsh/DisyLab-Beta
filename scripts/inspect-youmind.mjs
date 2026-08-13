import fs from 'node:fs';

function extractPrompts(html) {
  const marker = '\\"prompts\\":[';
  const start = html.lastIndexOf(marker);
  if (start < 0) return [];
  const arrayStart = start + marker.length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\\\') escaped = true;
      else if (char === '\\"') inString = false;
      continue;
    }
    if (char === '\\"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(arrayStart, index + 1).replaceAll('\\\\\"', '\"'));
    }
  }
  return [];
}

for (const name of ['gpt', 'nano', 'seedream']) {
  const html = fs.readFileSync(new URL(`./youmind-${name}.html`, import.meta.url), 'utf8');
  try { const prompts = extractPrompts(html); console.log('prompts', prompts.length, prompts.slice(0, 2).map((p) => p.id)); } catch (error) { console.log('parse error', error.message); }
  const urls = [...html.matchAll(/https:\/\/cdn\.gooo\.ai\/user-files\/[^\\"&< ]+/g)].map((match) => match[0]);
  console.log(name, 'cdn urls', urls.length, 'unique', new Set(urls).size);
  console.log([...new Set(urls)].slice(0, 3));
  const images = [...html.matchAll(/https:\/\/[^\\"' <]+?\.(?:webp|png|jpe?g)(?:\?[^\\"' <]*)?/gi)].map((match) => match[0].replaceAll('\\u0026', '&'));
  console.log('all image urls', images.length, 'unique', new Set(images).size);
  const hosts = {};
  for (const url of new Set(images)) { try { const host = new URL(url).host; hosts[host] = (hosts[host] || 0) + 1; } catch {} }
  console.log(hosts);
  const firstImage = [...new Set(images)].find((url) => url.includes('cms-assets.youmind.com/media/'));
  const firstCms = firstImage ? html.lastIndexOf(firstImage) : -1;
  console.log('sample data', html.slice(Math.max(0, firstCms - 1000), firstCms + 1500));
  for (const key of ['categoriesParam', 'searchMode', 'sortBy', 'hasMore']) {
    const index = html.lastIndexOf(`\\"${key}\\"`);
    console.log(key, index, html.slice(Math.max(0, index - 250), index + 500));
  }
  const literal = name === 'gpt' ? 'gpt-image-2-prompts' : name === 'nano' ? 'nano-banana-pro-prompts' : 'seedream-4-dot-5-prompts';
  let cursor = 0; const positions = [];
  while ((cursor = html.indexOf(literal, cursor)) >= 0) { positions.push(cursor); cursor += literal.length; }
  console.log('literal positions', positions.slice(-8));
  for (const index of positions.slice(-3)) console.log(html.slice(index - 350, index + 500));
}
