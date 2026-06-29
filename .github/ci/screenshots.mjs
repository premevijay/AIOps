// Headless dashboard screenshotter for CI.
//
// Drives the running dashboard (default http://localhost:8081, fully wired to
// the change/supervisor/results services via nginx) and captures each view as a
// PNG. The PNGs are uploaded as a CI artifact so a push can be "viewed" in
// GitHub without standing the stack up locally.
//
// The Monitoring view is intentionally skipped: it embeds Grafana, which the CI
// screenshot stack does not start.

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.env.DASH_URL || 'http://localhost:8081'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(OUT, { recursive: true })

// label === null means it's the default view (already shown on load).
const VIEWS = [
  { label: null, file: '01-overview' },
  { label: 'Topology', file: '02-topology' },
  { label: 'Inventory & Vault', file: '03-inventory' },
  { label: 'Backup', file: '04-backup' },
  { label: 'Compliance', file: '05-compliance' },
  { label: 'Health Checks', file: '06-health' },
  { label: 'AI Troubleshooting', file: '07-agent' },
  { label: 'Change Management', file: '08-change-management' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

let failures = 0
for (const v of VIEWS) {
  try {
    if (v.label) {
      await page.locator('.nav-h', { hasText: v.label }).first().click()
      await page.waitForTimeout(1800) // let live data fetch + render settle
    }
    await page.screenshot({ path: join(OUT, `${v.file}.png`), fullPage: true })
    console.log('captured', v.file)
  } catch (err) {
    failures++
    console.error('FAILED', v.file, '-', err.message)
  }
}

await browser.close()
console.log(`done: ${VIEWS.length - failures}/${VIEWS.length} views captured`)
// Don't fail the job on a single flaky view — the artifact upload still runs.
process.exit(0)
