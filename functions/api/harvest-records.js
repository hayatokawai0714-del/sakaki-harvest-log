import { insertRecord, listRecords } from "../_lib/harvest.js";
import { authenticateRequest } from "../_lib/auth.js";

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

function authErrorResponse(authError) {
  return json(authError.body, { status: authError.status });
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (!env.APP_SECRET) return authErrorResponse(await authenticateRequest(request, env));
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

    const authError = await authenticateRequest(request, env);
    if (authError) return authErrorResponse(authError);

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
