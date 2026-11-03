import { expect, it } from 'vitest'
import { changeRequestKey } from '../src/core/index.ts'

it('keeps same IID objects distinct by provider and kind', () => {
  const issue = { provider: 'gitlab' as const, host: 'gitlab.com', repository: 'acme/app', kind: 'issue' as const, iid: 42 }
  const mergeRequest = { ...issue, kind: 'merge-request' as const }
  expect(changeRequestKey(issue)).toBe('gitlab:gitlab.com:acme/app:issue:42')
  expect(changeRequestKey(mergeRequest)).toBe('gitlab:gitlab.com:acme/app:merge-request:42')
  expect(changeRequestKey(issue)).not.toBe(changeRequestKey(mergeRequest))
})
