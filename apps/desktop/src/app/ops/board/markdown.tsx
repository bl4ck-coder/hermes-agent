/**
 * Safe Markdown (ops-panel P8 b3, R17; S2). Builds React nodes only: no innerHTML, so payload HTML
 * renders as text. Links render only for http(s)/mailto; every other scheme (javascript:, data:) is text.
 * Supported: # ## ### headings, - / * / 1. lists, **bold**, *em*, `code`, ``` fences, [text](url), blank-line paragraphs.
 */

import type { ReactNode } from 'react'

const SAFE_URL = /^(https?:\/\/|mailto:)/i

export const isSafeUrl = (u: string) => SAFE_URL.test(u.trim())

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0

  while ((m = re.exec(text))) {
    if (m.index > last) {
      out.push(text.slice(last, m.index))
    }

    const s = m[0]
    const k = `${key}-${i++}`

    if (m[1]) {
      out.push(<code key={k}>{s.slice(1, -1)}</code>)
    } else if (m[2]) {
      out.push(<strong key={k}>{s.slice(2, -2)}</strong>)
    } else if (m[3]) {
      out.push(<em key={k}>{s.slice(1, -1)}</em>)
    } else {
      const label = s.slice(1, s.indexOf(']'))
      const url = s.slice(s.indexOf('(') + 1, -1)
      out.push(
        isSafeUrl(url) ? (
          <a href={url} key={k} rel="noreferrer noopener" target="_blank">
            {label}
          </a>
        ) : (
          <span data-ops-unsafe-link="" key={k}>
            {label} ({url})
          </span>
        )
      )
    }

    last = m.index + s.length
  }

  if (last < text.length) {
    out.push(text.slice(last))
  }

  return out
}

export function Markdown({ text }: { text: string | null | undefined }) {
  const src = (text ?? '').replace(/\r\n/g, '\n')

  if (!src.trim()) {
    return <p data-ops-empty="body">No description.</p>
  }

  const lines = src.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let n = 0

  while (i < lines.length) {
    const line = lines[i]
    const k = `b${n++}`

    if (line.startsWith('```')) {
      const body: string[] = []
      i++

      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i++])
      }

      i++
      blocks.push(<pre key={k}>{body.join('\n')}</pre>)

      continue
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line)

    if (h) {
      const level = h[1].length
      const kids = inline(h[2], k)
      blocks.push(level === 1 ? <h4 key={k}>{kids}</h4> : level === 2 ? <h5 key={k}>{kids}</h5> : <h6 key={k}>{kids}</h6>)
      i++

      continue
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: ReactNode[] = []

      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(<li key={`${k}-${items.length}`}>{inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''), `${k}-${items.length}`)}</li>)
        i++
      }

      blocks.push(ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>)

      continue
    }

    if (!line.trim()) {
      i++

      continue
    }

    const para: string[] = []

    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*([-*]|\d+\.)\s+)/.test(lines[i])) {
      para.push(lines[i++])
    }

    blocks.push(<p key={k}>{inline(para.join(' '), k)}</p>)
  }

  return <div data-ops-markdown="">{blocks}</div>
}
