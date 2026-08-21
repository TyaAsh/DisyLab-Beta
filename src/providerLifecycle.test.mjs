import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('./providerLifecycle.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const lifecycle = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('extracts task IDs from common root, object, and array response shapes', () => {
  assert.equal(lifecycle.extractProviderTaskId({ taskId: 'root-task' }), 'root-task')
  assert.equal(lifecycle.extractProviderTaskId({ data: { task_id: 'object-task' } }), 'object-task')
  assert.equal(lifecycle.extractProviderTaskId({ data: [{ task_id: 'visionary-task' }] }), 'visionary-task')
  assert.equal(lifecycle.extractProviderTaskId({ output: { id: 'image-id' }, result: { job_id: 'job-1' } }), 'job-1')
})

test('extracts nested status and classifies asynchronous lifecycle states', () => {
  assert.equal(lifecycle.extractProviderTaskStatus({ data: [{ status: 'PROCESSING' }] }), 'processing')
  assert.equal(lifecycle.classifyProviderPayload({ data: [{ task_id: 'task-1', status: 'submitted' }] }), 'pending')
  assert.equal(lifecycle.classifyProviderPayload({ data: [{ task_id: 'task-1', status: 'completed' }] }), 'success_without_result')
  assert.equal(lifecycle.classifyProviderPayload({ data: [{ task_id: 'task-1', status: 'failed' }] }), 'failed')
})

test('recognizes synchronous and Visionary completed image result shapes', () => {
  assert.deepEqual(lifecycle.extractProviderImages({ results: [{ url: 'https://visionary.beer/api/generations/a.png' }] }), [
    { url: 'https://visionary.beer/api/generations/a.png', revisedPrompt: undefined },
  ])
  assert.deepEqual(lifecycle.extractProviderImages({ data: { result: { images: [{ url: ['https://cdn.example/a.png'] }] } } }), [
    { url: 'https://cdn.example/a.png', revisedPrompt: undefined },
  ])
  assert.equal(lifecycle.classifyProviderPayload({ data: [{ url: 'https://cdn.example/a.png' }] }), 'result')
})

test('does not mistake unrelated deeply nested IDs for a paid task', () => {
  assert.equal(lifecycle.extractProviderTaskId({ data: { result: { images: [{ id: 'image-only' }] } } }), '')
})

test('prefers explicit paid task IDs over generic response IDs', () => {
  assert.equal(lifecycle.extractProviderTaskId({ data: [{ id: 'image-id', task_id: 'paid-task' }] }), 'paid-task')
})

test('prefers nested task status over a successful transport envelope', () => {
  const payload = { status: 'success', data: { task_id: 'paid-task', status: 'processing' } }
  assert.equal(lifecycle.extractProviderTaskStatus(payload), 'processing')
  assert.equal(lifecycle.classifyProviderPayload(payload), 'pending')
})

test('builds encoded GET-only discovery paths for unknown async providers', () => {
  assert.deepEqual(lifecycle.providerTaskPollPaths('job / 42'), [
    'tasks/job%20%2F%2042',
    'jobs/job%20%2F%2042',
    'requests/job%20%2F%2042',
    'images/generations/job%20%2F%2042',
  ])
  assert.deepEqual(lifecycle.providerTaskPollPaths('  '), [])
})
