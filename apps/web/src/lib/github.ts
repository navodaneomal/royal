/* A small GitHub REST client for the Admin Studio (Git is the CMS, ADR-0005).
   Fine-grained PAT, this repository only: Contents read/write (one commit
   per publish) and Actions read/write (operator actions + live run status).
   api.github.com supports CORS, so the browser talks to it directly. */
import { planStoryCommit, publishCommitMessage, toBase64 } from '@storyframe/publishing'

export type Run = {
  id: number; name: string; display_title: string; status: string; conclusion: string | null
  html_url: string; created_at: string; updated_at: string; event: string; head_sha: string; actor?: { login: string }
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export class GitHub {
  constructor(public token: string, public repo: string) {}

  async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`https://api.github.com${path.startsWith('/repos') || path.startsWith('/user') ? path : `/repos/${this.repo}${path}`}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 204) return undefined as T
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) {
      const hint = res.status === 401 ? 'token rejected — paste a fresh fine-grained token'
        : res.status === 403 ? 'token lacks a permission (needs Contents RW + Actions RW on this repo) or rate-limited'
        : res.status === 404 ? 'repository not found — check owner/name and that the token covers it'
        : res.status === 409 ? 'the branch moved while publishing — try again'
        : res.status === 422 ? (data?.message ?? 'rejected')
        : data?.message ?? res.statusText
      throw new GitHubError(res.status, `GitHub ${res.status}: ${hint}`)
    }
    return data as T
  }

  /** Who am I, and what may this token do on the repo? */
  async check() {
    const repo = await this.request<any>('GET', `/repos/${this.repo}`)
    return { fullName: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, push: !!repo.permissions?.push, htmlUrl: repo.html_url }
  }

  /** Existing files under stories/<slug>/ on a branch. */
  async storyTree(branch: string, slug: string) {
    const ref = await this.request<any>('GET', `/git/ref/heads/${encodeURIComponent(branch)}`)
    const commit = await this.request<any>('GET', `/git/commits/${ref.object.sha}`)
    const tree = await this.request<any>('GET', `/git/trees/${commit.tree.sha}?recursive=1`)
    const prefix = `stories/${slug}/`
    return {
      head: ref.object.sha, baseTree: commit.tree.sha,
      existing: (tree.tree as any[]).filter((e) => e.type === 'blob' && e.path.startsWith(prefix)).map((e) => ({ path: e.path, sha: e.sha })),
      truncated: !!tree.truncated,
    }
  }

  /**
   * Publish = one commit to `stories/<slug>/` on the source branch
   * ("publish(<slug>): v<version>"); CI builds it to beta.
   */
  async publishStory({ branch, slug, version, files, onProgress }: {
    branch: string; slug: string; version: string; files: Map<string, Uint8Array>; onProgress?: (msg: string) => void
  }) {
    onProgress?.('Reading the branch…')
    const t = await this.storyTree(branch, slug)
    const plan = planStoryCommit({ slug, files, existing: t.existing })
    const entries: any[] = []
    let n = 0
    for (const u of plan.upserts) {
      onProgress?.(`Uploading ${++n}/${plan.upserts.length}: ${u.path.slice(`stories/${slug}/`.length)}`)
      const blob = await this.request<any>('POST', '/git/blobs', { content: toBase64(u.bytes), encoding: 'base64' })
      entries.push({ path: u.path, mode: '100644', type: 'blob', sha: blob.sha })
    }
    for (const path of plan.deletes) entries.push({ path, mode: '100644', type: 'blob', sha: null })
    onProgress?.('Writing one commit…')
    const tree = await this.request<any>('POST', '/git/trees', { base_tree: t.baseTree, tree: entries })
    const message = publishCommitMessage(slug, version)
    const commit = await this.request<any>('POST', '/git/commits', { message, tree: tree.sha, parents: [t.head] })
    await this.request('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false })
    return { commitSha: commit.sha, message, deleted: plan.deletes.length, uploaded: plan.upserts.length, skipped: plan.skipped, htmlUrl: commit.html_url }
  }

  /** Operator action → workflow_dispatch; returns the run id when GitHub provides one. */
  async dispatch(workflow: string, ref: string, inputs: Record<string, string>) {
    const res = await this.request<any>('POST', `/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, { ref, inputs })
    return { runId: res?.workflow_run_id as number | undefined, htmlUrl: res?.html_url as string | undefined }
  }

  async runs(params: Record<string, string | number> = {}): Promise<Run[]> {
    const q = new URLSearchParams({ per_page: '20', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
    const res = await this.request<any>('GET', `/actions/runs?${q}`)
    return res.workflow_runs ?? []
  }
  run(id: number) { return this.request<Run>('GET', `/actions/runs/${id}`) }

  /** Find the run a dispatch started (when GitHub did not return its id). */
  async findRunByRequest(requestId: string, since: number): Promise<Run | null> {
    const list = await this.runs({ event: 'workflow_dispatch', per_page: 10 })
    return list.find((r) => r.display_title.includes(`[${requestId}]`) && Date.parse(r.created_at) >= since - 60_000) ?? null
  }
  async findRunForCommit(sha: string): Promise<Run | null> {
    const list = await this.runs({ head_sha: sha, per_page: 5 })
    return list[0] ?? null
  }
}
