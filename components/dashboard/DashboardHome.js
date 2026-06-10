"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import KpiCard from "./KpiCard";
import RiskRadar from "./RiskRadar";

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    companies: 0,
    categories: 0,
    inventory: 0,
    assigned: 0,
    inStock: 0,
    inRepair: 0,
    noResponsible: 0,
    riskyHealth: 0,
    warrantyExpired: 0,
    warrantyExpiring: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const [
      companiesRes,
      categoriesRes,
      inventoryRes,
      assignedRes,
      inStockRes,
      repairRes,
      noResponsibleRes,
      riskyHealthRes,
      warrantyExpiredRes,
      warrantyExpiringRes,
    ] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),

      supabase
        .from("inventory_categories")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "ASSIGNED"),

      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "IN_STOCK"),

      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "IN_REPAIR"),

      supabase
        .from("inventory_risk_radar_view")
        .select("id", { count: "exact", head: true })
        .eq("is_unassigned", true),

      supabase
        .from("inventory_risk_radar_view")
        .select("id", { count: "exact", head: true })
        .eq("is_health_risky", true),

      supabase
        .from("inventory_warranty_alerts_view")
        .select("id", { count: "exact", head: true })
        .eq("warranty_status", "EXPIRED"),

      supabase
        .from("inventory_warranty_alerts_view")
        .select("id", { count: "exact", head: true })
        .eq("warranty_status", "EXPIRING_30_DAYS"),
    ]);

    setStats({
      companies: companiesRes.count || 0,
      categories: categoriesRes.count || 0,
      inventory: inventoryRes.count || 0,
      assigned: assignedRes.count || 0,
      inStock: inStockRes.count || 0,
      inRepair: repairRes.count || 0,
      noResponsible: noResponsibleRes.count || 0,
      riskyHealth: riskyHealthRes.count || 0,
      warrantyExpired: warrantyExpiredRes.count || 0,
      warrantyExpiring: warrantyExpiringRes.count || 0,
    });

    setLoading(false);
  }

  const percentages = useMemo(() => {
    const total = stats.inventory || 0;

    return {
      assigned: total ? Math.round((stats.assigned / total) * 100) : 0,
      inStock: total ? Math.round((stats.inStock / total) * 100) : 0,
      inRepair: total ? Math.round((stats.inRepair / total) * 100) : 0,
      risk: total ? Math.round((stats.riskyHealth / total) * 100) : 0,
    };
  }, [stats]);

  const systemHealth = useMemo(() => {
    if (!stats.inventory) return 100;

    const riskWeight =
      stats.noResponsible * 1.4 +
      stats.riskyHealth * 1.7 +
      stats.warrantyExpired * 1.1 +
      stats.inRepair * 0.8;

    const score = Math.max(
      0,
      Math.min(100, Math.round(100 - (riskWeight / stats.inventory) * 12))
    );

    return score;
  }, [stats]);

  const risks = [
    {
      id: "noResponsible",
      icon: "!",
      tone: "red",
      title: "Məsul şəxssiz",
      text: "Təhkim edilməyən inventarlar",
      count: stats.noResponsible,
    },
    {
      id: "inRepair",
      icon: "↻",
      tone: "amber",
      title: "Təmirdə",
      text: "İstifadədən kənar avadanlıqlar",
      count: stats.inRepair,
    },
    {
      id: "riskyHealth",
      icon: "⌁",
      tone: "red",
      title: "Riskli health",
      text: "Baxış tələb edən inventarlar",
      count: stats.riskyHealth,
    },
    {
      id: "warrantyExpired",
      icon: "⌛",
      tone: "amber",
      title: "Zəmanəti bitib",
      text: "Zəmanət xaricində olanlar",
      count: stats.warrantyExpired,
    },
    {
      id: "warrantyExpiring",
      icon: "◷",
      tone: "blue",
      title: "30 günə bitəcək",
      text: "Yaxın zamanda bitən zəmanətlər",
      count: stats.warrantyExpiring,
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="dash-home">
      <section className="dash-home-hero dash-home-hero-compact">
        <div>
          <span className="dash-home-kicker">Inventory overview</span>
          <h1>Dashboard</h1>
          <p>İnventar, təhkim, risk və zəmanət göstəriciləri.</p>
        </div>

        <div className="dash-hero-card dash-health-card">
          <span>System health</span>
          <strong>{loading ? "..." : `${systemHealth}%`}</strong>
          <p>
            {systemHealth >= 90
              ? "Stabil"
              : systemHealth >= 70
                ? "Nəzarət lazımdır"
                : "Risk yüksəkdir"}
          </p>

          <div className="dash-hero-progress">
            <i style={{ width: `${systemHealth}%` }} />
          </div>
        </div>
      </section>

      <section className="kpi-grid dash-kpi-grid-modern">
        <KpiCard
          label="Bütün inventarlar"
          value={loading ? "..." : stats.inventory}
          helper="Ümumi qeydiyyat"
          tone="blue"
        />

        <KpiCard
          label="Təhkim olunmuş"
          value={loading ? "..." : stats.assigned}
          helper={`${percentages.assigned}% inventar`}
          tone="cyan"
        />

        <KpiCard
          label="Anbarda"
          value={loading ? "..." : stats.inStock}
          helper={`${percentages.inStock}% inventar`}
          tone="violet"
        />

        <KpiCard
          label="Təmirdə"
          value={loading ? "..." : stats.inRepair}
          helper={`${percentages.inRepair}% inventar`}
          tone="amber"
        />

        <KpiCard
          label="Riskli"
          value={loading ? "..." : stats.riskyHealth}
          helper={`${percentages.risk}% health riski`}
          tone="red"
        />

        <KpiCard
          label="Şirkətlər"
          value={loading ? "..." : stats.companies}
          helper={`${stats.categories} kateqoriya`}
          tone="violet"
        />
      </section>

      <section className="dash-visual-grid">
        <div className="dash-chart-card">
          <div className="dash-chart-head">
            <div>
              <span>Asset status</span>
              <h3>Status bölgüsü</h3>
            </div>
          </div>

          <div
            className="dash-status-donut"
            style={{
              "--assigned": `${percentages.assigned * 3.6}deg`,
              "--stock": `${percentages.inStock * 3.6}deg`,
              "--repair": `${percentages.inRepair * 3.6}deg`,
            }}
          >
            <div>
              <strong>{stats.inventory}</strong>
              <span>inventar</span>
            </div>
          </div>

          <div className="dash-chart-bars">
            <ChartBar
              label="Təhkim olunub"
              value={stats.assigned}
              percent={percentages.assigned}
              tone="assigned"
            />

            <ChartBar
              label="Anbarda"
              value={stats.inStock}
              percent={percentages.inStock}
              tone="stock"
            />

            <ChartBar
              label="Təmirdə"
              value={stats.inRepair}
              percent={percentages.inRepair}
              tone="repair"
            />
          </div>
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-head">
            <div>
              <span>Warranty</span>
              <h3>Zəmanət nəzarəti</h3>
            </div>
          </div>

          <div className="dash-warranty-grid">
            <WarrantyBox
              label="Zəmanəti bitib"
              value={stats.warrantyExpired}
              tone="danger"
            />

            <WarrantyBox
              label="30 günə bitəcək"
              value={stats.warrantyExpiring}
              tone="warning"
            />

            <WarrantyBox
              label="Məsul şəxssiz"
              value={stats.noResponsible}
              tone="info"
            />
          </div>

          <div className="dash-risk-meter">
            <div>
              <span>Risk indeksi</span>
              <strong>
                {stats.inventory
                  ? Math.min(
                      100,
                      Math.round(
                        ((stats.warrantyExpired +
                          stats.warrantyExpiring +
                          stats.noResponsible +
                          stats.riskyHealth) /
                          stats.inventory) *
                          100
                      )
                    )
                  : 0}
                %
              </strong>
            </div>

            <i>
              <b
                style={{
                  width: `${
                    stats.inventory
                      ? Math.min(
                          100,
                          Math.round(
                            ((stats.warrantyExpired +
                              stats.warrantyExpiring +
                              stats.noResponsible +
                              stats.riskyHealth) /
                              stats.inventory) *
                              100
                          )
                        )
                      : 0
                  }%`,
                }}
              />
            </i>
          </div>
        </div>

        <RiskRadar risks={risks} />
      </section>
    </div>
  );
}

function ChartBar({ label, value, percent, tone }) {
  return (
    <div className="dash-chart-bar">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <i>
        <b className={`tone-${tone}`} style={{ width: `${percent}%` }} />
      </i>
    </div>
  );
}

function WarrantyBox({ label, value, tone }) {
  return (
    <div className={`dash-warranty-box tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}