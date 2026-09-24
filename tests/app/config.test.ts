/* Runtime config (ADR-0008): config.json re-points a build; secrets are refused. */
import { describe, it, expect } from 'vitest'
import { resolveConfig, DEFAULT_STORY_ORIGIN } from '../../apps/web/src/lib/config'

describe('resolveConfig', () => {
  it('defaults to the single-origin story host', () => {
    const r = resolveConfig(null)
    expect(r.config.storyOrigin).toBe(DEFAULT_STORY_ORIGIN)
    expect(r.source).toBe('default')
  })
  it('reads storyOrigin, repo, and Supabase from config.json', () => {
    const r = resolveConfig({ storyOrigin: 'https://stories.example.pages.dev/', githubRepo: 'me/storyframe', supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'x'.repeat(40) })
    expect(r.config).toEqual({ storyOrigin: 'https://stories.example.pages.dev', githubRepo: 'me/storyframe', supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'x'.repeat(40) })
    expect(r.source).toBe('config.json')
    expect(r.warnings).toEqual([])
  })
  it('lets the build-time env override the story origin (npm run dev)', () => {
    expect(resolveConfig({ storyOrigin: '/stories-host' }, { VITE_STORY_ORIGIN: 'http://localhost:4174' }).config.storyOrigin).toBe('http://localhost:4174')
  })
  it('refuses anything that looks like a secret, and never copies it', () => {
    const r = resolveConfig({ storyOrigin: '/s', githubToken: 'ghp_x', serviceRoleKey: 'y' })
    expect(r.warnings.join()).toMatch(/githubToken.*public/)
    expect(r.warnings.join()).toMatch(/serviceRoleKey/)
    expect(JSON.stringify(r.config)).not.toMatch(/ghp_x|"y"/)
  })
  it('flags placeholders and malformed values instead of using them', () => {
    expect(resolveConfig({ storyOrigin: 'https://YOUR-STORIES.pages.dev' }).warnings.join()).toMatch(/placeholder/)
    expect(resolveConfig({ storyOrigin: 'javascript:alert(1)' }).config.storyOrigin).toBe(DEFAULT_STORY_ORIGIN)
    expect(resolveConfig({ supabaseUrl: 'http://evil.example' }).config.supabaseUrl).toBeUndefined()
    expect(resolveConfig({ githubRepo: 'not a repo' }).config.githubRepo).toBeUndefined()
    expect(resolveConfig([1, 2]).warnings.join()).toMatch(/not an object/)
  })
})
