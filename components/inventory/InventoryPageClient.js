"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import InventoryStatusPill from "./InventoryStatusPill";
import HealthScorePill from "./HealthScorePill";
import InventoryCreateModal from "./InventoryCreateModal";

const STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "Anbarda" },
  { value: "ASSIGNED", label: "Təhkim olunub" },
  { value: "IN_REPAIR", label: "Təmirdə" },
  { value: "LOST", label: "İtib" },
  { value: "WRITTEN_OFF", label: "Silinib" },
  { value: "DISPOSED", label: "İstifadədən çıxarılıb" },
];

const ITEM_STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "Anbarda" },
  { value: "ASSIGNED", label: "Təhkim olunub" },
  { value: "IN_REPAIR", label: "Təmirdə" },
  { value: "LOST", label: "İtib" },
  { value: "WRITTEN_OFF", label: "Silinib" },
  { value: "DISPOSED", label: "İstifadədən çıxarılıb" },
];

const CONDITION_OPTIONS = [
  { value: "NEW", label: "Yeni" },
  { value: "GOOD", label: "Yaxşı" },
  { value: "NORMAL", label: "Normal" },
  { value: "DAMAGED", label: "Zədələnmiş" },
  { value: "UNUSABLE", label: "Yararsız" },
];

const HEALTH_OPTIONS = [
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "WATCH", label: "Watch" },
  { value: "RISKY", label: "Risky" },
  { value: "CRITICAL", label: "Critical" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const ROLE_NAMES = {
  ADMIN: "ADMIN",
  REHBER: "REHBER",
  USER: "USER",
  IZLEYICI: "IZLEYICI",
  VIEWER: "VIEWER",
  AUDIT: "AUDIT",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toUpperCase();

  if (value === "ADMIN") return ROLE_NAMES.ADMIN;

  if (
    value === "REHBER" ||
    value === "RƏHBƏR" ||
    value === "REHBƏR" ||
    value === "RƏHBER"
  ) {
    return ROLE_NAMES.REHBER;
  }

  if (value === "AUDIT" || value === "AUDITOR" || value === "AUDİT") {
    return ROLE_NAMES.AUDIT;
  }

  if (
    value === "IZLEYICI" ||
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "IZLƏYICI" ||
    value === "VIEWER"
  ) {
    return ROLE_NAMES.IZLEYICI;
  }

  if (
    value === "USER" ||
    value === "İSTİFADƏÇİ" ||
    value === "ISTIFADECI"
  ) {
    return ROLE_NAMES.USER;
  }

  return value || ROLE_NAMES.USER;
}

function resolveProfileRole(profile) {
  return normalizeRole(
    profile?.resolved_role ||
    profile?.user_role ||
    profile?.roles?.name ||
    profile?.roles?.label ||
    "USER"
  );
}

function canViewInventory(role) {
  return [
    ROLE_NAMES.ADMIN,
    ROLE_NAMES.REHBER,
    ROLE_NAMES.IZLEYICI,
    ROLE_NAMES.VIEWER,
    ROLE_NAMES.AUDIT,
  ].includes(normalizeRole(role));
}

function canCreateInventory(role) {
  return [ROLE_NAMES.ADMIN, ROLE_NAMES.REHBER].includes(normalizeRole(role));
}

function canEditInventory(role) {
  return [ROLE_NAMES.ADMIN, ROLE_NAMES.REHBER].includes(normalizeRole(role));
}

function canDeleteInventory(role) {
  return normalizeRole(role) === ROLE_NAMES.ADMIN;
}

function canViewReports(role) {
  return [
    ROLE_NAMES.ADMIN,
    ROLE_NAMES.REHBER,
    ROLE_NAMES.IZLEYICI,
    ROLE_NAMES.VIEWER,
    ROLE_NAMES.AUDIT,
  ].includes(normalizeRole(role));
}

function canImportInventory(role) {
  return [ROLE_NAMES.ADMIN, ROLE_NAMES.REHBER].includes(normalizeRole(role));
}

function canManageQr(role) {
  return [ROLE_NAMES.ADMIN, ROLE_NAMES.REHBER].includes(normalizeRole(role));
}

function isAdmin(role) {
  return normalizeRole(role) === ROLE_NAMES.ADMIN;
}

function isRehber(role) {
  return normalizeRole(role) === ROLE_NAMES.REHBER;
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

function toInputDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getHealthLabel(value) {
  return HEALTH_OPTIONS.find((x) => x.value === value)?.label || value || "-";
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

function warrantyInfo(item) {
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

function calculateHealthFallback(item) {
  const condition = item?.condition || "";
  const status = item?.status || "";
  const warranty = warrantyInfo(item);

  if (status === "LOST" || status === "WRITTEN_OFF" || status === "DISPOSED") {
    return {
      score: 0,
      status: "CRITICAL",
    };
  }

  if (condition === "UNUSABLE") {
    return {
      score: 10,
      status: "CRITICAL",
    };
  }

  if (condition === "DAMAGED") {
    return {
      score: 35,
      status: "RISKY",
    };
  }

  if (status === "IN_REPAIR") {
    return {
      score: 45,
      status: "WATCH",
    };
  }

  if (warranty.state === "EXPIRED") {
    return {
      score: 55,
      status: "WATCH",
    };
  }

  if (warranty.state === "ENDING") {
    return {
      score: 70,
      status: "GOOD",
    };
  }

  if (condition === "NEW") {
    return {
      score: 95,
      status: "EXCELLENT",
    };
  }

  if (condition === "GOOD") {
    return {
      score: 85,
      status: "GOOD",
    };
  }

  return {
    score: 75,
    status: "GOOD",
  };
}

function enrichItem(item) {
  const fallback = calculateHealthFallback(item);

  return {
    ...item,
    images: Array.isArray(item?.images) ? item.images : [],
    computed_health_score:
      item.health_score === null || item.health_score === undefined
        ? fallback.score
        : item.health_score,
    computed_health_status: item.health_status || fallback.status,
    warranty_info: warrantyInfo(item),
  };
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function toDateOrNull(value) {
  return value || null;
}

function makeQrToken() {
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `QR-${randomPart}`;
}

function getQrUrl(token) {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/dashboard/inventory/qr/${encodeURIComponent(token)}`;
}

function getQrImageUrl(token, size = 260) {
  const qrUrl = getQrUrl(token);
  if (!qrUrl) return "";

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(
    qrUrl
  )}`;
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

function getConditionLabel(value) {
  return CONDITION_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function isImportedItem(item) {
  return String(item?.import_source || "").toUpperCase() === "EXCEL";
}

function getReportDateTime() {
  return new Date().toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeSheetName(value) {
  return String(value || "Sheet")
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31);
}

const INVENTORY_IMPORT_COLUMNS = [
  { key: "inventory_code", label: "İnventar kodu" },
  { key: "name", label: "İnventar adı" },
  { key: "description", label: "Təsvir" },
  { key: "brand", label: "Brend" },
  { key: "model", label: "Model" },
  { key: "serial_number", label: "Seriya nömrəsi" },
  { key: "company_name", label: "Şirkət adı" },
  { key: "department_name", label: "Departament adı" },
  { key: "category_name", label: "Kateqoriya adı" },
  { key: "subcategory_name", label: "Alt kateqoriya adı" },
  { key: "responsible_full_name", label: "Məsul şəxsin ad soyadı" },
  { key: "responsible_email", label: "Məsul şəxsin emaili" },
  { key: "status", label: "Status" },
  { key: "condition", label: "Vəziyyət" },
  { key: "current_location", label: "Cari yerləşmə" },
  { key: "purchase_date", label: "Alış tarixi" },
  { key: "purchase_price", label: "Alış qiyməti" },
  { key: "currency", label: "Valyuta" },
  { key: "warranty_start_date", label: "Zəmanət başlanğıcı" },
  { key: "warranty_end_date", label: "Zəmanət bitmə tarixi" },
];

const INVENTORY_IMPORT_TEMPLATE_HEADERS = INVENTORY_IMPORT_COLUMNS.map(
  (column) => column.label
);

const INVENTORY_IMPORT_LABEL_TO_KEY = INVENTORY_IMPORT_COLUMNS.reduce(
  (acc, column) => {
    acc[column.label] = column.key;
    acc[column.key] = column.key;
    return acc;
  },
  {}
);

const INVENTORY_IMPORT_SAMPLE_ROWS = [
  {
    "İnventar kodu": "INV-0001",
    "İnventar adı": "Lenovo ThinkPad E14",
    Təsvir: "Ofis üçün laptop",
    Brend: "Lenovo",
    Model: "ThinkPad E14",
    "Seriya nömrəsi": "SN123456",
    "Şirkət adı": "Cahan Holding",
    "Departament adı": "IT",
    "Kateqoriya adı": "Elektronika",
"Alt kateqoriya adı": "Laptop",
    "Məsul şəxsin ad soyadı": "Vüqar Məmmədov",
    "Məsul şəxsin emaili": "vuqar@gmail.com",
    Status: "IN_STOCK",
    Vəziyyət: "NEW",
    "Cari yerləşmə": "Baş ofis",
    "Alış tarixi": "2026-06-12",
    "Alış qiyməti": 1200,
    Valyuta: "AZN",
    "Zəmanət başlanğıcı": "2026-06-12",
    "Zəmanət bitmə tarixi": "2027-06-12",
  },
];

function normalizeImportValue(value) {
  return String(value ?? "").trim();
}

function normalizeImportLookup(value) {
  return normalizeImportValue(value).toLowerCase();
}

function normalizeImportStatus(value) {
  const raw = normalizeImportValue(value).toUpperCase();

  const map = {
    ANBARDA: "IN_STOCK",
    STOCK: "IN_STOCK",
    IN_STOCK: "IN_STOCK",
    AVAILABLE: "IN_STOCK",

    ASSIGNED: "ASSIGNED",
    TEHKIM: "ASSIGNED",
    "TƏHKIM": "ASSIGNED",
    "TƏHKİM": "ASSIGNED",

    REPAIR: "IN_REPAIR",
    IN_REPAIR: "IN_REPAIR",
    TEMIRDE: "IN_REPAIR",
    "TƏMIRDƏ": "IN_REPAIR",
    "TƏMİRDƏ": "IN_REPAIR",

    LOST: "LOST",
    ITIB: "LOST",
    "İTİB": "LOST",

    WRITTEN_OFF: "WRITTEN_OFF",
    SILINIB: "WRITTEN_OFF",
    "SİLİNİB": "WRITTEN_OFF",

    DISPOSED: "DISPOSED",
  };

  return map[raw] || raw || "IN_STOCK";
}

function normalizeImportCondition(value) {
  const raw = normalizeImportValue(value).toUpperCase();

  const map = {
    NEW: "NEW",
    YENI: "NEW",
    "YENİ": "NEW",

    GOOD: "GOOD",
    YAXSI: "GOOD",
    "YAXŞI": "GOOD",

    NORMAL: "NORMAL",

    DAMAGED: "DAMAGED",
    ZEDELENMIS: "DAMAGED",
    "ZƏDƏLƏNMİŞ": "DAMAGED",

    UNUSABLE: "UNUSABLE",
    YARARSIZ: "UNUSABLE",
  };

  return map[raw] || raw || "GOOD";
}

function normalizeImportDate(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = normalizeImportValue(value);

  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dotMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  if (dotMatch) {
    const day = dotMatch[1].padStart(2, "0");
    const month = dotMatch[2].padStart(2, "0");
    const year = dotMatch[3];

    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return raw;
}

function downloadInventoryImportTemplate() {
  const workbook = XLSX.utils.book_new();

  const templateSheet = XLSX.utils.json_to_sheet(INVENTORY_IMPORT_SAMPLE_ROWS, {
    header: INVENTORY_IMPORT_TEMPLATE_HEADERS,
  });

  templateSheet["!cols"] = INVENTORY_IMPORT_TEMPLATE_HEADERS.map((key) => ({
    wch: Math.max(18, key.length + 6),
  }));

  XLSX.utils.book_append_sheet(workbook, templateSheet, "inventory_import");

  const infoRows = [
    ["Sahə", "Açıqlama"],
    ["İnventar kodu", "Məcburi. Unikal inventar kodu. Məs: INV-0001"],
    ["İnventar adı", "Məcburi. İnventar adı."],
    ["Təsvir", "İstəyə bağlı təsvir."],
    ["Brend", "İstəyə bağlı brend."],
    ["Model", "İstəyə bağlı model."],
    ["Seriya nömrəsi", "İstəyə bağlı seriya nömrəsi."],
    ["Şirkət adı", "Məcburi. Bazada yoxdursa avtomatik yaradılacaq."],
    ["Departament adı", "İstəyə bağlı. Bazada yoxdursa seçilən şirkət altında avtomatik yaradılacaq."],
    ["Kateqoriya adı", "Məcburi. Bazada yoxdursa avtomatik yaradılacaq."],
    ["Alt kateqoriya adı", "İstəyə bağlı. Yazılıbsa həmin əsas kateqoriyanın altında yaradılacaq və inventara bağlanacaq."],
    ["Məsul şəxsin ad soyadı", "İstəyə bağlı. Sistem hesabı olmayan işçiyə təhkim üçün istifadə olunur."],
    ["Məsul şəxsin emaili", "İstəyə bağlı. Email sistemdə varsa həmin profilə təhkim edilir, yoxdursa external məlumat kimi saxlanılır."],
    ["Status", "Boş buraxıla bilər. Məsul şəxs yazılıbsa avtomatik ASSIGNED olur. Dəyərlər üçün Status seçimləri sheet-inə bax."],
    ["Vəziyyət", "Boş buraxıla bilər. Default GOOD. Dəyərlər üçün Vəziyyət seçimləri sheet-inə bax."],
    ["Cari yerləşmə", "İstəyə bağlı cari yerləşmə."],
    ["Alış tarixi", "YYYY-MM-DD və ya DD.MM.YYYY formatında tarix."],
    ["Alış qiyməti", "Rəqəm."],
    ["Valyuta", "AZN, USD, EUR, TRY"],
    ["Zəmanət başlanğıcı", "YYYY-MM-DD və ya DD.MM.YYYY formatında tarix."],
    ["Zəmanət bitmə tarixi", "YYYY-MM-DD və ya DD.MM.YYYY formatında tarix."],
  ];

  const infoSheet = XLSX.utils.aoa_to_sheet(infoRows);
  infoSheet["!cols"] = [{ wch: 32 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Qaydalar");

  const statusRows = [
    ["Excel-də yaza biləcəyin dəyər", "Sistemdə saxlanacaq dəyər", "Mənası"],
    ["IN_STOCK", "IN_STOCK", "Anbarda"],
    ["Anbarda", "IN_STOCK", "Anbarda"],
    ["ASSIGNED", "ASSIGNED", "Təhkim olunub"],
    ["Təhkim", "ASSIGNED", "Təhkim olunub"],
    ["IN_REPAIR", "IN_REPAIR", "Təmirdə"],
    ["Təmirdə", "IN_REPAIR", "Təmirdə"],
    ["LOST", "LOST", "İtib"],
    ["İtib", "LOST", "İtib"],
    ["WRITTEN_OFF", "WRITTEN_OFF", "Silinib"],
    ["Silinib", "WRITTEN_OFF", "Silinib"],
    ["DISPOSED", "DISPOSED", "İstifadədən çıxarılıb"],
  ];

  const statusSheet = XLSX.utils.aoa_to_sheet(statusRows);
  statusSheet["!cols"] = [{ wch: 34 }, { wch: 28 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, statusSheet, "Status seçimləri");

  const conditionRows = [
    ["Excel-də yaza biləcəyin dəyər", "Sistemdə saxlanacaq dəyər", "Mənası"],
    ["NEW", "NEW", "Yeni"],
    ["Yeni", "NEW", "Yeni"],
    ["GOOD", "GOOD", "Yaxşı"],
    ["Yaxşı", "GOOD", "Yaxşı"],
    ["NORMAL", "NORMAL", "Normal"],
    ["DAMAGED", "DAMAGED", "Zədələnmiş"],
    ["Zədələnmiş", "DAMAGED", "Zədələnmiş"],
    ["UNUSABLE", "UNUSABLE", "Yararsız"],
    ["Yararsız", "UNUSABLE", "Yararsız"],
  ];

  const conditionSheet = XLSX.utils.aoa_to_sheet(conditionRows);
  conditionSheet["!cols"] = [{ wch: 34 }, { wch: 28 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(workbook, conditionSheet, "Vəziyyət seçimləri");

  XLSX.writeFile(workbook, "inventory-import-template.xlsx");
}

function getImageCount(item) {
  return Array.isArray(item?.images) ? item.images.length : 0;
}

function makeInventoryReportRows(list) {
  return list.map((item, index) => ({
    "№": index + 1,
    "İnventar kodu": item.inventory_code || "-",
    "İnventar adı": item.name || "-",
    Brand: item.brand || "-",
    Model: item.model || "-",
    "Seriya nömrəsi": item.serial_number || "-",
    Təsvir: item.description || "-",
    Şirkət: item.company?.name || "-",
    Departament: item.department?.name || "-",
    Kateqoriya: item.category?.name || "-",
    "Alt kateqoriya": item.subcategory?.name || "-",
    "Məsul şəxs": item.responsible?.full_name || item.responsible_external_name || "-",
    "Məsul şəxsin emaili": item.responsible?.email || item.responsible_external_email || "-",
    Status: getStatusLabel(item.status),
    Vəziyyət: getConditionLabel(item.condition),
    "Health status": getHealthLabel(item.computed_health_status),
    "Health score": item.computed_health_score ?? "-",
    "Cari yerləşmə": item.current_location || "-",
    "Alış tarixi": formatDate(item.purchase_date),
    "Alış qiyməti": formatMoney(item.purchase_price, item.currency),
    Valyuta: item.currency || "-",
    "Zəmanət başlanğıcı": formatDate(item.warranty_start_date),
    "Zəmanət bitmə tarixi": formatDate(item.warranty_end_date),
    "Zəmanət statusu": item.warranty_info?.label || "-",
    "Şəkil sayı": getImageCount(item),
    "QR status": item.qr_token ? "QR hazırdır" : "QR yoxdur",
    "Import mənbəyi": isImportedItem(item) ? "Excel import" : "Manual",
    "Import tarixi": item.imported_at ? formatDate(item.imported_at) : "-",
    "Yaradılma tarixi": formatDate(item.created_at),
  }));
}

function makeInventorySummaryRows(summary, sortedItems) {
  const statusCounts = STATUS_OPTIONS.map((status) => ({
    Bölmə: "Status",
    Ad: status.label,
    Say: sortedItems.filter((item) => item.status === status.value).length,
  }));







  const healthCounts = HEALTH_OPTIONS.map((health) => ({
    Bölmə: "Health",
    Ad: health.label,
    Say: sortedItems.filter(
      (item) => item.computed_health_status === health.value
    ).length,
  }));

  return [
    { Bölmə: "Ümumi", Ad: "Göstərilən inventar", Say: summary.shown },
    { Bölmə: "Ümumi", Ad: "Bütün inventar", Say: summary.total },
    { Bölmə: "Ümumi", Ad: "Təhkim olunub", Say: summary.assigned },
    { Bölmə: "Ümumi", Ad: "Anbarda", Say: summary.inStock },
    { Bölmə: "Ümumi", Ad: "Təmirdə", Say: summary.repair },
    { Bölmə: "Ümumi", Ad: "Riskli health", Say: summary.risky },
    { Bölmə: "Ümumi", Ad: "Zəmanəti bitən", Say: summary.expiredWarranty },
    {},
    ...statusCounts,
    {},
    ...healthCounts,
  ];
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

    return { wch: Math.min(Math.max(max + 2, 12), 42) };
  });
}

function buildInventoryPrintHtml({
  rows,
  summary,
  companyAnalytics,
  filtersText,
  reportDate,
}) {
  const statusCards = STATUS_OPTIONS.map((status) => {
    const count = rows.filter((item) => item.status === status.value).length;

    return `
      <div class="miniCard">
        <span>${status.label}</span>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");

  const companyRows = companyAnalytics
    .slice(0, 8)
    .map(
      (company) => `
        <tr>
          <td>${company.name}</td>
          <td>${company.total}</td>
          <td>${company.assigned}</td>
          <td>${company.inStock}</td>
          <td>${company.risky}</td>
        </tr>
      `
    )
    .join("");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            <b>${item.inventory_code || "-"}</b>
            <small>${item.name || "-"}</small>
          </td>
          <td>${item.company?.name || "-"}</td>
          <td>${item.department?.name || "-"}</td>
         <td>
  ${item.category?.name || "-"}
  <small>${item.subcategory?.name || ""}</small>
</td>
<td>
  ${item.responsible?.full_name || item.responsible_external_name || "-"}
  ${
    isImportedItem(item)
      ? `<small style="color:#047857;font-weight:900;">Excel import</small>`
      : ""
  }
</td>
          <td>${getStatusLabel(item.status)}</td>
          <td>
            <b>${item.computed_health_score ?? "-"}</b>
            <small>${getHealthLabel(item.computed_health_status)}</small>
          </td>
          <td>${item.warranty_info?.label || "-"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Inventory Report</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 28px;
            font-family: Inter, Arial, sans-serif;
            color: #0f172a;
            background: #f8fafc;
          }
          .report {
            max-width: 1180px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
          }
          .hero {
            padding: 30px;
            color: #ffffff;
            background:
              radial-gradient(circle at 90% 0%, rgba(34, 211, 238, 0.32), transparent 28%),
              linear-gradient(135deg, #07111f, #0f172a 55%, #1d4ed8);
            display: flex;
            justify-content: space-between;
            gap: 22px;
            align-items: flex-start;
          }
          .hero span {
            display: inline-flex;
            margin-bottom: 10px;
            color: #93c5fd;
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
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.6;
            max-width: 680px;
          }
          .logo {
            width: 64px;
            height: 64px;
            min-width: 64px;
            border-radius: 22px;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #2563eb, #06b6d4);
            font-weight: 950;
            font-size: 19px;
            box-shadow: 0 20px 55px rgba(37, 99, 235, 0.35);
          }
          .meta {
            padding: 18px 30px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
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
          .card,
          .miniCard {
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 16px;
            background: #ffffff;
          }
          .card span,
          .miniCard span {
            display: block;
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .card strong,
          .miniCard strong {
            display: block;
            margin-top: 8px;
            color: #0f172a;
            font-size: 28px;
            letter-spacing: -0.05em;
          }
          .section { padding: 0 30px 24px; }
          .section h2 {
            margin: 0 0 12px;
            color: #0f172a;
            font-size: 19px;
            letter-spacing: -0.04em;
          }
          .miniGrid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
          }
          .miniCard {
            padding: 13px;
            border-radius: 16px;
            background: #f8fafc;
          }
          .miniCard strong { font-size: 22px; }
          table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 18px;
          }
          th {
            background: #0f172a;
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
            .miniCard,
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
              <h1>İnventar hesabatı</h1>
              <p>
                Bu hesabat hazırda seçilmiş filterlərə uyğun inventarların
                status, health score, zəmanət və şirkət bölgüsünü göstərir.
              </p>
            </div>
            <div class="logo">CI</div>
          </section>
          <section class="meta">
            <div>Hazırlanma tarixi: ${reportDate}</div>
            <div>${filtersText}</div>
          </section>
          <section class="cards">
            <div class="card"><span>Göstərilən</span><strong>${summary.shown}</strong></div>
            <div class="card"><span>Ümumi</span><strong>${summary.total}</strong></div>
            <div class="card"><span>Təhkim</span><strong>${summary.assigned}</strong></div>
            <div class="card"><span>Riskli</span><strong>${summary.risky}</strong></div>
            <div class="card"><span>Zəmanəti bitən</span><strong>${summary.expiredWarranty}</strong></div>
          </section>
          <section class="section">
            <h2>Status bölgüsü</h2>
            <div class="miniGrid">${statusCards}</div>
          </section>
          <section class="section">
            <h2>Şirkət analizi</h2>
            <table>
              <thead>
                <tr>
                  <th>Şirkət</th>
                  <th>Ümumi</th>
                  <th>Təhkim</th>
                  <th>Anbarda</th>
                  <th>Riskli</th>
                </tr>
              </thead>
              <tbody>
                ${companyRows ||
    `<tr><td colspan="5">Şirkət analizi üçün məlumat yoxdur.</td></tr>`
    }
              </tbody>
            </table>
          </section>
          <section class="section">
            <h2>İnventar siyahısı</h2>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>İnventar</th>
                  <th>Şirkət</th>
                  <th>Departament</th>
                  <th>Kateqoriya</th>
                  <th>Məsul şəxs</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Zəmanət</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows ||
    `<tr><td colspan="9">Hesabat üçün inventar yoxdur.</td></tr>`
    }
              </tbody>
            </table>
          </section>
          <section class="footer">
            © Cahan Holding · Inventory Management System
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

export default function InventoryPageClient() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedHealths, setSelectedHealths] = useState([]);
 const [selectedCompanies, setSelectedCompanies] = useState([]);
const [selectedCategories, setSelectedCategories] = useState([]);
const [selectedSubcategories, setSelectedSubcategories] = useState([]);
const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [viewVisible, setViewVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [qrItem, setQrItem] = useState(null);
  const [qrVisible, setQrVisible] = useState(false);

  const [expandedCompanyId, setExpandedCompanyId] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [qrGeneratingId, setQrGeneratingId] = useState(null);

  const [optionCompanies, setOptionCompanies] = useState([]);
  const [optionDepartments, setOptionDepartments] = useState([]);
  const [optionCategories, setOptionCategories] = useState([]);
  const [optionProfiles, setOptionProfiles] = useState([]);

  const currentRole = resolveProfileRole(me);
  const currentCompanyId = me?.company_id || me?.companies?.id || "";

  const allowViewInventory = canViewInventory(currentRole);
  const allowCreateInventory = canCreateInventory(currentRole);
  const allowEditInventory = canEditInventory(currentRole);
  const allowDeleteInventory = canDeleteInventory(currentRole);
  const allowReports = canViewReports(currentRole);
  const allowImportInventory = canImportInventory(currentRole);
  const allowQr = canManageQr(currentRole);

  useEffect(() => {
    setMounted(true);
    loadInitialData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedStatuses,
    selectedHealths,
    selectedCompanies,
    selectedCategories,
    selectedSubcategories,
    createdFrom,
    createdTo,
    pageSize,
  ]);

  useEffect(() => {
    if (!createOpen) return;

    const timer = window.setTimeout(() => {
      setCreateVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [createOpen]);

  useEffect(() => {
    if (!importOpen) return;

    const timer = window.setTimeout(() => {
      setImportVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [importOpen]);

  useEffect(() => {
    if (!viewItem) return;

    const timer = window.setTimeout(() => {
      setViewVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [viewItem]);

  useEffect(() => {
    if (!editItem) return;

    const timer = window.setTimeout(() => {
      setEditVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [editItem]);

  useEffect(() => {
    if (!qrItem) return;

    const timer = window.setTimeout(() => {
      setQrVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [qrItem]);

  useEffect(() => {
    if (!deleteItem) return;

    const timer = window.setTimeout(() => {
      setDeleteVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [deleteItem]);

  async function loadInitialData() {
    setLoading(true);

    const profile = await loadMe();

    await Promise.all([loadItems(profile), loadOptions(profile)]);

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
    user_role,
    role_id,
    access_scope,
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
      console.error("CURRENT PROFILE LOAD ERROR:", profileError);
    }

    if (!profile) {
      setMe(null);
      return null;
    }

    let finalProfile = { ...profile };
    let resolvedRole = resolveProfileRole(finalProfile);

    if (finalProfile.user_role && !finalProfile.roles) {
      const { data: roleRow, error: roleError } = await supabase
        .from("roles")
        .select("id,name,label")
        .eq("name", normalizeRole(finalProfile.user_role))
        .maybeSingle();

      if (!roleError && roleRow) {
        finalProfile = {
          ...finalProfile,
          role_id: roleRow.id,
          roles: roleRow,
        };

        resolvedRole = normalizeRole(roleRow.name);
      } else if (roleError) {
        console.warn("INVENTORY ROLE READ WARNING:", {
          message: roleError.message,
          details: roleError.details,
          hint: roleError.hint,
          code: roleError.code,
        });
      }
    }

    finalProfile = {
      ...finalProfile,
      resolved_role: resolvedRole,
      resolved_role_label: finalProfile?.roles?.label || resolvedRole,
    };

    setMe(finalProfile);
    return finalProfile;
  }

  async function loadItems(profileArg = me) {
  const role = resolveProfileRole(profileArg);
  const companyId = profileArg?.company_id || profileArg?.companies?.id || "";

  if (!canViewInventory(role)) {
    setItems([]);
    return;
  }

  let query = supabase
    .from("inventory_items")
    .select(
      `
      id,
      inventory_code,
      name,
      description,
      responsible_external_name,
      responsible_external_email,
      import_source,
      imported_at,
      subcategory_id,
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
      images,
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
        name,
        parent_id
      ),
      responsible:profiles!inventory_items_responsible_user_id_fkey (
        id,
        full_name,
        email
      )
    `
    )
    .order("created_at", { ascending: false });

  if (isRehber(role) && companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("INVENTORY LOAD ERROR FULL:", JSON.stringify(error, null, 2));
    console.error("INVENTORY LOAD ERROR MESSAGE:", error.message);
    console.error("INVENTORY LOAD ERROR DETAILS:", error.details);
    console.error("INVENTORY LOAD ERROR HINT:", error.hint);
    setItems([]);
    return;
  }

  const subcategoryIds = Array.from(
    new Set((data || []).map((item) => item.subcategory_id).filter(Boolean))
  );

  let subcategoryMap = new Map();

  if (subcategoryIds.length > 0) {
    const { data: subcategories, error: subcategoryError } = await supabase
      .from("inventory_categories")
      .select("id,name,parent_id,status")
      .in("id", subcategoryIds);

    if (subcategoryError) {
      console.error("SUBCATEGORY LOAD ERROR:", subcategoryError);
    } else {
      subcategoryMap = new Map(
        (subcategories || []).map((category) => [String(category.id), category])
      );
    }
  }

  const enrichedItems = (data || []).map((item) =>
    enrichItem({
      ...item,
      subcategory: item.subcategory_id
        ? subcategoryMap.get(String(item.subcategory_id)) || null
        : null,
    })
  );

  setItems(enrichedItems);
}

  async function loadOptions(profileArg = me) {
    const role = resolveProfileRole(profileArg);
    const companyId = profileArg?.company_id || profileArg?.companies?.id || "";

    const companiesQuery = supabase
      .from("companies")
      .select("id,name,status")
      .eq("status", "ACTIVE")
      .order("name");

    const departmentsQuery = supabase
      .from("departments")
      .select("id,name,company_id,status")
      .eq("status", "ACTIVE")
      .order("name");

    const profilesQuery = supabase
      .from("profiles")
      .select("id,full_name,email,company_id,status")
      .eq("status", "ACTIVE")
      .order("full_name");

    if (isRehber(role) && companyId) {
      companiesQuery.eq("id", companyId);
      departmentsQuery.eq("company_id", companyId);
      profilesQuery.eq("company_id", companyId);
    }

    const [companiesRes, departmentsRes, categoriesRes, profilesRes] =
      await Promise.all([
        companiesQuery,
        departmentsQuery,
        supabase
        .from("inventory_categories")
.select("id,name,status,parent_id")
.eq("status", "ACTIVE")
.order("name"),
        profilesQuery,
      ]);

    if (companiesRes.error) console.error("companies error", companiesRes.error);
    if (departmentsRes.error)
      console.error("departments error", departmentsRes.error);
    if (categoriesRes.error)
      console.error("categories error", categoriesRes.error);
    if (profilesRes.error) console.error("profiles error", profilesRes.error);

    setOptionCompanies(companiesRes.data || []);
    setOptionDepartments(departmentsRes.data || []);
    setOptionCategories(categoriesRes.data || []);
    setOptionProfiles(profilesRes.data || []);
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
    .sort((a, b) => a.name.localeCompare(b.name, "az"));
}, [items]);

const subcategoryOptions = useMemo(() => {
  const map = new Map();

  items.forEach((item) => {
    if (item.subcategory?.id) {
      map.set(String(item.subcategory.id), item.subcategory.name);
    }
  });

  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "az"));
}, [items]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);

    return items.filter((item) => {
      const text = [
        item.inventory_code,
        item.name,
        item.description,
        item.serial_number,
        item.model,
        item.brand,
        item.company?.name,
        item.department?.name,
        item.category?.name,
        item.subcategory?.name,
        item.responsible?.full_name,
        item.responsible?.email,
        item.current_location,
        getStatusLabel(item.status),
        getHealthLabel(item.computed_health_status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(item.status);

      const matchesHealth =
        selectedHealths.length === 0 ||
        selectedHealths.includes(item.computed_health_status);

      const matchesCompany =
        selectedCompanies.length === 0 ||
        selectedCompanies.includes(String(item.company?.id || ""));

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(String(item.category?.id || ""));

      const matchesSubcategory =
  selectedSubcategories.length === 0 ||
  selectedSubcategories.includes(String(item.subcategory?.id || ""));

      const matchesCreatedDate =
        (!createdFrom && !createdTo) ||
        isDateInRange(item.created_at, createdFrom, createdTo);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesHealth &&
        matchesCompany &&
        matchesCategory &&
        matchesSubcategory &&
        matchesCreatedDate
      );
    });
  }, [
    items,
    search,
    selectedStatuses,
    selectedHealths,
    selectedCompanies,
    selectedCategories,
    selectedSubcategories,
    createdFrom,
    createdTo,
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

      if (sortBy === "department") {
        aValue = a.department?.name || "";
        bValue = b.department?.name || "";
      }

      if (sortBy === "category") {
        aValue = a.category?.name || "";
        bValue = b.category?.name || "";
      }

      if (sortBy === "subcategory") {
  aValue = a.subcategory?.name || "";
  bValue = b.subcategory?.name || "";
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

      if (sortBy === "images") {
        aValue = getImageCount(a);
        bValue = getImageCount(b);
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
    const assigned = items.filter((x) => x.status === "ASSIGNED").length;
    const inStock = items.filter((x) => x.status === "IN_STOCK").length;
    const repair = items.filter((x) => x.status === "IN_REPAIR").length;
    const risky = items.filter((x) =>
      ["RISKY", "CRITICAL"].includes(x.computed_health_status)
    ).length;
    const expiredWarranty = items.filter(
      (x) => x.warranty_info?.state === "EXPIRED"
    ).length;

    return {
      shown: filteredItems.length,
      total: items.length,
      assigned,
      inStock,
      repair,
      risky,
      expiredWarranty,
      assignedPercent: items.length
        ? Math.round((assigned / items.length) * 100)
        : 0,
      inStockPercent: items.length
        ? Math.round((inStock / items.length) * 100)
        : 0,
      riskyPercent: items.length
        ? Math.round((risky / items.length) * 100)
        : 0,
    };
  }, [items, filteredItems]);

  const companyAnalytics = useMemo(() => {
    const map = new Map();

    items.forEach((item) => {
      const companyId = String(item.company?.id || "NO_COMPANY");
      const companyName =
        companyId === "NO_COMPANY"
          ? "Şirkət seçilməyib"
          : item.company?.name || "Naməlum şirkət";

      if (!map.has(companyId)) {
        map.set(companyId, {
          id: companyId,
          name: companyName,
          total: 0,
          assigned: 0,
          inStock: 0,
          risky: 0,
          departments: new Map(),
          categories: new Map(),
        });
      }

      const company = map.get(companyId);
      company.total += 1;

      if (item.status === "ASSIGNED") company.assigned += 1;
      if (item.status === "IN_STOCK") company.inStock += 1;
      if (["RISKY", "CRITICAL"].includes(item.computed_health_status)) {
        company.risky += 1;
      }

      const departmentName = item.department?.name || "Departament seçilməyib";
      const categoryName = item.subcategory?.name
  ? `${item.category?.name || "Kateqoriya seçilməyib"} / ${item.subcategory.name}`
  : item.category?.name || "Kateqoriya seçilməyib";

      if (!company.departments.has(departmentName)) {
        company.departments.set(departmentName, {
          name: departmentName,
          total: 0,
          assigned: 0,
          risky: 0,
        });
      }

      const dept = company.departments.get(departmentName);
      dept.total += 1;
      if (item.status === "ASSIGNED") dept.assigned += 1;
      if (["RISKY", "CRITICAL"].includes(item.computed_health_status)) {
        dept.risky += 1;
      }

      if (!company.categories.has(categoryName)) {
        company.categories.set(categoryName, {
          name: categoryName,
          total: 0,
        });
      }

      company.categories.get(categoryName).total += 1;
    });

    return Array.from(map.values())
      .map((company) => ({
        ...company,
        departments: Array.from(company.departments.values()).sort(
          (a, b) => b.total - a.total
        ),
        categories: Array.from(company.categories.values()).sort(
          (a, b) => b.total - a.total
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const expandedCompany = useMemo(() => {
    if (!expandedCompanyId) return companyAnalytics[0] || null;

    return (
      companyAnalytics.find((company) => company.id === expandedCompanyId) ||
      companyAnalytics[0] ||
      null
    );
  }, [companyAnalytics, expandedCompanyId]);

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
    setSelectedStatuses([]);
    setSelectedHealths([]);
    setSelectedCompanies([]);
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  function getActiveFilterCount() {
    let count = 0;

    if (search.trim()) count += 1;
    if (selectedStatuses.length) count += 1;
    if (selectedHealths.length) count += 1;
    if (selectedCompanies.length) count += 1;
    if (selectedCategories.length) count += 1;
    if (selectedSubcategories.length) count += 1;
    if (createdFrom || createdTo) count += 1;

    return count;
  }

  function getSelectedNames(options, selectedIds) {
    return options
      .filter((item) => selectedIds.includes(String(item.id)))
      .map((item) => item.name);
  }

  function renderFilterSummary() {
    const parts = [];

    if (selectedStatuses.length) {
      parts.push(`${selectedStatuses.length} status`);
    }

    if (selectedHealths.length) {
      parts.push(`${selectedHealths.length} health`);
    }

    if (selectedCompanies.length) {
      parts.push(`${selectedCompanies.length} şirkət`);
    }

    if (selectedCategories.length) {
      parts.push(`${selectedCategories.length} kateqoriya`);
    }

    if (selectedSubcategories.length) {
  parts.push(`${selectedSubcategories.length} alt kateqoriya`);
}

    if (createdFrom || createdTo) {
      parts.push("tarix aralığı");
    }

    if (!parts.length) {
      return "Filter seçilməyib";
    }

    return parts.join(" · ");
  }

  function openCreateModal() {
    if (!allowCreateInventory) {
      alert("Bu əməliyyat üçün icazəniz yoxdur.");
      return;
    }

    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateVisible(false);

    window.setTimeout(() => {
      setCreateOpen(false);
    }, 220);
  }

  function openImportModal() {
    if (!allowImportInventory) {
      alert("Import üçün icazəniz yoxdur.");
      return;
    }

    setImportOpen(true);
  }

  function closeImportModal() {
    setImportVisible(false);

    window.setTimeout(() => {
      setImportOpen(false);
    }, 220);
  }

  async function handleImportDone() {
  await Promise.all([loadItems(me), loadOptions(me)]);
  closeImportModal();
}

  function openViewModal(item) {
    setViewItem(item);
  }

  function closeViewModal() {
    setViewVisible(false);

    window.setTimeout(() => {
      setViewItem(null);
    }, 220);
  }

  function openEditModal(item) {
    if (!allowEditInventory) {
      alert("Bu əməliyyat üçün icazəniz yoxdur.");
      return;
    }

    setEditItem(item);
  }

  function closeEditModal() {
    setEditVisible(false);

    window.setTimeout(() => {
      setEditItem(null);
    }, 220);
  }

  function openQrModal(item) {
    setQrItem(item);
  }

  function closeQrModal() {
    setQrVisible(false);

    window.setTimeout(() => {
      setQrItem(null);
    }, 220);
  }

  function openDeleteModal(item) {
    if (!allowDeleteInventory) {
      alert("Bu əməliyyat üçün icazəniz yoxdur.");
      return;
    }

    setDeleteItem(item);
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeleteVisible(false);

    window.setTimeout(() => {
      setDeleteItem(null);
    }, 220);
  }

  function handleEditFromView(item) {
    openEditModal(item);
  }

  function handleAskDelete(item) {
    openDeleteModal(item);
  }

  async function handleDeleteConfirm() {
    if (!allowDeleteInventory) {
      alert("Bu əməliyyat üçün icazəniz yoxdur.");
      return;
    }

    if (!deleteItem?.id) return;

    setDeleting(true);

    const imagePaths = Array.isArray(deleteItem.images)
      ? deleteItem.images.map((image) => image?.path).filter(Boolean)
      : [];

    if (imagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("inventory-images")
        .remove(imagePaths);

      if (storageError) {
        console.error("INVENTORY IMAGE DELETE ERROR:", storageError);
      }
    }

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", deleteItem.id);

    if (error) {
      console.error("INVENTORY DELETE ERROR:", error);
      alert(error.message || "İnventar silinərkən xəta baş verdi.");
      setDeleting(false);
      return;
    }

    setDeleting(false);
    closeDeleteModal();
    setViewItem(null);
    setEditItem(null);
    setQrItem(null);
    await loadItems(me);
  }

  async function handleEditSaved() {
    await loadItems(me);
    closeViewModal();
    closeEditModal();
  }

  async function handleCreated() {
  await Promise.all([loadItems(me), loadOptions(me)]);
  closeCreateModal();
}

  async function handleQrClick(item) {
    if (!item?.id) return;

    if (item.qr_token) {
      openQrModal(item);
      return;
    }

    if (!allowQr) {
      alert("QR yaratmaq üçün icazəniz yoxdur.");
      return;
    }

    setQrGeneratingId(item.id);

    const token = makeQrToken();

    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        qr_token: token,
      })
      .eq("id", item.id)
      .select(
        `
        id,
        inventory_code,
        name,
        description,
        responsible_external_name,
        responsible_external_email,
        import_source,
        imported_at,
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
        images,
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
  name,
  parent_id
),

responsible:profiles!inventory_items_responsible_user_id_fkey (
          id,
          full_name,
          email
        )
      `
      )
      .single();

    if (error) {
      console.error("QR CREATE ERROR:", error);
      alert(error.message || "QR yaradılarkən xəta baş verdi.");
      setQrGeneratingId(null);
      return;
    }

    let subcategory = null;

if (data?.subcategory_id) {
  const { data: subcategoryRow, error: subcategoryError } = await supabase
    .from("inventory_categories")
    .select("id,name,parent_id,status")
    .eq("id", data.subcategory_id)
    .maybeSingle();

  if (subcategoryError) {
    console.error("QR SUBCATEGORY LOAD ERROR:", subcategoryError);
  }

  subcategory = subcategoryRow || null;
}

const enriched = enrichItem({
  ...data,
  subcategory,
});

    setItems((prev) => prev.map((x) => (x.id === enriched.id ? enriched : x)));
    setViewItem((prev) => (prev?.id === enriched.id ? enriched : prev));
    openQrModal(enriched);
    setQrGeneratingId(null);
  }

  function getActiveFiltersText() {
    const parts = [];

    if (search.trim()) parts.push(`Axtarış: "${search.trim()}"`);

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

    if (selectedSubcategories.length) {
  const names = subcategoryOptions
    .filter((x) => selectedSubcategories.includes(String(x.id)))
    .map((x) => x.name);

  parts.push(`Alt kateqoriya: ${names.join(", ")}`);
}

    if (createdFrom || createdTo) {
      parts.push(
        `Tarix: ${formatInputDate(createdFrom) || "..."} - ${formatInputDate(createdTo) || "..."
        }`
      );
    }

    return parts.length ? parts.join(" · ") : "Filter yoxdur";
  }

  function exportInventoryExcel() {
    if (!allowReports) {
      alert("Report üçün icazəniz yoxdur.");
      return;
    }

    const reportRows = makeInventoryReportRows(sortedItems);
    const summaryRows = makeInventorySummaryRows(summary, sortedItems);

    const companyRows = companyAnalytics.map((company) => ({
      Şirkət: company.name,
      Ümumi: company.total,
      "Təhkim olunub": company.assigned,
      Anbarda: company.inStock,
      "Riskli health": company.risky,
      Departamentlər: company.departments
        .map((dept) => `${dept.name}: ${dept.total}`)
        .join("; "),
      Kateqoriyalar: company.categories
        .map((category) => `${category.name}: ${category.total}`)
        .join("; "),
    }));

    const workbook = XLSX.utils.book_new();

    const metaRows = [
      ["Cahan Holding Inventory Report"],
      ["Hazırlanma tarixi", getReportDateTime()],
      ["Filterlər", getActiveFiltersText()],
      ["Göstərilən inventar", summary.shown],
      ["Bütün inventar", summary.total],
    ];

    const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
    metaSheet["!cols"] = [{ wch: 28 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(workbook, metaSheet, "Report info");

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    autoSizeWorksheetColumns(summarySheet, summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const companySheet = XLSX.utils.json_to_sheet(companyRows);
    autoSizeWorksheetColumns(companySheet, companyRows);
    XLSX.utils.book_append_sheet(workbook, companySheet, "Company analysis");

    const dataSheet = XLSX.utils.json_to_sheet(reportRows);
    autoSizeWorksheetColumns(dataSheet, reportRows);
    XLSX.utils.book_append_sheet(
      workbook,
      dataSheet,
      sanitizeSheetName("Inventory full")
    );

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `inventory-report-${date}.xlsx`);
  }

  function printInventoryReport() {
    if (!allowReports) {
      alert("Print üçün icazəniz yoxdur.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
      alert("Print pəncərəsi bloklandı. Brauzer popup icazəsini yoxla.");
      return;
    }

    const html = buildInventoryPrintHtml({
      rows: sortedItems,
      summary,
      companyAnalytics,
      filtersText: getActiveFiltersText(),
      reportDate: getReportDateTime(),
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (!loading && !allowViewInventory) {
    return (
      <div className="inventory-page">
        <section className="inventory-hero inventory-hero-modern">
          <div>
            <h1>İcazə yoxdur</h1>
            <p>
              Bu səhifəyə baxmaq üçün rol icazəniz yoxdur. İnventar idarəetməsi
              yalnız ADMIN, REHBER, IZLEYICI, VIEWER və AUDIT rolları üçündür.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <section className="inventory-hero inventory-hero-modern">
        <div>
          <h1>İnventarlar</h1>
          <p>
            Bütün əsas vəsaitləri, təhkimləri, health score və zəmanət
            vəziyyətini bir paneldən idarə edin.
          </p>
        </div>

        <div className="inventory-hero-actions">
          {allowReports && (
            <>
              <button
                type="button"
                className="inventory-report-btn excel"
                onClick={exportInventoryExcel}
                disabled={loading || sortedItems.length === 0}
              >
                Excel report
              </button>

              <button
                type="button"
                className="inventory-report-btn print"
                onClick={printInventoryReport}
                disabled={loading || sortedItems.length === 0}
              >
                Print report
              </button>
            </>
          )}

          {allowImportInventory && (
            <>
              <button
                type="button"
                className="inventory-report-btn template"
                onClick={downloadInventoryImportTemplate}
                disabled={loading}
              >
                Şablon yüklə
              </button>

              <button
                type="button"
                className="inventory-report-btn import"
                onClick={openImportModal}
                disabled={loading}
              >
                Import
              </button>
            </>
          )}

          {allowCreateInventory && (
            <button
              type="button"
              className="inventory-primary-btn"
              onClick={openCreateModal}
            >
              + Yeni inventar
            </button>
          )}
        </div>
      </section>

      <section className="inventory-top-grid">
        <section className="inventory-filter-card inventory-filter-card-minimal">
          <div className="inventory-filter-minimal-top">
            <div className="inventory-search-shell">
              <span className="inventory-search-icon">⌕</span>

              <input
                placeholder="Kod, ad, model, seriya, şirkət, departament və məsul şəxs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {search.trim() && (
                <button
                  type="button"
                  className="inventory-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Axtarışı təmizlə"
                >
                  ×
                </button>
              )}
            </div>

            <div className="inventory-filter-actions">
              <button
                type="button"
                className={`inventory-filter-toggle ${filtersOpen ? "active" : ""}`}
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                <span>Filter aç/bağla</span>
                {getActiveFilterCount() > 0 && <b>{getActiveFilterCount()}</b>}
              </button>

              <button
                type="button"
                className="inventory-soft-btn"
                onClick={() => loadItems(me)}
              >
                Yenilə
              </button>

              <button
                type="button"
                className="inventory-ghost-btn"
                onClick={resetFilters}
                disabled={getActiveFilterCount() === 0}
              >
                Sıfırla
              </button>
            </div>
          </div>

          <div className="inventory-filter-summary-line">
            <span>{summary.shown} nəticə</span>
            <em>{renderFilterSummary()}</em>
          </div>

          {filtersOpen && (
            <div className="inventory-filter-panel">
              <div className="inventory-filter-panel-grid">
                <MinimalFilterBlock
                  title="Status"
                  subtitle={
                    selectedStatuses.length
                      ? selectedStatuses.map((x) => getStatusLabel(x)).join(", ")
                      : "Hamısı"
                  }
                >
                  <div className="inventory-compact-chip-row">
                    {STATUS_OPTIONS.map((item) => {
                      const selected = selectedStatuses.includes(item.value);

                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={`inventory-compact-chip ${selected ? "active" : ""}`}
                          onClick={() =>
                            toggleMultiValue(setSelectedStatuses, item.value)
                          }
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </MinimalFilterBlock>

                <MinimalFilterBlock
                  title="Health"
                  subtitle={
                    selectedHealths.length
                      ? selectedHealths.map((x) => getHealthLabel(x)).join(", ")
                      : "Hamısı"
                  }
                >
                  <div className="inventory-compact-chip-row">
                    {HEALTH_OPTIONS.map((item) => {
                      const selected = selectedHealths.includes(item.value);

                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={`inventory-compact-chip ${selected ? "active" : ""}`}
                          onClick={() =>
                            toggleMultiValue(setSelectedHealths, item.value)
                          }
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </MinimalFilterBlock>

                <MinimalFilterBlock
                  title="Şirkət"
                  subtitle={
                    selectedCompanies.length
                      ? getSelectedNames(companyOptions, selectedCompanies).join(", ")
                      : "Hamısı"
                  }
                >
                  <div className="inventory-compact-chip-row scroll">
                    {companyOptions.length === 0 ? (
                      <span className="inventory-filter-muted">Şirkət yoxdur</span>
                    ) : (
                      companyOptions.map((item) => {
                        const id = String(item.id);
                        const selected = selectedCompanies.includes(id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`inventory-compact-chip ${selected ? "active" : ""
                              }`}
                            onClick={() =>
                              toggleMultiValue(setSelectedCompanies, id)
                            }
                          >
                            {item.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </MinimalFilterBlock>

                <MinimalFilterBlock
                  title="Kateqoriya"
                  subtitle={
                    selectedCategories.length
                      ? getSelectedNames(categoryOptions, selectedCategories).join(", ")
                      : "Hamısı"
                  }
                >
                  <div className="inventory-compact-chip-row scroll">
                    {categoryOptions.length === 0 ? (
                      <span className="inventory-filter-muted">
                        Kateqoriya yoxdur
                      </span>
                    ) : (
                      categoryOptions.map((item) => {
                        const id = String(item.id);
                        const selected = selectedCategories.includes(id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`inventory-compact-chip ${selected ? "active" : ""
                              }`}
                            onClick={() =>
                              toggleMultiValue(setSelectedCategories, id)
                            }
                          >
                            {item.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </MinimalFilterBlock>

                <MinimalFilterBlock
  title="Alt kateqoriya"
  subtitle={
    selectedSubcategories.length
      ? getSelectedNames(subcategoryOptions, selectedSubcategories).join(", ")
      : "Hamısı"
  }
>
  <div className="inventory-compact-chip-row scroll">
    {subcategoryOptions.length === 0 ? (
      <span className="inventory-filter-muted">
        Alt kateqoriya yoxdur
      </span>
    ) : (
      subcategoryOptions.map((item) => {
        const id = String(item.id);
        const selected = selectedSubcategories.includes(id);

        return (
          <button
            key={item.id}
            type="button"
            className={`inventory-compact-chip ${selected ? "active" : ""}`}
            onClick={() =>
              toggleMultiValue(setSelectedSubcategories, id)
            }
          >
            {item.name}
          </button>
        );
      })
    )}
  </div>
</MinimalFilterBlock>

                <MinimalFilterBlock
                  title="Yaradılma tarixi"
                  subtitle={
                    createdFrom || createdTo
                      ? `${formatInputDate(createdFrom) || "..."} - ${formatInputDate(createdTo) || "..."
                      }`
                      : "Tarix seçilməyib"
                  }
                  wide
                >
                  <div className="inventory-minimal-date-row">
                    <label>
                      <span>Başlanğıc</span>
                      <input
                        type="date"
                        value={createdFrom}
                        onChange={(e) => setCreatedFrom(e.target.value)}
                      />
                    </label>

                    <label>
                      <span>Son</span>
                      <input
                        type="date"
                        value={createdTo}
                        onChange={(e) => setCreatedTo(e.target.value)}
                      />
                    </label>
                  </div>
                </MinimalFilterBlock>
              </div>
            </div>
          )}
        </section>

        <div className="inventory-chart-card">
          <div className="inventory-chart-head">
            <h3>İnventar status paylanması</h3>
          </div>

          <div
            className="inventory-donut"
            style={{
              "--assigned": `${summary.assignedPercent * 3.6}deg`,
              "--stock": `${summary.inStockPercent * 3.6}deg`,
            }}
          >
            <div className="inventory-donut-inner">
              <strong>{summary.assignedPercent}%</strong>
              <span>Təhkim</span>
            </div>
          </div>

          <div className="inventory-chart-bars">
            <div>
              <div className="inventory-bar-label">
                <span>Təhkim olunub</span>
                <strong>{summary.assigned}</strong>
              </div>

              <div className="inventory-bar-track">
                <span
                  className="inventory-bar-fill assigned"
                  style={{ width: `${summary.assignedPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="inventory-bar-label">
                <span>Anbarda</span>
                <strong>{summary.inStock}</strong>
              </div>

              <div className="inventory-bar-track">
                <span
                  className="inventory-bar-fill stock"
                  style={{ width: `${summary.inStockPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="inventory-bar-label">
                <span>Riskli health</span>
                <strong>{summary.risky}</strong>
              </div>

              <div className="inventory-bar-track">
                <span
                  className="inventory-bar-fill risky"
                  style={{ width: `${summary.riskyPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="inventory-floating-stats">
            <div>
              <span>Təmirdə</span>
              <strong>{summary.repair}</strong>
            </div>

            <div>
              <span>Zəmanəti bitən</span>
              <strong>{summary.expiredWarranty}</strong>
            </div>
          </div>
        </div>

        <div className="inventory-company-chart-card">
          <div className="inventory-chart-head">
            <h3>Şirkət və departament analizi</h3>
          </div>

          <div className="inventory-company-bars">
            {companyAnalytics.length === 0 ? (
              <div className="inventory-company-empty">
                Analiz üçün inventar yoxdur.
              </div>
            ) : (
              companyAnalytics.map((company) => {
                const percent = summary.total
                  ? Math.round((company.total / summary.total) * 100)
                  : 0;

                const active = expandedCompany?.id === company.id;

                return (
                  <button
                    key={company.id}
                    type="button"
                    className={`inventory-company-bar-btn ${active ? "active" : ""
                      }`}
                    onClick={() => setExpandedCompanyId(company.id)}
                  >
                    <div className="inventory-company-bar-top">
                      <span>{company.name}</span>
                      <strong>{company.total}</strong>
                    </div>

                    <div className="inventory-company-track">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {expandedCompany && (
            <div className="inventory-company-details">
              <div className="inventory-company-details-head">
                <div>
                  <span>Detallı görünüş</span>
                  <strong>{expandedCompany.name}</strong>
                </div>

                <b>{expandedCompany.total}</b>
              </div>

              <div className="inventory-department-list">
                {expandedCompany.departments.map((dept) => (
                  <div key={dept.name} className="inventory-department-row">
                    <div>
                      <strong>{dept.name}</strong>
                      <span>
                        Təhkim: {dept.assigned || 0} · Riskli:{" "}
                        {dept.risky || 0}
                      </span>
                    </div>

                    <b>{dept.total}</b>
                  </div>
                ))}
              </div>

              <div className="inventory-category-mini-list">
                <span>Kateqoriya bölgüsü</span>

                {expandedCompany.categories.slice(0, 5).map((category) => (
                  <div key={category.name}>
                    <strong>{category.name}</strong>
                    <b>{category.total}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="inventory-summary inventory-summary-modern">
        <div>
          <span>Göstərilən</span>
          <strong>{loading ? "..." : summary.shown}</strong>
        </div>

        <div>
          <span>Ümumi</span>
          <strong>{loading ? "..." : summary.total}</strong>
        </div>

        <div>
          <span>Təhkim olunub</span>
          <strong>{loading ? "..." : summary.assigned}</strong>
        </div>

        <div>
          <span>Riskli health</span>
          <strong>{loading ? "..." : summary.risky}</strong>
        </div>

        <div>
          <span>Zəmanəti bitən</span>
          <strong>{loading ? "..." : summary.expiredWarranty}</strong>
        </div>
      </section>

      <section className="inventory-table-card">
        {loading ? (
          <div className="inventory-empty">İnventarlar yüklənir...</div>
        ) : filteredItems.length === 0 ? (
          <div className="inventory-empty">
            <strong>İnventar tapılmadı</strong>
            <p>
              Hazırda bu filterlərə uyğun inventar yoxdur. Yeni inventar əlavə
              etdikdən sonra burada görünəcək.
            </p>
          </div>
        ) : (
          <>
            <div className="inventory-table-wrap">
              <table className="inventory-table inventory-sort-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        onClick={() => toggleSort("inventory_code")}
                      >
                        Kod <span>{sortIcon("inventory_code")}</span>
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => toggleSort("inventory")}
                      >
                        İnventar <span>{sortIcon("inventory")}</span>
                      </button>
                    </th>

                    <th>
                      <button type="button" onClick={() => toggleSort("company")}>
                        Şirkət <span>{sortIcon("company")}</span>
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => toggleSort("department")}
                      >
                        Departament <span>{sortIcon("department")}</span>
                      </button>
                    </th>

             <th>
  <button type="button" onClick={() => toggleSort("category")}>
    Kateqoriya <span>{sortIcon("category")}</span>
  </button>
</th>

<th>
  <button type="button" onClick={() => toggleSort("subcategory")}>
    Alt kateqoriya <span>{sortIcon("subcategory")}</span>
  </button>
</th>


                    <th>
                      <button
                        type="button"
                        onClick={() => toggleSort("responsible")}
                      >
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

                    <th>
                      <button type="button" onClick={() => toggleSort("images")}>
                        Şəkil <span>{sortIcon("images")}</span>
                      </button>
                    </th>

                    <th>QR</th>
                    <th>Əməliyyatlar</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong className="inventory-code">
                          {item.inventory_code}
                        </strong>
                      </td>

                      <td>
  <div className="inventory-name-cell">
    <strong>{item.name}</strong>

    <span>
      {[item.brand, item.model, item.serial_number]
        .filter(Boolean)
        .join(" · ") || "-"}
    </span>

    {isImportedItem(item) && (
      <em className="inventory-import-badge">Excel import</em>
    )}
  </div>
</td>

                      <td>{item.company?.name || "-"}</td>
                      <td>{item.department?.name || "-"}</td>
                      <td>{item.category?.name || "-"}</td>
                      <td>{item.subcategory?.name || "-"}</td>
                      <td>{item.responsible?.full_name || item.responsible_external_name || "-"}</td>

                      <td>
                        <InventoryStatusPill status={item.status} />
                      </td>

                      <td>
                        <HealthScorePill
                          score={item.computed_health_score}
                          status={item.computed_health_status}
                        />
                      </td>

                      <td>
                        <div className="inventory-warranty">
                          <strong>{item.warranty_info?.label || "-"}</strong>
                          <span>{formatDate(item.warranty_end_date)}</span>
                        </div>
                      </td>

                      <td>
                        <span className="inventory-image-count">
                          {getImageCount(item)}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`inventory-qr-btn ${item.qr_token ? "ready" : ""
                            }`}
                          onClick={() => handleQrClick(item)}
                          disabled={
                            qrGeneratingId === item.id ||
                            (!allowQr && !item.qr_token)
                          }
                          title={
                            !allowQr && !item.qr_token
                              ? "QR yaratmaq üçün icazə yoxdur"
                              : undefined
                          }
                        >
                          {qrGeneratingId === item.id
                            ? "Yaradılır..."
                            : item.qr_token
                              ? "QR bax"
                              : "QR yarat"}
                        </button>
                      </td>

                      <td>
                        <div className="inventory-actions">
                          <button
                            type="button"
                            className="inventory-action-btn"
                            onClick={() => openViewModal(item)}
                          >
                            Bax
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inventory-mobile-list">
              {paginatedItems.map((item) => (
                <article className="inventory-mobile-card" key={item.id}>
                  <div className="inventory-mobile-top">
                    <div>
                      <span>{item.inventory_code}</span>
                      <h3>{item.name}</h3>
                      {isImportedItem(item) && (
  <em className="inventory-import-badge">Excel import</em>
)}
                    </div>

                    <InventoryStatusPill status={item.status} />
                  </div>

                  <p>
                    {[item.brand, item.model, item.serial_number]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </p>

                  <div className="inventory-mobile-grid">
                    <div>
                      <span>Şirkət</span>
                      <strong>{item.company?.name || "-"}</strong>
                    </div>

                    <div>
                      <span>Departament</span>
                      <strong>{item.department?.name || "-"}</strong>
                    </div>

                    <div>
                      <span>Kateqoriya</span>
                      <strong>{item.category?.name || "-"}</strong>
                    </div>

                    <div>
  <span>Alt kateqoriya</span>
  <strong>{item.subcategory?.name || "-"}</strong>
</div>

                    <div>
                      <span>Məsul şəxs</span>
                     <strong>
  {item.responsible?.full_name || item.responsible_external_name || "-"}
</strong>
                    </div>

                    <div>
                      <span>Zəmanət</span>
                      <strong>{item.warranty_info?.label || "-"}</strong>
                    </div>

                    <div>
                      <span>Şəkil</span>
                      <strong>{getImageCount(item)}</strong>
                    </div>

                    <div>
                      <span>QR</span>
                      <strong>{item.qr_token ? "QR hazır" : "Yoxdur"}</strong>
                    </div>
                  </div>

                  <HealthScorePill
                    score={item.computed_health_score}
                    status={item.computed_health_status}
                  />

                  <div className="inventory-mobile-actions">
                    <button
                      type="button"
                      className="inventory-action-btn"
                      onClick={() => openViewModal(item)}
                    >
                      Bax
                    </button>

                    <button
                      type="button"
                      className={`inventory-qr-btn ${item.qr_token ? "ready" : ""
                        }`}
                      onClick={() => handleQrClick(item)}
                      disabled={
                        qrGeneratingId === item.id ||
                        (!allowQr && !item.qr_token)
                      }
                      title={
                        !allowQr && !item.qr_token
                          ? "QR yaratmaq üçün icazə yoxdur"
                          : undefined
                      }
                    >
                      {qrGeneratingId === item.id
                        ? "Yaradılır..."
                        : item.qr_token
                          ? "QR bax"
                          : "QR yarat"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="inventory-pagination">
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

              <div className="inventory-page-buttons">
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

      <SmoothModalShell mounted={mounted} open={createOpen} visible={createVisible}>
        <InventoryCreateModal
          open={createOpen}
          onClose={closeCreateModal}
          onCreated={handleCreated}
        />
      </SmoothModalShell>

      <SmoothModalShell mounted={mounted} open={importOpen} visible={importVisible}>
        <InventoryImportModal
          open={importOpen}
          visible={importVisible}
          companies={optionCompanies}
          departments={optionDepartments}
          categories={optionCategories}
          profiles={optionProfiles}
          role={currentRole}
          currentCompanyId={currentCompanyId}
          canImport={allowImportInventory}
          onClose={closeImportModal}
          onImported={handleImportDone}
        />
      </SmoothModalShell>

      <InventoryViewModal
        mounted={mounted}
        visible={viewVisible}
        item={viewItem}
        qrGeneratingId={qrGeneratingId}
        canEdit={allowEditInventory}
        canDelete={allowDeleteInventory}
        canQr={allowQr}
        onClose={closeViewModal}
        onEdit={handleEditFromView}
        onDelete={handleAskDelete}
        onQr={handleQrClick}
      />

      <InventoryEditModal
        mounted={mounted}
        visible={editVisible}
        item={editItem}
        companies={optionCompanies}
        departments={optionDepartments}
        categories={optionCategories}
        profiles={optionProfiles}
        canEdit={allowEditInventory}
        role={currentRole}
        currentCompanyId={currentCompanyId}
        onClose={closeEditModal}
        onSaved={handleEditSaved}
      />

      <InventoryQrModal
        mounted={mounted}
        visible={qrVisible}
        item={qrItem}
        onClose={closeQrModal}
      />

      <InventoryDeleteConfirmModal
        mounted={mounted}
        visible={deleteVisible}
        item={deleteItem}
        deleting={deleting}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
      />

      <style jsx global>{`

       .inventory-report-btn.template {
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #e2e8f0;
}

.inventory-report-btn.import {
  background: #16a34a;
  color: #ffffff;
}

.inventory-import-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 18px;
}

.inventory-import-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(10px);
}

.inventory-import-modal {
  position: relative;
  width: min(1100px, 100%);
  max-height: min(92vh, 900px);
  overflow: hidden;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 30px 90px rgba(15, 23, 42, 0.24);
  display: flex;
  flex-direction: column;
}

.inventory-import-head {
  padding: 22px 24px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.inventory-import-head span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.inventory-import-head h2 {
  margin: 5px 0 6px;
  color: #0f172a;
  font-size: 24px;
  letter-spacing: -0.04em;
}

.inventory-import-head p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.inventory-import-head > button {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 14px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 22px;
  cursor: pointer;
}

.inventory-import-body {
  padding: 18px 24px;
  overflow: auto;
}

.inventory-import-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.inventory-import-actions > strong {
  color: #334155;
  font-size: 13px;
  font-weight: 900;
}

.inventory-import-file-btn {
  min-height: 42px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: #0f172a;
  color: #ffffff;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
}

.inventory-import-file-btn input {
  display: none;
}

.inventory-import-info {
  margin-top: 14px;
  padding: 13px 14px;
  border-radius: 16px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.5;
}

.inventory-import-errors {
  margin-top: 14px;
  padding: 13px 14px;
  border-radius: 16px;
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.inventory-import-errors strong {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.inventory-import-errors p {
  margin: 5px 0;
  font-size: 12px;
  font-weight: 800;
}

.inventory-import-preview {
  margin-top: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  overflow: hidden;
}

.inventory-import-preview-head {
  padding: 13px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.inventory-import-preview-head strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 950;
}

.inventory-import-preview-head span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

.inventory-import-table-wrap {
  overflow: auto;
  max-height: 360px;
}

.inventory-import-preview table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.inventory-import-preview th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 11px 12px;
  background: #0f172a;
  color: #ffffff;
  text-align: left;
  font-size: 11px;
  font-weight: 950;
}

.inventory-import-preview td {
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 750;
}

.inventory-import-more {
  margin: 0;
  padding: 11px 14px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  background: #f8fafc;
}

.inventory-import-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.inventory-import-footer button {
  min-height: 42px;
  border: 0;
  border-radius: 14px;
  padding: 0 16px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
}

.inventory-import-footer button.primary {
  background: #16a34a;
  color: #ffffff;
}

.inventory-import-footer button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

        .inventory-image-count {
          min-width: 34px;
          height: 30px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          padding: 0 10px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 950;
        }

        .inventory-image-empty {
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          background: #f8fafc;
          color: #64748b;
          padding: 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .inventory-image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
          gap: 12px;
        }

        .inventory-image-card {
          display: block;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #ffffff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }

        .inventory-image-card img {
          width: 100%;
          height: 118px;
          object-fit: cover;
          display: block;
          background: #f1f5f9;
        }

        .inventory-image-card span {
          display: block;
          padding: 9px 10px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          word-break: break-word;
        }


        .inventory-filter-card-minimal {
          padding: 16px;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 36px rgba(15, 23, 42, 0.06);
        }

        .inventory-filter-minimal-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
        }

        .inventory-search-shell {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 48px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          transition: 0.18s ease;
        }

        .inventory-search-shell:focus-within {
          background: #ffffff;
          border-color: #cbd5e1;
          box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.04);
        }

        .inventory-search-icon {
          width: 44px;
          color: #94a3b8;
          display: inline-flex;
          justify-content: center;
          font-size: 18px;
          flex: 0 0 auto;
        }

        .inventory-search-shell input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          padding: 0 12px 0 0;
        }

        .inventory-search-shell input::placeholder {
          color: #94a3b8;
          font-weight: 600;
        }

        .inventory-search-clear {
          width: 30px;
          height: 30px;
          margin-right: 8px;
          border: 0;
          border-radius: 999px;
          background: #e2e8f0;
          color: #475569;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .inventory-filter-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .inventory-filter-toggle,
        .inventory-soft-btn,
        .inventory-ghost-btn {
          height: 44px;
          border: 0;
          border-radius: 15px;
          padding: 0 14px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
          transition: 0.18s ease;
        }

        .inventory-filter-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #111827;
          color: #ffffff;
        }

        .inventory-filter-toggle.active {
          background: #0f172a;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
        }

        .inventory-filter-toggle b {
          min-width: 22px;
          height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          background: #ffffff;
          color: #111827;
          font-size: 12px;
        }

        .inventory-soft-btn {
          background: #f1f5f9;
          color: #334155;
        }

        .inventory-soft-btn:hover {
          background: #e2e8f0;
        }

        .inventory-ghost-btn {
          background: transparent;
          color: #64748b;
          border: 1px solid #e5e7eb;
        }

        .inventory-ghost-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .inventory-filter-summary-line {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-top: 10px;
          min-height: 24px;
        }

        .inventory-filter-summary-line span {
          display: inline-flex;
          height: 24px;
          align-items: center;
          padding: 0 9px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 12px;
          font-weight: 900;
        }

        .inventory-filter-summary-line em {
          color: #64748b;
          font-style: normal;
          font-size: 12px;
          font-weight: 700;
        }

        .inventory-filter-panel {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #eef2f7;
        }

        .inventory-filter-panel-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .inventory-minimal-filter-block {
          padding: 13px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid #eef2f7;
        }

        .inventory-minimal-filter-block.wide {
          grid-column: 1 / -1;
        }

        .inventory-minimal-filter-block-head {
          margin-bottom: 10px;
        }

        .inventory-minimal-filter-block-head strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
          font-weight: 950;
        }

        .inventory-minimal-filter-block-head span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .inventory-compact-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          max-height: 118px;
          overflow: auto;
          padding-right: 2px;
        }

        .inventory-compact-chip-row.scroll {
          max-height: 128px;
        }

        .inventory-compact-chip {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          border-radius: 999px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
          transition: 0.16s ease;
        }

        .inventory-compact-chip:hover {
          border-color: #cbd5e1;
          background: #ffffff;
        }

        .inventory-compact-chip.active {
          background: #0f172a;
          border-color: #0f172a;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.14);
        }

        .inventory-filter-muted {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
        }

        .inventory-minimal-date-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .inventory-minimal-date-row label {
          display: grid;
          gap: 6px;
        }

        .inventory-minimal-date-row label span {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
        }

        .inventory-minimal-date-row input {
          height: 42px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          color: #0f172a;
          padding: 0 11px;
          outline: 0;
          font-size: 13px;
          font-weight: 800;
        }

        .inventory-minimal-date-row input:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.04);
        }

        @media (max-width: 1100px) {
          .inventory-filter-minimal-top {
            grid-template-columns: 1fr;
          }

          .inventory-filter-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
          }
        }

        @media (max-width: 720px) {
          .inventory-filter-panel-grid {
            grid-template-columns: 1fr;
          }

          .inventory-minimal-date-row {
            grid-template-columns: 1fr;
          }

          .inventory-filter-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .inventory-filter-toggle {
            grid-column: 1 / -1;
            justify-content: center;
          }

          .inventory-soft-btn,
          .inventory-ghost-btn {
            width: 100%;
          }

         
        }

         .inventory-import-preview-head em {
  color: #64748b;
  font-size: 12px;
  font-style: normal;
  font-weight: 850;
}

.inventory-import-table-wrap.full {
  max-height: 430px;
  overflow: auto;
}

.inventory-import-table-wrap.full table {
  min-width: 2200px;
}

.inventory-import-table-wrap.full th,
.inventory-import-table-wrap.full td {
  white-space: nowrap;
}

.inventory-import-preview-badge,
.inventory-import-badge {
  width: fit-content;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 9px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #bbf7d0;
  font-size: 11px;
  font-style: normal;
  font-weight: 950;
}

.inventory-name-cell .inventory-import-badge {
  margin-top: 7px;
}
      `}</style>
    </div>
  );
}

function SmoothModalShell({ mounted, open, visible, children }) {
  if (!mounted || !open) return null;

  return createPortal(
    <div className={`inventory-smooth-modal-shell ${visible ? "show" : ""}`}>
      {children}
    </div>,
    document.body
  );
}

function InventoryImageGallery({ images }) {
  const [signedImages, setSignedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadSignedUrls() {
      const list = Array.isArray(images) ? images : [];

      if (list.length === 0) {
        setSignedImages([]);
        return;
      }

      setLoading(true);

      const result = [];

      for (const image of list) {
        if (!image?.path) continue;

        const { data, error } = await supabase.storage
          .from("inventory-images")
          .createSignedUrl(image.path, 60 * 10);

        if (!error && data?.signedUrl) {
          result.push({
            ...image,
            signedUrl: data.signedUrl,
          });
        }
      }

      if (alive) {
        setSignedImages(result);
        setLoading(false);
      }
    }

    loadSignedUrls();

    return () => {
      alive = false;
    };
  }, [images]);

  if (loading) {
    return (
      <DetailCard title="Şəkillər">
        <div className="inventory-image-empty">Şəkillər yüklənir...</div>
      </DetailCard>
    );
  }

  if (!signedImages.length) {
    return (
      <DetailCard title="Şəkillər">
        <div className="inventory-image-empty">Şəkil əlavə edilməyib.</div>
      </DetailCard>
    );
  }

  return (
    <DetailCard title="Şəkillər">
      <div className="inventory-image-grid">
        {signedImages.map((image, index) => (
          <a
            key={`${image.path}-${index}`}
            href={image.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="inventory-image-card"
          >
            <img src={image.signedUrl} alt={image.name || "İnventar şəkli"} />
            <span>{image.name || `Şəkil ${index + 1}`}</span>
          </a>
        ))}
      </div>
    </DetailCard>
  );
}

function InventoryViewModal({
  mounted,
  visible,
  item,
  qrGeneratingId,
  canEdit,
  canDelete,
  canQr,
  onClose,
  onEdit,
  onDelete,
  onQr,
}) {
  if (!mounted || !item) return null;

  const warranty = item.warranty_info || warrantyInfo(item);

  return createPortal(
    <div
      className={`inventory-view-root inventory-smooth-root ${visible ? "show" : ""
        }`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="inventory-view-backdrop inventory-smooth-backdrop"
        onClick={onClose}
        aria-label="Bağla"
      />

      <section className="inventory-view-modal inventory-smooth-card">
        <header className="inventory-view-head">
          <div>
            <span>Inventory details</span>
            <h2>{item.name || "-"}</h2>
            <p>{item.inventory_code || "-"}</p>
            {isImportedItem(item) && (
  <em className="inventory-import-badge">Excel import</em>
)}
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="inventory-view-body">
          <div className="inventory-view-main">
            <DetailCard title="Əsas məlumatlar">
              <DetailRow label="İnventar kodu" value={item.inventory_code} />
              <DetailRow label="Ad" value={item.name} />
              <DetailRow label="Təsvir" value={item.description} />
              <DetailRow label="Brand" value={item.brand} />
              <DetailRow label="Model" value={item.model} />
              <DetailRow label="Seriya nömrəsi" value={item.serial_number} />
              <DetailRow label="Cari yerləşmə" value={item.current_location} />
            </DetailCard>

            <DetailCard title="Şirkət və təhkim">
              <DetailRow label="Şirkət" value={item.company?.name} />
              <DetailRow label="Departament" value={item.department?.name} />
              <DetailRow label="Kateqoriya" value={item.category?.name} />
              <DetailRow label="Alt kateqoriya" value={item.subcategory?.name} />
             <DetailRow
  label="Məsul şəxs"
  value={item.responsible?.full_name || item.responsible_external_name}
/>

<DetailRow
  label="Email"
  value={item.responsible?.email || item.responsible_external_email}
/>

<DetailRow
  label="Import mənbəyi"
  value={isImportedItem(item) ? "Excel import" : "Manual"}
/>

<DetailRow
  label="Import tarixi"
  value={item.imported_at ? formatDate(item.imported_at) : "-"}
/>
            </DetailCard>

            <DetailCard title="Maliyyə və zəmanət">
              <DetailRow label="Alış tarixi" value={formatDate(item.purchase_date)} />
              <DetailRow
                label="Alış qiyməti"
                value={
                  item.purchase_price
                    ? `${item.purchase_price} ${item.currency || "AZN"}`
                    : "-"
                }
              />
              <DetailRow
                label="Zəmanət başlanğıcı"
                value={formatDate(item.warranty_start_date)}
              />
              <DetailRow
                label="Zəmanət bitmə tarixi"
                value={formatDate(item.warranty_end_date)}
              />
              <DetailRow label="Zəmanət statusu" value={warranty.label} />
            </DetailCard>

            <InventoryImageGallery images={item.images} />
          </div>

          <aside className="inventory-view-side">
            <div className="inventory-view-status-card">
              <span>Status</span>
              <InventoryStatusPill status={item.status} />
            </div>

            <div className="inventory-view-status-card">
              <span>Health score</span>
              <HealthScorePill
                score={item.computed_health_score}
                status={item.computed_health_status}
              />
            </div>

            <div className="inventory-view-status-card">
              <span>Şəkillər</span>
              <strong>{getImageCount(item)} ədəd</strong>
            </div>

            <div className="inventory-view-status-card">
              <span>QR</span>
              <strong>{item.qr_token ? "QR hazırdır" : "QR yoxdur"}</strong>
              <button
                type="button"
                className={`inventory-qr-btn ${item.qr_token ? "ready" : ""}`}
                onClick={() => onQr?.(item)}
                disabled={qrGeneratingId === item.id || (!canQr && !item.qr_token)}
                title={
                  !canQr && !item.qr_token
                    ? "QR yaratmaq üçün icazə yoxdur"
                    : undefined
                }
              >
                {qrGeneratingId === item.id
                  ? "Yaradılır..."
                  : item.qr_token
                    ? "QR bax"
                    : "QR yarat"}
              </button>
            </div>

            <div className="inventory-view-status-card">
              <span>Yaradılma tarixi</span>
              <strong>{formatDate(item.created_at)}</strong>
            </div>
          </aside>
        </div>

        <footer className="inventory-view-footer">
          {canDelete ? (
            <button
              type="button"
              className="inventory-danger-btn"
              onClick={() => onDelete?.(item)}
            >
              Sil
            </button>
          ) : (
            <span />
          )}

          <div>
            {canEdit && (
              <button
                type="button"
                className="inventory-secondary-action-btn"
                onClick={() => onEdit?.(item)}
              >
                Düzəlt
              </button>
            )}

            <button type="button" onClick={onClose}>
              Bağla
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function InventoryEditModal({
  mounted,
  visible,
  item,
  companies,
  departments,
  categories,
  profiles,
  canEdit,
  role,
  currentCompanyId,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) {
      setForm(null);
      setError("");
      return;
    }

    setForm({
      inventory_code: item.inventory_code || "",
      name: item.name || "",
      description: item.description || "",
      company_id: item.company?.id || "",
      department_id: item.department?.id || "",
      category_id: item.category?.id || "",
      subcategory_id: item.subcategory?.id || "",
      responsible_user_id: item.responsible?.id || "",
      current_location: item.current_location || "",
      purchase_date: toInputDate(item.purchase_date),
      purchase_price:
        item.purchase_price === null || item.purchase_price === undefined
          ? ""
          : String(item.purchase_price),
      currency: item.currency || "AZN",
      serial_number: item.serial_number || "",
      model: item.model || "",
      brand: item.brand || "",
      status: item.status || "IN_STOCK",
      condition: item.condition || "GOOD",
      warranty_start_date: toInputDate(item.warranty_start_date),
      warranty_end_date: toInputDate(item.warranty_end_date),
    });
  }, [item]);

  const filteredDepartments = useMemo(() => {
    if (!form?.company_id) return departments;
    return departments.filter((x) => x.company_id === form.company_id);
  }, [departments, form?.company_id]);

  const parentCategories = useMemo(() => {
  return categories
    .filter((item) => !item.parent_id)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "az"));
}, [categories]);

const filteredSubcategories = useMemo(() => {
  if (!form?.category_id) return [];

  return categories
    .filter((item) => String(item.parent_id || "") === String(form.category_id))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "az"));
}, [categories, form?.category_id]);

  const filteredProfiles = useMemo(() => {
    if (!form?.company_id) return profiles;
    return profiles.filter((x) => x.company_id === form.company_id);
  }, [profiles, form?.company_id]);

  function setField(name, value) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "company_id") {
        next.department_id = "";
        next.responsible_user_id = "";
      }

      if (name === "category_id") {
  next.subcategory_id = "";
}

      if (name === "responsible_user_id" && value) {
        next.status = "ASSIGNED";
      }

      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!canEdit) {
      setError("Bu əməliyyat üçün icazəniz yoxdur.");
      return;
    }

    if (!item?.id || !form) return;

    setSaving(true);
    setError("");

    if (!form.inventory_code.trim()) {
      setError("İnventar kodu məcburidir.");
      setSaving(false);
      return;
    }

    if (!form.name.trim()) {
      setError("İnventar adı məcburidir.");
      setSaving(false);
      return;
    }

    if (isRehber(role) && currentCompanyId && form.company_id !== currentCompanyId) {
      setError("REHBER yalnız öz şirkətinə aid inventarı düzəldə bilər.");
      setSaving(false);
      return;
    }

    const payload = {
      inventory_code: form.inventory_code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,

      company_id: form.company_id || null,
      department_id: form.department_id || null,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      responsible_user_id: form.responsible_user_id || null,

      current_location: form.current_location.trim() || null,

      purchase_date: toDateOrNull(form.purchase_date),
      purchase_price: toNumberOrNull(form.purchase_price),
      currency: form.currency || "AZN",

      serial_number: form.serial_number.trim() || null,
      model: form.model.trim() || null,
      brand: form.brand.trim() || null,

      status: form.responsible_user_id ? "ASSIGNED" : form.status,
      condition: form.condition || "GOOD",

      warranty_start_date: toDateOrNull(form.warranty_start_date),
      warranty_end_date: toDateOrNull(form.warranty_end_date),
    };

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update(payload)
      .eq("id", item.id);

    if (updateError) {
      console.error("INVENTORY UPDATE ERROR:", updateError);
      setError(updateError.message || "İnventar yenilənərkən xəta baş verdi.");
      setSaving(false);
      return;
    }

    if (payload.responsible_user_id) {
      const { data: existingAssignments } = await supabase
        .from("inventory_assignments")
        .select("id")
        .eq("inventory_id", item.id)
        .eq("status", "ACTIVE")
        .limit(1);

      if (existingAssignments?.[0]?.id) {
        await supabase
          .from("inventory_assignments")
          .update({
            assigned_to: payload.responsible_user_id,
            note: "İnventar düzəliş zamanı yeniləndi.",
          })
          .eq("id", existingAssignments[0].id);
      } else {
        await supabase.from("inventory_assignments").insert({
          inventory_id: item.id,
          assigned_to: payload.responsible_user_id,
          status: "ACTIVE",
          note: "İnventar düzəliş zamanı təhkim edildi.",
        });
      }
    }

    setSaving(false);
    onSaved?.();
  }

  if (!mounted || !item || !form) return null;

  return createPortal(
    <div
      className={`inventory-edit-root inventory-smooth-root ${visible ? "show" : ""
        }`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="inventory-edit-backdrop inventory-smooth-backdrop"
        onClick={onClose}
        aria-label="Bağla"
      />

      <form
        className="inventory-edit-modal inventory-smooth-card"
        onSubmit={handleSubmit}
      >
        <header className="inventory-edit-head">
          <div>
            <span>Inventory edit</span>
            <h2>İnventarı düzəlt</h2>
            <p>{item.inventory_code || "-"}</p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        {error && <div className="inventory-edit-error">{error}</div>}

        <div className="inventory-edit-body">
          <EditSection title="Əsas məlumatlar">
            <EditField label="İnventar kodu *">
              <input
                value={form.inventory_code}
                onChange={(e) => setField("inventory_code", e.target.value)}
                required
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="İnventar adı *" wide>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Brand">
              <input
                value={form.brand}
                onChange={(e) => setField("brand", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Model">
              <input
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Seriya nömrəsi">
              <input
                value={form.serial_number}
                onChange={(e) => setField("serial_number", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Təsvir" full>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                disabled={!canEdit || saving}
              />
            </EditField>
          </EditSection>

          <EditSection title="Şirkət və təhkim">
            <EditField label="Şirkət">
              <select
                value={form.company_id}
                onChange={(e) => setField("company_id", e.target.value)}
                disabled={
                  !canEdit ||
                  saving ||
                  (isRehber(role) && Boolean(currentCompanyId))
                }
              >
                <option value="">Seçilməyib</option>
                {companies.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </EditField>

            <EditField label="Departament">
              <select
                value={form.department_id}
                onChange={(e) => setField("department_id", e.target.value)}
                disabled={!canEdit || saving || !form.company_id}
              >
                <option value="">Seçilməyib</option>
                {filteredDepartments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </EditField>

          <EditField label="Əsas kateqoriya">
  <select
    value={form.category_id}
    onChange={(e) => setField("category_id", e.target.value)}
    disabled={!canEdit || saving}
  >
    <option value="">Seçilməyib</option>
    {parentCategories.map((x) => (
      <option key={x.id} value={x.id}>
        {x.name}
      </option>
    ))}
  </select>
</EditField>

<EditField label="Alt kateqoriya">
  <select
    value={form.subcategory_id}
    onChange={(e) => setField("subcategory_id", e.target.value)}
    disabled={
      !canEdit ||
      saving ||
      !form.category_id ||
      filteredSubcategories.length === 0
    }
  >
    <option value="">
      {!form.category_id
        ? "Əvvəl əsas kateqoriya seçin"
        : filteredSubcategories.length === 0
          ? "Alt kateqoriya yoxdur"
          : "Seçilməyib"}
    </option>

    {filteredSubcategories.map((x) => (
      <option key={x.id} value={x.id}>
        {x.name}
      </option>
    ))}
  </select>
</EditField>

            <EditField label="Məsul şəxs">
              <select
                value={form.responsible_user_id}
                onChange={(e) =>
                  setField("responsible_user_id", e.target.value)
                }
                disabled={!canEdit || saving || !form.company_id}
              >
                <option value="">Təhkim edilməyib</option>
                {filteredProfiles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.full_name} {x.email ? `(${x.email})` : ""}
                  </option>
                ))}
              </select>
            </EditField>

            <EditField label="Cari yerləşmə" wide>
              <input
                value={form.current_location}
                onChange={(e) => setField("current_location", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>
          </EditSection>

          <EditSection title="Status, maliyyə və zəmanət">
            <EditField label="Status">
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                disabled={!canEdit || saving || Boolean(form.responsible_user_id)}
              >
                {ITEM_STATUS_OPTIONS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </EditField>

            <EditField label="Vəziyyət">
              <select
                value={form.condition}
                onChange={(e) => setField("condition", e.target.value)}
                disabled={!canEdit || saving}
              >
                {CONDITION_OPTIONS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </EditField>

            <EditField label="Alış tarixi">
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setField("purchase_date", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Alış qiyməti">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => setField("purchase_price", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Valyuta">
              <select
                value={form.currency}
                onChange={(e) => setField("currency", e.target.value)}
                disabled={!canEdit || saving}
              >
                <option value="AZN">AZN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
            </EditField>

            <EditField label="Zəmanət başlanğıcı">
              <input
                type="date"
                value={form.warranty_start_date}
                onChange={(e) =>
                  setField("warranty_start_date", e.target.value)
                }
                disabled={!canEdit || saving}
              />
            </EditField>

            <EditField label="Zəmanət bitmə tarixi">
              <input
                type="date"
                value={form.warranty_end_date}
                onChange={(e) => setField("warranty_end_date", e.target.value)}
                disabled={!canEdit || saving}
              />
            </EditField>
          </EditSection>
        </div>

        <footer className="inventory-edit-footer">
          <button type="button" onClick={onClose}>
            Bağla
          </button>

          <button type="submit" className="primary" disabled={!canEdit || saving}>
            {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}

function InventoryQrModal({ mounted, visible, item, onClose }) {
  if (!mounted || !item?.qr_token) return null;

  const qrUrl = getQrUrl(item.qr_token);
  const qrImageUrl = getQrImageUrl(item.qr_token, 280);

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=420,height=620");

    if (!printWindow) {
      alert("Print pəncərəsi bloklandı. Brauzer popup icazəsini yoxla.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${item.inventory_code || "QR"}</title>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              color: #0f172a;
            }
            .label {
              width: 320px;
              border: 2px solid #0f172a;
              border-radius: 18px;
              padding: 18px;
              text-align: center;
            }
            h1 {
              margin: 0 0 6px;
              font-size: 22px;
            }
            p {
              margin: 4px 0;
              font-size: 13px;
              color: #475569;
            }
            img {
              width: 220px;
              height: 220px;
              margin: 14px auto;
              display: block;
            }
            .code {
              margin-top: 10px;
              padding: 8px 10px;
              border-radius: 999px;
              background: #f1f5f9;
              font-weight: 800;
              font-size: 13px;
            }
            @media print {
              body { padding: 0; }
              .label {
                border-radius: 0;
                border: 1px solid #000;
              }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <h1>${item.name || "İnventar"}</h1>
            <p>${item.company?.name || ""}</p>
            <p>${item.brand || ""} ${item.model || ""}</p>
            <img src="${qrImageUrl}" alt="QR" />
            <div class="code">${item.inventory_code || "-"}</div>
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(qrUrl);
      alert("QR link kopyalandı.");
    } catch {
      alert(qrUrl);
    }
  }

  return createPortal(
    <div
      className={`inventory-qr-root inventory-smooth-root ${visible ? "show" : ""
        }`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="inventory-qr-backdrop inventory-smooth-backdrop"
        onClick={onClose}
        aria-label="Bağla"
      />

      <section className="inventory-qr-modal inventory-smooth-card">
        <header className="inventory-qr-head">
          <div>
            <span>Inventory QR</span>
            <h2>{item.name || "-"}</h2>
            <p>{item.inventory_code || "-"}</p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="inventory-qr-body">
          <div className="inventory-qr-box">
            <img
              src={qrImageUrl}
              alt="Inventory QR"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = "grid";
              }}
            />

            <div className="inventory-qr-fallback">
              QR şəkli yüklənmədi. Linki kopyalayıb ayrıca aça bilərsən.
            </div>
          </div>

          <div className="inventory-qr-info">
            <span>QR link</span>
            <strong>{qrUrl}</strong>

            <div>
              <button type="button" onClick={copyLink}>
                Linki kopyala
              </button>

              <button type="button" className="primary" onClick={handlePrint}>
                Çap et
              </button>
            </div>
          </div>
        </div>

        <footer className="inventory-qr-footer">
          <button type="button" onClick={onClose}>
            Bağla
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function InventoryDeleteConfirmModal({
  mounted,
  visible,
  item,
  deleting,
  onClose,
  onConfirm,
}) {
  if (!mounted || !item) return null;

  return createPortal(
    <div
      className={`inventory-delete-root inventory-smooth-root ${visible ? "show" : ""
        }`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="inventory-delete-backdrop inventory-smooth-backdrop"
        onClick={onClose}
        aria-label="Bağla"
        disabled={deleting}
      />

      <section className="inventory-delete-modal inventory-smooth-card">
        <div className="inventory-delete-icon">!</div>

        <h3>İnventar silinsin?</h3>

        <p>
          <strong>{item.name || "-"}</strong> inventarını silmək üzrəsən. Bu
          əməliyyat geri qaytarılmaya bilər.
        </p>

        {getImageCount(item) > 0 && (
          <p>
            Bu inventara bağlı <strong>{getImageCount(item)} şəkil</strong> də
            storage-dən silinməyə çalışılacaq.
          </p>
        )}

        <div className="inventory-delete-code">{item.inventory_code || "-"}</div>

        <footer>
          <button type="button" onClick={onClose} disabled={deleting}>
            İmtina
          </button>

          <button
            type="button"
            className="danger"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Silinir..." : "Bəli, sil"}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function DetailCard({ title, children }) {
  return (
    <section className="inventory-detail-card">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="inventory-detail-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function EditSection({ title, children }) {
  return (
    <section className="inventory-edit-section">
      <h3>{title}</h3>
      <div className="inventory-edit-grid">{children}</div>
    </section>
  );
}

function EditField({ label, children, wide, full }) {
  return (
    <label
      className={`inventory-edit-field ${wide ? "wide" : ""} ${full ? "full" : ""
        }`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

function MinimalFilterBlock({ title, subtitle, children, wide }) {
  return (
    <div className={`inventory-minimal-filter-block ${wide ? "wide" : ""}`}>
      <div className="inventory-minimal-filter-block-head">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      {children}
    </div>
  );
}

function InventoryImportModal({
  open,
  companies,
  departments,
  categories,
  profiles,
  role,
  currentCompanyId,
  canImport,
  onClose,
  onImported,
}) {
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const companyMap = useMemo(() => {
    const map = new Map();

    companies.forEach((company) => {
      map.set(normalizeImportLookup(company.name), company);
    });

    return map;
  }, [companies]);

  const departmentMap = useMemo(() => {
    const map = new Map();

    departments.forEach((department) => {
      const key = `${normalizeImportLookup(department.name)}::${department.company_id || ""}`;
      map.set(key, department);
    });

    return map;
  }, [departments]);

  const categoryMap = useMemo(() => {
    const map = new Map();

    categories.forEach((category) => {
      map.set(normalizeImportLookup(category.name), category);
    });

    return map;
  }, [categories]);

  const profileMap = useMemo(() => {
    const map = new Map();

    profiles.forEach((profile) => {
      if (profile.email) {
        map.set(normalizeImportLookup(profile.email), profile);
      }
    });

    return map;
  }, [profiles]);

  if (!open) return null;

  function resetImport() {
    setFileName("");
    setRawRows([]);
    setPreviewRows([]);
    setErrors([]);
  }

 function parseRows(rows) {
  const nextErrors = [];
  const parsed = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    const inventoryCode = normalizeImportValue(row.inventory_code);
    const name = normalizeImportValue(row.name);
    const companyName = normalizeImportValue(row.company_name);
    const departmentName = normalizeImportValue(row.department_name);
    const categoryName = normalizeImportValue(row.category_name);
    const subcategoryName = normalizeImportValue(row.subcategory_name);
    const responsibleEmail = normalizeImportValue(row.responsible_email);
    const responsibleFullName = normalizeImportValue(row.responsible_full_name);

    if (!inventoryCode) {
      nextErrors.push(`Sətir ${rowNumber}: İnventar kodu məcburidir.`);
    }

    if (!name) {
      nextErrors.push(`Sətir ${rowNumber}: İnventar adı məcburidir.`);
    }

    if (!companyName) {
      nextErrors.push(`Sətir ${rowNumber}: Şirkət adı məcburidir.`);
    }

    if (!categoryName) {
      nextErrors.push(`Sətir ${rowNumber}: Kateqoriya adı məcburidir.`);
    }

    let responsible = null;

    if (responsibleEmail) {
      responsible = profileMap.get(normalizeImportLookup(responsibleEmail));
    }

    const status =
      responsible || responsibleFullName || responsibleEmail
        ? "ASSIGNED"
        : normalizeImportStatus(row.status || "IN_STOCK");

    const condition = normalizeImportCondition(row.condition || "GOOD");

    if (!ITEM_STATUS_OPTIONS.some((item) => item.value === status)) {
      nextErrors.push(
        `Sətir ${rowNumber}: status düzgün deyil. Düzgün dəyərlər: ${ITEM_STATUS_OPTIONS.map(
          (x) => x.value
        ).join(", ")}`
      );
    }

    if (!CONDITION_OPTIONS.some((item) => item.value === condition)) {
      nextErrors.push(
        `Sətir ${rowNumber}: condition düzgün deyil. Düzgün dəyərlər: ${CONDITION_OPTIONS.map(
          (x) => x.value
        ).join(", ")}`
      );
    }

    parsed.push({
      rowNumber,
      inventory_code: inventoryCode,
      name,
      description: normalizeImportValue(row.description),
      brand: normalizeImportValue(row.brand),
      model: normalizeImportValue(row.model),
      serial_number: normalizeImportValue(row.serial_number),
      company_name: companyName,
      department_name: departmentName,
      category_name: categoryName,
      subcategory_name: subcategoryName,
      responsible_user_id: responsible?.id || null,
      responsible_full_name: responsible?.full_name || responsibleFullName,
      responsible_email: responsibleEmail,
      responsible_external_name: responsible ? "" : responsibleFullName,
      responsible_external_email: responsible ? "" : responsibleEmail,
      status,
      condition,
      current_location: normalizeImportValue(row.current_location),
      purchase_date: normalizeImportDate(row.purchase_date),
      purchase_price: toNumberOrNull(row.purchase_price),
      currency: normalizeImportValue(row.currency || "AZN").toUpperCase(),
      warranty_start_date: normalizeImportDate(row.warranty_start_date),
      warranty_end_date: normalizeImportDate(row.warranty_end_date),
    });
  });

  setPreviewRows(parsed);
  setErrors(nextErrors);
}

  async function handleFileChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setErrors([]);
    setPreviewRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const importedRows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      });

      const rows = importedRows.map((row) => {
        const normalized = {};

        Object.entries(row).forEach(([label, value]) => {
          const key = INVENTORY_IMPORT_LABEL_TO_KEY[label] || label;
          normalized[key] = value;
        });

        return normalized;
      });

      setRawRows(rows);
      parseRows(rows);
    } catch (err) {
      console.error("INVENTORY_IMPORT_PARSE_ERROR:", err);
      setErrors([err?.message || "Fayl oxunarkən xəta baş verdi."]);
      setRawRows([]);
      setPreviewRows([]);
    }
  }

  async function handleImportSubmit() {
    if (!canImport) {
      alert("Import üçün icazəniz yoxdur.");
      return;
    }

    if (errors.length > 0) {
      alert("Əvvəlcə import xətalarını düzəlt.");
      return;
    }

    if (previewRows.length === 0) {
      alert("Import üçün sətir yoxdur.");
      return;
    }

    setSaving(true);

    try {
      const codes = previewRows.map((row) => row.inventory_code).filter(Boolean);

      const { data: existingRows, error: existingError } = await supabase
        .from("inventory_items")
        .select("inventory_code")
        .in("inventory_code", codes);

      if (existingError) throw existingError;

      const existingCodeSet = new Set(
        (existingRows || []).map((row) => row.inventory_code)
      );

      const duplicateCodes = codes.filter((code) => existingCodeSet.has(code));

      if (duplicateCodes.length > 0) {
        setErrors([
          `Bu inventar kodları artıq bazada var: ${Array.from(
            new Set(duplicateCodes)
          ).join(", ")}`,
        ]);
        setSaving(false);
        return;
      }

      const uniqueCompanyNames = Array.from(
        new Set(previewRows.map((row) => row.company_name).filter(Boolean))
      );

      const companyNameToId = new Map(
        companies.map((company) => [
          normalizeImportLookup(company.name),
          company.id,
        ])
      );

      for (const companyName of uniqueCompanyNames) {
        const key = normalizeImportLookup(companyName);

        if (companyNameToId.has(key)) continue;

        const { data: createdCompany, error: companyCreateError } = await supabase
          .from("companies")
          .insert({
            name: companyName,
            status: "ACTIVE",
          })
          .select("id,name")
          .single();

        if (companyCreateError) throw companyCreateError;

        companyNameToId.set(key, createdCompany.id);
      }

     const categoryNameToId = new Map(
  categories
    .filter((category) => !category.parent_id)
    .map((category) => [normalizeImportLookup(category.name), category.id])
);

const subcategoryKeyToId = new Map(
  categories
    .filter((category) => category.parent_id)
    .map((category) => [
      `${normalizeImportLookup(category.name)}::${category.parent_id}`,
      category.id,
    ])
);

const uniqueCategoryNames = Array.from(
  new Set(previewRows.map((row) => row.category_name).filter(Boolean))
);

for (const categoryName of uniqueCategoryNames) {
  const key = normalizeImportLookup(categoryName);

  if (categoryNameToId.has(key)) continue;

  const { data: createdCategory, error: categoryCreateError } = await supabase
    .from("inventory_categories")
    .insert({
      name: categoryName,
      status: "ACTIVE",
      parent_id: null,
    })
    .select("id,name,parent_id")
    .single();

  if (categoryCreateError) throw categoryCreateError;

  categoryNameToId.set(key, createdCategory.id);
}

const uniqueSubcategories = [];

previewRows.forEach((row) => {
  if (!row.subcategory_name || !row.category_name) return;

  const parentCategoryId = categoryNameToId.get(
    normalizeImportLookup(row.category_name)
  );

  if (!parentCategoryId) return;

  const key = `${normalizeImportLookup(row.subcategory_name)}::${parentCategoryId}`;

  if (!uniqueSubcategories.some((item) => item.key === key)) {
    uniqueSubcategories.push({
      key,
      name: row.subcategory_name,
      parent_id: parentCategoryId,
    });
  }
});

for (const subcategory of uniqueSubcategories) {
  if (subcategoryKeyToId.has(subcategory.key)) continue;

  const { data: createdSubcategory, error: subcategoryCreateError } =
    await supabase
      .from("inventory_categories")
      .insert({
        name: subcategory.name,
        status: "ACTIVE",
        parent_id: subcategory.parent_id,
      })
      .select("id,name,parent_id")
      .single();

  if (subcategoryCreateError) throw subcategoryCreateError;

  subcategoryKeyToId.set(subcategory.key, createdSubcategory.id);
}

      const departmentKeyToId = new Map(
        departments.map((department) => [
          `${normalizeImportLookup(department.name)}::${department.company_id || ""}`,
          department.id,
        ])
      );

      const uniqueDepartments = [];

      previewRows.forEach((row) => {
        if (!row.department_name || !row.company_name) return;

        const companyId = companyNameToId.get(normalizeImportLookup(row.company_name));

        if (!companyId) return;

        const key = `${normalizeImportLookup(row.department_name)}::${companyId}`;

        if (!uniqueDepartments.some((item) => item.key === key)) {
          uniqueDepartments.push({
            key,
            name: row.department_name,
            company_id: companyId,
          });
        }
      });

      for (const department of uniqueDepartments) {
        if (departmentKeyToId.has(department.key)) continue;

        const { data: createdDepartment, error: departmentCreateError } =
          await supabase
            .from("departments")
            .insert({
              name: department.name,
              company_id: department.company_id,
              status: "ACTIVE",
            })
            .select("id,name,company_id")
            .single();

        if (departmentCreateError) throw departmentCreateError;

        departmentKeyToId.set(department.key, createdDepartment.id);
      }

      const rowsToInsert = previewRows.map((row) => {
        const companyId = companyNameToId.get(
          normalizeImportLookup(row.company_name)
        );

        const departmentId = row.department_name
          ? departmentKeyToId.get(
            `${normalizeImportLookup(row.department_name)}::${companyId}`
          )
          : null;

        const categoryId = categoryNameToId.get(
  normalizeImportLookup(row.category_name)
);

const subcategoryId =
  row.subcategory_name && categoryId
    ? subcategoryKeyToId.get(
        `${normalizeImportLookup(row.subcategory_name)}::${categoryId}`
      )
    : null;

return {
          inventory_code: row.inventory_code,
          name: row.name,
          description: row.description || null,
          brand: row.brand || null,
          model: row.model || null,
          serial_number: row.serial_number || null,

          company_id: companyId,
          department_id: departmentId || null,
          category_id: categoryId,
          subcategory_id: subcategoryId || null,

          responsible_user_id: row.responsible_user_id,
          
         responsible_external_name: row.responsible_user_id
  ? null
  : row.responsible_external_name || null,

responsible_external_email: row.responsible_user_id
  ? null
  : row.responsible_external_email || null,

import_source: "EXCEL",
imported_at: new Date().toISOString(),
          status: row.status,
          condition: row.condition,
          current_location: row.current_location || null,

          purchase_date: row.purchase_date || null,
          purchase_price: row.purchase_price,
          currency: row.currency || "AZN",
          warranty_start_date: row.warranty_start_date || null,
          warranty_end_date: row.warranty_end_date || null,
          images: [],
        };
      });

      const invalidRows = rowsToInsert
        .map((row, index) => ({ row, rowNumber: previewRows[index].rowNumber }))
        .filter((item) => !item.row.company_id || !item.row.category_id);

      if (invalidRows.length > 0) {
        setErrors(
          invalidRows.map(
            (item) =>
              `Sətir ${item.rowNumber}: Şirkət və ya kateqoriya yaradıla bilmədi.`
          )
        );
        setSaving(false);
        return;
      }

      const { data: insertedItems, error: insertError } = await supabase
        .from("inventory_items")
        .insert(rowsToInsert)
        .select("id, responsible_user_id");

      if (insertError) throw insertError;

      const assignmentRows = (insertedItems || [])
        .filter((item) => item.responsible_user_id)
        .map((item) => ({
          inventory_id: item.id,
          assigned_to: item.responsible_user_id,
          status: "ACTIVE",
          note: "Excel/CSV import zamanı avtomatik təhkim edildi.",
        }));

      if (assignmentRows.length > 0) {
        const { error: assignmentError } = await supabase
          .from("inventory_assignments")
          .insert(assignmentRows);

        if (assignmentError) throw assignmentError;
      }

      alert(`${rowsToInsert.length} inventar uğurla import edildi.`);
      resetImport();
      onImported?.();
    } catch (err) {
      console.error("INVENTORY_IMPORT_SAVE_ERROR:", err);
      setErrors([err?.message || "Import zamanı xəta baş verdi."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inventory-import-root inventory-smooth-root show">
      <button
        type="button"
        className="inventory-import-backdrop inventory-smooth-backdrop"
        onClick={onClose}
        aria-label="Bağla"
        disabled={saving}
      />

      <section className="inventory-import-modal inventory-smooth-card">
        <header className="inventory-import-head">
          <div>
            <span>Inventory import</span>
            <h2>Excel / CSV import</h2>
            <p>
              Şablonu yüklə, məlumatları doldur və faylı seçərək inventarları
              toplu şəkildə əlavə et.
            </p>
          </div>

          <button type="button" onClick={onClose} disabled={saving}>
            ×
          </button>
        </header>

        <div className="inventory-import-body">
          <div className="inventory-import-actions">
            <button
              type="button"
              className="inventory-report-btn template"
              onClick={downloadInventoryImportTemplate}
              disabled={saving}
            >
              Şablon yüklə
            </button>

            <label className="inventory-import-file-btn">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={saving}
              />
              Fayl seç
            </label>

            {fileName && <strong>{fileName}</strong>}
          </div>

          <div className="inventory-import-info">
            <strong>Vacib:</strong> `company_name` və `category_name` bazada
            mövcud olan adlarla eyni olmalıdır. `responsible_email` doludursa
            inventar avtomatik həmin şəxsə təhkim ediləcək.
          </div>

          {errors.length > 0 && (
            <div className="inventory-import-errors">
              <strong>Xətalar</strong>
              {errors.slice(0, 20).map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}

              {errors.length > 20 && (
                <p>... və daha {errors.length - 20} xəta</p>
              )}
            </div>
          )}

         {previewRows.length > 0 && (
  <div className="inventory-import-preview">
    <div className="inventory-import-preview-head">
      <div>
        <strong>Preview</strong>
        <span>{previewRows.length} sətir import üçün hazırdır</span>
      </div>

      <em>Bütün sütunlara baxmaq üçün cədvəli sağa-sola sürüşdür</em>
    </div>

    <div className="inventory-import-table-wrap full">
      <table>
        <thead>
          <tr>
            <th>Sətir</th>
            <th>İnventar kodu</th>
            <th>İnventar adı</th>
            <th>Təsvir</th>
            <th>Brend</th>
            <th>Model</th>
            <th>Seriya nömrəsi</th>
            <th>Şirkət</th>
            <th>Departament</th>
            <th>Kateqoriya</th>
            <th>Alt kateqoriya</th>
            <th>Məsul şəxsin ad soyadı</th>
            <th>Məsul şəxsin emaili</th>
            <th>Status</th>
            <th>Vəziyyət</th>
            <th>Cari yerləşmə</th>
            <th>Alış tarixi</th>
            <th>Alış qiyməti</th>
            <th>Valyuta</th>
            <th>Zəmanət başlanğıcı</th>
            <th>Zəmanət bitmə tarixi</th>
            <th>Import</th>
          </tr>
        </thead>

        <tbody>
          {previewRows.map((row) => (
            <tr key={`${row.rowNumber}-${row.inventory_code}`}>
              <td>{row.rowNumber}</td>
              <td><strong>{row.inventory_code || "-"}</strong></td>
              <td>{row.name || "-"}</td>
              <td>{row.description || "-"}</td>
              <td>{row.brand || "-"}</td>
              <td>{row.model || "-"}</td>
              <td>{row.serial_number || "-"}</td>
              <td>{row.company_name || "-"}</td>
              <td>{row.department_name || "-"}</td>
              <td>{row.category_name || "-"}</td>
              <td>{row.subcategory_name || "-"}</td>
              <td>{row.responsible_full_name || row.responsible_external_name || "-"}</td>
              <td>{row.responsible_email || row.responsible_external_email || "-"}</td>
              <td>{getStatusLabel(row.status)}</td>
              <td>{getConditionLabel(row.condition)}</td>
              <td>{row.current_location || "-"}</td>
              <td>{row.purchase_date || "-"}</td>
              <td>{row.purchase_price ?? "-"}</td>
              <td>{row.currency || "-"}</td>
              <td>{row.warranty_start_date || "-"}</td>
              <td>{row.warranty_end_date || "-"}</td>
              <td><span className="inventory-import-preview-badge">Excel</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
        </div>

        <footer className="inventory-import-footer">
          <button type="button" onClick={onClose} disabled={saving}>
            Bağla
          </button>

          <button
            type="button"
            className="primary"
            onClick={handleImportSubmit}
            disabled={saving || previewRows.length === 0 || errors.length > 0}
          >
            {saving ? "Import edilir..." : "Import et"}
          </button>
        </footer>
      </section>
    </div>
  );
}
