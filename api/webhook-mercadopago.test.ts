import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { validWebhookSignature } from './webhook-mercadopago.js'

describe('validacao de assinatura do webhook Mercado Pago', () => {
  const secret = 'test-secret'
  const requestId = 'request-123'
  const dataId = '987654321'
  const timestamp = '1731513600'
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`
  const signature = `ts=${timestamp},v1=${createHmac('sha256', secret).update(manifest).digest('hex')}`

  it('aceita somente o manifesto assinado para a requisição', () => {
    expect(validWebhookSignature(signature, requestId, dataId, secret)).toBe(true)
    expect(validWebhookSignature(signature, requestId, '987654322', secret)).toBe(false)
    expect(validWebhookSignature(signature, 'other-request', dataId, secret)).toBe(false)
    expect(validWebhookSignature(signature, requestId, dataId, 'wrong-secret')).toBe(false)
    expect(validWebhookSignature('invalid', requestId, dataId, secret)).toBe(false)
  })
})
