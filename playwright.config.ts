import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  // The 3D scene is heavy on a CPU-only runner, so allow more time than the default 5 s.
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  forbidOnly: CI,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    // Tests run against the real build, as it ships to GitHub Pages.
    baseURL: 'http://localhost:4173/Portfolio/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Software WebGL, so the island also draws on machines and CI runners without a GPU.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/Portfolio/',
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
})
