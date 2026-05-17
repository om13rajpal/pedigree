export interface ApprovalPayload {
  codeHash: string
  timestamp: string
  approver: string
  signature: string
  publicKey: string
}

export async function createApproval(code: string, approver: string): Promise<ApprovalPayload> {
  const timestamp = new Date().toISOString()
  const encoder = new TextEncoder()

  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])

  const codeBytes = encoder.encode(code)
  const codeHashBuf = await crypto.subtle.digest('SHA-256', codeBytes)
  const codeHash = Array.from(new Uint8Array(codeHashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const message = encoder.encode(`${codeHash}:APPROVED:${timestamp}:${approver}`)
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    message,
  )

  const pubKeyBuf = await crypto.subtle.exportKey('raw', keyPair.publicKey)

  return {
    codeHash,
    timestamp,
    approver,
    signature: bufToHex(sigBuf),
    publicKey: bufToHex(pubKeyBuf),
  }
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
