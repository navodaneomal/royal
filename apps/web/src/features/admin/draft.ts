/* Wizard autosave: every change lands in IndexedDB ('drafts' store), so a
   closed tab never loses work. Discarding is always an explicit action. */
import { all, get, put, del } from '../../lib/idb'

export type Lane = 'quick' | 'crafted' | 'prebuilt'
export type Draft = {
  id: string
  lane: Lane | null
  step: number
  files: [string, Uint8Array][]        // the story folder being authored
  manifest: Record<string, any>        // source storyframe.json
  a11y: Record<string, boolean>
  cover: { palette: string; motif: string; typeface: string; subtitle: string; mode: 'generated' | 'uploaded' | 'existing' }
  theme: string
  createdAt: string
  updatedAt: string
  published?: { commitSha: string; at: string; releaseId?: string }
}

export const listDrafts = async (): Promise<Draft[]> =>
  (await all('drafts')).map((r) => r.value as Draft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
export const loadDraft = (id: string) => get<Draft>('drafts', id)
export const saveDraft = (d: Draft) => put('drafts', d.id, { ...d, updatedAt: new Date().toISOString() })
export const discardDraft = (id: string) => del('drafts', id)
