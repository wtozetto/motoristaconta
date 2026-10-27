import { describe, expect, it } from 'vitest'
import { appendAccessLog } from './api'

describe('appendAccessLog', () => {
  it('cria lista a partir de arquivo vazio', () => {
    const json = appendAccessLog(null, {
      at: '2026-10-26T12:00:00.000Z',
      email: 'ana@example.com',
      googleId: 'gid-1',
      userAgent: 'test',
    })
    expect(JSON.parse(json)).toHaveLength(1)
  })

  it('acrescenta e limita a 200', () => {
    const existing = JSON.stringify(
      Array.from({ length: 200 }, (_, i) => ({
        at: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
        email: 'a@b.c',
        googleId: 'g',
        userAgent: 'x',
      })),
    )
    const json = appendAccessLog(
      existing,
      {
        at: '2026-10-26T12:00:00.000Z',
        email: 'ana@example.com',
        googleId: 'gid-1',
        userAgent: 'test',
      },
      200,
    )
    const list = JSON.parse(json) as { email: string }[]
    expect(list).toHaveLength(200)
    expect(list.at(-1)?.email).toBe('ana@example.com')
  })
})
