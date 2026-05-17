/** QR code component encoding the canonical Passport URL for mobile scanning. */

'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'
import { DEFAULT_SPRING } from '@/components/motion/springs'
import { useRespectMotion } from '@/components/motion/respect-motion'
import { cn } from '@/lib/utils'

/** Base URL for the mobile verification page. */
const VERIFY_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/verify`
  : typeof window !== 'undefined'
    ? `${window.location.origin}/verify`
    : 'https://ibm-lilac.vercel.app/verify'

/** Minimum display size of the QR code in pixels. */
const QR_SIZE = 192

/** Delay in seconds before the QR code scales in. */
const ENTRANCE_DELAY = 0.4

/**
 * Props for the QRCode component.
 */
interface QRCodeProps {
  /** The commit SHA to encode in the QR code URL. */
  sha: string
}

/**
 * Renders a QR code encoding the canonical Passport URL for a commit.
 *
 * The QR code is generated client-side using the qrcode library with
 * high error correction. It animates in from scale 0 with a spring
 * transition, delayed 400ms after page load to let the hero content
 * settle first.
 *
 * @param sha - The commit SHA to encode in the QR URL.
 */
export function QRCode({ sha }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const { transition, isReduced } = useRespectMotion()

  const canonicalUrl = `${VERIFY_BASE_URL}/${sha}`

  useEffect(() => {
    void QRCodeLib.toDataURL(canonicalUrl, {
      errorCorrectionLevel: 'H',
      width: QR_SIZE * 2,
      margin: 2,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    }).then((url) => setDataUrl(url))
  }, [canonicalUrl])

  const springWithDelay = {
    ...DEFAULT_SPRING,
    delay: isReduced ? 0 : ENTRANCE_DELAY,
  }

  if (!dataUrl) {
    return (
      <div className={cn('flex flex-col items-center gap-3')} aria-label="Loading QR code">
        <div
          className="animate-pulse rounded-lg bg-neutral-200/60 dark:bg-neutral-700/60"
          style={{ width: QR_SIZE, height: QR_SIZE }}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={isReduced ? transition : springWithDelay}
      className="flex flex-col items-center gap-3"
      style={{ transformOrigin: 'center center' }}
    >
      <div className="rounded-lg bg-white p-3 shadow-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element -- reason: QR is a data URL generated at runtime, not a static asset */}
        <img
          src={dataUrl}
          alt={`QR code linking to ${canonicalUrl}`}
          width={QR_SIZE}
          height={QR_SIZE}
          className="block"
        />
      </div>
      <p className="text-2xs text-neutral-400 dark:text-neutral-500">Scan for quick verification</p>
    </motion.div>
  )
}
