import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 600 } })

const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body {
    background: linear-gradient(135deg, #258fff, #8b5cf6, #ec4899);
    display: flex;
    gap: 40px;
    padding: 60px;
    align-items: center;
  }
  .box {
    width: 62px;
    height: 62px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.16);
    backdrop-filter: blur(25px);
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
  .label {
    position: absolute;
    bottom: -30px;
    color: white;
    font-family: sans-serif;
    font-size: 11px;
    white-space: nowrap;
  }
</style>
</head>
<body>

  <!-- Box 1: Current Raw SVG with filter -->
  <div class="box">
    <!-- delete -->
    <div style="position: absolute; top: -4px; left: -4px; width: 24px; height: 24px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <g filter="url(#f_raw_del)">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" fill="white" fill-opacity="0.1" style="mix-blend-mode:color-dodge"/>
        </g>
        <rect x="6.3335" y="11" width="11.3333" height="2.33333" rx="1.16667" fill="white"/>
        <defs>
          <filter id="f_raw_del" x="2.66667" y="2.66667" width="18.6667" height="18.6667" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="0.333333" dy="-0.333333"/>
            <feGaussianBlur stdDeviation="0.666667"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0"/>
            <feBlend mode="color-burn" in2="shape" result="effect1"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="-0.333333" dy="-0.333333"/>
            <feGaussianBlur stdDeviation="0.166667"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0"/>
            <feBlend mode="plus-lighter" in2="effect1" result="effect2"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="-0.333333" dy="0.333333"/>
            <feGaussianBlur stdDeviation="0.5"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0"/>
            <feBlend mode="color-burn" in2="effect2" result="effect3"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="0.333333" dy="0.333333"/>
            <feGaussianBlur stdDeviation="0.333333"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0"/>
            <feBlend mode="plus-lighter" in2="effect3" result="effect4"/>
          </filter>
        </defs>
      </svg>
    </div>
    <!-- crescent -->
    <div style="position: absolute; bottom: -4px; right: -4px; width: 24px; height: 25px;">
      <svg width="24" height="25" viewBox="0 0 24 25" fill="none">
        <g filter="url(#f_raw_cres)">
          <path d="M14.9434 4.60134C14.9434 2.06009 16.9708 0 19.4717 0C21.9726 0 24 2.06009 24 4.60134C24 15.5287 15.2822 24.3871 4.5283 24.3871C2.02739 24.3871 0 22.327 0 19.7858C0 17.2445 2.02739 15.1844 4.5283 15.1844C10.2804 15.1844 14.9434 10.4462 14.9434 4.60134Z" fill="#515151" fill-opacity="0.1"/>
        </g>
        <defs>
          <filter id="f_raw_cres" x="-0.333333" y="-0.333333" width="24.6667" height="25.0538" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="0.333333" dy="-0.333333"/>
            <feGaussianBlur stdDeviation="0.666667"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0"/>
            <feBlend mode="color-burn" in2="shape" result="effect1"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="-0.333333" dy="-0.333333"/>
            <feGaussianBlur stdDeviation="0.166667"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0"/>
            <feBlend mode="plus-lighter" in2="effect1" result="effect2"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="-0.333333" dy="0.333333"/>
            <feGaussianBlur stdDeviation="0.5"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.45 0"/>
            <feBlend mode="color-burn" in2="effect2" result="effect3"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="0.333333" dy="0.333333"/>
            <feGaussianBlur stdDeviation="0.333333"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0"/>
            <feBlend mode="plus-lighter" in2="effect3" result="effect4"/>
          </filter>
        </defs>
      </svg>
    </div>
    <div class="label">当前滤镜 (黑灰发暗)</div>
  </div>

  <!-- Box 2: Clean Liquid Glass with White Glow & Multi-layer Highlighting -->
  <div class="box">
    <!-- delete glass -->
    <div style="position: absolute; top: -4px; left: -4px; width: 24px; height: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="rgba(255, 255, 255, 0.22)" stroke="url(#del_grad)" stroke-width="1"/>
        <rect x="6.3335" y="11" width="11.3333" height="2.33333" rx="1.16667" fill="white"/>
        <defs>
          <linearGradient id="del_grad" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
            <stop stop-color="white" stop-opacity="0.9"/>
            <stop offset="0.5" stop-color="white" stop-opacity="0.2"/>
            <stop offset="1" stop-color="white" stop-opacity="0.6"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <!-- crescent glass -->
    <div style="position: absolute; bottom: -4px; right: -4px; width: 24px; height: 25px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25));">
      <svg width="24" height="25" viewBox="0 0 24 25" fill="none">
        <path d="M14.9434 4.60134C14.9434 2.06009 16.9708 0 19.4717 0C21.9726 0 24 2.06009 24 4.60134C24 15.5287 15.2822 24.3871 4.5283 24.3871C2.02739 24.3871 0 22.327 0 19.7858C0 17.2445 2.02739 15.1844 4.5283 15.1844C10.2804 15.1844 14.9434 10.4462 14.9434 4.60134Z"
          fill="rgba(255, 255, 255, 0.18)"
          stroke="url(#cres_grad)"
          stroke-width="1.2"
        />
        <defs>
          <linearGradient id="cres_grad" x1="0" y1="0" x2="24" y2="25" gradientUnits="userSpaceOnUse">
            <stop stop-color="white" stop-opacity="0.95"/>
            <stop offset="0.5" stop-color="white" stop-opacity="0.3"/>
            <stop offset="1" stop-color="white" stop-opacity="0.8"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="label">纯白液态玻璃质感</div>
  </div>

  <!-- Box 3: What if with Red Delete Badge? (Like iOS/Android native) -->
  <div class="box">
    <!-- delete red -->
    <div style="position: absolute; top: -4px; left: -4px; width: 24px; height: 24px; filter: drop-shadow(0 2px 4px rgba(239, 68, 68, 0.35));">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#ef4444" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
        <rect x="6.3335" y="11" width="11.3333" height="2.33333" rx="1.16667" fill="white"/>
      </svg>
    </div>
    <!-- crescent white -->
    <div style="position: absolute; bottom: -4px; right: -4px; width: 24px; height: 25px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.25));">
      <svg width="24" height="25" viewBox="0 0 24 25" fill="none">
        <path d="M14.9434 4.60134C14.9434 2.06009 16.9708 0 19.4717 0C21.9726 0 24 2.06009 24 4.60134C24 15.5287 15.2822 24.3871 4.5283 24.3871C2.02739 24.3871 0 22.327 0 19.7858C0 17.2445 2.02739 15.1844 4.5283 15.1844C10.2804 15.1844 14.9434 10.4462 14.9434 4.60134Z"
          fill="rgba(255, 255, 255, 0.25)"
          stroke="rgba(255, 255, 255, 0.9)"
          stroke-width="1.2"
        />
      </svg>
    </div>
    <div class="label">红白对比风格</div>
  </div>

</body>
</html>
`

await page.setContent(html)
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/compare-filter-fix.png' })
await browser.close()
console.log('Comparison screenshot saved!')
