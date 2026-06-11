"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ViewerDashboard({
  profile,
  allowedCompanyIds = [],
  accessScope = "OWN_COMPANY",
}) {
  const [loading, setLoading] = useState(true);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, [accessScope, JSON.stringify(allowedCompanyIds)]);

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

      let inventoryQuery = supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      let tasksQuery = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (accessScope !== "ALL_COMPANIES" && safeCompanyIds.length > 0) {
        companiesQuery = companiesQuery.in("id", safeCompanyIds);
        inventoryQuery = inventoryQuery.in("company_id", safeCompanyIds);
        tasksQuery = tasksQuery.in("company_id", safeCompanyIds);
      }

      if (
        accessScope !== "ALL_COMPANIES" &&
        safeCompanyIds.length === 0 &&
        profile?.company_id
      ) {
        companiesQuery = companiesQuery.eq("id", profile.company_id);
        inventoryQuery = inventoryQuery.eq("company_id", profile.company_id);
        tasksQuery = tasksQuery.eq("company_id", profile.company_id);
      }

      const [companiesRes, inventoryRes, tasksRes] = await Promise.all([
        companiesQuery,
        inventoryQuery,
        tasksQuery,
      ]);

      if (companiesRes.error) {
        console.warn("VIEWER COMPANIES WARNING:", {
          message: companiesRes.error.message,
          details: companiesRes.error.details,
          hint: companiesRes.error.hint,
          code: companiesRes.error.code,
        });
      }

      if (inventoryRes.error) {
        console.error("VIEWER INVENTORY ERROR DETAILS:", {
          message: inventoryRes.error.message,
          details: inventoryRes.error.details,
          hint: inventoryRes.error.hint,
          code: inventoryRes.error.code,
        });

        throw new Error(
          inventoryRes.error.message ||
            inventoryRes.error.details ||
            "İnventar məlumatları oxunmadı."
        );
      }

      if (tasksRes.error) {
        console.warn("VIEWER TASKS WARNING:", {
          message: tasksRes.error.message,
          details: tasksRes.error.details,
          hint: tasksRes.error.hint,
          code: tasksRes.error.code,
        });
      }

      setCompanies(companiesRes.data || []);
      setInventoryItems(inventoryRes.data || []);
      setTasks(tasksRes.error ? [] : tasksRes.data || []);
    } catch (err) {
      console.error("ViewerDashboard error details:", {
        raw: err,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      setError(err?.message || "İzləyici dashboard yüklənmədi.");
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
    const assignedItems = inventoryItems.filter((item) => {
      return (
        item.status === "ASSIGNED" ||
        item.responsible_user_id ||
        item.assigned_to ||
        item.user_id ||
        item.employee_id
      );
    });

    const inStockItems = inventoryItems.filter(
      (item) => item.status === "IN_STOCK"
    );

    const inRepairItems = inventoryItems.filter(
      (item) => item.status === "IN_REPAIR"
    );

    const riskyItems = inventoryItems.filter((item) => {
      const health = String(item.health_status || "").toUpperCase();

      return (
        health === "RISKY" ||
        health === "BAD" ||
        health === "CRITICAL" ||
        health === "WEAK"
      );
    });

    const openTasks = tasks.filter((task) => {
      const status = String(task.status || "").toUpperCase();
      return status !== "DONE" && status !== "COMPLETED" && status !== "CLOSED";
    });

    return {
      inventory: inventoryItems.length,
      assignedInventory: assignedItems.length,
      inStock: inStockItems.length,
      inRepair: inRepairItems.length,
      riskyInventory: riskyItems.length,
      companies: companies.length,
      tasks: tasks.length,
      openTasks: openTasks.length,
    };
  }, [inventoryItems, tasks, companies]);

  const inventoryStatusRows = useMemo(() => {
    const map = {};

    for (const item of inventoryItems) {
      const key = item.status || "UNKNOWN";
      map[key] = (map[key] || 0) + 1;
    }

    return Object.entries(map)
      .map(([label, value]) => ({
        label: humanizeStatus(label),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [inventoryItems]);

  const companyRows = useMemo(() => {
    const map = new Map();

    for (const item of inventoryItems) {
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
  }, [inventoryItems, companyMap]);

  const latestItems = useMemo(() => {
    return inventoryItems.slice(0, 10);
  }, [inventoryItems]);

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading-card">
          <div className="dashboard-loader" />
          <p>İzləyici dashboard yüklənir...</p>
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
          <p className="dashboard-eyebrow">İzləyici Dashboard</p>
          <h1>Baxış paneli</h1>
          <p>
            Salam, {profile?.full_name || profile?.email || "İzləyici"}. Bu
            panel yalnız baxış üçündür. Add/Edit/Delete əməliyyatları bu rolda
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
        <StatCard
          title="İnventarlar"
          value={stats.inventory}
          note="İcazəli şirkətlər üzrə"
        />

        <StatCard
          title="Təhkim olunmuş"
          value={stats.assignedInventory}
          note="Userlərə verilmiş inventarlar"
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
          title="Riskli inventarlar"
          value={stats.riskyInventory}
          note="Health status riskli olanlar"
        />

        <StatCard
          title="Şirkətlər"
          value={stats.companies}
          note={
            accessScope === "ALL_COMPANIES"
              ? "Bütün şirkətlər"
              : "İcazəli şirkətlər"
          }
        />

        <StatCard
          title="Açıq tapşırıqlar"
          value={stats.openTasks}
          note={`${stats.tasks} tapşırıq içindən`}
        />
      </section>

      <section className="dashboard-two-col">
        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>İnventar status bölgüsü</h2>
            <span>{inventoryStatusRows.length} status</span>
          </div>

          <div className="dashboard-chart-list">
            {inventoryStatusRows.length === 0 ? (
              <p className="dashboard-muted">Məlumat yoxdur.</p>
            ) : (
              inventoryStatusRows.map((row) => (
                <ChartRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  max={inventoryItems.length}
                />
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-head">
            <h2>Şirkətlər üzrə baxış</h2>
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
          <h2>Son inventarlar</h2>
          <span>Top 10</span>
        </div>

        <div className="dashboard-list">
          {latestItems.length === 0 ? (
            <p className="dashboard-muted">Inventar tapılmadı.</p>
          ) : (
            latestItems.map((item) => (
              <div className="dashboard-list-item" key={item.id}>
                <strong>{getItemName(item)}</strong>

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

function getItemName(item) {
  return (
    item.name ||
    item.item_name ||
    item.title ||
    item.inventory_name ||
    "Adsız inventar"
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
    DONE: "Tamamlanıb",
    COMPLETED: "Tamamlanıb",
    CLOSED: "Bağlanıb",
    OPEN: "Açıq",
    PENDING: "Gözləmədə",
    UNKNOWN: "Bilinmir",
  };

  return map[value] || status || "-";
}