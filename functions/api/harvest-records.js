import { corsOptions, insertRecord, json, listRecords } from "../_lib/harvest.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return corsOptions();

  if (request.method === "GET") {
    const url = new URL(request.url);
    const records = await listRecords(env, url.searchParams);
    return json({
      ok: true,
      records,
      count: records.length,
      sample: records.slice(0, 3),
    });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const record = await insertRecord(env, body);
    return json({ ok: true, record, id: record.id });
  }

  return json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
