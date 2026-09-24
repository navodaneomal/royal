/* Accessible modal: labelled, focus-trapped, Esc to close, focus restored to
   whatever opened it. Used by every dialog, drawer, and overlay in the shell. */
import React, { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active: boolean, onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) { e.stopPropagation(); onEscape(); return }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const [a, z] = [items[0], items[items.length - 1]]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    node?.addEventListener('keydown', onKey)
    return () => { node?.removeEventListener('keydown', onKey); opener?.focus?.() }
  }, [active])
  return ref
}

export function Dialog({ title, onClose, children, wide, labelledBy, className = '' }: {
  title?: string; onClose?: () => void; children: React.ReactNode; wide?: boolean; labelledBy?: string; className?: string
}) {
  const ref = useFocusTrap(true, onClose)
  const id = labelledBy ?? 'dlg-' + (title ?? 'x').replace(/\W+/g, '-').toLowerCase()
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div ref={ref} className={`dialog ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        {title && <h2 id={id}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
