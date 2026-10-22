import { chromium } from "playwright";

const FRONT = "http://127.0.0.1:7782";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(FRONT, { waitUntil: "load", timeout: 120000 });

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
    const cards = canvas?.querySelectorAll('[class*="rounded-2xl"][class*="border"]') ?? [];
    const lines = canvas?.querySelectorAll("svg line") ?? [];
    const paths = canvas?.querySelectorAll("svg path") ?? [];
    const yValues = [...cards].map((c) => parseInt((c).style.top || "0", 10));
    return {
      cardCount: cards.length,
      lineCount: lines.length,
      pathCount: paths.length,
      maxY: Math.max(0, ...yValues),
      minY: Math.min(...yValues.filter((y) => y > 0)),
    };
  });

  await page.screenshot({ path: "verify-tree.png" });
  console.log(JSON.stringify({ stats, errors: errors.slice(0, 5) }, null, 2));

  await browser.close();
  const ok =
    stats.cardCount >= 6 &&
    stats.lineCount + stats.pathCount >= 2 &&
    stats.maxY < 5000 &&
    errors.length === 0;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
