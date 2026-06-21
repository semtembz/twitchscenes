/* ============================================================
   Sakura Static — headless PNG exporter
   Loads each generator, calls window.__exportAssets() (toDataURL),
   writes named PNGs into the product's category folders.
   Usage: node export-png.js [--src=DIR] [--out=DIR] [--handle=@x]
   ============================================================ */
const fs = require("fs"), path = require("path");
const puppeteer = require("puppeteer");

const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.split("=").slice(1).join("=") : d; };
const SRC = path.resolve(opt("src", path.resolve(__dirname, "..", "sakura-static-source")));
const OUT = path.resolve(opt("out", path.resolve(__dirname, "..", "sakura-static-pack")));
const HANDLE = opt("handle", "@yourhandle");
const hq = "handle=" + encodeURIComponent(HANDLE);
const fileUrl = (rel) => "file://" + path.resolve(SRC, rel).replace(/\\/g, "/");

const nice = (id) => id.split(/[-_]/).map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");

const JOBS = [
  { url: "panels.html", dir: "Panels" },
  { url: "icons.html", dir: "Icons" },
  { url: `offline.html?${hq}`, dir: "Screens", rename: { offline: "Offline" } },
  { url: `banner.html?${hq}`, dir: "Social", rename: { "profile-banner": "Profile Banner" } },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--force-color-profile=srgb"] });
  for (const job of JOBS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(fileUrl(job.url), { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForFunction('typeof window.__exportAssets === "function"', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600)); // let async draw() settle
    const assets = await page.evaluate(() => window.__exportAssets());
    const outDir = path.join(OUT, job.dir);
    fs.mkdirSync(outDir, { recursive: true });
    for (const a of assets) {
      const name = (job.rename && job.rename[a.name]) || nice(a.name);
      fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(a.dataURL.split(",")[1], "base64"));
    }
    console.log(`✓ ${job.dir}/  (${assets.length} png)`);
    await page.close();
  }
  await browser.close();
  console.log("done.");
})().catch((e) => { console.error(e); process.exit(1); });
