import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.env.MEV_CORE_ROOT || path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.CORE_PORT || 4100);
const livePort = Number(process.env.MEV_LIVE_PORT || 4101);
const dataDir = path.join(root, "data");
mkdirSync(dataDir, { recursive: true });

const logStream = createWriteStream(path.join(dataDir, "core.log"), { flags: "a" });
function log(line) {
  const text = `[core-runtime ${new Date().toISOString()}] ${line}`;
  console.log(text);
  logStream.write(`${text}\n`);
}

process.chdir(root);
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = String(port);
process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";
process.env.CORE_PORT = String(port);
process.env.MEV_LIVE_PORT = String(livePort);
process.env.MEV_DESKTOP_CORE = "1";
process.env.MEV_CORE_ROOT = root;

const OWNER_NODE_CHAIN_IDS = [
  "ethereum",
  "polygon",
  "arbitrum",
  "optimism",
  "avalanche",
  "solana",
  "base",
  "bsc",
  "monad",
  "linea",
];

function seedDesktopQuota() {
  const file = path.join(dataDir, "chain-quota.json");
  if (existsSync(file)) return;
  const on = Object.fromEntries(OWNER_NODE_CHAIN_IDS.map((id) => [id, true]));
  writeFileSync(
    file,
    JSON.stringify(
      {
        wssEnabled: true,
        rpcFallbackEnabled: true,
        chains: on,
        rpcPrimary: on,
        rpcBackup: on,
      },
      null,
      2
    ),
    "utf8"
  );
  log("kuota desktop: semua jaringan ON (file belum ada)");
}

const children = [];
function own(child, label) {
  children.push(child);
  const write = (chunk) => {
    const text = chunk.toString();
    logStream.write(text.endsWith("\n") ? text : `${text}\n`);
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) console.log(`[${label}] ${line}`);
    }
  };
  child.stdout?.on("data", write);
  child.stderr?.on("data", write);
  child.on("exit", (code, signal) => {
    log(`${label} berhenti code=${code ?? "null"} signal=${signal ?? "null"}`);
  });
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

if (!existsSync(path.join(root, "server.js"))) {
  log(`server.js tidak ada di ${root}`);
  process.exit(1);
}

seedDesktopQuota();

log(`menyalakan Next standalone di 127.0.0.1:${port}`);
own(
  spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }),
  "next"
);

const searcherFile = ["searcher.cjs", "searcher.mjs"]
  .map((name) => path.join(root, name))
  .find((file) => existsSync(file));
if (searcherFile) {
  log(`menyalakan scanner / live hub di 127.0.0.1:${livePort}`);
  own(
    spawn(process.execPath, [searcherFile], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
    "searcher"
  );
} else {
  log("searcher.cjs tidak ditemukan — WebSocket 4101 tidak akan terisi");
}

function ping(portToCheck) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: portToCheck, path: "/", timeout: 800 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

const ready = await ping(port);
log(ready ? `HTTP siap di http://127.0.0.1:${port}/engine` : `HTTP masih menghangat di port ${port}`);
await new Promise(() => {});
