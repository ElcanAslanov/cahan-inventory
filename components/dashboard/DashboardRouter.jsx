"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

import DashboardHome from "./DashboardHome";
import RehberDashboard from "./RehberDashboard";
import UserDashboard from "./UserDashboard";
import AuditDashboard from "./AuditDashboard";
import ViewerDashboard from "./ViewerDashboard";

export default function DashboardRouter() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [accessScope, setAccessScope] = useState("OWN_COMPANY");
  const [allowedCompanyIds, setAllowedCompanyIds] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setAuthUser(null);
        setProfile(null);
        setRoleName("");
        setAllowedCompanyIds([]);
        return;
      }

      setAuthUser(user);

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("PROFILE ERROR DETAILS:", {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        });

        throw new Error(
          profileError.message ||
            profileError.details ||
            "Profil məlumatları oxunmadı."
        );
      }

      if (!profileRow) {
        setError(
          "Profil tapılmadı. Bu istifadəçi üçün profiles cədvəlində row yoxdur."
        );
        return;
      }

      let foundRole =
        profileRow?.user_role ||
        profileRow?.role ||
        profileRow?.role_name ||
        profileRow?.type ||
        "";

      let foundAccessScope = profileRow?.access_scope || "OWN_COMPANY";

      if (profileRow?.role_id) {
        const { data: roleRow, error: roleError } = await supabase
          .from("roles")
          .select("id, name, label")
          .eq("id", profileRow.role_id)
          .maybeSingle();

        if (!roleError && roleRow?.name) {
          foundRole = roleRow.name;
        } else if (roleError) {
          console.warn("ROLE READ WARNING:", {
            message: roleError.message,
            details: roleError.details,
            hint: roleError.hint,
            code: roleError.code,
          });
        }
      }

      const normalizedRole = normalizeRole(foundRole || "USER");

      const allowedCompanies = await resolveAllowedCompanies({
        userId: user.id,
        profile: profileRow,
        roleName: normalizedRole,
        accessScope: foundAccessScope,
      });

      setProfile(profileRow);
      setRoleName(normalizedRole);
      setAccessScope(foundAccessScope);
      setAllowedCompanyIds(allowedCompanies);
    } catch (err) {
      console.error("DashboardRouter error details:", {
        raw: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        stack: err?.stack,
      });

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          "Dashboard yüklənərkən xəta baş verdi."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resolveAllowedCompanies({
    userId,
    profile,
    roleName,
    accessScope,
  }) {
    try {
      if (roleName === "ADMIN" || accessScope === "ALL_COMPANIES") {
        const { data, error } = await supabase.from("companies").select("id");

        if (error) {
          console.warn("COMPANIES READ WARNING:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });

          return profile?.company_id ? [profile.company_id] : [];
        }

        return (data || []).map((c) => c.id);
      }

      const companyIds = new Set();

      if (profile?.company_id) {
        companyIds.add(profile.company_id);
      }

      const { data: accessRows, error: accessError } = await supabase
        .from("user_company_access")
        .select("company_id, access_type")
        .eq("user_id", userId);

      if (!accessError) {
        for (const row of accessRows || []) {
          if (row.access_type === "EXTRA") {
            companyIds.add(row.company_id);
          }

          if (row.access_type === "DENY") {
            companyIds.delete(row.company_id);
          }
        }
      } else {
        console.warn("USER COMPANY ACCESS WARNING:", {
          message: accessError.message,
          details: accessError.details,
          hint: accessError.hint,
          code: accessError.code,
        });
      }

      return Array.from(companyIds);
    } catch (err) {
      console.warn("resolveAllowedCompanies warning:", err);
      return profile?.company_id ? [profile.company_id] : [];
    }
  }

  const commonProps = useMemo(
    () => ({
      authUser,
      profile,
      roleName,
      accessScope,
      allowedCompanyIds,
      refreshDashboardRouter: loadCurrentUser,
    }),
    [authUser, profile, roleName, accessScope, allowedCompanyIds]
  );

  if (loading) {
    return (
      <div className="dash-home">
        <section className="dash-home-hero dash-home-hero-compact">
          <div>
            <span className="dash-home-kicker">Loading</span>
            <h1>Dashboard yüklənir...</h1>
            <p>İstifadəçi rolu və icazələri yoxlanılır.</p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-home">
        <section className="dash-home-hero dash-home-hero-compact">
          <div>
            <span className="dash-home-kicker">Error</span>
            <h1>Xəta baş verdi</h1>
            <p>{error}</p>
          </div>

          <button className="dash-router-btn" onClick={loadCurrentUser}>
            Yenidən yoxla
          </button>
        </section>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="dash-home">
        <section className="dash-home-hero dash-home-hero-compact">
          <div>
            <span className="dash-home-kicker">Auth required</span>
            <h1>Giriş tələb olunur</h1>
            <p>Dashboard-u görmək üçün sistemə daxil olmaq lazımdır.</p>
          </div>
        </section>
      </div>
    );
  }

  if (roleName === "ADMIN") {
    return <DashboardHome {...commonProps} />;
  }

  if (roleName === "REHBER") {
    return <RehberDashboard {...commonProps} />;
  }

  if (roleName === "AUDIT") {
    return <AuditDashboard {...commonProps} />;
  }

  if (roleName === "VIEWER") {
    return <ViewerDashboard {...commonProps} />;
  }

  return <UserDashboard {...commonProps} />;
}

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toUpperCase();

  if (value === "ADMIN") return "ADMIN";

  if (
    value === "REHBER" ||
    value === "RƏHBƏR" ||
    value === "REHBƏR" ||
    value === "RƏHBER"
  ) {
    return "REHBER";
  }

  if (
    value === "AUDIT" ||
    value === "AUDITOR" ||
    value === "AUDİT"
  ) {
    return "AUDIT";
  }

  if (
    value === "VIEWER" ||
    value === "IZLEYICI" ||
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "IZLƏYICI"
  ) {
    return "VIEWER";
  }

  if (value === "USER" || value === "İSTİFADƏÇİ" || value === "ISTIFADECI") {
    return "USER";
  }

  return value || "USER";
}