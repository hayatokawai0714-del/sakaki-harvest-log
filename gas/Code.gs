/**
 * Google Apps Script (Webアプリ)
 * 対象スプレッドシート: 「榊収穫管理DB」
 * シート名: 「シート1」（仮）
 * 1行目(ヘッダ):
 * id,date,field,grade,weights,total_weight,user,memo,created_at,updated_at
 */

const SPREADSHEET_ID = "1QdP4NN-4vWbtkbfP5gSQ0WZTfJSABp-I4UWsmZ2WHeI";
const SHEET_NAME = "シート1";
const HEADERS = [
  "id",
  "date",
  "field",
  "grade",
  "weights",
  "total_weight",
  "user",
  "memo",
  "created_at",
  "updated_at",
];

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error(`Sheet not found: ${SHEET_NAME}`);
  return sh;
}

function ensureHeaderRow_(sh) {
  const lastRow = sh.getLastRow();

  // シートが空ならヘッダー作成
  if (lastRow === 0) {
    Logger.log("ensureHeaderRow_: sheet is empty -> create header");
    sh.appendRow(HEADERS);
    return;
  }

  // 1行目を確認
  const firstRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), HEADERS.length)).getValues()[0];
  const normalized = firstRow.map((v) => String(v || "").trim());

  const hasAnyHeader = normalized.some((v) => v !== "");
  const matches = HEADERS.every((h, i) => (normalized[i] || "") === h);

  if (matches) return;

  // 1行目が空ならヘッダーを上書き
  if (!hasAnyHeader) {
    Logger.log("ensureHeaderRow_: header row is empty -> set header");
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  // 1行目にデータが入っている（ヘッダーではない）場合は、1行目にヘッダー行を挿入
  Logger.log("ensureHeaderRow_: header missing -> insert header row at 1");
  sh.insertRowBefore(1);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function buildContext_(sh) {
  return {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    lastRow: sh.getLastRow(),
    lastColumn: sh.getLastColumn(),
  };
}

function safeParse_(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function parsePayload_(e) {
  const parameterPayload = e && e.parameter && e.parameter.payload ? String(e.parameter.payload) : "";
  if (parameterPayload) {
    Logger.log(`parsePayload_: using e.parameter.payload length=${parameterPayload.length}`);
    const parsed = safeParse_(parameterPayload);
    if (parsed.ok) return parsed;
    return { ok: false, error: `parameter.payload parse error: ${parsed.error}` };
  }

  const body = e && e.postData && e.postData.contents ? String(e.postData.contents) : "";
  if (body) {
    Logger.log(`parsePayload_: using e.postData.contents length=${body.length}`);
    const parsed = safeParse_(body);
    if (parsed.ok) return parsed;
    return { ok: false, error: `postData.contents parse error: ${parsed.error}` };
  }

  return { ok: false, error: "No payload found" };
}

function uuid_() {
  // 依存不要の簡易ID（ユニーク性は十分）
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toIso_(d) {
  return new Date(d).toISOString();
}

function normalizeEntry_(payload) {
  const date = String(payload.date || "");
  const field = String(payload.field || "");
  const grade = String(payload.grade || "");
  const user = String(payload.user || "");
  const memo = String(payload.memo || "");

  const weightsRaw = payload.weights;
  const weights = Array.isArray(weightsRaw)
    ? weightsRaw.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const total = Number(payload.total_weight);
  const total_weight = Number.isFinite(total)
    ? Math.round(total * 100) / 100
    : Math.round(weights.reduce((a, b) => a + b, 0) * 100) / 100;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  if (!field) throw new Error("field is required");
  if (!grade) throw new Error("grade is required");
  if (!user) throw new Error("user is required");
  if (!weights.length) throw new Error("weights is required");

  const id = String(payload.id || uuid_());
  const nowIso = toIso_(new Date());
  const created_at = String(payload.created_at || nowIso);
  const updated_at = String(payload.updated_at || nowIso);

  return {
    id,
    date,
    field,
    grade,
    weights,
    total_weight,
    user,
    memo,
    created_at,
    updated_at,
  };
}

function doPost(e) {
  try {
    Logger.log("doPost: start");
    const parsed = parsePayload_(e);
    if (!parsed.ok) {
      Logger.log(`doPost: invalid json: ${parsed.error}`);
      return jsonResponse({ ok: false, error: "Invalid JSON" });
    }

    const entry = normalizeEntry_(parsed.value);
    Logger.log(`doPost: normalized id=${entry.id} date=${entry.date} field=${entry.field} grade=${entry.grade} total=${entry.total_weight}`);

    const sh = getSheet_();
    ensureHeaderRow_(sh);

    Logger.log("doPost: appendRow begin");
    sh.appendRow([
      entry.id,
      entry.date,
      entry.field,
      entry.grade,
      JSON.stringify(entry.weights),
      entry.total_weight,
      entry.user,
      entry.memo,
      entry.created_at,
      entry.updated_at,
    ]);
    const appendedRow = sh.getLastRow();
    const response = { ok: true, id: entry.id, appendedRow, ...buildContext_(sh) };
    Logger.log(`doPost: response=${JSON.stringify(response)}`);

    return jsonResponse(response);
  } catch (err) {
    Logger.log(`doPost: error: ${String(err)}`);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    const sh = getSheet_();
    ensureHeaderRow_(sh);

    const values = sh.getDataRange().getValues();
    const header = values[0] ? values[0].map((v) => String(v || "").trim()) : [];
    const rows = values.slice(1);
    Logger.log(`doGet: values.length=${values.length}`);
    Logger.log(`doGet: headers=${JSON.stringify(header)}`);
    Logger.log(`doGet: rows.length=${rows.length}`);
    if (values.length <= 1) {
      const emptyResponse = { ok: true, entries: [], records: [], count: 0, sample: [] };
      Logger.log(`doGet: response=${JSON.stringify(emptyResponse)}`);
      return jsonResponse(emptyResponse);
    }

    const idx = (name) => header.indexOf(name);

    const records = rows
      .filter((r) => r.some((c) => String(c).trim() !== ""))
      .map((r) => {
        const w = r[idx("weights")];
        const parsed = safeParse_(String(w || "[]"));
        const weights = parsed.ok && Array.isArray(parsed.value)
          ? parsed.value.map(Number).filter((n) => Number.isFinite(n))
          : [];

        return {
          id: String(r[idx("id")] || ""),
          date: String(r[idx("date")] || ""),
          field: String(r[idx("field")] || ""),
          grade: String(r[idx("grade")] || ""),
          weights,
          total_weight: Number(r[idx("total_weight")] || 0),
          user: String(r[idx("user")] || ""),
          memo: String(r[idx("memo")] || ""),
          created_at: String(r[idx("created_at")] || ""),
          updated_at: String(r[idx("updated_at")] || ""),
        };
      });

    const response = {
      ok: true,
      entries: records,
      records,
      count: records.length,
      sample: records.slice(0, 3),
      ...buildContext_(sh),
    };
    Logger.log(`doGet: records.length=${records.length}`);
    Logger.log(`doGet: response=${JSON.stringify(response)}`);
    return jsonResponse(response);
  } catch (err) {
    Logger.log(`doGet: error: ${String(err)}`);
    return jsonResponse({ ok: false, error: String(err) });
  }
}


