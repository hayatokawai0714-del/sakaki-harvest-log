/* eslint-disable no-alert */
(() => {
  "use strict";

  // Google Sheetsへのバックアップを明示的に使う場合のみ設定画面から入力する。
  const GAS_ENDPOINT = "";
  const CLOUD_API_BASE = "/api/harvest-records";
  const CLOUD_SOURCE_LABEL = "Cloudflare D1";
  const DEMO_URL_PARAM = "demo";

  const STORAGE_KEY = "sakakiHarvestLog.v2";
  const SETTINGS_KEY = "sakakiHarvestLog.settings.v1";
  const APP_KEY_STORAGE_KEY = "sakakiHarvestLog.appKey.v1";
  const DEFAULT_GRADES = ["40センチ", "45センチ", "大枝"];
  const USER_OPTIONS = ["河合", "長谷川"];

  /** @typedef {{id:string, date:string, field:string, grade:string, weights:number[], total_weight:number, user:string, memo:string, created_at:string, updated_at:string}} Entry */

  const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

  const toastEl = $("#toast");
  const summaryEl = $("#summary");
  const listEl = $("#list");
  const demoBannerEl = /** @type {HTMLElement | null} */ ($("#demoBanner"));
  const logSourceEl = $("#logSource");
  const statusEl = $("#status");
  const managePanel = $("#managePanel");
  const btnManageToggle = $("#btnManageToggle");
  const btnShowAll = $("#btnShowAll");
  const manageSection = $("#manageSection");
  const newGradeNameEl = /** @type {HTMLInputElement} */ ($("#newGradeName"));
  const btnAddGrade = $("#btnAddGrade");
  const gradeSettingsListEl = $("#gradeSettingsList");
  const inputMiniMonthWeightEl = $("#inputMiniMonthWeight");
  const inputMiniMonthCompareEl = $("#inputMiniMonthCompare");

  const form = /** @type {HTMLFormElement} */ ($("#form"));
  const dateEl = /** @type {HTMLInputElement} */ ($("#date"));
  const fieldEl = /** @type {HTMLSelectElement} */ ($("#field"));
  const gradeEl = /** @type {HTMLSelectElement} */ ($("#grade"));
  const userEl = /** @type {HTMLSelectElement} */ ($("#user"));
  const lockUserEl = /** @type {HTMLInputElement} */ ($("#lockUser"));
  const lockUserStatusEl = $("#lockUserStatus");
  const saveNoticeEl = $("#saveNotice");
  const memoEl = /** @type {HTMLTextAreaElement} */ ($("#memo"));
  const btnMemoToggle = $("#btnMemoToggle");
  const memoBodyEl = $("#memoBody");
  const weightsWrap = $("#weights");
  const formWeightListEl = $("#formWeightList");
  const totalWeightEl = $("#totalWeight");
  const btnAddWeight = $("#btnAddWeight");

  const btnClear = $("#btnClear");
  const btnFetch = $("#btnFetch");
  const btnExportCsv = $("#btnExportCsv");
  const btnExportJson = $("#btnExportJson");
  const fileImport = /** @type {HTMLInputElement} */ ($("#fileImport"));
  const ocrImageEl = /** @type {HTMLInputElement} */ ($("#ocrImage"));
  const ocrImageLibraryEl = /** @type {HTMLInputElement} */ ($("#ocrImageLibrary"));
  const ocrPreviewEl = /** @type {HTMLImageElement} */ ($("#ocrPreview"));
  const ocrStatusEl = $("#ocrStatus");
  const ocrPreviewWrapEl = ocrPreviewEl.closest(".ocrPanel__preview");
  const ocrResultsEl = $("#ocrCandidatesSummary")?.closest(".ocrPanel__results");
  const ocrCandidatesSummaryEl = $("#ocrCandidatesSummary");
  const ocrCandidatesEl = $("#ocrCandidates");
  const btnToggleOcrDetails = $("#btnToggleOcrDetails");
  const calcManualWeightEl = /** @type {HTMLInputElement} */ ($("#calcManualWeight"));
  const btnCalcManualAdd = $("#btnCalcManualAdd");
  const calcTotalWeightEl = $("#calcTotalWeight");
  const calcTotalEl = calcTotalWeightEl?.closest(".calcTotal");
  const saveConfirmEl = $("#saveConfirm");
  const confirmDateEl = $("#confirmDate");
  const confirmFieldEl = $("#confirmField");
  const confirmGradeEl = $("#confirmGrade");
  const confirmUserEl = $("#confirmUser");
  const confirmTotalWeightEl = $("#confirmTotalWeight");

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
  const btnChangeAppKey = $("#btnChangeAppKey");
  const btnDeleteAppKey = $("#btnDeleteAppKey");
  const dlgAppKey = /** @type {HTMLDialogElement} */ ($("#dlgAppKey"));
  const appKeyForm = /** @type {HTMLFormElement} */ ($("#appKeyForm"));
  const appKeyEl = /** @type {HTMLInputElement} */ ($("#appKey"));
  const btnCancelAppKey = $("#btnCancelAppKey");

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
  let ocrDetailsOpen = false;
  let saveButtonResetTimer = 0;
  let recentlySavedId = "";
  let showAllLogs = false;
  let showAllPastMonths = false;
  let showDayBreakdown = false;
  let summaryMode = "month";
  let selectedSummaryYear = "";
  let openSummaryYear = "";
  let openSummaryMonth = "";
  let openSummaryField = "";
  let monthlyTrendOpen = false;
  let memoOpen = false;
  const demoMode = new URLSearchParams(location.search).get(DEMO_URL_PARAM) === "1";

  function demoRecords() {
    const rows = [
      ["demo-1", "2026-06-05", "1", "40センチ", [10.0], 10.0],
      ["demo-2", "2026-06-05", "2", "40センチ", [20.0], 20.0],
      ["demo-3", "2026-06-05", "6", "40センチ", [30.0], 30.0],
      ["demo-4", "2026-06-05", "7", "40センチ", [15.6], 15.6],
      ["demo-5", "2026-06-06", "3下", "45センチ", [12.3], 12.3],
      ["demo-6", "2026-06-06", "4", "40センチ", [18.7], 18.7],
      ["demo-7", "2026-06-07", "3上", "大枝", [4.8], 4.8],
      ["demo-8", "2026-07-02", "1", "40センチ", [11.2], 11.2],
      ["demo-9", "2026-07-02", "3下", "45センチ", [13.4], 13.4],
      ["demo-10", "2026-07-03", "6", "大枝", [6.5], 6.5],
    ];
    return rows.map(([id, date, field, grade, weights, total]) => ({
      id,
      date,
      field,
      grade,
      weights,
      total_weight: total,
      user: "サンプル",
      memo: "",
      created_at: `${date}T08:00:00.000Z`,
      updated_at: `${date}T09:00:00.000Z`,
    }));
  }

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

  function fmtWeightOne(n) {
    if (!Number.isFinite(n)) return "0.0";
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function formatWeight(weight) {
    return fmtWeightOne(Number(weight) || 0);
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
    updateOcrPanelVisibility();
  }

  function setOcrPreview(src) {
    ocrPreviewEl.src = src || "";
    ocrPreviewEl.style.display = src ? "block" : "none";
    updateOcrPanelVisibility();
  }

  function updateOcrPanelVisibility() {
    const statusText = String(ocrStatusEl.textContent || "").trim();
    const hasStatus = Boolean(statusText);
    const hasImage = Boolean(ocrImageDataUrl);
    const hasWeights = ocrCandidateDetails.some((item) => item?.corrected && validateWeightRange(item.corrected));
    ocrStatusEl.toggleAttribute("hidden", !hasStatus);
    ocrPreviewWrapEl?.toggleAttribute("hidden", !hasImage);
    ocrResultsEl?.toggleAttribute("hidden", !hasImage && !hasWeights);
    calcTotalEl?.toggleAttribute("hidden", !hasImage && !hasWeights);
  }

  function setOcrDetailsOpen(open) {
    ocrDetailsOpen = Boolean(open);
    if (ocrCandidatesEl) {
      ocrCandidatesEl.toggleAttribute("hidden", !ocrDetailsOpen);
    }
    if (btnToggleOcrDetails) {
      btnToggleOcrDetails.textContent = ocrDetailsOpen ? "編集を閉じる" : "読み取り結果を編集";
      btnToggleOcrDetails.setAttribute("aria-expanded", String(ocrDetailsOpen));
    }
  }

  function handleOcrImageFile(file) {
    ocrImageFile = file;
    if (!file) {
      ocrImageDataUrl = "";
      setOcrPreview("");
      setOcrStatus("");
      renderOcrCandidates([]);
      setOcrDetailsOpen(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      ocrImageDataUrl = String(reader.result || "");
      setOcrPreview(ocrImageDataUrl);
      setOcrStatus("写真を読み取り中です...");
      toast("warn", "写真を読み取り中です...");
      setOcrDetailsOpen(false);
      void readOcrImage("replace");
    };
    reader.onerror = () => {
      ocrImageDataUrl = "";
      setOcrPreview("");
      setOcrStatus("読み取れませんでした。手入力してください");
      toast("err", "画像の読み込みに失敗しました");
    };
    reader.readAsDataURL(file);
  }

  function normalizeOcrCandidate(value) {
    const raw = String(value || "").trim().replace(/,/g, ".");
    if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(raw)) return "";
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num >= 20) return "";
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
    return Number.isFinite(num) && num > 0 && num < 20;
  }

  function normalizeApiWeightCandidate(value) {
    const raw = String(value || "").trim().replace(/,/g, ".");
    if (!/^\d(?:\.\d{1,2})?$/.test(raw)) return "";
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0.1 || num > 9.99) return "";
    return num.toFixed(2).replace(/\.00$/, "");
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
      deduped.push(corrected);
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

  async function prepareImageForRemoteOcr(dataUrl) {
    const image = await loadImageElement(dataUrl);
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function readWeightsFromApi(imageDataUrl) {
    const response = await fetchWithAppKey("/api/read-weights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    const text = await response.text();
    const parsed = safeParseJSON(text);
    const body = parsed.ok ? parsed.value : null;
    if (!response.ok || !body?.ok) {
      const message = formatOcrApiError(response, body);
      throw new Error(message);
    }
    return body;
  }

  function formatOcrApiError(response, body) {
    if (body?.code === "unauthorized") return "共有キーが一致しません";
    if (body?.code === "missing_app_secret") return "サーバー側の共有キー設定が未完了です";
    const openai = body?.openai || {};
    const status = openai.status || body?.status || response.status;
    const code = openai.code || body?.code || "";
    const type = openai.type || "";
    const message = openai.message || body?.message || body?.error || response.statusText || "画像読み取りに失敗しました";
    const advice = openai.advice || (() => {
      if (status === 401 || status === 403) return "APIキーまたは権限を確認してください";
      if (status === 429) return "利用制限または残高を確認してください";
      if (Number(status) >= 500) return "画像認識API側で失敗しました";
      return "";
    })();
    const parts = [
      `status: ${status}`,
      code ? `code: ${code}` : "",
      type ? `type: ${type}` : "",
      advice,
      `message: ${message}`,
    ].filter(Boolean);
    return parts.join(" / ");
  }

  function friendlyOcrError(message) {
    const text = String(message || "");
    if (/status:\s*\d+/i.test(text)) return `画像読み取り失敗（${text}）`;
    if (/OPENAI_API_KEY|not configured/i.test(text)) return "画像読み取りの設定が未完了です";
    if (/too large/i.test(text)) return "画像が大きすぎます";
    if (/not found|Image data/i.test(text)) return "画像データを確認できませんでした";
    if (/API failed/i.test(text)) return "画像認識APIの呼び出しに失敗しました";
    return text || "画像を読み取れませんでした";
  }

  function renderOcrCandidates(values) {
    const items = Array.isArray(values) ? values : [];
    ocrCandidateValues = items.map((item) => String(item || ""));
    if (ocrCandidatesSummaryEl) {
      ocrCandidatesSummaryEl.textContent = items.length
        ? `読み取り結果：${items.length}件 / ${items.map((value) => `${fmtWeightOne(Number(value) || 0)}kg`).slice(0, 4).join(" / ")}${items.length > 4 ? " / ..." : ""}`
        : "";
    }
    ocrCandidatesEl.innerHTML = "";
    ocrCandidatesEl.toggleAttribute("hidden", !ocrDetailsOpen);

    if (items.length === 0) {
      ocrCandidatesEl.innerHTML = `<div class="hint">写真を撮るか、重量を手入力してください。</div>`;
      updateCalcTotal();
      return;
    }

    for (const [index, value] of items.entries()) {
      const row = document.createElement("div");
      row.className = "ocrCandidate";
      row.innerHTML = `
        <input type="number" inputmode="decimal" min="0" max="20" step="0.01" value="${escapeHtml(value)}" aria-label="重量${index + 1}" />
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
        updateCalcTotal();
      });
      delBtn.addEventListener("click", () => {
        ocrCandidateValues.splice(index, 1);
        ocrCandidateDetails.splice(index, 1);
        renderOcrCandidates(ocrCandidateValues);
      });
      ocrCandidatesEl.appendChild(row);
    }
    updateCalcTotal();
  }

  function toggleOcrDetails() {
    setOcrDetailsOpen(!ocrDetailsOpen);
    renderOcrCandidates(ocrCandidateValues);
  }

  function renderWeightSummaryList(weights) {
    const values = Array.isArray(weights) ? weights.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [];
    if (!values.length) {
      formWeightListEl.textContent = "重量: 0.00kg";
      formWeightListEl.classList.add("is-empty");
      return;
    }
    formWeightListEl.textContent = `重量: ${values.map((value) => fmtWeightOne(value)).join("kg / ")}kg`;
    formWeightListEl.classList.remove("is-empty");
  }

  function getCalcWeights() {
    return ocrCandidateDetails
      .map((item) => item.corrected || postCorrectOcrValue(item.rawText))
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0 && value < 20);
  }

  function updateCalcTotal() {
    const total = sumWeights(getCalcWeights());
    calcTotalWeightEl.textContent = total.toFixed(2);
    if (ocrCandidatesSummaryEl) {
      const preview = ocrCandidateValues.slice(0, 4).map((value) => `${fmtWeightOne(Number(value) || 0)}kg`);
      const suffix = ocrCandidateValues.length > 4 ? " / ..." : "";
      ocrCandidatesSummaryEl.textContent = ocrCandidateValues.length
        ? `読み取り結果：${ocrCandidateValues.length}件 / ${preview.join(" / ")}${suffix}`
        : "";
    }
    syncCalcToFormWeights();
    updateOcrPanelVisibility();
  }

  function syncCalcToFormWeights() {
    const values = getCalcWeights();
    setWeightsTo(weightsWrap, values.length ? values : [""], updateTotal, updateTotal);
    updateTotal();
  }

  function syncCalcFromWeights(values) {
    const items = (Array.isArray(values) ? values : [])
      .map((value) => normalizeOcrCandidate(value))
      .filter(Boolean)
      .map((value) => ({
        rawText: value,
        corrected: value,
        confidence: 0,
        valid: true,
      }));
    setCalcCandidates(items, "replace");
  }

  function setCalcCandidates(items, mode = "replace") {
    const nextItems = Array.isArray(items) ? items.filter((item) => item?.corrected && validateWeightRange(item.corrected)) : [];
    ocrCandidateDetails = mode === "append" ? [...ocrCandidateDetails, ...nextItems] : nextItems;
    renderOcrCandidates(ocrCandidateDetails.map((item) => item.corrected));
  }

  function addManualCalcWeight() {
    const corrected = normalizeOcrCandidate(calcManualWeightEl.value);
    if (!corrected) {
      toast("warn", "0より大きく20kg未満の重量を入力してください");
      return;
    }
    setCalcCandidates([
      {
        rawText: corrected,
        corrected,
        confidence: 0,
        valid: true,
      },
    ], "append");
    calcManualWeightEl.value = "";
    calcManualWeightEl.focus();
  }

  async function readOcrImage(mode = "append") {
    if (!ocrImageFile || !ocrImageDataUrl) {
      toast("warn", "先に写真を選択してください");
      return;
    }
    const applyMode = mode === "replace" ? "replace" : "append";
    setOcrDetailsOpen(false);
    setOcrStatus("写真を読み取り中です...");

    try {
      const imageDataUrl = await prepareImageForRemoteOcr(ocrImageDataUrl);
      const result = await readWeightsFromApi(imageDataUrl);
      const values = (Array.isArray(result.weights) ? result.weights : [])
        .map((value) => normalizeApiWeightCandidate(value))
        .filter(Boolean);
      if (!values.length) {
        setOcrStatus("読み取れませんでした。画像を撮り直すか手入力してください");
        toast("warn", "読み取れませんでした。手入力してください");
        return;
      }
      setCalcCandidates(values.map((value) => ({
        rawText: value,
        corrected: value,
        confidence: 0,
        valid: true,
      })), applyMode);
      setOcrStatus(`${values.length}件を読み取りました。合計重量を確認してください。`);
      toast("ok", `${values.length}件を読み取りました`);
    } catch (err) {
      const message = friendlyOcrError(err?.message || err);
      setOcrStatus(`${message}。撮り直すか手入力してください`);
      toast("err", message);
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
    if (!raw) return { endpoint: "", lockedUser: "", grades: [] };
    const p = safeParseJSON(raw);
    if (!p.ok || !p.value || typeof p.value !== "object") return { endpoint: "", lockedUser: "", grades: [] };
    return {
      endpoint: String(p.value.endpoint || ""),
      lockedUser: String(p.value.lockedUser || ""),
      grades: Array.isArray(p.value.grades)
        ? [...new Set(p.value.grades.map((item) => String(item || "").trim()).filter(Boolean))]
        : [],
    };
  }

  function getAppKey() {
    return localStorage.getItem(APP_KEY_STORAGE_KEY) || "";
  }

  function promptForAppKey(allowCancel = false) {
    appKeyEl.value = "";
    appKeyEl.setCustomValidity("");
    btnCancelAppKey.hidden = !allowCancel;
    dlgAppKey.showModal();
    window.setTimeout(() => appKeyEl.focus(), 0);

    return new Promise((resolve) => {
      const finish = (value) => {
        appKeyForm.removeEventListener("submit", onSubmit);
        appKeyEl.removeEventListener("input", onInput);
        btnCancelAppKey.removeEventListener("click", onCancel);
        dlgAppKey.removeEventListener("cancel", onDialogCancel);
        if (dlgAppKey.open) dlgAppKey.close();
        resolve(value);
      };
      const onSubmit = (event) => {
        event.preventDefault();
        const value = appKeyEl.value;
        if (!value.trim()) {
          appKeyEl.setCustomValidity("共有キーを入力してください");
          appKeyEl.reportValidity();
          return;
        }
        localStorage.setItem(APP_KEY_STORAGE_KEY, value);
        finish(value);
      };
      const onCancel = () => finish(null);
      const onInput = () => appKeyEl.setCustomValidity("");
      const onDialogCancel = (event) => {
        event.preventDefault();
        if (allowCancel) finish(null);
      };
      appKeyForm.addEventListener("submit", onSubmit);
      appKeyEl.addEventListener("input", onInput);
      btnCancelAppKey.addEventListener("click", onCancel);
      dlgAppKey.addEventListener("cancel", onDialogCancel);
    });
  }

  async function fetchWithAppKey(input, init = {}, retryUnauthorized = true) {
    let appKey = getAppKey();
    if (!appKey) appKey = await promptForAppKey(false);

    const headers = new Headers(init.headers || {});
    headers.set("X-App-Key", appKey);
    const response = await fetch(input, { ...init, headers });

    if (response.status === 401 && retryUnauthorized) {
      localStorage.removeItem(APP_KEY_STORAGE_KEY);
      await promptForAppKey(false);
      return fetchWithAppKey(input, init, false);
    }
    return response;
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      endpoint: String(s.endpoint || ""),
      lockedUser: USER_OPTIONS.includes(String(s.lockedUser || "")) ? String(s.lockedUser || "") : "",
      grades: Array.isArray(s.grades) ? s.grades : [],
    }));
  }

  function renderUserOptions(select, currentValue = "", allowUnknown = false) {
    const current = String(currentValue || "");
    const values = allowUnknown && current && !USER_OPTIONS.includes(current) ? [...USER_OPTIONS, current] : USER_OPTIONS;
    select.innerHTML = values.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("");
    if (current && values.includes(current)) select.value = current;
  }

  function getGradeOptions(extra = []) {
    return [...new Set([...DEFAULT_GRADES, ...loadSettings().grades, ...extra].map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function renderSelectOptions(select, values, currentValue = "") {
    const current = String(currentValue || select.value || "");
    select.innerHTML = values.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("");
    if (current && !values.includes(current)) {
      select.insertAdjacentHTML("beforeend", `<option value="${escapeAttr(current)}">${escapeHtml(current)}</option>`);
    }
    if (current) select.value = current;
  }

  function renderGradeSettings() {
    const grades = getGradeOptions();
    renderSelectOptions(gradeEl, grades);
    renderSelectOptions(eGrade, grades);
    gradeSettingsListEl.innerHTML = grades.map((grade) => `<span class="gradeSettingsList__item">${escapeHtml(grade)}</span>`).join("");
  }

  function addCustomGrade() {
    const nextGrade = String(newGradeNameEl.value || "").trim();
    if (!nextGrade) {
      toast("warn", "規格名を入力してください");
      return;
    }
    const settings = loadSettings();
    const currentGrades = getGradeOptions();
    if (currentGrades.includes(nextGrade)) {
      toast("warn", "同じ規格は追加済みです");
      newGradeNameEl.value = "";
      return;
    }
    settings.grades = [...settings.grades, nextGrade];
    saveSettings(settings);
    newGradeNameEl.value = "";
    renderGradeSettings();
    gradeEl.value = nextGrade;
    toast("ok", "規格を追加しました");
    updateSaveConfirm();
  }

  function getEndpoint() {
    const s = loadSettings();
    return String(s.endpoint || "").trim();
  }

  function applyLockedUser() {
    const settings = loadSettings();
    const lockedUser = USER_OPTIONS.includes(settings.lockedUser) ? settings.lockedUser : "";
    if (settings.lockedUser && !lockedUser) {
      settings.lockedUser = "";
      saveSettings(settings);
    }
    if (lockedUser) {
      userEl.value = lockedUser;
    } else {
      userEl.value = "";
    }
    lockUserEl.checked = Boolean(lockedUser);
    lockUserStatusEl.textContent = "";
    updateSaveConfirm();
  }

  function updateLockedUserFromUI() {
    const settings = loadSettings();
    if (lockUserEl.checked && !USER_OPTIONS.includes(userEl.value)) {
      lockUserEl.checked = false;
      settings.lockedUser = "";
      saveSettings(settings);
      applyLockedUser();
      toast("warn", "入力者を選択してください");
      return;
    }
    settings.lockedUser = lockUserEl.checked ? userEl.value : "";
    saveSettings(settings);
    applyLockedUser();
    toast(lockUserEl.checked ? "ok" : "warn", lockUserEl.checked ? "入力者を固定しました" : "入力者固定を解除しました");
  }

  function getSaveButton() {
    return /** @type {HTMLButtonElement | null} */ (form.querySelector('button[type="submit"]'));
  }

  function setSaveButtonState(state) {
    const button = getSaveButton();
    if (!button) return;
    window.clearTimeout(saveButtonResetTimer);
    if (state === "saving") {
      button.disabled = true;
      button.textContent = "保存中...";
      return;
    }
    if (state === "saved") {
      button.disabled = true;
      button.textContent = "保存しました";
      saveButtonResetTimer = window.setTimeout(() => {
        button.disabled = demoMode;
        button.textContent = "保存する";
      }, 3000);
      return;
    }
    button.disabled = demoMode;
    button.textContent = "保存する";
  }

  function showSaveNotice(entry, failed = false) {
    if (!saveNoticeEl) return;
    saveNoticeEl.hidden = false;
    saveNoticeEl.className = `saveNotice ${failed ? "saveNotice--error" : "saveNotice--ok"}`;
    saveNoticeEl.innerHTML = failed
      ? "保存に失敗しました。通信状況を確認してください"
      : `<strong>保存しました</strong><span>${escapeHtml(formatDateJapanese(entry.date))} ${escapeHtml(fmtWeight(entry.total_weight))}kg</span><small>次の入力ができます</small>`;
    window.setTimeout(() => {
      saveNoticeEl.hidden = true;
    }, 5000);
    if (!failed) {
      window.setTimeout(() => {
        recentlySavedId = "";
        render();
      }, 4500);
    }
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

  function buildImportCloudPayload(entry, options = {}) {
    const totalWeight = Number(entry?.total_weight);
    const weights = Array.isArray(entry?.weights) && entry.weights.length
      ? entry.weights.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : Number.isFinite(totalWeight)
        ? [totalWeight]
        : [];
    const payload = {
      ...buildRecordPayload(entry),
      field: String(entry?.field || "").trim() || "未設定",
      grade: String(entry?.grade || "").trim() || "(未設定)",
      user: String(entry?.user || "").trim() || "アグリノート",
      memo: String(entry?.memo || ""),
      weights,
      total_weight: Number.isFinite(totalWeight) ? totalWeight : sumWeights(weights),
    };
    if (options.omitId) delete payload.id;
    if (options.omitTimestamps) {
      delete payload.created_at;
      delete payload.updated_at;
    }
    return payload;
  }

  async function requestBackend(path, options = {}) {
    const { headers = {}, ...rest } = options;
    const response = await fetchWithAppKey(path, {
      ...rest,
      headers: { "Content-Type": "application/json", ...headers },
    });
    const text = await response.text();
    const parsed = safeParseJSON(text);
    if (!parsed.ok) {
      return { ok: false, status: response.status, statusText: response.statusText, error: "JSON parse failed", rawText: text };
    }
    return { ok: response.ok, status: response.status, statusText: response.statusText, data: parsed.value, rawText: text };
  }

  async function fetchCloudRecords(opts = {}) {
    const silent = Boolean(opts.silent);
    if (!silent) toast("warn", "Cloudflare D1 から読込中...");

    try {
      const result = await requestBackend(`${getCloudRecordUrl()}?t=${Date.now()}`, { method: "GET" });

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

  async function createCloudRecordForImport(entry) {
    const attempts = [
      { label: "normal", payload: buildImportCloudPayload(entry) },
      { label: "without-id", payload: buildImportCloudPayload(entry, { omitId: true, omitTimestamps: true }) },
    ];

    let lastError = null;
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      const result = await requestBackend(getCloudRecordUrl(), {
        method: "POST",
        body: JSON.stringify(attempt.payload),
      });
      if (result.ok && result.data?.ok) {
        return result.data.record ? normalizeBackendRecord(result.data.record) : normalizeBackendRecord(entry);
      }
      lastError = {
        attempt: attempt.label,
        index: index + 1,
        status: result.status,
        statusText: result.statusText || "",
        error: String(result.data?.error || result.data?.message || result.error || "Cloud save failed"),
        rawText: result.rawText || "",
      };
    }

    const details = lastError
      ? `(${lastError.attempt} / ${lastError.index}回目失敗 status:${lastError.status || "-"} ${lastError.statusText || ""} ${lastError.error})`
      : "(unknown error)";
    throw new Error(`Cloud save failed ${details}`);
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

  async function deleteRecordById(id, opts = {}) {
    const silent = Boolean(opts.silent);
    if (demoMode) {
      if (!silent) toast("warn", "表示確認モードでは削除できません");
      return;
    }
    try {
      if (isCloudRecordId(id)) {
        await deleteCloudRecord(id);
        sheetEntries = sheetEntries.filter((entry) => entry.id !== id);
      }
      removeLocalRecord(id);
      entries = entries.filter((entry) => entry.id !== id);
      render();
      if (!silent) toast("ok", "削除しました");
    } catch (err) {
      console.error("[Cloudflare] DELETE error =", err);
      if (!silent) toast("err", `削除失敗: ${String(err)}`);
    }
  }

  function loadLocal() {
    if (demoMode) return [];
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
    if (demoMode) return;
    const payload = { schema: 2, updatedAt: nowISO(), entries };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function demoRecordList() {
    return demoRecords().map(normalizeBackendRecord);
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
    totalWeightEl.textContent = fmtWeightOne(sumWeights(ws));
    renderFormWeightSummary(ws);
    updateSaveConfirm();
  }

  function renderFormWeightSummary(weights) {
    const values = Array.isArray(weights) ? weights : [];
    if (!values.length) {
      formWeightListEl.textContent = "重量: 0.00kg";
      formWeightListEl.classList.add("is-empty");
      return;
    }
    formWeightListEl.textContent = `重量: ${sumWeights(values).toFixed(2)}kg`;
    formWeightListEl.classList.remove("is-empty");
  }

  function updateSaveConfirm() {
    const weights = getWeightsFrom(weightsWrap);
    const total = sumWeights(weights);
    confirmDateEl.textContent = dateEl.value || "未入力";
    confirmFieldEl.textContent = fieldEl.value ? formatFieldName(fieldEl.value) : "未入力";
    confirmGradeEl.textContent = gradeEl.value || "未入力";
    confirmUserEl.textContent = userEl.value || "未入力";
    confirmTotalWeightEl.textContent = total.toFixed(2);
    saveConfirmEl.classList.toggle("is-incomplete", !dateEl.value || !fieldEl.value || !gradeEl.value || !USER_OPTIONS.includes(userEl.value) || total <= 0);
  }

  function setMemoOpen(open, focus = false) {
    memoOpen = Boolean(open);
    memoBodyEl.hidden = !memoOpen;
    btnMemoToggle.textContent = memoOpen ? "メモを閉じる" : "メモを追加";
    btnMemoToggle.setAttribute("aria-expanded", String(memoOpen));
    if (memoOpen && focus) {
      memoEl.focus();
      window.setTimeout(() => memoEl.focus(), 50);
    }
  }

  function syncMemoOpenFromValue() {
    setMemoOpen(Boolean(String(memoEl.value || "").trim()), false);
  }

  function updateETotal() {
    const ws = getWeightsFrom(eWeightsWrap);
    eTotalWeightEl.textContent = fmtWeightOne(sumWeights(ws));
  }

  function focusLastWeightInput(container) {
    const inputs = [...container.querySelectorAll("input")];
    const last = inputs[inputs.length - 1];
    if (last) {
      last.focus();
      last.select?.();
    }
  }

  function setShowAllLogs(next) {
    showAllLogs = next;
    btnShowAll.textContent = showAllLogs ? "直近5件だけ表示" : "すべてのログを表示";
    render();
  }

  function filtered(list) {
    return list
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
      map.set(key, (map.get(key) || { total: 0, count: 0 }).total + (Number(item.total_weight) || 0));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .map(([key, value]) => `${key}: ${fmtWeight(Math.round(value.total * 100) / 100)}kg`);
  }

  function buildAggregate(list, keySelector) {
    const map = new Map();
    for (const item of list) {
      const key = keySelector(item) || "(未設定)";
      const current = map.get(key) || { total: 0, count: 0 };
      current.total += getRecordTotal(item);
      current.count += 1;
      map.set(key, current);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .map(([key, value]) => ({ key, total: Math.round(value.total * 100) / 100, count: value.count }));
  }

  function getRecordTotal(record) {
    const total = Number(record?.total_weight);
    if (Number.isFinite(total) && total > 0) return total;
    const weights = Array.isArray(record?.weights) ? record.weights.map(Number).filter((value) => Number.isFinite(value)) : [];
    return sumWeights(weights);
  }

  function getRecordSummary(records) {
    const items = Array.isArray(records) ? records : [];
    return { total: sumWeights(items.map((item) => getRecordTotal(item))), count: items.length };
  }

  function formatComparison(current, previous, withDiff = false) {
    if (!Number.isFinite(previous) || previous <= 0) return `<span class="summaryMetric__muted">前年データなし</span>`;
    const diff = Math.round((current - previous) * 10) / 10;
    const percent = Math.round(((current - previous) / previous) * 1000) / 10;
    const sign = percent >= 0 ? "+" : "";
    const diffSign = diff >= 0 ? "+" : "";
    return `
      <span class="summaryMetric__delta ${percent >= 0 ? "is-plus" : "is-minus"}">前年比 ${sign}${percent.toFixed(1)}%</span>
      ${withDiff ? `<span class="summaryMetric__muted">前年差 ${diffSign}${fmtWeightOne(diff)}kg</span>` : ""}
    `;
  }

  function formatMiniComparisonText(current, previous) {
    if (!Number.isFinite(previous) || previous <= 0) return "前年なし";
    const percent = Math.round(((current - previous) / previous) * 1000) / 10;
    const sign = percent >= 0 ? "+" : "";
    return `前年比 ${sign}${percent.toFixed(1)}%`;
  }

  function renderInputMiniSummary(records) {
    const now = todayStr();
    const thisMonth = now.slice(0, 7);
    const thisYear = now.slice(0, 4);
    const previousMonth = `${Number(thisYear) - 1}-${thisMonth.slice(5, 7)}`;
    const monthSummary = getRecordSummary(filterRecordsByMonth(records, thisMonth));
    const previousMonthSummary = getRecordSummary(filterRecordsByMonth(records, previousMonth));
    inputMiniMonthWeightEl.textContent = `${fmtWeightOne(monthSummary.total)}kg`;
    inputMiniMonthCompareEl.textContent = formatMiniComparisonText(monthSummary.total, previousMonthSummary.total);
    inputMiniMonthCompareEl.classList.toggle("is-minus", previousMonthSummary.total > 0 && monthSummary.total < previousMonthSummary.total);
    inputMiniMonthCompareEl.classList.toggle("is-plus", previousMonthSummary.total > 0 && monthSummary.total >= previousMonthSummary.total);
  }

  function buildMonthlyYearTotals(records, year) {
    const yearText = String(year || "").slice(0, 4);
    const groups = buildAggregate(filterRecordsByYear(records, yearText), (item) => getRecordMonth(item));
    const map = new Map(groups.map((item) => [item.key, item]));
    return Array.from({ length: 12 }, (_, index) => {
      const key = `${yearText}-${String(index + 1).padStart(2, "0")}`;
      return map.get(key) || { key, total: 0, count: 0 };
    });
  }

  function getFieldKey(record) {
    return String(record?.field || "(未設定)");
  }

  function filterRecordsByField(records, fieldKey) {
    const key = String(fieldKey || "(未設定)");
    return records.filter((record) => getFieldKey(record) === key);
  }

  function buildFieldMonthlyComparison(records, year, fieldKey) {
    const currentYear = String(year || "").slice(0, 4);
    const previousYear = String(Number(currentYear) - 1);
    const current = buildMonthlyYearTotals(filterRecordsByField(records, fieldKey), currentYear);
    const previous = buildMonthlyYearTotals(filterRecordsByField(records, fieldKey), previousYear);
    return current.map((item, index) => ({
      key: item.key,
      label: formatMonthShort(item.key),
      current: item.total,
      previous: previous[index]?.total || 0,
      diff: Math.round((item.total - (previous[index]?.total || 0)) * 10) / 10,
    })).filter((item) => item.current > 0 || item.previous > 0);
  }

  function renderMetricBar(width, className = "") {
    return `<span class="summaryMetricBar ${className}"><span style="width:${Math.max(0, Math.min(100, width))}%"></span></span>`;
  }

  function formatDiffValue(current, previous) {
    if (!Number.isFinite(previous) || previous <= 0) return { text: "前年なし", className: "is-empty" };
    const diff = Math.round((current - previous) * 10) / 10;
    const percent = Math.round(((current - previous) / previous) * 1000) / 10;
    const sign = diff >= 0 ? "+" : "";
    const percentSign = percent >= 0 ? "+" : "";
    return {
      text: `${sign}${fmtWeightOne(diff)}kg / ${percentSign}${percent.toFixed(1)}%`,
      className: diff >= 0 ? "is-plus" : "is-minus",
    };
  }

  function renderFieldMonthlyTrend(records, year, fieldKey) {
    const rows = buildFieldMonthlyComparison(records, year, fieldKey);
    if (!rows.length) return `<div class="summaryEmpty">月別推移データはありません</div>`;
    const max = Math.max(0, ...rows.map((item) => item.current));
    return `<div class="summaryFieldTrend">
      <div class="summaryFieldTrend__title">${escapeHtml(formatFieldName(fieldKey))} 月別推移</div>
      ${rows.map((item) => {
        const diffText = item.previous > 0 ? `${item.diff >= 0 ? "+" : ""}${fmtWeightOne(item.diff)}kg` : "前年なし";
        return `<div class="summaryFieldTrend__row">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(fmtWeightOne(item.current))}kg</strong>
          <small>${escapeHtml(String(Number(year) - 1))}年 ${escapeHtml(fmtWeightOne(item.previous))}kg / ${escapeHtml(diffText)}</small>
          ${renderMetricBar(max ? (item.current / max) * 100 : 0, getFieldBadgeClass(fieldKey))}
        </div>`;
      }).join("")}
    </div>`;
  }

  function formatDateJapanese(dateValue) {
    const value = String(dateValue || "");
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
  }

  function formatDateShort(dateValue) {
    return formatDateJapanese(dateValue);
  }

  function formatDateShortMonthDay(dateValue) {
    const value = String(dateValue || "");
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    return `${Number(match[2])}月${Number(match[3])}日`;
  }

  function formatDateMonthDay(dateValue) {
    return formatDateShortMonthDay(dateValue);
  }

  function formatMonthJapanese(monthKey) {
    const value = String(monthKey || "");
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) return value;
    return `${Number(match[1])}年${Number(match[2])}月`;
  }

  function formatMonthShort(monthKey) {
    const value = String(monthKey || "");
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) return value;
    return `${Number(match[2])}月`;
  }

  function formatMonthLabel(monthKey) {
    return formatMonthShort(monthKey);
  }

  function formatFieldName(field) {
    const raw = String(field || "").trim();
    if (!raw || raw === "(未設定)") return "(未設定)";
    if (/^3上$/.test(raw) || /^3工区上$/.test(raw)) return "3工区上";
    if (/^3下$/.test(raw) || /^3工区下$/.test(raw)) return "3工区下";
    return /工区$/.test(raw) ? raw : `${raw}工区`;
  }

  function isAgrinoteRecord(record) {
    return String(record?.user || "") === "アグリノート" || String(record?.id || "").startsWith("agrinote-");
  }

  function dedupeRecordKey(record) {
    return [
      String(record?.date || ""),
      String(record?.field || ""),
      String(record?.grade || ""),
      String(record?.total_weight || ""),
      String(record?.memo || "").trim(),
      String(record?.weights || "").trim(),
    ].join("|");
  }

  function getAvailableMonths(records) {
    return [...new Set(records.map((record) => getRecordMonth(record)).filter(Boolean))].sort((a, b) => String(b).localeCompare(String(a), "ja"));
  }

  function summarizeRecordsForStatus(records) {
    const valid = Array.isArray(records) ? records.filter((record) => record && typeof record === "object") : [];
    const agrinote = valid.filter((record) => isAgrinoteRecord(record));
    const duplicateCount = (() => {
      const seen = new Set();
      let count = 0;
      for (const record of agrinote) {
        const key = dedupeRecordKey(record);
        if (seen.has(key)) count += 1;
        else seen.add(key);
      }
      return count;
    })();
    const dates = valid.map((record) => String(record?.date || "")).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
    const period = dates.length ? `${formatDateJapanese(dates[0])}〜${formatDateJapanese(dates[dates.length - 1])}` : "—";
    return {
      total: valid.length,
      agrinote: agrinote.length,
      duplicateCount,
      period,
    };
  }

  function renderSummaryMonthLogs(records) {
    if (!Array.isArray(records) || !records.length) return `<div class="summaryEmpty">この月のログはありません</div>`;
    return records
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""), "ja");
      })
      .map((item) => {
        const totalWeight = getRecordTotal(item);
        return `<div class="summaryMonthLog">
          <div class="summaryMonthLog__main">
            <span class="summaryMonthLog__date">${escapeHtml(formatDateMonthDay(item.date))}</span>
            <span class="item__pill item__pill--field ${getFieldBadgeClass(item.field)}">${escapeHtml(formatFieldName(item.field))}</span>
            <span class="item__pill item__pill--grade ${getGradeBadgeClass(item.grade)}"><span class="badgeDot"></span>${escapeHtml(formatGradeBadge(item.grade))}</span>
            <span class="summaryMonthLog__weight">${escapeHtml(fmtWeightOne(totalWeight))}kg</span>
            <span class="summaryMonthLog__user">入力者: ${escapeHtml(String(item.user || "未設定"))}</span>
          </div>
        </div>`;
      })
      .join("");
  }

  function formatFieldBadge(field) {
    return formatFieldName(field);
  }

  function formatGradeBadge(grade) {
    return String(grade || "(未設定)");
  }

  function getFieldBadgeClass(field) {
    const raw = String(field || "").trim().replace(/工区$/, "");
    const key = raw === "3上" ? "3上" : raw === "3下" ? "3下" : raw || "na";
    return `item__badge--field item__badge--field-${key}`;
  }

  function getGradeBadgeClass(grade) {
    const raw = String(grade || "");
    if (raw.includes("40")) return "item__badge--grade-40";
    if (raw.includes("45")) return "item__badge--grade-45";
    if (raw.includes("大枝")) return "item__badge--grade-big";
    return "item__badge--grade-na";
  }

  function formatSummaryLineMonth(item) {
    return `${formatMonthJapanese(item.key)}　${fmtWeightOne(item.total)}kg　収穫${item.count}回`;
  }

  function formatSummaryLineField(item) {
    return `${formatFieldName(item.key)}　${fmtWeightOne(item.total)}kg　収穫${item.count}回`;
  }

  function formatSummaryLineGrade(item) {
    return `${String(item.key || "(未設定)")}　${fmtWeightOne(item.total)}kg　収穫${item.count}回`;
  }

  function getRecordYear(record) {
    return String(record?.date || "").slice(0, 4);
  }

  function getRecordMonth(record) {
    return String(record?.date || "").slice(0, 7);
  }

  function filterRecordsByMonth(records, selectedMonth) {
    const month = String(selectedMonth || "").slice(0, 7);
    return records.filter((record) => String(record?.date || "").startsWith(month));
  }

  function filterRecordsByYear(records, selectedYear) {
    const year = String(selectedYear || "").slice(0, 4);
    return records.filter((record) => String(record?.date || "").startsWith(year));
  }

  function formatDayGroupTitle(dateKey) {
    return formatDateShortMonthDay(dateKey);
  }

  function formatSummaryLineDay(item) {
    return `${formatDateShortMonthDay(item.dateKey)}`;
  }

  function formatSummaryLineDayRow(item) {
    const fieldName = formatFieldName(item.field);
    const gradeName = String(item.grade || "(未設定)");
    const memoText = String(item.memo || "").trim();
    return {
      fieldName,
      gradeName,
      weight: formatWeight(item.total_weight),
      memoText,
    };
  }

  function setShowAllPastMonths(next) {
    showAllPastMonths = next;
    render();
  }

  function setShowDayBreakdown(next) {
    showDayBreakdown = next;
    render();
  }

  function setSummaryMode(next) {
    summaryMode = next;
    render();
  }

  function setManagePanelOpen(open) {
    managePanel.hidden = !open;
    btnManageToggle.textContent = open ? "管理を閉じる" : "管理を開く";
    btnManageToggle.setAttribute("aria-expanded", String(open));
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
    const availableYears = [...new Set(base.map((record) => getRecordYear(record)).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    const selectedYear = selectedSummaryYear && availableYears.includes(selectedSummaryYear) ? selectedSummaryYear : (availableYears[0] || todayStr().slice(0, 4));
    selectedSummaryYear = selectedYear;
    const yearRecords = filterRecordsByYear(base, selectedYear);
    const previousYearRecords = filterRecordsByYear(base, String(Number(selectedYear) - 1));
    const annualSummary = getRecordSummary(yearRecords);
    const previousAnnualSummary = getRecordSummary(previousYearRecords);
    const monthlyYearTotals = buildMonthlyYearTotals(base, selectedYear);
    const previousMonthlyYearTotals = buildMonthlyYearTotals(base, String(Number(selectedYear) - 1));
    const monthlyYearMax = Math.max(0, ...monthlyYearTotals.map((item) => Number(item.total) || 0), ...previousMonthlyYearTotals.map((item) => Number(item.total) || 0));
    const allYearGroups = availableYears.map((year) => {
      const items = filterRecordsByYear(base, year);
      return {
        key: year,
        total: getRecordSummary(items).total,
        count: items.length,
        months: buildAggregate(items, (item) => getRecordMonth(item)).slice().reverse(),
      };
    });
    const list = filtered(base);
    const visibleList = list.slice(0, showAllLogs ? list.length : 5);
    const yearMonthGroups = buildAggregate(yearRecords, (item) => getRecordMonth(item));
    const fieldGroups = buildAggregate(yearRecords, (item) => getFieldKey(item)).sort((a, b) => Number(b.total) - Number(a.total));
    const previousFieldGroups = buildAggregate(previousYearRecords, (item) => getFieldKey(item));
    const previousFieldMap = new Map(previousFieldGroups.map((item) => [item.key, item]));
    const fieldBarMax = Math.max(0, ...fieldGroups.map((item) => Number(item.total) || 0));
    const visibleYearMonths = yearMonthGroups;
    const yearBarMax = Math.max(0, ...visibleYearMonths.map((item) => Number(item.total) || 0));
    const yearCardMax = Math.max(0, ...allYearGroups.map((item) => Number(item.total) || 0));
    const statusSummary = summarizeRecordsForStatus(base);
    renderInputMiniSummary(base);
    const selectedMonthForYear = `${selectedYear || todayStr().slice(0, 4)}-${todayStr().slice(5, 7)}`;
    const previousSelectedMonthKey = `${Number(String(selectedMonthForYear).slice(0, 4)) - 1}-${String(selectedMonthForYear).slice(5, 7)}`;
    const selectedMonthSummary = getRecordSummary(filterRecordsByMonth(base, selectedMonthForYear));
    const previousSelectedMonthSummary = getRecordSummary(filterRecordsByMonth(base, previousSelectedMonthKey));
    const yearSwitchHtml = availableYears.length
      ? `<div class="summaryYearPicker">
          <div class="summaryYearPicker__label">集計年：分析カードの表示年</div>
          <div class="summaryYearPicker__buttons">
            ${availableYears.map((year) => `<button class="summaryYearPicker__btn ${year === selectedYear ? "is-active" : ""}" type="button" data-summary-select-year="${escapeAttr(year)}" aria-pressed="${year === selectedYear ? "true" : "false"}">${escapeHtml(year)}年</button>`).join("")}
          </div>
        </div>`
      : "";
    const monthlyTrendHtml = monthlyYearTotals.length
      ? monthlyYearTotals.map((item, index) => {
        const previous = previousMonthlyYearTotals[index]?.total || 0;
        const diff = formatDiffValue(item.total, previous);
        return `<div class="summaryMonthCompare">
          <div class="summaryMonthCompare__head">
            <span>${escapeHtml(formatMonthShort(item.key))}</span>
            <strong>${escapeHtml(fmtWeightOne(item.total))}kg</strong>
          </div>
          <div class="summaryMonthCompare__bars">
            <span>${escapeHtml(selectedYear)}年</span>
            ${renderMetricBar(monthlyYearMax ? (item.total / monthlyYearMax) * 100 : 0, "summaryMetricBar--current")}
            <strong>${escapeHtml(fmtWeightOne(item.total))}kg</strong>
            <span>${escapeHtml(String(Number(selectedYear) - 1))}年</span>
            ${renderMetricBar(monthlyYearMax ? (previous / monthlyYearMax) * 100 : 0, "summaryMetricBar--previous")}
            <strong>${previous > 0 ? `${escapeHtml(fmtWeightOne(previous))}kg` : "前年なし"}</strong>
          </div>
          <div class="summaryMonthCompare__diff ${diff.className}">${escapeHtml(diff.text)}</div>
        </div>`;
      }).join("")
      : `<div class="summaryEmpty">この年の月別データはありません</div>`;
    const monthlyTrendToggleText = monthlyTrendOpen ? "▼ 月別収穫量を閉じる" : "〉 月別収穫量を見る";
    const fieldComparisonHtml = fieldGroups.length
      ? fieldGroups.map((item) => {
        const isOpen = openSummaryField === item.key;
        const previous = previousFieldMap.get(item.key)?.total || 0;
        return `<div class="summaryFieldBlock ${isOpen ? "is-open" : ""}">
          <button class="summaryMetricRow summaryMetricRow--field summaryMetricField" type="button" data-summary-field="${escapeAttr(item.key)}" aria-expanded="${isOpen ? "true" : "false"}">
            <span class="item__pill item__pill--field ${getFieldBadgeClass(item.key)}">${escapeHtml(formatFieldName(item.key))}</span>
            <span class="summaryMetricField__numbers">
              <strong>${escapeHtml(fmtWeightOne(item.total))}kg</strong>
              <small>${formatComparison(item.total, previous, true)}</small>
            </span>
            ${renderMetricBar(fieldBarMax ? (item.total / fieldBarMax) * 100 : 0, getFieldBadgeClass(item.key))}
            <span class="summaryLine__arrow">${isOpen ? "⌃" : "〉"}</span>
          </button>
          ${isOpen ? renderFieldMonthlyTrend(base, selectedYear, item.key) : ""}
        </div>`;
      }).join("")
      : `<div class="summaryEmpty">この年の圃場別データはありません</div>`;
    const summaryYearHtml = allYearGroups.length
      ? allYearGroups.map((item) => {
          const months = item.months || [];
          const isYearOpen = openSummaryYear === item.key;
          const yearArrow = isYearOpen ? "▼" : "〉";
          const monthBarMax = Math.max(0, ...months.map((month) => Number(month.total) || 0));
          return `
            <div class="summaryYearBlock ${isYearOpen ? "is-open" : ""}">
              <button class="summaryLine summaryLine--bar summaryLine--year" type="button" data-summary-year="${escapeAttr(item.key)}" aria-expanded="${isYearOpen ? "true" : "false"}">
                <span class="summaryLabel">${escapeHtml(item.key)}年</span>
                <span class="summaryLine__count"><strong>${escapeHtml(formatWeight(item.total))}kg</strong>　収穫${escapeHtml(item.count)}回</span>
                <span class="summaryBar"><span class="summaryBar__fill" style="width:${yearCardMax ? Math.max(12, (item.total / yearCardMax) * 100) : 0}%"></span></span>
                <span class="summaryLine__arrow">${yearArrow}</span>
              </button>
              ${isYearOpen && months.length ? `
                <div class="summaryMonthList">
                  ${months.map((monthItem) => {
                    const monthOpen = openSummaryYear === item.key && openSummaryMonth === monthItem.key;
                    const monthArrow = monthOpen ? "▼" : "〉";
                    const monthRecordsForOpen = monthOpen ? filterRecordsByMonth(filterRecordsByYear(base, item.key), monthItem.key) : [];
                    return `
                      <div class="summaryMonthBlock ${monthOpen ? "is-open" : ""}">
                        <button class="summaryLine summaryLine--bar summaryLine--month" type="button" data-summary-year="${escapeAttr(item.key)}" data-summary-month="${escapeAttr(monthItem.key)}" aria-expanded="${monthOpen ? "true" : "false"}">
                          <span class="summaryLabel">${escapeHtml(formatMonthLabel(monthItem.key))}</span>
                          <span class="summaryLine__count"><strong>${escapeHtml(formatWeight(monthItem.total))}kg</strong>　収穫${escapeHtml(monthItem.count)}回</span>
                          <span class="summaryBar"><span class="summaryBar__fill" style="width:${monthBarMax ? Math.max(12, (monthItem.total / monthBarMax) * 100) : 0}%"></span></span>
                          <span class="summaryLine__arrow">${monthArrow}</span>
                        </button>
                        ${monthOpen ? `<div class="summaryMonthLogs">${renderSummaryMonthLogs(monthRecordsForOpen)}</div>` : ""}
                      </div>`;
                  }).join("")}
                </div>
              ` : ""}
            </div>`;
        }).join("")
      : `<div class="summaryEmpty">集計データはありません</div>`;

    summaryEl.innerHTML = `
      <div class="summaryGrid">
        ${yearSwitchHtml}
        <div class="summaryCard summaryMetric summaryMetric--current">
          <div class="summaryCard__label">${selectedYear === todayStr().slice(0, 4) ? "今月の収穫量" : `${escapeHtml(formatMonthJapanese(selectedMonthForYear))}の収穫量`}</div>
          <div class="summaryMetric__value">${escapeHtml(fmtWeightOne(selectedMonthSummary.total))}kg</div>
          <div class="summaryMetric__meta">${formatMonthJapanese(selectedMonthForYear)} / 収穫${escapeHtml(selectedMonthSummary.count)}回</div>
          <div class="summaryMetric__meta">${formatComparison(selectedMonthSummary.total, previousSelectedMonthSummary.total)}</div>
        </div>
        <div class="summaryCard summaryMetric">
          <div class="summaryCard__label">年間収穫量</div>
          <div class="summaryMetric__year">${escapeHtml(selectedYear || "-")}年</div>
          <div class="summaryMetric__value">${escapeHtml(fmtWeightOne(annualSummary.total))}kg</div>
          <div class="summaryMetric__meta">${formatComparison(annualSummary.total, previousAnnualSummary.total, true)}</div>
          <div class="summaryMetric__meta">収穫${escapeHtml(annualSummary.count)}回</div>
        </div>
        <div class="summaryCard summaryCard--list">
          <div class="summaryCard__label">月別収穫量</div>
          <div class="summaryCard__meta">対象年の月別推移を確認できます</div>
          <button class="summaryToggle summaryToggle--wide" type="button" data-summary-monthly-toggle aria-expanded="${monthlyTrendOpen ? "true" : "false"}">${monthlyTrendToggleText}</button>
          ${monthlyTrendOpen ? `<div class="summaryCard__list summaryCard__list--monthly">${monthlyTrendHtml}</div>` : ""}
        </div>
        <div class="summaryCard summaryCard--list">
          <div class="summaryCard__label">圃場別収穫量</div>
          <div class="summaryCard__list">
            ${fieldComparisonHtml}
          </div>
        </div>
        <div class="summaryCard summaryCard--list">
          <div class="summaryCard__label">年間詳細</div>
          <div class="summaryCard__meta">年ごとの月別ログを見る</div>
          <div class="summaryCard__list">
            ${summaryYearHtml}
          </div>
        </div>
      </div>
    `;

    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    if (!visibleList.length) {
      const empty = document.createElement("div");
      empty.className = "item item--empty";
      empty.textContent = "集計データはありません";
      frag.appendChild(empty);
      listEl.appendChild(frag);
      return;
    }

    for (const e of visibleList) {
      const item = document.createElement("div");
      item.className = `item ${String(e.id) === recentlySavedId ? "item--saved" : ""}`;
      const fieldName = formatFieldName(e.field);
      const memoText = String(e.memo || "").trim();
      const totalWeight = fmtWeightOne(Number(e.total_weight) || 0);
      const dateText = escapeHtml(formatDateShortMonthDay(e.date) || formatDateJapanese(e.date));
      item.innerHTML = `
        <div class="item__layout">
          <div class="item__body">
            <div class="item__head">
              <span class="item__date">${dateText}</span>
              <span class="item__field item__pill item__pill--field ${getFieldBadgeClass(e.field)}">${escapeHtml(fieldName)}</span>
            </div>
            <div class="item__weight">${escapeHtml(totalWeight)}kg</div>
            <div class="item__sub">
              <span class="item__tag item__tag--grade">${escapeHtml(formatGradeBadge(e.grade))}</span>
              <span class="item__tag item__tag--user">${escapeHtml(e.user || "-")}</span>
            </div>
            ${memoText ? `<div class="item__memo">📝 ${escapeHtml(memoText)}</div>` : ""}
          </div>
          <div class="item__actions">
          <button class="btn" type="button" data-act="edit" data-id="${escapeAttr(e.id)}" ${demoMode ? "disabled" : ""}>編集</button>
          <button class="btn btn--danger" type="button" data-act="del" data-id="${escapeAttr(e.id)}" ${demoMode ? "disabled" : ""}>削除</button>
        </div>
        </div>
      `;
      frag.appendChild(item);
    }

    listEl.appendChild(frag);

    const src = sheetEntries ? CLOUD_SOURCE_LABEL : "この端末に保存中";
    logSourceEl.textContent = `${src}`;
    statusEl.textContent = `データ期間：${statusSummary.period} / 総件数：${statusSummary.total}件 / アグリノート：${statusSummary.agrinote}件${statusSummary.duplicateCount ? ` / 重複候補：${statusSummary.duplicateCount}件` : ""}`;
    btnShowAll.textContent = showAllLogs ? "直近5件だけ表示" : "すべてのログを表示";
    if (demoBannerEl) {
      demoBannerEl.hidden = !demoMode;
      demoBannerEl.textContent = demoMode ? "表示確認モード：ダミーデータを表示中です" : "";
    }
    btnFetch.disabled = demoMode;
    btnExportCsv.disabled = false;
    btnExportJson.disabled = false;
    btnClear.disabled = demoMode;
    form.querySelector('button[type="submit"]').disabled = demoMode;
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
  }

  function setImportStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function summarizeImportPayload(entry) {
    return {
      date: String(entry?.date || ""),
      field: String(entry?.field || "") || "未設定",
      grade: String(entry?.grade || "") || "(未設定)",
      total_weight: Number(entry?.total_weight || 0),
      user: String(entry?.user || ""),
      memo: Boolean(String(entry?.memo || "").trim()),
    };
  }

  function detectSafariIOS() {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  }

  function openEdit(id) {
    if (demoMode) {
      toast("warn", "表示確認モードでは編集できません");
      return;
    }
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    editingId = id;

    eDate.value = e.date;
    eField.value = e.field;
    renderSelectOptions(eGrade, getGradeOptions([e.grade]), e.grade);
    eGrade.value = e.grade;
    renderUserOptions(eUser, e.user, true);
    eUser.value = e.user;
    eMemo.value = e.memo;

    setWeightsTo(eWeightsWrap, e.weights, updateETotal, updateETotal);
    syncCalcFromWeights(e.weights);
    updateETotal();

    dlgEdit.showModal();
  }

  async function commitEdit() {
    if (demoMode) {
      throw new Error("表示確認モードでは保存できません");
    }
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
    if (!user) {
      alert("入力者を選択してください");
      return;
    }
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
    const name = "sakaki-harvest.csv";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

    const importedAgrinote = imported.filter((record) => isAgrinoteRecord(record));
    const importedTest = imported.filter((record) => !isAgrinoteRecord(record));
    const existingLocalAgrinote = entries.filter((record) => isAgrinoteRecord(record));
    const existingLocalTest = entries.filter((record) => !isAgrinoteRecord(record));
    if (!Array.isArray(sheetEntries)) {
      await fetchCloudRecords({ silent: true });
    }
    const existingCloudAgrinote = Array.isArray(sheetEntries) ? sheetEntries.filter((record) => isAgrinoteRecord(record)) : [];
    const existingCloudTest = Array.isArray(sheetEntries) ? sheetEntries.filter((record) => !isAgrinoteRecord(record)) : [];
    const importedAgrinoteUnique = [...new Map(importedAgrinote.map((record) => [record.id, record])).values()].filter((record) => Number(record.total_weight) > 0 && Number.isFinite(Number(record.total_weight)));
    const existingAgrinoteMap = new Map([...existingLocalAgrinote, ...existingCloudAgrinote].map((record) => [record.id, record]));
    const duplicateCandidates = importedAgrinote.filter((record) => {
      if (existingAgrinoteMap.has(record.id)) return true;
      const key = dedupeRecordKey(record);
      return [...existingAgrinoteMap.values()].some((current) => dedupeRecordKey(current) === key);
    });
    const nextAgrinote = importedAgrinoteUnique.filter((record) => {
      if (existingAgrinoteMap.has(record.id)) return false;
      const key = dedupeRecordKey(record);
      return ![...existingAgrinoteMap.values()].some((current) => dedupeRecordKey(current) === key);
    });
    const replaceCount = importedAgrinoteUnique.length;
    const keepCount = existingLocalTest.length + importedTest.length;

    const confirmMessage = `アグリノートデータを取り込みます。既存のアグリノートデータを入れ替えてから取り込みますか？重複を防ぐため、通常は入れ替えを選んでください。\n\n既存アグリノート件数：${existingAgrinoteMap.size}件\n新規取込件数：${importedAgrinote.length}件\n重複候補：${duplicateCandidates.length}件\n入れ替え後の件数：${keepCount + replaceCount}件`;
    if (!confirm(confirmMessage)) return;

    const nextLocal = [...existingLocalTest, ...importedTest, ...importedAgrinoteUnique];

    let syncFailed = false;
    let syncErrorMessage = "";
    let syncedCount = 0;
    let syncedAgrinote = [];
    if (importedAgrinoteUnique.length) {
      try {
        const firstRecord = importedAgrinoteUnique[0];
        setImportStatus(`D1保存テスト中：${firstRecord.date} / ${formatFieldName(firstRecord.field)} / ${formatWeight(firstRecord.total_weight)}kg`);
        const testedRecord = await createCloudRecordForImport(firstRecord);
        syncedAgrinote.push(testedRecord);
        const continueOk = confirm(`1件目のD1保存に成功しました。\n\nこのまま残り${Math.max(0, importedAgrinoteUnique.length - 1)}件を保存しますか？`);
        if (continueOk) {
          for (const record of importedAgrinoteUnique.slice(1)) {
            const saved = await createCloudRecordForImport(record);
            syncedAgrinote.push(saved);
          }
          syncedCount = syncedAgrinote.length;
          sheetEntries = [...existingCloudTest, ...syncedAgrinote];
          await fetchCloudRecords({ silent: true });
        } else {
          syncFailed = true;
          syncErrorMessage = "取り込みを中止しました";
          setImportStatus(syncErrorMessage);
        }
      } catch (err) {
        syncFailed = true;
        const detail = {
          status: err?.status || err?.httpStatus || "-",
          statusText: err?.statusText || "",
          body: err?.rawText || "",
          message: String(err?.message || err),
        };
        syncErrorMessage = `D1保存は途中で失敗しました（${syncedAgrinote.length + 1}件目） / status:${detail.status} ${detail.statusText} / ${detail.message}`;
        setImportStatus(syncErrorMessage);
        console.error("[JSON import] cloud sync failed =", detail.status, detail.statusText, detail.message);
        sheetEntries = null;
      }
    } else if (canSyncCloud && !importedAgrinoteUnique.length) {
      syncFailed = true;
      syncErrorMessage = "D1保存対象のアグリノートデータがありません";
      setImportStatus(syncErrorMessage);
    }

    entries = [...new Map(nextLocal.map((record) => [record.id, record])).values()];
    if (!syncFailed && canSyncCloud && importedAgrinoteUnique.length) {
      sheetEntries = [...existingCloudTest, ...syncedAgrinote];
    }

    const latestImported = imported
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null;
    if (latestImported?.date) {
      selectedSummaryYear = String(latestImported.date).slice(0, 4);
    }

    saveLocal();
    render();
    const importedMessage = `${replaceCount}件を読み込みました`;
    const cloudMessage = syncFailed
      ? `（D1保存に失敗しました。端末内にのみ保存されています${syncErrorMessage ? ` / ${syncErrorMessage}` : ""}）`
      : `（D1へ${syncedCount || replaceCount}件保存しました）`;
    toast(syncFailed ? "warn" : "ok", `${importedMessage}${cloudMessage}`);
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

  async function clearTestData() {
    if (demoMode) {
      toast("warn", "表示確認モードでは削除できません");
      return;
    }
    const base = getDisplayRecords();
    const targets = base.filter((record) => !isAgrinoteRecord(record));
    const keeperCount = base.length - targets.length;
    if (!targets.length) {
      toast("warn", "削除対象のテストデータはありません");
      return;
    }
    const ok = confirm(`アグリノート以外のテストデータを削除します。アグリノート取込データは残します。この操作は元に戻せません。実行しますか？\n\n削除対象：${targets.length}件\n保持対象：アグリノートデータ ${keeperCount}件`);
    if (!ok) return;
    for (const record of targets) {
      await deleteRecordById(record.id, { silent: true });
    }
    entries = entries.filter((record) => isAgrinoteRecord(record));
    sheetEntries = Array.isArray(sheetEntries) ? sheetEntries.filter((record) => isAgrinoteRecord(record)) : sheetEntries;
    saveLocal();
    render();
    toast("ok", `テストデータを削除しました（${targets.length}件）`);
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
      return { ok: false, error: "Apps Script URL未設定" };
    }

    const useFormTransport = detectSafariIOS() || true;
    const body = JSON.stringify(payload);

    if (useFormTransport) {
      ensureSubmitProxy();
      if (!submitProxyForm || !submitPayloadInput) {
        return { ok: false, error: "form送信の準備に失敗しました", transport: "form" };
      }

      submitProxyForm.action = endpoint;
      submitPayloadInput.value = body;

      try {
        submitProxyForm.submit();
      } catch (err) {
        console.error("[Sheets] form submit error =", err);
        return { ok: false, error: `form submit error: ${String(err)}`, transport: "form" };
      }

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
    } catch (err) {
      console.error("[Sheets] POST fetch error =", err);
      return { ok: false, error: `fetch error: ${String(err)}`, transport: "fetch" };
    }

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
      const res = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
      });
      const text = await res.text();

      const p = safeParseJSON(text);
      if (!p.ok) throw new Error("JSON parse failed");
      const v = p.value;
      if (!v?.ok) throw new Error(String(v?.error || "GAS error"));
      const contextBits = [
        v.spreadsheetId ? `spreadsheetId=${v.spreadsheetId}` : "",
        v.sheetName ? `sheetName=${v.sheetName}` : "",
        Number.isFinite(Number(v.lastRow)) ? `lastRow=${v.lastRow}` : "",
        Number.isFinite(Number(v.lastColumn)) ? `lastColumn=${v.lastColumn}` : "",
      ].filter(Boolean);
      toast("ok", `GET結果${contextBits.length ? ` / ${contextBits.join(" / ")}` : ""}`);

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
    if (demoMode) {
      toast("warn", "表示確認モードでは保存できません");
      return;
    }

    const date = dateEl.value.trim();
    const field = fieldEl.value;
    const grade = gradeEl.value;
    const user = userEl.value;
    const memo = memoEl.value.trim();
    const weights = getWeightsFrom(weightsWrap);

    if (!date) return;
    if (!USER_OPTIONS.includes(user)) {
      toast("warn", "入力者を選択してください");
      userEl.focus();
      updateSaveConfirm();
      return;
    }
    if (weights.length === 0) {
      toast("warn", "重量を1つ以上入力してください");
      return;
    }

    const total_weight = sumWeights(weights);
    setSaveButtonState("saving");

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
      toast("warn", "保存中...");
      const savedRecord = await createCloudRecord(entry);
      toast("ok", `保存しました ${formatDateShortMonthDay(savedRecord.date)} ${fmtWeight(savedRecord.total_weight)}kg`);

      const localBackup = entries.slice();
      upsertLocalRecord(savedRecord);
      recentlySavedId = String(savedRecord.id || "");
      resetFormDefaults();
      dateEl.value = date;
      fieldEl.value = field;
      applyLockedUser();
      gradeEl.value = "";
      memoEl.value = "";
      setMemoOpen(false);
      setWeightsTo(weightsWrap, [""], updateTotal, updateTotal);
      updateTotal();
      requestAnimationFrame(() => focusLastWeightInput(weightsWrap));
      sheetEntries = sheetEntries ? [savedRecord, ...sheetEntries.filter((record) => record.id !== savedRecord.id)] : [savedRecord];
      entries = [
        ...sheetEntries,
        ...localBackup.filter((record) => !sheetEntries.some((cloudRecord) => cloudRecord.id === record.id)),
      ];
      saveLocal();
      render();
      showSaveNotice(savedRecord);
      setSaveButtonState("saved");

      if (getEndpoint()) {
        void postToSheets(buildPostPayload(savedRecord));
      }
      window.setTimeout(async () => {
        const refreshResult = await fetchCloudRecords({ silent: true });
        if (refreshResult?.ok) {
          recentlySavedId = String(savedRecord.id || "");
          render();
          setSaveButtonState("saved");
        } else {
          toast("warn", "送信しました。D1を確認してください");
        }
      }, 1200);
      return;
    } catch (err) {
      // 失敗時はlocalStorageへ一時保存
      entries.push(entry);
      saveLocal();
      toast("err", "保存に失敗しました。通信状況を確認してください");
      showSaveNotice(entry, true);
      setSaveButtonState("idle");
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
    if (ocrImageLibraryEl) ocrImageLibraryEl.value = "";
    if (calcManualWeightEl) calcManualWeightEl.value = "";
    setOcrPreview("");
    setOcrStatus("");
    setOcrDetailsOpen(false);
    renderOcrCandidates([]);

    renderUserOptions(eUser);
    applyLockedUser();
    syncMemoOpenFromValue();
    updateSaveConfirm();
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

  async function init() {
    entries = demoMode ? demoRecordList() : loadLocal();
    sheetEntries = null;

    renderGradeSettings();
    setOcrDetailsOpen(false);
    if (demoMode) {
      const demoDate = entries[0]?.date || todayStr();
      dateEl.value = demoDate;
    }

    form.addEventListener("submit", handleSave);
    btnAddWeight?.addEventListener("click", () => {
      syncCalcFromWeights(getWeightsFrom(weightsWrap));
      requestAnimationFrame(() => {
        calcManualWeightEl.focus();
        calcManualWeightEl.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    lockUserEl.addEventListener("change", updateLockedUserFromUI);
    userEl.addEventListener("change", () => {
      if (lockUserEl.checked) updateLockedUserFromUI();
      else updateSaveConfirm();
    });

    btnClear.addEventListener("click", clearAllLocal);
    btnFetch.addEventListener("click", () => fetchCloudRecords({ silent: false }));
    btnExportCsv.addEventListener("click", exportCsv);
    btnExportJson.addEventListener("click", exportJson);
    btnAddGrade.addEventListener("click", addCustomGrade);
    newGradeNameEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        addCustomGrade();
      }
    });
    btnMemoToggle.addEventListener("click", () => setMemoOpen(!memoOpen, !memoOpen));
    btnCalcManualAdd.addEventListener("click", addManualCalcWeight);
    calcManualWeightEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        addManualCalcWeight();
      }
    });
    form.addEventListener("input", updateSaveConfirm);
    form.addEventListener("change", updateSaveConfirm);
    form.addEventListener("reset", () => requestAnimationFrame(() => {
      applyLockedUser();
      syncMemoOpenFromValue();
      updateSaveConfirm();
    }));
    $("#btnClearTests").addEventListener("click", () => void clearTestData());

    btnShowAll.addEventListener("click", () => setShowAllLogs(!showAllLogs));
    btnToggleOcrDetails?.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleOcrDetails();
    });
    summaryEl.addEventListener("click", (ev) => {
      const target = /** @type {HTMLElement | null} */ (ev.target);
      const selectYearBtn = target?.closest("[data-summary-select-year]");
      const monthlyToggleBtn = target?.closest("[data-summary-monthly-toggle]");
      const fieldBtn = target?.closest("[data-summary-field]");
      const yearBtn = target?.closest("[data-summary-year]");
      const monthBtn = target?.closest("[data-summary-month]");
      if (selectYearBtn && selectYearBtn instanceof HTMLElement) {
        ev.preventDefault();
        const nextYear = String(selectYearBtn.getAttribute("data-summary-select-year") || "").slice(0, 4);
        if (nextYear) {
          selectedSummaryYear = nextYear;
          openSummaryYear = "";
          openSummaryMonth = "";
          openSummaryField = "";
          monthlyTrendOpen = false;
          render();
        }
        return;
      }
      if (monthlyToggleBtn && monthlyToggleBtn instanceof HTMLElement) {
        ev.preventDefault();
        monthlyTrendOpen = !monthlyTrendOpen;
        render();
        return;
      }
      if (fieldBtn && fieldBtn instanceof HTMLElement) {
        ev.preventDefault();
        const nextField = String(fieldBtn.getAttribute("data-summary-field") || "");
        if (nextField) {
          openSummaryField = openSummaryField === nextField ? "" : nextField;
          render();
        }
        return;
      }
      if (monthBtn && monthBtn instanceof HTMLElement) {
        ev.preventDefault();
        const nextYear = String(monthBtn.getAttribute("data-summary-year") || "").slice(0, 4);
        const nextMonth = String(monthBtn.getAttribute("data-summary-month") || "").slice(0, 7);
        if (nextYear && nextMonth) {
          if (openSummaryYear !== nextYear) openSummaryYear = nextYear;
          openSummaryMonth = openSummaryMonth === nextMonth ? "" : nextMonth;
          render();
        }
        return;
      }
      if (yearBtn && yearBtn instanceof HTMLElement) {
        ev.preventDefault();
        const nextYear = String(yearBtn.getAttribute("data-summary-year") || "").slice(0, 4);
        if (nextYear) {
          const isClosing = openSummaryYear === nextYear;
          openSummaryYear = isClosing ? "" : nextYear;
          openSummaryMonth = "";
          render();
        }
        return;
      }
    });

    ocrImageEl.addEventListener("change", () => {
      const file = ocrImageEl.files?.[0] || null;
      if (file) setOcrStatus("画像を読み込み中...");
      ocrImageEl.value = "";
      handleOcrImageFile(file);
    });
    ocrImageLibraryEl.addEventListener("change", () => {
      const file = ocrImageLibraryEl.files?.[0] || null;
      if (file) setOcrStatus("画像を読み込み中...");
      ocrImageLibraryEl.value = "";
      handleOcrImageFile(file);
    });

    fileImport.addEventListener("change", async () => {
      const file = fileImport.files?.[0];
      fileImport.value = "";
      if (!file) return;
      await importJsonFile(file);
    });

    listEl.addEventListener("click", handleListClick);

    btnEAddWeight.addEventListener("click", () => {
      const { row, input } = makeWeightRow(updateETotal, updateETotal);
      eWeightsWrap.appendChild(row);
      requestAnimationFrame(() => input.focus());
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
        .then((saved) => {
          editingId = null;
          dlgEdit.close();
          if (saved) {
            recentlySavedId = String(saved.id || "");
            showSaveNotice(saved);
          }
          render();
          toast("ok", "更新しました");
        })
        .catch((err) => {
          console.error("[Cloudflare] update error =", err);
          toast("err", `更新失敗: ${String(err)}`);
        });
    });

    btnSettings.addEventListener("click", openSettings);
    btnChangeAppKey.addEventListener("click", async () => {
      const value = await promptForAppKey(true);
      if (value) toast("ok", "共有キーを変更しました");
    });
    btnDeleteAppKey.addEventListener("click", () => {
      if (!confirm("この端末に保存した共有キーを削除しますか？")) return;
      localStorage.removeItem(APP_KEY_STORAGE_KEY);
      toast("ok", "共有キーを削除しました");
    });
    document.addEventListener("click", (ev) => {
      const target = /** @type {HTMLElement | null} */ (ev.target);
      const manageBtn = target?.closest("#btnManageToggle");
      if (manageBtn) {
        ev.preventDefault();
        setManagePanelOpen(managePanel.hidden);
      }
    }, true);
    settingsForm.addEventListener("submit", (ev) => {
      const submitter = /** @type {HTMLElement | null} */ (ev.submitter);
      const v = submitter?.getAttribute("value");
      if (v === "cancel") return;
      ev.preventDefault();
      saveSettingsFromDialog();
      dlgSettings.close();
    });

    resetFormDefaults();
    if (demoMode) {
      dateEl.value = entries[0]?.date || todayStr();
    }
    setManagePanelOpen(false);
    if (demoMode) {
      render();
      return;
    }
    const cloudResult = await fetchCloudRecords({ silent: true });
    if (!cloudResult.ok) {
      render();
    }
  }

  init();
})();





