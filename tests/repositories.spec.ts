import { expect, it, vi } from 'vitest'
import { CnbRepositoryAdapter } from '../src/repositories/cnb.ts'
import { createRepositoryAdapter } from '../src/repositories/registry.ts'
import { createGitlabTransport, GitlabRepositoryAdapter } from '../src/repositories/gitlab.ts'
import { UnsupportedRepositoryOperation } from '../src/repositories/adapter.ts'
import { repositoryKind } from '../src/sources/repository.ts'
import { RepositoryConfigSchema } from '../src/repositories/config.ts'

const config = { provider: 'gitlab' as const, host: 'gitlab.example.com', repository: 'acme/app', token: 'secret', defaultBranch: 'main', pollSeconds: 60 }
it('builds a GitLab adapter and canonical MR links', () => {
  const request = vi.fn()
  const adapter = new GitlabRepositoryAdapter(config, { request })
  expect(adapter.link({ ...adapter.binding, kind: 'merge-request', iid: 7 })).toBe('https://gitlab.example.com/acme/app/-/merge_requests/7')
  expect(adapter.capabilities().pipeline).toBe(true)
  expect(() => adapter.link({ ...adapter.binding, kind: 'pull-request', iid: 7 })).toThrow(UnsupportedRepositoryOperation)
})

it('reads and reports GitLab merge requests through the provider transport', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ iid: 7, title: 'Fix login', description: 'Details', state: 'opened', author: { username: 'alice' },
      updated_at: '2026-11-03T10:00:00Z', web_url: 'https://gitlab.example.com/acme/app/-/merge_requests/7', head_pipeline: { status: 'success', web_url: 'https://gitlab.example.com/pipelines/9' } })
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({})
  const adapter = new GitlabRepositoryAdapter(config, { request })
  await expect(adapter.readChangeRequest({ ...adapter.binding, kind: 'merge-request', iid: 7 })).resolves.toMatchObject({ title: 'Fix login', pipeline: { status: 'success' } })
  await adapter.reportChangeRequest({ ...adapter.binding, kind: 'merge-request', iid: 7 }, 'claim')
  await adapter.reportChangeRequest({ ...adapter.binding, kind: 'merge-request', iid: 7 }, 'close')
  expect(request.mock.calls).toEqual([
    ['/merge_requests/7'],
    ['/merge_requests/7/notes?per_page=100&search=%3C!--%20dsh-superagent%3Aclaim%20gitlab%3Agitlab.example.com%3Aacme%2Fapp%3Amerge-request%3A7%20--%3E'],
    ['/merge_requests/7/notes', { method: 'POST', body: { body: '<!-- dsh-superagent:claim gitlab:gitlab.example.com:acme/app:merge-request:7 -->' } }],
    ['/merge_requests/7', { method: 'PUT', body: { state_event: 'close' } }],
  ])
})

it('does not duplicate an existing GitLab claim marker', async () => {
  const request = vi.fn().mockResolvedValue([{ body: '<!-- dsh-superagent:claim gitlab:gitlab.example.com:acme/app:merge-request:7 -->' }])
  const adapter = new GitlabRepositoryAdapter(config, { request })
  await adapter.reportChangeRequest({ ...adapter.binding, kind: 'merge-request', iid: 7 }, 'claim')
  expect(request).toHaveBeenCalledTimes(1)
})
it('selects GitLab from the provider registry', () => {
  expect(createRepositoryAdapter(config)).toBeInstanceOf(GitlabRepositoryAdapter)
})
it('uses the configured GitLab host, project encoding and private-token header', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
  const transport = createGitlabTransport(config, fetcher)
  await transport.request('/merge_requests/7', { method: 'POST', body: { body: 'hello' } })
  expect(fetcher).toHaveBeenCalledWith('https://gitlab.example.com/api/v4/projects/acme%2Fapp/merge_requests/7', {
    method: 'POST', headers: { 'PRIVATE-TOKEN': 'secret', 'Content-Type': 'application/json' }, body: '{"body":"hello"}',
  })
})
it('keeps CNB capability-only without making a network call', async () => {
  const adapter = new CnbRepositoryAdapter({ ...config, provider: 'cnb', host: 'cnb.cool' })
  await expect(adapter.readChangeRequest({ ...adapter.binding, kind: 'pull-request', iid: 1 })).rejects.toBeInstanceOf(UnsupportedRepositoryOperation)
  expect(adapter.capabilities().readChangeRequest).toBe(false)
})

it('publishes provider-neutral repository variables without exposing its token', () => {
  const config = RepositoryConfigSchema.parse({ provider: 'gitlab', host: 'gitlab.example.com', repository: 'acme/app', token: 'secret' })
  const values = repositoryKind.environment!.values({ deployment: {
    repository: 'acme/app', repositoryBinding: { provider: 'gitlab', host: 'gitlab.example.com', repository: 'acme/app', defaultBranch: 'main' },
  } as never, config })
  expect(values).toEqual({ DSH_SUPERAGENT_REPOSITORY_PROVIDER: 'gitlab', DSH_SUPERAGENT_REPOSITORY_HOST: 'gitlab.example.com',
    DSH_SUPERAGENT_REPOSITORY: 'acme/app', DSH_SUPERAGENT_REPOSITORY_DEFAULT_BRANCH: 'main' })
  expect(JSON.stringify(values)).not.toContain('secret')
})
