/** Shared environment boundary of the managed presets; never stamps ordinary Desktop shells. */
import type { Context } from '@deepseek-ai/cordis'
import type { ShellExecSpec } from '@deepseek-ai/dsh-shell'

export function stampWorkerEnvironment(ctx: Context, spec: ShellExecSpec): ShellExecSpec {
  const runtime = ctx.get('orchestrator') as { workerEnvironment: NodeJS.ProcessEnv } | undefined
  if (!runtime) throw new Error('The dsh-superagent shell requires its orchestrator runtime')
  // DSH's subprocess env contract accepts undefined tombstones. Shell's narrower type predates that contract.
  return { ...spec, env: { ...spec.env, ...runtime.workerEnvironment } as Record<string, string> }
}
