"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "⌂",
    roles: ["ADMIN", "REHBER", "USER"],
  },
  {
    label: "Şirkətlər",
    href: "/dashboard/companies",
    icon: "◇",
    roles: ["ADMIN"],
  },
  {
    label: "Kateqoriyalar",
    href: "/dashboard/categories",
    icon: "▦",
    roles: ["ADMIN"],
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
  {
    label: "İstifadəçilər",
    href: "/dashboard/users",
    icon: "◌",
    roles: ["ADMIN"],
  },
];

export default function Sidebar({ me, role, open, onClose }) {
  const pathname = usePathname();

  const visibleMenu = MENU.filter((item) => item.roles.includes(role));

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
          <span className="dash-sidebar-label">Navigation</span>

          <nav className="dash-nav">
            {visibleMenu.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

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

        <div className="dash-sidebar-bottom">
          <div className="dash-user-mini">
            <div className="dash-user-avatar">
              {(me?.full_name || "U").slice(0, 1).toUpperCase()}
            </div>

            <div>
              <strong>{me?.full_name || "User"}</strong>
              <p>
                {me?.roles?.label || role} · {me?.companies?.name || "-"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {open && <button className="dash-overlay" onClick={onClose} />}
    </>
  );
}