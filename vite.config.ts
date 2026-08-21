/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

const rightsBanner = '/*! DisyLab v1.0.5 | Copyright (c) 2026 DisyLab. All rights reserved. | LicenseRef-DisyLab-Proprietary | ash::tya origin build | Unauthorized commercial use, redistribution, white-labeling, relicensing, or removal of this notice is prohibited. | Repository: https://github.com/TyaAsh/DisyLab-Canvas */'

const localProxyUrl = new URL(process.env.DISYLAB_HTTPS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7890')

function localProxyIsAvailable() {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(Number(localProxyUrl.port || 80), localProxyUrl.hostname)
    const finish = (available: boolean) => {
      socket.destroy()
      resolve(available)
    }
    socket.setTimeout(250)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function requestThroughLocalProxy(target: URL, method: string, headers: Headers, body?: Buffer) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const connect = http.request({
      hostname: localProxyUrl.hostname,
      port: Number(localProxyUrl.port || 80),
      method: 'CONNECT',
      path: `${target.hostname}:${target.port || 443}`,
    })
    connect.once('connect', (connectResponse, socket, head) => {
      if (connectResponse.statusCode !== 200) {
        socket.destroy()
        reject(new Error(`本地代理 CONNECT 返回 ${connectResponse.statusCode ?? '未知状态'}`))
        return
      }
      if (head.length) socket.unshift(head)
      const secureSocket = tls.connect({ socket, servername: target.hostname })
      secureSocket.once('secureConnect', () => {
        const agent = new https.Agent({ keepAlive: false })
        agent.createConnection = () => secureSocket
        const upstreamRequest = https.request({
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method,
          headers: Object.fromEntries(headers.entries()),
          agent,
        }, (upstreamResponse) => {
          const chunks: Buffer[] = []
          upstreamResponse.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          upstreamResponse.on('end', () => resolve({
            status: upstreamResponse.statusCode ?? 502,
            headers: upstreamResponse.headers,
            body: Buffer.concat(chunks),
          }))
          upstreamResponse.on('error', reject)
        })
        upstreamRequest.on('error', reject)
        if (body?.length) upstreamRequest.write(body)
        upstreamRequest.end()
      })
      secureSocket.once('error', reject)
    })
    connect.once('error', reject)
    connect.end()
  })
}
const disyLabRightsBannerPlugin: Plugin = {
  name: 'disylab-rights-banner',
  enforce: 'post',
  generateBundle(_options, bundle) {
    Object.values(bundle).forEach((output) => {
      if (output.type === 'chunk') output.code = `${rightsBanner}\n${output.code}`
      else if (output.fileName.endsWith('.css') && typeof output.source === 'string') {
        output.source = `${rightsBanner}\n${output.source}`
      }
    })
  },
}

// Seedance returns a short-lived CDN URL. Those media hosts do not reliably
// expose CORS headers, so download the completed file through the same-origin
// dev server just like the submit/poll requests.
const apiYiMediaRelayPlugin: Plugin = {
  name: 'apiyi-media-relay',
  configureServer(server) {
    const readBody = (request: import('node:http').IncomingMessage) => new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      request.on('end', () => resolve(Buffer.concat(chunks)))
      request.on('error', reject)
    })
    const installGatewayRelay = (prefix: string) => {
      server.middlewares.use(prefix, async (request, response, next) => {
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(request.method ?? '')) return next()
        try {
          const upstreamPath = (request.url || '/').replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '') || '/'
          const requestedOrigin = String(request.headers['x-disylab-apiyi-origin'] ?? '').trim()
          const requestedHost = requestedOrigin ? new URL(requestedOrigin).hostname.toLowerCase() : 'api.apiyi.com'
          const allowedHosts = new Set(['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com'])
          if (!allowedHosts.has(requestedHost)) {
            response.statusCode = 400
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify({ error: { message: '不支持的 APIYI 上游节点' } }))
            return
          }
          const upstreamOrigin = `https://${requestedHost}`
          const headers = new Headers()
          for (const [name, value] of Object.entries(request.headers)) {
            if (['host', 'content-length', 'connection', 'x-disylab-apiyi-origin', 'x-disylab-apiyi-base'].includes(name.toLowerCase())) continue
            if (Array.isArray(value)) headers.set(name, value.join(', '))
            else if (value) headers.set(name, value)
          }
          // APIYI documents that this endpoint can advertise gzip while
          // returning an identity body. Buffering and stripping encoding keeps
          // the browser from failing before fetch() receives a Response.
          headers.set('Accept-Encoding', 'identity')
          const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await readBody(request)
          const target = new URL(upstreamPath, upstreamOrigin)
          const proxyAvailable = await localProxyIsAvailable()
          const upstream = proxyAvailable
            ? await requestThroughLocalProxy(target, request.method!, headers, body)
            : await fetch(target, { method: request.method, headers, body }).then(async (result) => ({
                status: result.status,
                headers: Object.fromEntries(result.headers.entries()),
                body: Buffer.from(await result.arrayBuffer()),
              }))
          response.statusCode = upstream.status
          const contentType = upstream.headers['content-type']
          if (contentType) response.setHeader('content-type', contentType)
          const requestId = upstream.headers['x-request-id'] || upstream.headers['x-shellapi-request-id']
          if (requestId) response.setHeader('x-request-id', requestId)
          response.setHeader('content-length', upstream.body.length)
          response.end(upstream.body)
        } catch (error) {
          response.statusCode = 502
          response.setHeader('content-type', 'application/json')
          response.setHeader('x-disylab-relay-error', 'upstream-fetch-failed')
          const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : ''
          response.end(JSON.stringify({ error: { message: `APIYI 上游连接失败：${error instanceof Error ? error.message : String(error)}${cause}` } }))
        }
      })
    }
    installGatewayRelay('/apiyi/seedance')
    installGatewayRelay('/apiyi/wan')
    installGatewayRelay('/apiyi/veo')
    installGatewayRelay('/apiyi/openai')
    server.middlewares.use('/visionary', async (request, response, next) => {
      if (!['GET', 'POST', 'HEAD'].includes(request.method ?? '')) return next()
      try {
        const requestedBase = String(request.headers['x-disylab-visionary-base'] ?? 'https://api.visionary.beer/v1')
        const base = new URL(requestedBase)
        if (base.protocol !== 'https:' || !new Set(['visionary.beer', 'api.visionary.beer']).has(base.hostname.toLowerCase()) || base.username || base.password || base.port) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: { message: '不支持的 Visionary 上游地址' } }))
          return
        }
        // Connect strips the mounted `/visionary` prefix but leaves a leading
        // slash. Remove it so URL resolution keeps the configured `/v1` base
        // instead of resetting to the provider origin root.
        const upstreamPath = (request.url || '/').replace(/^\/visionary\/?/, '').replace(/^\/+/, '')
        const target = new URL(upstreamPath, `${base.origin}${base.pathname.replace(/\/$/, '')}/`)
        const headers = new Headers()
        for (const [name, value] of Object.entries(request.headers)) {
          if (['host', 'content-length', 'connection', 'x-disylab-visionary-base'].includes(name.toLowerCase())) continue
          if (Array.isArray(value)) headers.set(name, value.join(', '))
          else if (value) headers.set(name, value)
        }
        headers.set('Accept-Encoding', 'identity')
        const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await readBody(request)
        const proxyAvailable = await localProxyIsAvailable()
        const upstream = proxyAvailable
          ? await requestThroughLocalProxy(target, request.method!, headers, body)
          : await fetch(target, { method: request.method, headers, body }).then(async (result) => ({
              status: result.status,
              headers: Object.fromEntries(result.headers.entries()),
              body: Buffer.from(await result.arrayBuffer()),
            }))
        response.statusCode = upstream.status
        for (const name of ['content-type', 'cache-control', 'x-request-id']) {
          const value = upstream.headers[name]
          if (value) response.setHeader(name, value)
        }
        response.setHeader('content-length', upstream.body.length)
        response.end(upstream.body)
      } catch {
        response.statusCode = 502
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ error: { message: 'Visionary 上游连接失败' } }))
      }
    })
    server.middlewares.use('/apiyi/media', async (request, response, next) => {
      if (request.method !== 'GET') return next()
      try {
        const target = new URL(request.url ?? '', 'http://localhost').searchParams.get('url')
        if (!target || !/^https:\/\//i.test(target)) {
          response.statusCode = 400
          response.end('invalid media url')
          return
        }
        let targetUrl = new URL(target)
        const mediaHostAllowed = (url: URL) => url.protocol === 'https:'
          && !url.username && !url.password && !url.port
          && /(?:^|\.)apiyi\.com$|(?:^|\.)volces\.com$|(?:^|\.)aliyuncs\.com$|(?:^|\.)visionary\.beer$/i.test(url.hostname)
        if (!mediaHostAllowed(targetUrl)) {
          response.statusCode = 403
          response.end('media host not allowed')
          return
        }
        const relayHeaders = new Headers({ 'Accept-Encoding': 'identity' })
        let upstream: Awaited<ReturnType<typeof requestThroughLocalProxy>> | null = null
        for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
          const proxyAvailable = await localProxyIsAvailable()
          const currentUpstream = proxyAvailable
            ? await requestThroughLocalProxy(targetUrl, 'GET', relayHeaders)
            : await fetch(targetUrl, { headers: relayHeaders, redirect: 'manual' }).then(async (result) => ({
                status: result.status,
                headers: Object.fromEntries(result.headers.entries()),
                body: Buffer.from(await result.arrayBuffer()),
              }))
          upstream = currentUpstream
          if (![301, 302, 303, 307, 308].includes(currentUpstream.status)) break
          const location = currentUpstream.headers.location
          if (!location || redirectCount === 5) throw new Error('media redirect limit exceeded')
          const redirected = new URL(Array.isArray(location) ? location[0] : location, targetUrl)
          if (!mediaHostAllowed(redirected)) throw new Error('redirected media host not allowed')
          targetUrl = redirected
        }
        if (!upstream) throw new Error('media upstream unavailable')
        response.statusCode = upstream.status
        const contentType = upstream.headers['content-type']
        if (contentType) response.setHeader('content-type', contentType)
        const contentLength = upstream.headers['content-length']
        if (contentLength) response.setHeader('content-length', contentLength)
        response.setHeader('content-length', upstream.body.length)
        response.end(upstream.body)
      } catch (error) {
        response.statusCode = 502
        response.end(error instanceof Error ? error.message : String(error))
      }
    })
  },
}

export default defineConfig({
  plugins: [react(), disyLabRightsBannerPlugin, apiYiMediaRelayPlugin],
  server: {
    port: 1420,
    host: '127.0.0.1',
    strictPort: true,
  },
  build: {
    sourcemap: false,
    minify: true,
    cssMinify: true,
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const moduleId = id.replaceAll('\\', '/')
          if (moduleId.includes('/react/') || moduleId.includes('/react-dom/')) return 'react-vendor'
          if (moduleId.includes('/@xyflow/')) return 'canvas-vendor'
          if (moduleId.includes('/framer-motion/') || moduleId.includes('/gsap/') || moduleId.includes('/@gsap/')) return 'motion-vendor'
          if (moduleId.includes('/lucide-react/')) return 'ui-vendor'
        },
      },
    },
  },
})
