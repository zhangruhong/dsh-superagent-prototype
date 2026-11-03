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
  expect(RepositoryConfigSchema.parse({})).toEqual({ provider: 'gitlab', host: 'gitlab.com', repository: '', token: '', defaultBranch: 'main', pollSeconds: 60 })
})
