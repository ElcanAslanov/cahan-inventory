"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dash-no-scroll", sidebarOpen);

    return () => {
      document.body.classList.remove("dash-no-scroll");
    };
  }, [sidebarOpen]);

  async function loadMe() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        email,
        status,
        roles (
          id,
          name,
          label
        ),
        companies (
          id,
          name
        )
      `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      window.location.href = "/login";
      return;
    }

    if (profile.status !== "ACTIVE") {
      window.location.href = "/login?error=inactive";
      return;
    }

    setMe(profile);
    setLoading(false);
  }

  const role = me?.roles?.name || "USER";

  function handleMenuClick() {
    if (typeof window !== "undefined" && window.innerWidth <= 980) {
      setSidebarOpen((prev) => !prev);
      return;
    }

    setSidebarCollapsed((prev) => !prev);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  if (loading) {
    return (
      <main className="dash-loading-page">
        <div className="dash-loader-card">
          <span className="dash-loader-dot" />
          <div>
            <strong>Yüklənir</strong>
            <p>Panel hazırlanır...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className={`dash-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        me={me}
        role={role}
        open={sidebarOpen}
        onClose={closeSidebar}
      />

      <main className="dash-main">
        <Topbar
          me={me}
          sidebarOpen={sidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={handleMenuClick}
        />

        <section className="dash-content">{children}</section>
      </main>
    </div>
  );
}