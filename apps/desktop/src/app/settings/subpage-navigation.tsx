import { useI18n } from '@/i18n'

import { PAGE_INSET_X } from '../layout-constants'
import { OverlayBreadcrumbHeader } from '../overlays/overlay-breadcrumb-header'
import type { OverlayNavGroup, OverlayNavLink } from '../overlays/overlay-split-layout'

export function SettingsSubpageHeader({ group, child }: { group: OverlayNavGroup; child?: OverlayNavLink }) {
  const { t } = useI18n()

  // A third rail level (a plugin's sub-page under Settings ▸ Plugins).
  const grandchild = child?.children?.find(link => link.active)

  const title = (grandchild ?? child ?? group).label

  // P10: the breadcrumb orients; the category title names the page, on the same axis as the form.
  return (
    <div className={PAGE_INSET_X}>
    <div className="mx-auto w-full max-w-(--width-form) [&>div:first-child]:px-0" data-settings-page-head="">
      <OverlayBreadcrumbHeader child={child} grandchild={grandchild} group={group} rootLabel={t.commandCenter.settings} />
      <h1 className="mt-1 mb-2 text-(length:--type-page) leading-(--type-page-lh) font-semibold text-foreground" data-settings-page-title="">
        {title}
      </h1>
    </div>
    </div>
  )
}
