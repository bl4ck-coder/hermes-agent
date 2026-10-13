/**
 * runs-transport.ts
 *
 * Node http(s) transport for runs-proxy.ts and ops-sse-bridge.ts (ops-panel
 * P1-06). JSON requests with a timeout, and long-lived text/event-stream reads
 * that resolve with the HTTP status when the stream ends or is aborted.
 * Standalone (no electron).
 */

import http from 'node:http'
import https from 'node:https'

import type { RunsTransport, TransportRequest, TransportStream } from './runs-proxy'

function clientFor(url: URL) {
  if (url.protocol === 'http:') {
    return http
  }

  if (url.protocol === 'https:') {
    return https
  }

  throw new Error(`unsupported protocol ${url.protocol}`)
}

export function createNodeRunsTransport(): RunsTransport {
  return {
    request(req: TransportRequest) {
      return new Promise((resolve, reject) => {
        const url = new URL(req.url)
        const body = req.body === undefined ? undefined : Buffer.from(req.body)
        const r = clientFor(url).request(
          url,
          {
            method: req.method,
            headers: { ...req.headers, ...(body ? { 'Content-Length': String(body.length) } : {}) }
          },
          res => {
            const chunks: Buffer[] = []
            res.on('data', c => chunks.push(c))
            res.on('error', reject)
            res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }))
          }
        )
        r.setTimeout(req.timeoutMs ?? 20_000, () => r.destroy(new Error('request timed out')))
        r.on('error', reject)
        r.end(body)
      })
    },

    stream(req: TransportStream) {
      return new Promise(resolve => {
        if (req.signal.aborted) {
          resolve({ status: 0 })

          return
        }

        let status = 0
        let settled = false
        const finish = () => {
          if (!settled) {
            settled = true
            resolve({ status })
          }
        }

        const url = new URL(req.url)
        const r = clientFor(url).request(url, { method: 'GET', headers: req.headers }, res => {
          status = res.statusCode || 0
          res.setEncoding('utf8')

          if (status >= 400) {
            res.resume()
          } else {
            res.on('data', (c: string) => req.onChunk(c))
          }

          res.on('end', finish)
          res.on('close', finish)
          res.on('error', finish)
        })
        r.on('error', finish)
        req.signal.addEventListener('abort', () => {
          r.destroy()
          finish()
        })
        r.end()
      })
    }
  }
}
