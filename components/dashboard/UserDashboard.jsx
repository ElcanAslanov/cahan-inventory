"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function UserDashboard({ authUser, profile }) {
  const [loading, setLoading] = useState(true);
  const [myItems, setMyItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authUser?.id) {
      loadDashboard();
    }
  }, [authUser?.id]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      /**
       * Sənin DB-də assets table yoxdur.
       * Ona görə user üçün özünə təhkim olunmuş inventarları inventory_items-dən oxuyuruq.
       *
       * Qeyd:
       * Burada responsible_user_id istifadə etdim.
       * Əgər səndə column adı assigned_to və ya user_id-dirsə, sadəcə bu sətri dəyişəcəyik.
       */
      let { data, error } = await supabase
        .from("inventory_items")
        .select(
          `
          id,
          name,
          inventory_code,
          serial_number,
          status,
          health_status,
          company_id,
          responsible_user_id,
          created_at
        `
        )
        .eq("responsible_user_id", authUser.id)
        .order("created_at", { ascending: false });

      /**
       * Əgər responsible_user_id column-u səndə yoxdursa,
       * fallback kimi assigned_to ilə yoxlayırıq.
       */
      if (error) {
        console.warn("USER INVENTORY responsible_user_id warning:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        const fallback = await supabase
          .from("inventory_items")
          .select(
            `
            id,
            name,
            inventory_code,
            serial_number,
            status,
            health_status,
            company_id,
            assigned_to,
            created_at
          `
          )
          .eq("assigned_to", authUser.id)
          .order("created_at", { ascending: false });

        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("USER INVENTORY ERROR DETAILS:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        throw new Error(
          error.message ||
            error.details ||
            "İstifadəçiyə aid inventarlar oxunmadı."
        );
      }

      setMyItems(data || []);
    } catch (err) {
      console.error("UserDashboard error details:", {
        raw: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      setError(
        err?.message ||
          err?.details ||
          "User dashboard yüklənərkən xəta baş verdi."
      );
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: myItems.length,
      assigned: myItems.filter((item) => item.status === "ASSIGNED").length,
      inRepair: myItems.filter((item) => item.status === "IN_REPAIR").length,
      risky: myItems.filter(
        (item) =>
          item.health_status === "RISKY" ||
          item.health_status === "BAD" ||
          item.health_status === "CRITICAL"
      ).length,
    };
  }, [myItems]);

  const statusRows = useMemo(() => {
    const map = {};

    for (const item of myItems) {
      const key = item.status || "UNKNOWN";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map).map(([label, value]) => ({
      label: humanizeStatus(label),
      value,
    }));
  }, [myItems]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-muted">User dashboard yüklənir...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-error-card">
          <h2>Xəta</h2>
          <p>{error}</p>
          <button onClick={loadDashboard}>Yenidən yoxla</button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">User Dashboard</p>
          <h1>Mənə təhkim olunan inventarlar</h1>
          <p>
            Salam, {profile?.full_name || profile?.email || "İstifadəçi"}.
            Burada yalnız sənə təhkim olunmuş inventarlar görünür.
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-4">
        <StatCard
          title="Mənim inventarlarım"
          value={stats.total}
          note="Sənə təhkim olunanlar"
        />

        <StatCard
          title="Təhkim olunmuş"
          value={stats.assigned}
          note="ASSIGNED statuslu"
        />

        <StatCard
          title="Təmirdə"
          value={stats.inRepair}
          note="IN_REPAIR statuslu"
        />

        <StatCard
          title="Riskli"
          value={stats.risky}
          note="Health riski olanlar"
        />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Status bölgüsü</h2>
            <span>{myItems.length} inventar</span>
          </div>

          <div className="dashboard-chart-list">
            {statusRows.length === 0 ? (
              <p className="dashboard-muted">Məlumat yoxdur.</p>
            ) : (
              statusRows.map((row) => (
                <ChartRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  max={myItems.length}
                />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Son təhkim olunanlar</h2>
            <span>Top 10</span>
          </div>

          <div className="dashboard-list">
            {myItems.length === 0 ? (
              <p className="dashboard-muted">
                Sənə inventar təhkim olunmayıb.
              </p>
            ) : (
              myItems.slice(0, 10).map((item) => (
                <div className="dashboard-list-item" key={item.id}>
                  <strong>{item.name || "Adsız inventar"}</strong>
                  <span>{humanizeStatus(item.status)}</span>
                  <small>
                    {item.inventory_code || item.serial_number || "-"}
                  </small>
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

function humanizeStatus(status) {
  const value = String(status || "").toUpperCase();

  const map = {
    ASSIGNED: "Təhkim olunub",
    IN_STOCK: "Anbarda",
    IN_REPAIR: "Təmirdə",
    LOST: "İtib",
    BROKEN: "Sınıq",
    RETIRED: "Silinib",
    UNKNOWN: "Bilinmir",
  };

  return map[value] || status || "-";
}