"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RehberDashboard({ profile, allowedCompanyIds, accessScope }) {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, [allowedCompanyIds?.join(",")]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      if (!allowedCompanyIds || allowedCompanyIds.length === 0) {
        setAssets([]);
        setTasks([]);
        setUsers([]);
        return;
      }

      const [assetsRes, tasksRes, usersRes] = await Promise.all([
        supabase
          .from("assets")
          .select("id, name, status, company_id, assigned_to")
          .in("company_id", allowedCompanyIds),

        supabase
          .from("tasks")
          .select("id, title, status, priority, assigned_to, company_id")
          .in("company_id", allowedCompanyIds),

        supabase
          .from("profiles")
          .select("id, full_name, email, company_id, role")
          .in("company_id", allowedCompanyIds),
      ]);

      if (assetsRes.error) throw assetsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (usersRes.error) throw usersRes.error;

      setAssets(assetsRes.data || []);
      setTasks(tasksRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error("RehberDashboard error:", err);
      setError(err?.message || "Rəhbər dashboard yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    return {
      users: users.length,
      assets: assets.length,
      assignedAssets: assets.filter((a) => a.assigned_to).length,
      openTasks: tasks.filter((t) => t.status !== "DONE").length,
      urgentTasks: tasks.filter((t) => t.priority === "HIGH" || t.priority === "URGENT").length,
    };
  }, [users, assets, tasks]);

  const taskStatusRows = useMemo(() => {
    const map = {};

    for (const task of tasks) {
      const key = task.status || "UNKNOWN";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [tasks]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-muted">Rəhbər dashboard yüklənir...</p>
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
          <p className="dashboard-eyebrow">Rəhbər Dashboard</p>
          <h1>Komanda və şirkət üzrə nəzarət</h1>
          <p>
            Burada yalnız sənə icazə verilən şirkətlər üzrə istifadəçilər,
            assetlər və tapşırıqlar görünür.
          </p>
          <p className="dashboard-muted">
            Access scope: <strong>{accessScope}</strong>
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-3">
        <StatCard title="İstifadəçilər" value={stats.users} note="İcazəli şirkətlər üzrə" />
        <StatCard title="Assetlər" value={stats.assets} note="Şirkət inventarları" />
        <StatCard title="Təhkim olunmuş" value={stats.assignedAssets} note="İşçilərə verilmiş" />
        <StatCard title="Açıq tapşırıqlar" value={stats.openTasks} note="Tamamlanmamış" />
        <StatCard title="Təcili tapşırıqlar" value={stats.urgentTasks} note="HIGH və URGENT" />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Tapşırıq statusları</h2>
            <span>{tasks.length} tapşırıq</span>
          </div>

          <div className="dashboard-chart-list">
            {taskStatusRows.length === 0 ? (
              <p className="dashboard-muted">Tapşırıq yoxdur.</p>
            ) : (
              taskStatusRows.map((row) => (
                <ChartRow key={row.label} label={row.label} value={row.value} max={tasks.length} />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Son tapşırıqlar</h2>
            <span>Top 8</span>
          </div>

          <div className="dashboard-list">
            {tasks.slice(0, 8).map((task) => (
              <div className="dashboard-list-item" key={task.id}>
                <strong>{task.title}</strong>
                <span>{task.status || "-"}</span>
                <small>{task.priority || "NORMAL"}</small>
              </div>
            ))}

            {tasks.length === 0 && (
              <p className="dashboard-muted">Tapşırıq yoxdur.</p>
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