"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

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

function resolveRole(profile) {
  return normalizeRole(
    profile?.user_role ||
      profile?.resolved_role ||
      profile?.roles?.name ||
      ROLES.USER
  );
}

export default function DashboardShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dash-no-scroll", sidebarOpen);

    return () => {
      document.body.classList.remove("dash-no-scroll");
    };
  }, [sidebarOpen]);

  async function loadMyPermissions(accessToken) {
  try {
    const res = await fetch("/api/me/permissions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken || ""}`,
      },
      cache: "no-store",
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : {};

    if (!res.ok) {
      console.warn("DASHBOARD PERMISSIONS WARNING:", json);
      return [];
    }

    return Array.isArray(json.permissionKeys) ? json.permissionKeys : [];
  } catch (err) {
    console.warn("DASHBOARD PERMISSIONS LOAD ERROR:", err);
    return [];
  }
}

  async function loadMe() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || "";

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          status,
          user_role,
          role_id,
          company_id,
          access_scope,
          companies (
            id,
            name
          )
        `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("DASHBOARD PROFILE ERROR DETAILS:", {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        });

        setError(
          profileError.message ||
            profileError.details ||
            "Profil məlumatları oxunmadı."
        );
        return;
      }

      if (!profile) {
        window.location.href = "/login";
        return;
      }

      if (profile.status !== "ACTIVE") {
        window.location.href = "/login?error=inactive";
        return;
      }

      const resolvedRole = normalizeRole(profile.user_role || ROLES.USER);

      let roleRow = null;

      const { data: roleByName, error: roleByNameError } = await supabase
        .from("roles")
        .select("id,name,label")
        .eq("name", resolvedRole)
        .maybeSingle();

      if (!roleByNameError && roleByName) {
        roleRow = roleByName;
      } else if (roleByNameError) {
        console.warn("DASHBOARD ROLE BY NAME WARNING:", {
          message: roleByNameError.message,
          details: roleByNameError.details,
          hint: roleByNameError.hint,
          code: roleByNameError.code,
        });
      }

      const permissionKeys = await loadMyPermissions(accessToken);

      const finalProfile = {
        ...profile,
        roles: roleRow,
        resolved_role: resolvedRole,
        resolved_role_label: roleRow?.label || getRoleLabel(resolvedRole),
        permissionKeys,
        permission_keys: permissionKeys,
      };

      console.log("DASHBOARD ME RESOLVED:", {
        id: finalProfile.id,
        email: finalProfile.email,
        user_role: finalProfile.user_role,
        role_id: finalProfile.role_id,
        resolved_role: finalProfile.resolved_role,
        resolved_role_label: finalProfile.resolved_role_label,
        roles: finalProfile.roles,
        permissionKeys: finalProfile.permissionKeys,
      });

      setMe(finalProfile);
    } catch (err) {
      console.error("DashboardShell error details:", {
        raw: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      setError(err?.message || "Panel yüklənərkən xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  }

  const role = useMemo(() => {
    return me?.resolved_role || resolveRole(me);
  }, [me]);

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

  if (error) {
    return (
      <main className="dash-loading-page">
        <div className="dash-loader-card">
          <span className="dash-loader-dot" />

          <div>
            <strong>Xəta</strong>
            <p>{error}</p>
          </div>

          <button type="button" onClick={loadMe}>
            Yenidən yoxla
          </button>
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
          role={role}
          sidebarOpen={sidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={handleMenuClick}
        />

        <section className="dash-content">{children}</section>
      </main>
    </div>
  );
}