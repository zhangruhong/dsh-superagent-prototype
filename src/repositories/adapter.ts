import type { ChangeRequestKind, ChangeRequestRef, RepositoryBinding, RepositoryProvider } from '../core/index.ts'

export interface RepositoryCapabilities {
  readChangeRequest: boolean
  comment: boolean
  pipeline: boolean
  claim: boolean
  close: boolean
}
export interface RepositoryHealth { state: 'ready' | 'error' | 'unsupported'; detail: string }
export interface ChangeRequest {
  ref: ChangeRequestRef
  title: string
  description: string
  state: string
  author?: string
  updatedAt?: string
  pipeline?: { status: string; url?: string }
}
export interface RepositoryAdapter {
  readonly provider: RepositoryProvider
  readonly binding: RepositoryBinding
  capabilities(): RepositoryCapabilities
  health(): Promise<RepositoryHealth>
  link(ref: ChangeRequestRef): string
  readChangeRequest(ref: ChangeRequestRef): Promise<ChangeRequest>
  comment(ref: ChangeRequestRef, body: string): Promise<void>
  reportChangeRequest(ref: ChangeRequestRef, action: 'claim' | 'close'): Promise<void>
}
export class UnsupportedRepositoryOperation extends Error {
  constructor(readonly operation: string, provider: RepositoryProvider) { super(`${provider} does not support ${operation}`) }
}
export function changeRequestPath(kind: ChangeRequestKind): string {
  return kind === 'merge-request' ? 'merge_requests' : kind === 'pull-request' ? 'pulls' : 'issues'
}
