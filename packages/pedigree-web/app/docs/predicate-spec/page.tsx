/** Predicate specification page -- renders the spec as structured HTML. */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Predicate Spec -- Pedigree',
  description:
    'RFC-style specification for the dev.pedigree/ai-authorship/v1 predicate type used in Pedigree attestations.',
}

/**
 * Renders the predicate specification as a readable document page.
 */
export default function PredicateSpecPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to home
      </Link>

      <header className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
          Predicate Specification
        </h1>
        <p className="font-mono text-sm text-accent dark:text-accent-dark">
          dev.pedigree/ai-authorship/v1
        </p>
        <div className="flex gap-4 text-2xs text-neutral-500 dark:text-neutral-400">
          <span>Status: Draft</span>
          <span>Version: 1.0.0</span>
          <span>Date: 2026-05-16</span>
        </div>
      </header>

      <hr className="border-neutral-200/60 dark:border-neutral-700/60" />

      <Section title="Abstract">
        <p>
          This document specifies the <Code>dev.pedigree/ai-authorship/v1</Code> predicate type, an
          extension of the in-toto Attestation Framework designed to record the provenance of
          AI-authored source code. Every commit produced by an AI agent carries an attestation
          containing this predicate. The attestation binds the commit SHA to a structured record of
          who wrote the code, which model generated it, what instructions governed the agent, and
          whether a human approved the result.
        </p>
      </Section>

      <Section title="Predicate Fields">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200/60 text-left dark:border-neutral-700/60">
                <Th>Field</Th>
                <Th>Type</Th>
                <Th>Description</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-700/60">
              <Tr field="schemaVersion" type="string" desc='Always "1.0.0"' />
              <Tr
                field="authorship.kind"
                type="enum"
                desc='"human" | "ai-assisted" | "ai-autonomous"'
              />
              <Tr
                field="authorship.humanShare"
                type="number|null"
                desc="Fraction of human contribution [0.0, 1.0]"
              />
              <Tr
                field="authorship.humanApprover"
                type="object|null"
                desc="OIDC identity of the human who approved"
              />
              <Tr field="agent.tool" type="string" desc='AI tool name (e.g. "ibm-bob", "cursor")' />
              <Tr
                field="agent.model"
                type="string"
                desc='Model identifier (e.g. "granite-3.3-8b-instruct")'
              />
              <Tr
                field="agent.modelProvider"
                type="string"
                desc='Provider hosting the model (e.g. "watsonx.ai")'
              />
              <Tr
                field="execution.modeSlug"
                type="string"
                desc="The Bob Mode slug active during generation"
              />
              <Tr
                field="execution.skillHashes"
                type="array"
                desc="SHA-256 hashes of Skill content files"
              />
              <Tr
                field="execution.agentsMdHash"
                type="string"
                desc="SHA-256 hash of AGENTS.md at commit time"
              />
              <Tr
                field="execution.promptHash"
                type="string"
                desc="SHA-256 hash of the prompt/instruction"
              />
              <Tr
                field="scope.filesTouched"
                type="string[]"
                desc="Relative paths of files modified"
              />
              <Tr field="scope.riskClass" type="enum" desc='"low" | "medium" | "high"' />
              <Tr
                field="policy.satisfied"
                type="boolean"
                desc="Whether the AGENTS.md policy is satisfied"
              />
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Authorship Kinds">
        <ul className="space-y-3">
          <Li>
            <Code>human</Code> -- The commit was written entirely by a human. The <Code>agent</Code>{' '}
            and <Code>execution</Code> sections may be absent.
          </Li>
          <Li>
            <Code>ai-assisted</Code> -- A human and AI agent collaborated. <Code>humanShare</Code>{' '}
            records the estimated human contribution. <Code>humanApprover</Code> identifies who
            reviewed the AI output.
          </Li>
          <Li>
            <Code>ai-autonomous</Code> -- The AI agent generated the commit independently.{' '}
            <Code>humanShare</Code> is null. The agent may still require policy approval.
          </Li>
        </ul>
      </Section>

      <Section title="Validation Rules">
        <ul className="space-y-2">
          <Li>
            <Code>authorship.kind</Code> MUST be one of the three defined values.
          </Li>
          <Li>
            All SHA fields MUST be lowercase hex, prefixed with <Code>sha256:</Code> except{' '}
            <Code>digest.sha1</Code>.
          </Li>
          <Li>
            <Code>scope.riskClass</Code> MUST be one of <Code>low</Code>, <Code>medium</Code>, or{' '}
            <Code>high</Code>.
          </Li>
          <Li>
            <Code>policy.satisfied === false</Code> MUST cause CI to fail.
          </Li>
          <Li>
            When <Code>kind === &quot;ai-assisted&quot;</Code>, <Code>humanShare</Code> MUST be in
            [0.0, 1.0].
          </Li>
        </ul>
      </Section>

      <Section title="Security Considerations">
        <ul className="space-y-2">
          <Li>Predicates MUST be signed via DSSE. Unsigned predicates carry no trust.</Li>
          <Li>
            The <Code>skillHashes</Code> array provides tamper evidence for workflow definitions. A
            changed Skill produces a distinguishable attestation.
          </Li>
          <Li>
            The <Code>agentsMdHash</Code> field ensures the policy document has not been modified
            between attestation creation and verification.
          </Li>
        </ul>
      </Section>

      <div className="flex justify-center pt-4">
        <Link
          href="https://github.com/om13rajpal/pedigree/blob/main/docs/predicate-spec.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent transition-colors hover:underline dark:text-accent-dark"
        >
          View full spec on GitHub
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{title}</h2>
      <div className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {children}
      </div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-2xs text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
      {children}
    </code>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
      {children}
    </th>
  )
}

function Tr({ field, type, desc }: { field: string; type: string; desc: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-2xs text-accent dark:text-accent-dark">{field}</td>
      <td className="px-3 py-2 font-mono text-2xs text-neutral-500 dark:text-neutral-400">
        {type}
      </td>
      <td className="px-3 py-2 text-2xs text-neutral-600 dark:text-neutral-400">{desc}</td>
    </tr>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent dark:bg-accent-dark" />
      <span>{children}</span>
    </li>
  )
}
