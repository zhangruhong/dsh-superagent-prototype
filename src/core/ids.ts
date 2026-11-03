/** Stable content-derived identifiers; equal inputs always produce the same id. */
import { createHash } from 'node:crypto'
import type { ChangeRequestRef } from './model.ts'
export function key(...values: string[]): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 32)
}

/** Stable provider-neutral identity; object kind is part of the key because Issue and MR numbers overlap. */
export function changeRequestKey(ref: Pick<ChangeRequestRef, 'provider' | 'host' | 'repository' | 'kind' | 'iid'>): string {
  return [ref.provider, ref.host.toLowerCase(), ref.repository, ref.kind, String(ref.iid)].join(':')
}
