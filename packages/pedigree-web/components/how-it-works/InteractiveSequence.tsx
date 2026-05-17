'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2,
  Bot,
  FileKey2,
  ShieldCheck,
  Database,
  Eye,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Step {
  id: string
  number: number
  title: string
  subtitle: string
  description: string
  codeExample: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}

const STEPS: readonly Step[] = [
  {
    id: 'write',
    number: 1,
    title: 'Developer writes code',
    subtitle: 'Human, AI-assisted, or fully autonomous',
    description:
      'Code enters the repository through any authorship model. Pedigree does not change your workflow. It observes and records the authorship kind automatically.',
    codeExample: `// Developer writes a new API route
app.post('/api/users', async (req, res) => {
  const user = await db.users.create(req.body);
  res.json(user);
});`,
    icon: Code2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'detect',
    number: 2,
    title: 'Bob detects the commit',
    subtitle: 'Provenance Officer mode reads AGENTS.md',
    description:
      'When Bob is in Provenance Officer mode, the sign-on-commit Skill fires before every git commit. It reads AGENTS.md to determine risk class and whether human approval is required.',
    codeExample: `# AGENTS.md Risk Policy
## Risk Classes
- HIGH: src/auth/**, src/payments/**
- MEDIUM: src/api/**, src/services/**
- LOW: docs/**, tests/**

## Provenance Policy
All src/** commits MUST carry attestation.
HIGH-risk: humanApprover.approved = true`,
    icon: Bot,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
  },
  {
    id: 'predicate',
    number: 3,
    title: 'Predicate is assembled',
    subtitle: 'pedigree-mcp captures provenance fields',
    description:
      'The MCP server builds a structured predicate: agent identity, model, Skill content hashes, AGENTS.md hash, prompt hash, scope, and policy status. Every field is content-addressed.',
    codeExample: `{
  "authorship": {
    "kind": "ai-assisted",
    "humanShare": 0.35,
    "humanApprover": { "approved": true }
  },
  "agent": {
    "tool": "ibm-bob",
    "model": "granite-3.3-8b-instruct"
  },
  "scope": {
    "filesTouched": ["src/api/users.ts"],
    "riskClass": "medium"
  }
}`,
    icon: FileKey2,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'sign',
    number: 4,
    title: 'DSSE envelope is signed',
    subtitle: 'ed25519 or Sigstore Fulcio',
    description:
      'The predicate is wrapped in an in-toto Statement v1, then signed using DSSE (Dead Simple Signing Envelope). Sigstore provides keyless OIDC signing; ed25519 is the offline fallback.',
    codeExample: `// DSSE envelope structure
{
  "payloadType":
    "application/vnd.in-toto+json",
  "payload": "<base64-statement>",
  "signatures": [{
    "keyid": "ed25519:abc123...",
    "sig": "<base64-signature>"
  }]
}`,
    icon: ShieldCheck,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    id: 'rekor',
    number: 5,
    title: 'Logged in Rekor',
    subtitle: 'Public transparency log, tamper evidence',
    description:
      "The signed envelope is submitted to Sigstore's Rekor transparency log. This creates an immutable, publicly auditable record. Anyone can verify the entry with just the Rekor UUID.",
    codeExample: `# Verify a Rekor entry
$ rekor-cli get --uuid \\
  24296fb24b8ad77a...

LogID:  c0d23d6ad406973f...
Index:  12345678
Time:   2026-05-16T14:32:11Z
Body: {
  "kind": "dsse",
  "apiVersion": "0.0.1"
}`,
    icon: Database,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
  },
  {
    id: 'passport',
    number: 6,
    title: 'Code Passport is live',
    subtitle: 'One URL, full chain of custody',
    description:
      'The Passport page renders the full chain of custody: origin, agent signature, human approval, Sigstore witness, and verification status. QR code included for mobile auditors.',
    codeExample: `# Access the passport
ibm-lilac.vercel.app/passport/<sha>

Chain of Custody:
 Origin:    Om Rajpal committed
 Agent:     ibm-bob v1.4.2
 Approval:  approved via OIDC
 Sigstore:  Rekor UUID 24296fb2
 Status:    Full chain verified`,
    icon: Eye,
    color: 'text-accent dark:text-accent-dark',
    bgColor: 'bg-accent/10 dark:bg-accent-dark/10',
  },
] as const

const AUTO_ROTATE_MS = 4000

export function InteractiveSequence() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % STEPS.length)
    }, AUTO_ROTATE_MS)
    return () => clearInterval(timer)
  }, [paused])

  const step = STEPS[activeIndex]!
  if (!step) return null

  function goTo(i: number) {
    setActiveIndex(i)
    setPaused(true)
    setTimeout(() => setPaused(false), AUTO_ROTATE_MS * 3)
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24">
      <div className="mb-12 space-y-3 text-center">
        <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-2xl">
          Deep dive, step by step
        </h2>
        <p className="mx-auto max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Click each step to explore, or let it auto-advance every few seconds.
        </p>
      </div>

      {/* Step selector */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
              i === activeIndex
                ? 'bg-neutral-950 text-white shadow-md dark:bg-neutral-50 dark:text-neutral-950'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700',
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-2xs font-bold dark:bg-neutral-950/20">
              {s.number}
            </span>
            <span className="hidden sm:inline">{s.title.split(' ').slice(0, 2).join(' ')}</span>
          </button>
        ))}
      </div>

      {/* Step detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="grid gap-8 lg:grid-cols-2"
        >
          {/* Left: explanation */}
          <div className="flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                    step.bgColor,
                  )}
                >
                  <step.icon className={cn('h-6 w-6', step.color)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                    Step {step.number} of {STEPS.length}
                  </p>
                  <h3 className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
                    {step.title}
                  </h3>
                </div>
              </div>

              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {step.subtitle}
              </p>

              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {step.description}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={activeIndex === 0}
                onClick={() => goTo(Math.max(0, activeIndex - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={activeIndex === STEPS.length - 1}
                onClick={() => goTo(Math.min(STEPS.length - 1, activeIndex + 1))}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Right: code example */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200/60 bg-neutral-950 shadow-lg dark:border-neutral-700/60">
            <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-2 text-2xs text-neutral-500">step-{step.number}.example</span>
            </div>
            <div className="min-h-[240px] flex-1 p-4">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-400">
                <code>{step.codeExample}</code>
              </pre>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="mt-8 flex justify-center">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === activeIndex
                  ? 'w-8 bg-accent dark:bg-accent-dark'
                  : 'w-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600',
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
