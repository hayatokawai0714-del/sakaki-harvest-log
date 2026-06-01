/* eslint-disable no-alert */
(() => {
  "use strict";

  const STORAGE_KEY = "sakakiHarvestLog.v1";

  /** @typedef {{id:string, date:string, place:string, qty:number, unit:string, note:string, createdAt:number, updatedAt:number}} Entry */

  const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));
  const tbody = /** @type {HTMLTableSectionElement} */ ($("#tbody"));
  const summaryEl = $("#summary");
  const statusEl = $("#status");

  const form = /** @type {HTMLFormElement} */ ($("#form"));
  const dateEl = /** @type {HTMLInputElement} */ ($("#date"));
  const placeEl = /** @type {HTMLInputElement} */ ($("#place"));
  const qtyEl = /** @type {HTMLInputElement} */ ($("#qty"));
  const unitEl = /** @type {HTMLSelectElement} */ ($("#unit"));
  const noteEl = /** @type {HTMLInputElement} */ ($("#note"));

  const monthEl = /** @type {HTMLInputElement} */ ($("#month"));
  const qEl = /** @type {HTMLInputElement} */ ($("#q"));

  const btnClear = $("#btnClear");
  const btnExportCsv = $("#btnExportCsv");
  const btnExportJson = $("#btnExportJson");
  const fileImport = /** @type {HTMLInputElement} */ ($("#fileImport"));

  const dlgEdit = /** @type {HTMLDialogElement} */ ($("#dlgEdit"));
  const editForm = /** @type {HTMLFormElement} */ ($("#editForm"));
  const eDate = /** @type {HTMLInputElement} */ ($("#eDate"));
  const ePlace = /** @type {HTMLInputElement} */ ($("#ePlace"));
  const eQty = /** @type {HTMLInputElement} */ ($("#eQty"));
  const eUnit = /** @type {HTMLSelectElement} */ ($("#eUnit"));
  const eNote = /** @type {HTMLInputElement} */ ($("#eNote"));

  /** @type {Entry[]} */
  let entries = [];
  /** @type {string | null} */
  let editingId = null;

  function now() {
    return Date.now();
  }

  function uuid() {
    // good enough for local log
    return `${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

  function safeParseJSON(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = safeParseJSON(raw);
    if (!parsed.ok) return [];
    const value = parsed.value;
    if (!value || typeof value !== "object") return [];
    if (!Array.isArray(value.entries)) return [];
    return value.entries
      .filter((e) => e && typeof e === "object")
      .map((e) => {
        const qtyNum = Number(e.qty);
        return {
          id: String(e.id || uuid()),
          date: String(e.date || ""),
          place: String(e.place || ""),
          qty: Number.isFinite(qtyNum) ? qtyNum : 0,
          unit: String(e.unit || "束"),
          note: String(e.note || ""),
          createdAt: Number(e.createdAt || now()),
          updatedAt: Number(e.updatedAt || now()),
        };
      });
  }

  function save() {
    const payload = {
      schema: 1,
      updatedAt: now(),
      entries,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function fmtDate(s) {
    // keep yyyy-mm-dd
    return s || "";
  }

  function fmtQty(n) {
    if (!Number.isFinite(n)) return "0";
    return (Math.round(n * 100) / 100).toString();
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

  function filtered() {
    const month = monthEl.value.trim();
    const q = qEl.value.trim().toLowerCase();

    return entries
      .filter((e) => (month ? e.date.startsWith(month) : true))
      .filter((e) => {
        if (!q) return true;
        return (
          e.place.toLowerCase().includes(q) ||
          e.note.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.updatedAt - a.updatedAt;
      });
  }

  function computeSummary(list) {
    const byUnit = new Map();
    for (const e of list) {
      const key = e.unit || "(未設定)";
      byUnit.set(key, (byUnit.get(key) || 0) + (Number(e.qty) || 0));
    }
    const parts = [...byUnit.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ja"))
      .map(([unit, qty]) => `${fmtQty(qty)} ${unit}`);

    return {
      count: list.length,
      parts,
    };
  }

  function render() {
    const list = filtered();
    const summary = computeSummary(list);
    const monthLabel = monthEl.value ? `${monthEl.value} の` : "";

    summaryEl.textContent = `${monthLabel}表示件数 ${summary.count}件 / 合計: ${summary.parts.join(" / ") || "0"}`;

    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const e of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDate(e.date)}</td>
        <td>${escapeHtml(e.place)}</td>
        <td class="num">${escapeHtml(fmtQty(e.qty))}</td>
        <td>${escapeHtml(e.unit)}</td>
        <td>${escapeHtml(e.note)}</td>
        <td>
          <div class="rowActions">
            <button class="btn" type="button" data-act="edit" data-id="${escapeAttr(e.id)}">編集</button>
            <button class="btn btn--danger" type="button" data-act="del" data-id="${escapeAttr(e.id)}">削除</button>
          </div>
        </td>
      `;
      frag.appendChild(tr);
    }

    tbody.appendChild(frag);
    statusEl.textContent = `localStorage / 全${entries.length}件`;
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

  function resetFormDefaults() {
    dateEl.value = todayStr();
    unitEl.value = "束";
  }

  function handleAdd(ev) {
    ev.preventDefault();

    const date = dateEl.value.trim();
    const place = placeEl.value.trim();
    const qty = Number(qtyEl.value);
    const unit = unitEl.value;
    const note = noteEl.value.trim();

    if (!date) return;
    if (!Number.isFinite(qty) || qty < 0) {
      alert("数量を正しく入力してください");
      return;
    }

    /** @type {Entry} */
    const entry = {
      id: uuid(),
      date,
      place,
      qty,
      unit,
      note,
      createdAt: now(),
      updatedAt: now(),
    };

    entries.push(entry);
    save();
    form.reset();
    resetFormDefaults();
    render();
  }

  function openEdit(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    editingId = id;
    eDate.value = e.date;
    ePlace.value = e.place;
    eQty.value = String(e.qty);
    eUnit.value = e.unit;
    eNote.value = e.note;
    dlgEdit.showModal();
  }

  function commitEdit() {
    if (!editingId) return;
    const idx = entries.findIndex((x) => x.id === editingId);
    if (idx === -1) return;

    const date = eDate.value.trim();
    const place = ePlace.value.trim();
    const qty = Number(eQty.value);
    const unit = eUnit.value;
    const note = eNote.value.trim();

    if (!date) return;
    if (!Number.isFinite(qty) || qty < 0) {
      alert("数量を正しく入力してください");
      return;
    }

    const prev = entries[idx];
    entries[idx] = {
      ...prev,
      date,
      place,
      qty,
      unit,
      note,
      updatedAt: now(),
    };

    save();
    render();
  }

  function handleRowClick(ev) {
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
      save();
      render();
    }
  }

  function exportCsv() {
    const list = filtered().slice().sort((a, b) => a.date.localeCompare(b.date, "ja"));
    const header = ["date", "place", "qty", "unit", "note"].join(",");
    const lines = list.map((e) =>
      [e.date, e.place, fmtQty(e.qty), e.unit, e.note].map(escapeCsv).join(",")
    );
    const csv = [header, ...lines].join("\n") + "\n";
    const name = monthEl.value ? `sakaki-harvest-${monthEl.value}.csv` : "sakaki-harvest.csv";
    downloadText(name, csv, "text/csv;charset=utf-8");
  }

  function exportJson() {
    const payload = {
      schema: 1,
      exportedAt: new Date().toISOString(),
      entries,
    };
    const text = JSON.stringify(payload, null, 2) + "\n";
    const name = monthEl.value ? `sakaki-harvest-${monthEl.value}.json` : "sakaki-harvest.json";
    downloadText(name, text, "application/json;charset=utf-8");
  }

  async function importJsonFile(file) {
    const text = await file.text();
    const parsed = safeParseJSON(text);
    if (!parsed.ok) {
      alert("JSONの読み込みに失敗しました");
      return;
    }

    const v = parsed.value;
    const next = Array.isArray(v?.entries) ? v.entries : (Array.isArray(v) ? v : null);
    if (!next) {
      alert("形式が不正です（entries配列がありません）");
      return;
    }

    const imported = next
      .filter((e) => e && typeof e === "object")
      .map((e) => {
        const qtyNum = Number(e.qty);
        return {
          id: String(e.id || uuid()),
          date: String(e.date || ""),
          place: String(e.place || ""),
          qty: Number.isFinite(qtyNum) ? qtyNum : 0,
          unit: String(e.unit || "束"),
          note: String(e.note || ""),
          createdAt: Number(e.createdAt || now()),
          updatedAt: Number(e.updatedAt || now()),
        };
      })
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));

    if (imported.length === 0) {
      alert("取り込めるデータがありませんでした");
      return;
    }

    const ok = confirm(`取り込み: ${imported.length}件\n現在のデータ(${entries.length}件)に追加しますか？`);
    if (!ok) return;

    // de-dup by id
    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const e of imported) byId.set(e.id, e);
    entries = [...byId.values()];

    save();
    render();
    alert("取り込み完了しました");
  }

  function clearAll() {
    const ok = confirm("全データを削除しますか？（取り消し不可）");
    if (!ok) return;
    entries = [];
    localStorage.removeItem(STORAGE_KEY);
    render();
  }

  function init() {
    entries = load();

    resetFormDefaults();
    monthEl.value = monthStr();

    form.addEventListener("submit", handleAdd);
    tbody.addEventListener("click", handleRowClick);
    monthEl.addEventListener("change", render);
    qEl.addEventListener("input", render);

    btnClear.addEventListener("click", clearAll);
    btnExportCsv.addEventListener("click", exportCsv);
    btnExportJson.addEventListener("click", exportJson);
    fileImport.addEventListener("change", async () => {
      const file = fileImport.files?.[0];
      fileImport.value = "";
      if (!file) return;
      await importJsonFile(file);
    });

    editForm.addEventListener("submit", (ev) => {
      const submitter = /** @type {HTMLElement | null} */ (ev.submitter);
      const v = submitter?.getAttribute("value");
      if (v === "cancel") {
        editingId = null;
        return;
      }
      // default ok
      ev.preventDefault();
      commitEdit();
      editingId = null;
      dlgEdit.close();
    });

    render();
  }

  init();
})();
