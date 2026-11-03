import { z } from 'zod'

const host = z.string().trim().min(1).regex(/^[a-z0-9][a-z0-9.-]*(?::[0-9]+)?$/i)
const repository = z.string().trim().min(1).refine(value => !value.split('/').some(part => part === '.' || part === '..'), 'Invalid repository path')
export const RepositoryConfigSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'cnb']).default('gitlab'),
  host: host.default('gitlab.com'),
  repository: repository.default(''),
  token: z.string().trim().default(''),
  defaultBranch: z.string().trim().min(1).default('main'),
  pollSeconds: z.number().int().min(15).max(3600).default(60),
}).strict()
export type RepositoryConfig = z.infer<typeof RepositoryConfigSchema>
