import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ENGLISH_PHRASES, ENGLISH_SCENES } from "./englishPhrasebook";
import { THAI_PHRASES } from "./thaiPhrasebook";
import {
  createPronunciationRequest,
  consumeAuthRedirect,
  fetchCloudPhrases,
  fetchAuthUser,
  fetchPronunciationRequests,
  isSupabaseConfigured,
  patchCloudPhrase,
  refreshSession,
  signIn,
  signUp,
  updatePronunciationRequest,
  uploadPronunciationAudio,
  upsertCloudPhrase
} from "./supabaseClient";

const LANGUAGE_KEY = "thai-life-helper-active-language";
const LIBRARY_KEYS = {
  th: "thai-life-helper-library",
  en: "thai-life-helper-english-library",
  zh: "thai-life-helper-chinese-library"
};
const MASTERED_KEYS = {
  th: "thai-life-helper-mastered",
  en: "thai-life-helper-english-mastered",
  zh: "thai-life-helper-chinese-mastered"
};
const CUSTOM_KEYS = {
  th: "thai-life-helper-custom-phrases",
  en: "thai-life-helper-english-custom-phrases",
  zh: "thai-life-helper-chinese-custom-phrases"
};
const SESSION_KEY = "thai-life-helper-session";
const AUTO_SYNC_INTERVAL_MS = 15000;
const ADMIN_EMAIL = "admin@example.com";

const LANGUAGE_CONFIG = {
  th: {
    code: "th",
    title: "泰国生活小助手",
    eyebrow: "Thai Life Helper",
    queryLabel: "中文查询",
    placeholder: "说你想说的，练你想练的泰语",
    searchHint: "输入中文后，本地词库会优先匹配；未收录时会用 API 补齐。需要保存时再点击加入词库。",
    loadingText: "正在调用 API 补齐泰文、拉丁转写和中文含义。",
    emptyText: "还没有加入词库。先搜索中文，再点击加入词库。",
    masteredEmptyText: "你主动点过「已掌握」后，这里会开始记录。",
    libraryNote: "想练习的泰语内容",
    masteredNote: "已经理解的词句",
    randomHint: "优先从我的词库抽取；词库为空时，从内置词库抽取。",
    speakLang: "th-TH",
    speakRate: 0.85,
    bodyClass: "thai-theme",
    submitText: "查询",
    searchedText: "已查询",
    completingText: "补全中",
    clearText: "清空"
  },
  en: {
    code: "en",
    title: "英语口语小助手",
    eyebrow: "English Speaking Helper",
    queryLabel: "中文查询",
    placeholder: "说你想说的，练你想练的英语",
    searchHint: "输入中文后，会返回一句最推荐的美式英文表达，并给出中文含义和简明解析。",
    loadingText: "正在生成英文表达、中文含义和简明解析。",
    emptyText: "还没有加入英语词库。先搜索中文，或从热门场景里选择句子。",
    masteredEmptyText: "你主动点过「已掌握」后，英语笔记本会开始记录。",
    libraryNote: "想练习的英语表达",
    masteredNote: "已经理解的英语表达",
    randomHint: "优先从我的英语词库抽取；词库为空时，从热门场景抽取。",
    speakLang: "en-US",
    speakRate: 0.9,
    bodyClass: "english-theme",
    submitText: "查询",
    searchedText: "已查询",
    completingText: "补全中",
    clearText: "清空"
  },
  zh: {
    code: "zh",
    title: "Speak Chinese",
    eyebrow: "Chinese Pronunciation Helper",
    queryLabel: "English Input",
    placeholder: "Type what you want to say in English",
    searchHint: "Type English. Hear and speak natural Mandarin.",
    loadingText: "Creating natural Mandarin and a tone-marked pronunciation hint.",
    emptyText: "",
    masteredEmptyText: "",
    libraryNote: "",
    masteredNote: "",
    randomHint: "",
    speakLang: "zh-CN",
    speakRate: 0.92,
    bodyClass: "chinese-theme",
    submitText: "Submit",
    searchedText: "Submitted",
    completingText: "Creating",
    clearText: "Clear"
  }
};

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function uniqueIds(ids) {
  return Array.from(new Set(ids));
}

function hasSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function thaiToItem(phrase) {
  return {
    id: phrase.id,
    targetText: phrase.thai,
    romanization: phrase.romanization,
    chinese: phrase.chinese,
    language: "th",
    source: phrase.source || "built-in"
  };
}

function makeCustomId(item, language) {
  const raw = `${language}|${item.targetText}|${item.chinese}`;
  return `${language}-custom-${btoa(unescape(encodeURIComponent(raw))).replace(/=+$/g, "")}`;
}

function scoreItem(item, query) {
  const normalizedQuery = normalizeText(query);
  const chinese = normalizeText(item.chinese);
  const targetText = normalizeText(item.targetText);
  if (!normalizedQuery) return 0;
  if (chinese === normalizedQuery || targetText === normalizedQuery) return 100;
  if (chinese.startsWith(normalizedQuery) || targetText.startsWith(normalizedQuery)) return 80;
  if (chinese.includes(normalizedQuery) || targetText.includes(normalizedQuery)) return 60;
  return 0;
}

function exactSearchItems(source, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];
  return source.filter((item) => normalizeText(item.chinese) === normalizedQuery || normalizeText(item.targetText) === normalizedQuery);
}

function searchItems(source, query) {
  return source
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.chinese.length - b.item.chinese.length)
    .map((entry) => entry.item)
    .slice(0, 12);
}

async function completeItem(input, language) {
  const response = await fetch("/api/complete-phrase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      languageCode: language,
      direction: language === "th" ? "chinese_to_thai" : language === "zh" ? "english_to_chinese" : "chinese_to_english"
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI 补全失败");

  const phrase = data.phrase;
  if (language === "zh") {
    const item = {
      id: "",
      sourceEnglish: phrase.sourceEnglish || input,
      targetText: phrase.targetText || phrase.chinese,
      chinese: phrase.chinese,
      pronunciationHint: phrase.pronunciationHint,
      language,
      source: "ai"
    };
    item.id = makeCustomId({ ...item, chinese: item.sourceEnglish }, language);
    return item;
  }

  const item = {
    id: "",
    targetText: phrase.targetText || phrase.english || phrase.thai,
    romanization: phrase.romanization || "",
    chinese: phrase.chinese,
    explanation: phrase.explanation || "",
    language,
    source: "ai"
  };
  item.id = makeCustomId(item, language);
  return item;
}

async function withAuthUser(session) {
  if (!session?.access_token || session.user?.email) return session;
  try {
    const user = await fetchAuthUser(session);
    return { ...session, user };
  } catch {
    return session;
  }
}

function isExpiredAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("jwt expired") || message.includes("invalid jwt") || message.includes("refresh token");
}

function App() {
  const [activeLanguage, setActiveLanguage] = useState(() => loadJson(LANGUAGE_KEY, "th"));
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [libraryIdsByLanguage, setLibraryIdsByLanguage] = useState(() => ({
    th: loadJson(LIBRARY_KEYS.th, []),
    en: loadJson(LIBRARY_KEYS.en, []),
    zh: []
  }));
  const [masteredIdsByLanguage, setMasteredIdsByLanguage] = useState(() => ({
    th: loadJson(MASTERED_KEYS.th, []),
    en: loadJson(MASTERED_KEYS.en, []),
    zh: []
  }));
  const [customItemsByLanguage, setCustomItemsByLanguage] = useState(() => ({
    th: loadJson(CUSTOM_KEYS.th, []).map((phrase) => (phrase.targetText ? phrase : thaiToItem(phrase))),
    en: loadJson(CUSTOM_KEYS.en, []),
    zh: []
  }));
  const [selectedSceneId, setSelectedSceneId] = useState(ENGLISH_SCENES[0].id);
  const [randomItem, setRandomItem] = useState(null);
  const [librarySelection, setLibrarySelection] = useState([]);
  const [masteredSelection, setMasteredSelection] = useState([]);
  const [speechSupported, setSpeechSupported] = useState(hasSpeechSynthesis);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [generatedResult, setGeneratedResult] = useState(null);
  const [session, setSession] = useState(() => loadJson(SESSION_KEY, null));
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? "未登录" : "本地模式");
  const [pronunciationRequests, setPronunciationRequests] = useState([]);
  const [pronunciationStatus, setPronunciationStatus] = useState("");
  const syncInFlightRef = useRef(false);
  const customItemsRef = useRef(customItemsByLanguage);
  const libraryIdsRef = useRef(libraryIdsByLanguage);
  const masteredIdsRef = useRef(masteredIdsByLanguage);

  const config = LANGUAGE_CONFIG[activeLanguage];
  const builtinItems = useMemo(
    () => ({
      th: THAI_PHRASES.map(thaiToItem),
      en: ENGLISH_PHRASES,
      zh: []
    }),
    []
  );
  const allItems = useMemo(() => {
    const map = new Map();
    [...customItemsByLanguage[activeLanguage], ...builtinItems[activeLanguage]].forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [activeLanguage, builtinItems, customItemsByLanguage]);
  const results = useMemo(() => exactSearchItems(allItems, query), [allItems, query]);
  const itemById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);
  const libraryIds = libraryIdsByLanguage[activeLanguage];
  const masteredIds = masteredIdsByLanguage[activeLanguage];
  const library = useMemo(() => libraryIds.map((id) => itemById.get(id)).filter(Boolean), [itemById, libraryIds]);
  const mastered = useMemo(() => masteredIds.map((id) => itemById.get(id)).filter(Boolean), [itemById, masteredIds]);
  const selectedScene = ENGLISH_SCENES.find((scene) => scene.id === selectedSceneId) || ENGLISH_SCENES[0];
  const sceneItems = selectedScene.items;

  useEffect(() => {
    document.body.classList.remove("thai-theme", "english-theme", "chinese-theme");
    document.body.classList.add(config.bodyClass);
  }, [config.bodyClass]);

  useEffect(() => {
    saveJson(LANGUAGE_KEY, activeLanguage);
  }, [activeLanguage]);

  useEffect(() => {
    customItemsRef.current = customItemsByLanguage;
    libraryIdsRef.current = libraryIdsByLanguage;
    masteredIdsRef.current = masteredIdsByLanguage;
  }, [customItemsByLanguage, libraryIdsByLanguage, masteredIdsByLanguage]);

  useEffect(() => {
    if (!hasSpeechSynthesis()) {
      setSpeechSupported(false);
      return undefined;
    }

    function updateVoiceSupport() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        setSpeechSupported(true);
        return;
      }
      const prefix = activeLanguage === "th" ? "th" : activeLanguage === "zh" ? "zh" : "en";
      setSpeechSupported(voices.some((voice) => voice.lang.toLowerCase().startsWith(prefix)));
    }

    updateVoiceSupport();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoiceSupport);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoiceSupport);
  }, [activeLanguage]);

  const persistLibrary = useCallback((language, ids) => {
    const next = uniqueIds(ids);
    setLibraryIdsByLanguage((current) => ({ ...current, [language]: next }));
    saveJson(LIBRARY_KEYS[language], next);
  }, []);

  const persistMastered = useCallback((language, ids) => {
    const next = uniqueIds(ids);
    setMasteredIdsByLanguage((current) => ({ ...current, [language]: next }));
    saveJson(MASTERED_KEYS[language], next);
  }, []);

  const persistCustom = useCallback((language, items) => {
    const map = new Map(items.map((item) => [item.id, item]));
    const next = Array.from(map.values());
    setCustomItemsByLanguage((current) => ({ ...current, [language]: next }));
    saveJson(CUSTOM_KEYS[language], next);
    return next;
  }, []);

  const syncFromCloud = useCallback(
    async (activeSession, options = {}) => {
      if (!activeSession || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      if (!options.silent) setCloudStatus("同步中");
      try {
        const rows = await fetchCloudPhrases(activeSession);
        const cloudKeys = new Set(rows.map((row) => row.phrase_key));
        const builtinIds = new Set(THAI_PHRASES.map((phrase) => phrase.id));
        const cloudCustom = rows
          .filter((row) => !builtinIds.has(row.phrase_key))
          .map((row) => ({
            id: row.phrase_key,
            targetText: row.thai,
            romanization: row.romanization,
            chinese: row.chinese,
            language: "th",
            source: "cloud"
          }));

        const localCustom = customItemsRef.current.th.filter((item) => !cloudKeys.has(item.id));
        const localLibrary = libraryIdsRef.current.th.filter((id) => !cloudKeys.has(id));
        const localMastered = masteredIdsRef.current.th.filter((id) => !cloudKeys.has(id));

        persistCustom("th", [...cloudCustom, ...localCustom]);
        persistLibrary("th", uniqueIds([...rows.filter((row) => row.in_library).map((row) => row.phrase_key), ...localLibrary]));
        persistMastered("th", uniqueIds([...rows.filter((row) => row.mastered).map((row) => row.phrase_key), ...localMastered]));
        setCloudStatus("云端已同步");
      } catch (error) {
        setCloudStatus(error.message);
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [persistCustom, persistLibrary, persistMastered]
  );

  const loadPronunciationRequests = useCallback(async (activeSession) => {
    if (!activeSession || !isSupabaseConfigured) return;
    try {
      const rows = await fetchPronunciationRequests(activeSession);
      setPronunciationRequests(rows);
    } catch (error) {
      setPronunciationStatus(error.message);
    }
  }, []);

  useEffect(() => {
    const redirectedSession = consumeAuthRedirect();
    if (!redirectedSession) return;
    withAuthUser(redirectedSession).then((nextSession) => {
      setSession(nextSession);
      saveJson(SESSION_KEY, nextSession);
      setCloudStatus("邮箱已确认，已登录");
      syncFromCloud(nextSession);
      loadPronunciationRequests(nextSession);
    });
  }, [loadPronunciationRequests, syncFromCloud]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) return;
    syncFromCloud(session);
    loadPronunciationRequests(session);
  }, [loadPronunciationRequests, session?.access_token, syncFromCloud]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) return undefined;

    function syncSilently() {
      syncFromCloud(session, { silent: true });
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") syncSilently();
    }

    const intervalId = window.setInterval(syncSilently, AUTO_SYNC_INTERVAL_MS);
    window.addEventListener("focus", syncSilently);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncSilently);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [session?.access_token, syncFromCloud]);

  function switchLanguage(language) {
    if (language === activeLanguage) return;
    setActiveLanguage(language);
    setQuery("");
    setHasSearched(false);
    setCompletionError("");
    setGeneratedResult(null);
    setRandomItem(null);
    setLibrarySelection([]);
    setMasteredSelection([]);
  }

  function addCustomItem(item) {
    if (activeLanguage === "zh") {
      setGeneratedResult(item);
      return item;
    }
    persistCustom(activeLanguage, [item, ...customItemsByLanguage[activeLanguage]]);
    return item;
  }

  async function mirrorItemToCloud(item, state) {
    if (activeLanguage !== "th" || !session || !isSupabaseConfigured) return;
    try {
      await upsertCloudPhrase(
        session,
        {
          id: item.id,
          thai: item.targetText,
          romanization: item.romanization || "",
          chinese: item.chinese
        },
        state
      );
      setCloudStatus("云端已同步");
    } catch (error) {
      setCloudStatus(error.message);
    }
  }

  function speakItem(item, rateOverride) {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.targetText);
    utterance.lang = LANGUAGE_CONFIG[item.language || activeLanguage].speakLang;
    utterance.rate = rateOverride || LANGUAGE_CONFIG[item.language || activeLanguage].speakRate;
    window.speechSynthesis.speak(utterance);
  }

  function toggleLibrary(item) {
    const inLibrary = libraryIds.includes(item.id);
    if (inLibrary) {
      removeFromLibrary([item.id]);
      return;
    }
    persistLibrary(activeLanguage, [item.id, ...libraryIds]);
    mirrorItemToCloud(item, { inLibrary: true, mastered: masteredIds.includes(item.id) });
  }

  function markMastered(id) {
    const item = itemById.get(id);
    persistLibrary(activeLanguage, [id, ...libraryIds]);
    persistMastered(activeLanguage, [id, ...masteredIds]);
    if (item) mirrorItemToCloud(item, { inLibrary: true, mastered: true });
  }

  async function removeFromLibrary(idsToRemove) {
    const blocked = new Set(idsToRemove);
    persistLibrary(activeLanguage, libraryIds.filter((id) => !blocked.has(id)));
    persistMastered(activeLanguage, masteredIds.filter((id) => !blocked.has(id)));
    setLibrarySelection([]);
    setMasteredSelection([]);
    if (activeLanguage === "th" && session && isSupabaseConfigured) {
      await Promise.all(idsToRemove.map((id) => patchCloudPhrase(session, id, { in_library: false, mastered: false }).catch(() => null)));
      setCloudStatus("云端已同步");
    }
  }

  async function removeFromMastered(idsToRemove) {
    const blocked = new Set(idsToRemove);
    persistMastered(activeLanguage, masteredIds.filter((id) => !blocked.has(id)));
    setMasteredSelection([]);
    if (activeLanguage === "th" && session && isSupabaseConfigured) {
      await Promise.all(idsToRemove.map((id) => patchCloudPhrase(session, id, { mastered: false }).catch(() => null)));
      setCloudStatus("云端已同步");
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setHasSearched(true);
    setCompletionError("");
    setGeneratedResult(null);
    if (activeLanguage === "zh" && query.trim().length > 120) {
      setCompletionError("Please keep it short so it is easier to speak.");
      return;
    }
    const localResults = activeLanguage === "th" ? exactSearchItems(allItems, query) : searchItems(allItems, query).slice(0, 1);
    if (activeLanguage !== "zh" && localResults.length) return;

    setIsCompleting(true);
    try {
      const item = addCustomItem(await completeItem(query.trim(), activeLanguage));
      setGeneratedResult(item);
    } catch (error) {
      setCompletionError(error.message);
    } finally {
      setIsCompleting(false);
    }
  }

  async function handlePronunciationSubmit(sentence, note) {
    if (!session?.access_token) {
      setPronunciationStatus("请先登录，再提交真人纠音。");
      return;
    }
    if (!sentence.trim()) {
      setPronunciationStatus("请输入需要纠音的英语句子。");
      return;
    }
    setPronunciationStatus("正在提交纠音请求...");
    try {
      await createPronunciationRequest(session, { sentence: sentence.trim(), note: note.trim() });
      setPronunciationStatus("已提交，等待老师纠音。");
      await loadPronunciationRequests(session);
    } catch (error) {
      setPronunciationStatus(error.message);
    }
  }

  function drawRandomItem() {
    const source = library.length >= 2 ? library : allItems;
    const candidates = randomItem && source.length > 1 ? source.filter((item) => item.id !== randomItem.id) : source;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    setRandomItem(next);
  }

  function toggleSelection(id, selection, setSelection) {
    if (selection.includes(id)) {
      setSelection(selection.filter((item) => item !== id));
      return;
    }
    setSelection([...selection, id]);
  }

  async function handleAuth(email, password, mode) {
    if (!isSupabaseConfigured) {
      const message = "请先配置 Supabase 环境变量";
      setCloudStatus(message);
      return { ok: false, message };
    }
    if (!email.trim() || !password) return { ok: false, message: "请输入邮箱和密码。" };
    if (password.length < 6) return { ok: false, message: "密码至少需要 6 位。" };

    setCloudStatus(mode === "signup" ? "注册中" : "登录中");
    try {
      const payload = mode === "signup" ? await signUp(email, password) : await signIn(email, password);
      const nextSession = await withAuthUser(payload.access_token ? payload : payload.session);
      if (!nextSession?.access_token) {
        const message = "注册成功，请检查邮箱确认链接，然后回来登录。";
        setCloudStatus("等待邮箱确认");
        return { ok: true, message };
      }
      setSession(nextSession);
      saveJson(SESSION_KEY, nextSession);
      setCloudStatus("已登录");
      await syncFromCloud(nextSession);
      await loadPronunciationRequests(nextSession);
      return { ok: true, message: "登录成功，泰语词库会自动同步到云端。" };
    } catch (error) {
      const message = humanizeAuthError(error.message);
      setCloudStatus(message);
      return { ok: false, message };
    }
  }

  function logout() {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
    setCloudStatus(isSupabaseConfigured ? "未登录" : "本地模式");
  }

  const visibleResults = hasSearched ? (generatedResult ? [generatedResult] : activeLanguage === "en" ? searchItems(allItems, query).slice(0, 1) : results) : [];
  const homeItems = activeLanguage === "en" && !hasSearched ? sceneItems : [];
  const resultTitle = activeLanguage === "en" ? (hasSearched ? "查询结果" : `${selectedScene.label} · 10 句跟读训练`) : "";
  const isChineseMode = activeLanguage === "zh";

  return (
    <div className={`app-shell ${activeLanguage === "en" ? "english-app" : activeLanguage === "zh" ? "chinese-app" : "thai-app"}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <FlagLogo language={activeLanguage} />
          <div>
            <p className="eyebrow">
              {config.eyebrow} · {activeLanguage === "th" ? cloudStatus : activeLanguage === "zh" ? "ZH" : "本地练习"}
            </p>
            <h1>{config.title}</h1>
          </div>
        </div>
        <LanguageSwitcher activeLanguage={activeLanguage} onSwitch={switchLanguage} />
      </header>

      <main className="workspace">
        <section className="search-panel" aria-label={`${config.title}查询`}>
          <form className="search-form" onSubmit={handleSearch}>
            <label htmlFor="language-search">{config.queryLabel}</label>
            <div className="search-box">
              {!query && !isFocused ? <span className="custom-placeholder">{config.placeholder}</span> : null}
              <textarea
                className={activeLanguage === "en" || activeLanguage === "zh" ? "compact-search-input" : ""}
                id="language-search"
                value={query}
                maxLength={isChineseMode ? 120 : undefined}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {isChineseMode ? <p className="input-note">{query.length}/120 · Keep it short so it is easier to speak.</p> : null}
            <div className="toolbar">
              <button className="primary-button" type="submit" disabled={!query.trim() || isCompleting}>
                {isCompleting ? config.completingText : hasSearched && visibleResults.length ? config.searchedText : config.submitText}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setQuery("");
                  setHasSearched(false);
                  setCompletionError("");
                  setGeneratedResult(null);
                }}
              >
                {config.clearText}
              </button>
            </div>
          </form>

          <ResultArea
            config={config}
            hasSearched={hasSearched}
            homeTitle={resultTitle}
            homeItems={homeItems}
            results={visibleResults}
            libraryIds={libraryIds}
            masteredIds={masteredIds}
            speechSupported={speechSupported}
            isCompleting={isCompleting}
            completionError={completionError}
            onSpeak={speakItem}
            onToggleLibrary={toggleLibrary}
            onMaster={markMastered}
          />

          {activeLanguage === "en" ? (
            <>
              <PronunciationPanel
                session={session}
                requests={pronunciationRequests}
                status={pronunciationStatus}
                onSubmit={handlePronunciationSubmit}
                onRefresh={() => loadPronunciationRequests(session)}
              />
              <SceneTabs scenes={ENGLISH_SCENES} selectedSceneId={selectedSceneId} onSelect={setSelectedSceneId} />
            </>
          ) : null}
        </section>

        {!isChineseMode ? (
          <aside className="side-panel">
            <AuthPanel session={session} cloudStatus={cloudStatus} onAuth={handleAuth} onLogout={logout} onSync={() => syncFromCloud(session)} />

            <section className="tool-panel">
              <div className="panel-head">
                <p className="section-label">随机练习</p>
                <button className="secondary-button compact" type="button" onClick={drawRandomItem}>
                  下一张
                </button>
              </div>
              {randomItem ? (
                <PhraseCard
                  item={randomItem}
                  libraryIds={libraryIds}
                  masteredIds={masteredIds}
                  speechSupported={speechSupported}
                  onSpeak={speakItem}
                  onToggleLibrary={toggleLibrary}
                  onMaster={markMastered}
                />
              ) : (
                <p className="muted-copy">{config.randomHint}</p>
              )}
            </section>
          </aside>
        ) : null}
      </main>

      {!isChineseMode ? <section className="collection-grid">
        <CollectionPanel
          title="我的词库"
          note={config.libraryNote}
          items={library}
          selection={librarySelection}
          onToggle={(id) => toggleSelection(id, librarySelection, setLibrarySelection)}
          onRemoveOne={(id) => removeFromLibrary([id])}
          onRemoveSelected={() => removeFromLibrary(librarySelection)}
          masteredIds={masteredIds}
          speechSupported={speechSupported}
          onSpeak={speakItem}
          onMaster={markMastered}
          emptyText={config.emptyText}
        />
        <CollectionPanel
          title="笔记本"
          note={config.masteredNote}
          items={mastered}
          selection={masteredSelection}
          onToggle={(id) => toggleSelection(id, masteredSelection, setMasteredSelection)}
          onRemoveOne={(id) => removeFromMastered([id])}
          onRemoveSelected={() => removeFromMastered(masteredSelection)}
          masteredIds={masteredIds}
          speechSupported={speechSupported}
          onSpeak={speakItem}
          onMaster={markMastered}
          emptyText={config.masteredEmptyText}
          isMasteredPanel
        />
      </section> : null}
    </div>
  );
}

function humanizeAuthError(message) {
  if (!message) return "操作失败，请稍后再试。";
  if (message.includes("Invalid login credentials")) return "邮箱或密码不正确。";
  if (message.includes("Email not confirmed")) return "邮箱还没有确认，请先打开确认邮件。";
  if (message.includes("User already registered")) return "这个邮箱已经注册过，请直接登录。";
  if (message.includes("Password should be")) return "密码强度不够，请至少输入 6 位。";
  if (message.includes("Signup is disabled")) return "Supabase 当前关闭了邮箱注册，请在 Authentication 设置里打开 Email 注册。";
  if (message.includes("Database error saving new user")) return "Supabase 保存新用户失败，请稍后重试；如果持续出现，需要检查 Auth 数据库设置。";
  if (message.toLowerCase().includes("rate limit")) return "请求太频繁，请稍后再试。";
  if (message.includes("NetworkError") || message.includes("Failed to fetch")) return "网络请求失败，请检查 Supabase 配置或稍后重试。";
  return message;
}

function FlagLogo({ language }) {
  if (language === "en") {
    return (
      <div className="flag-logo us-flag" aria-label="美国国旗" role="img">
        <span />
      </div>
    );
  }

  if (language === "zh") {
    return (
      <div className="flag-logo china-flag" aria-label="中国国旗" role="img">
        <span />
      </div>
    );
  }

  return (
    <div className="flag-logo thai-flag" aria-label="泰国国旗" role="img">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function LanguageSwitcher({ activeLanguage, onSwitch }) {
  return (
    <div className="language-switcher" aria-label="切换语言">
      <button className={activeLanguage === "th" ? "language-pill active" : "language-pill"} type="button" onClick={() => onSwitch("th")}>
        Thai
      </button>
      <button className={activeLanguage === "en" ? "language-pill active" : "language-pill"} type="button" onClick={() => onSwitch("en")}>
        English
      </button>
      <button className={activeLanguage === "zh" ? "language-pill active" : "language-pill"} type="button" onClick={() => onSwitch("zh")}>
        Chinese
      </button>
    </div>
  );
}

function SceneTabs({ scenes, selectedSceneId, onSelect }) {
  return (
    <section className="scene-panel" aria-label="英语热门场景">
      <div className="panel-head">
        <div>
          <p className="section-label">热门场景</p>
          <h2>选择一个场景，马上跟读</h2>
        </div>
      </div>
      <div className="scene-grid">
        {scenes.map((scene) => (
          <button
            className={scene.id === selectedSceneId ? "scene-chip active" : "scene-chip"}
            key={scene.id}
            type="button"
            onClick={() => onSelect(scene.id)}
          >
            <span>{scene.label}</span>
            <small>{scene.note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PronunciationPanel({ session, requests, status, onSubmit, onRefresh }) {
  const [sentence, setSentence] = useState("");
  const [note, setNote] = useState("");
  const recentRequests = requests.slice(0, 4);

  async function submit(event) {
    event.preventDefault();
    await onSubmit(sentence, note);
    setSentence("");
    setNote("");
  }

  return (
    <section className="pronunciation-panel" aria-label="真人纠音">
      <div className="panel-head">
        <div>
          <p className="section-label">真人纠音</p>
          <h2>提交句子，等待老师录音反馈</h2>
        </div>
        <button className="secondary-button compact" type="button" onClick={onRefresh} disabled={!session}>
          刷新反馈
        </button>
      </div>
      <p className="pronunciation-copy">输入英语句子，提交后，由老师录音反馈，通常 24 小时内反馈，请再次打开此网页查看结果。</p>
      <form className="pronunciation-form" onSubmit={submit}>
        <textarea value={sentence} placeholder="输入你想纠音的英语句子" onChange={(event) => setSentence(event.target.value)} />
        <input value={note} placeholder="可选：补充说明，比如想练美式发音、重音或连读" onChange={(event) => setNote(event.target.value)} />
        <button className="primary-button compact" type="submit" disabled={!session || !sentence.trim()}>
          提交纠音
        </button>
      </form>
      {!session ? <p className="auth-status info">请先登录账号，再提交真人纠音。</p> : null}
      {status ? <p className="auth-status info">{status}</p> : null}
      {recentRequests.length ? (
        <div className="correction-list">
          {recentRequests.map((request) => (
            <article className="correction-item" key={request.id}>
              <div>
                <strong>{request.status === "done" ? "已纠音" : "等待老师纠音"}</strong>
                <p>{request.sentence}</p>
                {request.feedback_text ? <p className="explanation">{request.feedback_text}</p> : null}
              </div>
              {request.audio_url ? (
                <audio controls src={request.audio_url}>
                  <track kind="captions" />
                </audio>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AuthPanel({ session, cloudStatus, onAuth, onLogout, onSync }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "info", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(mode) {
    setIsSubmitting(true);
    setStatus({ type: "info", text: mode === "signup" ? "正在注册账号..." : "正在登录..." });
    const result = await onAuth(email.trim(), password, mode);
    setStatus({ type: result?.ok ? "success" : "error", text: result?.message || "操作完成。" });
    setIsSubmitting(false);
  }

  return (
    <section className="tool-panel">
      <div className="panel-head">
        <div>
          <p className="section-label">开放测试账号</p>
          <h2>{session ? "已登录" : "登录同步"}</h2>
        </div>
      </div>
      {session ? (
        <div className="auth-card">
          <p>{session.user?.email || "当前用户"}</p>
          <span className="auth-status success">已登录 · {cloudStatus}</span>
          <button className="secondary-button compact" type="button" onClick={onLogout}>
            退出登录
          </button>
          <button className="secondary-button compact" type="button" onClick={onSync}>
            立即同步
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <input value={email} placeholder="邮箱" onChange={(event) => setEmail(event.target.value)} />
          <input value={password} placeholder="密码" type="password" onChange={(event) => setPassword(event.target.value)} />
          <div className="toolbar">
            <button className="primary-button compact" type="button" disabled={isSubmitting} onClick={() => submit("signin")}>
              {isSubmitting ? "处理中" : "登录"}
            </button>
            <button className="secondary-button compact" type="button" disabled={isSubmitting} onClick={() => submit("signup")}>
              注册
            </button>
          </div>
          {status.text ? <p className={`auth-status ${status.type}`}>{status.text}</p> : null}
          <p className="muted-copy">注册成功后如果没有自动登录，请打开邮箱确认链接，再回到这里登录。</p>
        </form>
      )}
    </section>
  );
}

function ResultArea({
  config,
  hasSearched,
  homeTitle,
  homeItems,
  results,
  libraryIds,
  masteredIds,
  speechSupported,
  isCompleting,
  completionError,
  onSpeak,
  onToggleLibrary,
  onMaster
}) {
  if (isCompleting) return <div className="empty-state">{config.loadingText}</div>;
  if (completionError) return <div className="empty-state">{completionError}</div>;

  const itemsToRender = hasSearched ? results : homeItems;
  if (!hasSearched && !homeItems.length) return <p className="result-hint">{config.searchHint}</p>;
  if (hasSearched && !results.length) return <div className="empty-state">暂时没有结果。请稍后再试，或检查 API 配置。</div>;

  return (
    <div className="result-list">
      {homeTitle ? <p className="scene-result-title">{homeTitle}</p> : null}
      {itemsToRender.map((item) => (
        item.language === "zh" ? (
          <ChinesePronunciationCard key={item.id} item={item} speechSupported={speechSupported} onSpeak={onSpeak} />
        ) : (
          <PhraseCard
            key={item.id}
            item={item}
            libraryIds={libraryIds}
            masteredIds={masteredIds}
            speechSupported={speechSupported}
            onSpeak={onSpeak}
            onToggleLibrary={onToggleLibrary}
            onMaster={onMaster}
          />
        )
      ))}
    </div>
  );
}

function ChinesePronunciationCard({ item, speechSupported, onSpeak }) {
  return (
    <article className="chinese-pronunciation-card">
      <div className="pronunciation-result-grid">
        <section>
          <p className="section-label">Original English</p>
          <h2 lang="en">{item.sourceEnglish}</h2>
        </section>
        <section>
          <p className="section-label">Chinese</p>
          <h2 lang="zh-CN">{item.targetText}</h2>
        </section>
        <section className="hint-block">
          <p className="section-label">Pronunciation Hint</p>
          <h3 lang="en">{item.pronunciationHint}</h3>
        </section>
      </div>
      <div className="card-actions chinese-actions">
        <button
          className="primary-button compact"
          type="button"
          onClick={() => onSpeak(item)}
          disabled={!speechSupported}
          title={speechSupported ? "Play Mandarin" : "Speech is not available in this browser"}
        >
          Play
        </button>
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => onSpeak(item, 0.58)}
          disabled={!speechSupported}
          title={speechSupported ? "Play Mandarin slowly" : "Speech is not available in this browser"}
        >
          Slow
        </button>
      </div>
    </article>
  );
}

function PhraseCard({ item, libraryIds, masteredIds, speechSupported, onSpeak, onToggleLibrary, onMaster }) {
  const inLibrary = libraryIds.includes(item.id);
  const isMastered = masteredIds.includes(item.id);
  const lang = item.language === "en" ? "en" : "th";

  return (
    <article className="phrase-card">
      <div className="phrase-main">
        <h2 lang={lang}>{item.targetText}</h2>
        {item.romanization ? <p className="romanization">[{item.romanization}]</p> : null}
        <p className="chinese">（{item.chinese}）</p>
        {item.explanation ? <p className="explanation">{item.explanation}</p> : null}
      </div>
      <div className="card-actions">
        <button
          className="icon-action"
          type="button"
          onClick={() => onSpeak(item)}
          disabled={!speechSupported}
          title={speechSupported ? "播放发音" : "当前浏览器没有可用朗读功能"}
          aria-label={`播放 ${item.targetText}`}
        >
          ▶
        </button>
        <button className="secondary-button compact" type="button" onClick={() => onToggleLibrary(item)}>
          {inLibrary ? "已加入 · 点击取消" : "加入词库"}
        </button>
        <button className="primary-button compact" type="button" disabled={isMastered} onClick={() => onMaster(item.id)}>
          已掌握
        </button>
      </div>
    </article>
  );
}

function CollectionPanel({
  title,
  note,
  items,
  selection,
  onToggle,
  onRemoveOne,
  onRemoveSelected,
  speechSupported,
  onSpeak,
  emptyText,
  isMasteredPanel = false
}) {
  return (
    <section className={isMasteredPanel ? "collection-panel" : "collection-panel library-panel"}>
      <div className="panel-head">
        <div>
          <p className="section-label">{note}</p>
          <h2>{title}</h2>
        </div>
        {isMasteredPanel ? (
          <button className="danger-button compact" type="button" disabled={!selection.length} onClick={onRemoveSelected}>
            批量移除
          </button>
        ) : null}
      </div>

      {items.length ? (
        <div className={isMasteredPanel ? "collection-list" : "library-table"}>
          {items.map((item) => (
            <article className={isMasteredPanel ? "mini-card" : "library-row"} key={item.id}>
              {isMasteredPanel ? (
                <label className="select-row">
                  <input type="checkbox" checked={selection.includes(item.id)} onChange={() => onToggle(item.id)} />
                  <span lang={item.language === "en" ? "en" : "th"}>{item.targetText}</span>
                </label>
              ) : (
                <span className="library-thai" lang={item.language === "en" ? "en" : "th"}>
                  {item.targetText}
                </span>
              )}
              <p className="library-romanization">{item.romanization ? `[${item.romanization}]` : item.explanation || "口语表达"}</p>
              <p className="library-chinese">（{item.chinese}）</p>
              <div className="mini-actions">
                <button
                  className="icon-action small"
                  type="button"
                  disabled={!speechSupported}
                  title={speechSupported ? "播放发音" : "当前浏览器没有可用朗读功能"}
                  onClick={() => onSpeak(item)}
                >
                  ▶
                </button>
                <button className="secondary-button compact" type="button" onClick={() => onRemoveOne(item.id)}>
                  移除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
    </section>
  );
}

function AdminApp() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(() => loadJson(SESSION_KEY, null));
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [activeRequestId, setActiveRequestId] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  useEffect(() => {
    document.body.classList.remove("thai-theme");
    document.body.classList.add("english-theme");
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    ensureFreshAdminSession(session).then((nextSession) => {
      if (!nextSession) return;
      if (nextSession.user?.email === ADMIN_EMAIL) loadAdminRequests(nextSession);
    });
  }, []);

  async function ensureFreshAdminSession(activeSession = session) {
    if (!activeSession?.access_token) return null;
    try {
      const userSession = await withAuthUser(activeSession);
      const expiresAt = Number(userSession.expires_at || 0);
      const shouldRefresh = expiresAt && expiresAt < Math.floor(Date.now() / 1000) + 60;
      const nextSession = shouldRefresh ? await withAuthUser(await refreshSession(userSession)) : userSession;
      setSession(nextSession);
      saveJson(SESSION_KEY, nextSession);
      return nextSession;
    } catch (error) {
      if (isExpiredAuthError(error)) {
        setSession(null);
        localStorage.removeItem(SESSION_KEY);
        setRequests([]);
        setStatus("登录已过期，请重新登录后台。");
        return null;
      }
      throw error;
    }
  }

  async function login(event) {
    event.preventDefault();
    setStatus("正在登录后台...");
    try {
      const payload = await signIn(email.trim(), password);
      const nextSession = await withAuthUser(payload.access_token ? payload : payload.session);
      setSession(nextSession);
      saveJson(SESSION_KEY, nextSession);
      if (nextSession.user?.email !== ADMIN_EMAIL) {
        setStatus("此账号没有后台权限。");
        return;
      }
      setStatus("后台已登录。");
      await loadAdminRequests(nextSession);
    } catch (error) {
      setStatus(humanizeAuthError(error.message));
    }
  }

  async function loadAdminRequests(activeSession = session) {
    if (!activeSession?.access_token) return;
    try {
      const nextSession = await ensureFreshAdminSession(activeSession);
      if (!nextSession) return;
      const rows = await fetchPronunciationRequests(nextSession);
      setRequests(rows);
      setStatus(rows.length ? `已加载 ${rows.length} 条纠音请求。` : "暂无纠音请求。");
    } catch (error) {
      if (isExpiredAuthError(error)) {
        setSession(null);
        localStorage.removeItem(SESSION_KEY);
        setRequests([]);
        setStatus("登录已过期，请重新登录后台。");
        return;
      }
      setStatus(error.message);
    }
  }

  async function completeRequest(event) {
    event.preventDefault();
    if (!activeRequestId) {
      setStatus("请选择一条纠音请求。");
      return;
    }
    if (!audioFile) {
      setStatus("请先上传录音文件。");
      return;
    }
    setStatus("正在上传录音...");
    try {
      const nextSession = await ensureFreshAdminSession(session);
      if (!nextSession) return;
      const audio = await uploadPronunciationAudio(nextSession, activeRequestId, audioFile);
      await updatePronunciationRequest(nextSession, activeRequestId, {
        status: "done",
        feedback_text: feedbackText,
        audio_url: audio.publicUrl,
        audio_path: audio.path,
        reviewed_at: new Date().toISOString()
      });
      setStatus("已完成纠音反馈。");
      setActiveRequestId("");
      setFeedbackText("");
      setAudioFile(null);
      await loadAdminRequests(nextSession);
    } catch (error) {
      if (isExpiredAuthError(error)) {
        setSession(null);
        localStorage.removeItem(SESSION_KEY);
        setRequests([]);
        setStatus("登录已过期，请重新登录后台。");
        return;
      }
      setStatus(error.message);
    }
  }

  function logout() {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
    setRequests([]);
    setStatus("已退出后台。");
  }

  return (
    <div className="app-shell english-app admin-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <FlagLogo language="en" />
          <div>
            <p className="eyebrow">English Speaking Helper · Admin</p>
            <h1>真人纠音后台</h1>
          </div>
        </div>
        <a className="admin-link" href="/">
          返回前台
        </a>
      </header>

      {!isAdmin ? (
        <section className="tool-panel admin-login">
          <p className="section-label">管理员登录</p>
          <h2>仅 admin@example.com 可进入</h2>
          <form className="auth-form" onSubmit={login}>
            <input value={email} placeholder="管理员邮箱" onChange={(event) => setEmail(event.target.value)} />
            <input value={password} placeholder="密码" type="password" onChange={(event) => setPassword(event.target.value)} />
            <button className="primary-button compact" type="submit">
              登录后台
            </button>
          </form>
          {status ? <p className="auth-status info">{status}</p> : null}
        </section>
      ) : (
        <main className="admin-grid">
          <section className="tool-panel">
            <div className="panel-head">
              <div>
                <p className="section-label">纠音工单</p>
                <h2>用户提交的句子</h2>
              </div>
              <div className="toolbar">
                <button className="secondary-button compact" type="button" onClick={() => loadAdminRequests(session)}>
                  刷新
                </button>
                <button className="secondary-button compact" type="button" onClick={logout}>
                  退出
                </button>
              </div>
            </div>
            {requests.length ? (
              <div className="admin-request-list">
                {requests.map((request) => (
                  <button
                    className={activeRequestId === request.id ? "admin-request active" : "admin-request"}
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setActiveRequestId(request.id);
                      setFeedbackText(request.feedback_text || "");
                    }}
                  >
                    <strong>{request.status === "done" ? "已纠音" : "待纠音"}</strong>
                    <span>{request.sentence}</span>
                    <small>{request.user_email || "未知用户"}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无纠音请求。</div>
            )}
          </section>

          <section className="tool-panel">
            <p className="section-label">上传反馈</p>
            <h2>录音与文字建议</h2>
            <form className="admin-feedback-form" onSubmit={completeRequest}>
              <textarea value={feedbackText} placeholder="可选：填写文字反馈，比如重音、连读、替代表达" onChange={(event) => setFeedbackText(event.target.value)} />
              <input accept="audio/*" type="file" onChange={(event) => setAudioFile(event.target.files?.[0] || null)} />
              <button className="primary-button compact" type="submit" disabled={!activeRequestId}>
                提交完成
              </button>
            </form>
            {status ? <p className="auth-status info">{status}</p> : null}
          </section>
        </main>
      )}
    </div>
  );
}

function Root() {
  return window.location.pathname === "/admin" ? <AdminApp /> : <App />;
}

createRoot(document.getElementById("root")).render(<Root />);
