import Arcade from '@arcadeai/arcadejs'
import { env } from '@/lib/env'

let client: Arcade | undefined

export function getArcadeClient(): Arcade {
  if (!client) {
    client = new Arcade({
      apiKey: env.ARCADE_API_KEY,
      ...(env.ARCADE_BASE_URL ? { baseURL: env.ARCADE_BASE_URL } : {}),
    })
  }
  return client
}
