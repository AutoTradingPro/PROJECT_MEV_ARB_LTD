import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "downloads", "desktop");
const destName = "MEV-Core-Engine-Setup.exe";

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

function newestMatch(dir, test) {
  try {
    return readdirSync(dir)
      .filter((name) => test(name))
      .map((name) => path.join(dir, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  } catch {
    return undefined;
  }
}

const bundleRoots = [
  path.join(root, "src-tauri", "target"),
  process.env.CARGO_TARGET_DIR,
  ...listDirs(path.join(os.tmpdir(), "cursor-sandbox-cache")).map((dir) => path.join(dir, "cargo-target")),
].filter(Boolean);

const nsisDirs = bundleRoots.map((dir) => path.join(dir, "release", "bundle", "nsis"));
const msiDirs = bundleRoots.map((dir) => path.join(dir, "release", "bundle", "msi"));

function newestAcross(dirs, test) {
  return dirs
    .map((dir) => newestMatch(dir, test))
    .filter(Boolean)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const source =
  newestAcross(nsisDirs, (name) => name.toLowerCase().endsWith("-setup.exe")) ||
  newestAcross(msiDirs, (name) => name.toLowerCase().endsWith(".msi"));

if (!source) {
  console.error("[desktop] Installer belum ada. Jalankan dulu: npm run tauri:build");
  console.error("[desktop] Dicari di folder nsis/msi di src-tauri/target dan CARGO_TARGET_DIR.");
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
const dest = path.join(destDir, destName);
copyFileSync(source, dest);
console.log(`[desktop] installer disalin:\n  ${source}\n  → ${dest}`);
console.log("[desktop] tombol Download Bot Arbitrase memakai /downloads/desktop/MEV-Core-Engine-Setup.exe");
console.log("[desktop] deploy ulang Netlify (git push) agar file live di mevarbtech.netlify.app");
