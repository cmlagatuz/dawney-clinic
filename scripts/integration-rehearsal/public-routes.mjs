// Real Chromium over the BUILT combined bundle (inert publishable key, no login, no writes, no clinical backend).
// Public routes must render and fit 360/768/1440 without throwing; protected routes must still redirect to sign-in.
import { acceptedOrigin, withChromium } from '../browser/cdp.mjs'
const base = acceptedOrigin(process.argv[2], { local: true })
const widths = [360, 768, 1440]
await withChromium(async browser => {
  for (const w of widths) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 600 })
    for (const [route, probe] of [
      ['/', "document.querySelector('h1')?.textContent.includes('General Trias')"],
      ['/services', "document.querySelector('h1') !== null"],
      ['/book', "document.querySelector('h1') !== null"],
      ['/auth/signin', "document.querySelector('#auth-title')?.textContent === 'Welcome back'"],
      ['/definitely-missing', "document.body.textContent.includes('find that page')"],
    ]) {
      await browser.goto(base + route)
      await browser.until(probe)
      if (!(await browser.value('document.documentElement.scrollWidth <= window.innerWidth + 2'))) throw Error(`${route} overflows at ${w}px`)
    }
    console.log(`PASS: public routes render without overflow at ${w}px`)
  }
  for (const route of ['/app/pets', '/app/appointments']) {
    await browser.goto(base + route)
    await browser.until("location.pathname === '/auth/signin'")
  }
  console.log('PASS: /app/pets and /app/appointments are guarded anonymously (flag OFF default)')
})
