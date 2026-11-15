/** A real, portable Node account CLI; Windows launches it through a batch wrapper like npm CLIs. */
import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'

export function nodeCli(file: string, body: string): string {
  if (process.platform !== 'win32') {
    writeFileSync(file, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 })
    return file
  }
  const script = `${file}.cjs`
  writeFileSync(script, body)
  writeFileSync(`${file}.cmd`, `@echo off\r\n@"${process.execPath}" "%~dp0${basename(script)}" %*\r\n`)
  return `${file}.cmd`
}
