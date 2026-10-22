import { chromium } from "playwright";

const FRONT = "http://localhost:7782";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(FRONT, { waitUntil: "networkidle", timeout: 60000 });

  for (const b of await page.locator("button").all()) {
    const t = await b.textContent();
    if (t?.includes("فارسی")) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(800);

  if (await page.locator('input[type="tel"]').count()) {
    await page.fill('input[type="tel"]', "09120000000");
    await page.fill('input[type="password"]', "najaf123");
    await page.click('button[type="submit"]');
  }

  await page.waitForTimeout(5000);

  const stats = await page.evaluate(() => {
    const canvas = document.querySelector("#genealogy-canvas");
    const cards = canvas?.querySelectorAll(".rounded-2xl.border") ?? [];
    const lines = canvas?.querySelectorAll("svg line") ?? [];
    const paths = canvas?.querySelectorAll("svg path") ?? [];
    return {
      cardCount: cards.length,
      lineCount: lines.length,
      pathCount: paths.length,
      sample: [...cards].slice(0, 3).map((c) => ({
        left: c.style.left,
        top: c.style.top,
      })),
    };
  });

  await page.screenshot({ path: "D:/Projects/Hadi/shajarname/scripts/verify-tree.png" });
  console.log(JSON.stringify(stats, null, 2));

  await browser.close();
  const ok = stats.cardCount >= 6 && stats.lineCount + stats.pathCount >= 2;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
