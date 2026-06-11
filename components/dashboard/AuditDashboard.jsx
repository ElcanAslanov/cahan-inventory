"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuditDashboard({ profile, allowedCompanyIds }) {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [riskyLogs, setRiskyLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, table_name, user_id, created_at, full_old_data, full_new_data")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = data || [];
      setAuditLogs(rows);

      setRiskyLogs(
        rows.filter((log) =>
          ["DELETE", "UPDATE", "ROLE_CHANGE", "PERMISSION_CHANGE"].includes(
            String(log.action || "").toUpperCase()
          )
        )
      );
    } catch (err) {
      console.error("AuditDashboard error:", err);
      setError(err?.message || "Audit dashboard yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return {
      total: auditLogs.length,
      risky: riskyLogs.length,
      today: auditLogs.filter((l) => String(l.created_at || "").startsWith(today)).length,
      deletes: auditLogs.filter((l) => String(l.action || "").toUpperCase() === "DELETE").length,
    };
  }, [auditLogs, riskyLogs]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-muted">Audit dashboard yüklənir...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-error-card">
          <h2>Xəta</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">Audit Dashboard</p>
          <h1>Sistem fəaliyyətləri və dəyişikliklər</h1>
          <p>
            Burada son əməliyyatlar, riskli dəyişikliklər və silinmə/update
            fəaliyyətləri izlənilir.
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-4">
        <StatCard title="Son qeydlər" value={stats.total} note="Son 100 audit log" />
        <StatCard title="Riskli əməliyyatlar" value={stats.risky} note="DELETE/UPDATE/permission" />
        <StatCard title="Bugünkü əməliyyatlar" value={stats.today} note="Bu gün yaradılanlar" />
        <StatCard title="Silinmələr" value={stats.deletes} note="DELETE əməliyyatları" />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Riskli fəaliyyətlər</h2>
            <span>{riskyLogs.length}</span>
          </div>

          <div className="dashboard-list">
            {riskyLogs.slice(0, 20).map((log) => (
              <div className="dashboard-list-item" key={log.id}>
                <strong>{log.action}</strong>
                <span>{log.table_name || "-"}</span>
                <small>{formatDateTime(log.created_at)}</small>
              </div>
            ))}

            {riskyLogs.length === 0 && (
              <p className="dashboard-muted">Riskli fəaliyyət yoxdur.</p>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Son audit qeydləri</h2>
            <span>Son 20</span>
          </div>

          <div className="dashboard-list">
            {auditLogs.slice(0, 20).map((log) => (
              <div className="dashboard-list-item" key={log.id}>
                <strong>{log.action}</strong>
                <span>{log.table_name || "-"}</span>
                <small>{formatDateTime(log.created_at)}</small>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <p className="dashboard-muted">Audit qeydi yoxdur.</p>
            )}
          </div>
        </div>
      </section>
    </main>
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

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("az-AZ");
  } catch {
    return value;
  }
}