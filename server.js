const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);

loadEnv(path.join(ROOT, ".env"));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/contact") {
      await handleContact(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { message: "허용되지 않는 요청입니다." });
      return;
    }

    serveStatic(url.pathname, res, req.method === "HEAD");
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { message: "서버 처리 중 오류가 발생했습니다." });
  }
});

server.listen(PORT, () => {
  console.log(`AI World Signal server running at http://localhost:${PORT}`);
});

async function handleContact(req, res) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "AI World Signal <onboarding@resend.dev>";

  if (!apiKey || !toEmail || toEmail === "your-email@example.com") {
    sendJson(res, 500, { message: "메일 수신 주소 설정이 필요합니다. .env의 CONTACT_TO_EMAIL을 수정해주세요." });
    return;
  }

  const body = await readJson(req);
  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 120);
  const topic = cleanText(body.topic, 80);
  const message = cleanText(body.message, 2000);

  if (!name || !email || !message || !isEmail(email)) {
    sendJson(res, 400, { message: "이름, 올바른 이메일, 문의 내용을 입력해주세요." });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `[AI World Signal] ${topic || "문의"} - ${name}`,
      text: [
        `이름: ${name}`,
        `이메일: ${email}`,
        `문의 유형: ${topic || "미지정"}`,
        "",
        message
      ].join("\n"),
      html: `
        <h2>AI World Signal 문의</h2>
        <p><strong>이름:</strong> ${escapeHtml(name)}</p>
        <p><strong>이메일:</strong> ${escapeHtml(email)}</p>
        <p><strong>문의 유형:</strong> ${escapeHtml(topic || "미지정")}</p>
        <hr>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend API error:", detail);
    sendJson(res, 502, { message: "메일 발송에 실패했습니다. Resend 설정을 확인해주세요." });
    return;
  }

  sendJson(res, 200, { message: "문의가 접수되었습니다. 빠르게 확인하겠습니다." });
}

function serveStatic(urlPath, res, headOnly) {
  const decodedPath = decodeURIComponent(urlPath);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { message: "접근할 수 없는 경로입니다." });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendJson(res, 404, { message: "파일을 찾을 수 없습니다." });
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });

    if (headOnly) {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
