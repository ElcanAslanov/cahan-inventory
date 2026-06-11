"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROLES = {
  ADMIN: "ADMIN",
  REHBER: "REHBER",
  USER: "USER",
  IZLEYICI: "IZLEYICI",
  VIEWER: "VIEWER",
  AUDIT: "AUDIT",
};

const MENU = [
  {
    group: "Əsas",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "⌂",
        roles: [
          ROLES.ADMIN,
          ROLES.REHBER,
          ROLES.USER,
          ROLES.IZLEYICI,
          ROLES.VIEWER,
          ROLES.AUDIT,
        ],
        permission: "dashboard.view",
      },
      {
        label: "İnventarlar",
        href: "/dashboard/inventory",
        icon: "◈",
        roles: [
          ROLES.ADMIN,
          ROLES.REHBER,
          ROLES.IZLEYICI,
          ROLES.VIEWER,
          ROLES.AUDIT,
        ],
        permission: "inventory.view",
      },
      {
        label: "Yetkiləndirmə",
        href: "/dashboard/permissions",
        icon: "⚙",
        roles: [ROLES.ADMIN],
        permission: "permissions.view",
      },
      {
        label: "Yerdəyişmə",
        href: "/dashboard/transfers",
        icon: "⇄",
        roles: [ROLES.ADMIN, ROLES.REHBER],
        permission: "transfers.view",
      },
      {
        label: "Loglar",
        href: "/dashboard/logs",
        icon: "≣",
        roles: [
          ROLES.ADMIN,
          ROLES.REHBER,
          ROLES.IZLEYICI,
          ROLES.VIEWER,
          ROLES.AUDIT,
        ],
        permission: "logs.view",
      },
      {
        label: "Mənim inventarlarım",
        href: "/dashboard/my-inventory",
        icon: "◎",
        roles: [ROLES.ADMIN, ROLES.REHBER, ROLES.USER],
        permission: "my_inventory.view",
      },
    ],
  },
  {
    group: "Hesabat",
    items: [
      {
        label: "Audit / Hesabatlar",
        href: "/dashboard/audit",
        icon: "◷",
        roles: [ROLES.ADMIN, ROLES.AUDIT],
        permission: "audit.view",
      },
    ],
  },
  {
    group: "Tənzimləmələr",
    items: [
      {
        label: "Şirkətlər",
        href: "/dashboard/companies",
        icon: "◇",
        roles: [ROLES.ADMIN],
        permission: "companies.view",
      },
      {
        label: "Departamentlər",
        href: "/dashboard/departments",
        icon: "▤",
        roles: [ROLES.ADMIN],
        permission: "departments.view",
      },
      {
        label: "Kateqoriyalar",
        href: "/dashboard/categories",
        icon: "▦",
        roles: [ROLES.ADMIN, ROLES.REHBER],
        permission: "categories.view",
      },
      {
        label: "İstifadəçilər",
        href: "/dashboard/users",
        icon: "◌",
        roles: [ROLES.ADMIN],
        permission: "users.view",
      },
    ],
  },
];

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
      me?.role ||
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

function isActivePath(pathname, href) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getInitials(value) {
  const text = String(value || "U").trim();

  if (!text) return "U";

  const parts = text.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return text.slice(0, 1).toUpperCase();
}

function getDisplayName(me) {
  return me?.full_name || me?.name || me?.display_name || me?.email || "User";
}

function getCompanyName(me) {
  return me?.companies?.name || me?.company_name || me?.company?.name || "-";
}

function getPermissionKeys(me) {
  if (Array.isArray(me?.permissionKeys)) return me.permissionKeys;
  if (Array.isArray(me?.permission_keys)) return me.permission_keys;
  if (Array.isArray(me?.permissions)) return me.permissions;

  return [];
}

function hasRoleAccess(item, currentRole) {
  if (!Array.isArray(item.roles) || item.roles.length === 0) {
    return true;
  }

  return item.roles.map(normalizeRole).includes(currentRole);
}

function hasPermissionAccess(item, permissionKeys, currentRole) {
  if (!item.permission) {
    return true;
  }

  if (currentRole === ROLES.ADMIN) {
    return true;
  }

  if (!Array.isArray(permissionKeys) || permissionKeys.length === 0) {
    return false;
  }

  return permissionKeys.includes(item.permission);
}

function canShowItem(item, currentRole, permissionKeys) {
  const roleOk = hasRoleAccess(item, currentRole);
  const permissionOk = hasPermissionAccess(item, permissionKeys, currentRole);

  return roleOk && permissionOk;
}

export default function Sidebar({ me, role, open, onClose }) {
  const pathname = usePathname();

  const currentRole = getCurrentRole(me, role);
  const permissionKeys = getPermissionKeys(me);

  const visibleGroups = MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canShowItem(item, currentRole, permissionKeys)
    ),
  })).filter((group) => group.items.length > 0);

  const displayName = getDisplayName(me);
  const roleLabel = me?.resolved_role_label || getRoleLabel(currentRole);
  const companyName = getCompanyName(me);

  return (
    <>
      <aside className={`dash-sidebar ${open ? "is-open" : ""}`}>
        <div className="dash-sidebar-brand">
          <Link href="/dashboard" className="dash-brand-link" onClick={onClose}>
            <div className="dash-logo">
              <span>CI</span>
            </div>

            <div className="dash-brand-text">
              <p>Cahan Holding</p>
              <h2>Inventory</h2>
            </div>
          </Link>

          <button
            type="button"
            className="dash-sidebar-mobile-close"
            onClick={onClose}
            aria-label="Menyunu bağla"
          >
            ×
          </button>
        </div>

        <div className="dash-sidebar-section">
          {visibleGroups.map((group) => (
            <div className="dash-nav-group" key={group.group}>
              <span className="dash-sidebar-label">{group.group}</span>

              <nav className="dash-nav">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`dash-nav-link ${active ? "active" : ""}`}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="dash-nav-icon">{item.icon || "•"}</span>
                      <span className="dash-nav-text">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="dash-sidebar-bottom">
          <div className="dash-user-mini">
            <div className="dash-user-avatar">{getInitials(displayName)}</div>

            <div className="dash-user-mini-text">
              <strong>{displayName}</strong>
              <p>
                {roleLabel} · {companyName}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="dash-overlay"
          onClick={onClose}
          aria-label="Menyunu bağla"
        />
      )}
    </>
  );
}