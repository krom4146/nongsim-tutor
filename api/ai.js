import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { ZodError } from "zod";
import {
  createInputHash,
  createServerSupabaseClient,
  findActiveCourse,
  findCachedAnalysis,
  saveAnalysis,
} from "../server/ai/aiPersistence.js";
import {
  hasJsonContentType,
  isAllowedOrigin,
  readJsonBody,
  RequestSecurityError,
} from "../server/ai/security.js";
import { getAiTaskDefinition } from "../server/ai/taskRegistry.js";

const ALLOWED_REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh"]);
const ALLOWED_IMAGE_DETAILS = new Set(["low", "high", "original", "auto"]);
const SAFE_ERROR_MESSAGES = {
  METHOD_NOT_ALLOWED: "POST 요청만 지원합니다.",
  UNSUPPORTED_MEDIA_TYPE: "Content-Type은 application/json이어야 합니다.",
  INVALID_TASK: "지원하지 않는 AI 작업입니다.",
  PAYLOAD_TOO_LARGE: "요청 데이터가 허용 크기를 초과했습니다.",
  INVALID_PAYLOAD: "요청 데이터가 올바르지 않습니다.",
  COURSE_NOT_FOUND: "활성 과정을 찾을 수 없습니다.",
  INSUFFICIENT_DATA: "분석할 입력 데이터가 부족합니다.",
  RATE_LIMITED: "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  QUOTA_EXCEEDED: "AI 사용 한도에 도달했습니다. 관리자에게 문의해 주세요.",
  MODEL_REFUSAL: "요청 내용을 안전하게 분석할 수 없습니다.",
  INCOMPLETE_OUTPUT: "AI 분석 결과가 완성되지 않았습니다. 다시 시도해 주세요.",
  TIMEOUT: "AI 분석 시간이 초과되었습니다. 다시 시도해 주세요.",
  UPSTREAM_ERROR: "AI 분석 서비스에 일시적인 문제가 있습니다.",
  SERVER_MISCONFIGURED: "AI 서버 설정을 확인해 주세요.",
};

class SafeHttpError extends Error {
  constructor(code, status) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "SafeHttpError";
    this.code = code;
    this.status = status;
  }
}

function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function safeLog(level, details) {
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer(JSON.stringify({ event: "ai_request", ...details }));
}

function getServerConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = String(process.env.OPENAI_MODEL || "").trim();
  const reasoningEffort = String(process.env.OPENAI_REASONING_EFFORT || "").trim().toLowerCase() || null;
  const imageDetail = String(process.env.OPENAI_IMAGE_DETAIL || "").trim().toLowerCase() || null;
  if (!apiKey || !model) throw new SafeHttpError("SERVER_MISCONFIGURED", 500);
  if (reasoningEffort && !ALLOWED_REASONING_EFFORTS.has(reasoningEffort)) {
    throw new SafeHttpError("SERVER_MISCONFIGURED", 500);
  }
  if (imageDetail && !ALLOWED_IMAGE_DETAILS.has(imageDetail)) {
    throw new SafeHttpError("SERVER_MISCONFIGURED", 500);
  }
  return { apiKey, model, reasoningEffort, imageDetail };
}

function findRefusal(response) {
  return response.output?.some((item) => item.type === "message"
    && item.content?.some((content) => content.type === "refusal"));
}

function mapOpenAiError(error) {
  if (error?.name === "APIConnectionTimeoutError"
    || error?.name === "APIUserAbortError"
    || error?.name === "AbortError"
    || error?.code === "ETIMEDOUT") {
    return new SafeHttpError("TIMEOUT", 504);
  }
  if (error?.name === "LengthFinishReasonError") {
    return new SafeHttpError("INCOMPLETE_OUTPUT", 502);
  }
  if (error?.name === "ContentFilterFinishReasonError") {
    return new SafeHttpError("MODEL_REFUSAL", 422);
  }
  if (error?.status === 429) {
    const isQuotaError = error?.code === "insufficient_quota" || error?.type === "insufficient_quota";
    return new SafeHttpError(isQuotaError ? "QUOTA_EXCEEDED" : "RATE_LIMITED", 429);
  }
  if (error?.status === 401
    || error?.status === 403
    || error?.code === "invalid_api_key"
    || error?.code === "model_not_found") {
    return new SafeHttpError("SERVER_MISCONFIGURED", 500);
  }
  return new SafeHttpError("UPSTREAM_ERROR", 502);
}

function successBody({ data, source, persisted, model, promptVersion, requestId, warning }) {
  return {
    ok: true,
    data,
    meta: {
      mode: "ai",
      source,
      persisted,
      model,
      promptVersion,
      requestId,
    },
    ...(warning ? { warning } : {}),
  };
}

export async function handleAiRequest(req, res, dependencies = {}) {
  const now = dependencies.now || Date.now;
  const logAiEvent = dependencies.logAiEvent || safeLog;
  const startedAt = now();
  const requestId = randomUUID();
  let task = null;
  let model = null;
  let promptVersion = null;

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      throw new SafeHttpError("METHOD_NOT_ALLOWED", 405);
    }
    if (!hasJsonContentType(req)) throw new SafeHttpError("UNSUPPORTED_MEDIA_TYPE", 415);

    const body = await readJsonBody(req);
    if (!isAllowedOrigin(req)) throw new SafeHttpError("INVALID_PAYLOAD", 403);
    const taskDefinition = getAiTaskDefinition(body?.task);
    if (!taskDefinition) throw new SafeHttpError("INVALID_TASK", 400);
    task = taskDefinition.task;
    promptVersion = taskDefinition.promptVersion;
    if (taskDefinition.isExplicitlyEmpty(body?.payload)) {
      throw new SafeHttpError("INSUFFICIENT_DATA", 422);
    }

    let normalized;
    try {
      normalized = taskDefinition.normalizeRequest(body);
    } catch (error) {
      if (error instanceof ZodError) throw new SafeHttpError("INVALID_PAYLOAD", 422);
      if (error?.message === "SUPABASE_SERVER_CONFIG_MISSING") {
        throw new SafeHttpError("SERVER_MISCONFIGURED", 500);
      }
      if (error?.message === "INVALID_BOARD_IMAGE_URL") {
        throw new SafeHttpError("INVALID_PAYLOAD", 422);
      }
      throw error;
    }
    task = normalized.task;
    if (!taskDefinition.hasSufficientData(normalized.payload)) {
      throw new SafeHttpError("INSUFFICIENT_DATA", 422);
    }

    const config = getServerConfig();
    if (task === "boardAnalysis" && !config.imageDetail) {
      throw new SafeHttpError("SERVER_MISCONFIGURED", 500);
    }
    model = config.model;
    let supabase;
    try {
      supabase = dependencies.supabase || createServerSupabaseClient();
    } catch {
      throw new SafeHttpError("SERVER_MISCONFIGURED", 500);
    }

    let activeCourse;
    try {
      activeCourse = await (dependencies.findActiveCourse || findActiveCourse)(supabase, normalized.courseCode);
    } catch {
      throw new SafeHttpError("UPSTREAM_ERROR", 502);
    }
    if (!activeCourse) throw new SafeHttpError("COURSE_NOT_FOUND", 404);

    const inputHash = createInputHash(normalized.payload);
    const cacheKey = {
      courseCode: normalized.courseCode,
      task,
      inputHash,
      promptVersion,
      model,
    };

    let cached = null;
    try {
      cached = await (dependencies.findCachedAnalysis || findCachedAnalysis)(supabase, cacheKey);
    } catch {
      throw new SafeHttpError("UPSTREAM_ERROR", 502);
    }
    if (cached) {
      const parsedCache = taskDefinition.outputSchema.safeParse(cached.result);
      if (parsedCache.success) {
        try {
          const data = taskDefinition.projectResult(parsedCache.data, normalized.payload, cached.created_at);
          logAiEvent("info", {
            requestId,
            openAiRequestId: cached.openai_request_id || null,
            task,
            model,
            promptVersion,
            source: "cache",
            inputTokens: cached.input_tokens ?? null,
            outputTokens: cached.output_tokens ?? null,
            durationMs: now() - startedAt,
          });
          return jsonResponse(res, 200, successBody({
            data,
            source: "cache",
            persisted: true,
            model,
            promptVersion,
            requestId,
          }));
        } catch {
          cached = null;
        }
      }
    }

    const openai = dependencies.openai || new OpenAI({ apiKey: config.apiKey, timeout: 25_000, maxRetries: 2 });
    let response;
    const openAiAbortController = new AbortController();
    const openAiTimeoutId = setTimeout(() => openAiAbortController.abort(), 25_000);
    try {
      response = await openai.responses.parse(taskDefinition.buildOpenAiRequest({
        model,
        reasoningEffort: config.reasoningEffort,
        imageDetail: task === "boardAnalysis" ? config.imageDetail : null,
        courseCode: normalized.courseCode,
        payload: normalized.payload,
      }), { signal: openAiAbortController.signal });
    } catch (error) {
      throw mapOpenAiError(error);
    } finally {
      clearTimeout(openAiTimeoutId);
    }

    if (findRefusal(response)) throw new SafeHttpError("MODEL_REFUSAL", 422);
    if (response.status === "incomplete") throw new SafeHttpError("INCOMPLETE_OUTPUT", 502);
    if (!response.output_parsed) throw new SafeHttpError("INCOMPLETE_OUTPUT", 502);

    const parsedOutput = taskDefinition.outputSchema.safeParse(response.output_parsed);
    if (!parsedOutput.success) throw new SafeHttpError("INCOMPLETE_OUTPUT", 502);

    let data;
    try {
      taskDefinition.validateEvidence(parsedOutput.data, normalized.payload);
      data = taskDefinition.projectResult(parsedOutput.data, normalized.payload);
    } catch {
      throw new SafeHttpError("INCOMPLETE_OUTPUT", 502);
    }

    const inputTokens = response.usage?.input_tokens ?? null;
    const outputTokens = response.usage?.output_tokens ?? null;
    const openAiRequestId = response._request_id || null;
    let persisted = false;
    let warning = null;

    try {
      const saved = await (dependencies.saveAnalysis || saveAnalysis)(supabase, {
        ...cacheKey,
        result: parsedOutput.data,
        reasoningEffort: config.reasoningEffort,
        inputTokens,
        outputTokens,
        openAiRequestId,
      });
      persisted = saved.ok;
      if (saved.ok && saved.createdAt) data.generatedAt = saved.createdAt;
      if (saved.duplicate) {
        const racedCache = await (dependencies.findCachedAnalysis || findCachedAnalysis)(supabase, cacheKey);
        const parsedRacedCache = taskDefinition.outputSchema.safeParse(racedCache?.result);
        if (parsedRacedCache.success) {
          try {
            taskDefinition.validateEvidence(parsedRacedCache.data, normalized.payload);
            data = taskDefinition.projectResult(parsedRacedCache.data, normalized.payload, racedCache.created_at);
            persisted = true;
          } catch {
            persisted = false;
          }
        }
      }
    } catch {
      persisted = false;
    }

    if (!persisted) {
      warning = {
        code: "RESULT_NOT_SAVED",
        message: "분석은 완료됐지만 결과가 저장되지 않았습니다.",
      };
    }

    logAiEvent("info", {
      requestId,
      openAiRequestId,
      task,
      model,
      promptVersion,
      source: "live",
      persisted,
      inputTokens,
      outputTokens,
      durationMs: now() - startedAt,
    });
    return jsonResponse(res, 200, successBody({
      data,
      source: "live",
      persisted,
      model,
      promptVersion,
      requestId,
      warning,
    }));
  } catch (error) {
    const safeError = error instanceof SafeHttpError
      ? error
      : error instanceof RequestSecurityError
        ? new SafeHttpError(error.code, error.code === "PAYLOAD_TOO_LARGE" ? 413 : 422)
        : new SafeHttpError("UPSTREAM_ERROR", 502);
    logAiEvent(safeError.status >= 500 ? "error" : "warn", {
      requestId,
      task,
      model,
      promptVersion,
      errorCode: safeError.code,
      durationMs: now() - startedAt,
    });
    return jsonResponse(res, safeError.status, {
      ok: false,
      error: {
        code: safeError.code,
        message: SAFE_ERROR_MESSAGES[safeError.code],
        requestId,
      },
    });
  }
}

export default async function handler(req, res) {
  return handleAiRequest(req, res);
}
