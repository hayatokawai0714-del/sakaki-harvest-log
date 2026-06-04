import { corsOptions, deleteRecord, json, updateRecord } from "../../_lib/harvest.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = String(params.id || "");

  if (request.method === "OPTIONS") return corsOptions();
  if (!id) return json({ ok: false, error: "id is required" }, { status: 400 });

  if (request.method === "PUT") {
    const body = await request.json();
    const record = await updateRecord(env, id, body);
    if (!record) return json({ ok: false, error: "Record not found" }, { status: 404 });
    return json({ ok: true, record, id });
  }

  if (request.method === "DELETE") {
    const deleted = await deleteRecord(env, id);
    if (!deleted) return json({ ok: false, error: "Record not found" }, { status: 404 });
    return json({ ok: true, id, deleted: true });
  }

  return json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
