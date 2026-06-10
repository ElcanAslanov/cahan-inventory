import { createClient } from "@supabase/supabase-js";
import "@/styles/inventory-qr-public.css";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusLabel(status) {
  const map = {
    IN_STOCK: "Anbarda",
    ASSIGNED: "Təhkim olunub",
    IN_REPAIR: "Təmirdə",
    LOST: "İtib",
    WRITTEN_OFF: "Silinib",
    DISPOSED: "İstifadədən çıxarılıb",
  };

  return map[status] || status || "-";
}

function conditionLabel(condition) {
  const map = {
    NEW: "Yeni",
    GOOD: "Yaxşı",
    NORMAL: "Normal",
    DAMAGED: "Zədələnmiş",
    UNUSABLE: "Yararsız",
  };

  return map[condition] || condition || "-";
}

function warrantyLabel(item) {
  if (!item?.warranty_end_date) return "Zəmanət yoxdur";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(item.warranty_end_date);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Zəmanət bitib";
  if (diffDays <= 30) return `${diffDays} günə bitir`;

  return "Aktiv";
}

function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase env dəyişənləri tapılmadı.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function InventoryQrPublicPage({ params }) {
  const token = decodeURIComponent(params.token || "");

  let item = null;
  let errorText = "";

  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("inventory_items")
      .select(
        `
        id,
        inventory_code,
        name,
        description,
        serial_number,
        model,
        brand,
        status,
        condition,
        purchase_date,
        purchase_price,
        currency,
        warranty_start_date,
        warranty_end_date,
        qr_token,
        current_location,
        created_at,
        company:companies!inventory_items_company_id_fkey (
          id,
          name
        ),
        department:departments!inventory_items_department_id_fkey (
          id,
          name
        ),
        category:inventory_categories!inventory_items_category_id_fkey (
          id,
          name
        ),
        responsible:profiles!inventory_items_responsible_user_id_fkey (
          id,
          full_name
        )
      `
      )
      .eq("qr_token", token)
      .maybeSingle();

    if (error) {
      errorText = error.message || "İnventar məlumatı oxunarkən xəta baş verdi.";
    } else {
      item = data;
    }
  } catch (error) {
    errorText = error?.message || "Sistem xətası baş verdi.";
  }

  if (errorText) {
    return (
      <main className="qr-public-page">
        <section className="qr-public-error">
          <div>!</div>
          <h1>Xəta baş verdi</h1>
          <p>{errorText}</p>
        </section>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="qr-public-page">
        <section className="qr-public-error">
          <div>?</div>
          <h1>İnventar tapılmadı</h1>
          <p>
            Bu QR kod sistemdə aktiv inventara bağlı deyil və ya link yanlışdır.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="qr-public-page">
      <section className="qr-public-card">
        <div className="qr-public-hero">
          <div className="qr-public-logo">CI</div>

          <div>
            <span>Inventory QR</span>
            <h1>{item.name || "-"}</h1>
            <p>{item.inventory_code || "-"}</p>
          </div>
        </div>

        <div className="qr-public-status-row">
          <div>
            <span>Status</span>
            <strong>{statusLabel(item.status)}</strong>
          </div>

          <div>
            <span>Vəziyyət</span>
            <strong>{conditionLabel(item.condition)}</strong>
          </div>

          <div>
            <span>Zəmanət</span>
            <strong>{warrantyLabel(item)}</strong>
          </div>
        </div>

        <div className="qr-public-section">
          <h2>Əsas məlumatlar</h2>

          <div className="qr-public-grid">
            <InfoRow label="Brand" value={item.brand} />
            <InfoRow label="Model" value={item.model} />
            <InfoRow label="Seriya nömrəsi" value={item.serial_number} />
            <InfoRow label="Kateqoriya" value={item.category?.name} />
            <InfoRow label="Təsvir" value={item.description} full />
          </div>
        </div>

        <div className="qr-public-section">
          <h2>Təhkim və yerləşmə</h2>

          <div className="qr-public-grid">
            <InfoRow label="Şirkət" value={item.company?.name} />
            <InfoRow label="Departament" value={item.department?.name} />
            <InfoRow label="Məsul şəxs" value={item.responsible?.full_name} />
            <InfoRow label="Cari yerləşmə" value={item.current_location} />
          </div>
        </div>

        <div className="qr-public-section">
          <h2>Zəmanət və alış</h2>

          <div className="qr-public-grid">
            <InfoRow label="Alış tarixi" value={formatDate(item.purchase_date)} />
            <InfoRow
              label="Alış qiyməti"
              value={
                item.purchase_price
                  ? `${item.purchase_price} ${item.currency || "AZN"}`
                  : "-"
              }
            />
            <InfoRow
              label="Zəmanət başlanğıcı"
              value={formatDate(item.warranty_start_date)}
            />
            <InfoRow
              label="Zəmanət bitmə tarixi"
              value={formatDate(item.warranty_end_date)}
            />
          </div>
        </div>

        <footer className="qr-public-footer">
          <span>Cahan Inventory</span>
          <strong>{formatDate(item.created_at)}</strong>
        </footer>
      </section>
    </main>
  );
}

function InfoRow({ label, value, full }) {
  return (
    <div className={`qr-public-row ${full ? "full" : ""}`}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}