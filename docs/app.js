/* eslint-disable no-alert */
(() => {
  "use strict";

  // Apps Script WebアプリURL（あとで差し替え）
  // 例: const GAS_ENDPOINT = 'https://script.google.com/macros/s/XXXX/exec';
  const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbx2BZ_kbNmfCXn9NktB1_mdpAWxVI_xniTN8-W9AG-RVSrBwPp0tHWVYIDXz1QOcI_yLA/exec";
  const CLOUD_API_BASE = "/api/harvest-records";
  const CLOUD_SOURCE_LABEL = "Cloudflare D1";

  const STORAGE_KEY = "sakakiHarvestLog.v2";
  const SETTINGS_KEY = "sakakiHarvestLog.settings.v1";

  /** @typedef {{id:string, date:string, field:string, grade:string, weights:number[], total_weight:number, user:string, memo:string, created_at:string, updated_at:string}} Entry */

  const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

  const statusEl = $("#status");
  const toastEl = $("#toast");
  const summaryEl = $("#summary");
  const listEl = $("#list");
  const logSourceEl = $("#logSource");

  const form = /** @type {HTMLFormElement} */ ($("#form"));
  const dateEl = /** @type {HTMLInputElement} */ ($("#date"));
  const fieldEl = /** @type {HTMLSelectElement} */ ($("#field"));
  const gradeEl = /** @type {HTMLSelectElement} */ ($("#grade"));
  const userEl = /** @type {HTMLSelectElement} */ ($("#user"));
  const memoEl = /** @type {HTMLTextAreaElement} */ ($("#memo"));
  const weightsWrap = $("#weights");
  const totalWeightEl = $("#totalWeight");
  const btnAddWeight = $("#btnAddWeight");
  const btnRenameOther = $("#btnRenameOther");

  const monthEl = /** @type {HTMLInputElement} */ ($("#month"));
  const qEl = /** @type {HTMLInputElement} */ ($("#q"));

  const btnClear = $("#btnClear");
  const btnFetch = $("#btnFetch");
  const btnExportCsv = $("#btnExportCsv");
  const btnExportJson = $("#btnExportJson");
  const fileImport = /** @type {HTMLInputElement} */ ($("#fileImport"));
  const ocrImageEl = /** @type {HTMLInputElement} */ ($("#ocrImage"));
  const ocrPreviewEl = /** @type {HTMLImageElement} */ ($("#ocrPreview"));
  const ocrStatusEl = $("#ocrStatus");
  const btnOcrRead = $("#btnOcrRead");
  const btnOcrApply = $("#btnOcrApply");
  const btnOcrClear = $("#btnOcrClear");
  const ocrCandidatesEl = $("#ocrCandidates");

  const dlgEdit = /** @type {HTMLDialogElement} */ ($("#dlgEdit"));
  const editForm = /** @type {HTMLFormElement} */ ($("#editForm"));
  const eDate = /** @type {HTMLInputElement} */ ($("#eDate"));
  const eField = /** @type {HTMLSelectElement} */ ($("#eField"));
  const eGrade = /** @type {HTMLSelectElement} */ ($("#eGrade"));
  const eUser = /** @type {HTMLSelectElement} */ ($("#eUser"));
  const eMemo = /** @type {HTMLTextAreaElement} */ ($("#eMemo"));
  const eWeightsWrap = $("#eWeights");
  const eTotalWeightEl = $("#eTotalWeight");
  const btnEAddWeight = $("#btnEAddWeight");

  const dlgSettings = /** @type {HTMLDialogElement} */ ($("#dlgSettings"));
  const settingsForm = /** @type {HTMLFormElement} */ ($("#settingsForm"));
  const endpointEl = /** @type {HTMLInputElement} */ ($("#endpoint"));
  const btnSettings = $("#btnSettings");

  /** @type {Entry[]} */
  let entries = [];
  /** @type {Entry[] | null} */
  let sheetEntries = null;
  /** @type {string | null} */
  let editingId = null;
  /** @type {HTMLIFrameElement | null} */
  let submitFrame = null;
  /** @type {HTMLFormElement | null} */
  let submitProxyForm = null;
  /** @type {HTMLInputElement | null} */
  let submitPayloadInput = null;
  /** @type {HTMLInputElement | null} */
  let submitReturnInput = null;
  /** @type {File | null} */
  let ocrImageFile = null;
  /** @type {string} */
  let ocrImageDataUrl = "";
  /** @type {string[]} */
  let ocrCandidateValues = [];
  /** @type {{ rawText:string, corrected:string, confidence:number, valid:boolean }[]} */
  let ocrCandidateDetails = [];

  function nowISO() {
    return new Date().toISOString();
  }

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function monthStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }

  function uuid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function fmtWeight(n) {
    if (!Number.isFinite(n)) return "0";
    return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
  }

  function sumWeights(ws) {
    const s = ws.reduce((acc, x) => acc + (Number.isFinite(x) ? x : 0), 0);
    return Math.round(s * 100) / 100;
  }

  function formatDateValue(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const yyyy = value.getFullYear();
      const mm = String(value.getMonth() + 1).padStart(2, "0");
      const dd = String(value.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    const raw = String(value).trim();
    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return raw;
  }

  function setOcrStatus(message) {
    ocrStatusEl.textContent = message;
  }

  function setOcrPreview(src) {
    ocrPreviewEl.src = src || "";
    ocrPreviewEl.style.display = src ? "block" : "none";
  }

  function normalizeOcrCandidate(value) {
    const raw = String(value || "").trim().replace(/,/g, ".");
    if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(raw)) return "";
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 99.99) return "";
    const fixed = raw.includes(".") ? raw : `${raw}.0`;
    return fmtWeight(Number(fixed));
  }

  function postCorrectOcrValue(value) {
    const raw = String(value || "").trim().replace(/,/g, ".").replace(/[^\d.]/g, "");
    if (!raw) return "";
    if (/^\d{3}$/.test(raw)) {
      const whole = Number(raw[0]);
      const fraction = raw.slice(1);
      const corrected = `${whole}.${fraction}`;
      return normalizeOcrCandidate(corrected);
    }
    if (/^\d{1,2}$/.test(raw)) {
      return normalizeOcrCandidate(`${raw}.0`);
    }
    if (/^\d{1,2}\.\d{1,2}$/.test(raw)) {
      return normalizeOcrCandidate(raw);
    }
    return "";
  }

  function validateWeightRange(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0.5 && num <= 5;
  }

  function extractWeightCandidates(text) {
    const normalizedText = String(text || "")
      .replace(/[，．。]/g, ".")
      .replace(/[oO]/g, "0")
      .replace(/[^\d.\n\r\s]/g, " ");
    const matches = normalizedText.match(/\b\d{1,3}(?:\.\d{1,2})?\b/g) || [];
    const deduped = [];
    for (const token of matches) {
      const corrected = postCorrectOcrValue(token);
      if (!corrected) continue;
      if (!deduped.includes(corrected)) deduped.push(corrected);
    }
    return deduped;
  }

  async function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      image.src = src;
    });
  }

  function drawProcessedCanvas(image, options = {}) {
    const maxWidth = options.maxWidth || 1400;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let index = 0; index < data.length; index += 4) {
      const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
      const boosted = Math.min(255, Math.max(0, (gray - 128) * 1.35 + 128));
      const threshold = boosted > 165 ? 255 : 0;
      data[index] = threshold;
      data[index + 1] = threshold;
      data[index + 2] = threshold;
      data[index + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  function detectTextRows(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    const { width, height } = canvas;
    const { data } = context.getImageData(0, 0, width, height);
    const rowScores = new Array(height).fill(0);

    for (let y = 0; y < height; y += 1) {
      let blackCount = 0;
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        if (data[index] < 128) blackCount += 1;
      }
      rowScores[y] = blackCount;
    }

    const threshold = Math.max(4, Math.round(width * 0.04));
    const bands = [];
    let start = -1;
    for (let y = 0; y < rowScores.length; y += 1) {
      if (rowScores[y] >= threshold && start === -1) start = y;
      if ((rowScores[y] < threshold || y === rowScores.length - 1) && start !== -1) {
        const end = rowScores[y] < threshold ? y - 1 : y;
        if (end - start > 8) bands.push({ start: Math.max(0, start - 6), end: Math.min(height - 1, end + 6) });
        start = -1;
      }
    }
    return bands;
  }

  function cropCanvas(canvas, band) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    const crop = document.createElement("canvas");
    crop.width = canvas.width;
    crop.height = band.end - band.start + 1;
    const cropContext = crop.getContext("2d", { willReadFrequently: true });
    if (!cropContext) return null;
    cropContext.drawImage(canvas, 0, band.start, canvas.width, band.end - band.start + 1, 0, 0, canvas.width, band.end - band.start + 1);
    return crop;
  }

  function getCandidateConfidence(result) {
    const words = result?.data?.words || [];
    const confidences = words.map((word) => Number(word.confidence)).filter((v) => Number.isFinite(v) && v >= 0);
    if (confidences.length === 0) return 0;
    return Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10;
  }

  async function recognizeCanvas(canvas) {
    const result = await window.Tesseract.recognize(canvas, "eng", {
      logger: (m) => {
        if (m.status) setOcrStatus(`読み取り中... ${m.status}${m.progress != null ? ` ${Math.round(m.progress * 100)}%` : ""}`);
      },
      tessedit_pageseg_mode: 6,
      tessedit_char_whitelist: "0123456789.",
    });
    return result;
  }

  function renderOcrCandidates(values) {
    const items = Array.isArray(values) ? values : [];
    ocrCandidateValues = items.map((item) => String(item || ""));
    ocrCandidatesEl.innerHTML = "";

    if (items.length === 0) {
      ocrCandidatesEl.innerHTML = `<div class="hint">候補がありません。撮影画像を確認して再読み取りしてください。</div>`;
      return;
    }

    for (const [index, value] of items.entries()) {
      const details = ocrCandidateDetails[index] || { rawText: value, corrected: value, confidence: 0, valid: validateWeightRange(value) };
      const row = document.createElement("div");
      row.className = "ocrCandidate";
      row.innerHTML = `
        <div class="ocrCandidate__info">
          <div class="ocrCandidate__value">
            <input type="text" inputmode="decimal" value="${escapeHtml(value)}" aria-label="候補${index + 1}" />
          </div>
          <div class="ocrBadge">OCR値: ${escapeHtml(details.rawText)} / 補正値: ${escapeHtml(details.corrected)} / 信頼度: ${escapeHtml(String(details.confidence))}%${details.valid ? "" : " / 範囲外"}</div>
        </div>
        <button class="btn btn--danger ocrCandidate__del" type="button">削除</button>
      `;
      const input = /** @type {HTMLInputElement} */ (row.querySelector("input"));
      const delBtn = /** @type {HTMLButtonElement} */ (row.querySelector("button"));
      input.addEventListener("input", () => {
        ocrCandidateValues[index] = input.value;
        const corrected = postCorrectOcrValue(input.value);
        ocrCandidateDetails[index] = {
          rawText: ocrCandidateDetails[index]?.rawText || input.value,
          corrected,
          confidence: ocrCandidateDetails[index]?.confidence || 0,
          valid: validateWeightRange(corrected),
        };
        renderOcrCandidates(ocrCandidateValues);
      });
      delBtn.addEventListener("click", () => {
        ocrCandidateValues.splice(index, 1);
        ocrCandidateDetails.splice(index, 1);
        renderOcrCandidates(ocrCandidateValues);
      });
      ocrCandidatesEl.appendChild(row);
    }
  }

  function applyOcrToWeights() {
    const values = ocrCandidateDetails
      .map((item) => item.corrected || postCorrectOcrValue(item.rawText))
      .filter((v) => v && validateWeightRange(v));
    setWeightsTo(weightsWrap, values.length ? values : [""], updateTotal, updateTotal);
    updateTotal();
    toast("ok", "重量一覧へ反映しました");
  }

  async function readOcrImage() {
    if (!ocrImageFile || !ocrImageDataUrl) {
      toast("warn", "先に写真を選択してください");
      return;
    }
    if (!window.Tesseract?.recognize) {
      toast("err", "OCRライブラリが読み込まれていません");
      return;
    }

    setOcrStatus("読み取り中...");
    toast("warn", "読み取り中...");

    try {
      const image = await loadImageElement(ocrImageDataUrl);
      const processed = drawProcessedCanvas(image, { maxWidth: 1200 });
      if (!processed) throw new Error("画像の前処理に失敗しました");

      const bands = detectTextRows(processed);
      console.log("[OCR] bands =", bands);
      if (bands.length === 0) {
        const fallback = await recognizeCanvas(processed);
        const fallbackText = fallback?.data?.text || "";
        console.log("[OCR] full text =", fallbackText);
        const fallbackConfidence = getCandidateConfidence(fallback);
        const fallbackCandidates = extractWeightCandidates(fallbackText).map((value) => ({
          rawText: value,
          corrected: value,
          confidence: fallbackConfidence,
          valid: validateWeightRange(value),
        }));
        ocrCandidateDetails = fallbackCandidates;
        renderOcrCandidates(fallbackCandidates.map((item) => item.corrected));
        setOcrStatus(fallbackCandidates.length ? `読み取り完了: ${fallbackCandidates.length}件` : "読み取り完了: 候補なし");
        toast("ok", fallbackCandidates.length ? `読み取り完了: ${fallbackCandidates.length}件` : "読み取り完了: 候補なし");
        return;
      }

      const results = [];
      for (const band of bands) {
        const cropped = cropCanvas(processed, band);
        if (!cropped) continue;
        const bandResult = await recognizeCanvas(cropped);
        const bandText = bandResult?.data?.text || "";
        const confidence = getCandidateConfidence(bandResult);
        console.log("[OCR] row text =", bandText);
        console.log("[OCR] row confidence =", confidence);
        const extracted = extractWeightCandidates(bandText);
        for (const rawText of extracted) {
          const corrected = postCorrectOcrValue(rawText);
          results.push({
            rawText,
            corrected: corrected || rawText,
            confidence,
            valid: validateWeightRange(corrected || rawText),
          });
        }
      }

      const deduped = [];
      for (const item of results) {
        const key = item.corrected || item.rawText;
        if (!deduped.some((existing) => (existing.corrected || existing.rawText) === key)) deduped.push(item);
      }

      ocrCandidateDetails = deduped;
      renderOcrCandidates(deduped.map((item) => item.corrected || item.rawText));
      const validCount = deduped.filter((item) => item.valid).length;
      const warningCount = deduped.length - validCount;
      setOcrStatus(`読み取り完了: ${deduped.length}件${warningCount ? ` / 範囲外 ${warningCount}件` : ""}`);
      toast("ok", deduped.length ? `読み取り完了: ${deduped.length}件` : "読み取り完了: 候補なし");
    } catch (err) {
      console.error("[OCR] error =", err);
      setOcrStatus(`読み取り失敗: ${String(err)}`);
      toast("err", `読み取り失敗: ${String(err)}`);
    }
  }

  function toast(kind, msg) {
    toastEl.className = "toast";
    if (kind === "ok") toastEl.classList.add("toast--ok");
    if (kind === "warn") toastEl.classList.add("toast--warn");
    if (kind === "err") toastEl.classList.add("toast--err");
    toastEl.textContent = msg;
    if (!msg) toastEl.style.display = "none";
    else toastEl.style.display = "block";
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => {
      toastEl.className = "toast";
      toastEl.textContent = "";
      toastEl.style.display = "none";
    }, 3500);
  }
  toast._t = 0;

  function safeParseJSON(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function loadSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { endpoint: "", otherUserLabel: "担当者" };
    const p = safeParseJSON(raw);
    if (!p.ok || !p.value || typeof p.value !== "object") return { endpoint: "", otherUserLabel: "担当者" };
    return {
      endpoint: String(p.value.endpoint || ""),
      otherUserLabel: String(p.value.otherUserLabel || "担当者"),
    };
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function getEndpoint() {
    const s = loadSettings();
    return (s.endpoint || GAS_ENDPOINT || "").trim();
  }

  function getCloudRecordUrl(id = "") {
    return id ? `${CLOUD_API_BASE}/${encodeURIComponent(id)}` : CLOUD_API_BASE;
  }

  function toWeightList(value) {
    if (Array.isArray(value)) return value.map(Number).filter((n) => Number.isFinite(n));
    if (typeof value === "string") {
      const parsed = safeParseJSON(value);
      if (parsed.ok && Array.isArray(parsed.value)) {
        return parsed.value.map(Number).filter((n) => Number.isFinite(n));
      }
    }
    return [];
  }

  function normalizeBackendRecord(record) {
    const weights = toWeightList(record?.weights);
    const total = Number(record?.total_weight);
    return {
      id: String(record?.id || uuid()),
      date: formatDateValue(record?.date),
      field: String(record?.field || ""),
      grade: String(record?.grade || ""),
      weights,
      total_weight: Number.isFinite(total) ? total : sumWeights(weights),
      user: String(record?.user || ""),
      memo: String(record?.memo || ""),
      created_at: String(record?.created_at || nowISO()),
      updated_at: String(record?.updated_at || nowISO()),
    };
  }

  function upsertLocalRecord(record) {
    const normalized = normalizeBackendRecord(record);
    const index = entries.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) entries[index] = normalized;
    else entries.unshift(normalized);
    saveLocal();
    return normalized;
  }

  function removeLocalRecord(id) {
    entries = entries.filter((entry) => entry.id !== id);
    saveLocal();
  }

  function buildRecordPayload(entry) {
    return {
      id: entry.id,
      date: entry.date,
      field: entry.field,
      grade: entry.grade,
      weights: entry.weights,
      total_weight: entry.total_weight,
      user: entry.user,
      memo: entry.memo,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  async function requestBackend(path, options = {}) {
    const { headers = {}, ...rest } = options;
    const response = await fetch(path, {
      ...rest,
      headers: { "Content-Type": "application/json", ...headers },
    });
    const text = await response.text();
    const parsed = safeParseJSON(text);
    if (!parsed.ok) {
      return { ok: false, status: response.status, error: "JSON parse failed", rawText: text };
    }
    return { ok: response.ok, status: response.status, data: parsed.value, rawText: text };
  }

  async function fetchCloudRecords(opts = {}) {
    const silent = Boolean(opts.silent);
    if (!silent) toast("warn", "Cloudflare D1 から読込中...");

    try {
      console.groupCollapsed("[Cloudflare] GET", getCloudRecordUrl());
      const result = await requestBackend(`${getCloudRecordUrl()}?t=${Date.now()}`, { method: "GET" });
      console.log("response", result?.data);
      console.log("records", result?.data?.records);
      console.log("records.length", result?.data?.records?.length);
      console.groupEnd();

      if (!result.ok || !result.data?.ok) throw new Error(String(result.data?.error || result.error || "Cloud API error"));

      const records = Array.isArray(result.data.records) ? result.data.records : [];
      const localBackup = loadLocal();
      const merged = [
        ...records.map(normalizeBackendRecord),
        ...localBackup
          .filter((record) => !records.some((cloudRecord) => String(cloudRecord.id) === String(record.id)))
          .map(normalizeBackendRecord),
      ];
      sheetEntries = records.map(normalizeBackendRecord);
      entries = merged;
      saveLocal();

      const countMessage = `D1取得件数: ${sheetEntries.length}件`;
      if (!silent) toast("ok", countMessage);
      render();
      return {
        ok: true,
        count: sheetEntries.length,
        records: sheetEntries,
        source: CLOUD_SOURCE_LABEL,
      };
    } catch (err) {
      console.error("[Cloudflare] GET error =", err);
      if (!silent) toast("err", `Cloudflare読込失敗: ${String(err)}`);
      return { ok: false, error: String(err) };
    }
  }

  async function createCloudRecord(entry) {
    const result = await requestBackend(getCloudRecordUrl(), {
      method: "POST",
      body: JSON.stringify(buildRecordPayload(entry)),
    });
    if (!result.ok || !result.data?.ok) {
      throw new Error(String(result.data?.error || result.error || "Cloud save failed"));
    }
    return result.data.record ? normalizeBackendRecord(result.data.record) : normalizeBackendRecord(entry);
  }

  async function updateCloudRecord(entry) {
    const result = await requestBackend(getCloudRecordUrl(entry.id), {
      method: "PUT",
      body: JSON.stringify(buildRecordPayload(entry)),
    });
    if (!result.ok || !result.data?.ok) {
      throw new Error(String(result.data?.error || result.error || "Cloud update failed"));
    }
    return result.data.record ? normalizeBackendRecord(result.data.record) : normalizeBackendRecord(entry);
  }

  async function deleteCloudRecord(id) {
    const result = await requestBackend(getCloudRecordUrl(id), {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (!result.ok || !result.data?.ok) {
      throw new Error(String(result.data?.error || result.error || "Cloud delete failed"));
    }
    return true;
  }

  async function deleteRecordById(id) {
    try {
      if (isCloudRecordId(id)) {
        await deleteCloudRecord(id);
        sheetEntries = sheetEntries.filter((entry) => entry.id !== id);
      }
      removeLocalRecord(id);
      entries = entries.filter((entry) => entry.id !== id);
      render();
      toast("ok", "削除しました");
    } catch (err) {
      console.error("[Cloudflare] DELETE error =", err);
      toast("err", `削除失敗: ${String(err)}`);
    }
  }

  function loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = safeParseJSON(raw);
    if (!p.ok) return [];
    const value = p.value;
    if (!value || typeof value !== "object") return [];
    const arr = Array.isArray(value.entries) ? value.entries : (Array.isArray(value) ? value : []);

    return arr
      .filter((e) => e && typeof e === "object")
      .map((e) => {
        const ws = Array.isArray(e.weights) ? e.weights.map(Number).filter((n) => Number.isFinite(n)) : [];
        const total = Number(e.total_weight);
        return {
          id: String(e.id || uuid()),
          date: String(e.date || ""),
          field: String(e.field || ""),
          grade: String(e.grade || ""),
          weights: ws,
          total_weight: Number.isFinite(total) ? total : sumWeights(ws),
          user: String(e.user || ""),
          memo: String(e.memo || ""),
          created_at: String(e.created_at || nowISO()),
          updated_at: String(e.updated_at || nowISO()),
        };
      })
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  }

  function saveLocal() {
    const payload = { schema: 2, updatedAt: nowISO(), entries };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/\s+/g, " ");
  }

  function makeWeightRow(onChange, onRemove) {
    const row = document.createElement("div");
    row.className = "weightItem";
    row.innerHTML = `
      <input type="number" inputmode="decimal" step="0.01" min="0" placeholder="例: 1.30" />
      <button class="btn btn--ghost btn--sm" type="button">削除</button>
    `;
    const input = /** @type {HTMLInputElement} */ (row.querySelector("input"));
    const btn = /** @type {HTMLButtonElement} */ (row.querySelector("button"));
    input.addEventListener("input", onChange);
    btn.addEventListener("click", () => {
      row.remove();
      onRemove();
    });
    return { row, input };
  }

  function getWeightsFrom(container) {
    const inputs = [...container.querySelectorAll("input")];
    return inputs
      .map((i) => Number(i.value))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  function setWeightsTo(container, weights, onChange, onRemove) {
    container.innerHTML = "";
    const list = Array.isArray(weights) && weights.length ? weights : [""];
    for (const w of list) {
      const { row, input } = makeWeightRow(onChange, onRemove);
      if (w !== "") input.value = String(w);
      container.appendChild(row);
    }
  }

  function updateTotal() {
    const ws = getWeightsFrom(weightsWrap);
    totalWeightEl.textContent = fmtWeight(sumWeights(ws));
  }

  function updateETotal() {
    const ws = getWeightsFrom(eWeightsWrap);
    eTotalWeightEl.textContent = fmtWeight(sumWeights(ws));
  }

  function filtered(list) {
    const month = monthEl.value.trim();
    const q = qEl.value.trim().toLowerCase();

    return list
      .filter((e) => (month ? e.date.startsWith(month) : true))
      .filter((e) => {
        if (!q) return true;
        return (
          String(e.field).toLowerCase().includes(q) ||
          String(e.grade).toLowerCase().includes(q) ||
          String(e.user).toLowerCase().includes(q) ||
          String(e.memo).toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return String(b.updated_at).localeCompare(String(a.updated_at), "ja");
      });
  }

  function computeSummary(list) {
    const total = sumWeights(list.map((e) => Number(e.total_weight) || 0));
    const byField = new Map();
    const byGrade = new Map();
    for (const e of list) {
      const k = e.field || "(未設定)";
      byField.set(k, (byField.get(k) || 0) + (Number(e.total_weight) || 0));
      const g = e.grade || "(未設定)";
      byGrade.set(g, (byGrade.get(g) || 0) + (Number(e.total_weight) || 0));
    }
    const parts = [...byField.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .map(([k, v]) => `${k}: ${fmtWeight(Math.round(v * 100) / 100)}kg`);
    return { count: list.length, total, parts };
  }

  function buildBreakdown(list, keySelector) {
    const map = new Map();
    for (const item of list) {
      const key = keySelector(item) || "(未設定)";
      map.set(key, (map.get(key) || 0) + (Number(item.total_weight) || 0));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .map(([key, value]) => `${key}: ${fmtWeight(Math.round(value * 100) / 100)}kg`);
  }

  function getDisplayRecords() {
    if (!Array.isArray(sheetEntries)) return entries.slice();
    const cloudIds = new Set(sheetEntries.map((record) => String(record.id)));
    const localExtras = entries.filter((record) => !cloudIds.has(String(record.id)));
    return [...sheetEntries, ...localExtras];
  }

  function isCloudRecordId(id) {
    return Array.isArray(sheetEntries) && sheetEntries.some((record) => String(record.id) === String(id));
  }

  function render() {
    const base = getDisplayRecords();
    const list = filtered(base);
    const summary = computeSummary(list);
    const monthLabel = monthEl.value ? `${monthEl.value} の` : "";
    const byField = buildBreakdown(list, (item) => item.field);
    const byGrade = buildBreakdown(list, (item) => item.grade);

    summaryEl.innerHTML = `
      <div class="summaryGrid">
        <div class="summaryCard">
          <div class="summaryCard__label">件数 / 合計</div>
          <div class="summaryCard__value">${monthLabel} ${summary.count}件 / ${fmtWeight(summary.total)}kg</div>
          <div class="summaryCard__meta">${summary.parts.join(" / ") || "-"}</div>
        </div>
        <div class="summaryCard">
          <div class="summaryCard__label">圃場別</div>
          <div class="summaryCard__meta">${byField.join(" / ") || "-"}</div>
        </div>
        <div class="summaryCard">
          <div class="summaryCard__label">規格別</div>
          <div class="summaryCard__meta">${byGrade.join(" / ") || "-"}</div>
        </div>
      </div>
    `;

    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const e of list) {
      const weightsText = (e.weights || []).map((w) => fmtWeight(w)).join(", ");
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="item__top">
          <div>
            <div class="item__title">${escapeHtml(e.date)} / 圃場 ${escapeHtml(e.field)} / ${escapeHtml(e.grade)}</div>
            <div class="item__meta">入力者: ${escapeHtml(e.user)} / 合計: ${escapeHtml(fmtWeight(Number(e.total_weight) || 0))} kg</div>
          </div>
          <div class="item__meta">${sheetEntries && sheetEntries.some((record) => String(record.id) === String(e.id)) ? CLOUD_SOURCE_LABEL : "localStorage"}</div>
        </div>
        <div class="item__grid">
          <div class="kv"><div class="kv__k">重量一覧</div><div class="kv__v">${escapeHtml(weightsText || "-")}</div></div>
          <div class="kv"><div class="kv__k">メモ</div><div class="kv__v">${escapeHtml(e.memo || "-")}</div></div>
        </div>
        <div class="item__actions">
          <button class="btn" type="button" data-act="edit" data-id="${escapeAttr(e.id)}">編集</button>
          <button class="btn btn--danger" type="button" data-act="del" data-id="${escapeAttr(e.id)}">削除</button>
        </div>
      `;
      frag.appendChild(item);
    }

    listEl.appendChild(frag);

    const src = sheetEntries ? CLOUD_SOURCE_LABEL : "localStorage表示";
    const ep = getEndpoint();
    const endpointLabel = ep ? `endpoint: ${ep}` : "endpoint: 未設定";
    logSourceEl.textContent = `${src} / ${endpointLabel}`;
    statusEl.textContent = `${src} / local: ${entries.length}件 / ${endpointLabel}`;
  }

  function ensureSubmitProxy() {
    if (!submitFrame) {
      submitFrame = document.createElement("iframe");
      submitFrame.name = "sakakiSheetsSink";
      submitFrame.title = "sakakiSheetsSink";
      submitFrame.className = "sr-only";
      submitFrame.style.display = "none";
      document.body.appendChild(submitFrame);
    }

    if (!submitProxyForm) {
      submitProxyForm = document.createElement("form");
      submitProxyForm.method = "POST";
      submitProxyForm.target = "sakakiSheetsSink";
      submitProxyForm.style.display = "none";
      submitProxyForm.enctype = "application/x-www-form-urlencoded";
      submitProxyForm.acceptCharset = "UTF-8";
      document.body.appendChild(submitProxyForm);

      submitReturnInput = document.createElement("input");
      submitReturnInput.type = "hidden";
      submitReturnInput.name = "returnMode";
      submitReturnInput.value = "html";
      submitProxyForm.appendChild(submitReturnInput);

      submitPayloadInput = document.createElement("input");
      submitPayloadInput.type = "hidden";
      submitPayloadInput.name = "payload";
      submitProxyForm.appendChild(submitPayloadInput);
    }
  }

  function setTransportMessage(mode) {
    toast("ok", `送信方式：${mode}`);
    console.log("[Sheets] transport =", mode);
  }

  function detectSafariIOS() {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  }

  function openEdit(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    editingId = id;

    eDate.value = e.date;
    eField.value = e.field;
    eGrade.value = e.grade;
    eUser.value = e.user;
    eMemo.value = e.memo;

    setWeightsTo(eWeightsWrap, e.weights, updateETotal, updateETotal);
    updateETotal();

    dlgEdit.showModal();
  }

  async function commitEdit() {
    if (!editingId) return;
    const idx = entries.findIndex((x) => x.id === editingId);
    if (idx === -1) return;

    const date = eDate.value.trim();
    const field = eField.value;
    const grade = eGrade.value;
    const user = eUser.value;
    const memo = eMemo.value.trim();
    const weights = getWeightsFrom(eWeightsWrap);
    const total_weight = sumWeights(weights);

    if (!date) return;
    if (weights.length === 0) {
      alert("重量を1つ以上入力してください");
      return;
    }

    const prev = entries[idx];
    const next = {
      ...prev,
      date,
      field,
      grade,
      user,
      memo,
      weights,
      total_weight,
      updated_at: nowISO(),
    };
    if (isCloudRecordId(editingId)) {
      const saved = await updateCloudRecord(next);
      sheetEntries = sheetEntries.map((record) => (record.id === saved.id ? saved : record));
      upsertLocalRecord(saved);
      saveLocal();
      return saved;
    }

    entries[idx] = next;
    saveLocal();
    return next;
  }

  function handleListClick(ev) {
    const t = /** @type {HTMLElement} */ (ev.target);
    const btn = t.closest("button[data-act]");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id") || "";
    if (!id) return;

    if (act === "edit") {
      openEdit(id);
      return;
    }

    if (act === "del") {
      const base = sheetEntries ?? entries;
      const e = base.find((x) => x.id === id);
      if (!e) return;
      const ok = confirm(`${e.date} の記録を削除しますか？`);
      if (!ok) return;
      void deleteRecordById(id);
    }
  }

  function escapeCsv(value) {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const base = getDisplayRecords();
    const list = filtered(base).slice().sort((a, b) => a.date.localeCompare(b.date, "ja"));
    const header = ["id","date","field","grade","weights","total_weight","user","memo","created_at","updated_at"].join(",");
    const lines = list.map((e) => [
      e.id,
      e.date,
      e.field,
      e.grade,
      JSON.stringify(e.weights || []),
      fmtWeight(Number(e.total_weight) || 0),
      e.user,
      e.memo,
      e.created_at,
      e.updated_at,
    ].map(escapeCsv).join(","));
    const csv = [header, ...lines].join("\n") + "\n";
    const name = monthEl.value ? `sakaki-harvest-${monthEl.value}.csv` : "sakaki-harvest.csv";
    downloadText(name, csv, "text/csv;charset=utf-8");
  }

  function exportJson() {
    const payload = {
      schema: 2,
      exportedAt: nowISO(),
      entries: getDisplayRecords(),
    };
    downloadText("sakaki-harvest.json", JSON.stringify(payload, null, 2) + "\n", "application/json;charset=utf-8");
  }

  async function importJsonFile(file) {
    const text = await file.text();
    const p = safeParseJSON(text);
    if (!p.ok) {
      toast("err", "JSONの読み込みに失敗しました");
      return;
    }
    const v = p.value;
    const next = Array.isArray(v?.entries) ? v.entries : (Array.isArray(v) ? v : null);
    if (!next) {
      toast("err", "形式が不正です（entries配列がありません）");
      return;
    }

    const imported = next
      .filter((e) => e && typeof e === "object")
      .map((e) => {
        const ws = Array.isArray(e.weights) ? e.weights.map(Number).filter((n) => Number.isFinite(n)) : [];
        return {
          id: String(e.id || uuid()),
          date: String(e.date || ""),
          field: String(e.field || ""),
          grade: String(e.grade || ""),
          weights: ws,
          total_weight: sumWeights(ws),
          user: String(e.user || ""),
          memo: String(e.memo || ""),
          created_at: String(e.created_at || nowISO()),
          updated_at: String(e.updated_at || nowISO()),
        };
      })
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));

    if (imported.length === 0) {
      toast("warn", "取り込めるデータがありませんでした");
      return;
    }

    const ok = confirm(`取り込み: ${imported.length}件\n現在のlocalStorage(${entries.length}件)に追加しますか？`);
    if (!ok) return;

    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const e of imported) byId.set(e.id, e);
    entries = [...byId.values()];

    saveLocal();
    render();
    toast("ok", "JSON取り込み完了しました");
  }

  function clearAllLocal() {
    const ok = confirm("localStorageの全データを削除しますか？（取り消し不可）");
    if (!ok) return;
    entries = [];
    localStorage.removeItem(STORAGE_KEY);
    sheetEntries = null;
    render();
    toast("ok", "localStorageを削除しました");
  }

  function buildPostPayload(entry) {
    return {
      date: entry.date,
      field: entry.field,
      grade: entry.grade,
      weights: entry.weights,
      total_weight: entry.total_weight,
      user: entry.user,
      memo: entry.memo,
    };
  }

  async function postToSheets(payload) {
    const endpoint = getEndpoint();
    if (!endpoint) {
      return { ok: false, error: "GAS_ENDPOINT 未設定" };
    }

    const useFormTransport = detectSafariIOS() || true;
    const body = JSON.stringify(payload);

    console.groupCollapsed("[Sheets] POST", endpoint);
    console.log("payload =", payload);
    console.log("userAgent =", navigator.userAgent);
    console.log("transport =", useFormTransport ? "form" : "fetch");

    if (useFormTransport) {
      ensureSubmitProxy();
      if (!submitProxyForm || !submitPayloadInput) {
        console.groupEnd();
        return { ok: false, error: "form送信の準備に失敗しました", transport: "form" };
      }

      submitProxyForm.action = endpoint;
      submitPayloadInput.value = body;
      console.log("form.action =", submitProxyForm.action);
      console.log("form.payload.length =", submitPayloadInput.value.length);

      try {
        submitProxyForm.submit();
      } catch (err) {
        console.error("[Sheets] form submit error =", err);
        console.groupEnd();
        return { ok: false, error: `form submit error: ${String(err)}`, transport: "form" };
      }

      console.groupEnd();
      return {
        ok: true,
        transport: "form",
        message: "送信完了",
        rawText: "",
      };
    }

    const req = {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    };

    let res;
    let text = "";
    try {
      res = await fetch(endpoint, req);
      text = await res.text();
      console.log("response.status =", res.status, res.statusText);
      console.log("response.headers =", [...res.headers.entries()]);
      console.log("response.text =", text);
    } catch (err) {
      console.error("[Sheets] POST fetch error =", err);
      console.groupEnd();
      return { ok: false, error: `fetch error: ${String(err)}`, transport: "fetch" };
    }

    console.groupEnd();

    const p = safeParseJSON(text);
    if (!p.ok) {
      return { ok: false, error: "レスポンスJSONが不正", httpStatus: res.status, rawText: text, transport: "fetch" };
    }

    return { ...p.value, httpStatus: res.status, rawText: text, transport: "fetch" };
  }

  async function fetchFromSheets(opts) {
    const endpoint = getEndpoint();
    if (!endpoint) {
      toast("warn", "Sheets URLが未設定です（設定から入力してください）");
      return;
    }

    const silent = Boolean(opts?.silent);

    if (!silent) toast("warn", "Sheetsから読み込み中...");

    try {
      console.groupCollapsed("[Sheets] GET", endpoint);
      const res = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
      });
      const text = await res.text();
      console.log("response.status =", res.status, res.statusText);
      console.log("response.headers =", [...res.headers.entries()]);
      console.log("response.text =", text);
      console.groupEnd();

      const p = safeParseJSON(text);
      if (!p.ok) throw new Error("JSON parse failed");
      const v = p.value;
      if (!v?.ok) throw new Error(String(v?.error || "GAS error"));
      console.log("response", v);
      console.log("records", v.records);
      console.log("records.length", v.records?.length);
      console.log("[Sheets] GET parsed JSON =", v);
      const sampleList = (v.records || v.entries || v.sample || []).slice(0, 1);
      const contextBits = [
        v.spreadsheetId ? `spreadsheetId=${v.spreadsheetId}` : "",
        v.sheetName ? `sheetName=${v.sheetName}` : "",
        Number.isFinite(Number(v.lastRow)) ? `lastRow=${v.lastRow}` : "",
        Number.isFinite(Number(v.lastColumn)) ? `lastColumn=${v.lastColumn}` : "",
      ].filter(Boolean);
      toast("ok", `GET結果サンプル: ${JSON.stringify(sampleList)}${contextBits.length ? ` / ${contextBits.join(" / ")}` : ""}`);

      const arr = Array.isArray(v.records) ? v.records : (Array.isArray(v.entries) ? v.entries : []);
      sheetEntries = arr
        .filter((e) => e && typeof e === "object")
        .map((e) => {
          const ws = Array.isArray(e.weights)
            ? e.weights.map(Number).filter((n) => Number.isFinite(n))
            : (typeof e.weights === "string" ? safeParseJSON(e.weights).value || [] : []);
          const weights = Array.isArray(ws) ? ws.map(Number).filter((n) => Number.isFinite(n)) : [];
          const total = Number(e.total_weight);
          return {
            id: String(e.id || uuid()),
            date: formatDateValue(e.date),
            field: String(e.field || ""),
            grade: String(e.grade || ""),
            weights,
            total_weight: Number.isFinite(total) ? total : sumWeights(weights),
            user: String(e.user || ""),
            memo: String(e.memo || ""),
            created_at: String(e.created_at || ""),
            updated_at: String(e.updated_at || ""),
          };
        });

      const countMessage = `Sheets取得件数: ${sheetEntries.length}件`;
      console.log("[Sheets] GET count =", sheetEntries.length);
      console.log("[Sheets] GET endpoint =", endpoint);
      console.log("[Sheets] GET sample =", sheetEntries.slice(0, 3));
      console.log("[Sheets] GET context =", {
        spreadsheetId: v.spreadsheetId,
        sheetName: v.sheetName,
        lastRow: v.lastRow,
        lastColumn: v.lastColumn,
      });
      if (!silent) toast("ok", countMessage);
      render();
      return {
        ok: true,
        count: sheetEntries.length,
        endpoint,
        spreadsheetId: v.spreadsheetId,
        sheetName: v.sheetName,
        lastRow: v.lastRow,
        lastColumn: v.lastColumn,
      };
    } catch (err) {
      toast("err", `Sheets読み込み失敗: ${String(err)}`);
      console.error("[Sheets] GET error =", err);
      return { ok: false, error: String(err), endpoint };
    }
  }

  async function handleSave(ev) {
    ev.preventDefault();

    const date = dateEl.value.trim();
    const field = fieldEl.value;
    const grade = gradeEl.value;
    const user = userEl.value;
    const memo = memoEl.value.trim();
    const weights = getWeightsFrom(weightsWrap);

    if (!date) return;
    if (weights.length === 0) {
      toast("warn", "重量を1つ以上入力してください");
      return;
    }

    const total_weight = sumWeights(weights);

    /** @type {Entry} */
    const entry = {
      id: uuid(),
      date,
      field,
      grade,
      weights,
      total_weight,
      user,
      memo,
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    // まずCloudflare D1へ保存する
    try {
      setTransportMessage("fetch");
      toast("warn", "Cloudflareへ保存中...");
      const savedRecord = await createCloudRecord(entry);
      toast("ok", "Cloudflare保存成功");
      console.log("[Cloudflare] POST response =", savedRecord);
      console.log("[Cloudflare] endpoint =", getCloudRecordUrl());

      const localBackup = entries.slice();
      upsertLocalRecord(savedRecord);
      form.reset();
      resetFormDefaults();
      setWeightsTo(weightsWrap, [""], updateTotal, updateTotal);
      updateTotal();
      sheetEntries = sheetEntries ? [savedRecord, ...sheetEntries.filter((record) => record.id !== savedRecord.id)] : [savedRecord];
      entries = [
        ...sheetEntries,
        ...localBackup.filter((record) => !sheetEntries.some((cloudRecord) => cloudRecord.id === record.id)),
      ];
      saveLocal();
      render();

      if (getEndpoint()) {
        void postToSheets(buildPostPayload(savedRecord));
      }
      window.setTimeout(async () => {
        const refreshResult = await fetchCloudRecords({ silent: false });
        if (refreshResult?.ok) {
      toast("ok", `D1再読込成功: ${refreshResult.count}件`);
        } else {
          toast("warn", "送信しました。D1を確認してください");
        }
      }, 1200);
      return;
    } catch (err) {
      // 失敗時はlocalStorageへ一時保存
      entries.push(entry);
      saveLocal();
      toast("err", `Cloudflare保存失敗：${String(err)}（localStorageに退避）`);
      console.error("[Cloudflare] save failed =", err);
      form.reset();
      resetFormDefaults();
      setWeightsTo(weightsWrap, [""], updateTotal, updateTotal);
      updateTotal();
      sheetEntries = null;
      render();
    }
  }

  function resetFormDefaults() {
    dateEl.value = todayStr();
    // weights default 1 row
    setWeightsTo(weightsWrap, [""], updateTotal, updateTotal);
    updateTotal();
    ocrImageFile = null;
    ocrImageDataUrl = "";
    ocrCandidateValues = [];
    ocrCandidateDetails = [];
    if (ocrImageEl) ocrImageEl.value = "";
    setOcrPreview("");
    setOcrStatus("未読み取り");
    renderOcrCandidates([]);

    // other user label
    const s = loadSettings();
    const otherLabel = s.otherUserLabel || "担当者";
    const opts = [...userEl.options];
    for (const o of opts) {
      if (o.value === "担当者") o.textContent = otherLabel;
    }
    const eopts = [...eUser.options];
    for (const o of eopts) {
      if (o.value === "担当者") o.textContent = otherLabel;
    }
  }

  function renameOtherUser() {
    const s = loadSettings();
    const next = prompt("『担当者』の表示名を変更", s.otherUserLabel || "担当者");
    if (next == null) return;
    const label = String(next).trim();
    if (!label) return;
    s.otherUserLabel = label;
    saveSettings(s);
    resetFormDefaults();
    render();
    toast("ok", "表示名を更新しました");
  }

  function openSettings() {
    const s = loadSettings();
    endpointEl.value = s.endpoint || "";
    dlgSettings.showModal();
  }

  function saveSettingsFromDialog() {
    const s = loadSettings();
    s.endpoint = endpointEl.value.trim();
    saveSettings(s);
    render();
    toast("ok", "設定を保存しました");
  }

  function init() {
    entries = loadLocal();
    sheetEntries = null;

    monthEl.value = monthStr();

    form.addEventListener("submit", handleSave);
    btnAddWeight.addEventListener("click", () => {
      const { row } = makeWeightRow(updateTotal, updateTotal);
      weightsWrap.appendChild(row);
    });
    btnRenameOther.addEventListener("click", renameOtherUser);

    monthEl.addEventListener("change", render);
    qEl.addEventListener("input", render);

    btnClear.addEventListener("click", clearAllLocal);
    btnFetch.addEventListener("click", () => fetchCloudRecords({ silent: false }));
    btnExportCsv.addEventListener("click", exportCsv);
    btnExportJson.addEventListener("click", exportJson);
    btnOcrRead.addEventListener("click", readOcrImage);
    btnOcrApply.addEventListener("click", applyOcrToWeights);
    btnOcrClear.addEventListener("click", () => {
      ocrCandidateValues = [];
      ocrCandidateDetails = [];
      renderOcrCandidates([]);
      setOcrStatus("候補をクリアしました");
    });

    ocrImageEl.addEventListener("change", async () => {
      const file = ocrImageEl.files?.[0] || null;
      ocrImageFile = file;
      if (!file) {
        ocrImageDataUrl = "";
        setOcrPreview("");
        setOcrStatus("未読み取り");
        renderOcrCandidates([]);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        ocrImageDataUrl = String(reader.result || "");
        setOcrPreview(ocrImageDataUrl);
        setOcrStatus("画像を選択しました。読み取りを押してください。");
        toast("ok", "画像を選択しました");
      };
      reader.onerror = () => {
        ocrImageDataUrl = "";
        setOcrPreview("");
        setOcrStatus("画像の読み込みに失敗しました");
        toast("err", "画像の読み込みに失敗しました");
      };
      reader.readAsDataURL(file);
    });

    fileImport.addEventListener("change", async () => {
      const file = fileImport.files?.[0];
      fileImport.value = "";
      if (!file) return;
      await importJsonFile(file);
    });

    listEl.addEventListener("click", handleListClick);

    btnEAddWeight.addEventListener("click", () => {
      const { row } = makeWeightRow(updateETotal, updateETotal);
      eWeightsWrap.appendChild(row);
    });

    editForm.addEventListener("submit", (ev) => {
      const submitter = /** @type {HTMLElement | null} */ (ev.submitter);
      const v = submitter?.getAttribute("value");
      if (v === "cancel") {
        editingId = null;
        return;
      }
      ev.preventDefault();
      Promise.resolve(commitEdit())
        .then(() => {
          editingId = null;
          dlgEdit.close();
          render();
          toast("ok", "更新しました");
        })
        .catch((err) => {
          console.error("[Cloudflare] update error =", err);
          toast("err", `更新失敗: ${String(err)}`);
        });
    });

    btnSettings.addEventListener("click", openSettings);
    settingsForm.addEventListener("submit", (ev) => {
      const submitter = /** @type {HTMLElement | null} */ (ev.submitter);
      const v = submitter?.getAttribute("value");
      if (v === "cancel") return;
      ev.preventDefault();
      saveSettingsFromDialog();
      dlgSettings.close();
    });

    resetFormDefaults();
    render();
    void fetchCloudRecords({ silent: true });
  }

  init();
})();





