"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";

const ALLOWED_ROLES = ["ADMIN", "AUDIT"];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "Anbarda" },
  { value: "ASSIGNED", label: "Təhkim olunub" },
  { value: "IN_REPAIR", label: "Təmirdə" },
  { value: "LOST", label: "İtib" },
  { value: "WRITTEN_OFF", label: "Silinib" },
  { value: "DISPOSED", label: "İstifadədən çıxarılıb" },
];

const HEALTH_OPTIONS = [
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "WATCH", label: "Watch" },
  { value: "RISKY", label: "Risky" },
  { value: "CRITICAL", label: "Critical" },
];

const WARRANTY_OPTIONS = [
  { value: "NONE", label: "Zəmanət yoxdur" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "ENDING", label: "30 günə bitir" },
  { value: "EXPIRED", label: "Zəmanəti bitib" },
];

const RISK_FILTER_OPTIONS = [
  { value: "ALL", label: "Hamısı" },
  { value: "RISKY", label: "Riskli" },
  { value: "CRITICAL", label: "Critical" },
  { value: "WARRANTY", label: "Zəmanət riski" },
  { value: "NO_RESPONSIBLE", label: "Məsul şəxssiz" },
  { value: "NO_QR", label: "QR yoxdur" },
];

function normalizeRole(role) {
  return String(role || "USER").trim().toUpperCase();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
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

function parseDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const cleaned = raw.replace(/[^\d]/g, "");
  if (cleaned.length !== 8) return "";

  const day = cleaned.slice(0, 2);
  const month = cleaned.slice(2, 4);
  const year = cleaned.slice(4, 8);

  const date = new Date(`${year}-${month}-${day}T00:00:00`);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function formatDateInputMask(value) {
  const digits = String(value || "").replace(/[^\d]/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function formatDateTime(value) {
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

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getHealthLabel(value) {
  return HEALTH_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getWarrantyLabel(value) {
  return WARRANTY_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function formatMoney(value, currency = "AZN") {
  if (value === null || value === undefined || value === "") return "-";

  const number = Number(value);

  if (Number.isNaN(number)) {
    return `${value} ${currency || ""}`.trim();
  }

  return `${number.toLocaleString("az-AZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || "AZN"}`;
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

  if (a === null || a === undefined || a === "") return 1;
  if (b === null || b === undefined || b === "") return -1;

  const dateA = Date.parse(a);
  const dateB = Date.parse(b);

  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) {
    return (dateA - dateB) * dir;
  }

  const numA = Number(a);
  const numB = Number(b);

  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return (numA - numB) * dir;
  }

  return String(a).localeCompare(String(b), "az") * dir;
}

function warrantyState(item) {
  if (!item?.warranty_end_date) {
    return {
      label: "Zəmanət yoxdur",
      state: "NONE",
      daysLeft: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(item.warranty_end_date);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: "Zəmanət bitib",
      state: "EXPIRED",
      daysLeft: diffDays,
    };
  }

  if (diffDays <= 30) {
    return {
      label: `${diffDays} günə bitir`,
      state: "ENDING",
      daysLeft: diffDays,
    };
  }

  return {
    label: "Aktiv",
    state: "ACTIVE",
    daysLeft: diffDays,
  };
}

function healthFallback(item) {
  const condition = item?.condition || "";
  const status = item?.status || "";
  const warranty = warrantyState(item);

  if (["LOST", "WRITTEN_OFF", "DISPOSED"].includes(status)) {
    return { score: 0, status: "CRITICAL" };
  }

  if (condition === "UNUSABLE") return { score: 10, status: "CRITICAL" };
  if (condition === "DAMAGED") return { score: 35, status: "RISKY" };
  if (status === "IN_REPAIR") return { score: 45, status: "WATCH" };
  if (warranty.state === "EXPIRED") return { score: 55, status: "WATCH" };
  if (warranty.state === "ENDING") return { score: 70, status: "GOOD" };
  if (condition === "NEW") return { score: 95, status: "EXCELLENT" };
  if (condition === "GOOD") return { score: 85, status: "GOOD" };

  return { score: 75, status: "GOOD" };
}

function enrichItem(item) {
  const fallback = healthFallback(item);

  return {
    ...item,
    computed_health_score:
      item.health_score === null || item.health_score === undefined
        ? fallback.score
        : item.health_score,
    computed_health_status: item.health_status || fallback.status,
    warranty_info: warrantyState(item),
  };
}

function toggleArrayValue(list, value) {
  const val = String(value);

  if (list.includes(val)) {
    return list.filter((x) => x !== val);
  }

  return [...list, val];
}

function toExcelRows(items) {
  return items.map((item, index) => ({
    "№": index + 1,
    "İnventar kodu": item.inventory_code || "-",
    "İnventar adı": item.name || "-",
    Brand: item.brand || "-",
    Model: item.model || "-",
    "Seriya nömrəsi": item.serial_number || "-",
    Şirkət: item.company?.name || "-",
    Departament: item.department?.name || "-",
    Kateqoriya: item.category?.name || "-",
    "Məsul şəxs": item.responsible?.full_name || "-",
    Email: item.responsible?.email || "-",
    Status: getStatusLabel(item.status),
    "Health status": getHealthLabel(item.computed_health_status),
    "Health score": item.computed_health_score ?? "-",
    "Zəmanət statusu": item.warranty_info?.label || "-",
    "Zəmanət bitmə tarixi": formatDate(item.warranty_end_date),
    "Alış tarixi": formatDate(item.purchase_date),
    "Alış qiyməti": formatMoney(item.purchase_price, item.currency),
    "QR status": item.qr_token ? "Var" : "Yoxdur",
    "Yaradılma tarixi": formatDateTime(item.created_at),
  }));
}

function autoSizeWorksheetColumns(worksheet, rows) {
  const keys = rows.reduce((acc, row) => {
    Object.keys(row || {}).forEach((key) => acc.add(key));
    return acc;
  }, new Set());

  worksheet["!cols"] = Array.from(keys).map((key) => {
    const max = rows.reduce((width, row) => {
      const value = row?.[key];
      return Math.max(width, String(value ?? "").length);
    }, String(key).length);

    return { wch: Math.min(Math.max(max + 2, 12), 45) };
  });
}

function buildPrintHtml({ items, summary, reportDate, filtersText }) {
  const riskyRows = items
    .filter((item) =>
      ["RISKY", "CRITICAL"].includes(item.computed_health_status)
    )
    .slice(0, 40)
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><b>${item.inventory_code || "-"}</b><small>${item.name || "-"}</small></td>
          <td>${item.company?.name || "-"}</td>
          <td>${item.responsible?.full_name || "-"}</td>
          <td>${getStatusLabel(item.status)}</td>
          <td>${getHealthLabel(item.computed_health_status)} / ${item.computed_health_score ?? "-"}</td>
          <td>${item.warranty_info?.label || "-"}</td>
        </tr>
      `
    )
    .join("");

  const warrantyRows = items
    .filter((item) => ["EXPIRED", "ENDING"].includes(item.warranty_info?.state))
    .slice(0, 40)
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><b>${item.inventory_code || "-"}</b><small>${item.name || "-"}</small></td>
          <td>${item.company?.name || "-"}</td>
          <td>${item.responsible?.full_name || "-"}</td>
          <td>${item.warranty_info?.label || "-"}</td>
          <td>${formatDate(item.warranty_end_date)}</td>
        </tr>
      `
    )
    .join("");

  const noResponsibleRows = items
    .filter((item) => !item.responsible?.id)
    .slice(0, 30)
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><b>${item.inventory_code || "-"}</b><small>${item.name || "-"}</small></td>
          <td>${item.company?.name || "-"}</td>
          <td>${item.department?.name || "-"}</td>
          <td>${getStatusLabel(item.status)}</td>
          <td>${item.current_location || "-"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Audit Report</title>
        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 28px;
            background: #f8fafc;
            color: #0f172a;
            font-family: Inter, Arial, sans-serif;
          }

          .report {
            max-width: 1180px;
            margin: 0 auto;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            border-radius: 28px;
            background: #ffffff;
            box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
          }

          .hero {
            padding: 30px;
            color: #ffffff;
            background:
              radial-gradient(circle at 90% 0%, rgba(251, 191, 36, 0.32), transparent 28%),
              linear-gradient(135deg, #020617, #111827 58%, #92400e);
            display: flex;
            justify-content: space-between;
            gap: 22px;
          }

          .hero span {
            display: inline-flex;
            margin-bottom: 10px;
            color: #fde68a;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .hero h1 {
            margin: 0;
            font-size: 36px;
            line-height: 1;
            letter-spacing: -0.06em;
          }

          .hero p {
            margin: 12px 0 0;
            max-width: 720px;
            color: #e5e7eb;
            font-size: 14px;
            line-height: 1.6;
          }

          .logo {
            width: 64px;
            height: 64px;
            min-width: 64px;
            border-radius: 22px;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #f59e0b, #facc15);
            color: #111827;
            font-weight: 950;
            font-size: 18px;
          }

          .meta {
            padding: 18px 30px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #475569;
            font-size: 13px;
            font-weight: 800;
          }

          .cards {
            padding: 22px 30px;
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 12px;
          }

          .card {
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 16px;
            background: #ffffff;
          }

          .card span {
            display: block;
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .card strong {
            display: block;
            margin-top: 8px;
            color: #0f172a;
            font-size: 28px;
            letter-spacing: -0.05em;
          }

          .section {
            padding: 0 30px 24px;
          }

          .section h2 {
            margin: 0 0 12px;
            font-size: 19px;
            letter-spacing: -0.04em;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th {
            background: #111827;
            color: #ffffff;
            text-align: left;
            font-size: 11px;
            padding: 12px;
          }

          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 11px 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: top;
          }

          td b {
            display: block;
            color: #0f172a;
          }

          td small {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-weight: 700;
          }

          .footer {
            padding: 18px 30px 26px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
          }

          @media print {
            body {
              padding: 0;
              background: #ffffff;
            }

            .report {
              box-shadow: none;
              border: 0;
              border-radius: 0;
            }

            .hero,
            .card,
            th {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            @page {
              size: A4 landscape;
              margin: 10mm;
            }
          }
        </style>
      </head>

      <body>
        <main class="report">
          <section class="hero">
            <div>
              <span>Cahan Holding Inventory</span>
              <h1>Audit hesabatı</h1>
              <p>
                Riskli inventarlar, zəmanət xəbərdarlıqları, məsul şəxssiz
                aktivlər və filterlənmiş audit nəticələri.
              </p>
            </div>
            <div class="logo">AUD</div>
          </section>

          <section class="meta">
            Hazırlanma tarixi: ${reportDate}<br />
            Filterlər: ${filtersText}
          </section>

          <section class="cards">
            <div class="card"><span>Ümumi</span><strong>${summary.total}</strong></div>
            <div class="card"><span>Göstərilən</span><strong>${summary.shown}</strong></div>
            <div class="card"><span>Riskli</span><strong>${summary.risky}</strong></div>
            <div class="card"><span>Zəmanəti bitib</span><strong>${summary.expiredWarranty}</strong></div>
            <div class="card"><span>Məsul şəxssiz</span><strong>${summary.noResponsible}</strong></div>
          </section>

          <section class="section">
            <h2>Riskli inventarlar</h2>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>İnventar</th>
                  <th>Şirkət</th>
                  <th>Məsul şəxs</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Zəmanət</th>
                </tr>
              </thead>
              <tbody>
                ${
                  riskyRows ||
                  `<tr><td colspan="7">Riskli inventar yoxdur.</td></tr>`
                }
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2>Zəmanət xəbərdarlıqları</h2>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>İnventar</th>
                  <th>Şirkət</th>
                  <th>Məsul şəxs</th>
                  <th>Zəmanət statusu</th>
                  <th>Bitmə tarixi</th>
                </tr>
              </thead>
              <tbody>
                ${
                  warrantyRows ||
                  `<tr><td colspan="6">Zəmanət xəbərdarlığı yoxdur.</td></tr>`
                }
              </tbody>
            </table>
          </section>

          <section class="section">
            <h2>Məsul şəxssiz inventarlar</h2>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>İnventar</th>
                  <th>Şirkət</th>
                  <th>Departament</th>
                  <th>Status</th>
                  <th>Yerləşmə</th>
                </tr>
              </thead>
              <tbody>
                ${
                  noResponsibleRows ||
                  `<tr><td colspan="6">Məsul şəxssiz inventar yoxdur.</td></tr>`
                }
              </tbody>
            </table>
          </section>

          <section class="footer">
            © Cahan Holding · Audit / Inventory Risk Report
          </section>
        </main>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedHealths, setSelectedHealths] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedWarrantyStates, setSelectedWarrantyStates] = useState([]);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [purchaseFrom, setPurchaseFrom] = useState("");
  const [purchaseTo, setPurchaseTo] = useState("");

  const [createdFromText, setCreatedFromText] = useState("");
  const [createdToText, setCreatedToText] = useState("");
  const [purchaseFromText, setPurchaseFromText] = useState("");
  const [purchaseToText, setPurchaseToText] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    loadAudit();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    riskFilter,
    selectedStatuses,
    selectedHealths,
    selectedCompanies,
    selectedCategories,
    selectedWarrantyStates,
    createdFrom,
    createdTo,
    purchaseFrom,
    purchaseTo,
    pageSize,
  ]);

  const currentRole = normalizeRole(me?.roles?.name || me?.role || "USER");
  const allowed = ALLOWED_ROLES.includes(currentRole);

  async function loadAudit() {
    setLoading(true);

    const profile = await loadMe();

    if (!ALLOWED_ROLES.includes(normalizeRole(profile?.roles?.name || profile?.role))) {
      setItems([]);
      setLoading(false);
      return;
    }

    await loadItems();

    setLoading(false);
  }

  async function loadMe() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMe(null);
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        email,
        company_id,
        status,
        roles (
          id,
          name,
          label
        ),
        companies (
          id,
          name
        )
      `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("AUDIT PROFILE ERROR:", profileError);
    }

    setMe(profile || null);
    return profile || null;
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select(
        `
        id,
        inventory_code,
        name,
        description,
        serial_number,
        model,
        brand,
        status,
        condition,
        purchase_date,
        purchase_price,
        currency,
        warranty_start_date,
        warranty_end_date,
        qr_token,
        health_score,
        health_status,
        current_location,
        created_at,
        company:companies!inventory_items_company_id_fkey (
          id,
          name
        ),
        department:departments!inventory_items_department_id_fkey (
          id,
          name
        ),
        category:inventory_categories!inventory_items_category_id_fkey (
          id,
          name
        ),
        responsible:profiles!inventory_items_responsible_user_id_fkey (
          id,
          full_name,
          email
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("AUDIT INVENTORY LOAD ERROR:", error);
      setItems([]);
      return;
    }

    setItems((data || []).map(enrichItem));
  }

  const companyOptions = useMemo(() => {
    const map = new Map();

    items.forEach((item) => {
      if (item.company?.id) {
        map.set(String(item.company.id), item.company.name);
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const categoryOptions = useMemo(() => {
    const map = new Map();

    items.forEach((item) => {
      if (item.category?.id) {
        map.set(String(item.category.id), item.category.name);
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);

    return items.filter((item) => {
      const text = [
        item.inventory_code,
        item.name,
        item.brand,
        item.model,
        item.serial_number,
        item.company?.name,
        item.department?.name,
        item.category?.name,
        item.responsible?.full_name,
        item.responsible?.email,
        getStatusLabel(item.status),
        getHealthLabel(item.computed_health_status),
        item.warranty_info?.label,
        item.current_location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);

      const isRisky = ["RISKY", "CRITICAL"].includes(
        item.computed_health_status
      );
      const isCritical = item.computed_health_status === "CRITICAL";
      const warrantyAlert = ["EXPIRED", "ENDING"].includes(
        item.warranty_info?.state
      );
      const noResponsible = !item.responsible?.id;
      const noQr = !item.qr_token;

      const matchesRisk =
        riskFilter === "ALL" ||
        (riskFilter === "RISKY" && isRisky) ||
        (riskFilter === "CRITICAL" && isCritical) ||
        (riskFilter === "WARRANTY" && warrantyAlert) ||
        (riskFilter === "NO_RESPONSIBLE" && noResponsible) ||
        (riskFilter === "NO_QR" && noQr);

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(item.status);

      const matchesHealth =
        selectedHealths.length === 0 ||
        selectedHealths.includes(item.computed_health_status);

      const matchesCompany =
        selectedCompanies.length === 0 ||
        selectedCompanies.includes(String(item.company?.id || ""));

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(String(item.category?.id || ""));

      const matchesWarranty =
        selectedWarrantyStates.length === 0 ||
        selectedWarrantyStates.includes(item.warranty_info?.state || "NONE");

      const matchesCreated =
        (!createdFrom && !createdTo) ||
        isDateInRange(item.created_at, createdFrom, createdTo);

      const matchesPurchase =
        (!purchaseFrom && !purchaseTo) ||
        isDateInRange(item.purchase_date, purchaseFrom, purchaseTo);

      return (
        matchesSearch &&
        matchesRisk &&
        matchesStatus &&
        matchesHealth &&
        matchesCompany &&
        matchesCategory &&
        matchesWarranty &&
        matchesCreated &&
        matchesPurchase
      );
    });
  }, [
    items,
    search,
    riskFilter,
    selectedStatuses,
    selectedHealths,
    selectedCompanies,
    selectedCategories,
    selectedWarrantyStates,
    createdFrom,
    createdTo,
    purchaseFrom,
    purchaseTo,
  ]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((a, b) => {
      let aValue = a?.[sortBy];
      let bValue = b?.[sortBy];

      if (sortBy === "inventory") {
        aValue = a.name || "";
        bValue = b.name || "";
      }

      if (sortBy === "company") {
        aValue = a.company?.name || "";
        bValue = b.company?.name || "";
      }

      if (sortBy === "category") {
        aValue = a.category?.name || "";
        bValue = b.category?.name || "";
      }

      if (sortBy === "responsible") {
        aValue = a.responsible?.full_name || "";
        bValue = b.responsible?.full_name || "";
      }

      if (sortBy === "status") {
        aValue = getStatusLabel(a.status);
        bValue = getStatusLabel(b.status);
      }

      if (sortBy === "health") {
        aValue = Number(a.computed_health_score || 0);
        bValue = Number(b.computed_health_score || 0);
      }

      if (sortBy === "warranty") {
        aValue = a.warranty_end_date || "";
        bValue = b.warranty_end_date || "";
      }

      return compareValues(aValue, bValue, sortDir);
    });

    return list;
  }, [filteredItems, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

  const paginatedItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize, totalPages]);

  const summary = useMemo(() => {
    const risky = items.filter((item) =>
      ["RISKY", "CRITICAL"].includes(item.computed_health_status)
    ).length;

    const critical = items.filter(
      (item) => item.computed_health_status === "CRITICAL"
    ).length;

    const expiredWarranty = items.filter(
      (item) => item.warranty_info?.state === "EXPIRED"
    ).length;

    const endingWarranty = items.filter(
      (item) => item.warranty_info?.state === "ENDING"
    ).length;

    const noResponsible = items.filter((item) => !item.responsible?.id).length;
    const noQr = items.filter((item) => !item.qr_token).length;
    const assigned = items.filter((item) => item.status === "ASSIGNED").length;

    return {
      total: items.length,
      shown: filteredItems.length,
      risky,
      critical,
      expiredWarranty,
      endingWarranty,
      noResponsible,
      noQr,
      assigned,
    };
  }, [items, filteredItems]);

  const filteredSummary = useMemo(() => {
    const risky = filteredItems.filter((item) =>
      ["RISKY", "CRITICAL"].includes(item.computed_health_status)
    ).length;

    const critical = filteredItems.filter(
      (item) => item.computed_health_status === "CRITICAL"
    ).length;

    const expiredWarranty = filteredItems.filter(
      (item) => item.warranty_info?.state === "EXPIRED"
    ).length;

    const noResponsible = filteredItems.filter(
      (item) => !item.responsible?.id
    ).length;

    return {
      risky,
      critical,
      expiredWarranty,
      noResponsible,
    };
  }, [filteredItems]);

  const riskPercent = summary.total
    ? Math.min(100, Math.round((summary.risky / summary.total) * 100))
    : 0;

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

  function resetFilters() {
    setSearch("");
    setRiskFilter("ALL");
    setSelectedStatuses([]);
    setSelectedHealths([]);
    setSelectedCompanies([]);
    setSelectedCategories([]);
    setSelectedWarrantyStates([]);
    setCreatedFrom("");
    setCreatedTo("");
    setPurchaseFrom("");
    setPurchaseTo("");
    setCreatedFromText("");
    setCreatedToText("");
    setPurchaseFromText("");
    setPurchaseToText("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  function handleDateTextChange(textSetter, valueSetter, value) {
    const masked = formatDateInputMask(value);
    textSetter(masked);

    if (!masked) {
      valueSetter("");
      return;
    }

    if (masked.length === 10) {
      valueSetter(parseDisplayDate(masked));
    } else {
      valueSetter("");
    }
  }

  function getActiveFiltersText() {
    const parts = [];

    if (search.trim()) parts.push(`Axtarış: "${search.trim()}"`);
    if (riskFilter !== "ALL") {
      parts.push(
        `Risk: ${
          RISK_FILTER_OPTIONS.find((x) => x.value === riskFilter)?.label ||
          riskFilter
        }`
      );
    }

    if (selectedStatuses.length) {
      parts.push(
        `Status: ${selectedStatuses.map((x) => getStatusLabel(x)).join(", ")}`
      );
    }

    if (selectedHealths.length) {
      parts.push(
        `Health: ${selectedHealths.map((x) => getHealthLabel(x)).join(", ")}`
      );
    }

    if (selectedWarrantyStates.length) {
      parts.push(
        `Zəmanət: ${selectedWarrantyStates
          .map((x) => getWarrantyLabel(x))
          .join(", ")}`
      );
    }

    if (selectedCompanies.length) {
      const names = companyOptions
        .filter((x) => selectedCompanies.includes(String(x.id)))
        .map((x) => x.name);

      parts.push(`Şirkət: ${names.join(", ")}`);
    }

    if (selectedCategories.length) {
      const names = categoryOptions
        .filter((x) => selectedCategories.includes(String(x.id)))
        .map((x) => x.name);

      parts.push(`Kateqoriya: ${names.join(", ")}`);
    }

    if (createdFrom || createdTo) {
      parts.push(
        `Yaradılma: ${formatInputDate(createdFrom) || "..."} - ${
          formatInputDate(createdTo) || "..."
        }`
      );
    }

    if (purchaseFrom || purchaseTo) {
      parts.push(
        `Alış: ${formatInputDate(purchaseFrom) || "..."} - ${
          formatInputDate(purchaseTo) || "..."
        }`
      );
    }

    return parts.length ? parts.join(" · ") : "Filter yoxdur";
  }

  function exportExcel() {
    const rows = toExcelRows(sortedItems);

    const summaryRows = [
      { Bölmə: "Ümumi", Ad: "Bütün inventar", Say: summary.total },
      { Bölmə: "Ümumi", Ad: "Filter nəticəsi", Say: summary.shown },
      { Bölmə: "Risk", Ad: "Riskli", Say: summary.risky },
      { Bölmə: "Risk", Ad: "Critical", Say: summary.critical },
      { Bölmə: "Zəmanət", Ad: "Zəmanəti bitib", Say: summary.expiredWarranty },
      { Bölmə: "Zəmanət", Ad: "30 günə bitəcək", Say: summary.endingWarranty },
      { Bölmə: "Təhkim", Ad: "Məsul şəxssiz", Say: summary.noResponsible },
      { Bölmə: "Təhkim", Ad: "Təhkim olunub", Say: summary.assigned },
      { Bölmə: "QR", Ad: "QR yoxdur", Say: summary.noQr },
    ];

    const workbook = XLSX.utils.book_new();

    const metaSheet = XLSX.utils.aoa_to_sheet([
      ["Cahan Holding Audit Report"],
      ["Hazırlanma tarixi", formatDateTime(new Date())],
      ["Aktiv filterlər", getActiveFiltersText()],
      ["Sort", `${sortBy} / ${sortDir}`],
      ["Nəticə sayı", sortedItems.length],
    ]);
    metaSheet["!cols"] = [{ wch: 28 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, metaSheet, "Report info");

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    autoSizeWorksheetColumns(summarySheet, summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const dataSheet = XLSX.utils.json_to_sheet(rows);
    autoSizeWorksheetColumns(dataSheet, rows);
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Audit data");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `audit-report-${date}.xlsx`);
  }

  function printReport() {
    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Print pəncərəsi bloklandı. Brauzer popup icazəsini yoxla.");
      return;
    }

    const html = buildPrintHtml({
      items: sortedItems,
      summary,
      reportDate: formatDateTime(new Date()),
      filtersText: getActiveFiltersText(),
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (!loading && !allowed) {
    return (
      <div className="audit-page">
        <section className="audit-hero">
          <div>
            <span>Access denied</span>
            <h1>İcazə yoxdur</h1>
            <p>
              Audit səhifəsi yalnız ADMIN və AUDIT rolları üçün nəzərdə tutulub.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="audit-page">
      <section className="audit-hero">
        <div>
          <span>Audit workspace</span>
          <h1>Audit / Hesabatlar</h1>
          <p>
            Riskli inventarlar, zəmanət xəbərdarlıqları, məsul şəxssiz aktivlər
            və tam filterlənən audit nəzarəti.
          </p>
        </div>

        <div className="audit-hero-actions">
          <button
            type="button"
            className="audit-report-btn excel"
            onClick={exportExcel}
            disabled={loading || sortedItems.length === 0}
          >
            Excel report
          </button>

          <button
            type="button"
            className="audit-report-btn print"
            onClick={printReport}
            disabled={loading || sortedItems.length === 0}
          >
            Print report
          </button>

          <button type="button" className="audit-refresh-btn" onClick={loadAudit}>
            Yenilə
          </button>
        </div>
      </section>

      <section className="audit-kpi-grid">
        <AuditKpi label="Ümumi inventar" value={loading ? "..." : summary.total} />
        <AuditKpi label="Filter nəticəsi" value={loading ? "..." : summary.shown} tone="info" />
        <AuditKpi label="Riskli" value={loading ? "..." : summary.risky} tone="danger" />
        <AuditKpi label="Critical" value={loading ? "..." : summary.critical} tone="dark" />
        <AuditKpi
          label="Zəmanəti bitib"
          value={loading ? "..." : summary.expiredWarranty}
          tone="warning"
        />
        <AuditKpi
          label="Məsul şəxssiz"
          value={loading ? "..." : summary.noResponsible}
          tone="info"
        />
      </section>

      <section className="audit-grid">
        <div className="audit-panel audit-risk-panel">
          <div className="audit-panel-head">
            <div>
              <span>Risk index</span>
              <h3>Ümumi risk göstəricisi</h3>
            </div>

            <strong>{riskPercent}%</strong>
          </div>

          <div className="audit-risk-ring" style={{ "--risk": `${riskPercent * 3.6}deg` }}>
            <div>
              <strong>{riskPercent}%</strong>
              <span>risk</span>
            </div>
          </div>

          <div className="audit-risk-list">
            <AuditRiskRow label="Riskli health" value={summary.risky} total={summary.total} />
            <AuditRiskRow label="Critical" value={summary.critical} total={summary.total} />
            <AuditRiskRow
              label="Zəmanəti bitib"
              value={summary.expiredWarranty}
              total={summary.total}
            />
            <AuditRiskRow
              label="Məsul şəxssiz"
              value={summary.noResponsible}
              total={summary.total}
            />
            <AuditRiskRow label="QR yoxdur" value={summary.noQr} total={summary.total} />
          </div>
        </div>

        <div className="audit-panel">
          <div className="audit-panel-head">
            <div>
              <span>Professional filters</span>
              <h3>Audit filterləri</h3>
            </div>

            <button type="button" className="audit-reset-btn" onClick={resetFilters}>
              Sıfırla
            </button>
          </div>

          <div className="audit-search-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kod, ad, şirkət, məsul şəxs, status üzrə axtar..."
            />
          </div>

          <div className="audit-filter-block">
            <span>Risk baxışı</span>
            <div className="audit-filter-buttons">
              {RISK_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={riskFilter === item.value ? "active" : ""}
                  onClick={() => setRiskFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <FilterChipGroup
            title="Status"
            options={STATUS_OPTIONS}
            selected={selectedStatuses}
            onToggle={(value) =>
              setSelectedStatuses((prev) => toggleArrayValue(prev, value))
            }
          />

          <FilterChipGroup
            title="Health"
            options={HEALTH_OPTIONS}
            selected={selectedHealths}
            onToggle={(value) =>
              setSelectedHealths((prev) => toggleArrayValue(prev, value))
            }
          />

          <FilterChipGroup
            title="Zəmanət"
            options={WARRANTY_OPTIONS}
            selected={selectedWarrantyStates}
            onToggle={(value) =>
              setSelectedWarrantyStates((prev) =>
                toggleArrayValue(prev, value)
              )
            }
          />

          <FilterChipGroup
            title="Şirkətlər"
            options={companyOptions}
            selected={selectedCompanies}
            onToggle={(value) =>
              setSelectedCompanies((prev) => toggleArrayValue(prev, value))
            }
          />

          <FilterChipGroup
            title="Kateqoriyalar"
            options={categoryOptions}
            selected={selectedCategories}
            onToggle={(value) =>
              setSelectedCategories((prev) => toggleArrayValue(prev, value))
            }
          />

          <div className="audit-date-grid">
            <DateMaskField
              label="Yaradılma - başlanğıc"
              value={createdFromText}
              onChange={(value) =>
                handleDateTextChange(setCreatedFromText, setCreatedFrom, value)
              }
            />

            <DateMaskField
              label="Yaradılma - son"
              value={createdToText}
              onChange={(value) =>
                handleDateTextChange(setCreatedToText, setCreatedTo, value)
              }
            />

            <DateMaskField
              label="Alış - başlanğıc"
              value={purchaseFromText}
              onChange={(value) =>
                handleDateTextChange(setPurchaseFromText, setPurchaseFrom, value)
              }
            />

            <DateMaskField
              label="Alış - son"
              value={purchaseToText}
              onChange={(value) =>
                handleDateTextChange(setPurchaseToText, setPurchaseTo, value)
              }
            />
          </div>

          <div className="audit-note-box">
            <strong>Aktiv filterlər</strong>
            <p>{getActiveFiltersText()}</p>
          </div>
        </div>
      </section>

      <section className="audit-mini-summary">
        <div>
          <span>Filter riskli</span>
          <strong>{filteredSummary.risky}</strong>
        </div>

        <div>
          <span>Filter critical</span>
          <strong>{filteredSummary.critical}</strong>
        </div>

        <div>
          <span>Filter zəmanət bitib</span>
          <strong>{filteredSummary.expiredWarranty}</strong>
        </div>

        <div>
          <span>Filter məsul şəxssiz</span>
          <strong>{filteredSummary.noResponsible}</strong>
        </div>
      </section>

      <section className="audit-table-card">
        <div className="audit-table-head">
          <div>
            <span>Inventory audit list</span>
            <h3>Audit siyahısı</h3>
          </div>

          <strong>{loading ? "..." : `${sortedItems.length} nəticə`}</strong>
        </div>

        {loading ? (
          <div className="audit-empty">Audit məlumatları yüklənir...</div>
        ) : sortedItems.length === 0 ? (
          <div className="audit-empty">Bu filterlərə uyğun audit məlumatı yoxdur.</div>
        ) : (
          <>
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" onClick={() => toggleSort("inventory_code")}>
                        Kod <span>{sortIcon("inventory_code")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("inventory")}>
                        İnventar <span>{sortIcon("inventory")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("company")}>
                        Şirkət <span>{sortIcon("company")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("category")}>
                        Kateqoriya <span>{sortIcon("category")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("responsible")}>
                        Məsul şəxs <span>{sortIcon("responsible")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("status")}>
                        Status <span>{sortIcon("status")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("health")}>
                        Health <span>{sortIcon("health")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => toggleSort("warranty")}>
                        Zəmanət <span>{sortIcon("warranty")}</span>
                      </button>
                    </th>
                    <th>QR</th>
                    <th>
                      <button type="button" onClick={() => toggleSort("created_at")}>
                        Yaradılma <span>{sortIcon("created_at")}</span>
                      </button>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.inventory_code || "-"}</strong>
                      </td>

                      <td>
                        <div className="audit-item-cell">
                          <strong>{item.name || "-"}</strong>
                          <span>
                            {[item.brand, item.model, item.serial_number]
                              .filter(Boolean)
                              .join(" · ") || "-"}
                          </span>
                        </div>
                      </td>

                      <td>{item.company?.name || "-"}</td>
                      <td>{item.category?.name || "-"}</td>
                      <td>{item.responsible?.full_name || "-"}</td>

                      <td>
                        <span className={`audit-status status-${item.status || "NONE"}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`audit-health health-${
                            item.computed_health_status || "NONE"
                          }`}
                        >
                          {getHealthLabel(item.computed_health_status)} ·{" "}
                          {item.computed_health_score ?? "-"}
                        </span>
                      </td>

                      <td>{item.warranty_info?.label || "-"}</td>
                      <td>{item.qr_token ? "Var" : "Yoxdur"}</td>
                      <td>{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="audit-pagination">
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

              <div className="audit-page-info">
                <span>
                  {sortedItems.length === 0
                    ? "0 nəticə"
                    : `${(Math.min(page, totalPages) - 1) * pageSize + 1} - ${Math.min(
                        Math.min(page, totalPages) * pageSize,
                        sortedItems.length
                      )} / ${sortedItems.length}`}
                </span>
              </div>

              <div className="audit-page-buttons">
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
      </section>

      <style jsx global>{`
        .audit-page {
          display: grid;
          gap: 18px;
        }

        .audit-hero {
          min-height: 210px;
          border: 1px solid rgba(226, 232, 240, 0.92);
          border-radius: 30px;
          padding: 28px;
          background:
            radial-gradient(circle at 90% 0%, rgba(245, 158, 11, 0.16), transparent 28%),
            linear-gradient(135deg, #ffffff, #f8fafc);
          box-shadow: 0 20px 70px rgba(15, 23, 42, 0.06);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .audit-hero span,
        .audit-panel-head span,
        .audit-table-head span {
          display: inline-flex;
          color: #d97706;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .audit-hero h1 {
          margin: 8px 0 0;
          color: #0f172a;
          font-size: clamp(34px, 5vw, 64px);
          line-height: 0.95;
          letter-spacing: -0.08em;
        }

        .audit-hero p {
          max-width: 650px;
          margin: 14px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.65;
          font-weight: 700;
        }

        .audit-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .audit-report-btn,
        .audit-refresh-btn,
        .audit-reset-btn {
          height: 46px;
          border-radius: 15px;
          padding: 0 15px;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
          border: 1px solid #dbe3ee;
          background: #ffffff;
          color: #0f172a;
        }

        .audit-report-btn.excel {
          border-color: #bbf7d0;
          background: linear-gradient(135deg, #ecfdf5, #ffffff);
          color: #15803d;
        }

        .audit-report-btn.print {
          border-color: #fde68a;
          background: linear-gradient(135deg, #fffbeb, #ffffff);
          color: #b45309;
        }

        .audit-refresh-btn {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }

        .audit-reset-btn {
          height: 38px;
          border-radius: 13px;
          color: #b45309;
          background: #fffbeb;
          border-color: #fde68a;
        }

        .audit-report-btn:disabled,
        .audit-refresh-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .audit-kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
        }

        .audit-kpi {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 18px;
          background: #ffffff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.055);
        }

        .audit-kpi span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .audit-kpi strong {
          display: block;
          margin-top: 10px;
          color: #0f172a;
          font-size: 34px;
          line-height: 1;
          letter-spacing: -0.06em;
        }

        .audit-kpi.tone-danger {
          border-color: #fecaca;
          background: #fef2f2;
        }

        .audit-kpi.tone-warning {
          border-color: #fde68a;
          background: #fffbeb;
        }

        .audit-kpi.tone-info {
          border-color: #bae6fd;
          background: #f0f9ff;
        }

        .audit-kpi.tone-dark {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .audit-grid {
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 18px;
          align-items: start;
        }

        .audit-panel,
        .audit-table-card,
        .audit-mini-summary {
          border: 1px solid #e2e8f0;
          border-radius: 28px;
          padding: 22px;
          background: #ffffff;
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.055);
        }

        .audit-panel-head,
        .audit-table-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .audit-panel-head h3,
        .audit-table-head h3 {
          margin: 6px 0 0;
          color: #0f172a;
          font-size: 21px;
          letter-spacing: -0.05em;
        }

        .audit-panel-head strong,
        .audit-table-head strong {
          color: #0f172a;
          font-size: 20px;
        }

        .audit-risk-ring {
          width: 220px;
          height: 220px;
          margin: 18px auto;
          border-radius: 999px;
          display: grid;
          place-items: center;
          position: relative;
          background:
            conic-gradient(#ef4444 var(--risk), #e2e8f0 0deg);
        }

        .audit-risk-ring::after {
          content: "";
          position: absolute;
          inset: 18px;
          border-radius: inherit;
          background: #ffffff;
          box-shadow: inset 0 0 0 1px #e2e8f0;
        }

        .audit-risk-ring > div {
          position: relative;
          z-index: 1;
          text-align: center;
        }

        .audit-risk-ring strong {
          display: block;
          color: #0f172a;
          font-size: 40px;
          line-height: 1;
          letter-spacing: -0.06em;
        }

        .audit-risk-ring span {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .audit-risk-list {
          display: grid;
          gap: 12px;
        }

        .audit-risk-row {
          display: grid;
          gap: 8px;
        }

        .audit-risk-row > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #475569;
          font-size: 13px;
          font-weight: 900;
        }

        .audit-risk-row i {
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: #eef2f7;
        }

        .audit-risk-row b {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #f59e0b, #ef4444);
        }

        .audit-search-row input {
          width: 100%;
          height: 48px;
          border: 1px solid #dbe3ee;
          border-radius: 16px;
          padding: 0 14px;
          outline: none;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
        }

        .audit-filter-block {
          margin-top: 16px;
        }

        .audit-filter-block > span {
          display: block;
          margin-bottom: 9px;
          color: #334155;
          font-size: 12px;
          font-weight: 950;
        }

        .audit-filter-buttons,
        .audit-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .audit-filter-buttons button,
        .audit-chip-row button {
          min-height: 36px;
          border: 1px solid #dbe3ee;
          border-radius: 999px;
          background: #ffffff;
          color: #475569;
          padding: 0 13px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
        }

        .audit-filter-buttons button.active,
        .audit-chip-row button.active {
          border-color: #f59e0b;
          background: #fffbeb;
          color: #b45309;
        }

        .audit-date-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .audit-date-grid label {
          display: grid;
          gap: 7px;
        }

        .audit-date-grid label span {
          color: #334155;
          font-size: 12px;
          font-weight: 950;
        }

        .audit-date-grid input {
          width: 100%;
          height: 42px;
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          padding: 0 12px;
          color: #0f172a;
          font-weight: 800;
          outline: none;
        }

        .audit-date-grid input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
        }

        .audit-date-grid b {
          color: #64748b;
          font-size: 11px;
        }

        .audit-note-box {
          margin-top: 18px;
          border: 1px solid #fde68a;
          border-radius: 20px;
          padding: 16px;
          background: #fffbeb;
        }

        .audit-note-box strong {
          display: block;
          color: #92400e;
          font-size: 14px;
        }

        .audit-note-box p {
          margin: 7px 0 0;
          color: #92400e;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 700;
        }

        .audit-mini-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          padding: 16px;
        }

        .audit-mini-summary div {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 14px;
          background: #f8fafc;
        }

        .audit-mini-summary span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 950;
        }

        .audit-mini-summary strong {
          display: block;
          margin-top: 7px;
          color: #0f172a;
          font-size: 26px;
          letter-spacing: -0.06em;
        }

        .audit-table-wrap {
          overflow-x: auto;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1120px;
        }

        .audit-table th {
          text-align: left;
          padding: 12px;
          background: #0f172a;
          color: #ffffff;
          font-size: 11px;
          white-space: nowrap;
        }

        .audit-table th button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font: inherit;
          font-weight: 950;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0;
        }

        .audit-table td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
          font-size: 13px;
          vertical-align: top;
        }

        .audit-item-cell strong {
          display: block;
          color: #0f172a;
        }

        .audit-item-cell span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .audit-status,
        .audit-health {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          border-radius: 999px;
          padding: 0 10px;
          background: #f1f5f9;
          color: #334155;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .audit-health.health-RISKY,
        .audit-health.health-CRITICAL {
          background: #fef2f2;
          color: #b91c1c;
        }

        .audit-health.health-WATCH {
          background: #fffbeb;
          color: #b45309;
        }

        .audit-status.status-IN_REPAIR {
          background: #fffbeb;
          color: #b45309;
        }

        .audit-status.status-LOST,
        .audit-status.status-WRITTEN_OFF,
        .audit-status.status-DISPOSED {
          background: #fef2f2;
          color: #b91c1c;
        }

        .audit-empty {
          border: 1px dashed #cbd5e1;
          border-radius: 22px;
          padding: 28px;
          text-align: center;
          color: #64748b;
          font-weight: 800;
          background: #f8fafc;
        }

        .audit-pagination {
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          border-top: 1px solid #e2e8f0;
          padding-top: 16px;
        }

        .audit-pagination > div:first-child {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
          font-weight: 900;
        }

        .audit-pagination select {
          height: 36px;
          border: 1px solid #dbe3ee;
          border-radius: 12px;
          padding: 0 10px;
          font-weight: 900;
        }

        .audit-page-info {
          color: #64748b;
          font-size: 13px;
          font-weight: 900;
        }

        .audit-page-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .audit-page-buttons button {
          height: 36px;
          border: 1px solid #dbe3ee;
          border-radius: 12px;
          background: #ffffff;
          color: #0f172a;
          padding: 0 12px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 900;
        }

        .audit-page-buttons button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .audit-page-buttons strong {
          color: #0f172a;
          font-size: 13px;
        }

        @media (max-width: 1300px) {
          .audit-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .audit-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .audit-hero {
            display: grid;
            min-height: auto;
            padding: 22px;
          }

          .audit-hero-actions {
            justify-content: stretch;
          }

          .audit-report-btn,
          .audit-refresh-btn {
            width: 100%;
          }

          .audit-kpi-grid,
          .audit-mini-summary {
            grid-template-columns: 1fr;
          }

          .audit-panel,
          .audit-table-card {
            padding: 18px;
            border-radius: 24px;
          }

          .audit-risk-ring {
            width: 190px;
            height: 190px;
          }

          .audit-date-grid {
            grid-template-columns: 1fr;
          }

          .audit-pagination {
            display: grid;
            justify-items: stretch;
          }

          .audit-page-buttons {
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}

function AuditKpi({ label, value, tone }) {
  return (
    <div className={`audit-kpi ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuditRiskRow({ label, value, total }) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="audit-risk-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <i>
        <b style={{ width: `${percent}%` }} />
      </i>
    </div>
  );
}

function FilterChipGroup({ title, options, selected, onToggle }) {
  if (!options.length) return null;

  return (
    <div className="audit-filter-block">
      <span>{title}</span>

      <div className="audit-chip-row">
        {options.map((item) => {
          const id = String(item.value || item.id);
          const label = item.label || item.name;
          const active = selected.includes(id);

          return (
            <button
              key={id}
              type="button"
              className={active ? "active" : ""}
              onClick={() => onToggle(id)}
            >
              {active ? "✓ " : "+ "}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateMaskField({ label, value, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="gg.aa.yyyy"
        maxLength={10}
      />
      <b>{value || "gg.aa.yyyy"}</b>
    </label>
  );
}