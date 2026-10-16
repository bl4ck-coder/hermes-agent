import { compactNumber } from '@hermes/shared'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { CountSkeleton } from '@/components/ui/skeleton'
import { getSkillContent, type ProfileScope, profileScopeKey } from '@/hermes'
import { useI18n } from '@/i18n'
import type { SkillInfo } from '@/types/hermes'

import { PanelPill } from '../../overlays/panel'
import { asText, prettyName } from '../../settings/helpers'
import { DetailHeader } from '../primitives'

import { parseFrontmatter } from './frontmatter'
import { isEditableProvenance } from './skill-provenance'
import { categoryFor, usageOf } from './skills-data'

const unquote = (s: string) =>
  s
    .trim()
    .replace(/^(['"])([\s\S]*)\1$/, '$2')
    .trim()

/** P25 (judge pass 19): the header already names the skill and says what it does. The document starts with its own content:
 *  frontmatter `name`/`description` that repeat the header are dropped, and so is a leading `# <name>` heading. */
export function documentParts(
  content: string,
  name: string,
  description: string
): { body: string; meta: [string, string][] } {
  const { body, meta } = parseFrontmatter(content)

  const repeats = ([key, value]: [string, string]) =>
    (key === 'name' && unquote(value) === name) ||
    (key === 'description' &&
      !!description &&
      unquote(value).replace(/\s+/g, ' ') === description.trim().replace(/\s+/g, ' '))

  const heading = /^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/.exec(body)

  const lead =
    heading && heading[1].trim().toLowerCase() === name.trim().toLowerCase() ? body.slice(heading[0].length) : body

  return { body: lead, meta: meta.filter(m => !repeats(m)) }
}

export function SkillDetail({
  onArchive,
  onEdit,
  profile,
  skill
}: {
  onArchive: () => void
  onEdit: () => void
  profile?: ProfileScope
  skill: SkillInfo
}) {
  const { t } = useI18n()
  // Origin only, never mutability: external mounts stay editable in place —
  // see ./skill-provenance (commit 8c8fc6c1ec).
  const editable = isEditableProvenance(skill.provenance)

  // The FULL skill — frontmatter metadata + complete SKILL.md body — for any
  // provenance, scoped to the Capabilities profile selector. The row list only
  // carries name/description; the pane shows the whole thing.
  const contentQuery = useQuery({
    queryKey: ['skill-content', skill.name, profileScopeKey(profile)],
    queryFn: () => getSkillContent(skill.name, profile),
    staleTime: 60_000
  })

  const description = asText(skill.description)

  const parsed = useMemo(
    () => (contentQuery.data ? documentParts(contentQuery.data.content, skill.name, description) : null),
    [contentQuery.data, skill.name, description]
  )

  return (
    <div className="flex w-full max-w-(--width-reading) flex-col gap-4" data-skill-column="">
      <DetailHeader
        description={description || t.skills.noDescription}
        pills={
          <>
            <PanelPill>{prettyName(categoryFor(skill))}</PanelPill>
            {(skill.provenance === 'agent' || skill.provenance === 'hub') && (
              <PanelPill tone={skill.provenance === 'agent' ? 'good' : 'muted'}>
                {t.skills.provenance[skill.provenance]}
              </PanelPill>
            )}
            {/* P25: usage moved here from the side list, which keeps only the state that changes a decision (on/off). */}
            {usageOf(skill) > 0 && <PanelPill tone="muted">{`\u00d7${compactNumber(usageOf(skill))}`}</PanelPill>}
          </>
        }
        title={skill.name}
      />
      {editable && (
        <div className="flex items-center gap-2">
          <Button onClick={onEdit} size="sm" variant="outline">
            {t.skills.edit}
          </Button>
          <Button className="text-destructive hover:text-destructive" onClick={onArchive} size="sm" variant="text">
            {t.skills.archive}
          </Button>
        </div>
      )}
      {contentQuery.isLoading ? (
        <div aria-busy="true" aria-label={t.skills.loading} data-skill-loading="">
          <CountSkeleton />
        </div>
      ) : contentQuery.isError ? (
        // P8: a failed load says so and offers a retry instead of an empty pane.
        <div
          className="flex items-center gap-3 text-(length:--type-meta) text-(--ui-text-secondary)"
          data-skill-load-error=""
          role="alert"
        >
          <span>{contentQuery.error instanceof Error ? contentQuery.error.message : String(contentQuery.error)}</span>
          <Button onClick={() => void contentQuery.refetch()} size="sm" variant="outline">
            {t.skills.refresh}
          </Button>
        </div>
      ) : parsed ? (
        <pre
          className="overflow-auto whitespace-pre-wrap wrap-break-word font-sans text-(length:--type-body) leading-(--type-reading-lh) text-foreground"
          data-selectable-text="true"
        >
          {parsed.body.trim() || t.skills.noDescription}
        </pre>
      ) : null}
      {/* P25: remaining frontmatter (version, author, …) is reference, after the document, not before it. */}
      {parsed && parsed.meta.length > 0 && (
        <dl className="grid gap-1 border-t border-(--ui-stroke-tertiary) pt-3" data-skill-meta="">
          {parsed.meta.map(([key, value]) => (
            <div className="flex gap-3 text-(length:--type-meta) leading-(--type-meta-lh)" key={key}>
              <dt className="w-28 shrink-0 font-medium text-(--ui-text-tertiary)">{key}</dt>
              <dd className="m-0 min-w-0 whitespace-pre-wrap break-words text-(--ui-text-secondary)">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
