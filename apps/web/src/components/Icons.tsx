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
export const LibraryIcon = I(<><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="m16.5 5.2 3.8-1 3 15.5-3.8 1z" transform="translate(-2.5 0)" /></>)
export const ArchiveIcon = I(<><path d="M12 3 3.5 8 12 13l8.5-5z" /><path d="m3.5 12 8.5 5 8.5-5" /><path d="m3.5 16 8.5 5 8.5-5" /></>)
export const OfflineIcon = I(<><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97" /><path d="M12 11v8m-3-3 3 3 3-3" /></>)
export const SettingsIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.54 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1z" /></>)
export const StudioIcon = I(<><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>)
export const PlusIcon = I(<path d="M12 5v14M5 12h14" />)
export const UploadIcon = I(<><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M5 20h14" /></>)
export const PenIcon = I(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>)
export const TemplateIcon = I(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></>)
export const GlobeIcon = I(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>)
export const ShareIcon = I(<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>)
export const QrIcon = I(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></>)
export const CheckIcon = I(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const PlayIcon = I(<path d="M7 4.5v15l12-7.5z" />)
export const LinkIcon = I(<><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>)
export const ShelfIllustration = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 52h48M12 52V20h8v32M22 52V14h8v38M34 52l6-30 7 2-6 28" /><path d="M8 56h48" strokeOpacity=".4" />
  </svg>
)
