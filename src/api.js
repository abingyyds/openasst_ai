const TOKEN_KEY = "openasstai.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
}

export function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
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
  return { page: parts[0] || "market" };
}

export function setRoute(path) {
  window.location.hash = `#/${path.replace(/^#\/?/, "")}`;
}
