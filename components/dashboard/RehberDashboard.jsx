"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function RehberDashboard({
  authUser,
  profile,
  allowedCompanyIds = [],
  accessScope = "OWN_COMPANY",
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authUser?.id) {
      loadDashboard();
    }
  }, [authUser?.id, accessScope, JSON.stringify(allowedCompanyIds)]);

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

      const { data: companyRows, error: companiesError } = await companiesQuery;

      if (companiesError) {
        throw new Error(
          companiesError.message ||
            companiesError.details ||
            "Şirkətlər oxunmadı."
        );
      }

      let itemsQuery = supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (accessScope !== "ALL_COMPANIES" && safeCompanyIds.length > 0) {
        itemsQuery = itemsQuery.in("company_id", safeCompanyIds);
      }

      if (
        accessScope !== "ALL_COMPANIES" &&
        safeCompanyIds.length === 0 &&
        profile?.company_id
      ) {
        itemsQuery = itemsQuery.eq("company_id", profile.company_id);
      }

      const { data: itemRows, error: itemsError } = await itemsQuery;

      if (itemsError) {
        console.error("REHBER INVENTORY ERROR DETAILS:", {
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
          code: itemsError.code,
        });

        throw new Error(
          itemsError.message ||
            itemsError.details ||
            "Rəhbər dashboard inventarları oxunmadı."
        );
      }

      setCompanies(companyRows || []);
      setItems(itemRows || []);
    } catch (err) {
      console.error("RehberDashboard error details:", {
        raw: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      setError(
        err?.message ||
          err?.details ||
          "Rəhbər dashboard yüklənərkən xəta baş verdi."
      );
    } finally {
      setLoading(false);
    }
  }

  const companyMap = useMemo(() => {
    const map = new Map();

    companies.forEach((company) => {
      map.set(String(company.id), company.name);
    });

    return map;
  }, [companies]);

  const stats = useMemo(() => {
    const total = items.length;

    const assigned = items.filter((item) => item.status === "ASSIGNED").length;
    const inStock = items.filter((item) => item.status === "IN_STOCK").length;
    const inRepair = items.filter((item) => item.status === "IN_REPAIR").length;

    const unassigned = items.filter((item) => {
      return (
        !item.responsible_user_id &&
        !item.assigned_to &&
        !item.user_id &&
        !item.employee_id &&
        item.status !== "ASSIGNED"
      );
    }).length;

    const risky = items.filter((item) => {
      const health = String(item.health_status || "").toUpperCase();

      return (
        health === "RISKY" ||
        health === "BAD" ||
        health === "CRITICAL" ||
        health === "WEAK"
      );
    }).length;

    return {
      total,
      assigned,
      inStock,
      inRepair,
      unassigned,
      risky,
    };
  }, [items]);

  const statusRows = useMemo(() => {
    const map = {};

    for (const item of items) {
      const key = item.status || "UNKNOWN";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map)
      .map(([label, value]) => ({
        label: humanizeStatus(label),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const companyRows = useMemo(() => {
    const map = new Map();

    for (const item of items) {
      const companyId = String(item.company_id || "NO_COMPANY");
      const companyName =
        companyId === "NO_COMPANY"
          ? "Şirkət seçilməyib"
          : companyMap.get(companyId) || "Naməlum şirkət";

      if (!map.has(companyId)) {
        map.set(companyId, {
          id: companyId,
          name: companyName,
          total: 0,
          assigned: 0,
          inStock: 0,
          inRepair: 0,
        });
      }

      const row = map.get(companyId);
      row.total += 1;

      if (item.status === "ASSIGNED") row.assigned += 1;
      if (item.status === "IN_STOCK") row.inStock += 1;
      if (item.status === "IN_REPAIR") row.inRepair += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [items, companyMap]);

  const latestItems = useMemo(() => {
    return items.slice(0, 10);
  }, [items]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading-card">
          <div className="dashboard-loader" />
          <p>Rəhbər dashboard yüklənir...</p>
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
          <p className="dashboard-eyebrow">Rəhbər Dashboard</p>
          <h1>Şirkət inventarlarına nəzarət</h1>
          <p>
            Salam, {profile?.full_name || profile?.email || "Rəhbər"}. Burada
            sənə icazə verilən şirkətlər üzrə inventar vəziyyəti görünür.
          </p>
        </div>

        <button className="dashboard-primary-btn" onClick={loadDashboard}>
          Yenilə
        </button>
      </section>

      <section className="dashboard-grid dashboard-grid-4">
        <StatCard
          title="Ümumi inventar"
          value={stats.total}
          note="İcazəli şirkətlər üzrə"
        />

        <StatCard
          title="Təhkim olunmuş"
          value={stats.assigned}
          note="ASSIGNED statuslu"
        />

        <StatCard
          title="Anbarda"
          value={stats.inStock}
          note="IN_STOCK statuslu"
        />

        <StatCard
          title="Təmirdə"
          value={stats.inRepair}
          note="IN_REPAIR statuslu"
        />
      </section>

      <section className="dashboard-grid dashboard-grid-3">
        <StatCard
          title="Məsul şəxssiz"
          value={stats.unassigned}
          note="Təhkim edilməyən inventarlar"
        />

        <StatCard
          title="Riskli inventar"
          value={stats.risky}
          note="Health status riskli olanlar"
        />

        <StatCard
          title="Şirkət sayı"
          value={companies.length}
          note={
            accessScope === "ALL_COMPANIES"
              ? "Bütün şirkətlər"
              : "İcazəli şirkətlər"
          }
        />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Status bölgüsü</h2>
            <span>{items.length} inventar</span>
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
                  max={items.length}
                />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Şirkətlər üzrə inventar</h2>
            <span>{companyRows.length} şirkət</span>
          </div>

          <div className="dashboard-list">
            {companyRows.length === 0 ? (
              <p className="dashboard-muted">Məlumat yoxdur.</p>
            ) : (
              companyRows.map((company) => (
                <div className="dashboard-list-item" key={company.id}>
                  <strong>{company.name}</strong>
                  <span>{company.total} inventar</span>
                  <small>
                    Təhkim: {company.assigned} · Anbar: {company.inStock} ·
                    Təmir: {company.inRepair}
                  </small>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-card" style={{ marginTop: 18 }}>
        <div className="dashboard-card-head">
          <h2>Son əlavə edilən inventarlar</h2>
          <span>Top 10</span>
        </div>

        <div className="dashboard-list">
          {latestItems.length === 0 ? (
            <p className="dashboard-muted">Inventar tapılmadı.</p>
          ) : (
            latestItems.map((item) => (
              <div className="dashboard-list-item" key={item.id}>
                <strong>
                  {item.name ||
                    item.item_name ||
                    item.title ||
                    item.inventory_name ||
                    "Adsız inventar"}
                </strong>

                <span>{humanizeStatus(item.status)}</span>

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