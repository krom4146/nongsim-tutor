import test from "node:test";
import assert from "node:assert/strict";
import {
  broadcastFollowupDemoNotification,
  subscribeFollowupDemoNotification,
} from "../src/services/realtimeBridge.js";

function createRealtimeDouble() {
  const state = { topic: "", event: "", handler: null, sent: null, removed: 0 };
  const channel = {
    on(type, filter, handler) {
      assert.equal(type, "broadcast");
      state.event = filter.event;
      state.handler = handler;
      return channel;
    },
    subscribe(callback) {
      callback?.("SUBSCRIBED", null);
      return channel;
    },
    async send(message) {
      state.sent = message;
      return "ok";
    },
  };
  const client = {
    channel(topic) {
      state.topic = topic;
      return channel;
    },
    async removeChannel(target) {
      assert.equal(target, channel);
      state.removed += 1;
      return "ok";
    },
  };
  return { client, state };
}

test("사후조사 데모 알림은 과정별 Supabase Broadcast로 전송된다", async () => {
  const { client, state } = createRealtimeDouble();
  const result = await broadcastFollowupDemoNotification(" nh-2480 ", {
    id: "demo-1",
    courseCode: "wrong-code",
    createdAt: "2026-08-19T02:00:00.000Z",
  }, {
    dataMode: "supabase",
    getClient: () => ({ ok: true, client }),
  });

  assert.deepEqual(result, { ok: true, source: "supabase" });
  assert.equal(state.topic, "nongsim-followup-NH-2480");
  assert.equal(state.sent.type, "broadcast");
  assert.equal(state.sent.event, "followup-demo-notification");
  assert.equal(state.sent.payload.courseCode, "NH-2480");
  assert.equal(state.removed, 1);
});

test("교육생 구독은 같은 과정 알림만 전달하고 해제 시 채널을 정리한다", async () => {
  const { client, state } = createRealtimeDouble();
  const received = [];
  const unsubscribe = subscribeFollowupDemoNotification("NH-2480", (payload) => received.push(payload), {
    dataMode: "supabase",
    getClient: () => ({ ok: true, client }),
  });

  state.handler({ payload: { id: "demo-2", courseCode: "NH-2480" } });
  state.handler({ payload: { id: "demo-3", courseCode: "NH-1001" } });
  await Promise.resolve();
  assert.deepEqual(received.map((item) => item.id), ["demo-2"]);

  unsubscribe();
  await Promise.resolve();
  assert.equal(state.removed, 1);
});

test("잘못된 과정 코드는 Broadcast를 보내지 않는다", async () => {
  const result = await broadcastFollowupDemoNotification("../../bad", {}, {
    dataMode: "supabase",
    getClient: () => { throw new Error("should not create client"); },
  });
  assert.equal(result.ok, false);
});
