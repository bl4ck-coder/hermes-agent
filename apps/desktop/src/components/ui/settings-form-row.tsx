/**
 * P17 (judge consult): one settings form row for App Settings and Ops Settings.
 * label → control → help → error → save status, in that order. Wide panels: label left, everything else in one
 * start-aligned column. Narrow panels (by container, not window): stacked. Slots only, with no API or persistence knowledge.
 */
import type { ReactNode } from 'react'

export function settingsRowIds(id: string) {
  return { label: `${id}-label`, help: `${id}-help`, error: `${id}-error` }
}

export function SettingsFormRow({
  id,
  label,
  help,
  error,
  status,
  children,
  wide
}: {
  /** Base id; the control should use `${id}` (native) or aria-labelledby `${id}-label` (custom). */
  id: string
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  /** Save state next to the field ("Saved automatically", "Saving…", result). */
  status?: ReactNode
  children: ReactNode
  /** Text editors and long fields may use the full control column. */
  wide?: boolean
}) {
  const ids = settingsRowIds(id)

  return (
    <div data-settings-form-row="" data-settings-form-row-invalid={error ? '' : undefined} data-settings-form-row-wide={wide ? '' : undefined}>
      <label data-sfr-label="" htmlFor={id} id={ids.label}>
        {label}
      </label>
      <div data-sfr-body="">
        <div data-sfr-control="">{children}</div>
        {help ? (
          <p data-sfr-help="" id={ids.help}>
            {help}
          </p>
        ) : null}
        {error ? (
          <p data-sfr-error="" id={ids.error} role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <p aria-live="polite" data-sfr-status="">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function SettingsFormGroup({ title, children, id }: { title: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} data-settings-form-group={id ?? ''}>
      <h4 data-settings-form-group-title="" id={id ? `${id}-title` : undefined}>
        {title}
      </h4>
      <div data-settings-form-rows="">{children}</div>
    </section>
  )
}
