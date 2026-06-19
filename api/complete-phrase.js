function buildThaiPrompt(input, direction) {
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
            targetText: "同 thai 字段",
            romanization: "拉丁转写",
            chinese: "中文含义"
          }
        }
      })
    }
  ];
}

function buildEnglishPrompt(input) {
  return [
    {
      role: "system",
      content:
        "你是美式英语口语表达教练。只输出 JSON，不要 Markdown。英文必须自然、常用、适合真实口语。不要输出音标。"
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "把中文生活表达转换成一句最推荐的美式英文表达，并给出简明学习解析",
        input,
        constraints: [
          "严格匹配输入粒度：如果输入是单词，只输出最常用英文单词；如果输入是短语，只输出自然短语；如果输入是完整句子，才输出完整句子",
          "只给一个最推荐表达，不要列多个版本",
          "英文要美式、自然、口语化，但不要俚语过重",
          "中文含义要简洁",
          "explanation 用中文写，解释关键词、句型或使用场景，控制在 40 字以内",
          "不要输出音标"
        ],
        outputShape: {
          phrase: {
            english: "英文表达",
            targetText: "同 english 字段",
            chinese: "中文含义",
            explanation: "简明中文解析"
          }
        }
      })
    }
  ];
}

function buildChinesePrompt(input) {
  return [
    {
      role: "system",
      content:
        "You are a Mandarin speaking coach for foreign learners. Output JSON only. The user types English; return one natural Simplified Chinese sentence and an English-based pronunciation hint with Mandarin tone symbols."
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Translate the English input into natural spoken Simplified Chinese and create an English mnemonic pronunciation hint.",
        input,
        constraints: [
          "Return one natural, common Mandarin expression only",
          "Use Simplified Chinese and Mainland Mandarin pronunciation",
          "Do not include pinyin",
          "Do not include grammar explanation",
          "The pronunciationHint must be based on English-friendly syllables, not pinyin",
          "Split the pronunciationHint by Chinese character using hyphens",
          "Every pronunciation unit must include one tone symbol",
          "Use tone symbols exactly: first tone ¯, second tone ´, third tone ˇ, fourth tone ˋ, neutral tone °",
          "Keep the Chinese short and natural; prefer spoken Mandarin over literal translation",
          "Preserve the original English in sourceEnglish"
        ],
        examples: [
          { chinese: "你好", pronunciationHint: "kneeˇ-howˇ" },
          { chinese: "谢谢", pronunciationHint: "shyeahˋ-shyeah°" },
          { chinese: "对不起", pronunciationHint: "dwayˋ-booˋ-cheeˇ" },
          { chinese: "没关系", pronunciationHint: "may´-gwan¯-shee°" },
          { chinese: "我很好", pronunciationHint: "woaˇ-henˇ-howˇ" },
          { chinese: "我不知道", pronunciationHint: "woaˇ-booˋ-jrr¯-dowˋ" },
          { chinese: "我喜欢你", pronunciationHint: "woaˇ-sheeˇ-hwan¯-kneeˇ" }
        ],
        outputShape: {
          phrase: {
            sourceEnglish: "Original English input",
            chinese: "自然简体中文",
            targetText: "同 chinese 字段",
            pronunciationHint: "English mnemonic with tone marks and hyphens"
          }
        }
      })
    }
  ];
}

function buildPrompt(input, languageCode, direction) {
  if (languageCode === "zh") return buildChinesePrompt(input);
  if (languageCode === "en") return buildEnglishPrompt(input);
  return buildThaiPrompt(input, direction);
}

function normalizePhrase(phrase, languageCode) {
  if (languageCode === "zh") {
    return {
      sourceEnglish: phrase.sourceEnglish || "",
      chinese: phrase.chinese || phrase.targetText,
      targetText: phrase.chinese || phrase.targetText,
      pronunciationHint: phrase.pronunciationHint || ""
    };
  }

  if (languageCode === "en") {
    return {
      english: phrase.english || phrase.targetText,
      targetText: phrase.english || phrase.targetText,
      chinese: phrase.chinese,
      explanation: phrase.explanation || ""
    };
  }

  return {
    thai: phrase.thai || phrase.targetText,
    targetText: phrase.targetText || phrase.thai,
    romanization: phrase.romanization,
    chinese: phrase.chinese
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = req.body?.input?.trim();
    if (!input) throw new Error("Missing input");

    const languageCode = ["en", "zh"].includes(req.body?.languageCode) ? req.body.languageCode : "th";
    if (languageCode === "zh" && input.length > 120) {
      throw new Error("Please keep it short so it is easier to speak.");
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: buildPrompt(input, languageCode, req.body?.direction === "thai_to_chinese" ? "thai_to_chinese" : "chinese_to_thai")
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${message}`);
    }

    const data = await response.json();
    const payload = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const phrase = normalizePhrase(payload.phrase || {}, languageCode);
    if (languageCode === "zh" && (!phrase.sourceEnglish || !phrase.chinese || !phrase.pronunciationHint)) {
      throw new Error("Invalid AI response");
    }
    if (languageCode === "en" && (!phrase.targetText || !phrase.chinese || !phrase.explanation)) {
      throw new Error("Invalid AI response");
    }
    if (languageCode === "th" && (!phrase.thai || !phrase.romanization || !phrase.chinese)) {
      throw new Error("Invalid AI response");
    }

    return res.status(200).json({ phrase });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
