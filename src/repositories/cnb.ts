import type { ChangeRequestRef, RepositoryBinding } from '../core/index.ts'
import { UnsupportedRepositoryOperation, type ChangeRequest, type RepositoryAdapter, type RepositoryCapabilities, type RepositoryHealth } from './adapter.ts'
import type { RepositoryConfig } from './config.ts'

/** Capability boundary for CNB; live operations remain explicit until the CNB API adapter is added. */
export class CnbRepositoryAdapter implements RepositoryAdapter {
  readonly provider = 'cnb' as const
  readonly binding: RepositoryBinding
  constructor(private readonly config: RepositoryConfig) {
    this.binding = { provider: 'cnb', host: config.host, repository: config.repository, defaultBranch: config.defaultBranch }
  }
  capabilities(): RepositoryCapabilities { return { readChangeRequest: false, comment: false, pipeline: false, claim: false, close: false } }
  async health(): Promise<RepositoryHealth> { return { state: 'unsupported', detail: 'CNB adapter is configured but live operations are not enabled in this release' } }
  link(ref: ChangeRequestRef): string { return `https://${this.config.host}/${this.config.repository}/-/pulls/${ref.iid}` }
  async readChangeRequest(_ref: ChangeRequestRef): Promise<ChangeRequest> { throw new UnsupportedRepositoryOperation('readChangeRequest', this.provider) }
  async comment(_ref: ChangeRequestRef, _body: string): Promise<void> { throw new UnsupportedRepositoryOperation('comment', this.provider) }
  async reportChangeRequest(_ref: ChangeRequestRef, action: 'claim' | 'close'): Promise<void> { throw new UnsupportedRepositoryOperation(action, this.provider) }
}
