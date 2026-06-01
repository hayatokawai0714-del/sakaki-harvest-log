/* eslint-disable no-alert */
(() => {
  "use strict";

  // Apps Script WebアプリURL（あとで差し替え）
  // 例: const GAS_ENDPOINT = 'https://script.google.com/macros/s/XXXX/exec';
  const GAS_ENDPOINT = "https://script.google.com/macros/s/REPLACE_ME/exec";

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
    for (const e of list) {
      const k = e.field || "(未設定)";
      byField.set(k, (byField.get(k) || 0) + (Number(e.total_weight) || 0));
    }
    const parts = [...byField.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .map(([k, v]) => `${k}: ${fmtWeight(Math.round(v * 100) / 100)}kg`);
    return { count: list.length, total, parts };
  }

  function render() {
    const base = sheetEntries ?? entries;
    const list = filtered(base);
    const summary = computeSummary(list);
    const monthLabel = monthEl.value ? `${monthEl.value} の` : "";
    summaryEl.textContent = `${monthLabel}表示件数 ${summary.count}件 / 合計 ${fmtWeight(summary.total)}kg` + (summary.parts.length ? `（${summary.parts.join(" / ")}）` : "");

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
          <div class="item__meta">${sheetEntries ? "Sheets" : "local"}</div>
        </div>
        <div class="item__grid">
          <div class="kv"><div class="kv__k">重量一覧</div><div class="kv__v">${escapeHtml(weightsText || "-")}</div></div>
          <div class="kv"><div class="kv__k">メモ</div><div class="kv__v">${escapeHtml(e.memo || "-")}</div></div>
        </div>
        ${sheetEntries ? "" : `
          <div class="item__actions">
            <button class="btn" type="button" data-act="edit" data-id="${escapeAttr(e.id)}">編集</button>
            <button class="btn btn--danger" type="button" data-act="del" data-id="${escapeAttr(e.id)}">削除</button>
          </div>
        `}
      `;
      frag.appendChild(item);
    }

    listEl.appendChild(frag);

    const src = sheetEntries ? "Sheets表示" : "localStorage表示";
    logSourceEl.textContent = src;
    const ep = getEndpoint();
    statusEl.textContent = ep ? `Sheets: 設定あり / local: ${entries.length}件` : `Sheets: 未設定 / local: ${entries.length}件`;
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

  function commitEdit() {
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
    entries[idx] = {
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

    saveLocal();
    render();
  }

  function handleListClick(ev) {
    if (sheetEntries) return; // sheets表示中は編集不可（まずは読み取りのみ）

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
      const e = entries.find((x) => x.id === id);
      if (!e) return;
      const ok = confirm(`${e.date} の記録を削除しますか？`);
      if (!ok) return;
      entries = entries.filter((x) => x.id !== id);
      saveLocal();
      render();
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
    const base = sheetEntries ?? entries;
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
      entries,
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

    const body = JSON.stringify(payload);

    // NOTE:
    // GitHub Pages → Apps Script では CORS / preflight が原因で失敗しやすい。
    // application/json を避け、text/plain で JSON 文字列を送る（GAS側は e.postData.contents を読む）。
    // text/plain は “simple request” 扱いになりやすく、OPTIONS preflight を回避できるケースが多い。
    const req = {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    };

    console.groupCollapsed("[Sheets] POST", endpoint);
    console.log("payload =", payload);
    console.log("request =", req);

    let res;
    let text = "";
    try {
      res = await fetch(endpoint, req);
      text = await res.text();
      console.log("response.status =", res.status, res.statusText);
      console.log("response.text =", text);
    } catch (err) {
      console.error("[Sheets] POST fetch error =", err);
      console.groupEnd();
      return { ok: false, error: `fetch error: ${String(err)}` };
    }

    console.groupEnd();

    const p = safeParseJSON(text);
    if (!p.ok) {
      return { ok: false, error: "レスポンスJSONが不正", httpStatus: res.status, rawText: text };
    }

    return { ...p.value, httpStatus: res.status, rawText: text };
  }

  async function fetchFromSheets(opts) {
    const endpoint = getEndpoint();
    if (!endpoint) {
      toast("warn", "Sheets URLが未設定です（設定から入力してください）");
      return;
    }

    const silent = Boolean(opts?.silent);
    const expectId = String(opts?.expectId || "");

    if (!silent) toast("warn", "Sheetsから読み込み中...");

    try {
      console.groupCollapsed("[Sheets] GET", endpoint);
      const res = await fetch(endpoint, { method: "GET" });
      const text = await res.text();
      console.log("response.status =", res.status, res.statusText);
      console.log("response.text =", text);
      console.groupEnd();

      const p = safeParseJSON(text);
      if (!p.ok) throw new Error("JSON parse failed");
      const v = p.value;
      if (!v?.ok) throw new Error(String(v?.error || "GAS error"));

      const arr = Array.isArray(v.entries) ? v.entries : [];
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
            date: String(e.date || ""),
            field: String(e.field || ""),
            grade: String(e.grade || ""),
            weights,
            total_weight: Number.isFinite(total) ? total : sumWeights(weights),
            user: String(e.user || ""),
            memo: String(e.memo || ""),
            created_at: String(e.created_at || ""),
            updated_at: String(e.updated_at || ""),
          };
        })
        .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));

      if (!silent) toast("ok", `Sheets読み込み完了: ${sheetEntries.length}件`);
      render();

      if (expectId) {
        const found = sheetEntries.some((e) => e.id === expectId);
        if (!found) {
          toast("warn", "保存後の確認: Sheets側に反映が見つかりませんでした（反映遅延/別シート/別URLの可能性）");
        }
      }
    } catch (err) {
      toast("err", `Sheets読み込み失敗: ${String(err)}`);
      console.error("[Sheets] GET error =", err);
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

    // まずSheets保存を試みる
    try {
      toast("warn", "Sheetsへ保存中..." );
      const result = await postToSheets(buildPostPayload(entry));
      if (result?.ok) {
        toast("ok", "Sheets保存成功");
        // localStorageはバックアップとしても保存しておく（重複を避けるため id を保持）
        entries.push(entry);
        saveLocal();
        form.reset();
        resetFormDefaults();
        setWeightsTo(weightsWrap, [""], updateTotal, updateTotal);
        updateTotal();
        // Sheets表示中でも新規は反映させたいので再取得はユーザー任せ
        sheetEntries = null;        render();

        // 保存後にGETで再読み込みして反映確認（任意）
        await fetchFromSheets({ silent: true, expectId: String(result.id || "") });
        return;
      }
      throw new Error(`GAS error: ${String(result?.error || "unknown")} / http=${String(result?.httpStatus ?? "")} / raw=${String(result?.rawText ?? "")}`);
    } catch (err) {
      // 失敗時はlocalStorageへ一時保存
      entries.push(entry);
      saveLocal();
      toast("err", `Sheets保存失敗：${String(err)}（localStorageに退避）`);
      console.error("[Sheets] save failed =", err);
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
    btnFetch.addEventListener("click", fetchFromSheets);
    btnExportCsv.addEventListener("click", exportCsv);
    btnExportJson.addEventListener("click", exportJson);

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
      commitEdit();
      editingId = null;
      dlgEdit.close();
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
  }

  init();
})();



