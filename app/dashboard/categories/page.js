"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/categories.css";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Passiv" },
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

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getStatusLabel(status) {
  return status === "ACTIVE" ? "Aktiv" : "Passiv";
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

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

function normalizePermissionKeys(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasPermission(permissionKeys, key) {
  return normalizePermissionKeys(permissionKeys).includes(key);
}

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [permissionKeys, setPermissionKeys] = useState([]);

  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteCategory, setDeleteCategory] = useState(null);

  const [form, setForm] = useState({
    name: "",
    status: "ACTIVE",
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canView = hasPermission(permissionKeys, "categories.view");
  const canCreate = hasPermission(permissionKeys, "categories.create");
  const canEdit = hasPermission(permissionKeys, "categories.edit");
  const canDelete = hasPermission(permissionKeys, "categories.delete");

  useEffect(() => {
    bootPage();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, selectedStatuses, createdFrom, createdTo, pageSize]);

  useEffect(() => {
    if (!modalOpen) return;

    const timer = window.setTimeout(() => {
      setModalVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [modalOpen]);

  async function bootPage() {
    await loadPermissionsAndCategories();
  }

  async function loadPermissionsAndCategories() {
    setPermissionLoading(true);
    setPermissionError("");

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/me/permissions", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(json?.error || "Permission məlumatı alınmadı.");
      }

      const keys = normalizePermissionKeys(json.permissionKeys);
      setPermissionKeys(keys);

      if (!hasPermission(keys, "categories.view")) {
        setLoading(false);
        return;
      }

      await loadCategories();
    } catch (err) {
      console.error("CATEGORIES_PERMISSION_ERROR:", err);
      setPermissionError(err?.message || "Permission məlumatı alınmadı.");
      setLoading(false);
    } finally {
      setPermissionLoading(false);
    }
  }

  async function loadCategories() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventory_categories")
      .select("id,name,status,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("CATEGORIES LOAD ERROR:", error);
      setCategories([]);
      setLoading(false);
      return;
    }

    setCategories(data || []);
    setLoading(false);
  }

  const filteredCategories = useMemo(() => {
    const q = normalizeText(search);

    return categories.filter((category) => {
      const matchesSearch =
        !q ||
        normalizeText(category.name).includes(q) ||
        normalizeText(getStatusLabel(category.status)).includes(q);

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(category.status);

      const matchesCreatedDate =
        (!createdFrom && !createdTo) ||
        isDateInRange(category.created_at, createdFrom, createdTo);

      return matchesSearch && matchesStatus && matchesCreatedDate;
    });
  }, [categories, search, selectedStatuses, createdFrom, createdTo]);

  const sortedCategories = useMemo(() => {
    const list = [...filteredCategories];

    list.sort((a, b) => {
      let aValue = a?.[sortBy];
      let bValue = b?.[sortBy];

      if (sortBy === "status") {
        aValue = getStatusLabel(a.status);
        bValue = getStatusLabel(b.status);
      }

      return compareValues(aValue, bValue, sortDir);
    });

    return list;
  }, [filteredCategories, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / pageSize));

  const paginatedCategories = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedCategories.slice(start, start + pageSize);
  }, [sortedCategories, page, pageSize, totalPages]);

  const summary = useMemo(() => {
    const active = categories.filter((x) => x.status === "ACTIVE").length;
    const inactive = categories.filter((x) => x.status === "INACTIVE").length;

    return {
      total: categories.length,
      active,
      inactive,
      shown: filteredCategories.length,
      activePercent: categories.length
        ? Math.round((active / categories.length) * 100)
        : 0,
      inactivePercent: categories.length
        ? Math.round((inactive / categories.length) * 100)
        : 0,
    };
  }, [categories, filteredCategories]);

  const hasRowActions = canEdit || canDelete;

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

  function toggleStatus(status) {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((x) => x !== status);
      }

      return [...prev, status];
    });
  }

  function openCreateModal() {
    if (!canCreate) {
      alert("Yeni kateqoriya əlavə etmək üçün categories.create icazəsi lazımdır.");
      return;
    }

    setEditingCategory(null);
    setForm({
      name: "",
      status: "ACTIVE",
    });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(category) {
    if (!canEdit) {
      alert("Kateqoriyanı düzəltmək üçün categories.edit icazəsi lazımdır.");
      return;
    }

    setEditingCategory(category);
    setForm({
      name: category.name || "",
      status: category.status || "ACTIVE",
    });
    setError("");
    setModalOpen(true);
  }

  function openDeleteModal(category) {
    if (!canDelete) {
      alert("Kateqoriyanı silmək üçün categories.delete icazəsi lazımdır.");
      return;
    }

    setDeleteCategory(category);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);

    window.setTimeout(() => {
      setModalOpen(false);
      setEditingCategory(null);
      setError("");
    }, 220);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (editingCategory?.id && !canEdit) {
      setError("Bu əməliyyat üçün categories.edit icazəsi lazımdır.");
      return;
    }

    if (!editingCategory?.id && !canCreate) {
      setError("Bu əməliyyat üçün categories.create icazəsi lazımdır.");
      return;
    }

    const name = form.name.trim();

    if (!name) {
      setError("Kateqoriya adı məcburidir.");
      return;
    }

    setSaving(true);
    setError("");

    if (editingCategory?.id) {
      const { error } = await supabase
        .from("inventory_categories")
        .update({
          name,
          status: form.status,
        })
        .eq("id", editingCategory.id);

      if (error) {
        console.error("CATEGORY UPDATE ERROR:", error);
        setError(error.message || "Kateqoriya yenilənərkən xəta baş verdi.");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("inventory_categories").insert({
        name,
        status: form.status,
      });

      if (error) {
        console.error("CATEGORY INSERT ERROR:", error);
        setError(error.message || "Kateqoriya əlavə edilərkən xəta baş verdi.");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeModal();
    await loadCategories();
  }

  async function handleDeleteConfirm() {
    if (!deleteCategory?.id) return;

    if (!canDelete) {
      alert("Bu əməliyyat üçün categories.delete icazəsi lazımdır.");
      return;
    }

    setDeleting(true);

    const { error } = await supabase
      .from("inventory_categories")
      .delete()
      .eq("id", deleteCategory.id);

    if (error) {
      console.error("CATEGORY DELETE ERROR:", error);
      alert(
        error.message ||
          "Kateqoriya silinərkən xəta baş verdi. Bu kateqoriya inventarlara bağlı ola bilər."
      );
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteCategory(null);
    await loadCategories();
  }

  function resetFilters() {
    setSearch("");
    setSelectedStatuses([]);
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  if (permissionLoading || loading) {
    return (
      <section className="settings-page">
        <div className="settings-empty">Kateqoriyalar yüklənir...</div>
      </section>
    );
  }

  if (permissionError) {
    return (
      <section className="settings-page">
        <div className="settings-empty">
          <strong>Permission xətası</strong>
          <p>{permissionError}</p>
          <button type="button" onClick={loadPermissionsAndCategories}>
            Yenidən yoxla
          </button>
        </div>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="settings-page">
        <div className="settings-empty">
          <strong>Giriş icazəsi yoxdur</strong>
          <p>
            Bu səhifəyə baxmaq üçün <b>categories.view</b> icazəsi lazımdır.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-page">
      <div className="settings-hero categories-hero-modern">
        <div>
          <h1>Kateqoriyalar</h1>
          <p>
            İnventarların qruplaşdırılması üçün kateqoriyaları filterlə, sırala
            və ümumi vəziyyəti analiz et.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="settings-primary-btn"
            onClick={openCreateModal}
          >
            + Yeni kateqoriya
          </button>
        )}
      </div>

      <div className="categories-modern-grid">
        <div className="categories-main-panel">
          <div className="categories-filter-card">
            <div className="categories-filter-head">
              <div>
                <h3>Axtarış və multi seçim</h3>
              </div>

              <button type="button" onClick={resetFilters}>
                Sıfırla
              </button>
            </div>

            <div className="categories-filter-row">
              <input
                placeholder="Kateqoriya adına və ya statusa görə axtar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button type="button" onClick={loadCategories}>
                Yenilə
              </button>
            </div>

            <div className="categories-date-filter-row">
              <label>
                <span>Yaradılma tarixi - Başlanğıc</span>

                <div className="categories-date-box">
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

                <div className="categories-date-box">
                  <input
                    type="date"
                    value={createdTo}
                    onChange={(e) => setCreatedTo(e.target.value)}
                  />
                  <strong>{formatInputDate(createdTo) || "gg.aa.iiii"}</strong>
                </div>
              </label>
            </div>

            <div className="categories-filter-section-title">Statuslar</div>

            <div className="categories-chip-row">
              {STATUS_OPTIONS.map((status) => {
                const selected = selectedStatuses.includes(status.value);

                return (
                  <button
                    key={status.value}
                    type="button"
                    className={`categories-filter-chip ${
                      selected ? "active" : ""
                    }`}
                    onClick={() => toggleStatus(status.value)}
                  >
                    <span>{selected ? "✓" : "+"}</span>
                    {status.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-summary categories-summary-modern">
            <div>
              <span>Göstərilən</span>
              <strong>{summary.shown}</strong>
            </div>

            <div>
              <span>Ümumi</span>
              <strong>{summary.total}</strong>
            </div>

            <div>
              <span>Aktiv</span>
              <strong>{summary.active}</strong>
            </div>

            <div>
              <span>Passiv</span>
              <strong>{summary.inactive}</strong>
            </div>
          </div>

          <div className="settings-table-card">
            {filteredCategories.length === 0 ? (
              <div className="settings-empty">
                <strong>Kateqoriya tapılmadı</strong>
                <p>Hazırda bu filterlərə uyğun kateqoriya yoxdur.</p>
              </div>
            ) : (
              <>
                <div className="settings-table-wrap">
                  <table className="settings-table categories-sort-table">
                    <thead>
                      <tr>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort("name")}
                          >
                            Kateqoriya adı <span>{sortIcon("name")}</span>
                          </button>
                        </th>

                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort("status")}
                          >
                            Status <span>{sortIcon("status")}</span>
                          </button>
                        </th>

                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort("created_at")}
                          >
                            Yaradılma tarixi{" "}
                            <span>{sortIcon("created_at")}</span>
                          </button>
                        </th>

                        {hasRowActions && <th>Əməliyyatlar</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedCategories.map((category) => (
                        <tr key={category.id}>
                          <td>
                            <div className="category-name-cell">
                              <div className="category-avatar">
                                {(category.name || "K")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong className="settings-name">
                                  {category.name}
                                </strong>
                              </div>
                            </div>
                          </td>

                          <td>
                            <StatusPill status={category.status} />
                          </td>

                          <td>{formatDate(category.created_at)}</td>

                          {hasRowActions && (
                            <td>
                              <div className="settings-actions">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(category)}
                                  >
                                    Düzəlt
                                  </button>
                                )}

                                {canDelete && (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => openDeleteModal(category)}
                                  >
                                    Sil
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="settings-mobile-list">
                  {paginatedCategories.map((category) => (
                    <article className="settings-mobile-card" key={category.id}>
                      <div className="settings-mobile-top">
                        <div>
                          <span>Kateqoriya</span>
                          <h3>{category.name}</h3>
                        </div>

                        <StatusPill status={category.status} />
                      </div>

                      <div className="settings-mobile-grid">
                        <div>
                          <span>Yaradılma tarixi</span>
                          <strong>{formatDate(category.created_at)}</strong>
                        </div>
                      </div>

                      {hasRowActions && (
                        <div className="settings-mobile-actions">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(category)}
                            >
                              Düzəlt
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => openDeleteModal(category)}
                            >
                              Sil
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div className="categories-pagination">
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

                  <div className="categories-page-buttons">
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
        </div>

        <aside className="categories-chart-panel">
          <div className="categories-chart-card">
            <div className="categories-chart-head">
              <h3>Kateqoriya status paylanması</h3>
            </div>

            <div
              className="categories-donut"
              style={{
                "--active": `${summary.activePercent * 3.6}deg`,
              }}
            >
              <div className="categories-donut-inner">
                <strong>{summary.activePercent}%</strong>
                <span>Aktiv</span>
              </div>
            </div>

            <div className="categories-chart-bars">
              <div>
                <div className="categories-bar-label">
                  <span>Aktiv</span>
                  <strong>{summary.active}</strong>
                </div>

                <div className="categories-bar-track">
                  <span
                    className="categories-bar-fill active"
                    style={{ width: `${summary.activePercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="categories-bar-label">
                  <span>Passiv</span>
                  <strong>{summary.inactive}</strong>
                </div>

                <div className="categories-bar-track">
                  <span
                    className="categories-bar-fill inactive"
                    style={{ width: `${summary.inactivePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="categories-floating-stats">
              <div>
                <span>Filter nəticəsi</span>
                <strong>{summary.shown}</strong>
              </div>

              <div>
                <span>Ümumi baza</span>
                <strong>{summary.total}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {(canCreate || canEdit) && (
        <CategoryModal
          open={modalOpen}
          visible={modalVisible}
          editingCategory={editingCategory}
          form={form}
          setForm={setForm}
          saving={saving}
          error={error}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {canDelete && (
        <DeleteConfirmModal
          item={deleteCategory}
          title="Kateqoriya silinsin?"
          text="kateqoriyasını silmək üzrəsən. Bu kateqoriya inventarlara bağlıdırsa silinməyə bilər."
          deleting={deleting}
          onClose={() => {
            if (!deleting) setDeleteCategory(null);
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </section>
  );
}

function CategoryModal({
  open,
  visible,
  editingCategory,
  form,
  setForm,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div
      className={`settings-modal-root smooth-modal-root ${
        visible ? "show" : ""
      }`}
    >
      <button
        type="button"
        className="settings-modal-backdrop smooth-modal-backdrop"
        onClick={onClose}
        aria-label="Bağla"
      />

      <form className="settings-modal smooth-modal-card" onSubmit={onSubmit}>
        <header className="settings-modal-head">
          <div>
            <h2>
              {editingCategory ? "Kateqoriyanı düzəlt" : "Yeni kateqoriya"}
            </h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-modal-body">
          <label className="settings-field">
            <span>Kateqoriya adı *</span>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="Məs: Laptop, Printer, Telefon"
              required
            />
          </label>

          <label className="settings-field">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value,
                }))
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <footer className="settings-modal-footer">
          <button type="button" onClick={onClose} disabled={saving}>
            Bağla
          </button>

          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`settings-status status-${status || "INACTIVE"}`}>
      {status === "ACTIVE" ? "Aktiv" : "Passiv"}
    </span>
  );
}

function DeleteConfirmModal({
  item,
  title,
  text,
  deleting,
  onClose,
  onConfirm,
}) {
  if (!item) return null;

  return (
    <div className="settings-delete-root">
      <button
        type="button"
        className="settings-delete-backdrop"
        onClick={onClose}
        disabled={deleting}
        aria-label="Bağla"
      />

      <section className="settings-delete-modal">
        <div className="settings-delete-icon">!</div>
        <h3>{title}</h3>
        <p>
          <strong>{item.name || "-"}</strong> {text}
        </p>

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
    </div>
  );
}