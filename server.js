const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = __dirname;
const BACKUP_FILE = path.join(ROOT, "宝宝照护记录.json");
const PORT = Number(process.env.PORT) || 4174;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function saveBackup(request, response) {
  if (request.headers["x-baby-care-local"] !== "1") return sendJson(response, 403, { ok: false, error: "拒绝非页面导出请求" });
  let body = "";
  let size = 0;
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY_SIZE) {
      request.destroy();
      return;
    }
    body += chunk;
  });
  request.on("end", async () => {
    if (size > MAX_BODY_SIZE) return sendJson(response, 413, { ok: false, error: "数据文件过大" });
    try {
      const payload = JSON.parse(body);
      if (!payload || !Array.isArray(payload.records)) return sendJson(response, 400, { ok: false, error: "数据格式不正确" });
      const content = `${JSON.stringify(payload, null, 2)}\n`;
      await fs.promises.writeFile(BACKUP_FILE, content, "utf8");
      sendJson(response, 200, { ok: true, fileName: path.basename(BACKUP_FILE), recordCount: payload.records.length });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: "保存失败", detail: error.message });
    }
  });
  request.on("error", () => {
    if (!response.headersSent) sendJson(response, 400, { ok: false, error: "读取数据失败" });
  });
}

function serveFile(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`).pathname);
  } catch {
    response.writeHead(400);
    return response.end("Bad Request");
  }
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, requested);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }
  if (filePath === BACKUP_FILE) {
    response.writeHead(403);
    return response.end("Backup file is private");
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404);
      return response.end("Not Found");
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/records") return saveBackup(request, response);
  if (request.method === "GET" || request.method === "HEAD") return serveFile(request, response);
  response.writeHead(405, { Allow: "GET, HEAD, POST" });
  response.end("Method Not Allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`宝宝照护日记已启动：http://127.0.0.1:${PORT}/`);
  const addresses = Object.values(os.networkInterfaces()).flat().filter((item) => item && item.family === "IPv4" && !item.internal);
  addresses.forEach((item) => console.log(`手机同一 Wi-Fi 可访问：http://${item.address}:${PORT}/`));
  console.log(`导出文件固定保存到：${BACKUP_FILE}`);
});
