import { UnsupportedRepositoryOperation, type ChangeRequest, type RepositoryAdapter, type RepositoryCapabilities, type RepositoryHealth } from './adapter.ts'
import { changeRequestPath } from './adapter.ts'
import { changeRequestKey, type ChangeRequestRef, type RepositoryBinding } from '../core/index.ts'
import type { RepositoryConfig } from './config.ts'

export interface GitlabTransport {
  request(path: string, init?: { method?: string; body?: Record<string, unknown> }): Promise<unknown>
}
const Item = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GitLab returned an invalid object')
  return value as Record<string, unknown>
}
const text = (value: unknown): string => typeof value === 'string' ? value : ''
export function createGitlabTransport(config: RepositoryConfig, fetcher: typeof fetch = fetch): GitlabTransport {
  const base = `https://${config.host}/api/v4`
  return {
    async request(path, init = {}) {
      const response = await fetcher(`${base}/projects/${encodeURIComponent(config.repository)}${path}`, {
        method: init.method ?? 'GET', headers: { 'PRIVATE-TOKEN': config.token, 'Content-Type': 'application/json' },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      })
      if (!response.ok) throw new Error(`GitLab API returned HTTP ${response.status}`)
      const body = await response.text()
      return body ? JSON.parse(body) as unknown : undefined
    },
  }
}
/** GitLab REST adapter for one configured project. */
export class GitlabRepositoryAdapter implements RepositoryAdapter {
  readonly provider = 'gitlab' as const
  readonly binding: RepositoryBinding
  private readonly caps: RepositoryCapabilities = { readChangeRequest: true, comment: true, pipeline: true, claim: true, close: true }
  constructor(private readonly config: RepositoryConfig, private readonly transport = createGitlabTransport(config)) {
    this.binding = { provider: 'gitlab', host: config.host, repository: config.repository, defaultBranch: config.defaultBranch }
  }
  capabilities(): RepositoryCapabilities { return this.caps }
  async health(): Promise<RepositoryHealth> {
    try { await this.transport.request(''); return { state: 'ready', detail: `GitLab ${this.config.host}/${this.config.repository}` } }
    catch (error) { return { state: 'error', detail: error instanceof Error ? error.message : String(error) } }
  }
  link(ref: ChangeRequestRef): string {
    if (ref.kind === 'pull-request') throw new UnsupportedRepositoryOperation('pull-request', this.provider)
    const path = changeRequestPath(ref.kind)
    return `https://${this.config.host}/${this.config.repository}/-/${path}/${ref.iid}`
  }
  async readChangeRequest(ref: ChangeRequestRef): Promise<ChangeRequest> {
    if (ref.kind === 'pull-request') throw new UnsupportedRepositoryOperation('pull-request', this.provider)
    const item = Item(await this.transport.request(`/${changeRequestPath(ref.kind)}/${ref.iid}`))
    const pipeline = item.head_pipeline && typeof item.head_pipeline === 'object' ? Item(item.head_pipeline) : undefined
    return { ref: { ...this.binding, kind: ref.kind, iid: ref.iid, url: text(item.web_url) || this.link(ref) }, title: text(item.title),
      description: text(item.description), state: text(item.state), author: item.author && typeof item.author === 'object' ? text(Item(item.author).username) : undefined,
      updatedAt: text(item.updated_at) || undefined, ...(pipeline ? { pipeline: { status: text(pipeline.status), url: text(pipeline.web_url) || undefined } } : {}) }
  }
  async comment(ref: ChangeRequestRef, body: string): Promise<void> {
    if (ref.kind === 'pull-request') throw new UnsupportedRepositoryOperation('pull-request', this.provider)
    await this.transport.request(`/${changeRequestPath(ref.kind)}/${ref.iid}/notes`, { method: 'POST', body: { body } })
  }
  async reportChangeRequest(ref: ChangeRequestRef, action: 'claim' | 'close'): Promise<void> {
    if (ref.kind === 'pull-request') throw new UnsupportedRepositoryOperation('pull-request', this.provider)
    if (action === 'claim') {
      // GitLab has no portable idempotency key for note creation. Search for our stable marker before posting so a
      // retried report after a successful HTTP response does not add another claim note.
      const marker = `<!-- dsh-superagent:claim ${changeRequestKey(ref)} -->`
      const notes = await this.transport.request(`/${changeRequestPath(ref.kind)}/${ref.iid}/notes?per_page=100&search=${encodeURIComponent(marker)}`)
      if (Array.isArray(notes) && notes.some(note => note && typeof note === 'object' && typeof (note as { body?: unknown }).body === 'string' && (note as { body: string }).body.includes(marker))) return
      await this.comment(ref, marker)
      return
    }
    await this.transport.request(`/${changeRequestPath(ref.kind)}/${ref.iid}`, { method: 'PUT', body: { state_event: 'close' } })
  }
}
