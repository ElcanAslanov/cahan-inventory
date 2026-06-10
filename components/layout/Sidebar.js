"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  {
    group: "Əsas",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "⌂",
        roles: ["ADMIN", "REHBER", "USER"],
      },
      {
        label: "İnventarlar",
        href: "/dashboard/inventory",
        icon: "◈",
        roles: ["ADMIN", "REHBER"],
      },
      {
        label: "Mənim inventarlarım",
        href: "/dashboard/my-inventory",
        icon: "◎",
        roles: ["ADMIN", "REHBER", "USER"],
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
        roles: ["ADMIN"],
      },
      {
        label: "Departamentlər",
        href: "/dashboard/departments",
        icon: "▤",
        roles: ["ADMIN"],
      },
      {
        label: "Kateqoriyalar",
        href: "/dashboard/categories",
        icon: "▦",
        roles: ["ADMIN"],
      },
      {
        label: "İstifadəçilər",
        href: "/dashboard/users",
        icon: "◌",
        roles: ["ADMIN"],
      },
    ],
  },
];

function isActivePath(pathname, href) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ me, role, open, onClose }) {
  const pathname = usePathname();

  const currentRole = role || me?.user_role || me?.role || "USER";

  const visibleGroups = MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(currentRole)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <aside className={`dash-sidebar ${open ? "is-open" : ""}`}>
        <div className="dash-sidebar-brand">
          <div className="dash-logo">
            <span>CI</span>
          </div>

          <div>
            <p>Cahan Holding</p>
            <h2>Inventory</h2>
          </div>
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
                    >
                      <span className="dash-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="dash-sidebar-bottom">
          <div className="dash-user-mini">
            <div className="dash-user-avatar">
              {(me?.full_name || me?.email || "U").slice(0, 1).toUpperCase()}
            </div>

            <div>
              <strong>{me?.full_name || me?.email || "User"}</strong>
              <p>
                {me?.roles?.label || currentRole} ·{" "}
                {me?.companies?.name || me?.company_name || "-"}
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