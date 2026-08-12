/**
 * APIYI (API易) — minimal runnable example
 * ---------------------------------------------------------------
 * Stack: Node.js (ESM). Zero dependencies — uses the built-in `fetch`.
 * The project is `"type": "module"`, so a `.mjs` file runs with plain `node`.
 *
 * What this proves:
 *   - Point the OpenAI-compatible endpoint at APIYI's gateway
 *   - Call `gpt-5.4-mini` (note the DOT in the version: gpt-5.4-mini, not gpt-5-4-mini)
 *   - Read the key from the environment (never hardcode, never commit)
 *
 * Run:
 *   export APIYI_API_KEY="sk-..."      # PowerShell: $env:APIYI_API_KEY="sk-..."
 *   node examples/apiyi-quickstart.mjs
 *
 * ----- Official SDK alternative (recommended for real integration) -----
 *   npm i openai
 *   import OpenAI from 'openai'
 *   const client = new OpenAI({
 *     apiKey: process.env.APIYI_API_KEY,
 *     baseURL: 'https://api.apiyi.com/v1',   // OpenAI SDK NEEDS the /v1
 *   })
 *   const r = await client.chat.completions.create({
 *     model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Hello!' }],
 *   })
 *   (Anthropic SDK → baseURL 'https://api.apiyi.com'  // NO /v1
 *    Google GenAI SDK → baseURL 'https://api.apiyi.com' + api_version 'v1beta')
 */

const APIYI_API_KEY = process.env.APIYI_API_KEY
if (!APIYI_API_KEY) {
  console.error('✗ Missing APIYI_API_KEY. Set it first:')
  console.error('    export APIYI_API_KEY="sk-..."')
  process.exit(1)
}

// OpenAI-compatible wire format → base URL MUST include /v1 (the SDK appends /chat/completions).
const BASE_URL = 'https://api.apiyi.com/v1'
const MODEL = 'gpt-5.4-mini'

const prompt = '用一句话介绍 APIYI（API易）是什么，并给出一个中文例子。'

async function chatCompletion() {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${APIYI_API_KEY}`,
    },
    // gpt-5.x family: temperature stays 1, use max_completion_tokens, do NOT send top_p.
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 1,
      max_completion_tokens: 256,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`)
  }
  return res.json()
}

/**
 * APIYI bills in "quota units": 500,000 quota = 1 USD.
 * Per-model pricing is published (unauthenticated) at /api/pricing as
 * model_ratio (input) and completion_ratio (output = model_ratio × completion_ratio).
 * We fetch it live so the example never hardcodes a price.
 */
async function estimateCost(model, usage) {
  try {
    const p = await fetch('https://api.apiyi.com/api/pricing').then((r) => r.json())
    const entry = (p.data || []).find((x) => x.model_name === model)
    if (!entry || !usage) return null
    const inMul = entry.model_ratio
    const outMul = entry.model_ratio * entry.completion_ratio
    const quota =
      usage.prompt_tokens * inMul + usage.completion_tokens * outMul
    return { quota, usd: quota / 500000, inMul, outMul }
  } catch {
    return null
  }
}

const main = async () => {
  console.log(`→ Calling ${MODEL} via ${BASE_URL}\n`)
  const data = await chatCompletion()

  const content = data.choices?.[0]?.message?.content ?? '(no content)'
  const usage = data.usage

  console.log('【模型返回内容】')
  console.log(content.trim())
  console.log('\n【用量 (usage)】')
  console.log(JSON.stringify(usage, null, 2))

  if (usage) {
    const cost = await estimateCost(MODEL, usage)
    if (cost) {
      console.log('\n【本次调用预估费用】')
      console.log(
        `  ≈ ${cost.usd.toFixed(6)} USD  （${cost.quota.toFixed(4)} quota 单位；` +
          `500,000 quota = 1 USD）`
      )
      console.log(
        `  （输入倍率 ${cost.inMul}，输出倍率 ${cost.outMul}；精确账单以控制台为准：` +
          `https://api.apiyi.com/log）`
      )
    }
  }
}

main().catch((err) => {
  console.error('✗ Request failed:', err.message)
  process.exit(1)
})
