"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import KpiCard from "./KpiCard";

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalItems, setModalItems] = useState([]);

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
      supabase.from("inventory_items").select("id", { count: "exact", head: true }),
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

  async function openDetail(type) {
    setDetailModal(type);
    setModalItems([]);

    if (
      type === "noResponsible" ||
      type === "riskyHealth" ||
      type === "inRepair" ||
      type === "warrantyExpired" ||
      type === "warrantyExpiring" ||
      type === "riskRadarAll"
    ) {
      await loadModalItems(type);
    }
  }

  async function loadModalItems(type) {
    setModalLoading(true);

    try {
      let query;

      if (type === "noResponsible") {
        query = supabase
          .from("inventory_risk_radar_view")
          .select("*")
          .eq("is_unassigned", true);
      }

      if (type === "riskyHealth") {
        query = supabase
          .from("inventory_risk_radar_view")
          .select("*")
          .eq("is_health_risky", true);
      }

      if (type === "riskRadarAll") {
        query = supabase
          .from("inventory_risk_radar_view")
          .select("*")
          .or("is_unassigned.eq.true,is_health_risky.eq.true");
      }

      if (type === "inRepair") {
        query = supabase
          .from("inventory_items")
          .select("*")
          .eq("status", "IN_REPAIR");
      }

      if (type === "warrantyExpired") {
        query = supabase
          .from("inventory_warranty_alerts_view")
          .select("*")
          .eq("warranty_status", "EXPIRED");
      }

      if (type === "warrantyExpiring") {
        query = supabase
          .from("inventory_warranty_alerts_view")
          .select("*")
          .eq("warranty_status", "EXPIRING_30_DAYS");
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      setModalItems(data || []);
    } catch (err) {
      console.error("Modal items load error:", err);
      setModalItems([]);
    } finally {
      setModalLoading(false);
    }
  }

  function handleCardKeyDown(e, type) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail(type);
    }
  }

  const percentages = useMemo(() => {
    const total = stats.inventory || 0;

    return {
      assigned: total ? Math.round((stats.assigned / total) * 100) : 0,
      inStock: total ? Math.round((stats.inStock / total) * 100) : 0,
      inRepair: total ? Math.round((stats.inRepair / total) * 100) : 0,
      risk: total ? Math.round((stats.riskyHealth / total) * 100) : 0,
      noResponsible: total ? Math.round((stats.noResponsible / total) * 100) : 0,
      warrantyExpired: total
        ? Math.round((stats.warrantyExpired / total) * 100)
        : 0,
      warrantyExpiring: total
        ? Math.round((stats.warrantyExpiring / total) * 100)
        : 0,
    };
  }, [stats]);

  const riskIndex = useMemo(() => {
    if (!stats.inventory) return 0;

    return Math.min(
      100,
      Math.round(
        ((stats.warrantyExpired +
          stats.warrantyExpiring +
          stats.noResponsible +
          stats.riskyHealth +
          stats.inRepair) /
          stats.inventory) *
          100
      )
    );
  }, [stats]);

  const systemHealth = useMemo(() => {
    if (!stats.inventory) return 100;

    const assignedScore = percentages.assigned * 0.25;
    const stockScore = percentages.inStock * 0.15;
    const repairPenalty = percentages.inRepair * 0.8;
    const noResponsiblePenalty = percentages.noResponsible * 1.1;
    const riskyPenalty = percentages.risk * 1.25;
    const warrantyExpiredPenalty = percentages.warrantyExpired * 0.9;
    const warrantyExpiringPenalty = percentages.warrantyExpiring * 0.45;

    const score =
      100 -
      repairPenalty -
      noResponsiblePenalty -
      riskyPenalty -
      warrantyExpiredPenalty -
      warrantyExpiringPenalty +
      assignedScore * 0.15 +
      stockScore * 0.1;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [stats, percentages]);

  const healthLabel =
    systemHealth >= 90
      ? "Stabil"
      : systemHealth >= 70
        ? "Nəzarət lazımdır"
        : "Risk yüksəkdir";

  const risks = [
    {
      id: "noResponsible",
      icon: "!",
      tone: "red",
      title: "Məsul şəxssiz",
      text: "Təhkim edilməyən inventarlar",
      count: stats.noResponsible,
      onClick: () => openDetail("noResponsible"),
    },
    {
      id: "inRepair",
      icon: "↻",
      tone: "amber",
      title: "Təmirdə",
      text: "İstifadədən kənar avadanlıqlar",
      count: stats.inRepair,
      onClick: () => openDetail("inRepair"),
    },
    {
      id: "riskyHealth",
      icon: "⌁",
      tone: "red",
      title: "Riskli health",
      text: "Baxış tələb edən inventarlar",
      count: stats.riskyHealth,
      onClick: () => openDetail("riskyHealth"),
    },
    {
      id: "warrantyExpired",
      icon: "⌛",
      tone: "amber",
      title: "Zəmanəti bitib",
      text: "Zəmanət xaricində olanlar",
      count: stats.warrantyExpired,
      onClick: () => openDetail("warrantyExpired"),
    },
    {
      id: "warrantyExpiring",
      icon: "◷",
      tone: "blue",
      title: "30 günə bitəcək",
      text: "Yaxın zamanda bitən zəmanətlər",
      count: stats.warrantyExpiring,
      onClick: () => openDetail("warrantyExpiring"),
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

        <button
          type="button"
          className="dash-hero-card dash-health-card dash-click-card"
          onClick={() => openDetail("systemHealth")}
        >
          <span>System health</span>
          <strong>{loading ? "..." : `${systemHealth}%`}</strong>
          <p>{healthLabel}</p>

          <div className="dash-hero-progress">
            <i style={{ width: `${systemHealth}%` }} />
          </div>

          <small>Üstünə bas — hesablama detalları</small>
        </button>
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
        <div
          className="dash-chart-card dash-click-card"
          role="button"
          tabIndex={0}
          onClick={() => openDetail("assetStatus")}
          onKeyDown={(e) => handleCardKeyDown(e, "assetStatus")}
        >
          <div className="dash-chart-head">
            <div>
              <span>Asset status</span>
              <h3>Status bölgüsü</h3>
            </div>
            <em>Detallı bax</em>
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

        <div
          className="dash-chart-card dash-click-card"
          role="button"
          tabIndex={0}
          onClick={() => openDetail("warranty")}
          onKeyDown={(e) => handleCardKeyDown(e, "warranty")}
        >
          <div className="dash-chart-head">
            <div>
              <span>Warranty</span>
              <h3>Zəmanət nəzarəti</h3>
            </div>
            <em>Detallı bax</em>
          </div>

          <div className="dash-warranty-grid">
            <button
              type="button"
              className="dash-warranty-click"
              onClick={(e) => {
                e.stopPropagation();
                openDetail("warrantyExpired");
              }}
            >
              <WarrantyBox
                label="Zəmanəti bitib"
                value={stats.warrantyExpired}
                tone="danger"
              />
            </button>

            <button
              type="button"
              className="dash-warranty-click"
              onClick={(e) => {
                e.stopPropagation();
                openDetail("warrantyExpiring");
              }}
            >
              <WarrantyBox
                label="30 günə bitəcək"
                value={stats.warrantyExpiring}
                tone="warning"
              />
            </button>

            <button
              type="button"
              className="dash-warranty-click"
              onClick={(e) => {
                e.stopPropagation();
                openDetail("noResponsible");
              }}
            >
              <WarrantyBox
                label="Məsul şəxssiz"
                value={stats.noResponsible}
                tone="info"
              />
            </button>
          </div>

          <div className="dash-risk-meter">
            <div>
              <span>Risk indeksi</span>
              <strong>{riskIndex}%</strong>
            </div>

            <i>
              <b style={{ width: `${riskIndex}%` }} />
            </i>
          </div>
        </div>

        <DashboardRiskRadar
          risks={risks}
          riskIndex={riskIndex}
          onOpenAll={() => openDetail("riskRadarAll")}
        />
      </section>

      {detailModal && (
        <DashboardDetailModal
          type={detailModal}
          stats={stats}
          percentages={percentages}
          systemHealth={systemHealth}
          healthLabel={healthLabel}
          riskIndex={riskIndex}
          modalItems={modalItems}
          modalLoading={modalLoading}
          onClose={() => setDetailModal(null)}
          openDetail={openDetail}
        />
      )}
    </div>
  );
}

function DashboardRiskRadar({ risks, riskIndex, onOpenAll }) {
  const totalRiskCount = risks.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="dash-risk-radar">
      <div className="dash-risk-radar-head">
        <div>
          <span>Risk radar</span>
          <h3>Riskli göstəricilər</h3>
        </div>

        <button
          type="button"
          className="dash-risk-all-btn"
          onClick={onOpenAll}
          disabled={!totalRiskCount}
        >
          Hamısına bax
        </button>
      </div>

      {risks.length ? (
        <div className="dash-risk-list">
          {risks.map((risk) => (
            <button
              key={risk.id}
              type="button"
              className={`dash-risk-item tone-${risk.tone} dash-risk-clickable`}
              onClick={risk.onClick}
            >
              <span className={`dash-risk-icon tone-${risk.tone}`}>
                {risk.icon}
              </span>

              <span className="dash-risk-body">
                <strong>{risk.title}</strong>
                <p>{risk.text}</p>
                <small>Siyahıya bax</small>
              </span>

              <span className="dash-risk-count">{risk.count}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="dash-risk-empty">
          <strong>Risk yoxdur</strong>
          <p>Bütün inventar göstəriciləri stabil görünür.</p>
        </div>
      )}

      <div className="dash-risk-radar-footer">
        <span>Ümumi risk indeksi</span>
        <strong>{riskIndex}%</strong>
      </div>
    </div>
  );
}

function DashboardDetailModal({
  type,
  stats,
  percentages,
  systemHealth,
  healthLabel,
  riskIndex,
  modalItems,
  modalLoading,
  onClose,
  openDetail,
}) {
  const titleMap = {
    noResponsible: "Məsul şəxssiz inventarlar",
    riskyHealth: "Riskli health inventarlar",
    inRepair: "Təmirdə olan inventarlar",
    warrantyExpired: "Zəmanəti bitmiş inventarlar",
    warrantyExpiring: "30 günə bitəcək zəmanətlər",
    riskRadarAll: "Bütün risk radar inventarları",
  };

  const isListModal = [
    "noResponsible",
    "riskyHealth",
    "inRepair",
    "warrantyExpired",
    "warrantyExpiring",
    "riskRadarAll",
  ].includes(type);

  return (
    <div className="dash-detail-backdrop" onClick={onClose}>
      <div className="dash-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="dash-detail-close" onClick={onClose}>
          ×
        </button>

        {type === "systemHealth" && (
          <>
            <span className="dash-detail-kicker">System health</span>
            <h2>
              {systemHealth}% — {healthLabel}
            </h2>

            <p>
              Bu göstərici inventarların təhkim vəziyyəti, anbarda olması,
              təmirdə olması, məsul şəxssiz qalması, health riski və zəmanət
              riskləri əsasında hesablanır.
            </p>

            <div className="dash-detail-score">
              <strong>{systemHealth}%</strong>
              <i>
                <b style={{ width: `${systemHealth}%` }} />
              </i>
            </div>

            <DetailGrid
              items={[
                ["Ümumi inventar", stats.inventory],
                [
                  "Təhkim olunmuş",
                  `${stats.assigned} / ${percentages.assigned}%`,
                ],
                ["Anbarda", `${stats.inStock} / ${percentages.inStock}%`],
                ["Təmirdə", `${stats.inRepair} / ${percentages.inRepair}%`],
                [
                  "Məsul şəxssiz",
                  `${stats.noResponsible} / ${percentages.noResponsible}%`,
                  () => openDetail("noResponsible"),
                ],
                [
                  "Riskli health",
                  `${stats.riskyHealth} / ${percentages.risk}%`,
                  () => openDetail("riskyHealth"),
                ],
                [
                  "Zəmanəti bitib",
                  stats.warrantyExpired,
                  () => openDetail("warrantyExpired"),
                ],
                [
                  "30 günə bitəcək",
                  stats.warrantyExpiring,
                  () => openDetail("warrantyExpiring"),
                ],
              ]}
            />

            <div className="dash-formula-box">
              <b>Hesablama məntiqi:</b>
              <p>
                100 baldan risklər çıxılır. Təmirdə, məsul şəxssiz, riskli
                health, bitmiş zəmanət və yaxın zamanda bitəcək zəmanət balı
                aşağı salır.
              </p>
            </div>
          </>
        )}

        {type === "assetStatus" && (
          <>
            <span className="dash-detail-kicker">Asset status</span>
            <h2>Status bölgüsü</h2>

            <DetailGrid
              items={[
                ["Ümumi inventar", stats.inventory],
                [
                  "Təhkim olunmuş",
                  `${stats.assigned} / ${percentages.assigned}%`,
                ],
                ["Anbarda", `${stats.inStock} / ${percentages.inStock}%`],
                [
                  "Təmirdə",
                  `${stats.inRepair} / ${percentages.inRepair}%`,
                  () => openDetail("inRepair"),
                ],
              ]}
            />
          </>
        )}

        {type === "warranty" && (
          <>
            <span className="dash-detail-kicker">Warranty</span>
            <h2>Zəmanət detalları</h2>

            <DetailGrid
              items={[
                [
                  "Zəmanəti bitib",
                  stats.warrantyExpired,
                  () => openDetail("warrantyExpired"),
                ],
                [
                  "30 günə bitəcək",
                  stats.warrantyExpiring,
                  () => openDetail("warrantyExpiring"),
                ],
                [
                  "Məsul şəxssiz inventar",
                  stats.noResponsible,
                  () => openDetail("noResponsible"),
                ],
                ["Ümumi risk indeksi", `${riskIndex}%`],
              ]}
            />
          </>
        )}

        {isListModal && (
          <>
            <span className="dash-detail-kicker">Inventar siyahısı</span>
            <h2>{titleMap[type]}</h2>

            {modalLoading ? (
              <div className="dash-list-loading">Yüklənir...</div>
            ) : modalItems.length ? (
              <div className="dash-inventory-list">
                {modalItems.map((item, index) => (
                  <InventoryListItem
                    key={item.id || item.inventory_id || index}
                    item={item}
                    type={type}
                  />
                ))}
              </div>
            ) : (
              <div className="dash-empty-list">
                Bu kateqoriyaya uyğun inventar tapılmadı.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InventoryListItem({ item, type }) {
  const name =
    item.name ||
    item.item_name ||
    item.inventory_name ||
    item.asset_name ||
    item.title ||
    "Adsız inventar";

  const code =
    item.code ||
    item.inventory_code ||
    item.asset_code ||
    item.serial_number ||
    item.barcode ||
    "Kod yoxdur";

  const category =
    item.category_name ||
    item.category ||
    item.inventory_category_name ||
    "Kateqoriya yoxdur";

  const company =
    item.company_name ||
    item.company ||
    item.company_title ||
    "Şirkət yoxdur";

  const responsible =
    item.responsible_name ||
    item.assigned_to_name ||
    item.employee_name ||
    item.full_name ||
    "Məsul şəxs yoxdur";

  const status = item.status || item.inventory_status || "-";

  const warranty =
    item.warranty_end_date ||
    item.warranty_until ||
    item.warranty_expire_date ||
    item.warranty_date ||
    "";

  const isUnassigned = item.is_unassigned === true;
  const isHealthRisky = item.is_health_risky === true;

  return (
    <div className="dash-inventory-item">
      <div>
        <strong>{name}</strong>
        <span>{code}</span>
      </div>

      <div className="dash-inventory-meta">
        <p>
          <b>Kateqoriya:</b> {category}
        </p>
        <p>
          <b>Şirkət:</b> {company}
        </p>
        <p>
          <b>Status:</b> {status}
        </p>
        <p>
          <b>Məsul şəxs:</b> {responsible}
        </p>

        {warranty && (
          <p>
            <b>Zəmanət:</b> {formatDate(warranty)}
          </p>
        )}

        {(type === "riskRadarAll" || isUnassigned || isHealthRisky) && (
          <p>
            <b>Risk səbəbi:</b>{" "}
            {getRiskReason({ type, isUnassigned, isHealthRisky })}
          </p>
        )}
      </div>
    </div>
  );
}

function getRiskReason({ type, isUnassigned, isHealthRisky }) {
  if (type === "noResponsible") return "Məsul şəxs yoxdur";
  if (type === "riskyHealth") return "Health riski var";
  if (type === "inRepair") return "Təmirdədir";
  if (type === "warrantyExpired") return "Zəmanəti bitib";
  if (type === "warrantyExpiring") return "Zəmanəti 30 günə bitəcək";

  const reasons = [];

  if (isUnassigned) reasons.push("Məsul şəxs yoxdur");
  if (isHealthRisky) reasons.push("Health riski var");

  return reasons.length ? reasons.join(", ") : "Risk radar siyahısı";
}

function DetailGrid({ items }) {
  return (
    <div className="dash-detail-grid">
      {items.map(([label, value, onClick]) => {
        const Tag = onClick ? "button" : "div";

        return (
          <Tag
            key={label}
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={onClick ? "dash-detail-grid-clickable" : ""}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            {onClick && <small>Siyahıya bax</small>}
          </Tag>
        );
      })}
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
      <small>Siyahıya bax</small>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}