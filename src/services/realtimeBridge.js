const COURSE_CHANGED_EVENT = "nongsim-course-changed";
const COURSES_KEY = "nongsim-courses-v3";
const ACTIVE_COURSE_KEY = "nongsim-course-v3";

export function notifyCourseChanged(code) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COURSE_CHANGED_EVENT, { detail: { code } }));
}

export function subscribeCourse(code, onChange) {
  if (typeof window === "undefined") return () => {};

  const handleCourseChange = (event) => {
    if (!event.detail?.code || event.detail.code === code) onChange(event.detail?.code || code);
  };
  const handleStorage = (event) => {
    if (event.key === COURSES_KEY || event.key === ACTIVE_COURSE_KEY) onChange(code);
  };

  window.addEventListener(COURSE_CHANGED_EVENT, handleCourseChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(COURSE_CHANGED_EVENT, handleCourseChange);
    window.removeEventListener("storage", handleStorage);
  };
}
