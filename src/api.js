const TOKEN_KEY = "openasstai.token";
export const LANGUAGE_KEY = "openasstai.language";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getLanguage() {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === "en" || stored === "zh-CN") return stored;
  if (stored === "zh") return "zh-CN";
  return "zh-CN";
}

export function setLanguagePreference(language) {
  localStorage.setItem(LANGUAGE_KEY, language === "en" ? "en" : "zh-CN");
}

export async function apiRequest(path, { token, method = "GET", headers = {}, body } = {}) {
  const requestHeaders = new Headers(headers);
  if (body !== undefined && body !== null) requestHeaders.set("Content-Type", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload;
}

export function formatMoney(cents = 0) {
  return `¥${(Number(cents || 0) / 100).toFixed(2)}`;
}

export function formatHours(hours = 0) {
  const value = Number(hours || 0);
  const language = getLanguage();
  if (value < 1) {
    const minutes = Math.round(value * 60);
    return language === "zh-CN" ? `${minutes} 分钟` : `${minutes}m`;
  }
  const hoursValue = value.toFixed(value >= 10 ? 0 : 1);
  return language === "zh-CN" ? `${hoursValue} 小时` : `${hoursValue}h`;
}

export function formatTime(value) {
  if (!value) return "—";
  const language = getLanguage();
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function statusTone(status = "") {
  const value = String(status).toLowerCase();
  if (["running", "active", "healthy", "enabled"].includes(value)) return "success";
  if (["stopped", "disabled", "draft"].includes(value)) return "muted";
  if (["warning", "waitlist", "degraded", "pending"].includes(value)) return "warning";
  if (["error", "destroyed", "offline", "archived", "rejected", "suspended"].includes(value)) return "danger";
  if (["approved"].includes(value)) return "success";
  return "neutral";
}

export function parseHashRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return { page: "market" };
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "instance" && parts[1]) return { page: "instance", id: parts[1] };
  if (parts[0] === "instances" && parts[1]) return { page: "instance", id: parts[1] };
  if (parts[0] === "instances") return { page: "instances" };
  if (parts[0] === "provider") return { page: "provider" };
  if (parts[0] === "admin") return { page: "admin" };
  if (parts[0] === "auth") return { page: "auth" };
  if (parts[0] === "agent-market") return { page: "agent-market" };
  if (parts[0] === "session" && parts[1]) return { page: "session", id: parts[1] };
  if (parts[0] === "sessions") return { page: "sessions" };
  return { page: parts[0] || "market" };
}

export function setRoute(path) {
  window.location.hash = `#/${path.replace(/^#\/?/, "")}`;
}
