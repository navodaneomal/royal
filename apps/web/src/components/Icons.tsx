/* A handful of inline icons — decorative (aria-hidden); every control that
   uses one also has a text label or aria-label. */
import React from 'react'
const I = (d: React.ReactNode) => (p: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
export const SearchIcon = I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>)
export const DownloadIcon = I(<><path d="M12 4v11m-5-5 5 5 5-5" /><path d="M5 20h14" /></>)
export const BookIcon = I(<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>)
export const ExpandIcon = I(<><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>)
export const BookmarkIcon = I(<path d="M6 3h12v18l-6-4-6 4z" />)
export const CloseIcon = I(<path d="M6 6l12 12M18 6 6 18" />)
export const FilterIcon = I(<path d="M4 5h16l-6 8v6l-4-2v-4z" />)
export const ShelfIllustration = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 52h48M12 52V20h8v32M22 52V14h8v38M34 52l6-30 7 2-6 28" /><path d="M8 56h48" strokeOpacity=".4" />
  </svg>
)
