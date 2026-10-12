import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const config = readFileSync(path.join(root, "next.config.ts"), "utf8");

if (!config.includes('output: "standalone"')) {
  console.error("[desktop] next.config.ts harus memakai output standalone.");
  process.exit(1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (result.status !== 0) process.exit(result.status ?? 1);

const standalone = path.join(root, ".next", "standalone");
const nestedStandalone = path.join(standalone, path.basename(root));
const standaloneRoot = existsSync(path.join(standalone, "server.js"))
  ? standalone
  : existsSync(path.join(nestedStandalone, "server.js"))
    ? nestedStandalone
    : standalone;

if (!existsSync(path.join(standaloneRoot, "server.js"))) {
  console.error("[desktop] Next standalone server.js tidak ditemukan.");
  process.exit(1);
}

const dest = path.join(root, "src-tauri", "resources", "core");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(standaloneRoot, dest, { recursive: true });

const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(dest, ".next", "static");
if (existsSync(staticSrc)) {
  mkdirSync(path.dirname(staticDest), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });
}

const publicSrc = path.join(root, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, path.join(dest, "public"), {
    recursive: true,
    filter: (source) => {
      const rel = path.relative(publicSrc, source).replaceAll("\\", "/");
      return rel !== "downloads" && !rel.startsWith("downloads/");
    },
  });
}

copyFileSync(path.join(root, "scripts", "core-runtime.mjs"), path.join(dest, "core-runtime.mjs"));

for (const name of [".env.local", ".env"]) {
  const src = path.join(root, name);
  if (existsSync(src)) copyFileSync(src, path.join(dest, name));
}

const dataSrc = path.join(root, "data");
if (existsSync(dataSrc)) {
  mkdirSync(path.join(dest, "data"), { recursive: true });
  for (const name of ["chain-quota.json", "user-register.json"]) {
    const src = path.join(dataSrc, name);
    if (existsSync(src)) copyFileSync(src, path.join(dest, "data", name));
  }
}

let esbuild;
try {
  esbuild = require("esbuild");
} catch {
  esbuild = require(require.resolve("esbuild", { paths: [path.join(root, "node_modules", "tsx")] }));
}

const stub = path.join(root, "scripts", "next-server-stub.mjs");
const bundle = esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: [path.join(root, "searcher", "index.ts")],
  outfile: path.join(dest, "searcher.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  alias: { "@": root, "next/server": stub },
  external: ["pg", "pino", "pino-pretty", "lokijs", "encoding"],
  logLevel: "info",
});
if (bundle.errors?.length) process.exit(1);

function rustTriple() {
  if (process.platform === "win32" && process.arch === "x64") return "x86_64-pc-windows-msvc";
  if (process.platform === "win32" && process.arch === "arm64") return "aarch64-pc-windows-msvc";
  if (process.platform === "darwin" && process.arch === "arm64") return "aarch64-apple-darwin";
  if (process.platform === "darwin") return "x86_64-apple-darwin";
  return `${process.arch}-unknown-linux-gnu`;
}

const binaries = path.join(root, "src-tauri", "binaries");
mkdirSync(binaries, { recursive: true });
const sidecarName =
  process.platform === "win32"
    ? `node-${rustTriple()}.exe`
    : `node-${rustTriple()}`;
copyFileSync(process.execPath, path.join(binaries, sidecarName));
writeFileSync(path.join(binaries, ".gitkeep"), "");

console.log("[desktop] server standalone siap di src-tauri/resources/core");
console.log("[desktop] sidecar Node disalin ke src-tauri/binaries");
console.log("[desktop] wrapper native membuka http://127.0.0.1:4100/engine");
