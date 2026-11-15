/** Real local workflow acceptance; no remote repository, model or chat credentials are used. */
import { Context } from '@deepseek-ai/cordis'
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Commands } from '../src/infra/commands.ts'
import { agentVariables, verifyEnvironment, writeEnvironment } from '../src/infra/environment.ts'
import { testDeployment } from './fixtures/deployment.ts'
import { nodeCli } from './fixtures/cli.ts'

let ctx: Context
let fiber: ReturnType<Context['plugin']>
let directory: string
const signal = new AbortController().signal
vi.setConfig({ testTimeout: 30_000 })
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'dsh workflow 中文 ')); ctx = new Context()
  fiber = ctx.plugin(LocalSubprocessRuntime); await fiber
})
afterEach(async () => {
  ctx.registry.delete(LocalSubprocessRuntime); await fiber.await()
  rmSync(directory, { recursive: true, force: true })
})

it('creates an isolated repository worktree, changes code, runs a test and commits without changing the original checkout', async () => {
  const deployment = testDeployment({ stateDir: directory, github: { cli: '', login: '', noreply: '' }, feishu: undefined })
  await writeEnvironment(deployment, [])
  const commands = new Commands(() => deployment, agentVariables(directory), signal, ctx.subprocess)
  const repository = join(directory, 'repository'), worktree = join(directory, 'ticket worktree')
  const git = (...args: string[]) => commands.run('git', args, directory)
  await git('init', '-q', '-b', 'main', repository)
  writeFileSync(join(repository, 'answer.cjs'), 'module.exports = 41\n')
  await git('-C', repository, 'add', '.')
  const identity = ['-c', 'user.name=Agent Test', '-c', 'user.email=agent@example.invalid']
  await git('-C', repository, ...identity, 'commit', '-q', '-m', 'initial')
  await git('-C', repository, 'worktree', 'add', '--detach', worktree, 'main')
  writeFileSync(join(worktree, 'answer.cjs'), 'module.exports = 42\n')
  await commands.run(process.execPath, ['-e', 'require("node:assert/strict").equal(require("./answer.cjs"),42)'], worktree)
  await git('-C', worktree, 'add', '.')
  await git('-C', worktree, ...identity, 'commit', '-q', '-m', 'fix answer')
  expect((await git('-C', worktree, 'log', '-1', '--format=%s')).trim()).toBe('fix answer')
  expect(readFileSync(join(repository, 'answer.cjs'), 'utf8')).toContain('41')
  expect((await git('-C', worktree, 'status', '--porcelain')).trim()).toBe('')
})

it('verifies the configured GitHub helper through the real DSH subprocess environment', async () => {
  const deployment = testDeployment({ stateDir: directory, github: { ...testDeployment().github, cli: process.execPath }, feishu: undefined })
  await writeEnvironment(deployment, [])
  await expect(verifyEnvironment(deployment, ctx.subprocess, signal, agentVariables(directory))).resolves.toBeUndefined()
})

it.skipIf(process.platform !== 'win32')('runs PowerShell account credential helpers with stdin and the Git credential operation', async () => {
  const cli = join(directory, 'gh-account.ps1')
  writeFileSync(cli, 'if ($args[0] -ne "auth" -or $args[1] -ne "git-credential" -or $args[2] -ne "get") { exit 7 }; $null = [Console]::In.ReadToEnd(); [Console]::Write("username=agent`npassword=fixture-only`n`n")')
  const deployment = testDeployment({ stateDir: directory, github: { ...testDeployment().github, cli }, feishu: undefined })
  await writeEnvironment(deployment, [])
  const handle = ctx.subprocess.spawn({ argv: ['git', 'credential', 'fill'], cwd: directory, env: agentVariables(directory), signal, graceMs: 2000,
    stdio: { stdin: { data: 'protocol=https\nhost=github.com\n\n' }, stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } } })
  const result = await handle.done
  expect({ ...result, stderr: handle.collected.stderr?.readFrom(0).text }).toMatchObject({ exitCode: 0, stderr: '' })
  expect(handle.collected.stdout?.readFrom(0).text).toContain('username=agent')
})

it.skipIf(process.platform !== 'win32')('runs a batch account credential helper with stdin and the Git credential operation', async () => {
  const cli = nodeCli(join(directory, 'gh-account'), `
const assert=require('node:assert/strict');
assert.deepEqual(process.argv.slice(2),['auth','git-credential','get']);
assert.match(require('node:fs').readFileSync(0,'utf8'),/host=github.com/);
process.stdout.write('username=agent\\npassword=fixture-only\\n\\n');
`)
  const deployment = testDeployment({ stateDir: directory, github: { ...testDeployment().github, cli }, feishu: undefined })
  await writeEnvironment(deployment, [])
  const handle = ctx.subprocess.spawn({ argv: ['git', 'credential', 'fill'], cwd: directory, env: agentVariables(directory), signal, graceMs: 2000,
    stdio: { stdin: { data: 'protocol=https\nhost=github.com\n\n' }, stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } } })
  const result = await handle.done
  expect({ ...result, stderr: handle.collected.stderr?.readFrom(0).text }).toMatchObject({ exitCode: 0, stderr: '' })
  expect(handle.collected.stdout?.readFrom(0).text).toContain('username=agent')
})

it.skipIf(process.platform !== 'win32')('cancels a batch wrapper and its native child without leaving the child alive', async () => {
  const pidFile = join(directory, 'child.pid')
  const wrapper = nodeCli(join(directory, 'account cli'), `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid)); setInterval(()=>{},60000)`)
  const controller = new AbortController()
  const commands = new Commands(() => testDeployment({ stateDir: directory }), {}, controller.signal, ctx.subprocess)
  const running = commands.run(wrapper, [])
  // Attach rejection handling before cancellation, while waiting for the child to actually start.
  const outcome = running.catch(error => error)
  await vi.waitFor(() => expect(existsSync(pidFile)).toBe(true), { timeout: 15_000 })
  const pid = Number(readFileSync(pidFile, 'utf8'))
  controller.abort()
  expect(await outcome).toMatchObject({ name: 'AbortError' })
  expect(() => process.kill(pid, 0)).toThrow()
})
