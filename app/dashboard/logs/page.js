"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/logs.css";

const TRANSFER_TYPE_OPTIONS = [
  { value: "USER", label: "İstifadəçiyə təhkim" },
  { value: "MANUAL", label: "Manual məsul şəxs" },
  { value: "WAREHOUSE", label: "Anbara qaytarıldı" },
];

const STATUS_LABELS = {
  IN_STOCK: "Anbarda",
  ASSIGNED: "Təhkim olunub",
  IN_REPAIR: "Təmirdə",
  LOST: "İtib",
  WRITTEN_OFF: "Silinib",
  DISPOSED: "İstifadədən çıxarılıb",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatInputDate(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return "";

  return `${day}.${month}.${year}`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getStatusLabel(value) {
  return STATUS_LABELS[value] || value || "-";
}

function getTransferTypeLabel(type) {
  const value = String(type || "").toUpperCase();

  if (value === "USER") return "İstifadəçiyə təhkim";
  if (value === "MANUAL") return "Manual məsul şəxs";
  if (value === "WAREHOUSE") return "Anbara qaytarıldı";

  return value || "-";
}

function getTransferTypeClass(type) {
  const value = String(type || "").toUpperCase();

  if (value === "USER") return "type-user";
  if (value === "MANUAL") return "type-manual";
  if (value === "WAREHOUSE") return "type-warehouse";

  return "type-default";
}

function getPersonName(user, manualName) {
  if (user?.full_name) return user.full_name;
  if (manualName) return manualName;
  return "Anbar / təhkim yoxdur";
}

function getPersonEmail(user) {
  return user?.email || "";
}

function getInventoryCode(log) {
  return log.inventory?.inventory_code || "-";
}

function getInventoryName(log) {
  return log.inventory?.name || "-";
}

function getInventoryTitle(log) {
  return `${getInventoryCode(log)} · ${getInventoryName(log)}`;
}

function getInventoryMeta(log) {
  return [log.inventory?.brand, log.inventory?.model, log.inventory?.serial_number]
    .filter(Boolean)
    .join(" · ");
}

function getFromPerson(log) {
  return getPersonName(log.from_user, log.from_responsible_person_name);
}

function getToPerson(log) {
  return getPersonName(log.to_user, log.to_responsible_person_name);
}

function getFromCompany(log) {
  return log.from_company?.name || "-";
}

function getToCompany(log) {
  return log.to_company?.name || "-";
}

function getFromDepartment(log) {
  return log.from_department?.name || "-";
}

function getToDepartment(log) {
  return log.to_department?.name || "-";
}

function getFromLocation(log) {
  return log.from_location || "-";
}

function getToLocation(log) {
  return log.to_location || "-";
}

function getPerformer(log) {
  return log.performer?.full_name || "-";
}

function getPerformerEmail(log) {
  return log.performer?.email || "";
}

function toDateInputValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDateInRange(value, from, to) {
  if (!value) return false;

  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return false;

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (current < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59`);
    if (current > toDate) return false;
  }

  return true;
}

function compareValues(a, b, direction) {
  const dir = direction === "asc" ? 1 : -1;
  const av = String(a ?? "").trim();
  const bv = String(b ?? "").trim();

  if (!av && bv) return 1;
  if (av && !bv) return -1;
  if (!av && !bv) return 0;

  const dateA = Date.parse(av);
  const dateB = Date.parse(bv);

  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
    return (dateA - dateB) * dir;
  }

  const numA = Number(av);
  const numB = Number(bv);

  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return (numA - numB) * dir;
  }

  return av.localeCompare(bv, "az") * dir;
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

async function ensureXlsx() {
  const mod = await import("xlsx");
  return mod;
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function buildExportRows(rows) {
  return rows.map((log, index) => ({
    "№": index + 1,
    Tarix: formatDate(log.created_at),
    "İnventar kodu": getInventoryCode(log),
    "İnventar adı": getInventoryName(log),
    Brand: log.inventory?.brand || "-",
    Model: log.inventory?.model || "-",
    "Seriya nömrəsi": log.inventory?.serial_number || "-",
    "Yerdəyişmə tipi": getTransferTypeLabel(log.transfer_type),
    Kimdən: getFromPerson(log),
    "Kimdən email": getPersonEmail(log.from_user) || "-",
    Haraya: getToPerson(log),
    "Haraya email": getPersonEmail(log.to_user) || "-",
    "Əvvəlki şirkət": getFromCompany(log),
    "Yeni şirkət": getToCompany(log),
    "Əvvəlki departament": getFromDepartment(log),
    "Yeni departament": getToDepartment(log),
    "Əvvəlki lokasiya": getFromLocation(log),
    "Yeni lokasiya": getToLocation(log),
    "Əvvəlki status": getStatusLabel(log.from_status),
    "Yeni status": getStatusLabel(log.to_status),
    "İcra edən": getPerformer(log),
    "İcra edən email": getPerformerEmail(log) || "-",
    Qeyd: log.note || "-",
  }));
}

export default function InventoryLogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedFromCompanies, setSelectedFromCompanies] = useState([]);
  const [selectedToCompanies, setSelectedToCompanies] = useState([]);
  const [selectedPerformers, setSelectedPerformers] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [detailLog, setDetailLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedTypes,
    selectedFromCompanies,
    selectedToCompanies,
    selectedPerformers,
    dateFrom,
    dateTo,
    pageSize,
  ]);

  async function loadLogs() {
    setLoading(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/inventory/transfers?limit=500", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(json.error || "Loglar yüklənmədi.");
      }

      setLogs(json.logs || []);
    } catch (err) {
      console.error("LOGS LOAD ERROR:", err);
      alert(err?.message || "Loglar yüklənmədi.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  const fromCompanyOptions = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      if (log.from_company?.id) {
        map.set(String(log.from_company.id), log.from_company.name || "-");
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "az"));
  }, [logs]);

  const toCompanyOptions = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      if (log.to_company?.id) {
        map.set(String(log.to_company.id), log.to_company.name || "-");
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "az"));
  }, [logs]);

  const performerOptions = useMemo(() => {
    const map = new Map();

    logs.forEach((log) => {
      if (log.performer?.id) {
        map.set(String(log.performer.id), log.performer.full_name || "-");
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "az"));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = normalizeText(search);

    return logs.filter((log) => {
      const fullText = [
        getInventoryCode(log),
        getInventoryName(log),
        log.inventory?.brand,
        log.inventory?.model,
        log.inventory?.serial_number,
        getFromPerson(log),
        getToPerson(log),
        getPersonEmail(log.from_user),
        getPersonEmail(log.to_user),
        getFromCompany(log),
        getToCompany(log),
        getFromDepartment(log),
        getToDepartment(log),
        getFromLocation(log),
        getToLocation(log),
        getPerformer(log),
        getPerformerEmail(log),
        log.note,
        getTransferTypeLabel(log.transfer_type),
        getStatusLabel(log.from_status),
        getStatusLabel(log.to_status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const type = String(log.transfer_type || "").toUpperCase();
      const fromCompanyId = String(log.from_company?.id || "");
      const toCompanyId = String(log.to_company?.id || "");
      const performerId = String(log.performer?.id || "");

      return (
        (!q || fullText.includes(q)) &&
        (selectedTypes.length === 0 || selectedTypes.includes(type)) &&
        (selectedFromCompanies.length === 0 ||
          selectedFromCompanies.includes(fromCompanyId)) &&
        (selectedToCompanies.length === 0 ||
          selectedToCompanies.includes(toCompanyId)) &&
        (selectedPerformers.length === 0 ||
          selectedPerformers.includes(performerId)) &&
        ((!dateFrom && !dateTo) ||
          isDateInRange(log.created_at, dateFrom, dateTo))
      );
    });
  }, [
    logs,
    search,
    selectedTypes,
    selectedFromCompanies,
    selectedToCompanies,
    selectedPerformers,
    dateFrom,
    dateTo,
  ]);

  const sortedLogs = useMemo(() => {
    const list = [...filteredLogs];

    list.sort((a, b) => {
      let aValue = "";
      let bValue = "";

      if (sortBy === "created_at") {
        aValue = a.created_at;
        bValue = b.created_at;
      }

      if (sortBy === "inventory") {
        aValue = getInventoryTitle(a);
        bValue = getInventoryTitle(b);
      }

      if (sortBy === "type") {
        aValue = getTransferTypeLabel(a.transfer_type);
        bValue = getTransferTypeLabel(b.transfer_type);
      }

      if (sortBy === "from_person") {
        aValue = getFromPerson(a);
        bValue = getFromPerson(b);
      }

      if (sortBy === "to_person") {
        aValue = getToPerson(a);
        bValue = getToPerson(b);
      }

      if (sortBy === "company") {
        aValue = `${getFromCompany(a)} ${getToCompany(a)}`;
        bValue = `${getFromCompany(b)} ${getToCompany(b)}`;
      }

      if (sortBy === "performer") {
        aValue = getPerformer(a);
        bValue = getPerformer(b);
      }

      return compareValues(aValue, bValue, sortDir);
    });

    return list;
  }, [filteredLogs, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));

  const paginatedLogs = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, page, pageSize, totalPages]);

  const summary = useMemo(() => {
    const user = filteredLogs.filter(
      (x) => String(x.transfer_type || "").toUpperCase() === "USER"
    ).length;

    const manual = filteredLogs.filter(
      (x) => String(x.transfer_type || "").toUpperCase() === "MANUAL"
    ).length;

    const warehouse = filteredLogs.filter(
      (x) => String(x.transfer_type || "").toUpperCase() === "WAREHOUSE"
    ).length;

    return {
      total: logs.length,
      shown: filteredLogs.length,
      user,
      manual,
      warehouse,
      latest: logs[0]?.created_at || "",
    };
  }, [logs, filteredLogs]);

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDir("asc");
  }

  function sortIcon(column) {
    if (sortBy !== column) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  function toggleMultiValue(setter, value) {
    setter((prev) => {
      const val = String(value);

      if (prev.includes(val)) {
        return prev.filter((x) => x !== val);
      }

      return [...prev, val];
    });
  }

  function resetFilters() {
    setSearch("");
    setSelectedTypes([]);
    setSelectedFromCompanies([]);
    setSelectedToCompanies([]);
    setSelectedPerformers([]);
    setDateFrom("");
    setDateTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  function getActiveFilterCount() {
    let count = 0;

    if (search.trim()) count += 1;
    if (selectedTypes.length) count += 1;
    if (selectedFromCompanies.length) count += 1;
    if (selectedToCompanies.length) count += 1;
    if (selectedPerformers.length) count += 1;
    if (dateFrom || dateTo) count += 1;

    return count;
  }

  function getSelectedNames(options, selectedIds) {
    return options
      .filter((item) => selectedIds.includes(String(item.id)))
      .map((item) => item.name);
  }

  function renderFilterSummary() {
    const parts = [];

    if (selectedTypes.length) {
      parts.push(`${selectedTypes.length} tip`);
    }

    if (selectedFromCompanies.length) {
      parts.push(`${selectedFromCompanies.length} əvvəlki şirkət`);
    }

    if (selectedToCompanies.length) {
      parts.push(`${selectedToCompanies.length} yeni şirkət`);
    }

    if (selectedPerformers.length) {
      parts.push(`${selectedPerformers.length} icraçı`);
    }

    if (dateFrom || dateTo) {
      parts.push("tarix aralığı");
    }

    return parts.length ? parts.join(" · ") : "Filter seçilməyib";
  }

  async function exportExcel() {
    try {
      const XLSX = await ensureXlsx();
      const rows = buildExportRows(sortedLogs);

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Loglar");
      XLSX.writeFile(wb, `inventory-logs-${toDateInputValue(new Date())}.xlsx`);
    } catch (err) {
      console.error("EXCEL EXPORT ERROR:", err);
      alert(
        "Excel export zamanı xəta baş verdi. xlsx paketinin quraşdırıldığını yoxla."
      );
    }
  }

  function exportCsv() {
    const rows = buildExportRows(sortedLogs);

    const headers = Object.keys(
      rows[0] || {
        "№": "",
        Tarix: "",
        "İnventar kodu": "",
        "İnventar adı": "",
        "Yerdəyişmə tipi": "",
        Kimdən: "",
        Haraya: "",
        "Əvvəlki şirkət": "",
        "Yeni şirkət": "",
        Qeyd: "",
      }
    );

    const csvRows = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header] ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    downloadBlob(
      "\uFEFF" + csvRows.join("\n"),
      `inventory-logs-${toDateInputValue(new Date())}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function printReport() {
    const rows = sortedLogs;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>İnventar Logları Report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              margin: 24px;
              color: #0f172a;
            }
            .report-head {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              align-items: flex-start;
              margin-bottom: 20px;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 14px;
            }
            h1 { margin: 0; font-size: 22px; }
            p { margin: 5px 0; color: #475569; font-size: 12px; }
            .summary {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
              margin: 16px 0;
            }
            .summary div {
              border: 1px solid #cbd5e1;
              border-radius: 10px;
              padding: 10px;
            }
            .summary span {
              display: block;
              color: #64748b;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
            }
            .summary strong {
              display: block;
              margin-top: 5px;
              font-size: 16px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px;
              vertical-align: top;
              text-align: left;
            }
            th { background: #f1f5f9; font-weight: 800; }
            .muted { color: #64748b; }
          </style>
        </head>
        <body>
          <div class="report-head">
            <div>
              <h1>İnventar Yerdəyişmə Logları</h1>
              <p>Report tarixi: ${formatDate(new Date().toISOString())}</p>
              <p>Filter nəticəsi: ${rows.length} log</p>
            </div>
            <div>
              <p><strong>Cahan Holding Inventory</strong></p>
              <p>Log report</p>
            </div>
          </div>

          <div class="summary">
            <div><span>Göstərilən</span><strong>${summary.shown}</strong></div>
            <div><span>Ümumi</span><strong>${summary.total}</strong></div>
            <div><span>User təhkim</span><strong>${summary.user}</strong></div>
            <div><span>Manual</span><strong>${summary.manual}</strong></div>
            <div><span>Anbar</span><strong>${summary.warehouse}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Tarix</th>
                <th>İnventar</th>
                <th>Tip</th>
                <th>Kimdən</th>
                <th>Haraya</th>
                <th>Şirkət</th>
                <th>İcra edən</th>
                <th>Qeyd</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (log, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${formatDate(log.created_at)}</td>
                      <td>
                        <strong>${getInventoryCode(log)}</strong><br />
                        ${getInventoryName(log)}<br />
                        <span class="muted">${getInventoryMeta(log) || "-"}</span>
                      </td>
                      <td>${getTransferTypeLabel(log.transfer_type)}</td>
                      <td>${getFromPerson(log)}<br /><span class="muted">${getStatusLabel(
                        log.from_status
                      )}</span></td>
                      <td>${getToPerson(log)}<br /><span class="muted">${getStatusLabel(
                        log.to_status
                      )}</span></td>
                      <td>${getFromCompany(log)} → ${getToCompany(log)}</td>
                      <td>${getPerformer(log)}</td>
                      <td>${log.note || "-"}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>

          <script>
            window.onload = function () { window.print(); };
          </script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1200,height=800");

    if (!win) {
      alert("Print pəncərəsi bloklandı. Browser popup icazəsini yoxla.");
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <section className="logsPage">
      <div className="logsHero">
        <div>
          
          <h1>Loglar</h1>
         
        </div>

        <div className="logsHeroActions">
          <button type="button" onClick={loadLogs}>
            Yenilə
          </button>
          <button type="button" onClick={exportCsv}>
            CSV
          </button>
          <button type="button" onClick={exportExcel}>
            Excel
          </button>
          <button type="button" className="primary" onClick={printReport}>
            Print report
          </button>
        </div>
      </div>

      <div className="logsStatsGrid">
        <StatCard label="Göstərilən" value={loading ? "..." : summary.shown} />
        <StatCard label="Ümumi log" value={loading ? "..." : summary.total} />
        <StatCard label="User təhkim" value={loading ? "..." : summary.user} />
        <StatCard label="Manual" value={loading ? "..." : summary.manual} />
        <StatCard label="Anbar" value={loading ? "..." : summary.warehouse} />
      </div>

      <div className="logsFiltersCard logsFiltersCardMinimal">
        <div className="logsFilterTop">
          <div className="logsSearchShell">
            <span className="logsSearchIcon">⌕</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kod, inventar, şəxs, şirkət, departament, lokasiya üzrə axtar..."
            />

            {search.trim() && (
              <button
                type="button"
                className="logsSearchClear"
                onClick={() => setSearch("")}
                aria-label="Axtarışı təmizlə"
              >
                ×
              </button>
            )}
          </div>

          <div className="logsFilterActions">
            <button
              type="button"
              className={`logsFilterToggle ${filtersOpen ? "active" : ""}`}
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              <span>Filter aç/bağla</span>
              {getActiveFilterCount() > 0 && <b>{getActiveFilterCount()}</b>}
            </button>

            <button type="button" className="logsSoftBtn" onClick={loadLogs}>
              Yenilə
            </button>

            <button
              type="button"
              className="logsGhostBtn"
              onClick={resetFilters}
              disabled={getActiveFilterCount() === 0}
            >
              Sıfırla
            </button>
          </div>
        </div>

        <div className="logsFilterSummaryLine">
          <span>{summary.shown} nəticə</span>
          <em>{renderFilterSummary()}</em>
        </div>

        {filtersOpen && (
          <div className="logsFilterPanel">
            <div className="logsFilterPanelGrid">
              <MinimalFilterBlock
                title="Yerdəyişmə tipi"
                subtitle={
                  selectedTypes.length
                    ? selectedTypes.map((x) => getTransferTypeLabel(x)).join(", ")
                    : "Hamısı"
                }
              >
                <div className="logsCompactChipRow">
                  {TRANSFER_TYPE_OPTIONS.map((type) => {
                    const selected = selectedTypes.includes(type.value);

                    return (
                      <button
                        key={type.value}
                        type="button"
                        className={`logsCompactChip ${selected ? "active" : ""}`}
                        onClick={() =>
                          toggleMultiValue(setSelectedTypes, type.value)
                        }
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </MinimalFilterBlock>

              <MinimalFilterBlock
                title="Əvvəlki şirkət"
                subtitle={
                  selectedFromCompanies.length
                    ? getSelectedNames(
                        fromCompanyOptions,
                        selectedFromCompanies
                      ).join(", ")
                    : "Hamısı"
                }
              >
                <div className="logsCompactChipRow scroll">
                  {fromCompanyOptions.length === 0 ? (
                    <span className="logsFilterMuted">Şirkət yoxdur</span>
                  ) : (
                    fromCompanyOptions.map((company) => {
                      const selected = selectedFromCompanies.includes(company.id);

                      return (
                        <button
                          key={company.id}
                          type="button"
                          className={`logsCompactChip ${
                            selected ? "active" : ""
                          }`}
                          onClick={() =>
                            toggleMultiValue(
                              setSelectedFromCompanies,
                              company.id
                            )
                          }
                        >
                          {company.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </MinimalFilterBlock>

              <MinimalFilterBlock
                title="Yeni şirkət"
                subtitle={
                  selectedToCompanies.length
                    ? getSelectedNames(toCompanyOptions, selectedToCompanies).join(
                        ", "
                      )
                    : "Hamısı"
                }
              >
                <div className="logsCompactChipRow scroll">
                  {toCompanyOptions.length === 0 ? (
                    <span className="logsFilterMuted">Şirkət yoxdur</span>
                  ) : (
                    toCompanyOptions.map((company) => {
                      const selected = selectedToCompanies.includes(company.id);

                      return (
                        <button
                          key={company.id}
                          type="button"
                          className={`logsCompactChip ${
                            selected ? "active" : ""
                          }`}
                          onClick={() =>
                            toggleMultiValue(setSelectedToCompanies, company.id)
                          }
                        >
                          {company.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </MinimalFilterBlock>

              <MinimalFilterBlock
                title="İcra edən"
                subtitle={
                  selectedPerformers.length
                    ? getSelectedNames(performerOptions, selectedPerformers).join(
                        ", "
                      )
                    : "Hamısı"
                }
              >
                <div className="logsCompactChipRow scroll">
                  {performerOptions.length === 0 ? (
                    <span className="logsFilterMuted">İcraçı yoxdur</span>
                  ) : (
                    performerOptions.map((person) => {
                      const selected = selectedPerformers.includes(person.id);

                      return (
                        <button
                          key={person.id}
                          type="button"
                          className={`logsCompactChip ${
                            selected ? "active" : ""
                          }`}
                          onClick={() =>
                            toggleMultiValue(setSelectedPerformers, person.id)
                          }
                        >
                          {person.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </MinimalFilterBlock>

              <MinimalFilterBlock
                title="Tarix aralığı"
                subtitle={
                  dateFrom || dateTo
                    ? `${formatInputDate(dateFrom) || "..."} - ${
                        formatInputDate(dateTo) || "..."
                      }`
                    : "Tarix seçilməyib"
                }
                wide
              >
                <div className="logsMinimalDateRow">
                  <label>
                    <span>Başlanğıc</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>

                  <label>
                    <span>Son</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                </div>
              </MinimalFilterBlock>
            </div>
          </div>
        )}
      </div>

      <div className="logsTableCard">
        <div className="logsTableTop">
          <div>
            <h3>Yerdəyişmə tarixçəsi</h3>
            <p>
              {loading
                ? "Yüklənir..."
                : `${sortedLogs.length} nəticə · səhifə ${Math.min(
                    page,
                    totalPages
                  )} / ${totalPages}`}
            </p>
          </div>

          <div className="logsPageSize">
            <span>Səhifədə</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="logsEmptyState">Loglar yüklənir...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="logsEmptyState">
            <strong>Log tapılmadı</strong>
            <p>Hazırda bu filterlərə uyğun yerdəyişmə logu yoxdur.</p>
          </div>
        ) : (
          <>
            <div className="logsTableWrap">
              <table className="logsTable">
                <thead>
                  <tr>
                    <th className="dateCol">
                      <SortButton
                        label="Tarix"
                        column="created_at"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th>
                      <SortButton
                        label="İnventar"
                        column="inventory"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th className="typeCol">
                      <SortButton
                        label="Tip"
                        column="type"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th>
                      <SortButton
                        label="Kimdən"
                        column="from_person"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th>
                      <SortButton
                        label="Haraya"
                        column="to_person"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th>
                      <SortButton
                        label="Şirkət"
                        column="company"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th>
                      <SortButton
                        label="İcra edən"
                        column="performer"
                        sortBy={sortBy}
                        sortIcon={sortIcon}
                        onSort={toggleSort}
                      />
                    </th>

                    <th className="actionsCol">Ətraflı</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="logsDateCell">
                          <strong>{formatDateOnly(log.created_at)}</strong>
                          <span>
                            {formatDate(log.created_at).split(" ").slice(-1)[0]}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="logsInventoryCell">
                          <strong>{getInventoryCode(log)}</strong>
                          <span>{getInventoryName(log)}</span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`logsTypePill ${getTransferTypeClass(
                            log.transfer_type
                          )}`}
                        >
                          {getTransferTypeLabel(log.transfer_type)}
                        </span>
                      </td>

                      <td>
                        <div className="logsPersonCell">
                          <strong>{getFromPerson(log)}</strong>
                          <span>{getStatusLabel(log.from_status)}</span>
                        </div>
                      </td>

                      <td>
                        <div className="logsPersonCell">
                          <strong>{getToPerson(log)}</strong>
                          <span>{getStatusLabel(log.to_status)}</span>
                        </div>
                      </td>

                      <td>
                        <div className="logsCompanyMini">
                          <span>{getFromCompany(log)}</span>
                          <b>→</b>
                          <span>{getToCompany(log)}</span>
                        </div>
                      </td>

                      <td>
                        <div className="logsPersonCell">
                          <strong>{getPerformer(log)}</strong>
                          {getPerformerEmail(log) && (
                            <span>{getPerformerEmail(log)}</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="logsViewBtn"
                          onClick={() => setDetailLog(log)}
                        >
                          Bax
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="logsMobileList">
              {paginatedLogs.map((log) => (
                <article className="logsMobileCard" key={log.id}>
                  <div className="logsMobileTop">
                    <div>
                      <span>{formatDate(log.created_at)}</span>
                      <h3>
                        {getInventoryCode(log)} · {getInventoryName(log)}
                      </h3>
                    </div>

                    <span
                      className={`logsTypePill ${getTransferTypeClass(
                        log.transfer_type
                      )}`}
                    >
                      {getTransferTypeLabel(log.transfer_type)}
                    </span>
                  </div>

                  <div className="logsMobileGrid">
                    <div>
                      <span>Kimdən</span>
                      <strong>{getFromPerson(log)}</strong>
                    </div>

                    <div>
                      <span>Haraya</span>
                      <strong>{getToPerson(log)}</strong>
                    </div>

                    <div>
                      <span>Şirkət</span>
                      <strong>
                        {getFromCompany(log)} → {getToCompany(log)}
                      </strong>
                    </div>

                    <div>
                      <span>İcra edən</span>
                      <strong>{getPerformer(log)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="logsMobileView"
                    onClick={() => setDetailLog(log)}
                  >
                    Detallara bax
                  </button>
                </article>
              ))}
            </div>

            <div className="logsPagination">
              <div>
                <span>Səhifədə</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="logsPageButtons">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Əvvəlki
                </button>

                <strong>
                  {Math.min(page, totalPages)} / {totalPages}
                </strong>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                >
                  Növbəti
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <LogDetailDrawer log={detailLog} onClose={() => setDetailLog(null)} />
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="logsStatCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MinimalFilterBlock({ title, subtitle, children, wide }) {
  return (
    <div className={`logsMinimalFilterBlock ${wide ? "wide" : ""}`}>
      <div className="logsMinimalFilterBlockHead">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      {children}
    </div>
  );
}

function SortButton({ label, column, sortBy, sortIcon, onSort }) {
  return (
    <button
      type="button"
      className={sortBy === column ? "active" : ""}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      <b>{sortIcon(column)}</b>
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="logsDetailRow">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function LogDetailDrawer({ log, onClose }) {
  if (!log) return null;

  return (
    <div className="logsDrawerRoot">
      <button
        type="button"
        className="logsDrawerBackdrop"
        onClick={onClose}
        aria-label="Bağla"
      />

      <aside className="logsDrawer">
        <header className="logsDrawerHead">
          <div>
            <span>Log detalı</span>
            <h2>{getInventoryCode(log)}</h2>
            <p>{getInventoryName(log)}</p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="logsDrawerBody">
          <section className="logsDetailSection">
            <h3>Ümumi məlumat</h3>

            <DetailRow label="Tarix" value={formatDate(log.created_at)} />
            <DetailRow
              label="Yerdəyişmə tipi"
              value={getTransferTypeLabel(log.transfer_type)}
            />
            <DetailRow label="İcra edən" value={getPerformer(log)} />
            <DetailRow label="İcra edən email" value={getPerformerEmail(log)} />
            <DetailRow label="Qeyd" value={log.note || "-"} />
          </section>

          <section className="logsDetailSection">
            <h3>İnventar</h3>

            <DetailRow label="Kod" value={getInventoryCode(log)} />
            <DetailRow label="Ad" value={getInventoryName(log)} />
            <DetailRow label="Brand" value={log.inventory?.brand || "-"} />
            <DetailRow label="Model" value={log.inventory?.model || "-"} />
            <DetailRow
              label="Seriya nömrəsi"
              value={log.inventory?.serial_number || "-"}
            />
          </section>

          <section className="logsDetailSection">
            <h3>Kimdən</h3>

            <DetailRow label="Məsul şəxs" value={getFromPerson(log)} />
            <DetailRow label="Email" value={getPersonEmail(log.from_user)} />
            <DetailRow label="Şirkət" value={getFromCompany(log)} />
            <DetailRow label="Departament" value={getFromDepartment(log)} />
            <DetailRow label="Lokasiya" value={getFromLocation(log)} />
            <DetailRow label="Status" value={getStatusLabel(log.from_status)} />
          </section>

          <section className="logsDetailSection">
            <h3>Haraya</h3>

            <DetailRow label="Məsul şəxs" value={getToPerson(log)} />
            <DetailRow label="Email" value={getPersonEmail(log.to_user)} />
            <DetailRow label="Şirkət" value={getToCompany(log)} />
            <DetailRow label="Departament" value={getToDepartment(log)} />
            <DetailRow label="Lokasiya" value={getToLocation(log)} />
            <DetailRow label="Status" value={getStatusLabel(log.to_status)} />
          </section>
        </div>

        <footer className="logsDrawerFooter">
          <button type="button" onClick={onClose}>
            Bağla
          </button>
        </footer>
      </aside>
    </div>
  );
}