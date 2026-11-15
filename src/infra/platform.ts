/** Native command lookup and invocation. POSIX processes keep literal argv; Windows scripts use their owning interpreter. */
import { accessSync, constants, realpathSync, statSync } from 'node:fs'
import { delimiter, extname, isAbsolute, join, normalize, resolve } from 'node:path'

export const windows = process.platform === 'win32'
export function sameDirectory(a: string, b: string): boolean {
  const real = (path: string): string => { try { return realpathSync(path) } catch { return resolve(path) } }
  const left = real(a), right = real(b)
  return windows ? left.toLowerCase() === right.toLowerCase() : left === right
}
export function withoutDirectory(path: string, directory: string): string {
  return path.split(delimiter).filter(entry => !sameDirectory(entry.replace(/^"(.*)"$/, '$1'), directory)).join(delimiter)
}
export function findExecutable(name: string, path: string, exclude?: string): string | undefined {
  const absolute = isAbsolute(name)
  if (!absolute && /[\\/]/.test(name)) return undefined
  const extensions = windows && !extname(name)
    ? [...new Set(['.exe', '.com', '.ps1', '.cmd', '.bat', ...(process.env.PATHEXT ?? '').toLowerCase().split(';').filter(Boolean), ''])] : ['']
  const directories = absolute ? [''] : path.split(delimiter).map(dir => dir.replace(/^"(.*)"$/, '$1'))
    .filter(dir => isAbsolute(dir) && !(exclude && sameDirectory(dir, exclude)))
  for (const directory of directories) for (const extension of extensions) {
    const candidate = absolute ? name + extension : join(directory, name + extension)
    try {
      if (!statSync(candidate).isFile()) continue
      if (!windows) accessSync(candidate, constants.X_OK)
      return candidate
    } catch { /* Try the next executable in PATH. */ }
  }
  return undefined
}
export function powerShell(): string {
  return findExecutable('pwsh.exe', process.env.PATH ?? '')
    ?? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}
export const prepareShell = (platform = process.platform): readonly string[] => platform === 'win32'
  ? [powerShell(), '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'] : ['sh', '-c']

/** Encode source so Node and DSH both pass it as one plain argument, without an additional cmd.exe parsing layer. */
const encodedPowerShell = (source: string): string[] => [powerShell(), '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
  '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')]
const utf8Literal = (value: string): string => `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(value).toString('base64')}'))`

// cmd.exe escaping adapted from cross-spawn (MIT); copyright and license in THIRD_PARTY_NOTICES.md.
const META = /([()\][%!^"`<>&|;, *?])/g
function batchArgument(value: string): string {
  const quoted = `"${value.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"').replace(/(?=(\\+?)?)\1$/, '$1$1')}"`
  // Account wrappers, like npm shims, forward through %*: protect both cmd parsing passes.
  return quoted.replace(META, '^$1').replace(META, '^$1')
}

/** A Windows batch invocation must own its raw cmd command line; SubprocessRuntime deliberately has no verbatim-argv option. */
export function invocation(program: string, args: readonly string[], path = process.env.PATH ?? ''): string[] {
  if (!windows) return [program, ...args]
  const file = findExecutable(program, path) ?? program
  const extension = extname(file).toLowerCase()
  if (extension === '.ps1') {
    const payload = utf8Literal(JSON.stringify({ program: file, args }))
    return encodedPowerShell(`$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object Text.UTF8Encoding $false; $p=${payload}|ConvertFrom-Json; $a=@($p.args); $global:LASTEXITCODE=0; & $p.program @a; exit $LASTEXITCODE`)
  }
  if (extension !== '.cmd' && extension !== '.bat') return [program, ...args]
  // A wrapper may forward %* through further .cmd files; the required quote escaping depends on
  // that unknown depth. Refuse payloads we cannot preserve instead of silently changing their data.
  if (args.some(value => /[\r\n"]/.test(value))) throw new Error('Windows batch launchers cannot reliably carry embedded quotes or multiline arguments; use a provider file input or a native executable.')
  const command = normalize(file).replace(META, '^$1')
  const line = `/d /s /c "chcp 65001>nul & ${[command, ...args.map(batchArgument)].join(' ')}"`
  return encodedPowerShell(`$ErrorActionPreference='Stop'; $p=New-Object Diagnostics.ProcessStartInfo; $p.FileName=$env:ComSpec; $p.Arguments=${utf8Literal(line)}; $p.UseShellExecute=$false; $c=[Diagnostics.Process]::Start($p); $c.WaitForExit(); exit $c.ExitCode`)
}
