import assert from "node:assert/strict";
import test from "node:test";

import { onRequest as handleCollection } from "../functions/api/harvest-records.js";
import { onRequest as handleItem } from "../functions/api/harvest-records/[id].js";
import { onRequest as handleReadWeights } from "../functions/api/read-weights.js";

const APP_SECRET = "test-only-shared-secret";
const EXISTING_RECORD = {
  id: "record-1",
  date: "2026-08-02",
  field: "test-field",
  grade: "test-grade",
  weights: "[1.25]",
  total_weight: 1.25,
  user: "test-user",
  memo: "",
  created_at: "2026-08-02T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
};

function createDb() {
  const calls = [];
  return {
    calls,
    async batch() { calls.push("batch"); return []; },
    async exec() { calls.push("exec"); return {}; },
    prepare(sql) {
      calls.push(sql);
      return {
        bind() { return this; },
        async all() { return { results: [] }; },
        async first() { return { ...EXISTING_RECORD }; },
        async run() { return { meta: { changes: 1 } }; },
      };
    },
  };
}

function itemContext(method, { key, secret = APP_SECRET, db = createDb() } = {}) {
  const headers = key === undefined ? {} : { "X-App-Key": key };
  const init = { method, headers };
  if (method === "PUT") {
    init.headers = { ...headers, "Content-Type": "application/json" };
    init.body = JSON.stringify({ memo: "updated" });
  }
  return {
    context: {
      request: new Request("https://example.test/api/harvest-records/record-1", init),
      env: { APP_SECRET: secret, DB: db },
      params: { id: "record-1" },
    },
    db,
  };
}

for (const method of ["PUT", "DELETE"]) {
  test(`${method} accepts the correct X-App-Key and reaches D1`, async () => {
    const { context, db } = itemContext(method, { key: APP_SECRET });
    const response = await handleItem(context);
    assert.equal(response.status, 200);
    assert.ok(db.calls.length > 0);
  });

  for (const [label, key] of [["missing", undefined], ["incorrect", "wrong-key"]]) {
    test(`${method} rejects a ${label} X-App-Key without touching D1`, async () => {
      const { context, db } = itemContext(method, { key });
      const response = await handleItem(context);
      const text = await response.text();
      assert.equal(response.status, 401);
      assert.deepEqual(JSON.parse(text), { ok: false, code: "unauthorized", error: "Unauthorized." });
      assert.equal(db.calls.length, 0);
      assert.equal(text.includes(APP_SECRET), false);
    });
  }
}

test("missing APP_SECRET uses the existing safe error and does not touch D1", async () => {
  const { context, db } = itemContext("PUT", { key: APP_SECRET, secret: "" });
  const response = await handleItem(context);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "missing_app_secret",
    error: "APP_SECRET is not configured.",
  });
  assert.equal(db.calls.length, 0);
});

test("OPTIONS keeps the existing unauthenticated CORS response", async () => {
  const { context, db } = itemContext("OPTIONS", { secret: "" });
  const response = await handleItem(context);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "GET,POST,PUT,DELETE,OPTIONS");
  assert.equal(db.calls.length, 0);
});

test("collection authentication still rejects missing keys before D1", async () => {
  const db = createDb();
  const response = await handleCollection({
    request: new Request("https://example.test/api/harvest-records"),
    env: { APP_SECRET, DB: db },
  });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test("collection authentication still accepts the correct key", async () => {
  const db = createDb();
  const response = await handleCollection({
    request: new Request("https://example.test/api/harvest-records", {
      headers: { "X-App-Key": APP_SECRET },
    }),
    env: { APP_SECRET, DB: db },
  });
  assert.equal(response.status, 200);
  assert.ok(db.calls.length > 0);
});

test("OCR authentication still rejects missing keys", async () => {
  const response = await handleReadWeights({
    request: new Request("https://example.test/api/read-weights", { method: "POST" }),
    env: { APP_SECRET },
  });
  assert.equal(response.status, 401);
});

test("OCR authentication still accepts the correct key before checking its API configuration", async () => {
  const response = await handleReadWeights({
    request: new Request("https://example.test/api/read-weights", {
      method: "POST",
      headers: { "X-App-Key": APP_SECRET },
    }),
    env: { APP_SECRET },
  });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "missing_openai_api_key");
});
