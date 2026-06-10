"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROLES = {
  ADMIN: "ADMIN",
  REHBER: "REHBER",
  USER: "USER",
  IZLEYICI: "IZLEYICI",
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
          ROLES.AUDIT,
        ],
      },
      {
        label: "İnventarlar",
        href: "/dashboard/inventory",
        icon: "◈",
        roles: [ROLES.ADMIN, ROLES.REHBER, ROLES.IZLEYICI, ROLES.AUDIT],
      },
      {
        label: "Mənim inventarlarım",
        href: "/dashboard/my-inventory",
        icon: "◎",
        roles: [ROLES.ADMIN, ROLES.REHBER, ROLES.USER],
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
      },
      {
        label: "Departamentlər",
        href: "/dashboard/departments",
        icon: "▤",
        roles: [ROLES.ADMIN],
      },
      {
        label: "Kateqoriyalar",
        href: "/dashboard/categories",
        icon: "▦",
        roles: [ROLES.ADMIN, ROLES.REHBER],
      },
      {
        label: "İstifadəçilər",
        href: "/dashboard/users",
        icon: "◌",
        roles: [ROLES.ADMIN],
      },
    ],
  },
];

function normalizeRole(role) {
  return String(role || ROLES.USER).trim().toUpperCase();
}

function getCurrentRole(me, role) {
  return normalizeRole(
    role ||
      me?.roles?.name ||
      me?.role ||
      me?.user_role ||
      me?.role_name ||
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

export default function Sidebar({ me, role, open, onClose }) {
  const pathname = usePathname();

  const currentRole = getCurrentRole(me, role);

  const visibleGroups = MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.roles.map(normalizeRole).includes(currentRole)
    ),
  })).filter((group) => group.items.length > 0);

  const displayName = me?.full_name || me?.email || "User";
  const roleLabel = me?.roles?.label || getRoleLabel(currentRole);
  const companyName = me?.companies?.name || me?.company_name || "-";

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
                      <span className="dash-nav-icon">{item.icon}</span>
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