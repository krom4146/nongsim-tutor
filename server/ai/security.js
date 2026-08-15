export const MAX_REQUEST_BYTES = 64 * 1024;

// Server-only request guards shared by the common AI proxy.

export class RequestSecurityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RequestSecurityError";
    this.code = code;
  }
}

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : String(value || "").split(",")[0].trim();
}

function normalizeConfiguredOrigins(value) {
  return new Set(String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/u, ""))
    .filter(Boolean));
}

export function isAllowedOrigin(req, configuredOrigins = process.env.AI_ALLOWED_ORIGINS) {
  const originHeader = firstHeaderValue(req.headers?.origin);
  if (!originHeader) return false;

  let origin;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }

  const normalizedOrigin = origin.origin.replace(/\/$/u, "");
  const allowedOrigins = normalizeConfiguredOrigins(configuredOrigins);
  if (allowedOrigins.has(normalizedOrigin)) return true;

  const requestHost = firstHeaderValue(req.headers?.["x-forwarded-host"] || req.headers?.host);
  if (requestHost && origin.host === requestHost) {
    return origin.protocol === "https:"
      || (origin.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/u.test(requestHost));
  }

  const vercelHost = String(process.env.VERCEL_URL || "").trim();
  if (vercelHost && normalizedOrigin === `https://${vercelHost}`) return true;

  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  return !isProduction
    && origin.protocol === "http:"
    && /^(localhost|127\.0\.0\.1)$/u.test(origin.hostname);
}

export function hasJsonContentType(req) {
  const contentType = firstHeaderValue(req.headers?.["content-type"]).toLowerCase();
  return contentType === "application/json" || contentType.startsWith("application/json;");
}

export function assertContentLength(req) {
  const contentLength = Number(firstHeaderValue(req.headers?.["content-length"]));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new RequestSecurityError("PAYLOAD_TOO_LARGE", "요청 데이터가 허용 크기를 초과했습니다.");
  }
}

export async function readJsonBody(req) {
  assertContentLength(req);

  if (req.body !== undefined && req.body !== null) {
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    if (raw.byteLength > MAX_REQUEST_BYTES) {
      throw new RequestSecurityError("PAYLOAD_TOO_LARGE", "요청 데이터가 허용 크기를 초과했습니다.");
    }
    try {
      return typeof req.body === "object" && !Buffer.isBuffer(req.body)
        ? req.body
        : JSON.parse(raw.toString("utf8"));
    } catch {
      throw new RequestSecurityError("INVALID_PAYLOAD", "요청 형식이 올바르지 않습니다.");
    }
  }

  const chunks = [];
  let byteLength = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > MAX_REQUEST_BYTES) {
      throw new RequestSecurityError("PAYLOAD_TOO_LARGE", "요청 데이터가 허용 크기를 초과했습니다.");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestSecurityError("INVALID_PAYLOAD", "요청 형식이 올바르지 않습니다.");
  }
}
