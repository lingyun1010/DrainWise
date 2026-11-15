import { chromium } from "/Users/lingyunzhao/Desktop/DrainWise/design/demo-video/node_modules/playwright/index.mjs";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await p.goto("file:///Users/lingyunzhao/Desktop/DrainWise/design/share/share.html");
await p.waitForTimeout(500);
await p.screenshot({ path: "/Users/lingyunzhao/Desktop/DrainWise/design/share/drainwise-share.png" });
await b.close();
