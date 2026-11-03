import type { Context } from '@deepseek-ai/cordis'
import { RepositoryConfigSchema, type RepositoryConfig } from '../repositories/config.ts'
import type { SourceKind } from './kind.ts'

export const SOURCE = 'repository'
export const repositoryKind: SourceKind<RepositoryConfig> = {
  kind: SOURCE,
  title: { zh: '代码仓库', en: 'Repository' },
  description: { zh: '选择单个 GitLab/CNB 仓库，或让系统扫描工作区中的多个仓库；GitHub 继续在 GitHub 来源中配置。', en: 'Select one GitLab/CNB repository, or discover repositories in a workspace; configure GitHub in the GitHub Source.' },
  schema: RepositoryConfigSchema,
  fields: [
    { key: 'mode', type: 'select', label: { zh: '仓库模式', en: 'Repository mode' }, options: [{ value: 'single', label: { zh: '单个仓库', en: 'Single repository' } }, { value: 'workspace', label: { zh: '工作区自动发现', en: 'Discover workspace' } }] },
    { key: 'provider', type: 'select', label: { zh: '提供方', en: 'Provider' }, options: [{ value: 'gitlab', label: { zh: 'GitLab', en: 'GitLab' } }, { value: 'cnb', label: { zh: 'CNB', en: 'CNB' } }] },
    { key: 'host', type: 'text', label: { zh: '主机', en: 'Host' } },
    { key: 'repository', type: 'text', label: { zh: '项目/仓库', en: 'Project/repository' } },
    { key: 'workspaceRoot', type: 'text', label: { zh: '工作区目录', en: 'Workspace directory' }, hint: { zh: '递归扫描此目录下的 Git 仓库；不会跟随符号链接。', en: 'Recursively scan Git repositories below this directory; symbolic links are not followed.' } },
    { key: 'defaultRepository', type: 'text', advanced: true, label: { zh: '默认仓库', en: 'Default repository' } },
    { key: 'token', type: 'text', advanced: true, label: { zh: '访问令牌', en: 'Access token' } },
    { key: 'defaultBranch', type: 'text', advanced: true, label: { zh: '默认分支', en: 'Default branch' } },
    { key: 'pollSeconds', type: 'number', advanced: true, min: 15, max: 3600, label: { zh: '轮询间隔 / 秒', en: 'Polling interval / seconds' } },
  ],
  health: [],
  environment: {
    variables: [
      { key: 'DSH_SUPERAGENT_REPOSITORY_PROVIDER', description: { zh: '当前工单使用的代码仓库提供方', en: 'Repository provider used by this ticket' } },
      { key: 'DSH_SUPERAGENT_REPOSITORY_HOST', description: { zh: '当前代码仓库的主机', en: 'Repository host' } },
      { key: 'DSH_SUPERAGENT_REPOSITORY', description: { zh: '当前工单使用的项目/仓库', en: 'Repository used by this ticket' } },
      { key: 'DSH_SUPERAGENT_REPOSITORY_DEFAULT_BRANCH', description: { zh: '当前代码仓库的默认分支', en: 'Repository default branch' } },
    ],
    values: ({ deployment, ticket }) => {
      const binding = ticket?.repository ?? deployment.repositoryBinding
      return {
        DSH_SUPERAGENT_REPOSITORY_PROVIDER: binding?.provider ?? 'github',
        DSH_SUPERAGENT_REPOSITORY_HOST: binding?.host ?? 'github.com',
        DSH_SUPERAGENT_REPOSITORY: binding?.repository ?? deployment.repository,
        DSH_SUPERAGENT_REPOSITORY_DEFAULT_BRANCH: binding?.defaultBranch ?? '',
      }
    },
  },
}
export const name = 'dsh-superagent-repository'
export const inject = ['orchestrator']
export function apply(ctx: Context): void { ctx.effect(() => ctx.orchestrator.sources.register(repositoryKind), 'repository: provider configuration') }
