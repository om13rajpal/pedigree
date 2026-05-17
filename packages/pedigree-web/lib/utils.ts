/** General-purpose utility functions shared across the web app. */

import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Length of a shortened git SHA display. */
const SHORT_SHA_LENGTH = 7

/**
 * Merges Tailwind CSS classes with proper precedence handling.
 *
 * Combines clsx's conditional class joining with tailwind-merge's
 * duplicate-resolution so component variants compose cleanly.
 *
 * @param inputs - Class values to merge (strings, arrays, objects, or falsy).
 * @returns A single merged class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Truncates a full git SHA to its first 7 characters for display.
 *
 * @param sha - A full or partial commit SHA.
 * @returns The first 7 characters of the SHA.
 */
export function formatSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH)
}

/**
 * Formats an ISO 8601 date string into a human-readable date.
 *
 * @param iso - An ISO 8601 datetime string (e.g. "2026-05-16T14:32:11Z").
 * @returns A locale-formatted date like "May 16, 2026".
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formats an ISO 8601 datetime string into a full human-readable timestamp.
 *
 * @param iso - An ISO 8601 datetime string (e.g. "2026-05-16T14:32:11Z").
 * @returns A locale-formatted datetime like "May 16, 2026, 2:32 PM".
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
