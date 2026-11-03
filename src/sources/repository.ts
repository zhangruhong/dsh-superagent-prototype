import type { Context } from '@deepseek-ai/cordis'
import { RepositoryConfigSchema, type RepositoryConfig } from '../repositories/config.ts'
import type { SourceKind } from './kind.ts'

export const SOURCE = 'repository'
export const repositoryKind: SourceKind<RepositoryConfig> = {
  kind: SOURCE,
  title: { zh: '代码仓库', en: 'Repository' },
  description: { zh: '选择执行任务的 GitLab 或 CNB 仓库；GitHub 继续在 GitHub 来源中配置。', en: 'Select the GitLab or CNB repository used for work; configure GitHub in the GitHub Source.' },
  schema: RepositoryConfigSchema,
  fields: [
    { key: 'provider', type: 'select', label: { zh: '提供方', en: 'Provider' }, options: [{ value: 'gitlab', label: { zh: 'GitLab', en: 'GitLab' } }, { value: 'cnb', label: { zh: 'CNB', en: 'CNB' } }] },
    { key: 'host', type: 'text', label: { zh: '主机', en: 'Host' } },
    { key: 'repository', type: 'text', label: { zh: '项目/仓库', en: 'Project/repository' } },
    { key: 'token', type: 'text', advanced: true, label: { zh: '访问令牌', en: 'Access token' } },
    { key: 'defaultBranch', type: 'text', advanced: true, label: { zh: '默认分支', en: 'Default branch' } },
    { key: 'pollSeconds', type: 'number', advanced: true, min: 15, max: 3600, label: { zh: '轮询间隔 / 秒', en: 'Polling interval / seconds' } },
  ],
  health: [],
}
export const name = 'dsh-superagent-repository'
export const inject = ['orchestrator']
export function apply(ctx: Context): void { ctx.effect(() => ctx.orchestrator.sources.register(repositoryKind), 'repository: provider configuration') }
