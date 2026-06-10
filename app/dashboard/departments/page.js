"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/settings-pages.css";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Passiv" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const EMPTY_FORM = {
  name: "",
  company_id: "",
  status: "ACTIVE",
};

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

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deleteDepartment, setDeleteDepartment] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCompanies, selectedStatuses, createdFrom, createdTo, pageSize]);

  useEffect(() => {
    if (!modalOpen) return;

    const timer = window.setTimeout(() => {
      setModalVisible(true);
    }, 20);

    return () => window.clearTimeout(timer);
  }, [modalOpen]);

  async function loadInitialData() {
    setLoading(true);

    try {
      const [departmentsRes, companiesRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name,status,company_id,created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("companies")
          .select("id,name,status")
          .order("name", { ascending: true }),
      ]);

      if (departmentsRes.error) throw departmentsRes.error;
      if (companiesRes.error) throw companiesRes.error;

      setDepartments(departmentsRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (err) {
      console.error("DEPARTMENTS LOAD ERROR:", err);
      alert(err?.message || "Departamentlər yüklənərkən xəta baş verdi.");
      setDepartments([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  const companyMap = useMemo(() => {
    const map = new Map();

    companies.forEach((company) => {
      map.set(String(company.id), company.name);
    });

    return map;
  }, [companies]);

  const filteredDepartments = useMemo(() => {
    const q = normalizeText(search);

    return departments.filter((department) => {
      const companyId = String(department.company_id || "");
      const companyName = companyMap.get(companyId) || "";

      const matchesSearch =
        !q ||
        normalizeText(department.name).includes(q) ||
        normalizeText(companyName).includes(q) ||
        normalizeText(getStatusLabel(department.status)).includes(q);

      const matchesCompany =
        selectedCompanies.length === 0 || selectedCompanies.includes(companyId);

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(department.status);

      const matchesCreatedDate =
        (!createdFrom && !createdTo) ||
        isDateInRange(department.created_at, createdFrom, createdTo);

      return matchesSearch && matchesCompany && matchesStatus && matchesCreatedDate;
    });
  }, [
    departments,
    search,
    selectedCompanies,
    selectedStatuses,
    createdFrom,
    createdTo,
    companyMap,
  ]);

  const sortedDepartments = useMemo(() => {
    const list = [...filteredDepartments];

    list.sort((a, b) => {
      let aValue = a?.[sortBy];
      let bValue = b?.[sortBy];

      if (sortBy === "status") {
        aValue = getStatusLabel(a.status);
        bValue = getStatusLabel(b.status);
      }

      if (sortBy === "company") {
        aValue = companyMap.get(String(a.company_id || "")) || "";
        bValue = companyMap.get(String(b.company_id || "")) || "";
      }

      return compareValues(aValue, bValue, sortDir);
    });

    return list;
  }, [filteredDepartments, sortBy, sortDir, companyMap]);

  const totalPages = Math.max(1, Math.ceil(sortedDepartments.length / pageSize));

  const paginatedDepartments = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedDepartments.slice(start, start + pageSize);
  }, [sortedDepartments, page, pageSize, totalPages]);

  const summary = useMemo(() => {
    const active = departments.filter((x) => x.status === "ACTIVE").length;
    const inactive = departments.filter((x) => x.status === "INACTIVE").length;
    const companyCount = new Set(
      departments.map((x) => x.company_id).filter(Boolean)
    ).size;

    return {
      total: departments.length,
      shown: filteredDepartments.length,
      active,
      inactive,
      companies: companyCount,
      activePercent: departments.length
        ? Math.round((active / departments.length) * 100)
        : 0,
      inactivePercent: departments.length
        ? Math.round((inactive / departments.length) * 100)
        : 0,
    };
  }, [departments, filteredDepartments]);

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

  function toggleCompany(companyId) {
    setSelectedCompanies((prev) => {
      const id = String(companyId);

      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }

      return [...prev, id];
    });
  }

  function openCreateModal() {
    setEditingDepartment(null);
    setForm({
      ...EMPTY_FORM,
      company_id:
        selectedCompanies.length === 1
          ? selectedCompanies[0]
          : companies.length === 1
            ? String(companies[0].id)
            : "",
    });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(department) {
    setEditingDepartment(department);
    setForm({
      name: department.name || "",
      company_id: department.company_id ? String(department.company_id) : "",
      status: department.status || "ACTIVE",
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);

    window.setTimeout(() => {
      setModalOpen(false);
      setEditingDepartment(null);
      setError("");
    }, 220);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setError("Departament adı məcburidir.");
      return;
    }

    if (!form.company_id) {
      setError("Şirkət seçilməlidir.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name,
        company_id: form.company_id,
        status: form.status,
      };

      if (editingDepartment?.id) {
        const { error } = await supabase
          .from("departments")
          .update(payload)
          .eq("id", editingDepartment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert(payload);

        if (error) throw error;
      }

      setSaving(false);
      closeModal();
      await loadInitialData();
    } catch (err) {
      console.error("DEPARTMENT SAVE ERROR:", err);

      if (String(err?.message || "").includes("departments_company_name_unique")) {
        setError("Bu şirkətdə eyni adlı departament artıq mövcuddur.");
      } else {
        setError(
          err?.message || "Departament yadda saxlanılarkən xəta baş verdi."
        );
      }

      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteDepartment?.id) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", deleteDepartment.id);

      if (error) throw error;

      setDeleteDepartment(null);
      await loadInitialData();
    } catch (err) {
      console.error("DEPARTMENT DELETE ERROR:", err);
      alert(
        err?.message ||
          "Departament silinərkən xəta baş verdi. Bu departament inventarlara bağlı ola bilər."
      );
    } finally {
      setDeleting(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setSelectedCompanies([]);
    setSelectedStatuses([]);
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  return (
    <section className="settings-page">
      <div className="settings-hero departments-hero-modern">
        <div>
          <h1>Departamentlər</h1>
          <p>
            Şirkətlərə bağlı departamentləri idarə et, filterlə, sırala və
            ümumi vəziyyəti analiz et.
          </p>
        </div>

        <button
          type="button"
          className="settings-primary-btn"
          onClick={openCreateModal}
        >
          + Yeni departament
        </button>
      </div>

      <div className="departments-modern-grid">
        <div className="departments-main-panel">
          <div className="departments-filter-card">
            <div className="departments-filter-head">
              <div>
                <h3>Axtarış və multi seçim</h3>
              </div>

              <button type="button" onClick={resetFilters}>
                Sıfırla
              </button>
            </div>

            <div className="departments-filter-row">
              <input
                placeholder="Departament, şirkət və ya statusa görə axtar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button type="button" onClick={loadInitialData}>
                Yenilə
              </button>
            </div>

            <div className="departments-date-filter-row">
              <label>
                <span>Yaradılma tarixi - Başlanğıc</span>

                <div className="departments-date-box">
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

                <div className="departments-date-box">
                  <input
                    type="date"
                    value={createdTo}
                    onChange={(e) => setCreatedTo(e.target.value)}
                  />
                  <strong>{formatInputDate(createdTo) || "gg.aa.iiii"}</strong>
                </div>
              </label>
            </div>

            <div className="departments-filter-section-title">Statuslar</div>

            <div className="departments-chip-row">
              {STATUS_OPTIONS.map((status) => {
                const selected = selectedStatuses.includes(status.value);

                return (
                  <button
                    key={status.value}
                    type="button"
                    className={`departments-filter-chip ${
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

            <div className="departments-filter-section-title">Şirkətlər</div>

            <div className="departments-chip-row departments-company-chip-row">
              {companies.map((company) => {
                const id = String(company.id);
                const selected = selectedCompanies.includes(id);

                return (
                  <button
                    key={company.id}
                    type="button"
                    className={`departments-filter-chip ${
                      selected ? "active" : ""
                    }`}
                    onClick={() => toggleCompany(id)}
                  >
                    <span>{selected ? "✓" : "+"}</span>
                    {company.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-summary departments-summary-modern">
            <div>
              <span>Göstərilən</span>
              <strong>{loading ? "..." : summary.shown}</strong>
            </div>

            <div>
              <span>Ümumi</span>
              <strong>{loading ? "..." : summary.total}</strong>
            </div>

            <div>
              <span>Aktiv</span>
              <strong>{loading ? "..." : summary.active}</strong>
            </div>

            <div>
              <span>Passiv</span>
              <strong>{loading ? "..." : summary.inactive}</strong>
            </div>

            <div>
              <span>Şirkət sayı</span>
              <strong>{loading ? "..." : summary.companies}</strong>
            </div>
          </div>

          <div className="settings-table-card">
            {loading ? (
              <div className="settings-empty">Departamentlər yüklənir...</div>
            ) : filteredDepartments.length === 0 ? (
              <div className="settings-empty">
                <strong>Departament tapılmadı</strong>
                <p>Hazırda bu filterlərə uyğun departament yoxdur.</p>
              </div>
            ) : (
              <>
                <div className="settings-table-wrap">
                  <table className="settings-table departments-sort-table">
                    <thead>
                      <tr>
                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort("name")}
                          >
                            Departament adı <span>{sortIcon("name")}</span>
                          </button>
                        </th>

                        <th>
                          <button
                            type="button"
                            onClick={() => toggleSort("company")}
                          >
                            Şirkət <span>{sortIcon("company")}</span>
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

                        <th>Əməliyyatlar</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedDepartments.map((department) => {
                        const companyId = String(department.company_id || "");
                        const companyName = companyMap.get(companyId) || "-";

                        return (
                          <tr key={department.id}>
                            <td>
                              <div className="department-name-cell">
                                <div className="department-avatar">
                                  {(department.name || "D")
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <strong className="settings-name">
                                    {department.name}
                                  </strong>
                                </div>
                              </div>
                            </td>

                            <td>{companyName}</td>

                            <td>
                              <StatusPill status={department.status} />
                            </td>

                            <td>{formatDate(department.created_at)}</td>

                            <td>
                              <div className="settings-actions">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(department)}
                                >
                                  Düzəlt
                                </button>

                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => setDeleteDepartment(department)}
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="settings-mobile-list">
                  {paginatedDepartments.map((department) => {
                    const companyId = String(department.company_id || "");

                    return (
                      <article
                        className="settings-mobile-card"
                        key={department.id}
                      >
                        <div className="settings-mobile-top">
                          <div>
                            <span>Departament</span>
                            <h3>{department.name}</h3>
                          </div>

                          <StatusPill status={department.status} />
                        </div>

                        <div className="settings-mobile-grid">
                          <div>
                            <span>Şirkət</span>
                            <strong>{companyMap.get(companyId) || "-"}</strong>
                          </div>

                          <div>
                            <span>Yaradılma tarixi</span>
                            <strong>{formatDate(department.created_at)}</strong>
                          </div>
                        </div>

                        <div className="settings-mobile-actions">
                          <button
                            type="button"
                            onClick={() => openEditModal(department)}
                          >
                            Düzəlt
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() => setDeleteDepartment(department)}
                          >
                            Sil
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="departments-pagination">
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

                  <div className="departments-page-buttons">
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

        <aside className="departments-chart-panel">
          <div className="departments-chart-card">
            <div className="departments-chart-head">
              <h3>Departament status paylanması</h3>
            </div>

            <div
              className="departments-donut"
              style={{
                "--active": `${summary.activePercent * 3.6}deg`,
              }}
            >
              <div className="departments-donut-inner">
                <strong>{summary.activePercent}%</strong>
                <span>Aktiv</span>
              </div>
            </div>

            <div className="departments-chart-bars">
              <div>
                <div className="departments-bar-label">
                  <span>Aktiv</span>
                  <strong>{summary.active}</strong>
                </div>

                <div className="departments-bar-track">
                  <span
                    className="departments-bar-fill active"
                    style={{ width: `${summary.activePercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="departments-bar-label">
                  <span>Passiv</span>
                  <strong>{summary.inactive}</strong>
                </div>

                <div className="departments-bar-track">
                  <span
                    className="departments-bar-fill inactive"
                    style={{ width: `${summary.inactivePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="departments-floating-stats">
              <div>
                <span>Filter nəticəsi</span>
                <strong>{summary.shown}</strong>
              </div>

              <div>
                <span>Şirkət sayı</span>
                <strong>{summary.companies}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <DepartmentModal
        open={modalOpen}
        visible={modalVisible}
        editingDepartment={editingDepartment}
        form={form}
        setForm={setForm}
        companies={companies}
        saving={saving}
        error={error}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmModal
        item={deleteDepartment}
        deleting={deleting}
        companyName={
          deleteDepartment
            ? companyMap.get(String(deleteDepartment.company_id || ""))
            : ""
        }
        onClose={() => {
          if (!deleting) setDeleteDepartment(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </section>
  );
}

function DepartmentModal({
  open,
  visible,
  editingDepartment,
  form,
  setForm,
  companies,
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
              {editingDepartment ? "Departamenti düzəlt" : "Yeni departament"}
            </h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-modal-body">
          <label className="settings-field">
            <span>Departament adı *</span>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="Məs: IT Departamenti"
              required
            />
          </label>

          <label className="settings-field">
            <span>Şirkət *</span>
            <select
              value={form.company_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  company_id: e.target.value,
                }))
              }
              required
            >
              <option value="">Şirkət seç</option>
              {companies.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.name}
                </option>
              ))}
            </select>
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
  deleting,
  companyName,
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
        <h3>Departament silinsin?</h3>
        <p>
          <strong>{item.name || "-"}</strong>{" "}
          {companyName ? `(${companyName}) ` : ""}
          departamentini silmək üzrəsən.
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