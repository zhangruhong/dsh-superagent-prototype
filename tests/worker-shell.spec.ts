import { Context } from '@deepseek-ai/cordis'
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerPwshExecutor } from '../src/worker-shell-pwsh.ts'
import { WorkerBashExecutor } from '../src/worker-shell-bash.ts'
import { powerShell } from '../src/infra/platform.ts'
import { Commands } from '../src/infra/commands.ts'
import { testDeployment } from './fixtures/deployment.ts'

let ctx: Context
let directory: string
let subprocessFiber: ReturnType<Context['plugin']> | undefined
beforeEach(() => { ctx = new Context(); directory = mkdtempSync(join(tmpdir(), 'worker-shell-')) })
afterEach(async () => { ctx.registry.delete(LocalSubprocessRuntime); await subprocessFiber?.await(); subprocessFiber = undefined; vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })
vi.setConfig({ testTimeout: 30_000 })

async function services() {
  subprocessFiber = ctx.plugin(LocalSubprocessRuntime); await subprocessFiber
  const subprocess = ctx.subprocess
  const entries = { DSH_WORKER_MARKER: 'worker-only', GIT_DIR: undefined, GH_TOKEN: undefined, GIT_CONFIG_GLOBAL: join(directory, 'agent.gitconfig') }
  ctx.reflect.provide('orchestrator', { workerEnvironment: entries })
  ctx.reflect.provide('sandboxPolicy', { defaultMode: 'danger-full-access', resolve: () => ({ mode: 'danger-full-access' }) })
  return { subprocess, entries }
}
it('stamps the managed POSIX shell without changing its sandbox or the host environment', async () => {
  const { entries } = await services()
  const before = { ...process.env }
  const shell = new WorkerBashExecutor(ctx, WorkerBashExecutor.Config({ cwd: directory }))
  const spec = shell.resolve({ command: 'echo done', env: { KEEP: 'request', GH_TOKEN: 'operator' } })
  expect(spec.env).toMatchObject({ ...entries, KEEP: 'request' })
  expect(spec.sandboxPolicy).toMatchObject({ mode: 'danger-full-access' })
  expect(process.env).toEqual(before)
})
describe.skipIf(process.platform !== 'win32')('Windows managed process integration', () => {
  it('runs the actual DSH PowerShell executor with worker entries while an ordinary host command retains its own environment', async () => {
    const { subprocess } = await services()
    vi.stubEnv('GIT_DIR', 'operator-repository'); vi.stubEnv('GH_TOKEN', 'operator-test-token')
    const before = { ...process.env }
    const shell = new WorkerPwshExecutor(ctx, WorkerPwshExecutor.Config({ cwd: directory, pwshPath: powerShell() }))
    const command = '[Console]::Write(($env:DSH_WORKER_MARKER + ":" + $env:GIT_DIR + ":" + $env:GH_TOKEN))'
    const execution = await shell.execute(shell.resolve({ command, timeoutMs: 20_000 }))
    const result = await execution.result()
    expect(result.exitCode).toBe(0)
    expect(result.stdout.text).toBe('worker-only::')
    expect(process.env).toEqual(before)
    const ordinary = new Commands(() => testDeployment({ stateDir: directory }), {}, new AbortController().signal, subprocess)
    const output = await ordinary.run(process.execPath, ['-e', 'process.stdout.write(process.env.GIT_DIR)'])
    expect(output).toBe('operator-repository')
  })
  it('cancels the complete managed PowerShell process range', async () => {
    await services()
    const shell = new WorkerPwshExecutor(ctx, WorkerPwshExecutor.Config({ cwd: directory, pwshPath: powerShell() }))
    const controller = new AbortController()
    const execution = await shell.execute(shell.resolve({ command: 'Start-Sleep -Seconds 60', signal: controller.signal, timeoutMs: 20_000 }))
    controller.abort()
    const result = await execution.result()
    expect(result.aborted).toBe(true)
    expect(result.exitCode).not.toBe(0)
    expect(execution.status).toBe('killed')
  })
})
