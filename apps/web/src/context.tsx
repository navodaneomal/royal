/* App-wide context: preferences, toasts, overlays, and the shared catalog. */
import { createContext, useContext } from 'react'
import type { CatalogStory } from './lib/catalog'

export type AppCtx = {
  prefs: any
  updatePrefs: (patch: Record<string, unknown>) => Promise<void>
  toast: (msg: string) => void
  openPalette: () => void
  openShortcuts: () => void
  openOnboarding: () => void
  stories: CatalogStory[] | null
  catalogOffline: boolean
  catalogError: string | null
  refreshCatalog: () => Promise<void>
  admin: boolean
}
export const Ctx = createContext<AppCtx>(null as any)
export const useApp = () => useContext(Ctx)
