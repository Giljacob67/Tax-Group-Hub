export type ApiAuthMode = "bearer" | "api-key";

export interface ApiSession {
  mode: ApiAuthMode;
  token: string;
  savedAt: string;
}

const STORAGE_KEY = "tax-group-hub.api-session";
let fetchInterceptorInstalled = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorageValue(): string | null {
  if (!isBrowser()) return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorageValue(value: string | null): void {
  if (!isBrowser()) return;

  try {
    if (value == null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Ignore storage failures in constrained browser contexts.
  }
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  if (!isBrowser()) return null;

  try {
    if (typeof input === "string") {
      return new URL(input, window.location.href);
    }

    if (input instanceof URL) {
      return input;
    }

    return new URL(input.url);
  } catch {
    return null;
  }
}

function shouldAttachAuth(url: URL): boolean {
  return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

export function loadApiSession(): ApiSession | null {
  const raw = readStorageValue();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ApiSession>;
    const mode = parsed.mode === "api-key" || parsed.mode === "bearer" ? parsed.mode : null;
    const token = typeof parsed.token === "string" ? parsed.token.trim() : "";
    const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : "";

    if (!mode || !token) return null;

    return { mode, token, savedAt };
  } catch {
    return null;
  }
}

export function saveApiSession(session: ApiSession): void {
  const normalized: ApiSession = {
    mode: session.mode,
    token: session.token.trim(),
    savedAt: session.savedAt,
  };

  writeStorageValue(JSON.stringify(normalized));
  if (isBrowser()) {
    window.dispatchEvent(new Event("tax-group-hub:api-session-changed"));
  }
}

export function clearApiSession(): void {
  writeStorageValue(null);
  if (isBrowser()) {
    window.dispatchEvent(new Event("tax-group-hub:api-session-changed"));
  }
}

export function applyApiSessionHeaders(headers: Headers): Headers {
  const session = loadApiSession();
  if (!session?.token) return headers;

  if (session.mode === "bearer") {
    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${session.token}`);
    }
  } else if (session.mode === "api-key") {
    if (!headers.has("x-api-key")) {
      headers.set("x-api-key", session.token);
    }
  }

  return headers;
}

export function installApiFetchInterceptor(): void {
  if (fetchInterceptorInstalled || !isBrowser() || typeof window.fetch !== "function") {
    return;
  }

  fetchInterceptorInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveRequestUrl(input);
    if (!url || !shouldAttachAuth(url)) {
      return nativeFetch(input, init);
    }

    const headers = mergeHeaders(
      input instanceof Request ? input.headers : undefined,
      init?.headers,
    );
    applyApiSessionHeaders(headers);

    return nativeFetch(input, {
      ...init,
      headers,
    });
  }) as typeof window.fetch;
}

