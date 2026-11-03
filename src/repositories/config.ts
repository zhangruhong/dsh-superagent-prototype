import { z } from 'zod'

const host = z.string().trim().min(1).regex(/^[a-z0-9][a-z0-9.-]*(?::[0-9]+)?$/i)
const absolutePath = z.string().trim().refine(value => value === '' || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value), 'An absolute workspace path')
// An empty repository is a valid unconfigured Source default; setup reports it only when this provider is enabled.
const repository = z.string().trim().refine(value => value === '' || !value.split('/').some(part => part === '.' || part === '..'), 'Invalid repository path')
export const RepositoryConfigSchema = z.object({
  mode: z.enum(['single', 'workspace']).default('single'),
  provider: z.enum(['github', 'gitlab', 'cnb']).default('gitlab'),
  host: host.default('gitlab.com'),
  repository: repository.default(''),
  workspaceRoot: absolutePath.default(''),
  defaultRepository: z.string().trim().default(''),
  token: z.string().trim().default(''),
  defaultBranch: z.string().trim().min(1).default('main'),
  pollSeconds: z.number().int().min(15).max(3600).default(60),
}).strict()
export type RepositoryConfig = z.infer<typeof RepositoryConfigSchema>
export type RepositoryConfigInput = Omit<RepositoryConfig, 'mode' | 'workspaceRoot' | 'defaultRepository'>
  & Partial<Pick<RepositoryConfig, 'mode' | 'workspaceRoot' | 'defaultRepository'>>
