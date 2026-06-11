"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/permissions.css";

const TABS = [
  {
    key: "ROLE_PERMISSIONS",
    title: "Rol yetkiləri",
    desc: "Rolun görə biləcəyi səhifə və əməliyyatlar",
  },
  {
    key: "USER_PERMISSIONS",
    title: "İstifadəçi override",
    desc: "İstifadəçiyə əlavə icazə ver və ya blokla",
  },
  {
    key: "ROLE_COMPANIES",
    title: "Rol şirkətləri",
    desc: "Rolun görə biləcəyi şirkətlər",
  },
  {
    key: "USER_COMPANIES",
    title: "İstifadəçi şirkət override",
    desc: "İstifadəçiyə şirkət üzrə xüsusi icazə ver",
  },
];

function normalizeRole(value) {
  const role = String(value || "").trim().toUpperCase();

  if (role === "RƏHBƏR" || role === "REHBƏR" || role === "RƏHBER") {
    return "REHBER";
  }

  if (role === "AUDİT" || role === "AUDITOR") {
    return "AUDIT";
  }

  if (
    role === "İZLEYICI" ||
    role === "İZLƏYİCİ" ||
    role === "IZLƏYICI" ||
    role === "VIEWER"
  ) {
    return "IZLEYICI";
  }

  if (role === "İSTİFADƏÇİ" || role === "ISTIFADECI") {
    return "USER";
  }

  return role || "USER";
}

function roleLabel(role) {
  return role?.label || role?.name || "-";
}

function userLabel(user) {
  return user?.full_name || user?.email || user?.id || "-";
}

function groupByPermission(permissions) {
  const map = new Map();

  permissions.forEach((permission) => {
    const group = permission.group_name || "Ümumi";

    if (!map.has(group)) {
      map.set(group, []);
    }

    map.get(group).push(permission);
  });

  return Array.from(map.entries()).map(([group, items]) => ({
    group,
    items,
  }));
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

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);

  const [rolePermissions, setRolePermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [roleCompanyAccess, setRoleCompanyAccess] = useState([]);
  const [userCompanyAccess, setUserCompanyAccess] = useState([]);

  const [activeTab, setActiveTab] = useState("ROLE_PERMISSIONS");

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [rolePermissionIds, setRolePermissionIds] = useState([]);
  const [userAllowPermissionIds, setUserAllowPermissionIds] = useState([]);
  const [userDenyPermissionIds, setUserDenyPermissionIds] = useState([]);

  const [roleCompanyIds, setRoleCompanyIds] = useState([]);
  const [userAllowCompanyIds, setUserAllowCompanyIds] = useState([]);
  const [userDenyCompanyIds, setUserDenyCompanyIds] = useState([]);

  const [searchPermission, setSearchPermission] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedRoleId) {
      setRolePermissionIds([]);
      setRoleCompanyIds([]);
      return;
    }

    setRolePermissionIds(
      rolePermissions
        .filter((row) => row.role_id === selectedRoleId)
        .map((row) => row.permission_id)
    );

    setRoleCompanyIds(
      roleCompanyAccess
        .filter((row) => row.role_id === selectedRoleId)
        .map((row) => row.company_id)
    );
  }, [selectedRoleId, rolePermissions, roleCompanyAccess]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserAllowPermissionIds([]);
      setUserDenyPermissionIds([]);
      setUserAllowCompanyIds([]);
      setUserDenyCompanyIds([]);
      return;
    }

    const userPerms = userPermissions.filter(
      (row) => row.user_id === selectedUserId
    );

    setUserAllowPermissionIds(
      userPerms
        .filter((row) => row.effect === "ALLOW")
        .map((row) => row.permission_id)
    );

    setUserDenyPermissionIds(
      userPerms
        .filter((row) => row.effect === "DENY")
        .map((row) => row.permission_id)
    );

    const userCompanies = userCompanyAccess.filter(
      (row) => row.user_id === selectedUserId
    );

    setUserAllowCompanyIds(
      userCompanies
        .filter((row) => row.effect === "ALLOW")
        .map((row) => row.company_id)
    );

    setUserDenyCompanyIds(
      userCompanies
        .filter((row) => row.effect === "DENY")
        .map((row) => row.company_id)
    );
  }, [selectedUserId, userPermissions, userCompanyAccess]);

  async function loadData() {
    setLoading(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/admin/permissions", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(json.error || "Yetkilər yüklənərkən xəta baş verdi.");
      }

      setPermissions(json.permissions || []);
      setRoles(json.roles || []);
      setCompanies(json.companies || []);
      setUsers(json.users || []);
      setRolePermissions(json.rolePermissions || []);
      setUserPermissions(json.userPermissions || []);
      setRoleCompanyAccess(json.roleCompanyAccess || []);
      setUserCompanyAccess(json.userCompanyAccess || []);
    } catch (err) {
      console.error("PERMISSIONS_PAGE_LOAD_ERROR:", err);
      alert(err?.message || "Yetkilər yüklənərkən xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  }

  const activeTabData = useMemo(() => {
    return TABS.find((tab) => tab.key === activeTab) || TABS[0];
  }, [activeTab]);

  const selectedRole = useMemo(() => {
    return roles.find((role) => role.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  const selectedUser = useMemo(() => {
    return users.find((user) => user.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const companyMap = useMemo(() => {
    const map = new Map();

    companies.forEach((company) => {
      map.set(company.id, company.name);
    });

    return map;
  }, [companies]);

  const filteredUsers = useMemo(() => {
    const q = searchUser.trim().toLowerCase();

    if (!q) return users;

    return users.filter((user) => {
      const companyName = companyMap.get(user.company_id) || "";
      const accessScopeText = getUserAccessScopeText(user);

      return (
        String(user.full_name || "").toLowerCase().includes(q) ||
        String(user.email || "").toLowerCase().includes(q) ||
        String(user.role || user.user_role || "").toLowerCase().includes(q) ||
        String(companyName || "").toLowerCase().includes(q) ||
        String(accessScopeText || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchUser, companyMap]);

  const filteredPermissions = useMemo(() => {
    const q = searchPermission.trim().toLowerCase();

    if (!q) return permissions;

    return permissions.filter((permission) => {
      return (
        String(permission.key || "").toLowerCase().includes(q) ||
        String(permission.label || "").toLowerCase().includes(q) ||
        String(permission.group_name || "").toLowerCase().includes(q)
      );
    });
  }, [permissions, searchPermission]);

  const permissionGroups = useMemo(() => {
    return groupByPermission(filteredPermissions);
  }, [filteredPermissions]);

  const filteredCompanies = useMemo(() => {
    const q = searchCompany.trim().toLowerCase();

    if (!q) return companies;

    return companies.filter((company) =>
      String(company.name || "").toLowerCase().includes(q)
    );
  }, [companies, searchCompany]);

  const selectedUserRole = useMemo(() => {
    const userRoleName = normalizeRole(
      selectedUser?.role || selectedUser?.user_role
    );

    if (selectedUser?.role_id) {
      const byId = roles.find((role) => role.id === selectedUser.role_id);
      if (byId) return byId;
    }

    return roles.find((role) => normalizeRole(role.name) === userRoleName) || null;
  }, [selectedUser, roles]);

  const inheritedUserPermissionIds = useMemo(() => {
    if (!selectedUserRole) return [];

    return rolePermissions
      .filter((row) => row.role_id === selectedUserRole.id)
      .map((row) => row.permission_id);
  }, [selectedUserRole, rolePermissions]);

  const inheritedUserCompanyIds = useMemo(() => {
    const set = new Set();

    const accessScope = getUserAccessScope(selectedUser);

    if (accessScope === "ALL_COMPANIES") {
      companies.forEach((company) => {
        if (company.id) {
          set.add(company.id);
        }
      });

      return Array.from(set);
    }

    if (selectedUser?.company_id) {
      set.add(selectedUser.company_id);
    }

    if (selectedUserRole) {
      roleCompanyAccess
        .filter((row) => row.role_id === selectedUserRole.id)
        .forEach((row) => {
          if (row.company_id) {
            set.add(row.company_id);
          }
        });
    }

    return Array.from(set);
  }, [selectedUser, selectedUserRole, roleCompanyAccess, companies]);

  const pageStats = useMemo(() => {
    return {
      permissions: permissions.length,
      roles: roles.length,
      users: users.length,
      companies: companies.length,
    };
  }, [permissions, roles, users, companies]);

  function getUserRoleText(user) {
    return user?.user_role || user?.role || "-";
  }

  function getUserCompanyText(user) {
    if (!user?.company_id) return "Şirkət seçilməyib";
    return companyMap.get(user.company_id) || user.company_name || "Naməlum şirkət";
  }

  function getUserAccessScope(user) {
    return String(user?.access_scope || "OWN_COMPANY").trim().toUpperCase();
  }

  function getUserAccessScopeText(user) {
    const scope = getUserAccessScope(user);

    if (scope === "ALL_COMPANIES") {
      return "Bütün şirkətlər";
    }

    return "Öz şirkəti";
  }

  function getDefaultCompanyText(user) {
    if (getUserAccessScope(user) === "ALL_COMPANIES") {
      return "Bütün şirkətlər";
    }

    return getUserCompanyText(user);
  }

  function toggleArrayValue(setter, value) {
    setter((prev) => {
      if (prev.includes(value)) {
        return prev.filter((x) => x !== value);
      }

      return [...prev, value];
    });
  }

  function setUserPermissionEffect(permissionId, effect) {
    setUserAllowPermissionIds((prev) => prev.filter((id) => id !== permissionId));
    setUserDenyPermissionIds((prev) => prev.filter((id) => id !== permissionId));

    if (effect === "ALLOW") {
      setUserAllowPermissionIds((prev) => [...prev, permissionId]);
    }

    if (effect === "DENY") {
      setUserDenyPermissionIds((prev) => [...prev, permissionId]);
    }
  }

  function setUserCompanyEffect(companyId, effect) {
    setUserAllowCompanyIds((prev) => prev.filter((id) => id !== companyId));
    setUserDenyCompanyIds((prev) => prev.filter((id) => id !== companyId));

    if (effect === "ALLOW") {
      setUserAllowCompanyIds((prev) => [...prev, companyId]);
    }

    if (effect === "DENY") {
      setUserDenyCompanyIds((prev) => [...prev, companyId]);
    }
  }

  async function saveRolePermissions() {
    if (!selectedRoleId) return;

    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          mode: "ROLE_PERMISSIONS",
          role_id: selectedRoleId,
          permission_ids: rolePermissionIds,
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error(json.error || "Rol yetkiləri saxlanılmadı.");

      await loadData();
      alert("Rol yetkiləri yadda saxlanıldı.");
    } catch (err) {
      console.error("SAVE_ROLE_PERMISSIONS_ERROR:", err);
      alert(err?.message || "Rol yetkiləri saxlanılmadı.");
    } finally {
      setSaving(false);
    }
  }

  async function saveUserPermissions() {
    if (!selectedUserId) return;

    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          mode: "USER_PERMISSIONS",
          user_id: selectedUserId,
          allow_permission_ids: userAllowPermissionIds,
          deny_permission_ids: userDenyPermissionIds,
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(json.error || "İstifadəçi yetkiləri saxlanılmadı.");
      }

      await loadData();
      alert("İstifadəçi yetkiləri yadda saxlanıldı.");
    } catch (err) {
      console.error("SAVE_USER_PERMISSIONS_ERROR:", err);
      alert(err?.message || "İstifadəçi yetkiləri saxlanılmadı.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoleCompanies() {
    if (!selectedRoleId) return;

    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          mode: "ROLE_COMPANIES",
          role_id: selectedRoleId,
          company_ids: roleCompanyIds,
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(json.error || "Rol şirkət yetkiləri saxlanılmadı.");
      }

      await loadData();
      alert("Rol şirkət yetkiləri yadda saxlanıldı.");
    } catch (err) {
      console.error("SAVE_ROLE_COMPANIES_ERROR:", err);
      alert(err?.message || "Rol şirkət yetkiləri saxlanılmadı.");
    } finally {
      setSaving(false);
    }
  }

  async function saveUserCompanies() {
    if (!selectedUserId) return;

    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          mode: "USER_COMPANIES",
          user_id: selectedUserId,
          allow_company_ids: userAllowCompanyIds,
          deny_company_ids: userDenyCompanyIds,
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(
          json.error || "İstifadəçi şirkət yetkiləri saxlanılmadı."
        );
      }

      await loadData();
      alert("İstifadəçi şirkət yetkiləri yadda saxlanıldı.");
    } catch (err) {
      console.error("SAVE_USER_COMPANIES_ERROR:", err);
      alert(err?.message || "İstifadəçi şirkət yetkiləri saxlanılmadı.");
    } finally {
      setSaving(false);
    }
  }

  function getEffectivePermissionStatus(permissionId) {
    if (userDenyPermissionIds.includes(permissionId)) return "DENY";
    if (userAllowPermissionIds.includes(permissionId)) return "ALLOW";
    if (inheritedUserPermissionIds.includes(permissionId)) return "INHERITED";
    return "NONE";
  }

  function getEffectiveCompanyStatus(companyId) {
    if (userDenyCompanyIds.includes(companyId)) return "DENY";
    if (userAllowCompanyIds.includes(companyId)) return "ALLOW";
    if (inheritedUserCompanyIds.includes(companyId)) return "INHERITED";
    return "NONE";
  }

  return (
    <section className="permissions-page">
      <div className="permissions-hero">
        <div>
          
          <h1>Yetkiləndirmə</h1>
      
        </div>

        <div className="permissions-hero-actions">
          <div className="permissions-hero-stat">
            <strong>{pageStats.permissions}</strong>
            <small>İcazə</small>
          </div>

          <div className="permissions-hero-stat">
            <strong>{pageStats.roles}</strong>
            <small>Rol</small>
          </div>

          <button type="button" onClick={loadData} disabled={loading || saving}>
            Yenilə
          </button>
        </div>
      </div>

      <div className="permissions-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            <strong>{tab.title}</strong>
            <span>{tab.desc}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="permissions-empty">
          <span className="permissions-loader" />
          <strong>Yetkilər yüklənir...</strong>
          <p>Rol, istifadəçi və şirkət access məlumatları hazırlanır.</p>
        </div>
      ) : (
        <>
          {(activeTab === "ROLE_PERMISSIONS" ||
            activeTab === "ROLE_COMPANIES") && (
            <div className="permissions-layout">
              <aside className="permissions-side-card">
                <div className="permissions-side-head">
                  <div>
                    
                    <h3>Rollar</h3>
                  </div>

                  <b>{roles.length}</b>
                </div>

                <div className="permissions-list">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={selectedRoleId === role.id ? "active" : ""}
                      onClick={() => setSelectedRoleId(role.id)}
                    >
                      <div>
                        <strong>{roleLabel(role)}</strong>
                        <span>{role.name}</span>
                      </div>

                      <em>{selectedRoleId === role.id ? "Aktiv" : "Seç"}</em>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="permissions-main-card">
                {activeTab === "ROLE_PERMISSIONS" ? (
                  <>
                    <div className="permissions-card-head">
                      <div>
                        <span>{activeTabData.desc}</span>
                        
                      </div>

                      <button
                        type="button"
                        className="primary"
                        onClick={saveRolePermissions}
                        disabled={saving}
                      >
                        {saving ? "Saxlanılır..." : "Yadda saxla"}
                      </button>
                    </div>

                    <div className="permissions-toolbar">
                      <input
                        className="permissions-search"
                        placeholder="Permission adı, açarı və ya qrup üzrə axtar..."
                        value={searchPermission}
                        onChange={(e) => setSearchPermission(e.target.value)}
                      />

                      <div className="permissions-counter-pill">
                        <strong>{rolePermissionIds.length}</strong>
                        <span>aktiv icazə</span>
                      </div>
                    </div>

                    <PermissionSwitchList
                      groups={permissionGroups}
                      checkedIds={rolePermissionIds}
                      onToggle={(permissionId) =>
                        toggleArrayValue(setRolePermissionIds, permissionId)
                      }
                    />
                  </>
                ) : (
                  <>
                    <div className="permissions-card-head">
                      <div>
                        <span>{activeTabData.desc}</span>
                        
                      </div>

                      <button
                        type="button"
                        className="primary"
                        onClick={saveRoleCompanies}
                        disabled={saving}
                      >
                        {saving ? "Saxlanılır..." : "Yadda saxla"}
                      </button>
                    </div>

                    <div className="permissions-toolbar">
                      <input
                        className="permissions-search"
                        placeholder="Şirkət axtar..."
                        value={searchCompany}
                        onChange={(e) => setSearchCompany(e.target.value)}
                      />

                      <div className="permissions-counter-pill">
                        <strong>{roleCompanyIds.length}</strong>
                        <span>şirkət</span>
                      </div>
                    </div>

                    <CompanySwitchList
                      companies={filteredCompanies}
                      checkedIds={roleCompanyIds}
                      onToggle={(companyId) =>
                        toggleArrayValue(setRoleCompanyIds, companyId)
                      }
                    />
                  </>
                )}
              </main>
            </div>
          )}

          {(activeTab === "USER_PERMISSIONS" ||
            activeTab === "USER_COMPANIES") && (
            <div className="permissions-layout">
              <aside className="permissions-side-card">
                <div className="permissions-side-head">
                  <div>
                    
                    <h3>İstifadəçilər</h3>
                  </div>

                  <b>{users.length}</b>
                </div>

                <input
                  className="permissions-search small"
                  placeholder="Ad, email, rol, access scope və ya şirkət üzrə axtar..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />

                <div className="permissions-list">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={selectedUserId === user.id ? "active" : ""}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <div>
                        <strong>{userLabel(user)}</strong>
                        <span>
                          {(user.email || "-") +
                            " · " +
                            getUserRoleText(user) +
                            " · " +
                            getUserAccessScopeText(user) +
                            " · " +
                            getUserCompanyText(user)}
                        </span>
                      </div>

                      <em>{selectedUserId === user.id ? "Aktiv" : "Seç"}</em>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="permissions-main-card">
                {activeTab === "USER_PERMISSIONS" ? (
                  <>
                    <div className="permissions-card-head">
                      <div>
                        <span>{activeTabData.desc}</span>                      
                        
                        
                      </div>

                      <button
                        type="button"
                        className="primary"
                        onClick={saveUserPermissions}
                        disabled={saving}
                      >
                        {saving ? "Saxlanılır..." : "Yadda saxla"}
                      </button>
                    </div>

                    <div className="permissions-help">
                      <div>
                        <b>Default</b>
                        <span>İstifadəçi rolundan gələn qaydaya tabe olur.</span>
                      </div>

                      <div>
                        <b>Allow</b>
                        <span>Rolda olmasa belə bu istifadəçiyə icazə verir.</span>
                      </div>

                      <div>
                        <b>Deny</b>
                        <span>Rolda olsa belə bu istifadəçidə bloklayır.</span>
                      </div>
                    </div>

                    <div className="permissions-toolbar">
                      <input
                        className="permissions-search"
                        placeholder="Permission axtar..."
                        value={searchPermission}
                        onChange={(e) => setSearchPermission(e.target.value)}
                      />

                      <div className="permissions-counter-pill">
                        <strong>
                          {userAllowPermissionIds.length +
                            userDenyPermissionIds.length}
                        </strong>
                        <span>override</span>
                      </div>
                    </div>

                    <UserPermissionOverrideList
                      groups={permissionGroups}
                      getStatus={getEffectivePermissionStatus}
                      onSetEffect={setUserPermissionEffect}
                    />
                  </>
                ) : (
                  <>
                    <div className="permissions-card-head">
                      <div>
                        <span>{activeTabData.desc}</span>
                        
                      </div>

                      <button
                        type="button"
                        className="primary"
                        onClick={saveUserCompanies}
                        disabled={saving}
                      >
                        {saving ? "Saxlanılır..." : "Yadda saxla"}
                      </button>
                    </div>

                    <div className="permissions-help">
                      <div>
                        <b>Default</b>
                        <span>
                          Access scope Bütün şirkətlərdirsə hamısı, yoxdursa öz
                          şirkəti və rol şirkətləri avtomatik aktiv görünür.
                        </span>
                      </div>

                      <div>
                        <b>Allow</b>
                        <span>Bu şirkəti əlavə olaraq görə bilsin.</span>
                      </div>

                      <div>
                        <b>Deny</b>
                        <span>Default gəlsə belə bu şirkəti görməsin.</span>
                      </div>
                    </div>

                    <div className="permissions-toolbar">
                      <input
                        className="permissions-search"
                        placeholder="Şirkət axtar..."
                        value={searchCompany}
                        onChange={(e) => setSearchCompany(e.target.value)}
                      />

                      <div className="permissions-counter-pill">
                        <strong>
                          {userAllowCompanyIds.length +
                            userDenyCompanyIds.length}
                        </strong>
                        <span>override</span>
                      </div>
                    </div>

                    <UserCompanyOverrideList
                      companies={filteredCompanies}
                      getStatus={getEffectiveCompanyStatus}
                      onSetEffect={setUserCompanyEffect}
                      selectedUser={selectedUser}
                    />
                  </>
                )}
              </main>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PermissionSwitchList({ groups, checkedIds, onToggle }) {
  return (
    <div className="permissions-groups">
      {groups.map((group) => (
        <div className="permissions-group" key={group.group}>
          <div className="permissions-group-title">
            <h3>{group.group}</h3>
            <span>{group.items.length} icazə</span>
          </div>

          <div className="permissions-switch-list">
            {group.items.map((permission) => {
              const checked = checkedIds.includes(permission.id);

              return (
                <button
                  key={permission.id}
                  type="button"
                  className={`permission-switch-row ${checked ? "is-on" : ""}`}
                  onClick={() => onToggle(permission.id)}
                >
                  <div className="permission-switch-info">
                    <strong>{permission.label}</strong>
                    <small>{permission.key}</small>
                    {permission.description && <p>{permission.description}</p>}
                  </div>

                  <IosSwitch checked={checked} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanySwitchList({ companies, checkedIds, onToggle }) {
  return (
    <div className="permissions-switch-list">
      {companies.map((company) => {
        const checked = checkedIds.includes(company.id);

        return (
          <button
            key={company.id}
            type="button"
            className={`permission-switch-row ${checked ? "is-on" : ""}`}
            onClick={() => onToggle(company.id)}
          >
            <div className="permission-switch-info">
              <strong>{company.name}</strong>
              <small>{company.status || "status yoxdur"}</small>
              <p>
                Bu rol üçün şirkət görünüşünü{" "}
                {checked ? "aktiv edir." : "deaktiv saxlayır."}
              </p>
            </div>

            <IosSwitch checked={checked} />
          </button>
        );
      })}
    </div>
  );
}

function UserPermissionOverrideList({ groups, getStatus, onSetEffect }) {
  return (
    <div className="permissions-groups">
      {groups.map((group) => (
        <div className="permissions-group" key={group.group}>
          <div className="permissions-group-title">
            <h3>{group.group}</h3>
            <span>{group.items.length} icazə</span>
          </div>

          <div className="permission-override-list">
            {group.items.map((permission) => {
              const status = getStatus(permission.id);

              return (
                <div
                  className={`permission-override-row status-${status.toLowerCase()}`}
                  key={permission.id}
                >
                  <div className="permission-switch-info">
                    <strong>{permission.label}</strong>
                    <small>{permission.key}</small>
                    {permission.description && <p>{permission.description}</p>}
                  </div>

                  <OverrideControl
                    status={status}
                    onChange={(effect) => onSetEffect(permission.id, effect)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function UserCompanyOverrideList({
  companies,
  getStatus,
  onSetEffect,
  selectedUser,
}) {
  const accessScope = String(selectedUser?.access_scope || "OWN_COMPANY")
    .trim()
    .toUpperCase();

  const isAllCompanies = accessScope === "ALL_COMPANIES";

  return (
    <div className="permission-override-list">
      {companies.map((company) => {
        const status = getStatus(company.id);

        return (
          <div
            className={`permission-override-row status-${status.toLowerCase()}`}
            key={company.id}
          >
            <div className="permission-switch-info">
              <strong>{company.name}</strong>
              <small>{company.status || "status yoxdur"}</small>

              <p>
                {status === "INHERITED" && isAllCompanies
                  ? "Bu şirkət access scope Bütün şirkətlər olduğu üçün avtomatik gəlir."
                  : status === "INHERITED"
                    ? "Bu şirkət istifadəçinin öz şirkəti və ya rolundan avtomatik gəlir."
                    : status === "ALLOW"
                      ? "Bu şirkət istifadəçiyə əlavə olaraq açılıb."
                      : status === "DENY"
                        ? "Bu şirkət istifadəçidə xüsusi olaraq bloklanıb."
                        : "Bu şirkət üçün xüsusi access yoxdur."}
              </p>
            </div>

            <OverrideControl
              status={status}
              onChange={(effect) => onSetEffect(company.id, effect)}
            />
          </div>
        );
      })}
    </div>
  );
}

function IosSwitch({ checked }) {
  return (
    <span className={`ios-switch ${checked ? "on" : ""}`} aria-hidden="true">
      <span />
    </span>
  );
}

function OverrideControl({ status, onChange }) {
  const effective = status === "INHERITED" ? "DEFAULT" : status;

  return (
    <div className="override-control">
      <button
        type="button"
        className={effective === "DEFAULT" ? "active default" : ""}
        onClick={() => onChange("NONE")}
      >
        Default
      </button>

      <button
        type="button"
        className={effective === "ALLOW" ? "active allow" : ""}
        onClick={() => onChange("ALLOW")}
      >
        Allow
      </button>

      <button
        type="button"
        className={effective === "DENY" ? "active deny" : ""}
        onClick={() => onChange("DENY")}
      >
        Deny
      </button>

      <span
        className={`override-status-dot status-${String(status).toLowerCase()}`}
        title={status}
      />
    </div>
  );
}