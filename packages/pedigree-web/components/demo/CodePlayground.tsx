'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Loader2,
  CheckCircle2,
  GitCommit,
  ShieldCheck,
  Upload,
  ExternalLink,
  Sparkles,
  User,
  Bot,
  Users,
  ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createApproval } from '@/lib/approval'
import type { ApprovalPayload } from '@/lib/approval'

type Scenario = 'human' | 'ai-assisted' | 'ai-autonomous'
type SubmitPhase = 'idle' | 'approving' | 'committing' | 'signing' | 'pushing' | 'done' | 'error'

interface SubmitResult {
  sha: string
  shortSha: string
  rekorUuid: string
  passportUrl: string
  repoUrl: string
  authorshipKind: Scenario
  isVerified: boolean
  model?: string
}

const PHASE_LABELS: Record<SubmitPhase, string> = {
  idle: '',
  approving: 'Recording human approval (Web Crypto ECDSA P-256)...',
  committing: 'Creating git commit...',
  signing: 'Signing with ed25519 DSSE envelope...',
  pushing: 'Submitting to Rekor transparency log...',
  done: 'Attestation complete!',
  error: 'Something went wrong.',
}

const MODELS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'ibm-granite/granite-4.1-8b', label: 'Granite 4.1 8B', provider: 'IBM' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', provider: 'Meta' },
  { id: 'x-ai/grok-4.3', label: 'Grok 4.3', provider: 'xAI' },
]

export function CodePlayground() {
  const [code, setCode] = React.useState('')
  const [fileName, setFileName] = React.useState('snippet.ts')
  const [phase, setPhase] = React.useState<SubmitPhase>('idle')
  const [result, setResult] = React.useState<SubmitResult | null>(null)
  const [error, setError] = React.useState('')
  const [humanTyped, setHumanTyped] = React.useState(false)
  const [aiGenerated, setAiGenerated] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState(MODELS[0]!)
  const [showModelPicker, setShowModelPicker] = React.useState(false)
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [usedModel, setUsedModel] = React.useState<string | null>(null)
  const [usedPrompt, setUsedPrompt] = React.useState<string | null>(null)
  const [approved, setApproved] = React.useState(false)
  const [approvalData, setApprovalData] = React.useState<ApprovalPayload | null>(null)

  const scenario: Scenario | null =
    humanTyped && aiGenerated
      ? 'ai-assisted'
      : aiGenerated
        ? 'ai-autonomous'
        : humanTyped
          ? 'human'
          : null

  const needsApproval = scenario === 'ai-autonomous' || scenario === 'ai-assisted'
  const canSubmit =
    scenario !== null &&
    code.trim().length > 0 &&
    fileName.trim().length > 0 &&
    (!needsApproval || approved)

  function handleCodeChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setCode(e.target.value)
    setHumanTyped(true)
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/demo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, model: selectedModel.id }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setCode(data.code)
      setFileName(data.fileName)
      setAiGenerated(true)
      setUsedModel(data.model)
      setUsedPrompt(aiPrompt)
      setAiPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    try {
      const payload = await createApproval(code, 'Om Rajpal')
      setApprovalData(payload)
      setApproved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !scenario) return

    setError('')
    setResult(null)

    try {
      if (needsApproval) {
        setPhase('approving')
        await delay(400)
      }

      setPhase('committing')
      await delay(600)

      setPhase('signing')
      const response = await fetch('/api/demo/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          fileName: fileName.trim(),
          scenario,
          model: usedModel ?? undefined,
          prompt: usedPrompt ?? undefined,
          approval: approvalData ?? undefined,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }

      setPhase('pushing')
      await delay(500)

      const data = await response.json()
      setResult({
        sha: data.sha,
        shortSha: data.sha.slice(0, 7),
        rekorUuid: data.rekorUuid ?? '',
        passportUrl: `/passport/${data.sha}`,
        repoUrl: data.repoUrl ?? '',
        authorshipKind: scenario,
        isVerified: data.isVerified ?? true,
        model: usedModel ?? undefined,
      })
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }

  function handleReset() {
    setPhase('idle')
    setResult(null)
    setError('')
    setCode('')
    setHumanTyped(false)
    setAiGenerated(false)
    setUsedModel(null)
    setUsedPrompt(null)
    setShowModelPicker(false)
    setApproved(false)
    setApprovalData(null)
    setFileName('snippet.ts')
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          Try It: Sign a Code Snippet
        </h2>
        <p className="mx-auto max-w-lg text-xs text-neutral-500 dark:text-neutral-400">
          Write code yourself, generate it with AI, or combine both. Pedigree automatically detects
          the authorship kind and signs the attestation accordingly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* AI generation: model selector + prompt — always visible */}
        <div className="space-y-3 rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-4 dark:border-neutral-700/60 dark:bg-neutral-800/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent dark:text-accent-dark" />
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Generate with AI
            </span>
            <span className="text-2xs text-neutral-400">or type code manually below</span>
          </div>

          {/* Model selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelPicker(!showModelPicker)}
              disabled={phase !== 'idle'}
              className="flex w-full items-center justify-between rounded-lg border border-neutral-200/60 bg-white px-3 py-2.5 text-xs dark:border-neutral-700/60 dark:bg-neutral-900"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5 text-neutral-400" />
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {selectedModel.label}
                </span>
                <span className="text-neutral-400">{selectedModel.provider}</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-neutral-400 transition-transform',
                  showModelPicker && 'rotate-180',
                )}
              />
            </button>
            {showModelPicker && (
              <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-neutral-200/60 bg-white p-1 shadow-lg dark:border-neutral-700/60 dark:bg-neutral-900">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m)
                      setShowModelPicker(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors',
                      m.id === selectedModel.id
                        ? 'bg-accent/10 text-accent dark:text-accent-dark'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                    )}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="text-neutral-400">{m.provider}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prompt input + generate button */}
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleGenerate()
                }
              }}
              placeholder="e.g. fibonacci function, rate limiter, JWT auth middleware..."
              className="flex-1 rounded-lg border border-neutral-200/60 bg-white px-3 py-2.5 text-xs text-neutral-700 placeholder-neutral-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-neutral-700/60 dark:bg-neutral-900 dark:text-neutral-300"
              disabled={generating || phase !== 'idle'}
            />
            <Button
              type="button"
              size="sm"
              disabled={!aiPrompt.trim() || generating || phase !== 'idle'}
              onClick={() => void handleGenerate()}
              className="gap-1.5 px-4"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Authorship indicator + filename */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {scenario ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5"
              >
                {scenario === 'human' && <User className="h-4 w-4 text-blue-500" />}
                {scenario === 'ai-assisted' && <Users className="h-4 w-4 text-violet-500" />}
                {scenario === 'ai-autonomous' && <Bot className="h-4 w-4 text-amber-500" />}
                <Badge
                  variant={
                    scenario === 'human'
                      ? 'success'
                      : scenario === 'ai-assisted'
                        ? 'secondary'
                        : 'warning'
                  }
                >
                  {scenario === 'human'
                    ? 'Human Only'
                    : scenario === 'ai-assisted'
                      ? 'AI-Assisted'
                      : 'AI Autonomous'}
                </Badge>
                <span className="text-2xs text-neutral-400">auto-detected</span>
              </motion.div>
            ) : (
              <span className="text-2xs text-neutral-400">Generate above or type below...</span>
            )}
          </div>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-28 rounded border border-neutral-200/60 bg-neutral-50 px-2 py-1 font-mono text-2xs text-neutral-700 focus:border-accent focus:outline-none dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-300"
            placeholder="filename.ts"
            disabled={phase !== 'idle'}
            aria-label="File name"
          />
        </div>

        {/* Code editor */}
        <div className="relative">
          <textarea
            id="code-input"
            value={code}
            onChange={handleCodeChange}
            rows={10}
            spellCheck={false}
            className="w-full rounded-lg border border-neutral-200/60 bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-emerald-400 placeholder-neutral-600 shadow-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-neutral-700/60 dark:focus:border-accent-dark dark:focus:ring-accent-dark/20"
            placeholder={
              '// Type your own code here (detected as Human)\n// Or use the AI generator above...'
            }
            disabled={phase !== 'idle'}
          />
          {usedModel && (
            <div className="absolute bottom-3 right-3 rounded bg-neutral-800/80 px-2 py-1 text-2xs text-neutral-400">
              Generated by {MODELS.find((m) => m.id === usedModel)?.label ?? usedModel}
            </div>
          )}
        </div>

        {/* Approval gate for AI code */}
        <AnimatePresence>
          {needsApproval && code.trim().length > 0 && phase === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {approved ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Code reviewed and approved
                  </span>
                  <span className="text-2xs text-emerald-500 dark:text-emerald-600">
                    ECDSA P-256 signature recorded
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      AI-generated code requires human approval before signing
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleApprove()}
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />I Approve This Code
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {phase !== 'idle' && phase !== 'done' && phase !== 'error' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <ProgressIndicator phase={phase} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-2">
            {(phase === 'done' || phase === 'error') && (
              <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                Try Another
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || (phase !== 'idle' && phase !== 'error')}
              className="gap-2"
            >
              {phase === 'idle' || phase === 'error' ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Sign & Push
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </form>

      {/* Result */}
      <AnimatePresence>
        {result && phase === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <ResultCard result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function ProgressIndicator({ phase }: { phase: SubmitPhase }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    approving: User,
    committing: GitCommit,
    signing: ShieldCheck,
    pushing: Upload,
  }
  const Icon = icons[phase] ?? Loader2
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <Icon className={cn('h-4 w-4', phase !== 'done' && 'animate-pulse')} />
      <span>{PHASE_LABELS[phase]}</span>
    </div>
  )
}

function ResultCard({ result }: { result: SubmitResult }) {
  const modelLabel = result.model
    ? MODELS.find((m) => m.id === result.model)?.label ?? result.model
    : null

  return (
    <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-800/40">
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-accent dark:from-emerald-500 dark:to-accent-dark" />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              Attestation Created
            </p>
            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
              Commit signed, attested, and pushed to demo repository
            </p>
          </div>
          <Badge variant={result.isVerified ? 'success' : 'error'}>
            {result.isVerified ? 'Verified' : 'Unverified'}
          </Badge>
        </div>

        <div className="grid gap-3 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800/50 sm:grid-cols-2">
          <DetailRow label="Commit SHA" value={result.shortSha} mono />
          <DetailRow label="Authorship" value={result.authorshipKind} />
          {result.rekorUuid && (
            <DetailRow label="Rekor UUID" value={result.rekorUuid.slice(0, 16) + '...'} mono />
          )}
          <DetailRow label="Signer" value="ed25519 (DSSE)" />
          {modelLabel && <DetailRow label="Model" value={modelLabel} />}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link href={result.passportUrl}>
              <ShieldCheck className="h-3.5 w-3.5" />
              View Code Passport
            </Link>
          </Button>
          {result.repoUrl && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={result.repoUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                View on GitHub
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs font-medium text-neutral-400 dark:text-neutral-500">{label}</p>
      <p className={cn('text-xs text-neutral-800 dark:text-neutral-200', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
