import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

export const AVAILABLE_MODELS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'ibm-granite/granite-4.1-8b', label: 'Granite 4.1 8B', provider: 'IBM' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', provider: 'Meta' },
  { id: 'x-ai/grok-4.3', label: 'Grok 4.3', provider: 'xAI' },
] as const

const SYSTEM_PROMPT = `You are a code generator. Generate ONLY code, no explanations, no markdown fences, no comments explaining what the code does. Output raw TypeScript/JavaScript code only. Keep it concise, under 20 lines.`

interface GenerateBody {
  prompt: string
  model?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: GenerateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, model } = body
  if (!prompt || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })
  }

  const modelId = model ?? 'google/gemini-2.5-flash'
  const modelInfo = AVAILABLE_MODELS.find((m) => m.id === modelId)

  try {
    const result = await generateText({
      model: openrouter(modelId),
      system: SYSTEM_PROMPT,
      prompt: `Generate a small TypeScript code snippet for: ${prompt}`,
      maxOutputTokens: 400,
      temperature: 0.7,
    })

    const code = result.text
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim()

    const suggestedFileName =
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 30)
        .replace(/-+$/, '') + '.ts'

    return NextResponse.json({
      code,
      fileName: suggestedFileName,
      model: modelId,
      modelLabel: modelInfo?.label ?? modelId,
      provider: modelInfo?.provider ?? 'unknown',
      tokensUsed: result.usage?.totalTokens ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
