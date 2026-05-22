/**
 * Probe the Arcade API key — lists the available toolkits and the count of
 * tools per toolkit. Run with: `pnpm probe:arcade`.
 *
 * Useful as the first end-to-end check that your API key works and that the
 * toolkits required by the demo scenario (Gmail, Calendar, Slack) are
 * reachable for the configured user.
 */

import Arcade from '@arcadeai/arcadejs'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger.child({ script: 'probe-arcade' })

const TARGET_TOOLKITS = ['Gmail', 'GoogleCalendar', 'Slack', 'Github'] as const

async function main() {
  log.info({ baseUrl: env.ARCADE_BASE_URL ?? 'default' }, 'probing arcade')

  const arcade = new Arcade({
    apiKey: env.ARCADE_API_KEY,
    ...(env.ARCADE_BASE_URL && { baseURL: env.ARCADE_BASE_URL }),
  })

  for (const toolkit of TARGET_TOOLKITS) {
    try {
      const page = await arcade.tools.list({ toolkit, limit: 100 })
      log.info(
        {
          toolkit,
          count: page.items.length,
          sample: page.items.slice(0, 3).map((t) => t.fully_qualified_name ?? t.name),
        },
        'toolkit reachable',
      )
    } catch (err) {
      log.error({ toolkit, err }, 'toolkit probe failed')
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log.fatal({ err }, 'probe failed')
    process.exit(1)
  })
