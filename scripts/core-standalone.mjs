import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstream = new URL(process.env.MAIN_APP_URL || "http://127.0.0.1:3000");
const port = Number(process.env.CORE_PORT || 4100);
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
// Next dev hanya mengizinkan hostname `localhost` untuk berkas /_next.
// Origin browser 127.0.0.1:4100 membuat chunk JS 403, form tidak terhidrasi, dan login hanya me-reload halaman.
const devOrigin = "http://localhost:3000";

function upstreamHeaders(req) {
  const headers = { ...req.headers, host: "localhost:3000", "x-mev-core-app": "4100" };
  if (headers.origin) headers.origin = devOrigin;
  if (headers.referer) headers.referer = `${devOrigin}/engine`;
  return headers;
}

function allowed(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/bot") ||
    pathname.startsWith("/api/operator") ||
    pathname === "/api/config/toggle-execute" ||
    pathname.startsWith("/api/users") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon-16x16.png" ||
    pathname === "/favicon-32x32.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/images/logo-mevarb.png"
  );
}

function swallow(stream) {
  stream.on("error", () => {});
}

function forward(req, res) {
  swallow(req);
  swallow(res);
  const incoming = new URL(req.url || "/", "http://127.0.0.1");
  if (incoming.pathname === "/engine" || incoming.pathname.startsWith("/engine/")) {
    res.writeHead(302, { location: `/${incoming.search}` });
    res.end();
    return;
  }
  if (!allowed(incoming.pathname)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("MEV Core Engine saja. Dashboard owner tidak tersedia di port ini.");
    return;
  }
  const path = (incoming.pathname === "/" ? "/engine" : incoming.pathname) + incoming.search;
  const proxy = http.request(
    {
      hostname: upstream.hostname,
      port: upstream.port,
      path,
      method: req.method,
      headers: upstreamHeaders(req),
    },
    (up) => {
      swallow(up);
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    }
  );
  swallow(proxy);
  proxy.on("error", () => {
    if (res.headersSent) return;
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Webapp utama belum berjalan di port 3000.");
  });
  req.pipe(proxy);
}

let searcherChild = null;
let searcherStopping = false;
let searcherRetries = 0;

function foreignSearcherRunning() {
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'searcher[/\\\\]index\\.ts' } | Select-Object -ExpandProperty ProcessId",
      ],
      { encoding: "utf8", timeout: 8000, windowsHide: true }
    );
    return out.split(/\s+/).some((item) => item.trim().length > 0);
  } catch {
    return false;
  }
}

function startSearcher() {
  if (searcherStopping || (searcherChild && !searcherChild.killed)) return;
  if (foreignSearcherRunning()) {
    console.log("[mev-core] searcher sudah berjalan. Cold start dan Sync/Swap tidak di-spawn ulang.");
    return;
  }
  const startedAt = Date.now();
  const child = spawn(process.execPath, [tsxCli, "--env-file=.env.local", "searcher/index.ts"], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  searcherChild = child;
  console.log(`[mev-core] searcher dimulai pid ${child.pid} · WSS + populateActiveTicks + Sync/Swap`);
  const write = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim()) console.log(`[searcher] ${line}`);
    }
  };
  child.stdout.on("data", write);
  child.stderr.on("data", write);
  child.on("exit", (code, signal) => {
    if (searcherChild === child) searcherChild = null;
    if (searcherStopping) return;
    if (Date.now() - startedAt > 20_000) searcherRetries = 0;
    const wait = Math.min(15_000, 1000 * 2 ** Math.min(searcherRetries, 4));
    searcherRetries += 1;
    console.warn(`[mev-core] searcher berhenti code=${code ?? "null"} signal=${signal ?? "null"}. ulang dalam ${wait}ms`);
    setTimeout(startSearcher, wait);
  });
}

function stopSearcher() {
  searcherStopping = true;
  if (!searcherChild || searcherChild.killed) return;
  searcherChild.kill();
}

const server = http.createServer(forward);
server.on("upgrade", (req, socket, head) => {
  swallow(socket);
  const incoming = new URL(req.url || "/", "http://127.0.0.1");
  if (!incoming.pathname.startsWith("/_next/")) {
    socket.destroy();
    return;
  }
  const proxy = http.request({
    hostname: upstream.hostname,
    port: upstream.port,
    path: incoming.pathname + incoming.search,
    method: req.method,
    headers: upstreamHeaders(req),
  });
  swallow(proxy);
  proxy.on("upgrade", (up, proxySocket, proxyHead) => {
    swallow(proxySocket);
    socket.write(
      `HTTP/1.1 ${up.statusCode} ${up.statusMessage}\r\n` +
        Object.entries(up.headers)
          .flatMap(([key, value]) =>
            (Array.isArray(value) ? value : [value]).map((item) => `${key}: ${item}`)
          )
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });
  proxy.on("error", () => socket.destroy());
  proxy.end();
  if (head.length) proxy.write(head);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mev-core] aplikasi mandiri di http://127.0.0.1:${port}/`);
  console.log(`[mev-core] login/register terhubung ke ${upstream.origin}/api/users`);
  startSearcher();
});

process.on("SIGINT", () => {
  stopSearcher();
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  stopSearcher();
  server.close(() => process.exit(0));
});
