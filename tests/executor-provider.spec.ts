import { expect, it } from 'vitest'
import { ChangeRequestReportSchema } from '../src/app/tools/executor.ts'

it('accepts a structured GitLab merge-request report', () => {
  expect(ChangeRequestReportSchema.parse({ provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', kind: 'merge-request', iid: 7 })).toEqual({
    provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', kind: 'merge-request', iid: 7,
  })
})

it('rejects an invalid structured change-request kind', () => {
  expect(() => ChangeRequestReportSchema.parse({ provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', kind: 'pull', iid: 7 })).toThrow()
})
