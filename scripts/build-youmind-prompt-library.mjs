import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'public/prompt-library/catalog.json');
const IMAGE_DIR = path.join(ROOT, 'public/prompt-library/youmind');
const API_URL = 'https://youmind.com/youmarketing-api/prompts';
const TARGET_CASES = 240;
const TARGET_TEMPLATES = 0;
const FETCH_PAGES = 20;
const PAGE_LIMIT = 18;
const API_CACHE_DIR = path.join(ROOT, 'scripts/youmind-api');
const RAW_IMAGE_DIR = path.join(ROOT, 'scripts/youmind-raw');
const EXCLUDED_IDS = new Set([
  'youmind-gpt-31327', 'youmind-gpt-31312', 'youmind-nano-30693',
  'youmind-nano-31265', 'youmind-nano-31256', 'youmind-nano-31160',
  'youmind-nano-30943', 'youmind-nano-30804', 'youmind-nano-30695',
  'youmind-nano-30544', 'youmind-gpt-31326', 'youmind-gpt-31236',
]);

const SOURCES = [
  { key: 'seedream', model: 'seedream-4.5', campaign: 'seedream-4-dot-5-prompts', base: 'seedream-4-dot-5-prompts', label: 'YouMind · Seedream 4.5' },
  { key: 'nano', model: 'nano-banana-pro', campaign: 'nano-banana-pro-prompts', base: 'nano-banana-pro-prompts', label: 'YouMind · Nano Banana Pro' },
  { key: 'gpt', model: 'gpt-image-2', campaign: 'gpt-image-2-prompts', base: 'gpt-image-2-prompts', label: 'YouMind · GPT Image 2' },
];

const BLOCKED = [
  /(?:裸|胸|乳|内衣|比基尼|丝袜|吊带|泳装|性感|诱惑|性暗示|情色|成人|脱衣|走光|臀|私房|妩媚|爆乳|翘臀|女体|擦边)/i,
  /(?:nude|naked|cleavage|breast|boob|lingerie|bikini|swimsuit|underwear|seductive|sexy|erotic|nsfw|fetish|upskirt|thigh-high|female body|curvy body|provocative pose|sensual pose)/i,
  /(?:血腥|肢解|酷刑|纳粹|希特勒|仇恨|自杀|虐待|恐怖袭击)/i,
  /(?:gore|dismember|torture|nazi|hitler|hate symbol|suicide|terrorist attack)/i,
  /(?:young woman|beautiful woman|attractive woman|female model|anime girl|schoolgirl|girl portrait|woman portrait|influencer selfie)/i,
];

const CATEGORIES = ['品牌运营','金融科技','产品商业','UI与交互','IP与角色','建筑空间','海报排版','内容传播','信息可视化','摄影创意'];
const STYLES = ['写实摄影','3D渲染','极简','编辑设计','未来科技','商业插画','潮流','复古','电影感','材质实验'];
const SCENES = ['活动运营','电商营销','社交媒体','产品发布','品牌建设','企业服务','教育内容','内容营销'];

const includesAny = (text, words) => words.some((word) => text.includes(word));
const normalize = (value = '') => value.toLowerCase().replace(/\s+/g, ' ').trim();

async function fetchWithRetry(url, options, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
      if (response.status >= 500 && attempt < attempts) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

function classify(item) {
  const text = normalize(`${item.title} ${item.description} ${item.content}`);
  let category = '内容传播';
  if (includesAny(text, ['finance','fintech','bank','trading','stock','investment','wallet','payment','金融','投资','股票','银行','支付'])) category = '金融科技';
  else if (includesAny(text, ['ui','ux','interface','dashboard','app screen','website','网页','界面','仪表盘','交互'])) category = 'UI与交互';
  else if (includesAny(text, ['product render','packaging','e-commerce','ecommerce','product photography','商品','产品渲染','包装','电商'])) category = '产品商业';
  else if (includesAny(text, ['architecture','interior','building','space design','建筑','室内','空间'])) category = '建筑空间';
  else if (includesAny(text, ['infographic','diagram','chart','data visualization','流程图','信息图','图表','可视化'])) category = '信息可视化';
  else if (includesAny(text, ['poster','flyer','typography','editorial layout','海报','传单','排版','字体'])) category = '海报排版';
  else if (includesAny(text, ['brand','campaign','logo','key visual','marketing','品牌','活动视觉','运营'])) category = '品牌运营';
  else if (includesAny(text, ['character','mascot','ip design','角色','吉祥物','ip形象'])) category = 'IP与角色';
  else if (includesAny(text, ['photography','photo','camera','portrait','摄影','镜头'])) category = '摄影创意';

  let style = '编辑设计';
  if (includesAny(text, ['3d','render','cinema 4d','blender','octane','三维','渲染'])) style = '3D渲染';
  else if (includesAny(text, ['photoreal','realistic photo','photography','写实','摄影'])) style = '写实摄影';
  else if (includesAny(text, ['minimal','minimalist','极简','留白'])) style = '极简';
  else if (includesAny(text, ['futuristic','sci-fi','cyber','未来','科技感'])) style = '未来科技';
  else if (includesAny(text, ['illustration','cartoon','vector','插画','卡通'])) style = '商业插画';
  else if (includesAny(text, ['retro','vintage','复古'])) style = '复古';
  else if (includesAny(text, ['cinematic','film still','电影感'])) style = '电影感';
  else if (includesAny(text, ['material','glass','metal','fabric','paper texture','材质','玻璃','金属','纸张'])) style = '材质实验';
  else if (includesAny(text, ['trendy','streetwear','潮流'])) style = '潮流';

  let scene = '内容营销';
  if (includesAny(text, ['launch','发布会','产品发布'])) scene = '产品发布';
  else if (includesAny(text, ['social media','instagram','youtube thumbnail','小红书','社交媒体','缩略图'])) scene = '社交媒体';
  else if (includesAny(text, ['e-commerce','ecommerce','sale','促销','电商','商品'])) scene = '电商营销';
  else if (includesAny(text, ['event','festival','conference','活动','节日','会议'])) scene = '活动运营';
  else if (includesAny(text, ['brand','logo','identity','品牌','识别系统'])) scene = '品牌建设';
  else if (includesAny(text, ['business','enterprise','dashboard','企业','商业提案'])) scene = '企业服务';
  else if (includesAny(text, ['education','tutorial','science','guide','教育','教程','科普','指南'])) scene = '教育内容';
  return { category, style, scene };
}

async function fetchPage(source, page) {
  const cached = path.join(API_CACHE_DIR, `${source.key}-${page}.json`);
  try { return JSON.parse(await fs.readFile(cached, 'utf8')); } catch {}
  const response = await fetchWithRetry(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://youmind.com',
      referer: `https://youmind.com/zh-CN/${source.base}/explore`,
      'user-agent': 'Mozilla/5.0 (compatible; DisylabPromptLibrary/1.0)',
    },
    body: JSON.stringify({
      model: source.model,
      page,
      limit: PAGE_LIMIT,
      locale: 'zh-CN',
      campaign: source.campaign,
      filterMode: 'imageCategories',
    }),
  });
  if (!response.ok) throw new Error(`${source.key} page ${page}: HTTP ${response.status}`);
  return response.json();
}

function safePrompt(item) {
  if (EXCLUDED_IDS.has(`youmind-${item._source.key}-${item.id}`)) return false;
  const text = `${item.title || ''} ${item.description || ''} ${item.translatedContent || ''} ${item.content || ''}`;
  if (BLOCKED.some((pattern) => pattern.test(text))) return false;
  if ((item.translatedContent || item.content || '').trim().length < 70) return false;
  const image = item.mediaThumbnails?.[0] || item.media?.[0];
  if (!image || !/(?:cms-assets\.youmind\.com|cdn\.gooo\.ai)/i.test(image)) return false;
  return true;
}

async function mapLimit(items, concurrency, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }));
  return output;
}

async function downloadImage(item, index) {
  const sourceUrl = item.mediaThumbnails?.[0] || item.media?.[0];
  const rawPath = path.join(RAW_IMAGE_DIR, new URL(sourceUrl).pathname.split('/').pop());
  let input;
  try { input = await fs.readFile(rawPath); }
  catch {
    const response = await fetchWithRetry(sourceUrl, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://youmind.com/' } });
    if (!response.ok) throw new Error(`image HTTP ${response.status}: ${sourceUrl}`);
    input = Buffer.from(await response.arrayBuffer());
  }
  const output = await sharp(input, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#161816' })
    .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 36, effort: 6, smartSubsample: true })
    .toBuffer();
  const digest = crypto.createHash('sha256').update(output).digest('hex');
  const filename = `youmind-${String(index + 1).padStart(3, '0')}-${digest.slice(0, 10)}.webp`;
  await fs.writeFile(path.join(IMAGE_DIR, filename), output);
  return { image: `/prompt-library/youmind/${filename}`, digest, bytes: output.length };
}

async function main() {
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  const industryCases = catalog.industryCases || [];
  const raw = [];
  for (const source of SOURCES) {
    for (let page = 1; page <= FETCH_PAGES; page += 1) {
      const payload = await fetchPage(source, page);
      for (const prompt of payload.prompts || []) raw.push({ ...prompt, _source: source });
      if (!payload.hasMore) break;
    }
  }

  const ids = new Set();
  const images = new Set();
  const sourceUrls = new Set();
  const selected = [];
  for (const item of raw) {
    const image = item.mediaThumbnails?.[0] || item.media?.[0];
    const preciseUrl = `https://youmind.com/zh-CN/${item._source.base}/${item.slug || item.id}`;
    const uniqueId = `${item._source.key}:${item.id}`;
    if (!safePrompt(item) || ids.has(uniqueId) || images.has(image) || sourceUrls.has(preciseUrl)) continue;
    ids.add(uniqueId); images.add(image); sourceUrls.add(preciseUrl);
    selected.push({ ...item, _preciseUrl: preciseUrl });
  }
  if (selected.length < TARGET_CASES + TARGET_TEMPLATES) throw new Error(`Only ${selected.length} safe unique prompts available`);

  const perSource = Math.ceil((TARGET_CASES + TARGET_TEMPLATES) / SOURCES.length);
  const balancedSelected = SOURCES.flatMap((source) => selected.filter((item) => item._source.key === source.key).slice(0, perSource));
  if (balancedSelected.length < TARGET_CASES + TARGET_TEMPLATES) throw new Error(`Only ${balancedSelected.length} balanced prompts available`);
  const downloaded = (await mapLimit(balancedSelected, 10, async (item, index) => {
    try { return { item, ...(await downloadImage(item, index)) }; }
    catch (error) { console.warn(`Skipping image ${index + 1}: ${error instanceof Error ? error.message : error}`); return null; }
  })).filter(Boolean);
  const hashSeen = new Set();
  const unique = downloaded.filter(({ digest }) => hashSeen.has(digest) ? false : (hashSeen.add(digest), true));
  if (unique.length < TARGET_CASES + TARGET_TEMPLATES) throw new Error(`Only ${unique.length} unique image hashes after download`);

  const records = unique.slice(0, TARGET_CASES + TARGET_TEMPLATES).map(({ item, image }, index) => {
    const taxonomy = classify(item);
    const prompt = (item.translatedContent || item.content || '').trim();
    return {
      id: `youmind-${item._source.key}-${item.id}`,
      title: item.title.trim(),
      image,
      sourceLabel: item._source.label,
      sourceUrl: item._preciseUrl,
      category: taxonomy.category,
      styles: [taxonomy.style],
      scenes: [taxonomy.scene],
      featured: index < 30,
      prompt,
    };
  });

  const templateScore = (record) => (record.prompt.match(/\{argument\b/g)?.length || 0) * 1000 + record.prompt.length;
  const templates = [...records].sort((a, b) => templateScore(b) - templateScore(a)).slice(0, TARGET_TEMPLATES)
    .map((record) => ({ ...record, id: `${record.id}-template`, template: true }));
  const templateBaseIds = new Set(templates.map((record) => record.id.replace(/-template$/, '')));
  const cases = records.filter((record) => !templateBaseIds.has(record.id)).slice(0, TARGET_CASES);
  if (cases.length < TARGET_CASES) {
    const used = new Set(cases.map((item) => item.id));
    cases.push(...records.filter((record) => !used.has(record.id) && !templateBaseIds.has(record.id)).slice(0, TARGET_CASES - cases.length));
  }

  const next = {
    ...catalog,
    repository: 'https://youmind.com/zh-CN/prompts',
    totalCases: cases.length,
    categories: CATEGORIES,
    styles: STYLES,
    scenes: SCENES,
    cases,
    templates,
    industryCases,
  };
  await fs.writeFile(CATALOG_PATH, `${JSON.stringify(next)}\n`, 'utf8');
  const referencedFiles = new Set(records.map((record) => path.basename(record.image)));
  for (const filename of await fs.readdir(IMAGE_DIR)) {
    if (!referencedFiles.has(filename)) await fs.unlink(path.join(IMAGE_DIR, filename));
  }
  const totalBytes = unique.slice(0, TARGET_CASES + TARGET_TEMPLATES).reduce((sum, item) => sum + item.bytes, 0);
  console.log(JSON.stringify({ fetched: raw.length, safeUnique: selected.length, cases: cases.length, templates: templates.length, industryCases: industryCases.length, imageBytes: totalBytes }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
