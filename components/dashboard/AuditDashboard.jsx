"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const RISKY_ACTIONS = [
  "DELETE",
  "UPDATE",
  "ROLE_CHANGE",
  "PERMISSION_CHANGE",
  "CREATE_USER",
  "UPDATE_USER",
  "DELETE_USER",
];

export default function AuditDashboard({
  profile,
  allowedCompanyIds = [],
  accessScope = "OWN_COMPANY",
}) {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const safeCompanyIds = Array.isArray(allowedCompanyIds)
        ? allowedCompanyIds.filter(Boolean)
        : [];

      let companiesQuery = supabase
        .from("companies")
        .select("id,name,status")
        .order("name", { ascending: true });

      if (accessScope !== "ALL_COMPANIES" && safeCompanyIds.length > 0) {
        companiesQuery = companiesQuery.in("id", safeCompanyIds);
      }

      let inventoryQuery = supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (accessScope !== "ALL_COMPANIES" && safeCompanyIds.length > 0) {
        inventoryQuery = inventoryQuery.in("company_id", safeCompanyIds);
      }

      if (
        accessScope !== "ALL_COMPANIES" &&
        safeCompanyIds.length === 0 &&
        profile?.company_id
      ) {
        inventoryQuery = inventoryQuery.eq("company_id", profile.company_id);
      }

      const [auditRes, inventoryRes, companiesRes, profilesRes] =
        await Promise.all([
          supabase
            .from("audit_logs")
            .select(
              `
              id,
              action,
              table_name,
              user_id,
              created_at,
              full_old_data,
              full_new_data
            `
            )
            .order("created_at", { ascending: false })
            .limit(150),

          inventoryQuery,

          companiesQuery,

          supabase
            .from("profiles")
            .select("id,full_name,email,user_role,role,company_id")
            .limit(500),
        ]);

      if (auditRes.error) {
        console.error("AUDIT LOGS ERROR DETAILS:", {
          message: auditRes.error.message,
          details: auditRes.error.details,
          hint: auditRes.error.hint,
          code: auditRes.error.code,
        });

        throw new Error(
          auditRes.error.message ||
            auditRes.error.details ||
            "Audit logları oxunmadı."
        );
      }

      if (inventoryRes.error) {
        console.error("AUDIT INVENTORY ERROR DETAILS:", {
          message: inventoryRes.error.message,
          details: inventoryRes.error.details,
          hint: inventoryRes.error.hint,
          code: inventoryRes.error.code,
        });

        throw new Error(
          inventoryRes.error.message ||
            inventoryRes.error.details ||
            "Inventar məlumatları oxunmadı."
        );
      }

      if (companiesRes.error) {
        console.warn("AUDIT COMPANIES WARNING:", {
          message: companiesRes.error.message,
          details: companiesRes.error.details,
          hint: companiesRes.error.hint,
          code: companiesRes.error.code,
        });
      }

      if (profilesRes.error) {
        console.warn("AUDIT PROFILES WARNING:", {
          message: profilesRes.error.message,
          details: profilesRes.error.details,
          hint: profilesRes.error.hint,
          code: profilesRes.error.code,
        });
      }

      setAuditLogs(auditRes.data || []);
      setInventoryItems(inventoryRes.data || []);
      setCompanies(companiesRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (err) {
      console.error("AuditDashboard error details:", {
        raw: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      setError(err?.message || "Audit dashboard yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  const profileMap = useMemo(() => {
    const map = new Map();

    profiles.forEach((row) => {
      map.set(String(row.id), row);
    });

    return map;
  }, [profiles]);

  const companyMap = useMemo(() => {
    const map = new Map();

    companies.forEach((row) => {
      map.set(String(row.id), row.name);
    });

    return map;
  }, [companies]);

  const riskyLogs = useMemo(() => {
    return auditLogs.filter((log) =>
      RISKY_ACTIONS.includes(String(log.action || "").toUpperCase())
    );
  }, [auditLogs]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const todayLogs = auditLogs.filter((log) =>
      String(log.created_at || "").startsWith(today)
    );

    const deleteLogs = auditLogs.filter(
      (log) => String(log.action || "").toUpperCase() === "DELETE"
    );

    const updateLogs = auditLogs.filter(
      (log) => String(log.action || "").toUpperCase() === "UPDATE"
    );

    const roleLogs = auditLogs.filter((log) => {
      const action = String(log.action || "").toUpperCase();
      return action.includes("ROLE") || action.includes("PERMISSION");
    });

    const riskyInventory = inventoryItems.filter((item) => {
      const health = String(item.health_status || "").toUpperCase();

      return (
        health === "RISKY" ||
        health === "BAD" ||
        health === "CRITICAL" ||
        health === "WEAK"
      );
    });

    const unassignedInventory = inventoryItems.filter((item) => {
      return (
        !item.responsible_user_id &&
        !item.assigned_to &&
        !item.user_id &&
        !item.employee_id &&
        item.status !== "ASSIGNED"
      );
    });

    return {
      totalLogs: auditLogs.length,
      riskyLogs: riskyLogs.length,
      todayLogs: todayLogs.length,
      deleteLogs: deleteLogs.length,
      updateLogs: updateLogs.length,
      roleLogs: roleLogs.length,
      totalInventory: inventoryItems.length,
      riskyInventory: riskyInventory.length,
      unassignedInventory: unassignedInventory.length,
    };
  }, [auditLogs, riskyLogs, inventoryItems]);

  const actionRows = useMemo(() => {
    const map = {};

    auditLogs.forEach((log) => {
      const key = String(log.action || "UNKNOWN").toUpperCase();
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [auditLogs]);

  const tableRows = useMemo(() => {
    const map = {};

    auditLogs.forEach((log) => {
      const key = log.table_name || "Naməlum tablo";
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [auditLogs]);

  const riskyInventoryRows = useMemo(() => {
    return inventoryItems
      .filter((item) => {
        const health = String(item.health_status || "").toUpperCase();

        return (
          health === "RISKY" ||
          health === "BAD" ||
          health === "CRITICAL" ||
          health === "WEAK"
        );
      })
      .slice(0, 12);
  }, [inventoryItems]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading-card">
          <div className="dashboard-loader" />
          <p>Audit dashboard yüklənir...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-error-card">
          <h2>Xəta</h2>
          <p>{error}</p>

          <button type="button" onClick={loadDashboard}>
            Yenidən yoxla
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">Audit Dashboard</p>
          <h1>Sistem fəaliyyətləri və risk nəzarəti</h1>
          <p>
            Salam, {profile?.full_name || profile?.email || "Audit"}. Burada
            son audit logları, riskli əməliyyatlar, inventar riskləri və sistem
            dəyişiklikləri izlənilir.
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-4">
        <StatCard
          title="Audit qeydləri"
          value={stats.totalLogs}
          note="Son 150 log"
        />

        <StatCard
          title="Riskli əməliyyatlar"
          value={stats.riskyLogs}
          note="DELETE / UPDATE / permission"
        />

        <StatCard
          title="Bugünkü əməliyyatlar"
          value={stats.todayLogs}
          note="Bu gün yaradılan loglar"
        />

        <StatCard
          title="Silinmələr"
          value={stats.deleteLogs}
          note="DELETE əməliyyatları"
        />
      </section>

      <section className="dashboard-grid dashboard-grid-3">
        <StatCard
          title="Update əməliyyatları"
          value={stats.updateLogs}
          note="Məlumat dəyişiklikləri"
        />

        <StatCard
          title="Rol / icazə dəyişiklikləri"
          value={stats.roleLogs}
          note="Access baxımından riskli"
        />

        <StatCard
          title="Riskli inventarlar"
          value={stats.riskyInventory}
          note={`${stats.totalInventory} inventar içindən`}
        />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Əməliyyat növləri</h2>
            <span>{auditLogs.length} log</span>
          </div>

          <div className="dashboard-chart-list">
            {actionRows.length === 0 ? (
              <p className="dashboard-muted">Audit log yoxdur.</p>
            ) : (
              actionRows.map((row) => (
                <ChartRow
                  key={row.label}
                  label={humanizeAction(row.label)}
                  value={row.value}
                  max={auditLogs.length}
                />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Tablolar üzrə aktivlik</h2>
            <span>Top {tableRows.length}</span>
          </div>

          <div className="dashboard-chart-list">
            {tableRows.length === 0 ? (
              <p className="dashboard-muted">Məlumat yoxdur.</p>
            ) : (
              tableRows.map((row) => (
                <ChartRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  max={auditLogs.length}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-two-col" style={{ marginTop: 18 }}>
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Riskli fəaliyyətlər</h2>
            <span>{riskyLogs.length}</span>
          </div>

          <div className="dashboard-list">
            {riskyLogs.length === 0 ? (
              <p className="dashboard-muted">Riskli fəaliyyət yoxdur.</p>
            ) : (
              riskyLogs.slice(0, 20).map((log) => (
                <AuditLogRow
                  key={log.id}
                  log={log}
                  profileMap={profileMap}
                />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Son audit qeydləri</h2>
            <span>Son 20</span>
          </div>

          <div className="dashboard-list">
            {auditLogs.length === 0 ? (
              <p className="dashboard-muted">Audit qeydi yoxdur.</p>
            ) : (
              auditLogs.slice(0, 20).map((log) => (
                <AuditLogRow
                  key={log.id}
                  log={log}
                  profileMap={profileMap}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-card" style={{ marginTop: 18 }}>
        <div className="dashboard-card-head">
          <h2>Riskli inventarlar</h2>
          <span>{riskyInventoryRows.length}</span>
        </div>

        <div className="dashboard-list">
          {riskyInventoryRows.length === 0 ? (
            <p className="dashboard-muted">Riskli inventar yoxdur.</p>
          ) : (
            riskyInventoryRows.map((item) => (
              <div className="dashboard-list-item" key={item.id}>
                <strong>
                  {item.name ||
                    item.item_name ||
                    item.title ||
                    item.inventory_name ||
                    "Adsız inventar"}
                </strong>

                <span>{item.health_status || "-"}</span>

                <small>
                  {companyMap.get(String(item.company_id || "")) ||
                    "Şirkət seçilməyib"}{" "}
                  · {item.inventory_code || item.serial_number || item.code || "-"}
                </small>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function AuditLogRow({ log, profileMap }) {
  const user = profileMap.get(String(log.user_id || ""));

  return (
    <div className="dashboard-list-item">
      <strong>{humanizeAction(log.action)}</strong>

      <span>{log.table_name || "-"}</span>

      <small>
        {formatDateTime(log.created_at)} ·{" "}
        {user?.full_name || user?.email || log.user_id || "Sistem"}
      </small>
    </div>
  );
}

function StatCard({ title, value, note }) {
  return (
    <div className="dashboard-stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function ChartRow({ label, value, max }) {
  const width = max > 0 ? Math.round((Number(value || 0) / max) * 100) : 0;

  return (
    <div className="dashboard-chart-row">
      <div className="dashboard-chart-row-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="dashboard-bar">
        <div style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function humanizeAction(action) {
  const value = String(action || "").toUpperCase();

  const map = {
    CREATE: "Yaradılma",
    INSERT: "Əlavə etmə",
    UPDATE: "Dəyişiklik",
    DELETE: "Silinmə",
    ROLE_CHANGE: "Rol dəyişikliyi",
    PERMISSION_CHANGE: "İcazə dəyişikliyi",
    CREATE_USER: "User yaradıldı",
    UPDATE_USER: "User dəyişdirildi",
    DELETE_USER: "User silindi",
    UNKNOWN: "Bilinmir",
  };

  return map[value] || action || "-";
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("az-AZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}