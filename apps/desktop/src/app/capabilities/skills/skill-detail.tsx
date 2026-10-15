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
import { categoryFor } from './skills-data'

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

  const parsed = useMemo(
    () => (contentQuery.data ? parseFrontmatter(contentQuery.data.content) : null),
    [contentQuery.data]
  )

  return (
    <div className="flex w-full max-w-(--width-reading) flex-col gap-4" data-skill-column="">
      <DetailHeader
        description={asText(skill.description) || t.skills.noDescription}
        pills={
          <>
            <PanelPill>{prettyName(categoryFor(skill))}</PanelPill>
            {(skill.provenance === 'agent' || skill.provenance === 'hub') && (
              <PanelPill tone={skill.provenance === 'agent' ? 'good' : 'muted'}>
                {t.skills.provenance[skill.provenance]}
              </PanelPill>
            )}
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
      {parsed && parsed.meta.length > 0 && (
        <dl className="grid gap-1 border-y border-(--ui-stroke-tertiary) py-3" data-skill-meta="">
          {parsed.meta.map(([key, value]) => (
            <div className="flex gap-3 text-(length:--type-meta) leading-(--type-meta-lh)" key={key}>
              <dt className="w-28 shrink-0 font-medium text-(--ui-text-tertiary)">{key}</dt>
              <dd className="m-0 min-w-0 whitespace-pre-wrap break-words text-(--ui-text-secondary)">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {contentQuery.isLoading ? (
        <div aria-busy="true" aria-label={t.skills.loading} data-skill-loading="">
          <CountSkeleton />
        </div>
      ) : contentQuery.isError ? (
        // P8: a failed load says so and offers a retry instead of an empty pane.
        <div className="flex items-center gap-3 text-(length:--type-meta) text-(--ui-text-secondary)" data-skill-load-error="" role="alert">
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
    </div>
  )
}
