'use client'

import { motion } from 'framer-motion'
import { User, Users, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Scenario = 'human' | 'ai-assisted' | 'ai-autonomous'

interface ScenarioOption {
  id: Scenario
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  example: string
}

const SCENARIOS: readonly ScenarioOption[] = [
  {
    id: 'human',
    label: 'Human Only',
    description: 'Developer writes all code manually. No AI involvement.',
    icon: User,
    example: 'You wrote every line yourself.',
  },
  {
    id: 'ai-assisted',
    label: 'AI-Assisted',
    description: 'Human and AI collaborate. Human reviews and edits AI output.',
    icon: Users,
    example: 'You prompted an AI, then reviewed and modified the result.',
  },
  {
    id: 'ai-autonomous',
    label: 'AI Autonomous',
    description: 'AI generates code independently. Human only approves.',
    icon: Bot,
    example: 'AI agent wrote the code. You approved the commit.',
  },
] as const

interface ScenarioSelectorProps {
  selected: Scenario | null
  onSelect: (scenario: Scenario) => void
}

export function ScenarioSelector({ selected, onSelect }: ScenarioSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SCENARIOS.map((scenario) => {
        const isActive = selected === scenario.id
        return (
          <motion.button
            key={scenario.id}
            type="button"
            onClick={() => onSelect(scenario.id)}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'relative flex flex-col items-center gap-3 rounded-lg border p-5 text-center transition-all',
              isActive
                ? 'border-accent bg-accent/5 shadow-md dark:border-accent-dark dark:bg-accent-dark/10'
                : 'border-neutral-200/60 bg-white hover:border-neutral-300 hover:shadow-subtle dark:border-neutral-700/60 dark:bg-neutral-900 dark:hover:border-neutral-600',
            )}
          >
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-accent/10 dark:bg-accent-dark/20'
                  : 'bg-neutral-100 dark:bg-neutral-800',
              )}
            >
              <scenario.icon
                className={cn(
                  'h-6 w-6 transition-colors',
                  isActive
                    ? 'text-accent dark:text-accent-dark'
                    : 'text-neutral-500 dark:text-neutral-400',
                )}
              />
            </div>
            <div className="space-y-1">
              <p
                className={cn(
                  'text-sm font-semibold transition-colors',
                  isActive
                    ? 'text-accent dark:text-accent-dark'
                    : 'text-neutral-950 dark:text-neutral-50',
                )}
              >
                {scenario.label}
              </p>
              <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                {scenario.description}
              </p>
            </div>
            {isActive && (
              <motion.div
                layoutId="scenario-indicator"
                className="absolute -top-px left-4 right-4 h-0.5 rounded-full bg-accent dark:bg-accent-dark"
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
