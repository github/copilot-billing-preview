export type NewVersionBannerProps = {
  isVisible: boolean
  onReload: () => void
}

export function NewVersionBanner({ isVisible, onReload }: NewVersionBannerProps) {
  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-[min(540px,calc(100vw-2rem))] rounded-lg border border-border-default bg-bg-default shadow-lg p-4 flex items-center gap-4 max-sm:items-start max-sm:flex-col" role="status" aria-live="polite">
      <div className="flex-1">
        <p className="m-0 text-sm font-semibold text-fg-default">Update ready</p>
        <p className="m-0 mt-1 text-xs text-fg-muted leading-relaxed">A newer version of Billing Preview is available. Reload when you are ready; any uploaded report data will be cleared.</p>
      </div>
      <button type="button" className="shrink-0 rounded-md border border-border-default bg-bg-default px-3 py-2 text-sm font-medium text-fg-default cursor-pointer hover:bg-bg-muted focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 max-sm:w-full" onClick={onReload}>
        Reload now
      </button>
    </div>
  )
}
