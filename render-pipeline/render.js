/* ============================================================
   Sakura Static — headless .webm renderer (parameterized)
   Two deterministic capture modes:
     • "hook"       : draw hook + canvas.toDataURL in one sync evaluate (transition).
     • "screenshot" : CDP virtual time drives setTimeout/CSS/rAF; transparent
                      page.screenshot per frame (alerts, overlays, screens).
   Output: transparent VP9 / yuva420p .webm via ffmpeg.

   Usage:
     node render.js [name|all|alerts|overlays|screens] [--handle=@x] [--out=DIR]
   The streamer handle is baked into the handle-bearing scenes; alerts render with
   NO baked viewer name (the alert platform overlays the live name).
   ============================================================ */
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const puppeteer = require("puppeteer");

const PACK = path.resolve(__dirname, "..", "sakura-static-pack");
const fileUrl = (rel) => "file://" + path.resolve(PACK, rel).replace(/\\/g, "/");

const argv = process.argv.slice(2);
const which = argv.find((a) => !a.startsWith("--")) || "all";
const opt = (k, d) => { const a = argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.split("=").slice(1).join("=") : d; };
const HANDLE = opt("handle", "@yourhandle");
const OUTDIR = path.resolve(opt("out", PACK));
const hq = "handle=" + encodeURIComponent(HANDLE);

const ALERT_TYPES = ["follower","subscriber","member","cheer","donation","host","raid","like","share","star","superchat","supporter"];

const JOBS = [
  { name: "transition", mode: "hook", url: "transition.html?loop=0", out: "transition.webm",
    w: 1920, h: 1080, fps: 30, durMs: 1300, hook: "__txDraw",
    render: `(t)=>{window.__txDraw(t);return document.querySelector('canvas').toDataURL('image/png');}` },

  // alerts: NO baked name (noname=1); amount kept so cheer/donation/etc. show a sample value
  ...ALERT_TYPES.map((t) => ({
    name: "alert-" + t, mode: "manual", group: "alerts",
    url: `alerts/${t}.html?render=1&noname=1&amount=10`, out: `alerts/${t}.webm`,
    w: 1920, h: 1080, fps: 30, durMs: 5340, transparent: true,
  })),

  // handle-bearing scenes (the streamer handle is baked in)
  { name: "overlay-slot", mode: "screenshot", group: "overlays", url: `overlay-slot.html?${hq}`,
    out: "overlay-slot.webm", w: 1920, h: 1080, fps: 30, startMs: 0, durMs: 6000, transparent: true },
  { name: "webcam", mode: "screenshot", group: "overlays", url: `webcam.html?${hq}`,
    out: "webcam.webm", w: 1920, h: 1080, fps: 30, startMs: 0, durMs: 6000, transparent: true },
  ...["starting-soon","brb","intermission","ending"].map((s) => ({
    name: s, mode: "screenshot", group: "screens", url: `${s}.html?${hq}`,
    out: `${s}.webm`, w: 1920, h: 1080, fps: 30, startMs: 0, durMs: 6000, transparent: false,
  })),
];

function encodeWebm(framesDir, fps, outFile) {
  const args = (codec) => ["-y", "-framerate", String(fps), "-i", path.join(framesDir, "f%05d.png"),
    "-c:v", codec, "-pix_fmt", "yuva420p", "-b:v", "3M", "-auto-alt-ref", "0", outFile];
  try { execFileSync(ffmpeg, args("libvpx-vp9"), { stdio: ["ignore", "ignore", "ignore"] }); }
  catch (e) { execFileSync(ffmpeg, args("libvpx"), { stdio: ["ignore", "ignore", "ignore"] }); }
}

async function renderHook(page, job, tmp) {
  await page.goto(fileUrl(job.url), { waitUntil: "load" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForFunction(`typeof window.${job.hook} === "function"`, { timeout: 8000 });
  const frames = Math.max(2, Math.round((job.durMs / 1000) * job.fps));
  for (let i = 0; i < frames; i++) {
    const dataUrl = await page.evaluate((src, tt) => eval("(" + src + ")")(tt), job.render, i / (frames - 1));
    fs.writeFileSync(path.join(tmp, "f" + String(i).padStart(5, "0") + ".png"),
      Buffer.from(String(dataUrl).split(",")[1], "base64"));
  }
  return frames;
}

async function renderScreenshot(page, job, tmp) {
  const client = await page.target().createCDPSession();
  await client.send("Page.enable");
  const advance = (ms) => new Promise((resolve) => {
    client.once("Emulation.virtualTimeBudgetExpired", resolve);
    client.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: ms, maxVirtualTimeTaskStarvationCount: 1000000 });
  });
  await client.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  await client.send("Page.navigate", { url: fileUrl(job.url) });
  const frameMs = 1000 / job.fps;
  const frames = Math.max(2, Math.round(job.durMs / frameMs));
  await advance(Math.max(job.startMs, 140));
  const clip = { x: 0, y: 0, width: job.w, height: job.h };
  for (let i = 0; i < frames; i++) {
    const png = await page.screenshot({ omitBackground: !!job.transparent, clip, type: "png" });
    fs.writeFileSync(path.join(tmp, "f" + String(i).padStart(5, "0") + ".png"), png);
    await advance(frameMs);
  }
  return frames;
}

// manual frame-stepping (deterministic, no virtual time) — drives window.__renderAdvance()
// and captures a plain transparent screenshot per frame. Reliable where virtual time wedges.
async function renderManual(page, job, tmp) {
  await page.goto(fileUrl(job.url), { waitUntil: "load" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForFunction('typeof window.__renderAdvance === "function"', { timeout: 8000 });
  await page.evaluate(() => window.__renderPlay());
  const frames = Math.max(2, Math.round(job.durMs / (1000 / job.fps)));
  const clip = { x: 0, y: 0, width: job.w, height: job.h };
  for (let i = 0; i < frames; i++) {
    await page.evaluate(() => window.__renderAdvance());
    const png = await page.screenshot({ omitBackground: !!job.transparent, clip, type: "png" });
    fs.writeFileSync(path.join(tmp, "f" + String(i).padStart(5, "0") + ".png"), png);
  }
  return frames;
}

async function renderJob(browser, job) {
  const page = await browser.newPage();
  await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: 1 });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "saku-"));
  try {
    const frames = job.mode === "hook" ? await renderHook(page, job, tmp)
      : job.mode === "manual" ? await renderManual(page, job, tmp)
      : await renderScreenshot(page, job, tmp);
    const outFile = path.join(OUTDIR, job.out);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    encodeWebm(tmp, job.fps, outFile);
    const kb = Math.round(fs.statSync(outFile).size / 1024);
    console.log(`✓ ${job.out}  (${frames}f @ ${job.fps}fps, ${kb} KB)`);
  } finally {
    await page.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  const jobs = JOBS.filter((j) => which === "all" ? true : which === j.name || which === j.group);
  if (!jobs.length) { console.error("no jobs match:", which); process.exit(1); }
  console.log(`renderer: ${jobs.length} clip(s) | handle=${HANDLE} | out=${OUTDIR}`);
  const browser = await puppeteer.launch({ headless: "new",
    args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"] });
  // warm up the GPU/compositor so the first real screenshot doesn't stall under virtual time
  try {
    const wp = await browser.newPage();
    await wp.setViewport({ width: 128, height: 128, deviceScaleFactor: 1 });
    await wp.goto("data:text/html,<body style='background:#0E0A12'></body>", { waitUntil: "load" });
    await wp.screenshot({ type: "png" });
    await wp.close();
  } catch (e) { /* warmup best-effort */ }
  for (const job of jobs) await renderJob(browser, job);
  await browser.close();
  console.log("done.");
})().catch((e) => { console.error(e); process.exit(1); });
