/** POSIX executor for managed sessions; shares the same account boundary as the Windows executor. */
import type { ShellExecRequest, ShellExecSpec } from '@deepseek-ai/dsh-shell'
import { SandboxBashExecutor } from '@deepseek-ai/dsh-bash-sandbox'
import { stampWorkerEnvironment } from './infra/worker-shell-environment.ts'

/** Adds account entries to each managed POSIX command without modifying the host process. */
export class WorkerBashExecutor extends SandboxBashExecutor {
  static override inject = [...SandboxBashExecutor.inject, 'orchestrator']
  override resolve(request: ShellExecRequest): ShellExecSpec { return stampWorkerEnvironment(this.ctx, super.resolve(request)) }
}
export default WorkerBashExecutor
