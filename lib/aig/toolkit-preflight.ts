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

export function missingRequestedToolkits(input: {
  requested: ReadonlyArray<string>
  enabled: ReadonlyArray<string>
}): string[] {
  const enabledSet = new Set(input.enabled)
  return input.requested.filter((toolkit) => !enabledSet.has(toolkit))
}

export function formatMissingToolkitsError(input: {
  missing: ReadonlyArray<string>
  enabled: ReadonlyArray<string>
}): string {
  return (
    `Connect ${input.missing.join(' and ')} before creating this intent. ` +
    `Available toolkits in this workspace: ${
      input.enabled.length > 0 ? input.enabled.join(', ') : 'none'
    }.`
  )
}
