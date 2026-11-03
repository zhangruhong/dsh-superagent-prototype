import { expect, it, vi } from 'vitest'
import { CnbRepositoryAdapter } from '../src/repositories/cnb.ts'
import { createRepositoryAdapter } from '../src/repositories/registry.ts'
import { GitlabRepositoryAdapter } from '../src/repositories/gitlab.ts'
import { UnsupportedRepositoryOperation } from '../src/repositories/adapter.ts'

const config = { provider: 'gitlab' as const, host: 'gitlab.example.com', repository: 'acme/app', token: 'secret', defaultBranch: 'main', pollSeconds: 60 }
it('builds a GitLab adapter and canonical MR links', () => {
  const adapter = new GitlabRepositoryAdapter(config, { request: vi.fn() })
  expect(adapter.link({ ...adapter.binding, kind: 'merge-request', iid: 7 })).toBe('https://gitlab.example.com/acme/app/-/merge_requests/7')
  expect(adapter.capabilities().pipeline).toBe(true)
})
it('selects GitLab from the provider registry', () => {
  expect(createRepositoryAdapter(config)).toBeInstanceOf(GitlabRepositoryAdapter)
})
it('keeps CNB capability-only without making a network call', async () => {
  const adapter = new CnbRepositoryAdapter({ ...config, provider: 'cnb', host: 'cnb.cool' })
  await expect(adapter.readChangeRequest({ ...adapter.binding, kind: 'pull-request', iid: 1 })).rejects.toBeInstanceOf(UnsupportedRepositoryOperation)
  expect(adapter.capabilities().readChangeRequest).toBe(false)
})
