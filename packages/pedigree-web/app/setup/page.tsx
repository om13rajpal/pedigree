import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Terminal,
  Download,
  Settings,
  CheckCircle2,
  ArrowRight,
  Server,
  FileKey2,
  Shield,
} from 'lucide-react'
import { CopyCommand } from '@/components/setup/CopyCommand'

export const metadata: Metadata = {
  title: 'Setup Pedigree -- Install the MCP Server',
  description:
    'Step-by-step guide to install and configure the Pedigree MCP server for cryptographic code provenance.',
}

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-12">
      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 dark:bg-accent-dark/10">
          <Terminal className="h-7 w-7 text-accent dark:text-accent-dark" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-3xl">
          Get Started with Pedigree
        </h1>
        <p className="mx-auto max-w-lg text-sm text-neutral-600 dark:text-neutral-400">
          Install the MCP server, configure your agent, and start signing commits in under 5
          minutes.
        </p>
      </header>

      {/* Prerequisites */}
      <section className="space-y-4">
        <SectionHeader icon={Shield} title="Prerequisites" />
        <div className="grid gap-3 sm:grid-cols-3">
          <PrereqCard name="Python 3.11+" description="Required for pedigree-mcp" />
          <PrereqCard name="uv" description="Fast Python package manager" />
          <PrereqCard name="Git 2.39+" description="For attestation refs support" />
        </div>
        <CopyCommand
          label="Install uv (if needed)"
          command="curl -LsSf https://astral.sh/uv/install.sh | sh"
        />
      </section>

      {/* Step 1: Clone */}
      <section className="space-y-4">
        <SectionHeader icon={Download} number={1} title="Clone the repository" />
        <CopyCommand command="git clone https://github.com/om13rajpal/pedigree.git && cd pedigree" />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          The monorepo contains four packages:{' '}
          <code className="text-accent dark:text-accent-dark">pedigree-types</code>,{' '}
          <code className="text-accent dark:text-accent-dark">pedigree-mcp</code>,{' '}
          <code className="text-accent dark:text-accent-dark">pedigree-web</code>, and{' '}
          <code className="text-accent dark:text-accent-dark">pedigree-action</code>.
        </p>
      </section>

      {/* Step 2: Install MCP server */}
      <section className="space-y-4">
        <SectionHeader icon={Server} number={2} title="Install the MCP server" />
        <CopyCommand
          label="Install Python dependencies"
          command="cd packages/pedigree-mcp && uv sync"
        />
        <CopyCommand label="Verify installation" command="uv run python -m pedigree_mcp health" />
        <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <p className="text-xs text-emerald-800 dark:text-emerald-400">
            Expected output:{' '}
            <code className="font-mono">{`{"status": "ok", "version": "0.1.0"}`}</code>
          </p>
        </div>
      </section>

      {/* Step 3: Configure agent */}
      <section className="space-y-4">
        <SectionHeader icon={Settings} number={3} title="Configure your AI agent" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Add pedigree-mcp to your agent&apos;s MCP configuration. Works with Bob, Cursor, Windsurf,
          or any MCP-compatible client.
        </p>

        <div className="space-y-3">
          <AgentConfig
            agent="Bob (IBM)"
            config={`# .bob/mcp.json
{
  "mcpServers": {
    "pedigree": {
      "command": "uv",
      "args": ["run", "--directory", "packages/pedigree-mcp",
               "python", "-m", "pedigree_mcp"],
      "transport": "stdio"
    }
  }
}`}
          />
          <AgentConfig
            agent="Cursor / Windsurf"
            config={`// .cursor/mcp.json or .windsurf/mcp.json
{
  "mcpServers": {
    "pedigree": {
      "command": "uv",
      "args": ["run", "--directory", "packages/pedigree-mcp",
               "python", "-m", "pedigree_mcp"],
      "transport": "stdio"
    }
  }
}`}
          />
        </div>
      </section>

      {/* Step 4: Generate keypair */}
      <section className="space-y-4">
        <SectionHeader icon={FileKey2} number={4} title="Generate signing keys" />
        <CopyCommand
          label="Generate ed25519 keypair (local signing)"
          command="uv run python -m pedigree_mcp keygen"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          For production, use Sigstore keyless signing via OIDC instead. The ed25519 fallback is for
          local development and air-gapped environments.
        </p>
      </section>

      {/* Step 5: Verify */}
      <section className="space-y-4">
        <SectionHeader icon={CheckCircle2} number={5} title="Verify everything works" />
        <CopyCommand
          label="Run the full test suite"
          command="pnpm install && pnpm test && pnpm verify-schemas"
        />
        <CopyCommand
          label="Test a manual attestation"
          command={`echo 'console.log("hello")' > test.js && git add test.js && git commit -m "test: verify pedigree" && uv run python -m pedigree_mcp attest $(git rev-parse HEAD)`}
        />
      </section>

      {/* What's next */}
      <section className="rounded-xl border border-neutral-200/60 bg-gradient-to-b from-white to-neutral-50/50 p-8 dark:border-neutral-700/60 dark:from-neutral-900 dark:to-neutral-900/50">
        <h2 className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
          What&apos;s next?
        </h2>
        <ul className="mt-4 space-y-3">
          <NextStep href="/how-it-works" label="Learn how the pipeline works" />
          <NextStep href="/demo" label="Try the interactive demo" />
          <NextStep href="/docs/predicate-spec" label="Read the predicate specification" />
        </ul>
      </section>

      <footer className="flex justify-center border-t border-neutral-200/60 pt-6 dark:border-neutral-700/60">
        <Link
          href="/"
          className="text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        >
          Back to home
        </Link>
      </footer>
    </main>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  number,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  number?: number
}) {
  return (
    <div className="flex items-center gap-3">
      {number && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white dark:bg-accent-dark">
          {number}
        </span>
      )}
      <Icon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
      <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">{title}</h2>
    </div>
  )
}

function PrereqCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-lg border border-neutral-200/60 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-900">
      <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{name}</p>
      <p className="mt-1 text-2xs text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  )
}

function AgentConfig({ agent, config }: { agent: string; config: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
      <div className="border-b border-neutral-200/60 bg-neutral-50 px-4 py-2 dark:border-neutral-700/60 dark:bg-neutral-800">
        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{agent}</p>
      </div>
      <pre className="overflow-x-auto bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-emerald-400">
        <code>{config}</code>
      </pre>
    </div>
  )
}

function NextStep({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-accent dark:text-neutral-400 dark:hover:text-accent-dark"
      >
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        {label}
      </Link>
    </li>
  )
}
