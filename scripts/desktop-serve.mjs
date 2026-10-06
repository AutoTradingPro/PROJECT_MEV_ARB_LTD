import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const coreScript = path.join(root, "scripts", "core-standalone.mjs");
const children = [];

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await portOpen(port)) return;
    await sleep(500);
  }
  throw new Error(`${label} tidak menjawab di 127.0.0.1:${port}`);
}

function own(child) {
  children.push(child);
  child.on("error", (error) => {
    console.error(`[desktop] ${error.message}`);
  });
}

function stopOwned() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  stopOwned();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopOwned();
  process.exit(0);
});

if (!(await portOpen(3000))) {
  console.log("[desktop] menyalakan Next.js di http://127.0.0.1:3000");
  own(
    spawn(process.execPath, [nextBin, "dev"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    })
  );
  await waitForPort(3000, "Next.js");
} else {
  console.log("[desktop] Next.js sudah berjalan di port 3000");
}

if (!(await portOpen(4100))) {
  console.log("[desktop] menyalakan MEV Core Engine di http://127.0.0.1:4100");
  own(
    spawn(process.execPath, [coreScript], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        CORE_PORT: process.env.CORE_PORT || "4100",
        MAIN_APP_URL: process.env.MAIN_APP_URL || "http://127.0.0.1:3000",
      },
    })
  );
  await waitForPort(4100, "MEV Core Engine");
} else {
  console.log("[desktop] MEV Core Engine sudah berjalan di port 4100");
}

console.log("[desktop] jendela Tauri dapat membuka http://127.0.0.1:4100");
await new Promise(() => {});
