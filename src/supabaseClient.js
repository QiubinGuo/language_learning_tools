const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const AUTH_REDIRECT_URL = import.meta.env.VITE_AUTH_REDIRECT_URL || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function headers(session) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

async function supabaseFetch(path, options = {}) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers(options.session),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }
  if (!response.ok) {
    const details =
      data?.error_description || data?.msg || data?.message || data?.error || data?.code || text || `HTTP ${response.status}`;
    if (details.includes("public.pronunciation_requests") || details.includes("pronunciation_requests")) {
      throw new Error("真人纠音功能还未初始化，请先在 Supabase 执行 Pronunciation correction setup 的 SQL。");
    }
    throw new Error(details);
  }
  return data;
}

export async function signUp(email, password) {
  const redirectTo = AUTH_REDIRECT_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
  return supabaseFetch(`/auth/v1/signup${query}`, {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function consumeAuthRedirect() {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const expiresIn = Number(params.get("expires_in") || 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: params.get("token_type") || "bearer",
    user: null
  };
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return session;
}

export async function signIn(email, password) {
  return supabaseFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function refreshSession(session) {
  if (!session?.refresh_token) throw new Error("请重新登录。");
  return supabaseFetch("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
}

export async function fetchAuthUser(session) {
  return supabaseFetch("/auth/v1/user", {
    method: "GET",
    session
  });
}

export async function fetchCloudPhrases(session) {
  return supabaseFetch("/rest/v1/user_phrases?select=*&order=created_at.desc", {
    method: "GET",
    session
  });
}

export async function upsertCloudPhrase(session, phrase, state) {
  return supabaseFetch("/rest/v1/user_phrases?on_conflict=user_id,phrase_key", {
    method: "POST",
    session,
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      phrase_key: phrase.id,
      thai: phrase.thai,
      romanization: phrase.romanization,
      chinese: phrase.chinese,
      in_library: Boolean(state.inLibrary),
      mastered: Boolean(state.mastered)
    })
  });
}

export async function patchCloudPhrase(session, phraseKey, state) {
  const query = encodeURIComponent(phraseKey);
  return supabaseFetch(`/rest/v1/user_phrases?phrase_key=eq.${query}`, {
    method: "PATCH",
    session,
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(state)
  });
}

export async function fetchPronunciationRequests(session) {
  return supabaseFetch("/rest/v1/pronunciation_requests?select=*&order=created_at.desc", {
    method: "GET",
    session
  });
}

export async function createPronunciationRequest(session, request) {
  return supabaseFetch("/rest/v1/pronunciation_requests", {
    method: "POST",
    session,
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      sentence: request.sentence,
      note: request.note || "",
      user_email: session?.user?.email || null
    })
  });
}

export async function updatePronunciationRequest(session, id, updates) {
  return supabaseFetch(`/rest/v1/pronunciation_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    session,
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(updates)
  });
}

export async function uploadPronunciationAudio(session, requestId, file) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  const safeName = file.name.replace(/[^\w.-]+/g, "-");
  const path = `admin/${requestId}-${Date.now()}-${safeName}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/pronunciation-feedback/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
      "Content-Type": file.type || "audio/mpeg",
      "x-upsert": "true"
    },
    body: file
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || text || "Audio upload failed");
  }
  return {
    path,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/pronunciation-feedback/${path}`
  };
}
