/** Recursive local repository discovery and deterministic target selection for workspace mode. */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { RepositoryBinding, RepositoryProvider } from '../core/index.ts'

export type WorkspaceProvider = RepositoryProvider | 'unknown'
export interface WorkspaceRepository {
  id: string
  alias: string
  path: string
  relativePath: string
  provider: WorkspaceProvider
  host: string
  repository: string
  defaultBranch: string
  remote?: string
  binding?: RepositoryBinding
}
export type RepositorySelection =
  | { status: 'selected'; repository: WorkspaceRepository; score: number }
  | { status: 'ambiguous'; repositories: WorkspaceRepository[] }
  | { status: 'none'; query: string }

const SKIP = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.cache', '.next', '.nuxt', 'target', 'tmp', 'temp'])
const normalized = (value: string): string => value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '').toLowerCase()
const cleanRemote = (value: string): string => value.trim().replace(/^\s+|\s+$/g, '').replace(/\.git\/?$/, '').replace(/\/$/, '')

function remoteParts(remote: string): { host: string; repository: string; provider: WorkspaceProvider } | undefined {
  const value = cleanRemote(remote)
  let host = '', repository = ''
  const ssh = /^[^@]+@([^:]+):(.+)$/.exec(value)
  if (ssh) { host = ssh[1]!; repository = ssh[2]! }
  else {
    try {
      const url = new URL(value)
      host = url.hostname
      repository = url.pathname.replace(/^\/+/, '')
    } catch { return undefined }
  }
  if (!host || !repository) return undefined
  repository = decodeURIComponent(repository).replace(/\.git\/?$/, '').replace(/\/$/, '')
  const lower = host.toLowerCase()
  const provider: WorkspaceProvider = lower === 'github.com' ? 'github' : lower === 'cnb.cool' || lower.endsWith('.cnb.cool') ? 'cnb'
    : lower.includes('gitlab') ? 'gitlab' : 'unknown'
  return { host: lower, repository, provider }
}

function gitDirectory(repositoryPath: string): string | undefined {
  const marker = join(repositoryPath, '.git')
  if (!existsSync(marker)) return undefined
  const stat = lstatSync(marker)
  if (stat.isDirectory()) return marker
  if (!stat.isFile()) return undefined
  const line = readFileSync(marker, 'utf8').split(/\r?\n/).find(item => /^gitdir:\s*/i.test(item))
  if (!line) return undefined
  return resolve(repositoryPath, line.replace(/^gitdir:\s*/i, '').trim())
}

function gitValue(config: string, section: string, key: string): string | undefined {
  const lines = config.split(/\r?\n/)
  let active = false
  for (const line of lines) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line)
    if (header) { active = header[1]!.trim().toLowerCase() === section.toLowerCase(); continue }
    if (active) {
      const value = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*=\\s*(.*?)\\s*$`, 'i').exec(line)?.[1]
      if (value !== undefined) return value
    }
  }
  return undefined
}

function repositoryInfo(path: string, root: string): WorkspaceRepository | undefined {
  const git = gitDirectory(path)
  if (!git) return undefined
  const configPath = join(git, 'config')
  const config = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
  const remote = gitValue(config, 'remote "origin"', 'url')
  const parsed = remote ? remoteParts(remote) : undefined
  const head = existsSync(join(git, 'HEAD')) ? readFileSync(join(git, 'HEAD'), 'utf8').trim() : ''
  const defaultBranch = /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1] ?? 'main'
  const relativePath = normalized(relative(root, path)) || basename(path)
  const alias = parsed?.repository.split('/').at(-1) || basename(path)
  const id = relativePath
  const candidate: WorkspaceRepository = { id, alias, path, relativePath, provider: parsed?.provider ?? 'unknown', host: parsed?.host ?? '', repository: parsed?.repository ?? '', defaultBranch, ...(remote ? { remote } : {}) }
  if (parsed && parsed.provider !== 'unknown') candidate.binding = { provider: parsed.provider, host: parsed.host, repository: parsed.repository, defaultBranch, alias, localPath: path }
  return candidate
}

/** Find every Git repository below an absolute workspace root, without following symlinks or common generated directories. */
export function discoverWorkspaceRepositories(workspaceRoot: string): WorkspaceRepository[] {
  if (!isAbsolute(workspaceRoot)) throw new Error('workspaceRoot must be an absolute path')
  const root = resolve(workspaceRoot)
  if (!statSync(root).isDirectory()) throw new Error('workspaceRoot must be a directory')
  const found: WorkspaceRepository[] = []
  const visit = (directory: string): void => {
    const repository = repositoryInfo(directory, root)
    if (repository) found.push(repository)
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP.has(entry.name)) continue
      visit(join(directory, entry.name))
    }
  }
  visit(root)
  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

const words = (value: string): string[] => normalized(value).split(/[^a-z0-9]+/).filter(Boolean)
const repositoryHint = (query: string): string | undefined => /(?:repo(?:sitory)?|仓库)\s*[:=：]\s*([^\s,，]+)/i.exec(query)?.[1]

/** Select a single candidate by explicit identifier, metadata score, or configured default; ties are never guessed. */
export function selectWorkspaceRepository(candidates: readonly WorkspaceRepository[], query: string, defaultRepository = ''): RepositorySelection {
  if (!candidates.length) return { status: 'none', query }
  const hint = repositoryHint(query)
  const requested = normalized(hint ?? query)
  const exact = (candidate: WorkspaceRepository, value: string): boolean => [candidate.id, candidate.alias, candidate.relativePath,
    candidate.repository, `${candidate.provider}:${candidate.host}/${candidate.repository}`].some(item => normalized(item) === value)
  if (hint) {
    const matches = candidates.filter(candidate => exact(candidate, normalized(hint)))
    if (matches.length === 1) return { status: 'selected', repository: matches[0]!, score: 1000 }
    if (matches.length > 1) return { status: 'ambiguous', repositories: matches }
  }
  if (!query.trim() && defaultRepository) {
    const matches = candidates.filter(candidate => exact(candidate, normalized(defaultRepository)))
    if (matches.length === 1) return { status: 'selected', repository: matches[0]!, score: 900 }
  }
  if (!query.trim() && candidates.length === 1) return { status: 'selected', repository: candidates[0]!, score: 1 }
  const queryWords = new Set(words(requested))
  const scored = candidates.map(repository => {
    const fields = [repository.alias, repository.relativePath, repository.repository, repository.provider, repository.host]
    let score = 0
    for (const field of fields) for (const word of words(field)) if (queryWords.has(word)) score += field === repository.alias ? 50 : field === repository.repository ? 35 : 15
    return { repository, score }
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.repository.relativePath.localeCompare(b.repository.relativePath))
  if (!scored.length) {
    if (defaultRepository) {
      const fallback = candidates.find(candidate => exact(candidate, normalized(defaultRepository)))
      if (fallback) return { status: 'selected', repository: fallback, score: 1 }
    }
    if (candidates.length === 1) return { status: 'selected', repository: candidates[0]!, score: 1 }
    return { status: 'none', query }
  }
  const top = scored[0]!
  const tied = scored.filter(item => item.score === top.score).map(item => item.repository)
  return tied.length === 1 ? { status: 'selected', repository: top.repository, score: top.score } : { status: 'ambiguous', repositories: tied }
}

/** Stable key shared by workspace bindings and adapter lookup. */
export const workspaceRepositoryKey = (repository: Pick<WorkspaceRepository, 'provider' | 'host' | 'repository' | 'path'>): string =>
  `${repository.provider}:${repository.host.toLowerCase()}:${repository.repository}:${repository.path}`
