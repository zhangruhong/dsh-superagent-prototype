import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
  name: string; version: string; private?: boolean; files?: string[]; scripts?: Record<string, string>
  dsh?: { bundle?: { patch?: string }; manifestVersion?: number }; engines?: { dsh?: string }
}

describe('published Harness bundle', () => {
  it('has the metadata required for direct DSH installation', () => {
    expect(manifest.name).toBe('dsh-superagent')
    expect(manifest.private).toBe(false)
    expect(manifest.version).toBe('0.2.3')
    expect(manifest.dsh).toMatchObject({ bundle: { patch: './cordis.patch.yml' }, manifestVersion: 1 })
    expect(manifest.engines?.dsh).toBeTruthy()
    expect(manifest.files).toEqual(expect.arrayContaining(['lib', 'cordis.patch.yml', 'README.md', 'docs/*.md', 'examples/*.yml', 'prompts', 'skills']))
    expect(manifest.scripts?.prepack).toBe('pnpm build')
    expect(manifest.scripts?.['pack:plugin']).toContain('pnpm pack')
  })
})
