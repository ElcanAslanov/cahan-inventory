"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import "@/styles/companies.css";

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

export default function CompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [permissionKeys, setPermissionKeys] = useState([]);

  const [companies, setCompanies] = useState([]);

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
  const [editingCompany, setEditingCompany] = useState(null);
  const [deleteCompany, setDeleteCompany] = useState(null);

  const [form, setForm] = useState({
    name: "",
    status: "ACTIVE",
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canView = hasPermission(permissionKeys, "companies.view");
  const canCreate = hasPermission(permissionKeys, "companies.create");
  const canEdit = hasPermission(permissionKeys, "companies.edit");
  const canDelete = hasPermission(permissionKeys, "companies.delete");

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
    await loadPermissionsAndCompanies();
  }

  async function loadPermissionsAndCompanies() {
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

      if (!hasPermission(keys, "companies.view")) {
        setLoading(false);
        return;
      }

      await loadCompanies();
    } catch (err) {
      console.error("COMPANIES_PERMISSION_ERROR:", err);
      setPermissionError(err?.message || "Permission məlumatı alınmadı.");
      setLoading(false);
    } finally {
      setPermissionLoading(false);
    }
  }

  async function loadCompanies() {
    setLoading(true);

    const { data, error } = await supabase
      .from("companies")
      .select("id,name,status,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("COMPANIES LOAD ERROR:", error);
      setCompanies([]);
      setLoading(false);
      return;
    }

    setCompanies(data || []);
    setLoading(false);
  }

  const filteredCompanies = useMemo(() => {
    const q = normalizeText(search);

    return companies.filter((company) => {
      const matchesSearch =
        !q ||
        normalizeText(company.name).includes(q) ||
        normalizeText(getStatusLabel(company.status)).includes(q);

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(company.status);

      const matchesCreatedDate =
        (!createdFrom && !createdTo) ||
        isDateInRange(company.created_at, createdFrom, createdTo);

      return matchesSearch && matchesStatus && matchesCreatedDate;
    });
  }, [companies, search, selectedStatuses, createdFrom, createdTo]);

  const sortedCompanies = useMemo(() => {
    const list = [...filteredCompanies];

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
  }, [filteredCompanies, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedCompanies.length / pageSize));

  const paginatedCompanies = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedCompanies.slice(start, start + pageSize);
  }, [sortedCompanies, page, pageSize, totalPages]);

  const summary = useMemo(() => {
    const active = companies.filter((x) => x.status === "ACTIVE").length;
    const inactive = companies.filter((x) => x.status === "INACTIVE").length;

    return {
      total: companies.length,
      active,
      inactive,
      shown: filteredCompanies.length,
      activePercent: companies.length
        ? Math.round((active / companies.length) * 100)
        : 0,
      inactivePercent: companies.length
        ? Math.round((inactive / companies.length) * 100)
        : 0,
    };
  }, [companies, filteredCompanies]);

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
      alert("Yeni şirkət əlavə etmək üçün companies.create icazəsi lazımdır.");
      return;
    }

    setEditingCompany(null);
    setForm({
      name: "",
      status: "ACTIVE",
    });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(company) {
    if (!canEdit) {
      alert("Şirkəti düzəltmək üçün companies.edit icazəsi lazımdır.");
      return;
    }

    setEditingCompany(company);
    setForm({
      name: company.name || "",
      status: company.status || "ACTIVE",
    });
    setError("");
    setModalOpen(true);
  }

  function openDeleteModal(company) {
    if (!canDelete) {
      alert("Şirkəti silmək üçün companies.delete icazəsi lazımdır.");
      return;
    }

    setDeleteCompany(company);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);

    window.setTimeout(() => {
      setModalOpen(false);
      setEditingCompany(null);
      setError("");
    }, 220);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (editingCompany?.id && !canEdit) {
      setError("Bu əməliyyat üçün companies.edit icazəsi lazımdır.");
      return;
    }

    if (!editingCompany?.id && !canCreate) {
      setError("Bu əməliyyat üçün companies.create icazəsi lazımdır.");
      return;
    }

    const name = form.name.trim();

    if (!name) {
      setError("Şirkət adı məcburidir.");
      return;
    }

    setSaving(true);
    setError("");

    if (editingCompany?.id) {
      const { error } = await supabase
        .from("companies")
        .update({
          name,
          status: form.status,
        })
        .eq("id", editingCompany.id);

      if (error) {
        console.error("COMPANY UPDATE ERROR:", error);
        setError(error.message || "Şirkət yenilənərkən xəta baş verdi.");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("companies").insert({
        name,
        status: form.status,
      });

      if (error) {
        console.error("COMPANY INSERT ERROR:", error);
        setError(error.message || "Şirkət əlavə edilərkən xəta baş verdi.");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeModal();
    await loadCompanies();
  }

  async function handleDeleteConfirm() {
    if (!deleteCompany?.id) return;

    if (!canDelete) {
      alert("Bu əməliyyat üçün companies.delete icazəsi lazımdır.");
      return;
    }

    setDeleting(true);

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", deleteCompany.id);

    if (error) {
      console.error("COMPANY DELETE ERROR:", error);
      alert(
        error.message ||
          "Şirkət silinərkən xəta baş verdi. Bu şirkət inventarlara bağlı ola bilər."
      );
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteCompany(null);
    await loadCompanies();
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
        <div className="settings-empty">Şirkətlər yüklənir...</div>
      </section>
    );
  }

  if (permissionError) {
    return (
      <section className="settings-page">
        <div className="settings-empty">
          <strong>Permission xətası</strong>
          <p>{permissionError}</p>
          <button type="button" onClick={loadPermissionsAndCompanies}>
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
            Bu səhifəyə baxmaq üçün <b>companies.view</b> icazəsi lazımdır.
          </p>
        </div>
      </section>
    );
  }

  const hasRowActions = canEdit || canDelete;

  return (
    <section className="settings-page">
      <div className="settings-hero companies-hero-modern">
        <div>
          <h1>Şirkətlər</h1>
          <p>
            İnventar sistemində istifadə olunan şirkətləri filterlə, sırala və
            ümumi vəziyyəti analiz et.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="settings-primary-btn"
            onClick={openCreateModal}
          >
            + Yeni şirkət
          </button>
        )}
      </div>

      <div className="companies-modern-grid">
        <div className="companies-main-panel">
          <div className="companies-filter-card">
            <div className="companies-filter-head">
              <div>
                <h3>Axtarış və multi seçim</h3>
              </div>

              <button type="button" onClick={resetFilters}>
                Sıfırla
              </button>
            </div>

            <div className="companies-filter-row">
              <input
                placeholder="Şirkət adına və ya statusa görə axtar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button type="button" onClick={loadCompanies}>
                Yenilə
              </button>
            </div>

            <div className="companies-date-filter-row">
              <label>
                <span>Yaradılma tarixi - Başlanğıc</span>

                <div className="companies-date-box">
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

                <div className="companies-date-box">
                  <input
                    type="date"
                    value={createdTo}
                    onChange={(e) => setCreatedTo(e.target.value)}
                  />
                  <strong>{formatInputDate(createdTo) || "gg.aa.iiii"}</strong>
                </div>
              </label>
            </div>

            <div className="companies-chip-row">
              {STATUS_OPTIONS.map((status) => {
                const selected = selectedStatuses.includes(status.value);

                return (
                  <button
                    key={status.value}
                    type="button"
                    className={`companies-filter-chip ${
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

          <div className="settings-summary companies-summary-modern">
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
            {filteredCompanies.length === 0 ? (
              <div className="settings-empty">
                <strong>Şirkət tapılmadı</strong>
                <p>Hazırda bu filterlərə uyğun şirkət yoxdur.</p>
              </div>
            ) : (
              <>
                <div className="settings-table-wrap">
                  <table className="settings-table companies-sort-table">
                    <thead>
                      <tr>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort("name")}
                          >
                            Şirkət adı <span>{sortIcon("name")}</span>
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
                      {paginatedCompanies.map((company) => (
                        <tr key={company.id}>
                          <td>
                            <div className="company-name-cell">
                              <div className="company-avatar">
                                {(company.name || "Ş")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong className="settings-name">
                                  {company.name}
                                </strong>
                              </div>
                            </div>
                          </td>

                          <td>
                            <StatusPill status={company.status} />
                          </td>

                          <td>{formatDate(company.created_at)}</td>

                          {hasRowActions && (
                            <td>
                              <div className="settings-actions">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(company)}
                                  >
                                    Düzəlt
                                  </button>
                                )}

                                {canDelete && (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => openDeleteModal(company)}
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
                  {paginatedCompanies.map((company) => (
                    <article className="settings-mobile-card" key={company.id}>
                      <div className="settings-mobile-top">
                        <div>
                          <span>Şirkət</span>
                          <h3>{company.name}</h3>
                        </div>

                        <StatusPill status={company.status} />
                      </div>

                      <div className="settings-mobile-grid">
                        <div>
                          <span>Yaradılma tarixi</span>
                          <strong>{formatDate(company.created_at)}</strong>
                        </div>
                      </div>

                      {hasRowActions && (
                        <div className="settings-mobile-actions">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(company)}
                            >
                              Düzəlt
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => openDeleteModal(company)}
                            >
                              Sil
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div className="companies-pagination">
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

                  <div className="companies-page-buttons">
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

        <aside className="companies-chart-panel">
          <div className="companies-chart-card">
            <div className="companies-chart-head">
              <h3>Şirkət status paylanması</h3>
            </div>

            <div
              className="companies-donut"
              style={{
                "--active": `${summary.activePercent * 3.6}deg`,
              }}
            >
              <div className="companies-donut-inner">
                <strong>{summary.activePercent}%</strong>
                <span>Aktiv</span>
              </div>
            </div>

            <div className="companies-chart-bars">
              <div>
                <div className="companies-bar-label">
                  <span>Aktiv</span>
                  <strong>{summary.active}</strong>
                </div>
                <div className="companies-bar-track">
                  <span
                    className="companies-bar-fill active"
                    style={{ width: `${summary.activePercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="companies-bar-label">
                  <span>Passiv</span>
                  <strong>{summary.inactive}</strong>
                </div>
                <div className="companies-bar-track">
                  <span
                    className="companies-bar-fill inactive"
                    style={{ width: `${summary.inactivePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="companies-floating-stats">
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
        <CompanyModal
          open={modalOpen}
          visible={modalVisible}
          editingCompany={editingCompany}
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
          item={deleteCompany}
          title="Şirkət silinsin?"
          text="şirkətini silmək üzrəsən. Bu şirkət inventarlara bağlıdırsa silinməyə bilər."
          deleting={deleting}
          onClose={() => {
            if (!deleting) setDeleteCompany(null);
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </section>
  );
}

function CompanyModal({
  open,
  visible,
  editingCompany,
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
            <h2>{editingCompany ? "Şirkəti düzəlt" : "Yeni şirkət"}</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-modal-body">
          <label className="settings-field">
            <span>Şirkət adı *</span>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="Məs: Cahan Holding"
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