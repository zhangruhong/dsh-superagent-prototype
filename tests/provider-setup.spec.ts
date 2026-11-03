import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { resolveRepositoryDeployment, WecomBotSchema } from '../src/deployment.ts'
import { RepositoryConfigSchema } from '../src/repositories/config.ts'
import { testMachine } from './fixtures/deployment.ts'

it('resolves GitLab without a GitHub CLI account', () => {
  const deployment = resolveRepositoryDeployment(testMachine(), { provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', token: 'glpat-test' })
  expect(deployment).toMatchObject({ repository: 'acme/app', repositoryBinding: { provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app' }, github: { cli: '', login: '' } })
})

it('resolves CNB as a capability-only repository', () => {
  expect(resolveRepositoryDeployment(testMachine(), { provider: 'cnb', host: 'cnb.cool', repository: 'team/app', token: 'cnb-test' }).repositoryBinding)
    .toMatchObject({ provider: 'cnb', host: 'cnb.cool', repository: 'team/app' })
})

it('normalizes an empty WeCom WebSocket URL and leaves incomplete credentials unset', () => {
  expect(WecomBotSchema.parse({ wsUrl: '' })).toMatchObject({ botId: '', secret: '', wsUrl: 'wss://openws.work.weixin.qq.com' })
})

it('keeps an empty Repository Source configuration valid until setup is enabled', () => {
  expect(RepositoryConfigSchema.parse({})).toEqual({ mode: 'single', provider: 'gitlab', host: 'gitlab.com', repository: '', workspaceRoot: '', defaultRepository: '', token: '', defaultBranch: 'main', pollSeconds: 60 })
})

it('builds a recursive workspace catalog without selecting an arbitrary repository', () => {
  const root = mkdtempSync(join(process.cwd(), '.tmp-provider-workspace-'))
  try {
    const app = join(root, 'services', 'api'); mkdirSync(join(app, '.git'), { recursive: true })
    writeFileSync(join(app, '.git', 'config'), '[remote "origin"]\n\turl = git@gitlab.com:team/api.git\n')
    writeFileSync(join(app, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    const deployment = resolveRepositoryDeployment(testMachine(), { mode: 'workspace', workspaceRoot: root, provider: 'gitlab' })
    expect(deployment.repository).toBe('team/api')
    expect(deployment.repositoryCatalog).toMatchObject([{ alias: 'api', relativePath: 'services/api', provider: 'gitlab', repository: 'team/api' }])
    expect(deployment.repositoryBinding).toMatchObject({ alias: 'api', localPath: app })
  } finally { rmSync(root, { recursive: true, force: true }) }
})
