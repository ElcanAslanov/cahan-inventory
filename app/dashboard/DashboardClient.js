"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    companies: 0,
    categories: 0,
    inventory: 0,
    assigned: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);

    const [
      companiesRes,
      categoriesRes,
      inventoryRes,
      assignedRes,
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
    ]);

    setStats({
      companies: companiesRes.count || 0,
      categories: categoriesRes.count || 0,
      inventory: inventoryRes.count || 0,
      assigned: assignedRes.count || 0,
    });

    setLoading(false);
  }

  return (
    <div>
      <section style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>
            İnventarizasiya sisteminin ümumi göstəriciləri
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        <StatCard label="Şirkətlər" value={loading ? "..." : stats.companies} />
        <StatCard
          label="Kateqoriyalar"
          value={loading ? "..." : stats.categories}
        />
        <StatCard
          label="Bütün inventarlar"
          value={loading ? "..." : stats.inventory}
        />
        <StatCard
          label="Təhkim olunmuş"
          value={loading ? "..." : stats.assigned}
        />
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Növbəti mərhələ</h2>
        <p style={styles.panelText}>
          İndi layout və sidebar hazırdır. Növbəti addımda şirkətlər modulunu
          quracağıq: siyahı, əlavə etmə, düzəliş və status idarəsi.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.card}>
      <p style={styles.cardLabel}>{label}</p>
      <h2 style={styles.cardValue}>{value}</h2>
    </div>
  );
}

const styles = {
  pageHeader: {
    marginBottom: 22,
  },
  title: {
    margin: 0,
    fontSize: 30,
    color: "#0f172a",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  cardLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  cardValue: {
    margin: "10px 0 0",
    color: "#0f172a",
    fontSize: 30,
  },
  panel: {
    marginTop: 18,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 22,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
  },
  panelText: {
    color: "#475569",
    lineHeight: 1.6,
  },
};