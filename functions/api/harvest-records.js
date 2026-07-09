import { insertRecord, listRecords } from "../_lib/harvest.js";

const APP_ORIGIN = "https://sakaki-harvest-log.pages.dev";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": APP_ORIGIN,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-app-key",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

function authorize(request, env) {
  if (!env.APP_SECRET) {
    return json({ ok: false, code: "missing_app_secret", error: "APP_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("X-App-Key") !== env.APP_SECRET) {
    return json({ ok: false, code: "unauthorized", error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (!env.APP_SECRET) return authorize(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

    const authError = authorize(request, env);
    if (authError) return authError;

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
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
