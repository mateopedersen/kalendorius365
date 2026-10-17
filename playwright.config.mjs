import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', timeout: 45000, expect: {timeout:15000},
  fullyParallel: true, workers: process.env.CI ? 3 : 2, retries: 0,
  reporter: [['list'],['json',{outputFile:'test-results/browser-results.json'}],['html',{open:'never'}]],
  use: {baseURL:process.env.K365_BASE_URL || 'http://127.0.0.1:8790',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer: process.env.K365_BASE_URL ? undefined : {command:'python3 -m http.server 8790 --bind 127.0.0.1 --directory public',url:'http://127.0.0.1:8790',reuseExistingServer:!process.env.CI},
  projects:[
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'firefox',use:{...devices['Desktop Firefox']}},
    {name:'webkit',use:{...devices['Desktop Safari']}},
    {name:'android-chromium',use:{...devices['Pixel 5']}},
    {name:'iphone-webkit',use:{...devices['iPhone 13']}},
  ],
});
