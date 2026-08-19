import { DATA_MODE, getSupabaseClient } from "./supabaseClient.js";

const COURSE_CHANGED_EVENT = "nongsim-course-changed";
const COURSES_KEY = "nongsim-courses-v3";
const ACTIVE_COURSE_KEY = "nongsim-course-v3";
const COURSE_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const REALTIME_DEBOUNCE_MS = 180;
const FOLLOWUP_DEMO_BROADCAST_EVENT = "followup-demo-notification";

function normalizeCourseCode(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return normalizedCode
    && normalizedCode.length <= 64
    && COURSE_CODE_PATTERN.test(normalizedCode)
    ? normalizedCode
    : "";
}

function followupDemoTopic(code) {
  return `nongsim-followup-${code}`;
}

function callOnChange(onChange, code, detail) {
  Promise.resolve(onChange(code, detail)).catch((error) => {
    console.error("Realtime 변경 반영에 실패했습니다.", error);
  });
}

export function notifyCourseChanged(code) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COURSE_CHANGED_EVENT, { detail: { code } }));
}

export function subscribeCourse(code, onChange) {
  if (typeof window === "undefined") return () => {};

  if (DATA_MODE === "supabase") {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode || normalizedCode.length > 64 || !COURSE_CODE_PATTERN.test(normalizedCode)) {
      queueMicrotask(() => callOnChange(onChange, normalizedCode, {
        type: "status",
        status: "CHANNEL_ERROR",
        error: new Error("Realtime filter contains an invalid course code."),
      }));
      return () => {};
    }

    const clientResult = getSupabaseClient();
    if (!clientResult.ok) {
      queueMicrotask(() => callOnChange(onChange, normalizedCode, {
        type: "status",
        status: "CHANNEL_ERROR",
        error: new Error(clientResult.error),
      }));
      return () => {};
    }

    const client = clientResult.client;
    const channelName = `nongsim-course-${normalizedCode}-${crypto.randomUUID()}`;
    const filter = `course_code=eq.${normalizedCode}`;
    const courseFilter = `code=eq.${normalizedCode}`;
    let debounceTimer = null;
    let disposed = false;

    const handleDatabaseChange = (payload) => {
      if (disposed) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!disposed) callOnChange(onChange, normalizedCode, {
          type: "change",
          table: payload.table,
          eventType: payload.eventType,
        });
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = client
      .channel(channelName)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "courses",
        filter: courseFilter,
      }, handleDatabaseChange)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "rounds",
        filter,
      }, handleDatabaseChange)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "round_items",
        filter,
      }, handleDatabaseChange)
      .subscribe((status, error) => {
        if (disposed) return;
        if (error || ["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          console.error(`Realtime channel ${status}`, error);
        }
        callOnChange(onChange, normalizedCode, { type: "status", status, error });
      });

    return () => {
      disposed = true;
      clearTimeout(debounceTimer);
      void client.removeChannel(channel).catch((error) => {
        console.error("Realtime 채널을 제거하지 못했습니다.", error);
      });
    };
  }

  const handleCourseChange = (event) => {
    if (!event.detail?.code || event.detail.code === code) {
      callOnChange(onChange, event.detail?.code || code, { type: "change", source: "local" });
    }
  };
  const handleStorage = (event) => {
    if (event.key === COURSES_KEY || event.key === ACTIVE_COURSE_KEY) {
      callOnChange(onChange, code, { type: "change", source: "storage" });
    }
  };

  window.addEventListener(COURSE_CHANGED_EVENT, handleCourseChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(COURSE_CHANGED_EVENT, handleCourseChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function broadcastFollowupDemoNotification(code, payload, dependencies = {}) {
  const dataMode = dependencies.dataMode ?? DATA_MODE;
  if (dataMode !== "supabase") return { ok: true, source: "local" };

  const normalizedCode = normalizeCourseCode(code);
  if (!normalizedCode) return { ok: false, error: "Invalid course code." };

  const clientResult = dependencies.getClient?.() ?? getSupabaseClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.client;
  const channel = client.channel(followupDemoTopic(normalizedCode));
  try {
    const status = await channel.send({
      type: "broadcast",
      event: FOLLOWUP_DEMO_BROADCAST_EVENT,
      payload: { ...payload, courseCode: normalizedCode },
    });
    return status === "ok"
      ? { ok: true, source: "supabase" }
      : { ok: false, error: `Realtime broadcast returned ${status}.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    void client.removeChannel(channel).catch((error) => {
      console.error("사후조사 알림 채널을 제거하지 못했습니다.", error);
    });
  }
}

export function subscribeFollowupDemoNotification(code, onNotification, dependencies = {}) {
  const dataMode = dependencies.dataMode ?? DATA_MODE;
  if (dataMode !== "supabase") return () => {};

  const normalizedCode = normalizeCourseCode(code);
  if (!normalizedCode) return () => {};

  const clientResult = dependencies.getClient?.() ?? getSupabaseClient();
  if (!clientResult.ok) return () => {};

  const client = clientResult.client;
  let disposed = false;
  const channel = client
    .channel(followupDemoTopic(normalizedCode))
    .on("broadcast", { event: FOLLOWUP_DEMO_BROADCAST_EVENT }, (message) => {
      const payload = message?.payload ?? message;
      if (disposed || payload?.courseCode !== normalizedCode) return;
      Promise.resolve(onNotification(payload)).catch((error) => {
        console.error("사후조사 알림을 화면에 반영하지 못했습니다.", error);
      });
    })
    .subscribe((status, error) => {
      if (disposed || (!error && !["CHANNEL_ERROR", "TIMED_OUT"].includes(status))) return;
      console.error(`사후조사 알림 Realtime 채널 ${status}`, error);
    });

  return () => {
    disposed = true;
    void client.removeChannel(channel).catch((error) => {
      console.error("사후조사 알림 채널을 제거하지 못했습니다.", error);
    });
  };
}
