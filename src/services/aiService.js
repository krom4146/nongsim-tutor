const env = import.meta.env ?? {};
const SUPPORTED_AI_MODES = new Set(["live", "mock"]);

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

export function buildGoalCohortRequest(course, classInfo) {
  const goals = (course.goals || [])
    .filter((goal) => typeof goal.text === "string" && goal.text.trim())
    .map((goal, index) => ({
      sourceId: `goal-${String(index + 1).padStart(2, "0")}`,
      text: goal.text.trim(),
    }));

  return {
    task: "goalCohort",
    courseCode: course.code,
    payload: {
      classId: classInfo?.id || null,
      className: classInfo?.name || null,
      goals,
    },
  };
}

async function parseResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    throw new AIServiceError("INVALID_SERVER_RESPONSE", "AI 서버 응답을 확인할 수 없습니다.");
  }

  if (!response.ok || !body?.ok) {
    throw new AIServiceError(
      body?.error?.code || "AI_REQUEST_FAILED",
      body?.error?.message || "AI 분석을 완료하지 못했습니다.",
      body?.error?.requestId || null,
    );
  }
  return body;
}

export async function requestGoalCohortAnalysis(course, classInfo) {
  const configurationError = getAIConfigurationError();
  if (configurationError) throw new AIServiceError("AI_CLIENT_MISCONFIGURED", configurationError);
  if (AI_MODE !== "live") {
    throw new AIServiceError("AI_MODE_NOT_LIVE", "현재 AI 모드는 실제 서버 호출로 설정되어 있지 않습니다.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGoalCohortRequest(course, classInfo)),
      signal: controller.signal,
    });
    const body = await parseResponse(response);
    return {
      ...body.data,
      meta: body.meta,
      warning: body.warning || null,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AIServiceError("TIMEOUT", "AI 분석 시간이 초과되었습니다. 다시 시도해 주세요.");
    }
    if (error instanceof AIServiceError) throw error;
    throw new AIServiceError("NETWORK_ERROR", "AI 서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
  } finally {
    clearTimeout(timeoutId);
  }
}
