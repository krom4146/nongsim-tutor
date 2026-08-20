export function findActivePollRound(rounds, classId, participantId) {
  if (!classId || !participantId) return null;
  return (Array.isArray(rounds) ? rounds : []).find((round) => (
    round?.kind === "poll"
    && round.classId === classId
    && !(Array.isArray(round.items) ? round.items : [])
      .some((item) => item?.participantId === participantId)
  )) || null;
}

export function stablePollResponseId(courseCode, roundId, participantId) {
  return ["poll-response", courseCode, roundId, participantId]
    .map((value) => encodeURIComponent(String(value || "unknown")))
    .join(":");
}
