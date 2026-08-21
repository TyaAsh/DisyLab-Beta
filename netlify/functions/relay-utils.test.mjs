import assert from 'node:assert/strict'
import test from 'node:test'
import mediaRelay from './apiyi-media.mjs'
import openaiRelay from './apiyi-openai.mjs'
import visionaryRelay from './visionary.mjs'
import { limitedResponseBody, readLimitedBody, RelayLimitError } from './_relay-utils.mjs'

test('rejects a request whose declared body exceeds the limit', async () => {
  const request = new Request('https://example.test/relay', {
    method: 'POST',
    headers: { 'content-length': '11' },
    body: 'small',
  })
  await assert.rejects(() => readLimitedBody(request, 10), (error) => error instanceof RelayLimitError && error.status === 413)
})

test('rejects an upstream response whose declared body exceeds the limit', () => {
  const response = new Response('large', { headers: { 'content-length': '11' } })
  assert.throws(() => limitedResponseBody(response, 10), (error) => error instanceof RelayLimitError && error.status === 502)
})

test('media relay rejects lookalike and credentialed URLs without fetching', async () => {
  const lookalike = await mediaRelay(new Request('https://app.test/apiyi/media?url=https%3A%2F%2Fapiyi.com.attacker.test%2Fvideo.mp4'))
  const credentialed = await mediaRelay(new Request('https://app.test/apiyi/media?url=https%3A%2F%2Fuser%40apiyi.com%2Fvideo.mp4'))
  assert.equal(lookalike.status, 403)
  assert.equal(credentialed.status, 400)
})

test('OpenAI relay rejects unapproved upstream hosts without fetching', async () => {
  const response = await openaiRelay(new Request('https://app.test/apiyi/openai/chat/completions', {
    headers: { 'x-disylab-apiyi-base': 'https://apiyi.com.attacker.test/v1' },
  }))
  assert.equal(response.status, 400)
  assert.match(await response.text(), /不支持的 APIYI 上游节点或路径/)
})

test('Visionary relay rejects lookalike upstream hosts without fetching', async () => {
  const response = await visionaryRelay(new Request('https://app.test/visionary/v1/images/generations', {
    headers: { 'x-disylab-visionary-base': 'https://api.visionary.beer.attacker.test/v1' },
  }))
  assert.equal(response.status, 400)
})

test('Visionary relay forwards to the approved base and strips its private header', async () => {
  const originalFetch = globalThis.fetch
  let captured
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), headers: new Headers(init.headers) }
    return Response.json({ data: [{ task_id: 'task-1' }] })
  }
  try {
    const response = await visionaryRelay(new Request('https://app.test/visionary/images/generations', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
        'x-disylab-visionary-base': 'https://api.visionary.beer/v1',
      },
      body: JSON.stringify({ model: 'gpt-image-2' }),
    }))
    assert.equal(response.status, 200)
    assert.equal(captured.url, 'https://api.visionary.beer/v1/images/generations')
    assert.equal(captured.headers.get('authorization'), 'Bearer test-key')
    assert.equal(captured.headers.has('x-disylab-visionary-base'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
