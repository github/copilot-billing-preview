import type { DragEvent, KeyboardEvent, MouseEvent } from 'react'

export interface UploadPageProps {
  dragActive: boolean
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void
  onClickDropzone: (event?: MouseEvent | KeyboardEvent) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function UploadPage({
  dragActive,
  onDrop,
  onDragOver,
  onDragLeave,
  onClickDropzone,
  onKeyDown,
}: UploadPageProps) {
  return (
    <main className="upload-page">
      <div className="upload-screen">
        <svg className="upload-screen__logo" height="48" viewBox="0 0 16 16" width="48" fill="#24292f" aria-hidden="true">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </svg>
        <h1 className="upload-screen__title">Copilot Billing Preview</h1>
        <p className="upload-screen__subtitle">
          GitHub is moving to <strong>token-based billing</strong> for Copilot. Starting May 2026, usage
          will be measured in AI Units (AIUs) instead of Premium Requests (PRUs). This tool helps you
          understand how the change will impact your bill.
        </p>
        <p className="upload-screen__subtitle upload-screen__subtitle--spaced">
          Upload your token usage report to preview what your billing would look like under the new
          pricing. Download the report from <strong>Settings → Billing → Premium request usage</strong>.
        </p>
        <section
          className={`upload-zone ${dragActive ? 'upload-zone--active' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={onClickDropzone}
          role="button"
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label="Upload CSV file"
        >
          <div className="upload-zone__content">
            <div className="upload-zone__icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 16 16" fill="#636c76">
                <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z" />
                <path d="M11.78 4.72a.749.749 0 1 1-1.06 1.06L8.75 3.811V9.5a.75.75 0 0 1-1.5 0V3.811L5.28 5.78a.749.749 0 1 1-1.06-1.06l3.25-3.25a.749.749 0 0 1 1.06 0l3.25 3.25Z" />
              </svg>
            </div>
            <h3 className="upload-zone__title">Drop your CSV here or click to browse</h3>
            <p className="upload-zone__hint">tokenUsageReport*.csv</p>
          </div>
        </section>
        <p className="upload-accepted">Accepted: .csv files from the Premium Request Usage report</p>
        <section className="security-notice" aria-label="Privacy notice">
          <h4 className="security-notice__title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#2da44e" aria-hidden="true">
              <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z" />
            </svg>
            <span>Your data stays private</span>
          </h4>
          <ul className="security-notice__list">
            <li>All processing happens in your browser. Your CSV is never uploaded to any server.</li>
            <li>No data is stored, cached, or sent over the network.</li>
            <li>When you close this tab, your data is gone.</li>
            <li>This page makes zero external network requests with your data.</li>
          </ul>
        </section>
      </div>
      <footer className="site-footer">
        This is a preview based on your uploaded usage data. Actual bills may differ.
        <br />
        Your data never leaves your browser. Questions?{' '}
        <a href="https://support.github.com" target="_blank" rel="noreferrer">
          Contact GitHub Support
        </a>
        .
      </footer>
    </main>
  )
}
