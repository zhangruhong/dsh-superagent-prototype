import type { RepositoryAdapter } from './adapter.ts'
import type { RepositoryBinding } from '../core/index.ts'
import { CnbRepositoryAdapter } from './cnb.ts'
import { RepositoryConfigSchema, type RepositoryConfig, type RepositoryConfigInput } from './config.ts'
import { createGitlabTransport, GitlabRepositoryAdapter } from './gitlab.ts'

export interface RepositoryFactoryOptions { fetcher?: typeof fetch }
export function repositoryConfig(value: unknown): RepositoryConfig { return RepositoryConfigSchema.parse(value) }
export function createRepositoryAdapter(value: unknown, options: RepositoryFactoryOptions = {}): RepositoryAdapter {
  const config = repositoryConfig(value)
  if (config.provider === 'gitlab') return new GitlabRepositoryAdapter(config, createGitlabTransport(config, options.fetcher))
  if (config.provider === 'cnb') return new CnbRepositoryAdapter(config)
  throw new Error('GitHub repository operations remain on the legacy GitHub Source')
}
export function createRepositoryAdapterForBinding(configValue: unknown, binding: RepositoryBinding, options: RepositoryFactoryOptions = {}): RepositoryAdapter {
  const source = configValue && typeof configValue === 'object' ? configValue as Record<string, unknown> : {}
  const config = repositoryConfig({ ...source, mode: 'single', provider: binding.provider, host: binding.host, repository: binding.repository,
    defaultBranch: binding.defaultBranch ?? 'main' })
  return createRepositoryAdapter(config, options)
}
