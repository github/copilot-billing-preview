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
      <div className="upload-content">
        <h2 className="upload-content__title">Upload a Report</h2>
        <p className="upload-content__description">
          Drop a Copilot token billing CSV report to stream it and analyze usage data.
        </p>
        <section
          className={`dropzone ${dragActive ? 'dropzone--active' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={onClickDropzone}
          role="button"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <div className="dropzone__content">
            <div className="dropzone__icon" aria-hidden>
              📄
            </div>
            <p className="dropzone__title">Drag &amp; drop your CSV here</p>
            <p className="dropzone__hint">or click to browse</p>
          </div>
        </section>
        <p className="upload-content__attribution">
          <a target="_blank" href="https://icons8.com/icon/s6BMuiR0tvY2/github-copilot" rel="noreferrer">
            Github Copilot
          </a>
          {' '}
          icon by
          {' '}
          <a target="_blank" href="https://icons8.com" rel="noreferrer">
            Icons8
          </a>
        </p>
      </div>
    </main>
  )
}
