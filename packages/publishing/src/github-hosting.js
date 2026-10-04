/**
 * GitHub Pages hosting — inspected, explained, and fixed with the OWNER'S
 * own token (the Studio's Hosting page, or `npm run setup:pages`).
 *
 * Pure: the network is injected as `api(method, path, body?) → {status, data}`
 * against https://api.github.com, so the browser and Node share every rule
 * and tests drive it with a fake.
 *
 * The one-time setup token needs Contents, Actions, Pages, and
 * Administration (write) for this repository; the everyday publishing token
 * needs only Contents + Actions. Links below pre-fill either form.
 */
export const PAGES_WORKFLOW = 'pages.yml'
export const SOURCE_BRANCH = 'main'

const qs = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')

export function pagesUrl(owner, repo) {
  return /\.github\.io$/i.test(repo) ? `https://${repo.toLowerCase()}/` : `https://${owner.toLowerCase()}.github.io/${repo}/`
}

/** Pre-filled fine-grained token forms (GitHub supports these query parameters). */
export function tokenLinks({ owner, repo }) {
  const base = 'https://github.com/settings/personal-access-tokens/new?'
  return {
    publishing: base + qs({ name: 'Storyframe publishing', description: `Storyframe Studio for ${owner}/${repo}: publish books and run the publish workflow.`, target_name: owner, expires_in: 90, contents: 'write', actions: 'write' }),
    setup: base + qs({ name: 'Storyframe setup (1 day)', description: `One-time GitHub Pages setup for ${owner}/${repo}.`, target_name: owner, expires_in: 1, contents: 'write', actions: 'write', pages: 'write', administration: 'write' }),
  }
}

const NEEDS = {
  repo: 'Contents: Read and write',
  main: 'Contents: Read and write',
  default: 'Administration: Read and write',
  pages: 'Pages and Administration: Read and write',
  deploy: 'Actions: Read and write',
}

/**
 * @returns {Promise<{ ok:boolean, error?:string, repo?:object, url:string|null, steps:object[], lastRun:object|null, plan:object }>}
 *   steps: [{ id, state: 'done'|'todo'|'working'|'blocked'|'info', title, detail, fixable }]
 */
export async function inspectHosting(api, repoFull) {
  const [owner, repo] = String(repoFull ?? '').split('/')
  if (!owner || !repo) return { ok: false, error: 'repo-format', url: null, steps: [], lastRun: null, plan: {} }
  const R = `/repos/${owner}/${repo}`
  const r = await api('GET', R)
  if (r.status === 401) return { ok: false, error: 'bad-token', url: null, steps: [], lastRun: null, plan: {} }
  if (r.status !== 200) return { ok: false, error: r.status === 404 ? 'not-found' : `http-${r.status}`, url: null, steps: [], lastRun: null, plan: {} }
  const info = { owner, repo, defaultBranch: r.data.default_branch, private: !!r.data.private, push: !!r.data.permissions?.push, admin: !!r.data.permissions?.admin, htmlUrl: r.data.html_url }

  const [main, def, content, pages, runs] = await Promise.all([
    api('GET', `${R}/git/ref/heads/${SOURCE_BRANCH}`),
    api('GET', `${R}/git/ref/heads/${encodeURIComponent(info.defaultBranch)}`),
    api('GET', `${R}/git/ref/heads/content`),
    api('GET', `${R}/pages`),
    api('GET', `${R}/actions/workflows/${PAGES_WORKFLOW}/runs?per_page=1`),
  ])
  const mainSha = main.status === 200 ? main.data?.object?.sha ?? null : null
  const defaultSha = def.status === 200 ? def.data?.object?.sha ?? null : null
  const workflow = await api('GET', `${R}/contents/.github/workflows/${PAGES_WORKFLOW}?ref=${encodeURIComponent(mainSha ? SOURCE_BRANCH : info.defaultBranch)}`)
  const lastRun = runs.status === 200 ? runs.data?.workflow_runs?.[0] ?? null : null

  const steps = []
  const add = (id, state, title, detail, fixable = false) => steps.push({ id, state, title, detail, fixable, needs: NEEDS[id] ?? null })

  add('repo', info.push ? 'done' : 'blocked', 'This token can write to the repository',
    info.push ? `${owner}/${repo} — ${info.private ? 'private' : 'public'}` : `The token can read ${owner}/${repo} but not write to it — give it ${NEEDS.repo}.`)

  add('main', mainSha ? 'done' : (defaultSha ? 'todo' : 'blocked'), 'A “main” branch holds the books',
    mainSha ? `main is at ${mainSha.slice(0, 7)}.` : defaultSha ? `Missing — it will be created from ${info.defaultBranch} (${defaultSha.slice(0, 7)}), the same code.` : 'The repository has no commits yet — push the project first.', !mainSha && !!defaultSha)

  const isDefault = info.defaultBranch === SOURCE_BRANCH
  add('default', isDefault ? 'done' : 'todo', '“main” is the default branch',
    isDefault ? 'Publishing and deployments run from main.' : `The default is “${info.defaultBranch}”. GitHub only lets the default branch deploy to Pages.`, !isDefault)

  const hasWorkflow = workflow.status === 200
  add('workflow', hasWorkflow ? 'done' : 'blocked', 'The Pages workflow is in the repository',
    hasWorkflow ? `.github/workflows/${PAGES_WORKFLOW} found.` : `.github/workflows/${PAGES_WORKFLOW} is missing — push the latest project code (it ships the workflow).`)

  let pagesState = 'todo'
  let pagesDetail = 'Pages is off. It will be switched on with “GitHub Actions” as the source.'
  if (pages.status === 200 && pages.data?.build_type === 'workflow') { pagesState = 'done'; pagesDetail = `On — ${pages.data.html_url ?? pagesUrl(owner, repo)}` }
  else if (pages.status === 200) { pagesDetail = 'Pages deploys from a branch. It will be switched to “GitHub Actions”.' }
  else if (pages.status === 403) { pagesState = 'blocked'; pagesDetail = `This token cannot read the Pages settings — a setup token needs ${NEEDS.pages}.` }
  add('pages', pagesState, 'GitHub Pages is on, built by GitHub Actions', pagesDetail, pagesState === 'todo')

  let deployState = 'todo'
  let deployDetail = 'Nothing deployed yet — a first deployment will be started.'
  if (lastRun) {
    if (lastRun.status !== 'completed') { deployState = 'working'; deployDetail = `Deploying now (${lastRun.status.replace('_', ' ')}).` }
    else if (lastRun.conclusion === 'success') { deployState = 'done'; deployDetail = `Last deployed ${lastRun.updated_at ?? lastRun.created_at ?? ''}.`.trim() }
    else if (lastRun.conclusion === 'skipped') { deployDetail = 'The last run skipped (Pages was off then) — a new deployment will be started.' }
    else { deployState = 'blocked'; deployDetail = `The last deployment finished: ${lastRun.conclusion}. Open the run for the log; “Fix” starts a new one.` }
  }
  add('deploy', deployState, 'The site is deployed', deployDetail, deployState === 'todo' || deployState === 'blocked')

  add('content', content.status === 200 ? 'done' : 'info', 'Published releases have their own branch',
    content.status === 200 ? '“content” keeps every release so rollback always works.' : 'Created automatically by the first publish run — nothing to do.')

  const blocking = steps.filter((s) => s.id !== 'content' && s.state !== 'done')
  return {
    ok: blocking.length === 0,
    repo: info,
    url: pages.status === 200 && pages.data?.html_url ? pages.data.html_url : pagesUrl(owner, repo),
    steps, lastRun: lastRun ? { status: lastRun.status, conclusion: lastRun.conclusion, url: lastRun.html_url } : null,
    plan: { defaultSha, mainSha, pagesStatus: pages.status, pagesBuildType: pages.data?.build_type ?? null },
  }
}

/**
 * Do every fixable step, in order, reporting each one. Never deletes or
 * rewrites anything: creates `main` from the default branch's head, makes it
 * the default, switches Pages to Actions, and starts a deployment.
 * @param {(s:{id:string, state:'working'|'done'|'failed', detail:string})=>void} [onStep]
 */
export async function fixHosting(api, report, onStep = () => {}) {
  const { owner, repo } = report.repo
  const R = `/repos/${owner}/${repo}`
  const todo = new Set(report.steps.filter((s) => s.fixable).map((s) => s.id))
  const done = []
  const step = async (id, label, call, okStatuses) => {
    onStep({ id, state: 'working', detail: label })
    const r = await call()
    if (!okStatuses.includes(r.status)) {
      const why = r.status === 403 ? `the token needs ${NEEDS[id] ?? 'more permissions'}` : r.data?.message ?? `HTTP ${r.status}`
      onStep({ id, state: 'failed', detail: `${label} — ${why}` })
      throw Object.assign(new Error(`${label}: ${why}`), { step: id, status: r.status })
    }
    onStep({ id, state: 'done', detail: label })
    done.push(id)
  }
  if (todo.has('main')) await step('main', 'Create the main branch', () => api('POST', `${R}/git/refs`, { ref: `refs/heads/${SOURCE_BRANCH}`, sha: report.plan.defaultSha }), [201])
  if (todo.has('default')) await step('default', 'Make main the default branch', () => api('PATCH', R, { default_branch: SOURCE_BRANCH }), [200])
  if (todo.has('pages')) {
    const create = report.plan.pagesStatus === 404
    await step('pages', 'Switch GitHub Pages on (source: GitHub Actions)', () => api(create ? 'POST' : 'PUT', `${R}/pages`, { build_type: 'workflow' }), create ? [201] : [204, 200])
  }
  if (todo.has('deploy') || done.length) {
    await step('deploy', 'Start a deployment', () => api('POST', `${R}/actions/workflows/${PAGES_WORKFLOW}/dispatches`, { ref: SOURCE_BRANCH }), [204])
  }
  return { done }
}
