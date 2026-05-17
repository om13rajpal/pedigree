import crypto from 'node:crypto'

const PAYLOAD_TYPE = 'application/vnd.in-toto+json'
const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1'
const PREDICATE_TYPE = 'dev.pedigree/ai-authorship/v1'

function getSigningKey(): crypto.KeyObject {
  const pem = process.env.PEDIGREE_SIGNING_KEY?.replace(/\\n/g, '\n')
  if (!pem) throw new Error('PEDIGREE_SIGNING_KEY env var not set')
  return crypto.createPrivateKey(pem)
}

function getPublicKeyId(): string {
  const priv = getSigningKey()
  const pub = crypto.createPublicKey(priv)
  const der = pub.export({ type: 'spki', format: 'der' })
  return `ed25519:${crypto.createHash('sha256').update(der).digest('hex')}`
}

export function buildInTotoStatement(commitSha: string, predicate: Record<string, unknown>) {
  return {
    _type: STATEMENT_TYPE,
    subject: [
      {
        name: commitSha,
        digest: { sha1: commitSha },
      },
    ],
    predicateType: PREDICATE_TYPE,
    predicate,
  }
}

function computePAE(payloadType: string, payload: string): Buffer {
  const typeBytes = Buffer.from(payloadType, 'utf-8')
  const payloadBytes = Buffer.from(payload, 'utf-8')
  const header = Buffer.from(
    `DSSEv1 ${typeBytes.length} ${payloadType} ${payloadBytes.length} `,
    'utf-8',
  )
  return Buffer.concat([header, payloadBytes])
}

export function signDSSE(statement: Record<string, unknown>): {
  envelope: {
    payloadType: string
    payload: string
    signatures: Array<{ keyid: string; sig: string }>
  }
  keyId: string
} {
  const payload = JSON.stringify(statement)
  const payloadB64 = Buffer.from(payload).toString('base64')

  const pae = computePAE(PAYLOAD_TYPE, payload)
  const privateKey = getSigningKey()
  const signature = crypto.sign(null, pae, privateKey)
  const keyId = getPublicKeyId()

  return {
    envelope: {
      payloadType: PAYLOAD_TYPE,
      payload: payloadB64,
      signatures: [
        {
          keyid: keyId,
          sig: signature.toString('base64'),
        },
      ],
    },
    keyId,
  }
}

export function verifyDSSE(envelope: {
  payloadType: string
  payload: string
  signatures: Array<{ keyid: string; sig: string }>
}): boolean {
  try {
    const payload = Buffer.from(envelope.payload, 'base64').toString('utf-8')
    const pae = computePAE(envelope.payloadType, payload)
    const privateKey = getSigningKey()
    const publicKey = crypto.createPublicKey(privateKey)

    for (const sig of envelope.signatures) {
      const sigBuf = Buffer.from(sig.sig, 'base64')
      const valid = crypto.verify(null, pae, publicKey, sigBuf)
      if (valid) return true
    }
    return false
  } catch {
    return false
  }
}

function getPublicKeyPem(): string {
  const priv = getSigningKey()
  const pub = crypto.createPublicKey(priv)
  return pub.export({ type: 'spki', format: 'pem' }).toString()
}

export async function submitToRekor(
  envelope: Record<string, unknown>,
): Promise<{ uuid: string; logIndex: number; entryUrl: string } | null> {
  try {
    const envelopeStr = JSON.stringify(envelope)
    const publicKeyPem = getPublicKeyPem()
    const payloadBytes = Buffer.from((envelope as { payload: string }).payload, 'base64')

    const body = {
      apiVersion: '0.0.1',
      kind: 'dsse',
      spec: {
        proposedContent: {
          envelope: envelopeStr,
          verifiers: [Buffer.from(publicKeyPem).toString('base64')],
        },
        content: {
          envelope: envelopeStr,
          payloadHash: {
            algorithm: 'sha256',
            value: crypto.createHash('sha256').update(payloadBytes).digest('hex'),
          },
        },
      },
    }

    const res = await fetch('https://rekor.sigstore.dev/api/v1/log/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      void errText
      return null
    }

    const data = await res.json()
    const entries = Object.entries(data) as Array<[string, { logIndex: number }]>
    if (entries.length === 0) return null

    const [uuid, entry] = entries[0]!
    return {
      uuid,
      logIndex: entry.logIndex,
      entryUrl: `https://search.sigstore.dev/?logIndex=${entry.logIndex}`,
    }
  } catch {
    return null
  }
}
