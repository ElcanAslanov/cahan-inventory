"use client";

import { useEffect, useMemo, useState } from "react";
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
  return `${origin}/inventory/qr/${encodeURIComponent(token)}`;
}

function getQrImageUrl(token, size = 260) {
  const qrUrl = getQrUrl(token);
  if (!qrUrl) return "";

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(
    qrUrl
  )}`;
}

export default function InventoryPageClient() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedHealths, setSelectedHealths] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
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

  useEffect(() => {
    setMounted(true);
    loadItems();
    loadOptions();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedStatuses,
    selectedHealths,
    selectedCompanies,
    selectedCategories,
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

  async function loadItems() {
    setLoading(true);

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
      console.error("INVENTORY LOAD ERROR FULL:", JSON.stringify(error, null, 2));
      console.error("INVENTORY LOAD ERROR MESSAGE:", error.message);
      console.error("INVENTORY LOAD ERROR DETAILS:", error.details);
      console.error("INVENTORY LOAD ERROR HINT:", error.hint);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data || []).map(enrichItem));
    setLoading(false);
  }

  async function loadOptions() {
    const [companiesRes, departmentsRes, categoriesRes, profilesRes] =
      await Promise.all([
        supabase
          .from("companies")
          .select("id,name,status")
          .eq("status", "ACTIVE")
          .order("name"),
        supabase
          .from("departments")
          .select("id,name,company_id,status")
          .eq("status", "ACTIVE")
          .order("name"),
        supabase
          .from("inventory_categories")
          .select("id,name,status")
          .eq("status", "ACTIVE")
          .order("name"),
        supabase
          .from("profiles")
          .select("id,full_name,email,company_id,status")
          .eq("status", "ACTIVE")
          .order("full_name"),
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
      .sort((a, b) => a.name.localeCompare(b.name));
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

      const matchesCreatedDate =
        (!createdFrom && !createdTo) ||
        isDateInRange(item.created_at, createdFrom, createdTo);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesHealth &&
        matchesCompany &&
        matchesCategory &&
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
      assignedPercent: items.length ? Math.round((assigned / items.length) * 100) : 0,
      inStockPercent: items.length ? Math.round((inStock / items.length) * 100) : 0,
      riskyPercent: items.length ? Math.round((risky / items.length) * 100) : 0,
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
      const categoryName = item.category?.name || "Kateqoriya seçilməyib";

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
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  function openCreateModal() {
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateVisible(false);

    window.setTimeout(() => {
      setCreateOpen(false);
    }, 220);
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
    if (!deleteItem?.id) return;

    setDeleting(true);

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
    await loadItems();
  }

  async function handleEditSaved() {
    await loadItems();
    closeViewModal();
    closeEditModal();
  }

  async function handleCreated() {
    await loadItems();
    closeCreateModal();
  }

  async function handleQrClick(item) {
    if (!item?.id) return;

    if (item.qr_token) {
      openQrModal(item);
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
      .single();

    if (error) {
      console.error("QR CREATE ERROR:", error);
      alert(error.message || "QR yaradılarkən xəta baş verdi.");
      setQrGeneratingId(null);
      return;
    }

    const enriched = enrichItem(data);

    setItems((prev) => prev.map((x) => (x.id === enriched.id ? enriched : x)));
    setViewItem((prev) => (prev?.id === enriched.id ? enriched : prev));
    openQrModal(enriched);
    setQrGeneratingId(null);
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

        <button
          type="button"
          className="inventory-primary-btn"
          onClick={openCreateModal}
        >
          + Yeni inventar
        </button>
      </section>

      <section className="inventory-top-grid">
        <section className="inventory-filter-card">
          <div className="inventory-filter-head">
            <div>
              <h3>Axtarış və multi seçim</h3>
            </div>

            <button type="button" onClick={resetFilters}>
              Sıfırla
            </button>
          </div>

          <div className="inventory-filter-row">
            <input
              placeholder="Kod, ad, model, seriya, şirkət, departament və məsul şəxs üzrə axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button type="button" onClick={loadItems}>
              Yenilə
            </button>
          </div>

          <div className="inventory-date-filter-row">
            <label>
              <span>Yaradılma tarixi - Başlanğıc</span>

              <div className="inventory-date-box">
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                />
                <strong>{formatInputDate(createdFrom) || "gg.aa.iiii"}</strong>
              </div>
            </label>

            <label>
              <span>Yaradılma tarixi - Son</span>

              <div className="inventory-date-box">
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                />
                <strong>{formatInputDate(createdTo) || "gg.aa.iiii"}</strong>
              </div>
            </label>
          </div>

          <div className="inventory-filter-section-title">Statuslar</div>

          <div className="inventory-chip-row">
            {STATUS_OPTIONS.map((item) => {
              const selected = selectedStatuses.includes(item.value);

              return (
                <button
                  key={item.value}
                  type="button"
                  className={`inventory-filter-chip ${selected ? "active" : ""}`}
                  onClick={() =>
                    toggleMultiValue(setSelectedStatuses, item.value)
                  }
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="inventory-filter-section-title">Health score</div>

          <div className="inventory-chip-row">
            {HEALTH_OPTIONS.map((item) => {
              const selected = selectedHealths.includes(item.value);

              return (
                <button
                  key={item.value}
                  type="button"
                  className={`inventory-filter-chip ${selected ? "active" : ""}`}
                  onClick={() =>
                    toggleMultiValue(setSelectedHealths, item.value)
                  }
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="inventory-filter-section-title">Şirkətlər</div>

          <div className="inventory-chip-row inventory-option-chip-row">
            {companyOptions.map((item) => {
              const id = String(item.id);
              const selected = selectedCompanies.includes(id);

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`inventory-filter-chip ${selected ? "active" : ""}`}
                  onClick={() => toggleMultiValue(setSelectedCompanies, id)}
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {item.name}
                </button>
              );
            })}
          </div>

          <div className="inventory-filter-section-title">Kateqoriyalar</div>

          <div className="inventory-chip-row inventory-option-chip-row">
            {categoryOptions.map((item) => {
              const id = String(item.id);
              const selected = selectedCategories.includes(id);

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`inventory-filter-chip ${selected ? "active" : ""}`}
                  onClick={() => toggleMultiValue(setSelectedCategories, id)}
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {item.name}
                </button>
              );
            })}
          </div>
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
                    className={`inventory-company-bar-btn ${
                      active ? "active" : ""
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
                        </div>
                      </td>

                      <td>{item.company?.name || "-"}</td>
                      <td>{item.department?.name || "-"}</td>
                      <td>{item.category?.name || "-"}</td>
                      <td>{item.responsible?.full_name || "-"}</td>

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
                        <button
                          type="button"
                          className={`inventory-qr-btn ${
                            item.qr_token ? "ready" : ""
                          }`}
                          onClick={() => handleQrClick(item)}
                          disabled={qrGeneratingId === item.id}
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
                      <span>Məsul şəxs</span>
                      <strong>{item.responsible?.full_name || "-"}</strong>
                    </div>

                    <div>
                      <span>Zəmanət</span>
                      <strong>{item.warranty_info?.label || "-"}</strong>
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
                      className={`inventory-qr-btn ${
                        item.qr_token ? "ready" : ""
                      }`}
                      onClick={() => handleQrClick(item)}
                      disabled={qrGeneratingId === item.id}
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

      <InventoryViewModal
        mounted={mounted}
        visible={viewVisible}
        item={viewItem}
        qrGeneratingId={qrGeneratingId}
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

function InventoryViewModal({
  mounted,
  visible,
  item,
  qrGeneratingId,
  onClose,
  onEdit,
  onDelete,
  onQr,
}) {
  if (!mounted || !item) return null;

  const warranty = item.warranty_info || warrantyInfo(item);

  return createPortal(
    <div
      className={`inventory-view-root inventory-smooth-root ${
        visible ? "show" : ""
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
              <DetailRow label="Məsul şəxs" value={item.responsible?.full_name} />
              <DetailRow label="Email" value={item.responsible?.email} />
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
              <span>QR</span>
              <strong>{item.qr_token ? "QR hazırdır" : "QR yoxdur"}</strong>
              <button
                type="button"
                className={`inventory-qr-btn ${item.qr_token ? "ready" : ""}`}
                onClick={() => onQr?.(item)}
                disabled={qrGeneratingId === item.id}
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
          <button
            type="button"
            className="inventory-danger-btn"
            onClick={() => onDelete?.(item)}
          >
            Sil
          </button>

          <div>
            <button
              type="button"
              className="inventory-secondary-action-btn"
              onClick={() => onEdit?.(item)}
            >
              Düzəlt
            </button>

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

      if (name === "responsible_user_id" && value) {
        next.status = "ASSIGNED";
      }

      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

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

    const payload = {
      inventory_code: form.inventory_code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,

      company_id: form.company_id || null,
      department_id: form.department_id || null,
      category_id: form.category_id || null,
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
      className={`inventory-edit-root inventory-smooth-root ${
        visible ? "show" : ""
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
              />
            </EditField>

            <EditField label="İnventar adı *" wide>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </EditField>

            <EditField label="Brand">
              <input
                value={form.brand}
                onChange={(e) => setField("brand", e.target.value)}
              />
            </EditField>

            <EditField label="Model">
              <input
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
              />
            </EditField>

            <EditField label="Seriya nömrəsi">
              <input
                value={form.serial_number}
                onChange={(e) => setField("serial_number", e.target.value)}
              />
            </EditField>

            <EditField label="Təsvir" full>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
              />
            </EditField>
          </EditSection>

          <EditSection title="Şirkət və təhkim">
            <EditField label="Şirkət">
              <select
                value={form.company_id}
                onChange={(e) => setField("company_id", e.target.value)}
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
              >
                <option value="">Seçilməyib</option>
                {filteredDepartments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </EditField>

            <EditField label="Kateqoriya">
              <select
                value={form.category_id}
                onChange={(e) => setField("category_id", e.target.value)}
              >
                <option value="">Seçilməyib</option>
                {categories.map((x) => (
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
              />
            </EditField>
          </EditSection>

          <EditSection title="Status, maliyyə və zəmanət">
            <EditField label="Status">
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                disabled={Boolean(form.responsible_user_id)}
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
              />
            </EditField>

            <EditField label="Alış qiyməti">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => setField("purchase_price", e.target.value)}
              />
            </EditField>

            <EditField label="Valyuta">
              <select
                value={form.currency}
                onChange={(e) => setField("currency", e.target.value)}
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
              />
            </EditField>

            <EditField label="Zəmanət bitmə tarixi">
              <input
                type="date"
                value={form.warranty_end_date}
                onChange={(e) => setField("warranty_end_date", e.target.value)}
              />
            </EditField>
          </EditSection>
        </div>

        <footer className="inventory-edit-footer">
          <button type="button" onClick={onClose}>
            Bağla
          </button>

          <button type="submit" className="primary" disabled={saving}>
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
              body {
                padding: 0;
              }

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
      className={`inventory-qr-root inventory-smooth-root ${
        visible ? "show" : ""
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
      className={`inventory-delete-root inventory-smooth-root ${
        visible ? "show" : ""
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
      className={`inventory-edit-field ${wide ? "wide" : ""} ${
        full ? "full" : ""
      }`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}