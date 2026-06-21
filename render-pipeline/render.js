/* ============================================================
   Sakura Static — headless .webm renderer
   Drives each animation through its deterministic draw hook and
   captures frames race-free (toDataURL inside one sync evaluate),
   then ffmpeg assembles transparent VP9 .webm.
   Usage:  node render.js [name|all]
   ============================================================ */
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const puppeteer = require("puppeteer");

const PACK = path.resolve(__dirname, "..", "sakura-static-pack");

// Deliverables that expose a per-frame canvas hook (race-free path).
// `render` returns a PNG dataURL for normalized time t in [0,1].
const JOBS = [
  {
    name: "transition", url: "transition.html?loop=0", out: "transition.webm",
    w: 1920, h: 1080, fps: 30, durMs: 1300,
    render: `(t) => { window.__txDraw(t); return document.querySelector('canvas').toDataURL('image/png'); }`,
    hook: "__txDraw",
  },
];

function fileUrl(rel) { return "file://" + path.resolve(PACK, rel).replace(/\\/g, "/"); }

async function renderJob(browser, job) {
  const page = await browser.newPage();
  await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: 1 });
  await page.goto(fileUrl(job.url), { waitUntil: "load" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (job.hook) {
    await page.waitForFunction(`typeof window.${job.hook} === "function"`, { timeout: 8000 });
  }
  const frames = Math.max(2, Math.round((job.durMs / 1000) * job.fps));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "saku-frames-"));
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1);
    const dataUrl = await page.evaluate((src, tt) => {
      // eslint-disable-next-line no-eval
      const f = eval("(" + src + ")");
      return f(tt);
    }, job.render, t);
    const b64 = String(dataUrl).split(",")[1];
    fs.writeFileSync(path.join(tmp, "f" + String(i).padStart(5, "0") + ".png"), Buffer.from(b64, "base64"));
  }
  await page.close();

  const outFile = path.join(PACK, job.out);
  // transparent VP9 webm from the PNG sequence
  try {
    execFileSync(ffmpeg, [
      "-y", "-framerate", String(job.fps), "-i", path.join(tmp, "f%05d.png"),
      "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "3M", "-auto-alt-ref", "0",
      outFile,
    ], { stdio: ["ignore", "ignore", "inherit"] });
  } catch (e) {
    // fallback to VP8 (also supports alpha) if vp9 unavailable
    execFileSync(ffmpeg, [
      "-y", "-framerate", String(job.fps), "-i", path.join(tmp, "f%05d.png"),
      "-c:v", "libvpx", "-pix_fmt", "yuva420p", "-b:v", "3M", "-auto-alt-ref", "0",
      outFile,
    ], { stdio: ["ignore", "ignore", "inherit"] });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const kb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`✓ ${job.out}  (${frames} frames @ ${job.fps}fps, ${kb} KB)`);
}

(async () => {
  const which = process.argv[2] || "all";
  const jobs = which === "all" ? JOBS : JOBS.filter((j) => j.name === which);
  if (!jobs.length) { console.error("no job named", which); process.exit(1); }
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--force-color-profile=srgb", "--disable-lcd-text"],
  });
  for (const job of jobs) await renderJob(browser, job);
  await browser.close();
  console.log("done.");
})().catch((e) => { console.error(e); process.exit(1); });
