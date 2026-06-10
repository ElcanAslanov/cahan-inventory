"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  useEffect(() => {
    loadMe();
  }, []);

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
    <div className="dash-layout">
      <Sidebar
        me={me}
        role={role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="dash-main">
        <Topbar me={me} onMenuClick={() => setSidebarOpen(true)} />

        <section className="dash-content">{children}</section>
      </main>
    </div>
  );
}