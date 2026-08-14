import { DATA_MODE, getSupabaseClient } from "./supabaseClient.js";

const COURSE_CHANGED_EVENT = "nongsim-course-changed";
const COURSES_KEY = "nongsim-courses-v3";
const ACTIVE_COURSE_KEY = "nongsim-course-v3";
const COURSE_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const REALTIME_DEBOUNCE_MS = 180;

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
