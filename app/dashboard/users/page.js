"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/users.css";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "REHBER", label: "Rəhbər" },
  { value: "USER", label: "User" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Passiv" },
];

const ACCESS_SCOPE_OPTIONS = [
  { value: "OWN_COMPANY", label: "Öz şirkəti" },
  { value: "ALL_COMPANIES", label: "Bütün şirkətlər" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  user_role: "USER",
  status: "ACTIVE",
  company_id: "",
  access_scope: "OWN_COMPANY",
};

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

function getRoleLabel(value) {
  return ROLE_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getAccessScopeLabel(value) {
  return ACCESS_SCOPE_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getDisplayName(user) {
  return user.full_name || user.name || user.display_name || user.email || user.id || "-";
}

function getUserRole(user) {
  return user.user_role || user.role || "USER";
}

function getUserStatus(user) {
  return user.status || "ACTIVE";
}

function getUserCompanyId(user) {
  return user.company_id || "";
}

function getUserAccessScope(user) {
  return user.access_scope || "OWN_COMPANY";
}

function getUserDepartmentName(user) {
  return (
    user.department_name ||
    user.department ||
    user.departments?.name ||
    user.departmentName ||
    "Departament seçilməyib"
  );
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

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  const [expandedCompanyId, setExpandedCompanyId] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedRoles,
    selectedStatuses,
    selectedCompanies,
    createdFrom,
    createdTo,
    pageSize,
  ]);

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
      const [usersRes, companiesRes] = await Promise.all([
        fetch("/api/admin/users", {
          method: "GET",
          cache: "no-store",
        }),

        supabase
          .from("companies")
          .select("id,name,status")
          .order("name", { ascending: true }),
      ]);

      const usersJson = await usersRes.json();

      if (!usersRes.ok) {
        throw new Error(
          usersJson.error || "İstifadəçilər yüklənərkən xəta baş verdi."
        );
      }

      if (companiesRes.error) throw companiesRes.error;

      setUsers(usersJson.users || []);
      setCompanies(companiesRes.data || []);
    } catch (err) {
      console.error("USERS LOAD ERROR:", err);
      alert(err?.message || "İstifadəçilər yüklənərkən xəta baş verdi.");
      setUsers([]);
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

  const filteredUsers = useMemo(() => {
    const q = normalizeText(search);

    return users.filter((user) => {
      const companyId = String(getUserCompanyId(user) || "");
      const companyName = companyMap.get(companyId) || "";
      const role = getUserRole(user);
      const status = getUserStatus(user);
      const departmentName = getUserDepartmentName(user);

      const matchesSearch =
        !q ||
        normalizeText(getDisplayName(user)).includes(q) ||
        normalizeText(user.email).includes(q) ||
        normalizeText(companyName).includes(q) ||
        normalizeText(departmentName).includes(q) ||
        normalizeText(getRoleLabel(role)).includes(q) ||
        normalizeText(getStatusLabel(status)).includes(q);

      const matchesRole =
        selectedRoles.length === 0 || selectedRoles.includes(role);

      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(status);

      const matchesCompany =
        selectedCompanies.length === 0 || selectedCompanies.includes(companyId);

      const matchesCreatedDate =
        (!createdFrom && !createdTo) ||
        isDateInRange(user.created_at, createdFrom, createdTo);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus &&
        matchesCompany &&
        matchesCreatedDate
      );
    });
  }, [
    users,
    search,
    selectedRoles,
    selectedStatuses,
    selectedCompanies,
    createdFrom,
    createdTo,
    companyMap,
  ]);

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];

    list.sort((a, b) => {
      let aValue = a?.[sortBy];
      let bValue = b?.[sortBy];

      if (sortBy === "name") {
        aValue = getDisplayName(a);
        bValue = getDisplayName(b);
      }

      if (sortBy === "role") {
        aValue = getRoleLabel(getUserRole(a));
        bValue = getRoleLabel(getUserRole(b));
      }

      if (sortBy === "status") {
        aValue = getStatusLabel(getUserStatus(a));
        bValue = getStatusLabel(getUserStatus(b));
      }

      if (sortBy === "company") {
        aValue = companyMap.get(String(getUserCompanyId(a) || "")) || "";
        bValue = companyMap.get(String(getUserCompanyId(b) || "")) || "";
      }

      if (sortBy === "access_scope") {
        aValue = getAccessScopeLabel(getUserAccessScope(a));
        bValue = getAccessScopeLabel(getUserAccessScope(b));
      }

      return compareValues(aValue, bValue, sortDir);
    });

    return list;
  }, [filteredUsers, sortBy, sortDir, companyMap]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));

  const paginatedUsers = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, page, pageSize, totalPages]);

  const summary = useMemo(() => {
    const active = users.filter((x) => getUserStatus(x) === "ACTIVE").length;
    const inactive = users.filter((x) => getUserStatus(x) === "INACTIVE").length;
    const admins = users.filter((x) => getUserRole(x) === "ADMIN").length;
    const rehbers = users.filter((x) => getUserRole(x) === "REHBER").length;
    const normalUsers = users.filter((x) => getUserRole(x) === "USER").length;

    return {
      total: users.length,
      shown: filteredUsers.length,
      active,
      inactive,
      admins,
      rehbers,
      normalUsers,
      activePercent: users.length ? Math.round((active / users.length) * 100) : 0,
      inactivePercent: users.length
        ? Math.round((inactive / users.length) * 100)
        : 0,
    };
  }, [users, filteredUsers]);

  const companyAnalytics = useMemo(() => {
    const map = new Map();

    users.forEach((user) => {
      const companyId = String(getUserCompanyId(user) || "NO_COMPANY");
      const companyName =
        companyId === "NO_COMPANY"
          ? "Şirkət seçilməyib"
          : companyMap.get(companyId) || "Naməlum şirkət";

      if (!map.has(companyId)) {
        map.set(companyId, {
          id: companyId,
          name: companyName,
          total: 0,
          active: 0,
          inactive: 0,
          departments: new Map(),
        });
      }

      const row = map.get(companyId);
      const departmentName = getUserDepartmentName(user);

      row.total += 1;

      if (getUserStatus(user) === "ACTIVE") {
        row.active += 1;
      } else {
        row.inactive += 1;
      }

      if (!row.departments.has(departmentName)) {
        row.departments.set(departmentName, {
          name: departmentName,
          total: 0,
          roles: {
            ADMIN: 0,
            REHBER: 0,
            USER: 0,
          },
        });
      }

      const dept = row.departments.get(departmentName);
      dept.total += 1;
      dept.roles[getUserRole(user)] = (dept.roles[getUserRole(user)] || 0) + 1;
    });

    return Array.from(map.values())
      .map((company) => ({
        ...company,
        departments: Array.from(company.departments.values()).sort(
          (a, b) => b.total - a.total
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [users, companyMap]);

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

  function openCreateModal() {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      user_role: getUserRole(user),
      status: getUserStatus(user),
      company_id: getUserCompanyId(user) ? String(getUserCompanyId(user)) : "",
      access_scope: getUserAccessScope(user),
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalVisible(false);

    window.setTimeout(() => {
      setModalOpen(false);
      setEditingUser(null);
      setError("");
    }, 220);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const fullName = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();

    if (!fullName) {
      setError("Ad soyad məcburidir.");
      return;
    }

    if (!email) {
      setError("Email məcburidir.");
      return;
    }

    if (!editingUser && (!password || password.length < 6)) {
      setError("Yeni istifadəçi üçün şifrə minimum 6 simvol olmalıdır.");
      return;
    }

    if (editingUser && password && password.length < 6) {
      setError("Yeni şifrə minimum 6 simvol olmalıdır.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const headers = await getAuthHeaders();

      const payload = {
        id: editingUser?.id,
        full_name: fullName,
        email,
        user_role: form.user_role,
        status: form.status,
        company_id: form.company_id || null,
        access_scope: form.access_scope,
      };

      if (password) {
        payload.password = password;
      }

      const res = await fetch("/api/admin/users", {
        method: editingUser?.id ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.error || "İstifadəçi yadda saxlanılarkən xəta baş verdi."
        );
      }

      closeModal();
      await loadInitialData();
    } catch (err) {
      console.error("USER SAVE ERROR:", err);
      setError(err?.message || "İstifadəçi yadda saxlanılarkən xəta baş verdi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteUser?.id) return;

    setDeleting(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `/api/admin/users?id=${encodeURIComponent(deleteUser.id)}`,
        {
          method: "DELETE",
          headers,
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "İstifadəçi silinərkən xəta baş verdi.");
      }

      setDeleteUser(null);
      await loadInitialData();
    } catch (err) {
      console.error("USER DELETE ERROR:", err);
      alert(err?.message || "İstifadəçi silinərkən xəta baş verdi.");
    } finally {
      setDeleting(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setSelectedRoles([]);
    setSelectedStatuses([]);
    setSelectedCompanies([]);
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  return (
    <section className="settings-page">
      <div className="settings-hero users-hero-modern">
        <div>
          <h1>İstifadəçilər</h1>
          <p>
            İnventar sistemində istifadəçiləri, rolları, şirkətləri və giriş
            səviyyələrini idarə et.
          </p>
        </div>

        <button
          type="button"
          className="settings-primary-btn"
          onClick={openCreateModal}
        >
          + Yeni istifadəçi
        </button>
      </div>

      <div className="users-modern-grid">
        <div className="users-main-panel">
          <div className="users-filter-card">
            <div className="users-filter-head">
              <div>
                <h3>Axtarış və multi seçim</h3>
              </div>

              <button type="button" onClick={resetFilters}>
                Sıfırla
              </button>
            </div>

            <div className="users-filter-row">
              <input
                placeholder="Ad, email, şirkət, departament və ya statusa görə axtar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button type="button" onClick={loadInitialData}>
                Yenilə
              </button>
            </div>

            <div className="users-date-filter-row">
              <label>
                <span>Yaradılma tarixi - Başlanğıc</span>

                <div className="users-date-box">
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

                <div className="users-date-box">
                  <input
                    type="date"
                    value={createdTo}
                    onChange={(e) => setCreatedTo(e.target.value)}
                  />
                  <strong>{formatInputDate(createdTo) || "gg.aa.iiii"}</strong>
                </div>
              </label>
            </div>

            <div className="users-filter-section-title">Rollar</div>

            <div className="users-chip-row">
              {ROLE_OPTIONS.map((role) => {
                const selected = selectedRoles.includes(role.value);

                return (
                  <button
                    key={role.value}
                    type="button"
                    className={`users-filter-chip ${selected ? "active" : ""}`}
                    onClick={() => toggleMultiValue(setSelectedRoles, role.value)}
                  >
                    <span>{selected ? "✓" : "+"}</span>
                    {role.label}
                  </button>
                );
              })}
            </div>

            <div className="users-filter-section-title">Statuslar</div>

            <div className="users-chip-row">
              {STATUS_OPTIONS.map((status) => {
                const selected = selectedStatuses.includes(status.value);

                return (
                  <button
                    key={status.value}
                    type="button"
                    className={`users-filter-chip ${selected ? "active" : ""}`}
                    onClick={() =>
                      toggleMultiValue(setSelectedStatuses, status.value)
                    }
                  >
                    <span>{selected ? "✓" : "+"}</span>
                    {status.label}
                  </button>
                );
              })}
            </div>

            <div className="users-filter-section-title">Şirkətlər</div>

            <div className="users-chip-row users-company-chip-row">
              {companies.map((company) => {
                const id = String(company.id);
                const selected = selectedCompanies.includes(id);

                return (
                  <button
                    key={company.id}
                    type="button"
                    className={`users-filter-chip ${selected ? "active" : ""}`}
                    onClick={() => toggleMultiValue(setSelectedCompanies, id)}
                  >
                    <span>{selected ? "✓" : "+"}</span>
                    {company.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-summary users-summary-modern">
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
              <span>Admin</span>
              <strong>{loading ? "..." : summary.admins}</strong>
            </div>
          </div>

          <div className="settings-table-card">
            {loading ? (
              <div className="settings-empty">İstifadəçilər yüklənir...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="settings-empty">
                <strong>İstifadəçi tapılmadı</strong>
                <p>Hazırda bu filterlərə uyğun istifadəçi yoxdur.</p>
              </div>
            ) : (
              <>
                <div className="settings-table-wrap">
                  <table className="settings-table users-sort-table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" onClick={() => toggleSort("name")}>
                            Ad soyad <span>{sortIcon("name")}</span>
                          </button>
                        </th>

                        <th>
                          <button type="button" onClick={() => toggleSort("email")}>
                            Email <span>{sortIcon("email")}</span>
                          </button>
                        </th>

                        <th>
                          <button type="button" onClick={() => toggleSort("role")}>
                            Rol <span>{sortIcon("role")}</span>
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
                            onClick={() => toggleSort("access_scope")}
                          >
                            Access scope <span>{sortIcon("access_scope")}</span>
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
                      {paginatedUsers.map((user) => {
                        const companyId = String(getUserCompanyId(user) || "");

                        return (
                          <tr key={user.id}>
                            <td>
                              <div className="user-name-cell">
                                <div className="user-avatar">
                                  {(getDisplayName(user) || "U")
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <strong className="settings-name">
                                    {getDisplayName(user)}
                                  </strong>
                                </div>
                              </div>
                            </td>

                            <td>{user.email || "-"}</td>

                            <td>
                              <RolePill role={getUserRole(user)} />
                            </td>

                            <td>{companyMap.get(companyId) || "-"}</td>

                            <td>{getAccessScopeLabel(getUserAccessScope(user))}</td>

                            <td>
                              <StatusPill status={getUserStatus(user)} />
                            </td>

                            <td>{formatDate(user.created_at)}</td>

                            <td>
                              <div className="settings-actions">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(user)}
                                >
                                  Düzəlt
                                </button>

                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => setDeleteUser(user)}
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
                  {paginatedUsers.map((user) => {
                    const companyId = String(getUserCompanyId(user) || "");

                    return (
                      <article className="settings-mobile-card" key={user.id}>
                        <div className="settings-mobile-top">
                          <div>
                            <span>İstifadəçi</span>
                            <h3>{getDisplayName(user)}</h3>
                          </div>

                          <StatusPill status={getUserStatus(user)} />
                        </div>

                        <div className="settings-mobile-grid">
                          <div>
                            <span>Email</span>
                            <strong>{user.email || "-"}</strong>
                          </div>

                          <div>
                            <span>Rol</span>
                            <strong>{getRoleLabel(getUserRole(user))}</strong>
                          </div>

                          <div>
                            <span>Şirkət</span>
                            <strong>{companyMap.get(companyId) || "-"}</strong>
                          </div>

                          <div>
                            <span>Yaradılma tarixi</span>
                            <strong>{formatDate(user.created_at)}</strong>
                          </div>
                        </div>

                        <div className="settings-mobile-actions">
                          <button type="button" onClick={() => openEditModal(user)}>
                            Düzəlt
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() => setDeleteUser(user)}
                          >
                            Sil
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="users-pagination">
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

                  <div className="users-page-buttons">
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

        <aside className="users-chart-panel">
          <div className="users-chart-card">
            <div className="users-chart-head">
              <h3>İstifadəçi status paylanması</h3>
            </div>

            <div
              className="users-donut"
              style={{
                "--active": `${summary.activePercent * 3.6}deg`,
              }}
            >
              <div className="users-donut-inner">
                <strong>{summary.activePercent}%</strong>
                <span>Aktiv</span>
              </div>
            </div>

            <div className="users-chart-bars">
              <div>
                <div className="users-bar-label">
                  <span>Aktiv</span>
                  <strong>{summary.active}</strong>
                </div>

                <div className="users-bar-track">
                  <span
                    className="users-bar-fill active"
                    style={{ width: `${summary.activePercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="users-bar-label">
                  <span>Passiv</span>
                  <strong>{summary.inactive}</strong>
                </div>

                <div className="users-bar-track">
                  <span
                    className="users-bar-fill inactive"
                    style={{ width: `${summary.inactivePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="users-floating-stats">
              <div>
                <span>Admin</span>
                <strong>{summary.admins}</strong>
              </div>

              <div>
                <span>Rəhbər</span>
                <strong>{summary.rehbers}</strong>
              </div>
            </div>
          </div>

          <div className="users-company-chart-card">
            <div className="users-chart-head">
              <h3>Şirkət və departament analizi</h3>
            </div>

            <div className="users-company-bars">
              {companyAnalytics.length === 0 ? (
                <div className="users-company-empty">
                  Analiz üçün istifadəçi yoxdur.
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
                      className={`users-company-bar-btn ${active ? "active" : ""}`}
                      onClick={() => setExpandedCompanyId(company.id)}
                    >
                      <div className="users-company-bar-top">
                        <span>{company.name}</span>
                        <strong>{company.total}</strong>
                      </div>

                      <div className="users-company-track">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {expandedCompany && (
              <div className="users-company-details">
                <div className="users-company-details-head">
                  <div>
                    <span>Detallı görünüş</span>
                    <strong>{expandedCompany.name}</strong>
                  </div>

                  <b>{expandedCompany.total}</b>
                </div>

                <div className="users-department-list">
                  {expandedCompany.departments.map((dept) => (
                    <div key={dept.name} className="users-department-row">
                      <div>
                        <strong>{dept.name}</strong>
                        <span>
                          Admin: {dept.roles.ADMIN || 0} · Rəhbər:{" "}
                          {dept.roles.REHBER || 0} · User: {dept.roles.USER || 0}
                        </span>
                      </div>

                      <b>{dept.total}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <UserModal
        open={modalOpen}
        visible={modalVisible}
        editingUser={editingUser}
        form={form}
        setForm={setForm}
        companies={companies}
        saving={saving}
        error={error}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmModal
        item={deleteUser}
        deleting={deleting}
        onClose={() => {
          if (!deleting) setDeleteUser(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </section>
  );
}

function UserModal({
  open,
  visible,
  editingUser,
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
            <span>{editingUser ? "Edit user" : "New user"}</span>
            <h2>{editingUser ? "İstifadəçini düzəlt" : "Yeni istifadəçi"}</h2>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-modal-body">
          <label className="settings-field">
            <span>Ad soyad *</span>
            <input
              value={form.full_name}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  full_name: e.target.value,
                }))
              }
              placeholder="Məs: Elcan Aslanov"
              required
            />
          </label>

          <label className="settings-field">
            <span>Email *</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              placeholder="email@example.com"
              required
            />
          </label>

          <label className="settings-field">
            <span>{editingUser ? "Yeni şifrə" : "Şifrə *"}</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              placeholder={
                editingUser
                  ? "Dəyişmək istəmirsənsə boş saxla"
                  : "Minimum 6 simvol"
              }
              required={!editingUser}
            />
          </label>

          {editingUser && (
            <div className="users-password-note">
              Şifrəni dəyişmək istəmirsənsə bu xanani boş saxla.
            </div>
          )}

          <label className="settings-field">
            <span>Rol</span>
            <select
              value={form.user_role}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  user_role: e.target.value,
                }))
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Şirkət</span>
            <select
              value={form.company_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  company_id: e.target.value,
                }))
              }
            >
              <option value="">Şirkət seçilməyib</option>
              {companies.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Access scope</span>
            <select
              value={form.access_scope}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  access_scope: e.target.value,
                }))
              }
            >
              {ACCESS_SCOPE_OPTIONS.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
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

function RolePill({ role }) {
  return (
    <span className={`settings-status status-${role || "USER"}`}>
      {getRoleLabel(role)}
    </span>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`settings-status status-${status || "ACTIVE"}`}>
      {status === "INACTIVE" ? "Passiv" : "Aktiv"}
    </span>
  );
}

function DeleteConfirmModal({ item, deleting, onClose, onConfirm }) {
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
        <h3>İstifadəçi silinsin?</h3>
        <p>
          <strong>{getDisplayName(item)}</strong> istifadəçisini silmək üzrəsən.
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