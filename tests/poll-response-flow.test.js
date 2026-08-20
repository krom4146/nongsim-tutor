import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  findActivePollRound,
  stablePollResponseId,
} from "../src/services/pollResponseFlow.js";

const participantId = "participant-1";
const classId = "class-1";

function answer(round, id = "response-1") {
  return {
    ...round,
    items: [...round.items, { id, participantId, text: "응답" }],
  };
}

test("질문이 1개이면 마지막 응답 반영 후 activeRound가 안전하게 null이 된다", () => {
  const round = { id: "round-1", kind: "poll", classId, anonymous: true, items: [] };

  assert.equal(findActivePollRound([round], classId, participantId)?.id, "round-1");
  assert.equal(findActivePollRound([answer(round)], classId, participantId), null);
});

test("질문이 연속 2개이면 첫 응답 후 다음 질문, 마지막 응답 후 null로 전환된다", () => {
  const first = { id: "round-1", kind: "poll", classId, anonymous: false, items: [] };
  const second = { id: "round-2", kind: "poll", classId, anonymous: true, items: [] };

  assert.equal(findActivePollRound([first, second], classId, participantId)?.id, "round-1");
  assert.equal(findActivePollRound([answer(first), second], classId, participantId)?.id, "round-2");
  assert.equal(findActivePollRound([answer(first), answer(second, "response-2")], classId, participantId), null);
});

test("같은 참여자의 같은 질문 재시도는 동일한 응답 ID를 사용한다", () => {
  const firstAttempt = stablePollResponseId("NH-1001", "round-1", participantId);
  const retryAttempt = stablePollResponseId("NH-1001", "round-1", participantId);

  assert.equal(firstAttempt, retryAttempt);
  assert.notEqual(firstAttempt, stablePollResponseId("NH-1001", "round-2", participantId));
  assert.notEqual(firstAttempt, stablePollResponseId("NH-1001", "round-1", "participant-2"));
});

test("질문 화면은 activeRound가 사라진 전환 렌더를 보호한다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(source, /view === "poll" && activeRound && \(/);
  assert.match(source, /view === "poll" && !activeRound && \(/);
  assert.doesNotMatch(source, /view === "poll" && \(\s*<ActionPanel[\s\S]{0,200}activeRound\.anonymous/);
});
