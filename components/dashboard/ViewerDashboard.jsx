"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ViewerDashboard({ profile, allowedCompanyIds, accessScope }) {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [tasks, setTasks] = useState([]);
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
        return;
      }

      const [assetsRes, tasksRes] = await Promise.all([
        supabase
          .from("assets")
          .select("id, name, status, company_id, assigned_to")
          .in("company_id", allowedCompanyIds),

        supabase
          .from("tasks")
          .select("id, title, status, priority, company_id")
          .in("company_id", allowedCompanyIds),
      ]);

      if (assetsRes.error) throw assetsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      setAssets(assetsRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (err) {
      console.error("ViewerDashboard error:", err);
      setError(err?.message || "İzləyici dashboard yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    return {
      assets: assets.length,
      assignedAssets: assets.filter((a) => a.assigned_to).length,
      tasks: tasks.length,
      openTasks: tasks.filter((t) => t.status !== "DONE").length,
    };
  }, [assets, tasks]);

  const assetStatusRows = useMemo(() => {
    const map = {};

    for (const asset of assets) {
      const key = asset.status || "UNKNOWN";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [assets]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-muted">İzləyici dashboard yüklənir...</p>
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
          <p className="dashboard-eyebrow">İzləyici Dashboard</p>
          <h1>Baxış paneli</h1>
          <p>
            Bu panel yalnız baxış üçündür. Add/Edit/Delete əməliyyatları bu rolda
            göstərilməməlidir.
          </p>
          <p className="dashboard-muted">
            Access scope: <strong>{accessScope}</strong>
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-4">
        <StatCard title="Assetlər" value={stats.assets} note="İcazəli şirkətlər üzrə" />
        <StatCard title="Təhkim olunmuş" value={stats.assignedAssets} note="Userlərə verilmiş" />
        <StatCard title="Tapşırıqlar" value={stats.tasks} note="Ümumi tapşırıq sayı" />
        <StatCard title="Açıq tapşırıqlar" value={stats.openTasks} note="Tamamlanmamış" />
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card-head">
          <h2>Asset status bölgüsü</h2>
          <span>{assetStatusRows.length} status</span>
        </div>

        <div className="dashboard-chart-list">
          {assetStatusRows.length === 0 ? (
            <p className="dashboard-muted">Məlumat yoxdur.</p>
          ) : (
            assetStatusRows.map((row) => (
              <ChartRow key={row.label} label={row.label} value={row.value} max={assets.length} />
            ))
          )}
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