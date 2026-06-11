"use client";

import LogoutButton from "../../app/dashboard/LogoutButton";

const ROLES = {
  ADMIN: "ADMIN",
  REHBER: "REHBER",
  USER: "USER",
  IZLEYICI: "IZLEYICI",
  VIEWER: "VIEWER",
  AUDIT: "AUDIT",
};

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();

  if (value === "ADMIN") return ROLES.ADMIN;

  if (
    value === "REHBER" ||
    value === "RƏHBƏR" ||
    value === "REHBƏR" ||
    value === "RƏHBER"
  ) {
    return ROLES.REHBER;
  }

  if (value === "AUDIT" || value === "AUDITOR" || value === "AUDİT") {
    return ROLES.AUDIT;
  }

  if (
    value === "IZLEYICI" ||
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "IZLƏYICI" ||
    value === "VIEWER"
  ) {
    return ROLES.IZLEYICI;
  }

  if (
    value === "USER" ||
    value === "İSTİFADƏÇİ" ||
    value === "ISTIFADECI"
  ) {
    return ROLES.USER;
  }

  return value || ROLES.USER;
}

function getCurrentRole(me, role) {
  return normalizeRole(
    role ||
      me?.resolved_role ||
      me?.user_role ||
      me?.roles?.name ||
      ROLES.USER
  );
}

function getRoleLabel(role) {
  const currentRole = normalizeRole(role);

  const labels = {
    [ROLES.ADMIN]: "Admin",
    [ROLES.REHBER]: "Rəhbər",
    [ROLES.USER]: "İstifadəçi",
    [ROLES.IZLEYICI]: "İzləyici",
    [ROLES.VIEWER]: "İzləyici",
    [ROLES.AUDIT]: "Audit",
  };

  return labels[currentRole] || currentRole;
}

function getDisplayName(me) {
  return me?.full_name || me?.name || me?.display_name || me?.email || "User";
}

function getInitial(value) {
  return String(value || "U").trim().slice(0, 1).toUpperCase() || "U";
}

export default function Topbar({
  me,
  role,
  onMenuClick,
  sidebarOpen,
  sidebarCollapsed,
}) {
  const displayName = getDisplayName(me);
  const currentRole = getCurrentRole(me, role);
  const roleLabel = me?.resolved_role_label || getRoleLabel(currentRole);

  return (
    <header className="dash-topbar">
      <button
        type="button"
        className={`dash-menu-btn ${sidebarOpen ? "is-open" : ""} ${
          sidebarCollapsed ? "is-collapsed" : ""
        }`}
        onClick={onMenuClick}
        aria-label="Menyunu aç və ya yığ"
        title="Menyu"
      >
        <span />
        <span />
        <span />
      </button>

      <div className="dash-topbar-title">
        <p>İdarəetmə paneli</p>
        <h1>Inventarizasiya sistemi</h1>
      </div>

      <div className="dash-topbar-actions">
        <div className="dash-topbar-user">
          <div>
            <strong>{displayName}</strong>
            <p>{roleLabel}</p>
          </div>

          <div className="dash-topbar-avatar">{getInitial(displayName)}</div>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}