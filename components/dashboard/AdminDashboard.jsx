"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard({ profile, allowedCompanyIds }) {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [assets, setAssets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        companiesRes,
        assetsRes,
        tasksRes,
        auditRes,
      ] = await Promise.all([
        supabase.from("companies").select("id, name"),
        supabase.from("assets").select("id, name, status, company_id, assigned_to, category_id"),
        supabase.from("tasks").select("id, title, status, priority, assigned_to, company_id"),
        supabase
          .from("audit_logs")
          .select("id, action, table_name, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (assetsRes.error) throw assetsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (auditRes.error) throw auditRes.error;

      setCompanies(companiesRes.data || []);
      setAssets(assetsRes.data || []);
      setTasks(tasksRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error("AdminDashboard error:", err);
      setError(err?.message || "Admin dashboard yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const assignedAssets = assets.filter((a) => a.assigned_to).length;
    const freeAssets = assets.filter((a) => !a.assigned_to).length;
    const activeTasks = tasks.filter((t) => t.status !== "DONE").length;
    const completedTasks = tasks.filter((t) => t.status === "DONE").length;

    return {
      totalCompanies: companies.length,
      totalAssets,
      assignedAssets,
      freeAssets,
      activeTasks,
      completedTasks,
    };
  }, [companies, assets, tasks]);

  const assetsByStatus = useMemo(() => {
    const map = {};

    for (const asset of assets) {
      const key = asset.status || "UNKNOWN";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map).map(([status, count]) => ({
      label: status,
      value: count,
    }));
  }, [assets]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-muted">Admin dashboard yüklənir...</p>
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
          <p className="dashboard-eyebrow">Admin Dashboard</p>
          <h1>Ümumi idarəetmə paneli</h1>
          <p>
            Salam, {profile?.full_name || profile?.email || "Admin"}. Burada bütün şirkətlər,
            inventarlar, tapşırıqlar və son audit fəaliyyətləri görünür.
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-3">
        <StatCard title="Şirkətlər" value={stats.totalCompanies} note="Bütün şirkətlər" />
        <StatCard title="Assetlər" value={stats.totalAssets} note="Ümumi inventar sayı" />
        <StatCard title="Təhkim olunmuş" value={stats.assignedAssets} note="İstifadəçilərə verilənlər" />
        <StatCard title="Boş assetlər" value={stats.freeAssets} note="Hələ təhkim olunmayıb" />
        <StatCard title="Aktiv tapşırıqlar" value={stats.activeTasks} note="Bağlanmamış tapşırıqlar" />
        <StatCard title="Bitmiş tapşırıqlar" value={stats.completedTasks} note="Tamamlanmış işlər" />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Asset status bölgüsü</h2>
            <span>{assetsByStatus.length} status</span>
          </div>

          <div className="dashboard-chart-list">
            {assetsByStatus.length === 0 ? (
              <p className="dashboard-muted">Məlumat yoxdur.</p>
            ) : (
              assetsByStatus.map((item) => (
                <ChartRow key={item.label} label={item.label} value={item.value} max={stats.totalAssets} />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Son audit fəaliyyətləri</h2>
            <span>Son 10</span>
          </div>

          <div className="dashboard-list">
            {auditLogs.length === 0 ? (
              <p className="dashboard-muted">Audit qeydi yoxdur.</p>
            ) : (
              auditLogs.map((log) => (
                <div className="dashboard-list-item" key={log.id}>
                  <strong>{log.action}</strong>
                  <span>{log.table_name || "-"}</span>
                  <small>{formatDateTime(log.created_at)}</small>
                </div>
              ))
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

function ChartRow({ label, value, max }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;

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

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("az-AZ");
  } catch {
    return value;
  }
}