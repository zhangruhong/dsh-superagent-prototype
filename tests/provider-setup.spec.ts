import { expect, it } from 'vitest'
import { resolveRepositoryDeployment } from '../src/deployment.ts'
import { testMachine } from './fixtures/deployment.ts'

it('resolves GitLab without a GitHub CLI account', () => {
  const deployment = resolveRepositoryDeployment(testMachine(), { provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', token: 'glpat-test' })
  expect(deployment).toMatchObject({ repository: 'acme/app', repositoryBinding: { provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app' }, github: { cli: '', login: '' } })
})

it('resolves CNB as a capability-only repository', () => {
  expect(resolveRepositoryDeployment(testMachine(), { provider: 'cnb', host: 'cnb.cool', repository: 'team/app', token: 'cnb-test' }).repositoryBinding)
    .toMatchObject({ provider: 'cnb', host: 'cnb.cool', repository: 'team/app' })
})
