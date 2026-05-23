/**
 * Lightweight prompt → toolkit inference used to scope the tool schema sent to
 * the plan agent. Inferred toolkits are auto-enabled at intent-creation time;
 * AUTH REQUIRED is surfaced per tool-call node so OAuth happens at approve
 * time, not at planning time.
 */
const PROMPT_TOOLKIT_HINTS: ReadonlyArray<{
  toolkit: string
  pattern: RegExp
}> = [
  { toolkit: 'Gmail', pattern: /\b(e-?mail|mail|message|inbox|gmail)\b/i },
  { toolkit: 'GoogleCalendar', pattern: /\b(calendar|reminder|meeting|schedule|invite)\b/i },
  { toolkit: 'Github', pattern: /\b(github|pull request|pr|issue|repo|branch)\b/i },
  { toolkit: 'GoogleDocs', pattern: /\b(doc|docs|document|writeup|handoff)\b/i },
  { toolkit: 'GoogleSheets', pattern: /\b(sheet|sheets|spreadsheet|cell|row|column)\b/i },
  { toolkit: 'GoogleDrive', pattern: /\b(drive|file|folder|upload|share)\b/i },
]

export function inferRequestedToolkits(prompt: string): string[] {
  return PROMPT_TOOLKIT_HINTS.filter((hint) => hint.pattern.test(prompt)).map(
    (hint) => hint.toolkit,
  )
}

/** Workspace-wide fallback when neither the prompt nor the operator specifies
 *  toolkits and no rows have been enabled yet. Mirrors the demo seeded loop. */
export const DEFAULT_PLAN_TOOLKITS: ReadonlyArray<string> = ['Gmail', 'GoogleCalendar']

export interface PlanSelectToolkitsDeps {
  /** Toolkits currently enabled for the workspace (any scope). */
  listEnabled: () => Promise<ReadonlyArray<string>>
  /**
   * Make sure the given toolkit can participate in planning. Implementations
   * may insert a disconnected placeholder row, flip an existing row's
   * `enabled` flag to true, or no-op when the toolkit is already enabled.
   * They must NEVER touch `authStatus` — OAuth happens at approve time.
   *
   * Return `{ resolved: false }` only when the toolkit cannot be looked up in
   * the Arcade catalog at all; that's the one situation where planning is
   * refused.
   */
  ensureToolkit: (toolkitName: string) => Promise<{ resolved: boolean }>
}

/**
 * Decide which toolkits to expose to the plan agent for a given prompt.
 *
 * Pure orchestration — all I/O is injected via `deps`. The contract for the
 * caller is:
 *
 * 1. Explicit toolkits take precedence over inferred ones.
 * 2. Anything requested that isn't already enabled is auto-enabled.
 * 3. Missing OAuth is never a planning failure — that's the AUTH REQUIRED
 *    badge's job after the intent is formed.
 * 4. The only planning-time failure is an unknown toolkit (not in Arcade's
 *    catalog).
 */
export async function planSelectToolkits(input: {
  prompt: string
  explicit?: ReadonlyArray<string>
  deps: PlanSelectToolkitsDeps
}): Promise<string[]> {
  const requested =
    input.explicit && input.explicit.length > 0
      ? Array.from(input.explicit)
      : inferRequestedToolkits(input.prompt)

  if (requested.length === 0) {
    const enabled = await input.deps.listEnabled()
    if (enabled.length > 0) return Array.from(enabled)
    return Array.from(DEFAULT_PLAN_TOOLKITS)
  }

  const enabled = await input.deps.listEnabled()
  const enabledSet = new Set(enabled)
  const toEnable = requested.filter((name) => !enabledSet.has(name))

  if (toEnable.length === 0) return requested

  const unresolved: string[] = []
  for (const name of toEnable) {
    const result = await input.deps.ensureToolkit(name)
    if (!result.resolved) unresolved.push(name)
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Toolkit not found in Arcade catalog: ${unresolved.join(', ')}. ` +
        'Pick a supported toolkit or rephrase the prompt.',
    )
  }

  return requested
}
