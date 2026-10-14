/**
 * O67 (P8 b6): Kanban task ids (`t_` + hex) in a Desktop chat transcript become
 * links into the Ops task tab (`#/ops/task/<id>`). A remark plugin, so code
 * spans, code blocks and existing links are never rewritten.
 */
export const OPS_TASK_ID_RE = /\bt_[0-9a-f]{6,32}\b/g

const OPS_TASK_HREF_RE = /^#\/ops\/task\/(t_[0-9a-f]{6,32})$/

export function opsTaskHref(id: string): string {
  return `#/ops/task/${id}`
}

export function opsTaskIdFromHref(href: string | null | undefined): string | null {
  const m = href ? OPS_TASK_HREF_RE.exec(href) : null

  return m ? m[1] : null
}

interface MdNode {
  type: string
  value?: string
  url?: string
  children?: MdNode[]
}

const SKIP = new Set(['link', 'linkReference', 'inlineCode', 'code', 'html', 'definition'])

export function linkifyTaskIds(text: string): MdNode[] | null {
  OPS_TASK_ID_RE.lastIndex = 0
  const out: MdNode[] = []
  let last = 0
  let m: RegExpExecArray | null

  while ((m = OPS_TASK_ID_RE.exec(text))) {
    if (m.index > last) {
      out.push({ type: 'text', value: text.slice(last, m.index) })
    }

    out.push({ type: 'link', url: opsTaskHref(m[0]), children: [{ type: 'text', value: m[0] }] })
    last = m.index + m[0].length
  }

  if (!out.length) {
    return null
  }

  if (last < text.length) {
    out.push({ type: 'text', value: text.slice(last) })
  }

  return out
}

function walk(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) {
    return
  }

  const next: MdNode[] = []

  for (const child of node.children) {
    const parts = child.type === 'text' && child.value ? linkifyTaskIds(child.value) : null

    if (parts) {
      next.push(...parts)
    } else {
      walk(child)
      next.push(child)
    }
  }

  node.children = next
}

export function remarkOpsTaskLinks() {
  return (tree: MdNode) => walk(tree)
}
