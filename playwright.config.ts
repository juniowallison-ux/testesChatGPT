import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    },
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'npm run dev:demo',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
  reporter: 'list',
});
