// PWA として配布できる形に web ビルドを組み立てる。
//
//   node scripts/build-web.mjs
//
// expo export だけでは足りないものを、ここで足す。
//
//   1. .nojekyll        GitHub Pages は _ で始まるディレクトリを無視する。
//                       これが無いと _expo/ が配信されずアプリが起動しない
//   2. head のタグ       manifest、ホーム画面追加用のアイコンとメタ、テーマ色
//   3. sw.js            オフラインで動かすための Service Worker。
//                       実ファイル名がビルドごとに変わるので、ここで一覧を埋め込む
//
// 出力先は dist/。そのまま GitHub Pages に置ける。

import { execSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

const appConfig = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8"));
const baseUrl = appConfig.expo?.experiments?.baseUrl ?? "";

console.log(`baseUrl: ${baseUrl || "(ルート配信)"}`);

// ---------------------------------------------------------------- 0. wasm

// CanvasKit の wasm は 8MB あるのでリポジトリには入れない。
// node_modules から public/ へ都度取り込む（public/ は export でそのまま配信される）。
const wasmSrc = join(ROOT, "node_modules", "canvaskit-wasm", "bin", "full", "canvaskit.wasm");
copyFileSync(wasmSrc, join(ROOT, "public", "canvaskit.wasm"));
console.log("canvaskit.wasm を public/ へ配置");

// ---------------------------------------------------------------- 1. export

rmSync(DIST, { recursive: true, force: true });
execSync("npx expo export --platform web --output-dir dist", { cwd: ROOT, stdio: "inherit" });

// ---------------------------------------------------------------- 2. 収集

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = walk(DIST).map((f) => relative(DIST, f).split(sep).join("/"));

// 起動に必要な軽いものだけ先に取り込む。canvaskit.wasm は 8MB あるので
// 初回に使われたときへ回す（下の runtime cache が拾う）。
const precache = files.filter(
  (f) =>
    f === "index.html" ||
    f.startsWith("_expo/") ||
    f === "manifest.json" ||
    f.endsWith(".png") ||
    f.endsWith(".ico") ||
    f.endsWith(".ttf"),
);

console.log(`\n収録: ${files.length} ファイル / 先読み: ${precache.length} ファイル`);

// ---------------------------------------------------------------- 3. .nojekyll

writeFileSync(join(DIST, ".nojekyll"), "");

// ---------------------------------------------------------------- 4. head の追記

const headTags = `
    <link rel="manifest" href="manifest.json" />
    <meta name="theme-color" content="#0A0A0B" />
    <meta name="description" content="書いたものを1枚の紙として開き、長押しで燃やして消すメモ。" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ASH" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
`;

const swRegistration = `
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("sw.js").catch(function () {});
        });
      }
    </script>
`;

const indexPath = join(DIST, "index.html");
let html = readFileSync(indexPath, "utf8");
html = html.replace("</head>", `${headTags}  </head>`);
html = html.replace("</body>", `${swRegistration}  </body>`);
writeFileSync(indexPath, html);

// ---------------------------------------------------------------- 5. sw.js

const version = Date.now().toString(36);

const sw = `// 自動生成。scripts/build-web.mjs が作る。手で編集しない。
const CACHE = "ash-${version}";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 画面遷移は常に index.html を返す（単一ページのため）
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("index.html").then((hit) => hit || fetch(req)),
    );
    return;
  }

  // それ以外はキャッシュ優先。無ければ取得してから貯める。
  // canvaskit.wasm はここで初回に取り込まれる。
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
`;

writeFileSync(join(DIST, "sw.js"), sw);

console.log(`\n完成: ${DIST}`);
console.log("GitHub Pages に置くか、ローカルで確認するなら:");
console.log(`  npx serve dist${baseUrl ? `  （${baseUrl} 配下で配信する必要あり）` : ""}`);
