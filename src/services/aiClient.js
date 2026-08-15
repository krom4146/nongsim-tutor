const env = import.meta.env ?? {};
const SUPPORTED_AI_MODES = new Set(["live", "mock"]);

const CLIENT_ERROR_MESSAGES = {
  INVALID_TASK: "지원하지 않는 AI 작업입니다.",
  INVALID_PAYLOAD: "입력 내용을 확인한 뒤 다시 시도해 주세요.",
  COURSE_NOT_FOUND: "현재 과정을 확인할 수 없습니다. 다시 입장해 주세요.",
  INSUFFICIENT_DATA: "AI로 정리할 답변이 부족합니다.",
  RATE_LIMITED: "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  QUOTA_EXCEEDED: "AI 사용 한도에 도달했습니다. 관리자에게 문의해 주세요.",
  MODEL_REFUSAL: "입력 내용을 안전하게 정리할 수 없습니다. 민감정보를 제외하고 다시 작성해 주세요.",
  INCOMPLETE_OUTPUT: "AI 정리 결과가 완성되지 않았습니다. 다시 시도해 주세요.",
  TIMEOUT: "AI 응답 시간이 초과되었습니다. 다시 시도해 주세요.",
  UPSTREAM_ERROR: "AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
  SERVER_MISCONFIGURED: "AI 서버 설정을 확인해 주세요.",
};

export const AI_MODE = env.VITE_AI_MODE;

export class AIServiceError extends Error {
  constructor(code, message, requestId = null) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.requestId = requestId;
  }
}

export function getAIConfigurationError() {
  return SUPPORTED_AI_MODES.has(AI_MODE)
    ? null
    : "VITE_AI_MODE를 'live' 또는 'mock'으로 설정해 주세요.";
}

async function parseResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new AIServiceError("INVALID_SERVER_RESPONSE", "AI 서버 응답을 확인할 수 없습니다.");
  }

  if (!response.ok || !body?.ok) {
    const code = body?.error?.code || "AI_REQUEST_FAILED";
    throw new AIServiceError(
      code,
      CLIENT_ERROR_MESSAGES[code] || body?.error?.message || "AI 요청을 완료하지 못했습니다.",
      body?.error?.requestId || null,
    );
  }
  return body;
}

export async function requestAI(requestBody, options = {}) {
  const configurationError = getAIConfigurationError();
  if (configurationError) throw new AIServiceError("AI_CLIENT_MISCONFIGURED", configurationError);
  if (AI_MODE !== "live") {
    throw new AIServiceError("AI_MODE_NOT_LIVE", "현재 AI 모드는 실제 서버 호출로 설정되어 있지 않습니다.");
  }

  const {
    signal,
    timeoutMs = 30_000,
    fetchImpl = fetch,
  } = options;
  if (signal?.aborted) throw new AIServiceError("REQUEST_CANCELLED", "AI 요청이 취소되었습니다.");

  const controller = new AbortController();
  let timedOut = false;
  let cancelledByCaller = false;
  const cancelFromCaller = () => {
    cancelledByCaller = true;
    controller.abort();
  };
  signal?.addEventListener("abort", cancelFromCaller, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const body = await parseResponse(response);
    return {
      ...body.data,
      meta: body.meta,
      warning: body.warning || null,
    };
  } catch (error) {
    if (timedOut) {
      throw new AIServiceError("TIMEOUT", CLIENT_ERROR_MESSAGES.TIMEOUT);
    }
    if (cancelledByCaller || error?.name === "AbortError") {
      throw new AIServiceError("REQUEST_CANCELLED", "AI 요청이 취소되었습니다.");
    }
    if (error instanceof AIServiceError) throw error;
    throw new AIServiceError("NETWORK_ERROR", "AI 서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", cancelFromCaller);
  }
}
