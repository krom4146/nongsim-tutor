export const STAMP_TYPES = [
  { type: "participation", label: "참여 스탬프", shortLabel: "참여", icon: "🙋", meaning: "질문, 발표, 토론과 실시간 응답에 적극 참여" },
  { type: "cooperation", label: "협동 스탬프", shortLabel: "협동", icon: "🤝", meaning: "팀 활동에서 역할을 수행하고 동료와 협력" },
  { type: "consideration", label: "배려 스탬프", shortLabel: "배려", icon: "🌱", meaning: "동료를 돕고 팀 분위기를 긍정적으로 조성" },
  { type: "reflection", label: "성찰 스탬프", shortLabel: "성찰", icon: "💭", meaning: "농협이념과 자신의 업무를 깊이 있게 연결" },
  { type: "olympic", label: "올림픽 스탬프", shortLabel: "올림픽", icon: "🏅", meaning: "농협올림픽 활동에서 우수한 참여와 팀 기여" },
  { type: "action", label: "실천 다짐 스탬프", shortLabel: "실천 다짐", icon: "✍️", meaning: "교육 내용을 현업에서 실천할 방법을 구체화" },
];

export async function loadIdeologyStamps() {
  const saved = await getCollection("stamps");
  return Array.isArray(saved) ? saved.map((item) => ({
    ...item,
    classId: item.classId || "class-1",
    className: item.className || "1반",
    status: item.status || "active",
  })) : [];
}

export async function saveIdeologyStamps(items) {
  return setCollection("stamps", items);
}

export function stampCounts(items, participantId, studentName) {
  return STAMP_TYPES.reduce((counts, stamp) => ({
    ...counts,
    [stamp.type]: items
      .filter((item) => item.status === "active" && item.stampType === stamp.type && (participantId ? item.participantId === participantId : item.studentName === studentName))
      .reduce((sum, item) => sum + Number(item.count || 0), 0),
  }), {});
}

export function buildStampRanking(items, students) {
  return students.map((student) => {
    const counts = stampCounts(items, student.id, student.name);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { ...student, counts, total };
  }).sort((a, b) =>
    b.total - a.total
    || b.counts.olympic - a.counts.olympic
    || b.counts.cooperation - a.counts.cooperation
    || b.counts.reflection - a.counts.reflection
    || a.name.localeCompare(b.name, "ko")
  ).map((item, index) => ({ ...item, rank: index + 1 }));
}
import { getCollection, setCollection } from "./dataStore.js";
