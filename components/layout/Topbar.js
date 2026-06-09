"use client";

import LogoutButton from "@/app/dashboard/LogoutButton";

export default function Topbar({ me, onMenuClick }) {
  return (
    <header className="dash-topbar">
      <button type="button" className="dash-menu-btn" onClick={onMenuClick}>
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
            <strong>{me?.full_name || "User"}</strong>
            <p>{me?.roles?.label || "-"}</p>
          </div>

          <div className="dash-topbar-avatar">
            {(me?.full_name || "U").slice(0, 1).toUpperCase()}
          </div>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}