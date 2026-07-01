import { InfoIcon } from '@primer/octicons-react'
import { appLinks } from '../config/links'

type DeprecationBannerProps = {
  className?: string
}

export function DeprecationBanner({ className = '' }: DeprecationBannerProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-border-attention bg-bg-attention-muted px-4 py-3 text-left text-sm text-fg-default ${className}`.trim()}
      role="note"
    >
      <InfoIcon size={16} className="mt-0.5 shrink-0 fill-[color:var(--fgColor-attention)]" aria-hidden />
      <p className="m-0 leading-relaxed">
        <strong>The Copilot Billing Preview app will be retired on August 3, 2026.</strong>
        <br />
        If you use it to review your GitHub Copilot spend, you can get the same visibility, and more, directly in your
        GitHub billing settings.
        {' '}
        If you want to maintain a copy of the app,{' '}
        <a href={appLinks.copilotBillingPreviewRepository} target="_blank" rel="noopener noreferrer">
          <strong>feel free to fork it</strong>
        </a>
        .
      </p>
    </div>
  )
}
