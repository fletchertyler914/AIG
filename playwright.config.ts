import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

const PORT = Number(process.env['PORT'] ?? 3000)
const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${PORT}`
const isCI = process.env['CI'] === 'true'
const useExternalServer = !!process.env['PLAYWRIGHT_BASE_URL']

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
}

if (isCI) {
  config.workers = 1
}

const useProdBuild = process.env['PLAYWRIGHT_USE_PROD_BUILD'] === '1'

if (!useExternalServer) {
  config.webServer = {
    command: useProdBuild ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: useProdBuild ? 240_000 : 120_000,
    env: {
      NODE_ENV: useProdBuild ? 'production' : 'test',
      E2E_MOCK_ARCADE: '1',
      // Plan-agent route in prod build still requires this; mocked Arcade
      // short-circuits the actual tool execution, but the route imports
      // anthropic provider config which needs *some* key to load.
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ?? 'test-key',
      ARCADE_API_KEY: process.env['ARCADE_API_KEY'] ?? 'test-key',
    },
  }
}

export default defineConfig(config)
