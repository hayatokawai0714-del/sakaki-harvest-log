const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const TABLE_NAME = "harvest_records";

function json(data, init = {}) {
  const headers = { ...JSON_HEADERS, ...(init.headers || {}) };
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers,
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseWeights(value) {
  if (Array.isArray(value)) return value.map(Number).filter((n) => Number.isFinite(n));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n));
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeRecord(input, existing = {}) {
  const weights = parseWeights(input.weights ?? existing.weights ?? []);
  const total = Number(input.total_weight ?? existing.total_weight);
  const totalWeight = Number.isFinite(total)
    ? Math.round(total * 100) / 100
    : Math.round(weights.reduce((sum, value) => sum + value, 0) * 100) / 100;
  const createdAt = String(input.created_at ?? existing.created_at ?? nowIso());
  const updatedAt = String(input.updated_at ?? existing.updated_at ?? nowIso());

  const date = String(input.date ?? existing.date ?? "");
  const field = String(input.field ?? existing.field ?? "");
  const grade = String(input.grade ?? existing.grade ?? "");
  const user = String(input.user ?? existing.user ?? "");
  const memo = String(input.memo ?? existing.memo ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date is required");
  if (!field) throw new Error("field is required");
  if (!grade) throw new Error("grade is required");
  if (!user) throw new Error("user is required");
  if (!weights.length) throw new Error("weights is required");

  return {
    id: String(input.id ?? existing.id ?? randomId()),
    date,
    field,
    grade,
    weights,
    total_weight: totalWeight,
    user,
    memo,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function rowToRecord(row) {
  return {
    id: String(row.id || ""),
    date: String(row.date || ""),
    field: String(row.field || ""),
    grade: String(row.grade || ""),
    weights: parseWeights(row.weights),
    total_weight: Number(row.total_weight || 0),
    user: String(row.user || ""),
    memo: String(row.memo || ""),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

function buildSelectSql(searchParams) {
  const clauses = [];
  const values = [];

  const month = searchParams.get("month");
  if (month) {
    clauses.push("substr(date, 1, 7) = ?");
    values.push(month);
  }

  const field = searchParams.get("field");
  if (field) {
    clauses.push("field = ?");
    values.push(field);
  }

  const grade = searchParams.get("grade");
  if (grade) {
    clauses.push("grade = ?");
    values.push(grade);
  }

  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT * FROM ${TABLE_NAME}${where} ORDER BY date DESC, created_at DESC`;
  return { sql, values };
}

async function listRecords(env, searchParams) {
  const { sql, values } = buildSelectSql(searchParams);
  const prepared = env.DB.prepare(sql);
  const statement = values.length ? prepared.bind(...values) : prepared;
  const result = await statement.all();
  const records = (result.results || []).map(rowToRecord);
  return records;
}

async function insertRecord(env, input) {
  const record = normalizeRecord(input);
  await env.DB.prepare(
    `INSERT INTO ${TABLE_NAME}
      (id, date, field, grade, weights, total_weight, user, memo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    record.id,
    record.date,
    record.field,
    record.grade,
    JSON.stringify(record.weights),
    record.total_weight,
    record.user,
    record.memo,
    record.created_at,
    record.updated_at
  ).run();
  return record;
}

async function updateRecord(env, id, input) {
  const existingResult = await env.DB.prepare(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`).bind(id).first();
  if (!existingResult) return null;
  const merged = normalizeRecord({ ...existingResult, ...input, id, updated_at: nowIso() }, existingResult);
  const updateResult = await env.DB.prepare(
    `UPDATE ${TABLE_NAME}
      SET date = ?, field = ?, grade = ?, weights = ?, total_weight = ?, user = ?, memo = ?, updated_at = ?
      WHERE id = ?`
  ).bind(
    merged.date,
    merged.field,
    merged.grade,
    JSON.stringify(merged.weights),
    merged.total_weight,
    merged.user,
    merged.memo,
    merged.updated_at,
    id
  ).run();

  if ((updateResult.meta?.changes || 0) === 0) return null;
  return merged;
}

async function deleteRecord(env, id) {
  const result = await env.DB.prepare(`DELETE FROM ${TABLE_NAME} WHERE id = ?`).bind(id).run();
  return (result.meta?.changes || 0) > 0;
}

function corsOptions() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export {
  corsOptions,
  deleteRecord,
  insertRecord,
  json,
  listRecords,
  normalizeRecord,
  nowIso,
  rowToRecord,
  updateRecord,
};
