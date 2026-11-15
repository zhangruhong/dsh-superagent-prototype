/** Native Windows regressions: these execute real processes rather than inspecting generated command strings. */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrubbedParentEnv, type SubprocessRuntime, type SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { Config, executable, resolveDeployment, resolveFeishuBot, workerProbe } from '../src/deployment.ts'
import { Commands } from '../src/infra/commands.ts'
import { agentVariables, runAsWorker, workerBin, writeEnvironment } from '../src/infra/environment.ts'
import { ExecutorConfigSchema } from '../src/policy.ts'
import { testDeployment } from './fixtures/deployment.ts'
import { nodeCli } from './fixtures/cli.ts'

const signal = new AbortController().signal
let root: string
vi.setConfig({ testTimeout: 30_000 })
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'dsh desktop 中文 ')) })
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }) })

/** Process-backed service test seam; explicit env follows DSH's scrubbed-parent/tombstone contract. */
const subprocess = {
  spawn(spec: SubprocessSpawnSpec) {
    const child = spawn(spec.argv[0]!, spec.argv.slice(1), { cwd: spec.cwd, env: { ...scrubbedParentEnv(), ...spec.env }, signal: spec.signal, windowsHide: true })
    const output = { stdout: '', stderr: '' }
    child.stdout!.on('data', data => { output.stdout += String(data) })
    child.stderr!.on('data', data => { output.stderr += String(data) })
    const done = new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }))
    })
    const reader = (stream: keyof typeof output) => ({ readFrom: () => ({ text: output[stream], nextOffset: output[stream].length, lossy: false }) })
    return { done, collected: { stdout: reader('stdout'), stderr: reader('stderr') } }
  },
} as unknown as SubprocessRuntime

describe.skipIf(process.platform !== 'win32')('native Windows execution', () => {
  const commands = () => new Commands(() => testDeployment({ stateDir: root }), {}, signal)
  function echoWrapper(): string {
    const script = join(root, 'argv reader.cjs')
    writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))')
    const wrapper = join(root, 'account wrapper.cmd')
    writeFileSync(wrapper, `@echo off\r\n@"${process.execPath}" "${script}" %*\r\n`)
    return wrapper
  }
  it('accepts absolute drive and UNC state/work directories, and rejects relative paths', () => {
    for (const directory of [root, 'C:\\agents\\state', '\\\\server\\share\\state']) {
      expect(Config({ stateDir: directory }).stateDir).toBe(directory)
      expect(ExecutorConfigSchema.parse({ directory }).directory).toBe(directory)
    }
    for (const directory of ['relative/state', 'C:relative', '\\relative', '~/state']) {
      expect(() => Config({ stateDir: directory })).toThrow()
      expect(() => ExecutorConfigSchema.parse({ directory })).toThrow()
    }
  })
  it('resolves a native executable through PATHEXT and excludes worker shims regardless of path case', () => {
    const bin = workerBin(root); mkdirSync(bin)
    writeFileSync(join(bin, 'gh.exe'), '')
    const real = join(root, 'real'); mkdirSync(real); writeFileSync(join(real, 'gh.exe'), '')
    expect(executable('gh', [bin.toUpperCase(), real].join(delimiter), bin)).toBe(join(real, 'gh.exe'))
  })
  it('runs a batch account CLI with literal arguments through host Commands and the worker runtime', async () => {
    const wrapper = echoWrapper()
    const args = ['api', '--jq', '{name: .full_name, push: .permissions.push}', '中文', '', 'space value', 'a&b|c<d>e', 'a^b', '100%', '%PATH%', '!literal!', 'trailing\\']
    expect(JSON.parse(await commands().run(wrapper, args))).toEqual(args)
    expect(JSON.parse(await runAsWorker(subprocess, [wrapper, ...args], root, signal))).toEqual(args)
  })
  it('runs PowerShell account scripts without interpreting message arguments', async () => {
    const script = join(root, 'account wrapper.ps1')
    writeFileSync(script, '[Console]::Write((ConvertTo-Json -Compress -InputObject @($args)))')
    const args = ['中文 text', '$(Write-Output bad)', '"quoted"', '', '%PATH%', 'a&b']
    expect(JSON.parse(await commands().run(script, args))).toEqual(args)
  })
  it('refuses unsupported multiline generic batch arguments instead of truncating them', async () => {
    await expect(commands().run(echoWrapper(), ['hello\nsecond line'])).rejects.toThrow(/batch.*multiline/i)
    await expect(commands().run(echoWrapper(), ['{"body":"hello"}'])).rejects.toThrow(/batch.*quotes/i)
  })
  it.each(['cmd', 'ps1'])('carries GitHub reply text and markers through a %s account using a file, and removes it after errors', async extension => {
    const real = nodeCli(join(root, 'real-gh'), `
const fs=require('node:fs'), args=process.argv.slice(2), value=args[args.indexOf('-F')+1];
if(!value?.startsWith('body=@')) throw Error('expected file field');
const text=fs.readFileSync(value.slice(6),'utf8');
if(text==='fail'){process.stderr.write('fixture failed');process.exit(7)}
console.log(JSON.stringify({text}));
`)
    const cli = join(root, `account.${extension}`)
    writeFileSync(cli, extension === 'cmd' ? `@echo off\r\n@"${real}" %*\r\n` : `& '${real.replaceAll("'", "''")}' @args; exit $LASTEXITCODE`)
    const deployment = testDeployment({ stateDir: root, github: { ...testDeployment().github, cli } })
    const account = new Commands(() => deployment, {}, signal)
    const text = '中文 "quoted"\n\n<!-- dsh-superagent:out-1 -->' + '中文'.repeat(5000)
    expect(JSON.parse(await account.api('issues/1/comments', '--method', 'POST', '-f', `body=${text}`))).toEqual({ text })
    await expect(account.api('issues/1/comments', '-f', 'body=fail')).rejects.toMatchObject({ exitCode: 7 })
    expect(readdirSync(root).filter(name => name.startsWith('.cli-input-'))).toEqual([])
  })
  it.each(['cmd', 'ps1'])('carries Feishu markdown and JSON through a %s account without putting payloads in argv', async extension => {
    const real = nodeCli(join(root, 'real-lark'), `
const fs=require('node:fs'), args=process.argv.slice(2), values={};
for(const flag of ['--markdown','--params']){
 const value=args[args.indexOf(flag)+1]; if(!value?.startsWith('@./'))throw Error('expected relative file input');
 values[flag]=fs.readFileSync(value.slice(1),'utf8');
}
console.log(JSON.stringify({ok:true,data:values}));
`)
    const cli = join(root, `account.${extension}`)
    writeFileSync(cli, extension === 'cmd' ? `@echo off\r\n@"${real}" %*\r\n` : `& '${real.replaceAll("'", "''")}' @args; exit $LASTEXITCODE`)
    const deployment = testDeployment({ stateDir: root, feishu: { ...testDeployment().feishu!, cli } })
    const account = new Commands(() => deployment, {}, signal)
    const markdown = '中文 "quoted"\n\n> result & details', params = '{"chat":"oc_1","query":"a\\"b"}'
    expect(await account.lark(['im', '+messages-reply', '--markdown', markdown, '--params', params]))
      .toEqual({ '--markdown': markdown, '--params': params })
    expect(readdirSync(root).filter(name => name.startsWith('.cli-input-'))).toEqual([])
  })
  it('runs a PowerShell account script through the generated worker gh shim', async () => {
    const script = join(root, 'gh-account.ps1')
    writeFileSync(script, '[Console]::Write((ConvertTo-Json -Compress -InputObject @($args)))')
    const deployment = testDeployment({ stateDir: root, github: { ...testDeployment().github, cli: script } })
    await writeEnvironment(deployment, [])
    const args = ['api', '--jq', '{name: .full_name}', '中文', 'a&b', '%PATH%']
    expect(JSON.parse(await commands().run(join(workerBin(root), 'gh.cmd'), args))).toEqual(args)
  })
  it('reports batch failures with their actual exit status and stderr', async () => {
    const script = join(root, 'failure.cmd'); writeFileSync(script, '@echo off\r\necho failed 1>&2\r\nexit /b 7\r\n')
    await expect(commands().run(script, [])).rejects.toMatchObject({ message: 'failed', exitCode: 7 })
    await expect(runAsWorker(subprocess, [script], root, signal)).rejects.toMatchObject({ message: 'failed', exitCode: 7 })
  })
  it('refuses missing providers and blocked commands while keeping git outside the shim directory', async () => {
    const deployment = testDeployment({ stateDir: root, github: { cli: '', login: '', noreply: '' }, feishu: undefined })
    await writeEnvironment(deployment, ['personal-cli', 'git', 'gh', 'lark-cli'])
    for (const [name, message] of [['gh', 'non-GitHub repository provider'], ['lark-cli', 'no Feishu bot'], ['personal-cli', 'is blocked']] as const) {
      await expect(commands().run(join(workerBin(root), name + '.cmd'), [])).rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining(message) })
    }
    expect(existsSync(join(workerBin(root), 'git.cmd'))).toBe(false)
  })
  it('probes with explicit environment entries instead of the POSIX env binary', async () => {
    const script = join(root, 'probe.cjs'); writeFileSync(script, 'process.stdout.write(process.env.DSH_DESKTOP_PROBE || "")')
    const probe = workerProbe(subprocess, root, root, signal)
    expect(await probe([process.execPath, script], { DSH_DESKTOP_PROBE: 'isolated' })).toBe('isolated')
  })
  it('strips worker-bin before a nested account wrapper resolves gh by name', async () => {
    const real = join(root, 'real'); mkdirSync(real)
    writeFileSync(join(real, 'gh.cmd'), '@echo off\r\necho reached-real-cli\r\n')
    const wrapper = join(root, 'gh-agent.cmd'); writeFileSync(wrapper, '@echo off\r\ngh %*\r\n')
    const deployment = testDeployment({ stateDir: root, github: { ...testDeployment().github, cli: wrapper } })
    await writeEnvironment(deployment, [])
    const environment = { ...agentVariables(root), PATH: [workerBin(root), real, process.env.PATH].join(delimiter) }
    const result = await new Commands(() => deployment, environment, signal).run(join(workerBin(root), 'gh.cmd'), ['api', 'user'])
    expect(result.trim()).toBe('reached-real-cli')
    expect(readFileSync(join(workerBin(root), 'gh.cmd'), 'utf8')).toContain('Written by dsh-superagent')
  })
  it('resolves an account batch CLI and rejects read-only or missing GitHub setup', async () => {
    const cli = nodeCli(join(root, 'gh-agent'), `const args=process.argv.slice(2); console.log(JSON.stringify(args[1]==='user'?{login:'agent-bot',id:7}:{name:'acme/widgets',push:args[1]!=='repos/acme/readonly'}))`)
    const probe = workerProbe(subprocess, root, root, signal)
    const deployment = await resolveDeployment(testDeployment({ stateDir: root }), { repository: 'acme/widgets', cli }, probe)
    expect(deployment.github).toMatchObject({ cli, login: 'agent-bot' })
    await expect(resolveDeployment(deployment, { repository: 'acme/readonly', cli }, probe)).rejects.toMatchObject({ code: 'repositoryReadOnly' })
    await expect(resolveDeployment(deployment, { repository: 'acme/widgets', cli: join(root, 'missing.exe') }, probe)).rejects.toMatchObject({ code: 'agentCliMissing' })
    await expect(resolveDeployment(deployment, { repository: 'acme/widgets' }, probe)).rejects.toMatchObject({ code: 'agentCliUnset' })
    await expect(resolveDeployment(deployment, {}, probe)).rejects.toMatchObject({ code: 'repositoryUnset' })
  })
  it('resolves Feishu batch CLIs using explicit notifier environment and enforces bot-only identity', async () => {
    const cli = nodeCli(join(root, 'lark-bot'), `const args=process.argv.slice(2); if(process.env.LARKSUITE_CLI_NO_UPDATE_NOTIFIER!=='1')process.exit(9); if(args[0]==='auth')console.log(JSON.stringify({appId:'cli_bot',identities:{bot:{status:'ready'}}}));else if(args[0]==='config')console.log('strict-mode: bot');else console.log(JSON.stringify({bot:{open_id:'ou_bot',app_name:'Bot'}}));`)
    const probe = workerProbe(subprocess, root, root, signal)
    expect(await resolveFeishuBot(testDeployment({ stateDir: root }), { cli }, probe)).toMatchObject({ appId: 'cli_bot', botId: 'ou_bot' })
    expect(await resolveFeishuBot(testDeployment({ stateDir: root }), {}, probe)).toBeUndefined()
  })
})
