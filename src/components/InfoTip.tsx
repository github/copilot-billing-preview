import { useState, useRef, useEffect, useId, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { InfoIcon } from '@primer/octicons-react'

type InfoTipProps = {
  text: string
  buttonLabel?: string
  className?: string
}

type PopoverPosition = {
  left: number
  top: number
}

const POPOVER_GAP = 6
const VIEWPORT_PADDING = 8

export function InfoTip({ text, buttonLabel = 'More info', className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const popoverId = useId()

  const updatePosition = () => {
    const trigger = ref.current
    const popover = popoverRef.current
    if (!trigger || !popover) return

    const triggerRect = trigger.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const spaceBelow = window.innerHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    const shouldOpenAbove = spaceBelow < popoverRect.height + POPOVER_GAP && spaceAbove > spaceBelow
    const centeredLeft = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2
    const left = Math.min(
      Math.max(centeredLeft, VIEWPORT_PADDING),
      window.innerWidth - popoverRect.width - VIEWPORT_PADDING,
    )
    const top = shouldOpenAbove
      ? Math.max(triggerRect.top - popoverRect.height - POPOVER_GAP, VIEWPORT_PADDING)
      : Math.min(triggerRect.bottom + POPOVER_GAP, window.innerHeight - popoverRect.height - VIEWPORT_PADDING)

    setPosition({ left, top })
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [open])

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return

    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <span className={`relative inline-flex items-center ml-1 align-middle ${className}`.trim()} ref={ref}>
      <button
        type="button"
        className="inline-flex items-center p-[2px] border-none bg-transparent cursor-pointer text-fg-muted rounded-full hover:text-fg-accent hover:bg-bg-accent-muted"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-describedby={open ? popoverId : undefined}
      >
        <InfoIcon size={14} aria-hidden />
      </button>
      {open && createPortal(
        <span
          id={popoverId}
          ref={popoverRef}
          role="tooltip"
          className="fixed z-[100] min-w-[220px] max-w-[320px] py-2 px-3 text-xs font-normal leading-normal text-fg-default bg-bg-default border border-border-default rounded-md shadow-[0_3px_12px_rgba(0,0,0,0.12)] whitespace-normal pointer-events-auto"
          style={{
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}
