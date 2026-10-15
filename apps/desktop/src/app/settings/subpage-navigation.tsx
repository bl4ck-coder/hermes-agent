import { HeroBand } from '@/components/hero-band'
import { useI18n } from '@/i18n'

import { OverlayBreadcrumbHeader } from '../overlays/overlay-breadcrumb-header'
import type { OverlayNavGroup, OverlayNavLink } from '../overlays/overlay-split-layout'

export function SettingsSubpageHeader({ group, child }: { group: OverlayNavGroup; child?: OverlayNavLink }) {
  const { t } = useI18n()

  // A third rail level (a plugin's sub-page under Settings ▸ Plugins).
  const grandchild = child?.children?.find(link => link.active)

  // B35: a lit hero naming the page you're on, with its rail icon at hero size.
  const leaf = grandchild ?? child ?? group
  const Icon = leaf.icon

  return (
    <>
      <OverlayBreadcrumbHeader child={child} grandchild={grandchild} group={group} rootLabel={t.commandCenter.settings} />
      <div className="px-4 pt-1">
        <HeroBand icon={<Icon className="size-5" />} id="settings" subtitle={leaf === group ? t.commandCenter.settings : group.label} title={leaf.label} />
      </div>
    </>
  )
}
