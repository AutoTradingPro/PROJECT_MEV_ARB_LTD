import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(path.join(root, "next.config.ts"), "utf8");

if (!config.includes('output: "standalone"')) {
  console.error("[desktop] next.config.ts harus memakai output standalone.");
  console.error("[desktop] output export tidak bisa menjalankan API, cookie, dan proxy Core Engine.");
  process.exit(1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("[desktop] server standalone siap di .next/standalone");
console.log("[desktop] wrapper native membuka http://127.0.0.1:4100, bukan folder out/");
