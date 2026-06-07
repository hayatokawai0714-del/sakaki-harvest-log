#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function usage() {
  console.error("使い方: node scripts/convert_agrinote_to_json.js input.csv output.json");
}

function normalizeKey(value) {
  return String(value || "")
    .replace(/\uFEFF/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .replace(/[‐‑‒–—−]/g, "-");
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = "";
  };

  const pushRow = () => {
    if (current.length > 0 || field !== "") {
      pushField();
      rows.push(current);
    }
    current = [];
  };

  const input = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (char === "," || char === "，")) {
      pushField();
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      pushRow();
      continue;
    }
    field += char;
  }
  if (field !== "" || current.length > 0) {
    pushRow();
  }
  return rows;
}

function formatDateYmd(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw
    .replace(/[./]/g, "-")
    .replace(/年/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "")
    .replace(/\s+/g, "");

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = String(Number(isoMatch[2])).padStart(2, "0");
    const dd = String(Number(isoMatch[3])).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const ymdMatch = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = String(Number(ymdMatch[2])).padStart(2, "0");
    const dd = String(Number(ymdMatch[3])).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const jpMatch = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (jpMatch) {
    const yyyy = jpMatch[1];
    const mm = String(Number(jpMatch[2])).padStart(2, "0");
    const dd = String(Number(jpMatch[3])).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

function parseWeight(value) {
  const raw = String(value || "").replace(/[,，]/g, ".").replace(/[^\d.-]/g, "");
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function parseFieldName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/\s+/g, "");
  const exactMap = {
    "1工区": "1",
    "2工区": "2",
    "3工区道上": "3上",
    "3工区上": "3上",
    "3工区道下": "3下",
    "3工区下": "3下",
    "4工区": "4",
    "5工区": "5",
    "6工区": "6",
    "7工区": "7",
  };
  if (exactMap[normalized]) return exactMap[normalized];
  const numeric = normalized.match(/^(\d)(?:工区)?$/);
  if (numeric) return numeric[1];
  return raw;
}

function pickColumnIndex(headers, candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex((header) => normalizeKey(header).includes(normalizeKey(candidate)));
    if (idx >= 0) return idx;
  }
  return -1;
}

function makeIso(dateYmd) {
  const raw = String(dateYmd || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000Z`;
  return "";
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    usage();
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`入力CSVが見つかりません: ${resolvedInput}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(resolvedInput, "utf8");
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  if (!rows.length) {
    console.error("CSVが空です");
    process.exit(1);
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const dateIndex = pickColumnIndex(headers, ["日付"]);
  const fieldIndex = pickColumnIndex(headers, ["圃場名", "圃場"]);
  const weightIndex = pickColumnIndex(headers, ["入力（kg）", "入力kg", "入力"]);
  const memoIndex = pickColumnIndex(headers, ["メモ"]);
  const gradeIndex = pickColumnIndex(headers, ["品質・規格", "品質規格", "規格"]);

  if (dateIndex < 0 || fieldIndex < 0 || weightIndex < 0) {
    console.error("必要な列が見つかりません。少なくとも「日付」「圃場名」「入力（kg）」列が必要です。");
    console.error(`見つかった列: ${headers.join(" / ")}`);
    process.exit(1);
  }

  const entries = [];
  let counter = 0;
  for (const row of dataRows) {
    const date = formatDateYmd(row[dateIndex]);
    const field = parseFieldName(row[fieldIndex]);
    const weight = parseWeight(row[weightIndex]);
    const memo = memoIndex >= 0 ? String(row[memoIndex] || "").trim() : "";
    const uniqueSeed = row.find((cell) => String(cell || "").trim()) || `${counter + 1}`;
    const id = `agrinote-${String(uniqueSeed).replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || counter + 1}`;
    const createdAt = makeIso(date) || new Date().toISOString();

    const entry = {
      id: `${id}-${counter + 1}`,
      date,
      field,
      grade: "",
      weights: [weight],
      total_weight: weight,
      user: "アグリノート",
      memo,
      created_at: createdAt,
      updated_at: createdAt,
    };

    if (!entry.date) {
      console.error(`日付の変換に失敗しました: 行 ${counter + 2}`);
      process.exit(1);
    }

    if (gradeIndex >= 0 && String(row[gradeIndex] || "").trim()) {
      // 品質・規格はアプリのgradeには反映しない
    }

    entries.push(entry);
    counter += 1;
  }

  const payload = {
    schema: 2,
    exportedAt: new Date().toISOString(),
    entries,
  };

  fs.writeFileSync(resolvedOutput, JSON.stringify(payload, null, 2), "utf8");
  console.log(`変換件数: ${entries.length}`);
  console.log(`出力先: ${resolvedOutput}`);
}

main();
