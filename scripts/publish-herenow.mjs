import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

const BASE_URL = "https://here.now";
const CLIENT = "codex/publish-node";
const target = process.argv[2];
const spaMode = process.argv.includes("--spa");
const slugFlagIndex = process.argv.indexOf("--slug");
const slug = slugFlagIndex >= 0 ? process.argv[slugFlagIndex + 1] : "";
const claimTokenFlagIndex = process.argv.indexOf("--claim-token");
const claimTokenFromFlag = claimTokenFlagIndex >= 0 ? process.argv[claimTokenFlagIndex + 1] : "";

if (!target) {
  console.error("usage: node scripts/publish-herenow.mjs <file-or-dir> [--spa]");
  process.exit(1);
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const contentTypeFor = (file) => contentTypes[extname(file).toLowerCase()] || "application/octet-stream";

async function collectFiles(root) {
  const rootPath = resolve(root);
  const rootStat = await stat(rootPath);

  if (rootStat.isFile()) {
    return [{ absolutePath: rootPath, sitePath: basename(rootPath) }];
  }

  const files = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() && entry.name !== ".DS_Store") {
        files.push({
          absolutePath,
          sitePath: relative(rootPath, absolutePath).split(sep).join("/"),
        });
      }
    }
  }

  await walk(rootPath);
  return files;
}

async function apiFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data.error) {
    throw new Error(data.error || data.message || `${response.status} ${response.statusText}`);
  }

  return data;
}

async function readApiKey() {
  if (process.env.HERENOW_API_KEY) return process.env.HERENOW_API_KEY.trim();

  try {
    return (await readFile(join(homedir(), ".herenow", "credentials"), "utf8")).trim();
  } catch {
    return "";
  }
}

async function saveState(result) {
  await mkdir(".herenow", { recursive: true });

  let state = { publishes: {} };
  try {
    state = JSON.parse(await readFile(".herenow/state.json", "utf8"));
  } catch {
    // First publish in this workspace.
  }

  state.publishes ||= {};
  const previous = state.publishes[result.slug] || {};
  state.publishes[result.slug] = {
    siteUrl: result.siteUrl,
    claimToken: result.claimToken || previous.claimToken || claimTokenFromFlag,
    claimUrl: result.claimUrl || previous.claimUrl,
    expiresAt: result.expiresAt || previous.expiresAt,
  };

  await writeFile(".herenow/state.json", `${JSON.stringify(state, null, 2)}\n`);
}

async function readState() {
  try {
    return JSON.parse(await readFile(".herenow/state.json", "utf8"));
  } catch {
    return { publishes: {} };
  }
}

const files = await collectFiles(target);
if (!files.some((file) => file.sitePath === "index.html")) {
  console.warn("warning: publishing without an index.html at the site root");
}

const manifest = await Promise.all(
  files.map(async (file) => {
    const bytes = await readFile(file.absolutePath);
    return {
      path: file.sitePath,
      size: bytes.length,
      contentType: contentTypeFor(file.absolutePath),
      hash: createHash("sha256").update(bytes).digest("hex"),
    };
  })
);

const apiKey = await readApiKey();
const state = await readState();
const claimToken = slug && !apiKey ? claimTokenFromFlag || state.publishes?.[slug]?.claimToken : "";
const headers = {
  "content-type": "application/json",
  "x-herenow-client": CLIENT,
};
if (apiKey) {
  headers.authorization = `Bearer ${apiKey}`;
}

const body = { files: manifest, spaMode };
if (claimToken) {
  body.claimToken = claimToken;
}

const createResponse = await apiFetch(`${BASE_URL}/api/v1/publish${slug ? `/${slug}` : ""}`, {
  method: slug ? "PUT" : "POST",
  headers,
  body: JSON.stringify(body),
});

for (const upload of createResponse.upload.uploads || []) {
  const file = files.find((candidate) => candidate.sitePath === upload.path);
  if (!file) throw new Error(`Missing local file for upload path ${upload.path}`);

  const fileBytes = await readFile(file.absolutePath);
  const uploadResponse = await fetch(upload.url, {
    method: upload.method || "PUT",
    headers: upload.headers || { "content-type": contentTypeFor(file.absolutePath) },
    body: fileBytes,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed for ${upload.path}: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
}

const finalizeResponse = await apiFetch(createResponse.upload.finalizeUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ versionId: createResponse.upload.versionId }),
});

await saveState(createResponse);

console.log(finalizeResponse.siteUrl || createResponse.siteUrl);
console.error(`publish_result.site_url=${finalizeResponse.siteUrl || createResponse.siteUrl}`);
console.error(`publish_result.slug=${createResponse.slug}`);
console.error(`publish_result.auth_mode=${apiKey ? "authenticated" : "anonymous"}`);
console.error(`publish_result.persistence=${apiKey ? "permanent" : "expires_24h"}`);
if (!apiKey) {
  console.error(`publish_result.claim_url=${createResponse.claimUrl || ""}`);
  console.error(`publish_result.expires_at=${createResponse.expiresAt || ""}`);
}
