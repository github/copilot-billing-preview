import type { DragEvent, KeyboardEvent, MouseEvent } from 'react'
import { MarkGithubIcon, UploadIcon, LockIcon } from '@primer/octicons-react'
import { appLinks } from '../config/links'

export interface UploadPageProps {
  dragActive: boolean
  isProcessing: boolean
  progress: number
  rowsProcessed: number
  error: string | null
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void
  onClickDropzone: (event?: MouseEvent | KeyboardEvent) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function UploadPage({
  dragActive,
  isProcessing,
  progress,
  rowsProcessed,
  error,
  onDrop,
  onDragOver,
  onDragLeave,
  onClickDropzone,
  onKeyDown,
}: UploadPageProps) {
  const zoneBase =
    'relative border-2 border-dashed rounded-[16px] text-center ' +
    'py-7 px-5 sm:py-10 sm:px-8 ' +
    'transition-[border-color,background,transform] duration-200 ease-in-out'

  const zoneState = isProcessing
    ? 'cursor-default border-border-accent bg-bg-accent-muted'
    : dragActive
      ? 'cursor-pointer border-border-accent bg-bg-accent-muted'
      : 'cursor-pointer border-border-default bg-bg-muted hover:border-border-emphasis hover:bg-bg-muted'

  const zoneFocus = isProcessing
    ? ''
    : 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-accent'

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 py-6 px-4 sm:pt-12 sm:px-6 sm:pb-8 bg-bg-muted">
      <div className="max-w-[760px] w-full text-center bg-bg-default border border-border-default rounded-[16px] shadow-[0_8px_24px_rgba(31,35,40,0.08)] py-8 px-5 sm:py-12 sm:px-10">
        <MarkGithubIcon size={48} className="block mx-auto mb-4 text-fg-default" aria-hidden />
        <h1 className="m-0 mb-3 text-[26px] sm:text-[32px] leading-[1.2] text-fg-default font-bold">Copilot Billing Preview</h1>
        <p className="mx-auto mb-8 max-w-[640px] text-fg-muted text-[15px] leading-[1.7]">
          GitHub is moving to <strong>usage-based billing</strong> for Copilot. Starting June 1, 2026, your usage
          will be measured and billed in AI Credits instead of Premium Requests. This tool helps you
          understand how the change will impact your bill.
        </p>
        <p className="mx-auto mb-8 max-w-[640px] text-fg-muted text-[15px] leading-[1.7]">
          Upload your usage report to preview what your billing would look like under the new
          pricing model. Enterprise Admins or Billing Managers can download the CSV from{' '}
          <strong>Billing and licensing → Preview your billing impact → Download CSV</strong>.
        </p>
        <p className="mx-auto mb-8 max-w-[640px] text-fg-muted text-[15px] leading-[1.7]">
          <a href={appLinks.usageBasedBillingBlog} target="_blank" rel="noopener noreferrer">
            Learn more about usage-based billing &rarr;
          </a>
        </p>
        {error && (
          <div
            className="mb-4 px-4 py-3 bg-bg-attention-muted border border-border-attention rounded-md text-[color:var(--fgColor-attention)] text-[14px] text-center"
            role="alert"
          >
            ⚠️ {error}
          </div>
        )}
        <section
          className={`${zoneBase} ${zoneState} ${zoneFocus}`}
          onDrop={isProcessing ? undefined : onDrop}
          onDragOver={isProcessing ? undefined : onDragOver}
          onDragLeave={isProcessing ? undefined : onDragLeave}
          onClick={isProcessing ? undefined : onClickDropzone}
          role="button"
          tabIndex={isProcessing ? -1 : 0}
          onKeyDown={isProcessing ? undefined : onKeyDown}
          aria-label={isProcessing ? 'Processing CSV file' : 'Upload CSV file'}
          aria-disabled={isProcessing || undefined}
          aria-busy={isProcessing || undefined}
        >
          <div className="pointer-events-none flex flex-col gap-3 items-center">
            {isProcessing ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-default border border-border-default mb-1" aria-hidden="true">
                  <div className="w-8 h-8 border-[3px] border-solid border-border-default border-t-border-accent rounded-full animate-spin" />
                </div>
                <div className="flex flex-col items-center gap-3 w-full">
                  <h3 className="m-0 font-semibold text-fg-default text-[18px] sm:text-[20px]">Processing file…</h3>
                  <div
                    className="w-[220px] h-[6px] bg-bg-neutral-muted rounded-sm overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-valuetext={rowsProcessed > 0 ? `${rowsProcessed.toLocaleString()} rows processed` : undefined}
                  >
                    <div
                      className="h-full bg-bg-accent-emphasis rounded-sm transition-[width] duration-150 ease-in-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {rowsProcessed > 0 && (
                    <p className="m-0 text-fg-muted text-[14px]">
                      {rowsProcessed.toLocaleString()} rows processed
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-default border border-border-default mb-1" aria-hidden="true">
                  <UploadIcon size={40} className="fill-fg-muted" aria-hidden />
                </div>
                <h3 className="m-0 font-semibold text-fg-default text-[18px] sm:text-[20px]">Drop your CSV here or click to browse</h3>
                <p className="m-0 text-fg-muted text-[14px]">premiumRequestUsageReport_*.csv</p>
              </>
            )}
          </div>
        </section>
        <p className="mt-4 mb-0 text-fg-muted text-[13px]">Accepted: .csv files from the Premium Request Usage report</p>
        <section className="mt-6 px-6 py-5 text-left border border-border-default rounded-lg bg-bg-muted" aria-label="Privacy notice">
          <h4 className="m-0 mb-3 flex items-center gap-2 text-[16px] text-fg-default">
            <LockIcon size={16} className="text-app-savings-fg" aria-hidden />
            <span className="font-bold">Your data stays private</span>
          </h4>
          <ul className="m-0 list-none pl-0 text-fg-muted text-[14px] leading-[1.7]">
            <li className="flex gap-2"><span aria-hidden="true">*</span><span>All processing happens in your browser. Your CSV is never uploaded to any server.</span></li>
            <li className="flex gap-2"><span aria-hidden="true">*</span><span>No data is stored, cached, or sent over the network.</span></li>
            <li className="flex gap-2"><span aria-hidden="true">*</span><span>When you close this tab, your data is gone.</span></li>
            <li className="flex gap-2"><span aria-hidden="true">*</span><span>This page makes zero external network requests with your data.</span></li>
          </ul>
        </section>
      </div>
      <footer className="text-center text-fg-muted text-[12px] leading-[1.6] pt-6 px-4 pb-10 max-w-[960px] mx-auto w-full">
        This is a preview based on your uploaded usage data. Actual bills may differ.
        <br />
        Your data never leaves your browser. Something is not right?{' '}
        <a className="no-underline hover:underline" href={appLinks.issues} target="_blank" rel="noopener noreferrer">
          Submit an issue
        </a>
        .
      </footer>
    </main>
  )
}
