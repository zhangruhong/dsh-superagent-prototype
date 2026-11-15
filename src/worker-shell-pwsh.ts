/** PowerShell executor for managed sessions; inherits DSH cancellation, sandbox and output handling. */
import type { ShellExecRequest, ShellExecSpec } from '@deepseek-ai/dsh-shell'
import { SandboxPwshExecutor } from '@deepseek-ai/dsh-pwsh-sandbox'
import { stampWorkerEnvironment } from './infra/worker-shell-environment.ts'

/** Adds account entries to each managed PowerShell command without modifying the host process. */
export class WorkerPwshExecutor extends SandboxPwshExecutor {
  static override inject = [...SandboxPwshExecutor.inject, 'orchestrator']
  override resolve(request: ShellExecRequest): ShellExecSpec { return stampWorkerEnvironment(this.ctx, super.resolve(request)) }
}
export default WorkerPwshExecutor
