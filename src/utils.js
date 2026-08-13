import { courseCodeRanges, courseTypes } from "./data.js";

export const now = () => new Date().toISOString();
export const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const generateParticipantId = () => uid("p");
export const generateReentryToken = () => Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[OI]/g, "7");

export function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addMonthsToDate(dateString, months = 2) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

export function getTransferDate(course) {
  return course.transferDate || addMonthsToDate(course.endDate, 2);
}

export function getCoursePhase(course) {
  const today = todayInKorea();
  if (today < course.startDate) return "before";
  if (today < course.endDate) return "active";
  if (today === course.endDate) return "completion";
  if (today < getTransferDate(course)) return "followupWait";
  return "transfer";
}

export function isCourseEnded(course) {
  return todayInKorea() > course.endDate;
}

export function generateCourseCode(type, courses) {
  const base = courseCodeRanges[type];
  const usedNumbers = courses
    .filter((course) => course.type === type)
    .map((course) => Number(String(course.code).replace(/\D/g, "")))
    .filter((number) => number > base && number < base + 1000);
  const nextNumber = usedNumbers.length ? Math.max(...usedNumbers) + 1 : base + 1;
  if (nextNumber >= base + 1000) throw new Error(`${courseTypes[type]} 코드 발급 범위를 모두 사용했습니다.`);
  return `NH-${nextNumber}`;
}

export function generateParticipantCode(course, classInfo = null) {
  const classId = classInfo?.id || "common";
  const className = classInfo?.name || "공통";
  const used = (course.participants || [])
    .filter((participant) => (participant.classId || "common") === classId)
    .map((participant) => Number(String(participant.participantCode || "").split("-").pop()))
    .filter(Boolean);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${className}-${String(next).padStart(2, "0")}`;
}

export function personalFollowupLink(token) {
  return `/followup/${token}`;
}

export function reactionScore(item) {
  return Object.values(item.reactions || {}).reduce((a, b) => a + b, 0);
}

export function sourceLabel(source) {
  return ({ goal: "교육 목표", poll: "실시간 답변", board: "팀게시판", survey: "사후 설문" }[source] || source);
}

export function averageLikert(surveys) {
  const values = surveys.flatMap((survey) => survey.likert || []);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "0.0";
}
