"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/settings-pages.css";

const STATUS_LABELS = {
  ACTIVE: "Aktiv",
  INACTIVE: "Passiv",
  IN_USE: "İstifadədə",
  AVAILABLE: "Boşda",
  ASSIGNED: "Təhkim olunub",
  REPAIR: "Təmirdə",
  IN_REPAIR: "Təmirdə",
  LOST: "İtib",
  BROKEN: "Xarab",
  RETURNED: "Qaytarılıb",
  WRITTEN_OFF: "Silinib",
  DISPOSED: "İstifadədən çıxarılıb",
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

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

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";

  const num = Number(value);

  if (Number.isNaN(num)) return String(value);

  return new Intl.NumberFormat("az-AZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
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

function getItem(row) {
  return row.inventory_items || row.item || {};
}

function getAssetName(row) {
  const item = getItem(row);

  return (
    item.name ||
    item.title ||
    item.asset_name ||
    item.inventory_name ||
    item.item_name ||
    item.product_name ||
    item.model ||
    "-"
  );
}

function getAssetCode(row) {
  const item = getItem(row);

  return (
    item.code ||
    item.asset_code ||
    item.inventory_code ||
    item.item_code ||
    item.serial_no ||
    item.serial_number ||
    item.barcode ||
    "-"
  );
}

function getSerialNumber(row) {
  const item = getItem(row);
  return item.serial_number || item.serial_no || item.serial || "-";
}

function getAssetStatus(row) {
  const item = getItem(row);

  return (
    row.status ||
    row.assignment_status ||
    item.status ||
    item.inventory_status ||
    item.state ||
    "ASSIGNED"
  );
}

function getAssignedDate(row) {
  return row.assigned_at || row.assigned_date || row.created_at || "";
}

function getCategoryName(row) {
  const item = getItem(row);

  if (item.inventory_categories?.name) return item.inventory_categories.name;
  if (item.category?.name) return item.category.name;
  if (item.categories?.name) return item.categories.name;

  return item.category_name || "-";
}

function getCompanyName(row) {
  const item = getItem(row);

  if (item.companies?.name) return item.companies.name;
  if (item.company?.name) return item.company.name;

  return item.company_name || "-";
}

function getDepartmentName(row) {
  const item = getItem(row);

  if (item.departments?.name) return item.departments.name;
  if (item.department?.name) return item.department.name;

  return item.department_name || "-";
}

function getAssetPrice(row) {
  const item = getItem(row);

  return (
    item.price ||
    item.purchase_price ||
    item.cost ||
    item.amount ||
    item.value ||
    ""
  );
}

function getAssetNote(row) {
  const item = getItem(row);
  return row.note || row.notes || item.note || item.notes || item.description || "-";
}

function uniqRows(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = String(
      row.inventory_id || row.item_id || row.inventory_items?.id || row.id || ""
    );
    if (!key) return;
    map.set(key, row);
  });

  return Array.from(map.values());
}

export default function MyInventoryPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [assignedFrom, setAssignedFrom] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const [sortBy, setSortBy] = useState("assigned_date");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState("");

  useEffect(() => {
    loadMyInventory();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedStatuses,
    selectedCategories,
    selectedCompanies,
    selectedDepartments,
    assignedFrom,
    assignedTo,
    pageSize,
  ]);

  useEffect(() => {
    if (!selectedItem) return;

    const timer = window.setTimeout(() => {
      setModalVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [selectedItem]);

  async function loadMyInventory() {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setMe(null);
        setProfile(null);
        setItems([]);
        setDebugInfo(null);
        return;
      }

      setMe(user);

      let foundProfile = null;

      const profileById = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileById.error) {
        console.warn("PROFILE BY ID ERROR:", profileById.error.message);
      }

      if (profileById.data) {
        foundProfile = profileById.data;
      } else if (user.email) {
        const profileByEmail = await supabase
          .from("profiles")
          .select("*")
          .eq("email", user.email)
          .maybeSingle();

        if (profileByEmail.error) {
          console.warn("PROFILE BY EMAIL ERROR:", profileByEmail.error.message);
        }

        if (profileByEmail.data) {
          foundProfile = profileByEmail.data;
        }
      }

      setProfile(foundProfile);

      const idsToCheck = Array.from(
        new Set([user.id, foundProfile?.id].filter(Boolean).map(String))
      );

      const allAssignments = [];

      for (const id of idsToCheck) {
        const { data, error } = await supabase
          .from("inventory_assignments")
          .select("*")
          .eq("assigned_to", id)
          .is("returned_at", null)
          .order("assigned_at", { ascending: false });

        if (error) throw error;

        (data || []).forEach((row) => allAssignments.push(row));
      }

      const uniqueAssignments = uniqRows(allAssignments);
      const inventoryIds = uniqueAssignments
        .map((row) => row.inventory_id || row.item_id)
        .filter(Boolean);

      if (inventoryIds.length === 0) {
        setItems([]);
        setDebugInfo({
          authUserId: user.id,
          authEmail: user.email || "",
          profileId: foundProfile?.id || "",
          profileEmail: foundProfile?.email || "",
          checkedIds: idsToCheck,
          assignmentRows: uniqueAssignments.length,
          inventoryIds: 0,
          loadedRows: 0,
        });
        return;
      }

      const { data: inventoryItems, error: inventoryError } = await supabase
        .from("inventory_items")
        .select(
          `
          *,
          companies:company_id(id,name),
          departments:department_id(id,name),
          inventory_categories:category_id(id,name)
        `
        )
        .in("id", inventoryIds);

      if (inventoryError) throw inventoryError;

      const itemMap = new Map();

      (inventoryItems || []).forEach((item) => {
        itemMap.set(String(item.id), item);
      });

      const finalRows = uniqueAssignments
        .map((assignment) => {
          const inventoryId = assignment.inventory_id || assignment.item_id;
          const item = itemMap.get(String(inventoryId));

          return {
            ...assignment,
            inventory_items: item || null,
          };
        })
        .filter((row) => row.inventory_items);

      setItems(finalRows);

      setDebugInfo({
        authUserId: user.id,
        authEmail: user.email || "",
        profileId: foundProfile?.id || "",
        profileEmail: foundProfile?.email || "",
        checkedIds: idsToCheck,
        assignmentRows: uniqueAssignments.length,
        inventoryIds: inventoryIds.length,
        loadedRows: finalRows.length,
      });
    } catch (err) {
      console.error("MY INVENTORY LOAD ERROR:", err);
      alert(err?.message || "Mənim inventarlarım yüklənərkən xəta baş verdi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const map = new Map();

    items.forEach((row) => {
      const name = getCategoryName(row);
      if (name && name !== "-") {
        map.set(name, name);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const statuses = useMemo(() => {
    const map = new Map();

    items.forEach((row) => {
      const status = getAssetStatus(row);
      if (status) {
        map.set(status, status);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const companies = useMemo(() => {
    const map = new Map();

    items.forEach((row) => {
      const name = getCompanyName(row);
      if (name && name !== "-") {
        map.set(name, name);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const departments = useMemo(() => {
    const map = new Map();

    items.forEach((row) => {
      const name = getDepartmentName(row);
      if (name && name !== "-") {
        map.set(name, name);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);

    return items.filter((row) => {
      const name = getAssetName(row);
      const code = getAssetCode(row);
      const serial = getSerialNumber(row);
      const categoryName = getCategoryName(row);
      const companyName = getCompanyName(row);
      const departmentName = getDepartmentName(row);
      const status = getAssetStatus(row);

      const matchesSearch =
        !q ||
        normalizeText(name).includes(q) ||
        normalizeText(code).includes(q) ||
        normalizeText(serial).includes(q) ||
        normalizeText(categoryName).includes(q) ||
        normalizeText(companyName).includes(q) ||
        normalizeText(departmentName).includes(q) ||
        normalizeText(statusLabel(status)).includes(q);

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(String(status));

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(String(categoryName));

      const matchesCompany =
        selectedCompanies.length === 0 ||
        selectedCompanies.includes(String(companyName));

      const matchesDepartment =
        selectedDepartments.length === 0 ||
        selectedDepartments.includes(String(departmentName));

      const matchesAssignedDate =
        (!assignedFrom && !assignedTo) ||
        isDateInRange(getAssignedDate(row), assignedFrom, assignedTo);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesCompany &&
        matchesDepartment &&
        matchesAssignedDate
      );
    });
  }, [
    items,
    search,
    selectedStatuses,
    selectedCategories,
    selectedCompanies,
    selectedDepartments,
    assignedFrom,
    assignedTo,
  ]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((a, b) => {
      let aValue = "";
      let bValue = "";

      if (sortBy === "asset") {
        aValue = getAssetName(a);
        bValue = getAssetName(b);
      }

      if (sortBy === "code") {
        aValue = getAssetCode(a);
        bValue = getAssetCode(b);
      }

      if (sortBy === "serial") {
        aValue = getSerialNumber(a);
        bValue = getSerialNumber(b);
      }

      if (sortBy === "category") {
        aValue = getCategoryName(a);
        bValue = getCategoryName(b);
      }

      if (sortBy === "company") {
        aValue = getCompanyName(a);
        bValue = getCompanyName(b);
      }

      if (sortBy === "department") {
        aValue = getDepartmentName(a);
        bValue = getDepartmentName(b);
      }

      if (sortBy === "status") {
        aValue = statusLabel(getAssetStatus(a));
        bValue = statusLabel(getAssetStatus(b));
      }

      if (sortBy === "assigned_date") {
        aValue = getAssignedDate(a);
        bValue = getAssignedDate(b);
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
    const assigned = items.filter(
      (x) => getAssetStatus(x) === "ASSIGNED" || getAssetStatus(x) === "ACTIVE"
    ).length;
    const inUse = items.filter((x) => getAssetStatus(x) === "IN_USE").length;
    const repair = items.filter(
      (x) => getAssetStatus(x) === "REPAIR" || getAssetStatus(x) === "IN_REPAIR"
    ).length;

    return {
      total: items.length,
      shown: filteredItems.length,
      assigned,
      inUse,
      repair,
      categories,
      assignedPercent: items.length
        ? Math.round((assigned / items.length) * 100)
        : 0,
      inUsePercent: items.length ? Math.round((inUse / items.length) * 100) : 0,
      repairPercent: items.length ? Math.round((repair / items.length) * 100) : 0,
    };
  }, [items, filteredItems, categories]);

  const categoryAnalytics = useMemo(() => {
    const map = new Map();

    items.forEach((row) => {
      const category = getCategoryName(row);
      const status = getAssetStatus(row);
      const company = getCompanyName(row);

      if (!map.has(category)) {
        map.set(category, {
          name: category,
          total: 0,
          assigned: 0,
          inUse: 0,
          repair: 0,
          companies: new Map(),
        });
      }

      const item = map.get(category);
      item.total += 1;

      if (status === "ASSIGNED" || status === "ACTIVE") item.assigned += 1;
      if (status === "IN_USE") item.inUse += 1;
      if (status === "REPAIR" || status === "IN_REPAIR") item.repair += 1;

      if (!item.companies.has(company)) {
        item.companies.set(company, {
          name: company,
          total: 0,
        });
      }

      item.companies.get(company).total += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        companies: Array.from(item.companies.values()).sort(
          (a, b) => b.total - a.total
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const activeCategory = useMemo(() => {
    if (!expandedCategory) return categoryAnalytics[0] || null;

    return (
      categoryAnalytics.find((item) => item.name === expandedCategory) ||
      categoryAnalytics[0] ||
      null
    );
  }, [categoryAnalytics, expandedCategory]);

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
    setSelectedCategories([]);
    setSelectedCompanies([]);
    setSelectedDepartments([]);
    setAssignedFrom("");
    setAssignedTo("");
    setSortBy("assigned_date");
    setSortDir("desc");
    setPage(1);
  }

  function openViewModal(row) {
    setSelectedItem(row);
  }

  function closeViewModal() {
    setModalVisible(false);

    window.setTimeout(() => {
      setSelectedItem(null);
    }, 220);
  }

  return (
    <section className="settings-page">
      <div className="settings-hero my-inventory-hero-modern">
        <div>
          <h1>Mənim inventarlarım</h1>
          <p>
            Sizə təhkim olunmuş inventarları, statusları və detalları izləyin.
          </p>
        </div>

        <button
          type="button"
          className="settings-primary-btn"
          onClick={loadMyInventory}
        >
          Yenilə
        </button>
      </div>

      <section className="my-inventory-top-grid">
        <div className="my-inventory-filter-card">
          <div className="my-inventory-filter-head">
            <div>
              <h3>Axtarış və multi seçim</h3>
            </div>

            <button type="button" onClick={resetFilters}>
              Sıfırla
            </button>
          </div>

          <div className="my-inventory-filter-row">
            <input
              placeholder="Ad, kod, serial, kateqoriya, şirkət və ya departamentə görə axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button type="button" onClick={loadMyInventory}>
              Yenilə
            </button>
          </div>

          <div className="my-inventory-date-filter-row">
            <label>
              <span>Təhkim tarixi - Başlanğıc</span>

              <div className="my-inventory-date-box">
                <input
                  type="date"
                  value={assignedFrom}
                  onChange={(e) => setAssignedFrom(e.target.value)}
                />
                <strong>{formatInputDate(assignedFrom) || "gg.aa.iiii"}</strong>
              </div>
            </label>

            <label>
              <span>Təhkim tarixi - Son</span>

              <div className="my-inventory-date-box">
                <input
                  type="date"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
                <strong>{formatInputDate(assignedTo) || "gg.aa.iiii"}</strong>
              </div>
            </label>
          </div>

          <div className="my-inventory-filter-section-title">Statuslar</div>

          <div className="my-inventory-chip-row">
            {statuses.map((status) => {
              const selected = selectedStatuses.includes(String(status));

              return (
                <button
                  key={status}
                  type="button"
                  className={`my-inventory-filter-chip ${
                    selected ? "active" : ""
                  }`}
                  onClick={() =>
                    toggleMultiValue(setSelectedStatuses, String(status))
                  }
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {statusLabel(status)}
                </button>
              );
            })}
          </div>

          <div className="my-inventory-filter-section-title">Kateqoriyalar</div>

          <div className="my-inventory-chip-row my-inventory-option-chip-row">
            {categories.map((category) => {
              const selected = selectedCategories.includes(String(category));

              return (
                <button
                  key={category}
                  type="button"
                  className={`my-inventory-filter-chip ${
                    selected ? "active" : ""
                  }`}
                  onClick={() =>
                    toggleMultiValue(setSelectedCategories, String(category))
                  }
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {category}
                </button>
              );
            })}
          </div>

          <div className="my-inventory-filter-section-title">Şirkətlər</div>

          <div className="my-inventory-chip-row my-inventory-option-chip-row">
            {companies.map((company) => {
              const selected = selectedCompanies.includes(String(company));

              return (
                <button
                  key={company}
                  type="button"
                  className={`my-inventory-filter-chip ${
                    selected ? "active" : ""
                  }`}
                  onClick={() =>
                    toggleMultiValue(setSelectedCompanies, String(company))
                  }
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {company}
                </button>
              );
            })}
          </div>

          <div className="my-inventory-filter-section-title">Departamentlər</div>

          <div className="my-inventory-chip-row my-inventory-option-chip-row">
            {departments.map((department) => {
              const selected = selectedDepartments.includes(String(department));

              return (
                <button
                  key={department}
                  type="button"
                  className={`my-inventory-filter-chip ${
                    selected ? "active" : ""
                  }`}
                  onClick={() =>
                    toggleMultiValue(setSelectedDepartments, String(department))
                  }
                >
                  <span>{selected ? "✓" : "+"}</span>
                  {department}
                </button>
              );
            })}
          </div>
        </div>

        <div className="my-inventory-chart-card">
          <div className="my-inventory-chart-head">
            <h3>Mənim status paylanmam</h3>
          </div>

          <div
            className="my-inventory-donut"
            style={{
              "--assigned": `${summary.assignedPercent * 3.6}deg`,
              "--use": `${summary.inUsePercent * 3.6}deg`,
            }}
          >
            <div className="my-inventory-donut-inner">
              <strong>{summary.assignedPercent}%</strong>
              <span>Təhkim</span>
            </div>
          </div>

          <div className="my-inventory-chart-bars">
            <div>
              <div className="my-inventory-bar-label">
                <span>Təhkim olunub</span>
                <strong>{summary.assigned}</strong>
              </div>

              <div className="my-inventory-bar-track">
                <span
                  className="my-inventory-bar-fill assigned"
                  style={{ width: `${summary.assignedPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="my-inventory-bar-label">
                <span>İstifadədə</span>
                <strong>{summary.inUse}</strong>
              </div>

              <div className="my-inventory-bar-track">
                <span
                  className="my-inventory-bar-fill use"
                  style={{ width: `${summary.inUsePercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="my-inventory-bar-label">
                <span>Təmirdə</span>
                <strong>{summary.repair}</strong>
              </div>

              <div className="my-inventory-bar-track">
                <span
                  className="my-inventory-bar-fill repair"
                  style={{ width: `${summary.repairPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="my-inventory-floating-stats">
            <div>
              <span>Göstərilən</span>
              <strong>{summary.shown}</strong>
            </div>

            <div>
              <span>Ümumi</span>
              <strong>{summary.total}</strong>
            </div>
          </div>
        </div>

        <div className="my-inventory-category-chart-card">
          <div className="my-inventory-chart-head">
            <h3>Kateqoriya radar görünüşü</h3>
          </div>

          <div className="my-inventory-category-bars">
            {categoryAnalytics.length === 0 ? (
              <div className="my-inventory-empty-chart">
                Kateqoriya analizi üçün məlumat yoxdur.
              </div>
            ) : (
              categoryAnalytics.map((category) => {
                const percent = summary.total
                  ? Math.round((category.total / summary.total) * 100)
                  : 0;

                const selected = activeCategory?.name === category.name;

                return (
                  <button
                    key={category.name}
                    type="button"
                    className={`my-inventory-category-bar-btn ${
                      selected ? "active" : ""
                    }`}
                    onClick={() => setExpandedCategory(category.name)}
                  >
                    <div className="my-inventory-category-bar-top">
                      <span>{category.name}</span>
                      <strong>{category.total}</strong>
                    </div>

                    <div className="my-inventory-category-track">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {activeCategory && (
            <div className="my-inventory-category-details">
              <div className="my-inventory-category-details-head">
                <div>
                  <span>Detallı baxış</span>
                  <strong>{activeCategory.name}</strong>
                </div>

                <b>{activeCategory.total}</b>
              </div>

              <div className="my-inventory-category-mini-grid">
                <div>
                  <span>Təhkim</span>
                  <strong>{activeCategory.assigned}</strong>
                </div>

                <div>
                  <span>İstifadədə</span>
                  <strong>{activeCategory.inUse}</strong>
                </div>

                <div>
                  <span>Təmirdə</span>
                  <strong>{activeCategory.repair}</strong>
                </div>
              </div>

              <div className="my-inventory-category-company-list">
                <span>Şirkət bölgüsü</span>

                {activeCategory.companies.slice(0, 5).map((company) => (
                  <div key={company.name}>
                    <strong>{company.name}</strong>
                    <b>{company.total}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="settings-summary my-inventory-summary-modern">
        <div>
          <span>Göstərilən</span>
          <strong>{loading ? "..." : summary.shown}</strong>
        </div>

        <div>
          <span>Mənə təhkim olunan</span>
          <strong>{loading ? "..." : summary.total}</strong>
        </div>

        <div>
          <span>Təhkim olunub</span>
          <strong>{loading ? "..." : summary.assigned}</strong>
        </div>

        <div>
          <span>İstifadədə</span>
          <strong>{loading ? "..." : summary.inUse}</strong>
        </div>

        <div>
          <span>Kateqoriya sayı</span>
          <strong>{loading ? "..." : summary.categories.length}</strong>
        </div>
      </div>

      <div className="settings-table-card">
        {loading ? (
          <div className="settings-empty">Mənim inventarlarım yüklənir...</div>
        ) : !me ? (
          <div className="settings-empty">
            <strong>Giriş edilməyib</strong>
            <p>İnventarları görmək üçün sistemə daxil olmaq lazımdır.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="settings-empty">
            <strong>İnventar tapılmadı</strong>
            <p>
              Bu istifadəçi üçün aktiv təhkim tapılmadı və ya inventory_id
              inventory_items.id ilə uyğun gəlmir.
            </p>
          </div>
        ) : (
          <>
            <div className="settings-table-wrap">
              <table className="settings-table my-inventory-sort-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" onClick={() => toggleSort("asset")}>
                        İnventar <span>{sortIcon("asset")}</span>
                      </button>
                    </th>

                    <th>
                      <button type="button" onClick={() => toggleSort("code")}>
                        Kod <span>{sortIcon("code")}</span>
                      </button>
                    </th>

                    <th>
                      <button type="button" onClick={() => toggleSort("serial")}>
                        Serial <span>{sortIcon("serial")}</span>
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => toggleSort("category")}
                      >
                        Kateqoriya <span>{sortIcon("category")}</span>
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
                      <button type="button" onClick={() => toggleSort("status")}>
                        Status <span>{sortIcon("status")}</span>
                      </button>
                    </th>

                    <th>
                      <button
                        type="button"
                        onClick={() => toggleSort("assigned_date")}
                      >
                        Təhkim tarixi <span>{sortIcon("assigned_date")}</span>
                      </button>
                    </th>

                    <th>Əməliyyatlar</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="my-inventory-name-cell">
                          <div className="my-inventory-avatar">
                            {(getAssetName(row) || "İ").slice(0, 1).toUpperCase()}
                          </div>

                          <strong className="settings-name">
                            {getAssetName(row)}
                          </strong>
                        </div>
                      </td>

                      <td>{getAssetCode(row)}</td>
                      <td>{getSerialNumber(row)}</td>
                      <td>{getCategoryName(row)}</td>
                      <td>{getCompanyName(row)}</td>
                      <td>{getDepartmentName(row)}</td>

                      <td>
                        <InventoryStatusPill status={getAssetStatus(row)} />
                      </td>

                      <td>{formatDate(getAssignedDate(row))}</td>

                      <td>
                        <div className="settings-actions">
                          <button type="button" onClick={() => openViewModal(row)}>
                            Bax
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="settings-mobile-list">
              {paginatedItems.map((row) => (
                <article className="settings-mobile-card" key={row.id}>
                  <div className="settings-mobile-top">
                    <div>
                      <span>İnventar</span>
                      <h3>{getAssetName(row)}</h3>
                    </div>

                    <InventoryStatusPill status={getAssetStatus(row)} />
                  </div>

                  <div className="settings-mobile-grid">
                    <div>
                      <span>Kod</span>
                      <strong>{getAssetCode(row)}</strong>
                    </div>

                    <div>
                      <span>Serial</span>
                      <strong>{getSerialNumber(row)}</strong>
                    </div>

                    <div>
                      <span>Kateqoriya</span>
                      <strong>{getCategoryName(row)}</strong>
                    </div>

                    <div>
                      <span>Şirkət</span>
                      <strong>{getCompanyName(row)}</strong>
                    </div>

                    <div>
                      <span>Departament</span>
                      <strong>{getDepartmentName(row)}</strong>
                    </div>
                  </div>

                  <div className="settings-mobile-actions">
                    <button type="button" onClick={() => openViewModal(row)}>
                      Bax
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="my-inventory-pagination">
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

              <div className="my-inventory-page-buttons">
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

      <InventoryViewModal
        item={selectedItem}
        visible={modalVisible}
        onClose={closeViewModal}
      />
    </section>
  );
}

function InventoryStatusPill({ status }) {
  const normalized = status || "ASSIGNED";

  return (
    <span className={`settings-status status-${normalized}`}>
      {statusLabel(normalized)}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="my-inventory-modal-detail-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function InventoryViewModal({ item, visible, onClose }) {
  if (!item) return null;

  const assetName = getAssetName(item);
  const assetCode = getAssetCode(item);
  const serial = getSerialNumber(item);
  const category = getCategoryName(item);
  const company = getCompanyName(item);
  const department = getDepartmentName(item);
  const status = getAssetStatus(item);
  const assignedDate = getAssignedDate(item);
  const price = getAssetPrice(item);
  const note = getAssetNote(item);

  return (
    <div
      className={`my-inventory-view-root smooth-modal-root ${
        visible ? "show" : ""
      }`}
    >
      <button
        type="button"
        className="my-inventory-view-backdrop smooth-modal-backdrop"
        onClick={onClose}
        aria-label="Bağla"
      />

      <section className="my-inventory-view-modal smooth-modal-card">
        <header className="my-inventory-view-head">
          <div className="my-inventory-view-title">
            <div className="my-inventory-view-avatar">
              {(assetName || "İ").slice(0, 1).toUpperCase()}
            </div>

            <div>
              <span>Inventory details</span>
              <h2>{assetName}</h2>
              <p>{assetCode}</p>
            </div>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="my-inventory-view-body">
          <main className="my-inventory-view-main">
            <section className="my-inventory-view-section">
              <div className="my-inventory-view-section-head">
                <span>01</span>
                <h3>Əsas məlumatlar</h3>
              </div>

              <div className="my-inventory-view-grid">
                <DetailRow label="İnventar adı" value={assetName} />
                <DetailRow label="Kod" value={assetCode} />
                <DetailRow label="Serial" value={serial} />
                <DetailRow label="Kateqoriya" value={category} />
              </div>
            </section>

            <section className="my-inventory-view-section">
              <div className="my-inventory-view-section-head">
                <span>02</span>
                <h3>Şirkət və təhkim</h3>
              </div>

              <div className="my-inventory-view-grid">
                <DetailRow label="Şirkət" value={company} />
                <DetailRow label="Departament" value={department} />
                <DetailRow label="Status" value={statusLabel(status)} />
                <DetailRow
                  label="Təhkim tarixi"
                  value={formatDate(assignedDate)}
                />
              </div>
            </section>

            <section className="my-inventory-view-section">
              <div className="my-inventory-view-section-head">
                <span>03</span>
                <h3>Qeyd</h3>
              </div>

              <div className="my-inventory-view-note">
                {note && note !== "-" ? note : "Bu inventar üçün qeyd yoxdur."}
              </div>
            </section>
          </main>

          <aside className="my-inventory-view-side">
            <div className="my-inventory-view-side-card primary">
              <span>Status</span>
              <InventoryStatusPill status={status} />
            </div>

            <div className="my-inventory-view-side-card">
              <span>Qiymət</span>
              <strong>{formatMoney(price)}</strong>
            </div>

            <div className="my-inventory-view-side-card">
              <span>Təhkim tarixi</span>
              <strong>{formatDate(assignedDate)}</strong>
            </div>

            <div className="my-inventory-view-side-card accent">
              <span>Şirkət</span>
              <strong>{company}</strong>
              <p>{department}</p>
            </div>
          </aside>
        </div>

        <footer className="my-inventory-view-footer">
          <button type="button" onClick={onClose}>
            Bağla
          </button>
        </footer>
      </section>
    </div>
  );
}