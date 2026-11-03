import type { RepositoryAdapter } from './adapter.ts'
import { CnbRepositoryAdapter } from './cnb.ts'
import { RepositoryConfigSchema, type RepositoryConfig } from './config.ts'
import { createGitlabTransport, GitlabRepositoryAdapter } from './gitlab.ts'

export interface RepositoryFactoryOptions { fetcher?: typeof fetch }
export function repositoryConfig(value: unknown): RepositoryConfig { return RepositoryConfigSchema.parse(value) }
export function createRepositoryAdapter(value: unknown, options: RepositoryFactoryOptions = {}): RepositoryAdapter {
  const config = repositoryConfig(value)
  if (config.provider === 'gitlab') return new GitlabRepositoryAdapter(config, createGitlabTransport(config, options.fetcher))
  if (config.provider === 'cnb') return new CnbRepositoryAdapter(config)
  throw new Error('GitHub repository operations remain on the legacy GitHub Source')
}
