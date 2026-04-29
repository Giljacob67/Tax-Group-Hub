function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export function normalizeServiceUrl(
  rawUrl: string,
  options?: {
    allowPrivateEnvVar?: string;
    label?: string;
  },
): string {
  const trimmed = rawUrl.trim();
  const label = options?.label || "URL";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} invalida. Use o formato: http://host:porta`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} invalida. Use apenas http ou https.`);
  }

  if (
    isPrivateHostname(parsed.hostname) &&
    options?.allowPrivateEnvVar &&
    process.env[options.allowPrivateEnvVar] !== "true"
  ) {
    throw new Error(
      `Seguranca: URLs de rede privada/local nao sao permitidas por padrao para ${label}.`,
    );
  }

  return trimmed.replace(/\/+$/, "");
}

