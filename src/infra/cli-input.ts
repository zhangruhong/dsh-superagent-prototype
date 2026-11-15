/** Provider-supported file inputs avoid cmd.exe's newline, quoting-depth and command-length limits. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { windows } from './platform.ts'

export async function withCliInputs(kind: 'github' | 'feishu', program: string, args: string[], cwd: string,
  run: (args: string[], cwd?: string) => Promise<string>): Promise<string> {
  if (!windows || !['.cmd', '.bat', '.ps1'].includes(extname(program).toLowerCase())) return run(args)
  let directory: string | undefined
  const input = async (text: string): Promise<string> => {
    directory ??= await mkdtemp(join(cwd, '.cli-input-'))
    const file = `input-${next++}.txt`
    await writeFile(join(directory, file), text, { mode: 0o600 })
    return `./${basename(directory)}/${file}`
  }
  let next = 0
  const mapped: string[] = []
  try {
    for (let index = 0; index < args.length; index++) {
      const flag = args[index]!, value = args[index + 1]
      if (value !== undefined && kind === 'github' && (flag === '-f' || flag === '--raw-field') && value.includes('=')) {
        const equals = value.indexOf('=')
        mapped.push('-F', `${value.slice(0, equals)}=@${await input(value.slice(equals + 1))}`)
        index++
      } else if (value !== undefined && kind === 'feishu' && ['--markdown', '--text', '--content', '--params', '--data'].includes(flag)
        && value !== '-' && !value.startsWith('@')) {
        mapped.push(flag, `@${await input(value)}`)
        index++
      } else mapped.push(flag)
    }
    // Lark only accepts relative file inputs below cwd. Keep other relative arguments in their original directory.
    return await run(mapped, cwd)
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
  }
}
