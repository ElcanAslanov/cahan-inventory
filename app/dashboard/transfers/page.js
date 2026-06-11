"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const TRANSFER_TYPES = [
  { value: "USER", label: "Sistemdə olan istifadəçiyə təhkim et" },
  { value: "MANUAL", label: "Sistemdə olmayan/manual şəxsə təhkim et" },
  { value: "WAREHOUSE", label: "Anbara qaytar" },
];

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();

  if (value === "ADMIN") return "ADMIN";
  if (value === "REHBER" || value === "RƏHBƏR" || value === "REHBƏR") return "REHBER";
  if (value === "AUDIT" || value === "AUDİT") return "AUDIT";
  if (value === "IZLEYICI" || value === "İZLƏYİCİ" || value === "VIEWER") return "IZLEYICI";
  return value || "USER";
}

function canTransfer(role) {
  return ["ADMIN", "REHBER"].includes(normalizeRole(role));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOwnerText(item) {
  if (item?.responsible?.full_name) return item.responsible.full_name;
  if (item?.responsible_person_name) return item.responsible_person_name;
  return "Anbar / təhkim edilməyib";
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

export default function InventoryTransfersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    inventory_id: "",
    transfer_type: "USER",
    to_company_id: "",
    to_department_id: "",
    to_responsible_user_id: "",
    to_responsible_person_name: "",
    to_location: "",
    note: "",
  });

  const currentRole = normalizeRole(me?.user_role || me?.resolved_role || "USER");
  const allowed = canTransfer(currentRole);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Sessiya tapılmadı.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          user_role,
          company_id,
          access_scope,
          status,
          companies (
            id,
            name
          )
        `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.id) throw new Error("Profil tapılmadı.");

      const role = normalizeRole(profile.user_role);

      setMe({
        ...profile,
        resolved_role: role,
      });

      if (!canTransfer(role)) {
        setItems([]);
        setCompanies([]);
        setDepartments([]);
        setProfiles([]);
        return;
      }

      let inventoryQuery = supabase
        .from("inventory_items")
        .select(
          `
          id,
          inventory_code,
          name,
          serial_number,
          brand,
          model,
          status,
          company_id,
          department_id,
          responsible_user_id,
          responsible_person_name,
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
          responsible:profiles!inventory_items_responsible_user_id_fkey (
            id,
            full_name,
            email
          )
        `
        )
        .order("created_at", { ascending: false });

      let companiesQuery = supabase
        .from("companies")
        .select("id,name,status")
        .eq("status", "ACTIVE")
        .order("name");

      let departmentsQuery = supabase
        .from("departments")
        .select("id,name,company_id,status")
        .eq("status", "ACTIVE")
        .order("name");

      let profilesQuery = supabase
        .from("profiles")
        .select("id,full_name,email,company_id,department_id,status")
        .eq("status", "ACTIVE")
        .order("full_name");

      if (role === "REHBER" && profile.company_id) {
        inventoryQuery = inventoryQuery.eq("company_id", profile.company_id);
        companiesQuery = companiesQuery.eq("id", profile.company_id);
        departmentsQuery = departmentsQuery.eq("company_id", profile.company_id);
        profilesQuery = profilesQuery.eq("company_id", profile.company_id);
      }

      const [itemsRes, companiesRes, departmentsRes, profilesRes] =
        await Promise.all([
          inventoryQuery,
          companiesQuery,
          departmentsQuery,
          profilesQuery,
        ]);

      if (itemsRes.error) throw itemsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setItems(itemsRes.data || []);
      setCompanies(companiesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setProfiles(profilesRes.data || []);

      if (role === "REHBER" && profile.company_id) {
        setForm((prev) => ({
          ...prev,
          to_company_id: profile.company_id,
        }));
      }
    } catch (err) {
      console.error("TRANSFERS LOAD ERROR:", err);
      alert(err?.message || "Yerdəyişmə məlumatları yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = useMemo(() => {
    return items.find((item) => String(item.id) === String(form.inventory_id));
  }, [items, form.inventory_id]);

  const filteredDepartments = useMemo(() => {
    if (!form.to_company_id) return [];
    return departments.filter(
      (department) => String(department.company_id) === String(form.to_company_id)
    );
  }, [departments, form.to_company_id]);

  const filteredProfiles = useMemo(() => {
    if (!form.to_company_id) return [];

    let list = profiles.filter(
      (profile) => String(profile.company_id) === String(form.to_company_id)
    );

    if (form.to_department_id) {
      list = list.filter(
        (profile) =>
          !profile.department_id ||
          String(profile.department_id) === String(form.to_department_id)
      );
    }

    return list;
  }, [profiles, form.to_company_id, form.to_department_id]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const text = [
        item.inventory_code,
        item.name,
        item.brand,
        item.model,
        item.serial_number,
        item.company?.name,
        item.department?.name,
        item.responsible?.full_name,
        item.responsible_person_name,
        item.current_location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !q || text.includes(q);
    });
  }, [items, search]);

  function setField(name, value) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "inventory_id") {
        const item = items.find((x) => String(x.id) === String(value));

        next.to_company_id = item?.company_id || "";
        next.to_department_id = item?.department_id || "";
        next.to_responsible_user_id = "";
        next.to_responsible_person_name = "";
        next.to_location = item?.current_location || "";
      }

      if (name === "to_company_id") {
        next.to_department_id = "";
        next.to_responsible_user_id = "";
      }

      if (name === "to_department_id") {
        next.to_responsible_user_id = "";
      }

      if (name === "transfer_type") {
        next.to_responsible_user_id = "";
        next.to_responsible_person_name = "";

        if (value === "WAREHOUSE") {
          next.to_department_id = "";
        }
      }

      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!allowed) {
      alert("Bu əməliyyat üçün icazəniz yoxdur.");
      return;
    }

    if (!form.inventory_id) {
      alert("İnventar seçilməlidir.");
      return;
    }

    if (form.transfer_type === "USER" && !form.to_responsible_user_id) {
      alert("Yeni məsul şəxs seçilməlidir.");
      return;
    }

    if (form.transfer_type === "MANUAL" && !form.to_responsible_person_name.trim()) {
      alert("Manual məsul şəxs adı yazılmalıdır.");
      return;
    }

    setSaving(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch("/api/inventory/transfers", {
        method: "POST",
        headers,
        body: JSON.stringify({
          inventory_id: form.inventory_id,
          transfer_type: form.transfer_type,
          to_company_id: form.to_company_id || null,
          to_department_id:
            form.transfer_type === "WAREHOUSE"
              ? null
              : form.to_department_id || null,
          to_responsible_user_id:
            form.transfer_type === "USER"
              ? form.to_responsible_user_id || null
              : null,
          to_responsible_person_name:
            form.transfer_type === "MANUAL"
              ? form.to_responsible_person_name.trim()
              : null,
          to_location: form.to_location || null,
          note: form.note || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Yerdəyişmə zamanı xəta baş verdi.");
      }

      alert("Yerdəyişmə uğurla tamamlandı.");

      setForm({
        inventory_id: "",
        transfer_type: "USER",
        to_company_id: me?.resolved_role === "REHBER" ? me?.company_id || "" : "",
        to_department_id: "",
        to_responsible_user_id: "",
        to_responsible_person_name: "",
        to_location: "",
        note: "",
      });

      await loadInitialData();
    } catch (err) {
      console.error("TRANSFER SAVE ERROR:", err);
      alert(err?.message || "Yerdəyişmə zamanı xəta baş verdi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="settings-page">
        <div className="settings-empty">Yerdəyişmə məlumatları yüklənir...</div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="settings-page">
        <div className="settings-empty">
          <strong>İcazə yoxdur</strong>
          <p>Yerdəyişmə yalnız ADMIN və REHBER rolları üçün aktivdir.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-page">
      <div className="settings-hero users-hero-modern">
        <div>
          <h1>Yerdəyişmə</h1>
          <p>
            İnventarı bir məsul şəxsdən digərinə, manual şəxsə və ya anbara
            qaytarın. Bütün hərəkətlər loglarda saxlanılır.
          </p>
        </div>

        <button type="button" className="settings-primary-btn" onClick={loadInitialData}>
          Yenilə
        </button>
      </div>

      <div className="settings-table-card" style={{ padding: 18 }}>
        <form onSubmit={handleSubmit} className="transfer-grid">
          <div className="transfer-left">
            <label className="settings-field">
              <span>İnventar axtar</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kod, ad, seriya, məsul şəxs..."
              />
            </label>

            <label className="settings-field">
              <span>İnventar *</span>
              <select
                value={form.inventory_id}
                onChange={(e) => setField("inventory_id", e.target.value)}
                required
              >
                <option value="">İnventar seç</option>
                {filteredItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.inventory_code} · {item.name} · {getOwnerText(item)}
                  </option>
                ))}
              </select>
            </label>

            {selectedItem && (
              <div className="transfer-current-card">
                <span>Hazırkı vəziyyət</span>
                <strong>{selectedItem.inventory_code} · {selectedItem.name}</strong>
                <p>
                  Məsul: {getOwnerText(selectedItem)}
                  <br />
                  Şirkət: {selectedItem.company?.name || "-"}
                  <br />
                  Departament: {selectedItem.department?.name || "-"}
                  <br />
                  Lokasiya: {selectedItem.current_location || "-"}
                  <br />
                  Status: {selectedItem.status || "-"}
                  <br />
                  Yaradılma: {formatDate(selectedItem.created_at)}
                </p>
              </div>
            )}
          </div>

          <div className="transfer-right">
            <label className="settings-field">
              <span>Yerdəyişmə tipi</span>
              <select
                value={form.transfer_type}
                onChange={(e) => setField("transfer_type", e.target.value)}
              >
                {TRANSFER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-field">
              <span>Yeni şirkət</span>
              <select
                value={form.to_company_id}
                onChange={(e) => setField("to_company_id", e.target.value)}
                disabled={currentRole === "REHBER"}
              >
                <option value="">Şirkət seçilməyib</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            {form.transfer_type !== "WAREHOUSE" && (
              <label className="settings-field">
                <span>Yeni departament</span>
                <select
                  value={form.to_department_id}
                  onChange={(e) => setField("to_department_id", e.target.value)}
                  disabled={!form.to_company_id}
                >
                  <option value="">
                    {form.to_company_id ? "Departament seçilməyib" : "Əvvəl şirkət seç"}
                  </option>
                  {filteredDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {form.transfer_type === "USER" && (
              <label className="settings-field">
                <span>Yeni məsul şəxs *</span>
                <select
                  value={form.to_responsible_user_id}
                  onChange={(e) =>
                    setField("to_responsible_user_id", e.target.value)
                  }
                  disabled={!form.to_company_id}
                  required
                >
                  <option value="">
                    {form.to_company_id ? "Məsul şəxs seç" : "Əvvəl şirkət seç"}
                  </option>
                  {filteredProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name} {profile.email ? `(${profile.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {form.transfer_type === "MANUAL" && (
              <label className="settings-field">
                <span>Manual məsul şəxs adı *</span>
                <input
                  value={form.to_responsible_person_name}
                  onChange={(e) =>
                    setField("to_responsible_person_name", e.target.value)
                  }
                  placeholder="Məs: Əli Məmmədov"
                  required
                />
              </label>
            )}

            <label className="settings-field">
              <span>
                {form.transfer_type === "WAREHOUSE"
                  ? "Anbar / lokasiya"
                  : "Yeni lokasiya"}
              </span>
              <input
                value={form.to_location}
                onChange={(e) => setField("to_location", e.target.value)}
                placeholder="Məs: Baş ofis anbarı, 2-ci mərtəbə..."
              />
            </label>

            <label className="settings-field">
              <span>Qeyd</span>
              <textarea
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
                rows={4}
                placeholder="Yerdəyişmə səbəbi və əlavə qeydlər..."
              />
            </label>

            <button
              type="submit"
              className="settings-primary-btn"
              disabled={saving}
            >
              {saving ? "Yadda saxlanılır..." : "Yerdəyişməni təsdiqlə"}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .transfer-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.8fr);
          gap: 18px;
          align-items: start;
        }

        .transfer-left,
        .transfer-right {
          display: grid;
          gap: 14px;
        }

        .transfer-current-card {
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 18px;
          background:
            radial-gradient(circle at 100% 0%, rgba(37, 99, 235, 0.08), transparent 30%),
            #ffffff;
          box-shadow: 0 16px 45px rgba(15, 23, 42, 0.07);
        }

        .transfer-current-card span {
          display: block;
          color: #2563eb;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .transfer-current-card strong {
          display: block;
          color: #0f172a;
          font-size: 20px;
          letter-spacing: -0.04em;
        }

        .transfer-current-card p {
          margin: 12px 0 0;
          color: #475569;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.8;
        }

        @media (max-width: 900px) {
          .transfer-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}