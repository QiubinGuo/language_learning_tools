import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvValue(name) {
  if (process.env[name]) return process.env[name];

  for (const file of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")]) {
    try {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
        if (match && match[1] === name) {
          return match[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Missing .env is fine; the UI will show the API error.
    }
  }

  return "";
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function buildPrompt(input, direction) {
  return [
    {
      role: "system",
      content:
        "你是严谨的泰语生活表达助手。只输出 JSON，不要 Markdown。不要使用中文谐音。romanization 必须是拉丁转写，尽量标注声调。"
    },
    {
      role: "user",
      content: JSON.stringify({
        task: direction === "thai_to_chinese" ? "补全泰文短语信息" : "把中文生活表达翻译成泰文并补全学习信息",
        input,
        constraints: [
          "泰文必须自然、适合泰国日常生活场景",
          "必须严格匹配输入粒度：如果输入是单词或名词短语，只输出对应的单词或名词短语，不要添加主语、老师、我想去等上下文",
          "如果输入是完整句子，才输出完整句子；不要把历史查询或常见场景补进当前输入",
          "例如输入“厕所”只能返回“ห้องน้ำ”这类名词；输入“我想去厕所”才返回“ฉันอยากไปห้องน้ำ”这类句子",
          "thai 字段只能包含泰文、空格和常用标点，绝对不能混入中文、英文或解释文字",
          "中文含义要简洁",
          "romanization 使用拉丁转写，不要中文谐音",
          "只输出一个最常用表达"
        ],
        outputShape: {
          phrase: {
            thai: "泰文",
            romanization: "拉丁转写",
            chinese: "中文含义"
          }
        }
      })
    }
  ];
}

async function completePhrase({ input, direction }) {
  const apiKey = loadEnvValue("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = loadEnvValue("OPENAI_MODEL") || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: buildPrompt(input, direction)
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  const payload = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  const phrase = payload.phrase;
  if (!phrase?.thai || !phrase?.romanization || !phrase?.chinese) {
    throw new Error("Invalid AI response");
  }
  return { phrase };
}

function apiPlugin() {
  return {
    name: "thai-helper-api",
    configureServer(server) {
      server.middlewares.use("/api/complete-phrase", async (req, res) => {
        if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
        try {
          const body = await readBody(req);
          if (!body.input?.trim()) throw new Error("Missing input");
          const payload = await completePhrase({
            input: body.input.trim(),
            direction: body.direction === "thai_to_chinese" ? "thai_to_chinese" : "chinese_to_thai"
          });
          sendJson(res, 200, payload);
        } catch (error) {
          sendJson(res, 500, { error: error.message });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  server: {
    host: "127.0.0.1"
  }
});
