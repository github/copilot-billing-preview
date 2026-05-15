import { useState, useRef, useEffect, useId, useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { InfoIcon } from '@primer/octicons-react'

type InfoTipProps = {
  text: string
  buttonLabel?: string
  className?: string
  tone?: 'default' | 'danger'
}

type PopoverPosition = {
  left: number
  top: number
}

type ValidationPopoverProps = {
  id: string
  text: string | null
  children: ReactNode
}

const POPOVER_GAP = 6
const VIEWPORT_PADDING = 8
const buttonClassByTone = {
  default: 'text-fg-muted hover:text-fg-accent hover:bg-bg-accent-muted',
  danger: 'text-fg-danger hover:bg-bg-danger-muted',
}
const popoverClassByTone = {
  default: 'text-fg-default bg-bg-default border-border-default',
  danger: 'text-fg-danger bg-bg-danger-muted border-border-danger',
}

export function InfoTip({ text, buttonLabel = 'More info', className = '', tone = 'default' }: InfoTipProps) {
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
        className={`inline-flex items-center p-[2px] border-none bg-transparent cursor-pointer rounded-full ${buttonClassByTone[tone]}`}
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
          className={`fixed z-[100] min-w-[220px] max-w-[320px] py-2 px-3 text-xs font-normal leading-normal border rounded-md shadow-[0_3px_12px_rgba(0,0,0,0.12)] whitespace-normal pointer-events-auto ${popoverClassByTone[tone]}`}
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


export function ValidationPopover({ id, text, children }: ValidationPopoverProps) {
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const open = Boolean(text)

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

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open, text])

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
    <span className="relative inline-flex items-center" ref={ref}>
      {children}
      {open && createPortal(
        <span
          id={id}
          ref={popoverRef}
          role="alert"
          className={`fixed z-[100] min-w-[220px] max-w-[320px] py-2 px-3 text-xs font-normal leading-normal border rounded-md shadow-[0_3px_12px_rgba(0,0,0,0.12)] whitespace-normal pointer-events-auto ${popoverClassByTone.danger}`}
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
