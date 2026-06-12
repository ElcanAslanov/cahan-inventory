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

function makeEmptyCan() {
  return {
    inventory: {
      view: false,
      export: false,
      create: false,
      edit: false,
      delete: false,
      qrManage: false,
      transfer: false,
    },
    logs: {
      view: false,
      export: false,
    },
    companies: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    departments: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    categories: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    users: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    permissions: {
      view: false,
      edit: false,
    },
  };
}

function makeCanFromPermissionKeys(permissionKeys) {
  const set = new Set(Array.isArray(permissionKeys) ? permissionKeys : []);

  return {
    inventory: {
      view: set.has("inventory.view"),
      export: set.has("inventory.export"),
      create: set.has("inventory.create"),
      edit: set.has("inventory.edit"),
      delete: set.has("inventory.delete"),
      qrManage: set.has("inventory.qr.manage"),
      transfer: set.has("inventory.transfer"),
    },
    logs: {
      view: set.has("logs.view"),
      export: set.has("logs.export"),
    },
    companies: {
      view: set.has("companies.view"),
      create: set.has("companies.create"),
      edit: set.has("companies.edit"),
      delete: set.has("companies.delete"),
    },
    departments: {
      view: set.has("departments.view"),
      create: set.has("departments.create"),
      edit: set.has("departments.edit"),
      delete: set.has("departments.delete"),
    },
    categories: {
      view: set.has("categories.view"),
      create: set.has("categories.create"),
      edit: set.has("categories.edit"),
      delete: set.has("categories.delete"),
    },
    users: {
      view: set.has("users.view"),
      create: set.has("users.create"),
      edit: set.has("users.edit"),
      delete: set.has("users.delete"),
    },
    permissions: {
      view: set.has("permissions.view"),
      edit: set.has("permissions.edit"),
    },
  };
}

function resolveRole(me) {
  return normalizeRole(
    me?.role ||
      me?.role_name ||
      me?.resolved_role ||
      me?.user_role ||
      me?.profile?.role_name ||
      me?.profile?.user_role ||
      me?.roles?.name ||
      ROLES.USER
  );
}

function normalizePermissionsResponse(json) {
  const profile = json?.profile || null;
  const permissionKeys = Array.isArray(json?.permissionKeys)
    ? json.permissionKeys
    : [];

  const role = normalizeRole(
    json?.role ||
      profile?.role_name ||
      profile?.user_role ||
      profile?.role_label ||
      ROLES.USER
  );

  const can = json?.can || makeCanFromPermissionKeys(permissionKeys);

  const companyAccess = json?.companyAccess || {
    all: false,
    companyIds: [],
  };

  return {
    ...profile,

    profile,

    id: profile?.id || null,
    full_name: profile?.full_name || "",
    email: profile?.email || "",
    status: profile?.status || "",
    user_role: profile?.user_role || role,
    role_id: profile?.role_id || null,
    company_id: profile?.company_id || null,
    company_name: profile?.company_name || null,
    access_scope: json?.accessScope || profile?.access_scope || "OWN_COMPANY",

    role,
    role_name: role,
    resolved_role: role,
    resolved_role_label: profile?.role_label || getRoleLabel(role),

    permissionKeys,
    permission_keys: permissionKeys,
    permissions: permissionKeys,

    can,
    companyAccess,
  };
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

  async function loadPermissions(accessToken) {
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
      throw new Error(json?.error || "Permission məlumatları oxunmadı.");
    }

    return normalizePermissionsResponse(json);
  }

  async function loadFallbackProfile(userId) {
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
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      throw new Error("Profil tapılmadı.");
    }

    const role = normalizeRole(profile.user_role || ROLES.USER);
    const permissionKeys = [];

    return {
      ...profile,
      profile,
      role,
      role_name: role,
      resolved_role: role,
      resolved_role_label: getRoleLabel(role),
      company_name: profile.companies?.name || null,
      permissionKeys,
      permission_keys: permissionKeys,
      permissions: permissionKeys,
      can: makeEmptyCan(),
      companyAccess: {
        all: false,
        companyIds: profile.company_id ? [profile.company_id] : [],
      },
    };
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

      let finalProfile = null;

      try {
        finalProfile = await loadPermissions(accessToken);
      } catch (permissionsError) {
        console.warn("DASHBOARD PERMISSIONS LOAD WARNING:", {
          message: permissionsError?.message,
          raw: permissionsError,
        });

        finalProfile = await loadFallbackProfile(user.id);
      }

      if (!finalProfile) {
        window.location.href = "/login";
        return;
      }

      if (finalProfile.status && finalProfile.status !== "ACTIVE") {
        window.location.href = "/login?error=inactive";
        return;
      }

      console.log("DASHBOARD ME RESOLVED:", {
        id: finalProfile.id,
        email: finalProfile.email,
        role: finalProfile.role,
        resolved_role: finalProfile.resolved_role,
        resolved_role_label: finalProfile.resolved_role_label,
        access_scope: finalProfile.access_scope,
        permissionKeys: finalProfile.permissionKeys,
        can: finalProfile.can,
        companyAccess: finalProfile.companyAccess,
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