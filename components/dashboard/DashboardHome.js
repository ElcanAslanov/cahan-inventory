"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import KpiCard from "./KpiCard";
import RiskRadar from "./RiskRadar";
import SmartSuggestions from "./SmartSuggestions";

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
  companies: 0,
  categories: 0,
  inventory: 0,
  assigned: 0,
  inRepair: 0,
  noResponsible: 0,
  oldAssets: 0,
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
    inRepair: repairRes.count || 0,
    noResponsible: noResponsibleRes.count || 0,
    oldAssets: riskyHealthRes.count || 0,
    warrantyExpired: warrantyExpiredRes.count || 0,
    warrantyExpiring: warrantyExpiringRes.count || 0,
  });

  setLoading(false);
}

  const risks = [
  {
    id: "noResponsible",
    icon: "!",
    tone: "red",
    title: "Məsul şəxssiz inventarlar",
    text: "Bu inventarlar heç bir istifadəçiyə təhkim edilməyib.",
    count: stats.noResponsible,
  },
  {
    id: "inRepair",
    icon: "↻",
    tone: "amber",
    title: "Təmirdə olan inventarlar",
    text: "Bu avadanlıqlar hazırda istifadədə deyil.",
    count: stats.inRepair,
  },
  {
    id: "riskyHealth",
    icon: "⌁",
    tone: "red",
    title: "Health Score riski yüksək olanlar",
    text: "Sağlamlıq balı aşağı olan inventarlar dəyişdirilmə və ya baxış tələb edir.",
    count: stats.oldAssets,
  },
  {
    id: "warrantyExpired",
    icon: "⌛",
    tone: "amber",
    title: "Zəmanəti bitmiş inventarlar",
    text: "Bu inventarlar artıq zəmanət əhatəsində deyil.",
    count: stats.warrantyExpired,
  },
  {
    id: "warrantyExpiring",
    icon: "◷",
    tone: "blue",
    title: "30 günə zəmanəti bitəcək",
    text: "Bu inventarlar üçün əvvəlcədən tədbir görülə bilər.",
    count: stats.warrantyExpiring,
  },
].filter((item) => item.count > 0);

  const suggestions = [
    {
      id: "qr",
      icon: "▣",
      title: "QR inventar pasportu aktivləşdirilə bilər",
      text: "Hər inventar üçün scan edilə bilən unikal pasport səhifəsi yaradacağıq.",
    },
    {
      id: "health",
      icon: "◉",
      title: "Asset Health Score əlavə ediləcək",
      text: "Status, təmir və istifadə müddətinə əsasən inventar sağlamlıq balı hesablanacaq.",
    },
    {
      id: "handover",
      icon: "✓",
      title: "Elektron təhvil-təslim axını",
      text: "İstifadəçi inventarı sistem üzərindən qəbul və ya qaytarma təsdiqi verəcək.",
    },
  ];

  return (
    <div className="dash-home">
      <section className="dash-home-hero">
        <div>
          <span className="dash-home-kicker">Smart inventory workspace</span>
          <h1>Inventar nəzarətini daha ağıllı və şəffaf idarə et.</h1>
          <p>
            Şirkətlər, əsas vəsaitlər, təhkimlər, risklər və tövsiyələr vahid
            modern dashboard-da.
          </p>
        </div>

        <div className="dash-hero-card">
          <span>System health</span>
          <strong>{loading ? "..." : "98%"}</strong>
          <p>Realtime asset overview</p>

          <div className="dash-hero-progress">
            <i />
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Bütün inventarlar"
          value={loading ? "..." : stats.inventory}
          helper="Sistemə daxil edilmiş aktiv və passiv qeydlər"
          tone="blue"
        />

        <KpiCard
          label="Təhkim olunmuş"
          value={loading ? "..." : stats.assigned}
          helper="İstifadəçilərə bağlı inventarlar"
          tone="cyan"
        />

        <KpiCard
          label="Təmirdə"
          value={loading ? "..." : stats.inRepair}
          helper="Hazırda istifadədə olmayan avadanlıqlar"
          tone="amber"
        />

        <KpiCard
          label="Şirkətlər"
          value={loading ? "..." : stats.companies}
          helper="Sistem üzrə qeydiyyatda olan şirkətlər"
          tone="violet"
        />
      </section>

      <section className="dash-home-grid">
        <RiskRadar risks={risks} />
        <SmartSuggestions suggestions={suggestions} />
      </section>
    </div>
  );
}