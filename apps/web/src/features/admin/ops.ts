/* Operator actions, three honest ways (the console is a window, not a
   second source of truth — every path runs the real CLI):
     github — workflow_dispatch of publish.yml; the run's live status is polled
     dev    — the local story host's dev-only /admin API (npm run dev)
     cli    — static hosting without a token: show the exact command */
import { GitHub, type Run } from '../../lib/github'
import { adminSession, probeDevAdmin, devAdmin } from '../../lib/admin'

export type OpMode = 'github' | 'dev' | 'cli'
export type OpAction = 'promote' | 'rollback' | 'disable' | 'enable' | 'publish' | 'redeploy'
export type OpUpdate = { phase: 'dispatching' | 'queued' | 'in_progress' | 'completed' | 'done' | 'error'; conclusion?: string | null; url?: string; message?: string; cli?: string }

export async function operatorMode(): Promise<OpMode> {
  const s = adminSession()
  if (s.githubToken && s.repo) return 'github'
  if (await probeDevAdmin()) return 'dev'
  return 'cli'
}
export const gh = () => { const s = adminSession(); return s.githubToken && s.repo ? new GitHub(s.githubToken, s.repo) : null }

export const cliCommand = (action: OpAction, slug: string, releaseId?: string) =>
  `npm run storyframe -- ${action} ${slug}${releaseId && action === 'promote' ? ' ' + releaseId : ''}`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Poll a run until it completes (or ~15 minutes pass). */
export async function watchRun(client: GitHub, run: Run | null, find: () => Promise<Run | null>, onUpdate: (u: OpUpdate) => void) {
  let current = run
  for (let i = 0; i < 300; i++) {
    if (!current) current = await find().catch(() => null)
    else current = await client.run(current.id).catch(() => current)
    if (current) {
      onUpdate({ phase: current.status === 'completed' ? 'completed' : (current.status as any) === 'in_progress' ? 'in_progress' : 'queued', conclusion: current.conclusion, url: current.html_url })
      if (current.status === 'completed') return current
    }
    await sleep(i < 10 ? 3000 : 6000)
  }
  onUpdate({ phase: 'error', message: 'Stopped watching after 15 minutes — open the run on GitHub.' })
  return current
}

export async function runOp(action: OpAction, args: { slug: string; releaseId?: string; channel?: string }, onUpdate: (u: OpUpdate) => void) {
  const mode = await operatorMode()
  if (mode === 'cli') { onUpdate({ phase: 'done', cli: cliCommand(action, args.slug, args.releaseId) }); return }
  if (mode === 'dev') {
    const out = await devAdmin(action, { slug: args.slug, releaseId: args.releaseId, channel: args.channel })
    onUpdate(out.ok ? { phase: 'done', conclusion: 'success', message: `${action}: done on the dev story host` } : { phase: 'error', message: (out.errors ?? []).join('; ') })
    return
  }
  const client = gh()!
  const s = adminSession()
  const requestId = crypto.randomUUID().slice(0, 8)
  const since = Date.now()
  onUpdate({ phase: 'dispatching' })
  const d = await client.dispatch(s.workflow, s.branch, {
    action, slug: args.slug, release_id: args.releaseId ?? '', channel: args.channel ?? '', request_id: requestId,
  })
  const first = d.runId ? await client.run(d.runId).catch(() => null) : null
  await watchRun(client, first, () => client.findRunByRequest(requestId, since), onUpdate)
}
