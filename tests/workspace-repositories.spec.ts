import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { discoverWorkspaceRepositories, selectWorkspaceRepository, type WorkspaceRepository } from '../src/repositories/workspace.ts'
import { repositoryWorktreeCommand } from '../src/executor/dsh.ts'

const roots: string[] = []
const tempRoot = (): string => {
  const root = join(process.cwd(), '.tmp-workspace-test-' + Math.random().toString(36).slice(2))
  roots.push(root)
  mkdirSync(root, { recursive: true })
  return root
}
afterEach(async () => { const { rm } = await import('node:fs/promises'); await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const repo = (root: string, relative: string, remote: string, branch = 'main') => {
  const path = join(root, relative)
  mkdirSync(join(path, '.git'), { recursive: true })
  writeFileSync(join(path, '.git', 'config'), `[remote "origin"]\n\turl = ${remote}\n`)
  writeFileSync(join(path, '.git', 'HEAD'), `ref: refs/heads/${branch}\n`)
  return path
}

it('discovers nested repositories and parses SSH, HTTPS and CNB remotes', () => {
  const root = tempRoot()
  repo(root, 'services/api', 'git@gitlab.example.com:team/api.git', 'develop')
  repo(root, 'web', 'https://github.com/acme/web.git')
  repo(root, 'packages/cnb', 'https://cnb.cool/team/cnb.git')
  mkdirSync(join(root, 'node_modules', 'ignored', '.git'), { recursive: true })
  expect(discoverWorkspaceRepositories(root)).toMatchObject([
    { id: 'packages/cnb', provider: 'cnb', repository: 'team/cnb', defaultBranch: 'main' },
    { id: 'services/api', provider: 'gitlab', host: 'gitlab.example.com', repository: 'team/api', defaultBranch: 'develop' },
    { id: 'web', provider: 'github', repository: 'acme/web' },
  ])
})

it('does not follow a symlink into a second tree', () => {
  const root = tempRoot(); const outside = tempRoot()
  repo(outside, 'secret', 'https://gitlab.example.com/team/secret.git')
  symlinkSync(outside, join(root, 'linked'), 'junction')
  expect(discoverWorkspaceRepositories(root)).toEqual([])
})

it('selects exact aliases, ranks metadata, and reports ties', () => {
  const candidates: WorkspaceRepository[] = [
    { id: 'services/api', alias: 'api', path: '/w/services/api', relativePath: 'services/api', provider: 'gitlab' as const, host: 'gitlab.example.com', repository: 'team/api', defaultBranch: 'main' },
    { id: 'web', alias: 'web', path: '/w/web', relativePath: 'web', provider: 'github' as const, host: 'github.com', repository: 'acme/web', defaultBranch: 'main' },
  ]
  expect(selectWorkspaceRepository(candidates, 'repo=api')).toMatchObject({ status: 'selected', repository: candidates[0] })
  expect(selectWorkspaceRepository(candidates, 'please fix api authentication')).toMatchObject({ status: 'selected', repository: candidates[0] })
  expect(selectWorkspaceRepository(candidates, '', 'web')).toMatchObject({ status: 'selected', repository: candidates[1] })
  expect(selectWorkspaceRepository([candidates[0]!], 'please fix a typo')).toMatchObject({ status: 'selected', repository: candidates[0] })
  expect(selectWorkspaceRepository([{ ...candidates[0]!, alias: 'shared' }, { ...candidates[1]!, alias: 'shared' }], 'shared').status).toBe('ambiguous')
})

it('builds a detached worktree command from the selected binding', () => {
  expect(repositoryWorktreeCommand({ repository: { provider: 'gitlab', host: 'gitlab.com', repository: 'team/api', localPath: '/w/api', defaultBranch: 'develop' },
    execution: { name: 'fix-login', directory: '/work/fix-login', assignment: '' } })).toEqual([
    'git', '-C', '/w/api', 'worktree', 'add', '--detach', '/work/fix-login', 'develop',
  ])
})
