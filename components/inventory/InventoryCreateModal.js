"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

const STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "Anbarda" },
  { value: "ASSIGNED", label: "Təhkim olunub" },
  { value: "IN_REPAIR", label: "Təmirdə" },
  { value: "LOST", label: "İtib" },
  { value: "WRITTEN_OFF", label: "Silinib" },
  { value: "DISPOSED", label: "İstifadədən çıxarılıb" },
];

const CONDITION_OPTIONS = [
  { value: "NEW", label: "Yeni" },
  { value: "GOOD", label: "Yaxşı" },
  { value: "NORMAL", label: "Normal" },
  { value: "DAMAGED", label: "Zədələnmiş" },
  { value: "UNUSABLE", label: "Yararsız" },
];

const STEPS = [
  { key: "basic", label: "Əsas" },
  { key: "owner", label: "Təhkim" },
  { key: "finance", label: "Maliyyə" },
];

const INITIAL_FORM = {
  inventory_code: "",
  name: "",
  description: "",
  company_id: "",
  department_id: "",
  category_id: "",
  responsible_user_id: "",
  current_location: "",
  purchase_date: "",
  purchase_price: "",
  currency: "AZN",
  serial_number: "",
  model: "",
  brand: "",
  status: "IN_STOCK",
  condition: "GOOD",
  warranty_start_date: "",
  warranty_end_date: "",
  depreciation_rate: "",
  useful_life_months: "",
  note: "",
};

export default function InventoryCreateModal({ open, onClose, onCreated }) {
  const [mounted, setMounted] = useState(false);
  const [activeStep, setActiveStep] = useState("basic");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setActiveStep("basic");
    setForm(INITIAL_FORM);
    setError("");
    loadOptions();

    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  async function loadOptions() {
    const [companiesRes, departmentsRes, categoriesRes, profilesRes] =
      await Promise.all([
        supabase
          .from("companies")
          .select("id,name,status")
          .eq("status", "ACTIVE")
          .order("name"),
        supabase
          .from("departments")
          .select("id,name,company_id,status")
          .eq("status", "ACTIVE")
          .order("name"),
        supabase
          .from("inventory_categories")
          .select("id,name,status")
          .eq("status", "ACTIVE")
          .order("name"),
        supabase
          .from("profiles")
          .select("id,full_name,email,company_id,status")
          .eq("status", "ACTIVE")
          .order("full_name"),
      ]);

    if (companiesRes.error) console.error("companies error", companiesRes.error);
    if (departmentsRes.error)
      console.error("departments error", departmentsRes.error);
    if (categoriesRes.error)
      console.error("categories error", categoriesRes.error);
    if (profilesRes.error) console.error("profiles error", profilesRes.error);

    setCompanies(companiesRes.data || []);
    setDepartments(departmentsRes.data || []);
    setCategories(categoriesRes.data || []);
    setProfiles(profilesRes.data || []);
  }

  const filteredDepartments = useMemo(() => {
    if (!form.company_id) return departments;
    return departments.filter((item) => item.company_id === form.company_id);
  }, [departments, form.company_id]);

  const filteredProfiles = useMemo(() => {
    if (!form.company_id) return profiles;
    return profiles.filter((item) => item.company_id === form.company_id);
  }, [profiles, form.company_id]);

  const selectedCompany = companies.find((x) => x.id === form.company_id);
  const selectedCategory = categories.find((x) => x.id === form.category_id);
  const selectedResponsible = profiles.find(
    (x) => x.id === form.responsible_user_id
  );

  function setField(name, value) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "company_id") {
        next.department_id = "";
        next.responsible_user_id = "";
      }

      return next;
    });
  }

  function toNumberOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
  }

  function toDateOrNull(value) {
    return value || null;
  }

  function goNext() {
    if (activeStep === "basic") {
      setActiveStep("owner");
      return;
    }

    if (activeStep === "owner") {
      setActiveStep("finance");
    }
  }

  function goBack() {
    if (activeStep === "finance") {
      setActiveStep("owner");
      return;
    }

    if (activeStep === "owner") {
      setActiveStep("basic");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setError("");

    if (!form.inventory_code.trim()) {
      setActiveStep("basic");
      setError("İnventar kodu məcburidir.");
      setSaving(false);
      return;
    }

    if (!form.name.trim()) {
      setActiveStep("basic");
      setError("İnventar adı məcburidir.");
      setSaving(false);
      return;
    }

    const payload = {
      inventory_code: form.inventory_code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,

      company_id: form.company_id || null,
      department_id: form.department_id || null,
      category_id: form.category_id || null,
      responsible_user_id: form.responsible_user_id || null,

      current_location: form.current_location.trim() || null,

      purchase_date: toDateOrNull(form.purchase_date),
      purchase_price: toNumberOrNull(form.purchase_price),
      currency: form.currency || "AZN",

      serial_number: form.serial_number.trim() || null,
      model: form.model.trim() || null,
      brand: form.brand.trim() || null,

      status: form.responsible_user_id ? "ASSIGNED" : form.status,
      condition: form.condition || "GOOD",

      warranty_start_date: toDateOrNull(form.warranty_start_date),
      warranty_end_date: toDateOrNull(form.warranty_end_date),

      depreciation_rate: toNumberOrNull(form.depreciation_rate),
      useful_life_months: toNumberOrNull(form.useful_life_months),

      note: form.note.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from("inventory_items")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      console.error("INVENTORY INSERT ERROR:", insertError);
      setError(insertError.message || "İnventar əlavə edilərkən xəta baş verdi.");
      setSaving(false);
      return;
    }

    if (payload.responsible_user_id && data?.id) {
      await supabase.from("inventory_assignments").insert({
        inventory_id: data.id,
        assigned_to: payload.responsible_user_id,
        status: "ACTIVE",
        note: "İnventar yaradılarkən avtomatik təhkim edildi.",
      });
    }

    onCreated?.();
    onClose?.();
    setSaving(false);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div className="assetModalRoot" role="dialog" aria-modal="true">
        <button
          type="button"
          className="assetModalBackdrop"
          onClick={onClose}
          aria-label="Modalı bağla"
        />

        <form className="assetModal" onSubmit={handleSubmit}>
          <aside className="assetSide">
            <div className="assetSideTop">
              <div className="assetLogoMark">CI</div>

              <button
                type="button"
                className="assetCloseMobile"
                onClick={onClose}
              >
                ×
              </button>
            </div>

            <div className="assetSideHero">
              <span>Smart Asset</span>
              <h2>Yeni inventar qeydiyyatı</h2>
              <p>
                İnventarı mərhələlərlə əlavə et: əsas məlumat, təhkim və maliyyə.
              </p>
            </div>

            <div className="assetPreviewCard">
              <div className="assetPreviewIcon">▣</div>

              <div>
                <span>Preview</span>
                <strong>{form.name.trim() || "Yeni inventar"}</strong>
                <p>
                  {[form.brand, form.model, form.serial_number]
                    .filter(Boolean)
                    .join(" · ") || "Brand, model və seriya nömrəsi"}
                </p>
              </div>
            </div>

            <div className="assetMetaGrid">
              <div>
                <span>Kod</span>
                <strong>{form.inventory_code || "INV-0000"}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {form.responsible_user_id
                    ? "Təhkim"
                    : STATUS_OPTIONS.find((x) => x.value === form.status)
                        ?.label}
                </strong>
              </div>

              <div>
                <span>Şirkət</span>
                <strong>{selectedCompany?.name || "Seçilməyib"}</strong>
              </div>

              <div>
                <span>Kateqoriya</span>
                <strong>{selectedCategory?.name || "Seçilməyib"}</strong>
              </div>
            </div>

            <div className="assetSmartBox">
              <div>
                <span>Health Score</span>
                <strong>Auto</strong>
              </div>
              <p>
                Sistem status, vəziyyət, alış tarixi və təmir tarixçəsinə əsasən
                balı avtomatik hesablayacaq.
              </p>
            </div>
          </aside>

          <section className="assetFormPanel">
            <header className="assetFormHeader">
              <div>
                <span>Inventory form</span>
                <h3>İnventar məlumatları</h3>
              </div>

              <button type="button" className="assetCloseBtn" onClick={onClose}>
                ×
              </button>
            </header>

            <div className="assetStepTabs">
              {STEPS.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  className={activeStep === step.key ? "active" : ""}
                  onClick={() => setActiveStep(step.key)}
                >
                  <i>{index + 1}</i>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            {error && <div className="assetAlert">{error}</div>}

            <div className="assetFormBody">
              {activeStep === "basic" && (
                <FormGroup
                  title="Əsas məlumatlar"
                  subtitle="İnventarın tanınması üçün əsas identifikasiya məlumatları."
                >
                  <Field label="İnventar kodu *">
                    <input
                      value={form.inventory_code}
                      onChange={(e) =>
                        setField("inventory_code", e.target.value)
                      }
                      placeholder="Məs: INV-0002"
                      required
                    />
                  </Field>

                  <Field label="İnventar adı *" wide>
                    <input
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="Məs: HP LaserJet Printer"
                      required
                    />
                  </Field>

                  <Field label="Brand">
                    <input
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                      placeholder="Məs: Lenovo"
                    />
                  </Field>

                  <Field label="Model">
                    <input
                      value={form.model}
                      onChange={(e) => setField("model", e.target.value)}
                      placeholder="Məs: ThinkPad X1"
                    />
                  </Field>

                  <Field label="Seriya nömrəsi">
                    <input
                      value={form.serial_number}
                      onChange={(e) =>
                        setField("serial_number", e.target.value)
                      }
                      placeholder="SN-..."
                    />
                  </Field>

                  <Field label="Qısa təsvir" full>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setField("description", e.target.value)
                      }
                      placeholder="İnventar haqqında qısa məlumat..."
                      rows={3}
                    />
                  </Field>
                </FormGroup>
              )}

              {activeStep === "owner" && (
                <FormGroup
                  title="Şirkət və təhkim"
                  subtitle="İnventarın şirkət, şöbə və məsul şəxs bağlantısını seçin."
                >
                  <Field label="Şirkət">
                    <select
                      value={form.company_id}
                      onChange={(e) => setField("company_id", e.target.value)}
                    >
                      <option value="">Seçilməyib</option>
                      {companies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Departament">
                    <select
                      value={form.department_id}
                      onChange={(e) =>
                        setField("department_id", e.target.value)
                      }
                    >
                      <option value="">Seçilməyib</option>
                      {filteredDepartments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Kateqoriya">
                    <select
                      value={form.category_id}
                      onChange={(e) => setField("category_id", e.target.value)}
                    >
                      <option value="">Seçilməyib</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Məsul şəxs">
                    <select
                      value={form.responsible_user_id}
                      onChange={(e) =>
                        setField("responsible_user_id", e.target.value)
                      }
                    >
                      <option value="">Təhkim edilməyib</option>
                      {filteredProfiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.full_name} {item.email ? `(${item.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Cari yerləşmə" wide>
                    <input
                      value={form.current_location}
                      onChange={(e) =>
                        setField("current_location", e.target.value)
                      }
                      placeholder="Məs: Baş ofis, 2-ci mərtəbə"
                    />
                  </Field>

                  <Field label="Seçilən məsul şəxs" full>
                    <div className="assetInlineInfo">
                      <strong>
                        {selectedResponsible?.full_name || "Təyin edilməyib"}
                      </strong>
                      <span>
                        {selectedResponsible?.email ||
                          "Məsul şəxs seçilsə, status avtomatik təhkim olunub olacaq."}
                      </span>
                    </div>
                  </Field>
                </FormGroup>
              )}

              {activeStep === "finance" && (
                <FormGroup
                  title="Status, zəmanət və maliyyə"
                  subtitle="Health Score, zəmanət xəbərdarlıqları və maliyyə uçotu üçün məlumatlar."
                >
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => setField("status", e.target.value)}
                      disabled={Boolean(form.responsible_user_id)}
                    >
                      {STATUS_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Vəziyyət">
                    <select
                      value={form.condition}
                      onChange={(e) => setField("condition", e.target.value)}
                    >
                      {CONDITION_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Alış tarixi">
                    <input
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) =>
                        setField("purchase_date", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Alış qiyməti">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.purchase_price}
                      onChange={(e) =>
                        setField("purchase_price", e.target.value)
                      }
                      placeholder="0.00"
                    />
                  </Field>

                  <Field label="Valyuta">
                    <select
                      value={form.currency}
                      onChange={(e) => setField("currency", e.target.value)}
                    >
                      <option value="AZN">AZN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="TRY">TRY</option>
                    </select>
                  </Field>

                  <Field label="Faydalı ömür / ay">
                    <input
                      type="number"
                      min="0"
                      value={form.useful_life_months}
                      onChange={(e) =>
                        setField("useful_life_months", e.target.value)
                      }
                      placeholder="Məs: 60"
                    />
                  </Field>

                  <Field label="Zəmanət başlanğıcı">
                    <input
                      type="date"
                      value={form.warranty_start_date}
                      onChange={(e) =>
                        setField("warranty_start_date", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Zəmanət bitmə tarixi">
                    <input
                      type="date"
                      value={form.warranty_end_date}
                      onChange={(e) =>
                        setField("warranty_end_date", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Amortizasiya faizi">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.depreciation_rate}
                      onChange={(e) =>
                        setField("depreciation_rate", e.target.value)
                      }
                      placeholder="Məs: 20"
                    />
                  </Field>

                  <Field label="Qeyd" full>
                    <textarea
                      value={form.note}
                      onChange={(e) => setField("note", e.target.value)}
                      placeholder="Əlavə qeydlər..."
                      rows={3}
                    />
                  </Field>
                </FormGroup>
              )}
            </div>

            <footer className="assetFooter">
              <button type="button" className="assetGhostBtn" onClick={onClose}>
                Bağla
              </button>

              <div className="assetFooterRight">
                {activeStep !== "basic" && (
                  <button
                    type="button"
                    className="assetSoftBtn"
                    onClick={goBack}
                  >
                    Geri
                  </button>
                )}

                {activeStep !== "finance" ? (
                  <button
                    type="button"
                    className="assetNextBtn"
                    onClick={goNext}
                  >
                    Davam et
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="assetSaveBtn"
                  >
                    {saving ? "Yadda saxlanılır..." : "İnventarı əlavə et"}
                  </button>
                )}
              </div>
            </footer>
          </section>
        </form>
      </div>

      <style jsx global>{`
        .assetModalRoot {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          padding: 22px;
          display: grid;
          place-items: center;
          overflow: hidden;
          box-sizing: border-box;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .assetModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 0;
          border: 0;
          cursor: pointer;
          background:
            radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.26), transparent 34%),
            radial-gradient(circle at 90% 12%, rgba(6, 182, 212, 0.17), transparent 30%),
            rgba(2, 6, 23, 0.72);
          backdrop-filter: blur(10px);
        }

        .assetModal {
          --modal-x: -42px;
          --modal-y: -26px;

          position: relative;
          z-index: 1;
          width: min(1120px, calc(100vw - 44px));
          height: min(760px, calc(100dvh - 44px));
          max-width: 1120px;
          max-height: calc(100dvh - 44px);
          min-height: 0;
          margin: auto;
          display: grid;
          grid-template-columns: 330px minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid rgba(226, 232, 240, 0.2);
          border-radius: 32px;
          background: #ffffff;
          box-shadow:
            0 44px 150px rgba(2, 6, 23, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.94);
          animation: assetModalEnter 0.22s ease both;
        }

        .assetSide {
          position: relative;
          min-height: 0;
          overflow: hidden;
          padding: 24px;
          color: #ffffff;
          background:
            radial-gradient(circle at 10% 0%, rgba(59, 130, 246, 0.55), transparent 34%),
            radial-gradient(circle at 90% 20%, rgba(6, 182, 212, 0.24), transparent 30%),
            linear-gradient(180deg, #07111f 0%, #020617 100%);
          display: grid;
          grid-template-rows: auto auto auto auto 1fr;
          gap: 18px;
        }

        .assetSide::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at 50% 20%, black, transparent 75%);
          pointer-events: none;
        }

        .assetSideTop,
        .assetSideHero,
        .assetPreviewCard,
        .assetMetaGrid,
        .assetSmartBox {
          position: relative;
          z-index: 1;
        }

        .assetSideTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .assetLogoMark {
          width: 50px;
          height: 50px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          box-shadow: 0 20px 55px rgba(37, 99, 235, 0.38);
          font-weight: 900;
          letter-spacing: -0.06em;
        }

        .assetCloseMobile {
          display: none;
        }

        .assetSideHero span {
          display: inline-flex;
          margin-bottom: 10px;
          color: #93c5fd;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .assetSideHero h2 {
          margin: 0;
          font-size: 31px;
          line-height: 1;
          letter-spacing: -0.07em;
        }

        .assetSideHero p {
          margin: 14px 0 0;
          color: #b8c7d9;
          font-size: 13px;
          line-height: 1.65;
          font-weight: 600;
        }

        .assetPreviewCard {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 24px;
          padding: 16px;
          display: flex;
          gap: 13px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(16px);
          box-shadow: 0 24px 65px rgba(2, 6, 23, 0.25);
        }

        .assetPreviewIcon {
          width: 48px;
          height: 48px;
          min-width: 48px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: rgba(37, 99, 235, 0.26);
          color: #bfdbfe;
          font-weight: 900;
          font-size: 20px;
        }

        .assetPreviewCard span,
        .assetMetaGrid span,
        .assetSmartBox span {
          display: block;
          color: #93a4bb;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .assetPreviewCard strong {
          display: block;
          margin-top: 5px;
          color: #ffffff;
          font-size: 16px;
          line-height: 1.25;
        }

        .assetPreviewCard p {
          margin: 5px 0 0;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.5;
        }

        .assetMetaGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .assetMetaGrid div {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 20px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.065);
        }

        .assetMetaGrid strong {
          display: block;
          margin-top: 6px;
          color: #ffffff;
          font-size: 13px;
          line-height: 1.3;
          word-break: break-word;
        }

        .assetSmartBox {
          align-self: end;
          border: 1px solid rgba(34, 197, 94, 0.22);
          border-radius: 24px;
          padding: 16px;
          background:
            radial-gradient(circle at 100% 0%, rgba(34, 197, 94, 0.16), transparent 30%),
            rgba(255, 255, 255, 0.065);
        }

        .assetSmartBox div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .assetSmartBox strong {
          color: #86efac;
          font-size: 18px;
          letter-spacing: -0.04em;
        }

        .assetSmartBox p {
          margin: 10px 0 0;
          color: #a9b8c9;
          font-size: 12px;
          line-height: 1.6;
          font-weight: 600;
        }

        .assetFormPanel {
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 96% 0%, rgba(37, 99, 235, 0.08), transparent 24%),
            linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }

        .assetFormHeader {
          flex: 0 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 22px 24px 16px;
        }

        .assetFormHeader span {
          display: inline-flex;
          color: #2563eb;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .assetFormHeader h3 {
          margin: 0;
          color: #020617;
          font-size: 28px;
          line-height: 1.05;
          letter-spacing: -0.06em;
        }

        .assetCloseBtn {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border: 1px solid #dbe3ee;
          border-radius: 16px;
          background: #ffffff;
          color: #0f172a;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
        }

        .assetStepTabs {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 0 24px 14px;
        }

        .assetStepTabs button {
          height: 46px;
          border: 1px solid #dbe3ee;
          border-radius: 18px;
          background: #ffffff;
          color: #64748b;
          cursor: pointer;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .assetStepTabs button i {
          width: 24px;
          height: 24px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-style: normal;
          background: #f1f5f9;
          color: #64748b;
          font-size: 12px;
        }

        .assetStepTabs button.active {
          border-color: rgba(37, 99, 235, 0.3);
          background: linear-gradient(135deg, #2563eb, #0284c7);
          color: #ffffff;
          box-shadow: 0 16px 34px rgba(37, 99, 235, 0.22);
        }

        .assetStepTabs button.active i {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .assetAlert {
          flex: 0 0 auto;
          margin: 0 24px 14px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 18px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .assetFormBody {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 0 24px 28px;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }

        .assetGroup {
          border: 1px solid #e7edf5;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.055);
          padding: 20px;
        }

        .assetGroupHead {
          margin-bottom: 18px;
          padding-bottom: 15px;
          border-bottom: 1px solid #edf2f7;
        }

        .assetGroupHead h4 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
          letter-spacing: -0.045em;
        }

        .assetGroupHead p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 600;
        }

        .assetGrid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 14px;
        }

        .assetField {
          grid-column: span 4;
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .assetField.wide {
          grid-column: span 8;
        }

        .assetField.full {
          grid-column: 1 / -1;
        }

        .assetField span {
          color: #334155;
          font-size: 12px;
          font-weight: 900;
        }

        .assetField input,
        .assetField select,
        .assetField textarea {
          width: 100%;
          border: 1px solid #dbe3ee;
          border-radius: 17px;
          background: #ffffff;
          color: #0f172a;
          outline: none;
          padding: 0 14px;
          font-size: 14px;
          font-weight: 700;
        }

        .assetField input,
        .assetField select {
          height: 48px;
        }

        .assetField textarea {
          min-height: 106px;
          padding-top: 13px;
          padding-bottom: 13px;
          resize: vertical;
          line-height: 1.55;
        }

        .assetField input::placeholder,
        .assetField textarea::placeholder {
          color: #94a3b8;
          font-weight: 600;
        }

        .assetField input:focus,
        .assetField select:focus,
        .assetField textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.1);
        }

        .assetField select:disabled {
          background: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .assetInlineInfo {
          min-height: 58px;
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          background: #f8fafc;
          padding: 13px 14px;
          display: grid;
          gap: 4px;
        }

        .assetInlineInfo strong {
          color: #0f172a;
          font-size: 14px;
        }

        .assetInlineInfo span {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .assetFooter {
          flex: 0 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e7edf5;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(14px);
        }

        .assetFooterRight {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .assetGhostBtn,
        .assetSoftBtn,
        .assetNextBtn,
        .assetSaveBtn {
          height: 46px;
          border-radius: 17px;
          padding: 0 18px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .assetGhostBtn,
        .assetSoftBtn {
          border: 1px solid #dbe3ee;
          background: #ffffff;
          color: #0f172a;
        }

        .assetNextBtn,
        .assetSaveBtn {
          border: 0;
          min-width: 150px;
          background: linear-gradient(135deg, #2563eb, #0284c7);
          color: #ffffff;
          box-shadow: 0 16px 35px rgba(37, 99, 235, 0.25);
        }

        .assetSaveBtn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        @keyframes assetModalEnter {
          from {
            opacity: 0;
            transform: translate(
                var(--modal-x),
                calc(var(--modal-y) + 14px)
              )
              scale(0.985);
            filter: blur(6px);
          }

          to {
            opacity: 1;
            transform: translate(var(--modal-x), var(--modal-y)) scale(1);
            filter: blur(0);
          }
        }

        @media (max-width: 1180px) {
          .assetModal {
            --modal-x: 0px;
            --modal-y: 0px;
            width: min(1040px, calc(100vw - 32px));
            height: min(740px, calc(100dvh - 32px));
            max-height: calc(100dvh - 32px);
            grid-template-columns: 300px minmax(0, 1fr);
          }

          .assetField {
            grid-column: span 6;
          }

          .assetField.wide,
          .assetField.full {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 900px) {
          .assetModalRoot {
            padding: 10px;
            display: grid;
            place-items: center;
            overflow: hidden;
          }

          .assetModal {
            --modal-x: 0px;
            --modal-y: 0px;

            width: calc(100vw - 20px);
            height: calc(100dvh - 20px);
            max-height: calc(100dvh - 20px);
            min-height: 0;
            display: flex;
            flex-direction: column;
            border-radius: 24px;
          }

          .assetSide {
            flex: 0 0 auto;
            min-height: 0;
            height: 72px;
            max-height: 72px;
            padding: 8px 12px;
            display: grid;
            grid-template-rows: auto auto;
            gap: 4px;
          }

          .assetSideTop {
            min-height: 34px;
          }

          .assetLogoMark {
            width: 34px;
            height: 34px;
            border-radius: 13px;
            font-size: 13px;
          }

          .assetCloseMobile {
            width: 32px;
            height: 32px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 13px;
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            font-size: 22px;
            display: grid;
            place-items: center;
            cursor: pointer;
          }

          .assetSideHero {
            min-height: 0;
            overflow: hidden;
          }

          .assetSideHero span {
            display: none;
          }

          .assetSideHero h2 {
            margin: 0;
            font-size: 15px;
            line-height: 1.1;
            letter-spacing: -0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .assetSideHero p,
          .assetPreviewCard,
          .assetMetaGrid,
          .assetSmartBox {
            display: none;
          }

          .assetFormPanel {
            flex: 1 1 auto;
            min-height: 0;
            height: auto;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .assetFormHeader {
            flex: 0 0 auto;
            padding: 10px 12px 6px;
          }

          .assetFormHeader span {
            font-size: 10px;
            margin-bottom: 3px;
          }

          .assetFormHeader h3 {
            font-size: 18px;
            line-height: 1.05;
          }

          .assetCloseBtn {
            display: none;
          }

          .assetStepTabs {
            flex: 0 0 auto;
            padding: 0 12px 7px;
            gap: 6px;
          }

          .assetStepTabs button {
            height: 32px;
            border-radius: 12px;
            font-size: 11px;
            gap: 5px;
          }

          .assetStepTabs button i {
            width: 18px;
            height: 18px;
            border-radius: 7px;
            font-size: 10px;
          }

          .assetAlert {
            flex: 0 0 auto;
            margin: 0 12px 7px;
            padding: 9px 11px;
            border-radius: 14px;
            font-size: 12px;
          }

          .assetFormBody {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 0 12px 10px;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            touch-action: pan-y;
          }

          .assetGroup {
            padding: 12px;
            border-radius: 18px;
          }

          .assetGroupHead {
            margin-bottom: 11px;
            padding-bottom: 10px;
          }

          .assetGroupHead h4 {
            font-size: 16px;
          }

          .assetGroupHead p {
            font-size: 12px;
            line-height: 1.4;
          }

          .assetGrid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .assetField,
          .assetField.wide,
          .assetField.full {
            grid-column: 1 / -1;
          }

          .assetField {
            gap: 6px;
          }

          .assetField span {
            font-size: 11px;
          }

          .assetField input,
          .assetField select {
            height: 38px;
            border-radius: 13px;
            font-size: 12px;
            padding: 0 12px;
          }

          .assetField textarea {
            min-height: 74px;
            border-radius: 13px;
            font-size: 12px;
            padding: 11px 12px;
          }

          .assetFooter {
            flex: 0 0 auto;
            padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 8px;
            align-items: center;
            background: #ffffff;
            border-top: 1px solid #e7edf5;
          }

          .assetFooterRight {
            display: contents;
          }

          .assetGhostBtn,
          .assetSoftBtn,
          .assetNextBtn,
          .assetSaveBtn {
            width: 100%;
            min-width: 0;
            height: 38px;
            border-radius: 13px;
            font-size: 12px;
            padding: 0 10px;
          }

          .assetSoftBtn {
            grid-column: 1 / 2;
          }

          .assetNextBtn,
          .assetSaveBtn {
            grid-column: 2 / 3;
          }

          .assetGhostBtn {
            grid-column: 1 / 2;
          }
        }

        @media (max-width: 520px) {
          .assetModalRoot {
            padding: 6px;
          }

          .assetModal {
            width: calc(100vw - 12px);
            height: calc(100dvh - 12px);
            max-height: calc(100dvh - 12px);
            border-radius: 22px;
          }

          .assetSide {
            height: 66px;
            max-height: 66px;
            padding: 7px 10px;
          }

          .assetLogoMark {
            width: 32px;
            height: 32px;
            border-radius: 12px;
          }

          .assetCloseMobile {
            width: 30px;
            height: 30px;
          }

          .assetSideHero h2 {
            font-size: 14px;
          }

          .assetFormHeader {
            padding: 8px 10px 5px;
          }

          .assetFormHeader span {
            font-size: 9px;
          }

          .assetFormHeader h3 {
            font-size: 17px;
          }

          .assetStepTabs {
            padding: 0 10px 6px;
            gap: 5px;
          }

          .assetStepTabs button {
            height: 31px;
            border-radius: 11px;
            font-size: 10px;
          }

          .assetStepTabs button i {
            width: 17px;
            height: 17px;
            font-size: 9px;
          }

          .assetAlert {
            margin: 0 10px 6px;
          }

          .assetFormBody {
            padding: 0 10px 8px;
          }

          .assetGroup {
            padding: 11px;
            border-radius: 17px;
          }

          .assetGroupHead {
            margin-bottom: 10px;
            padding-bottom: 9px;
          }

          .assetGroupHead h4 {
            font-size: 15px;
          }

          .assetGroupHead p {
            font-size: 11px;
          }

          .assetField input,
          .assetField select {
            height: 36px;
            border-radius: 12px;
          }

          .assetField textarea {
            min-height: 68px;
            border-radius: 12px;
          }

          .assetFooter {
            padding: 7px 10px calc(7px + env(safe-area-inset-bottom));
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 7px;
          }

          .assetGhostBtn,
          .assetSoftBtn,
          .assetNextBtn,
          .assetSaveBtn {
            height: 36px;
            border-radius: 12px;
            font-size: 12px;
          }
        }

        @media (max-width: 380px) {
          .assetModalRoot {
            padding: 4px;
          }

          .assetModal {
            width: calc(100vw - 8px);
            height: calc(100dvh - 8px);
            max-height: calc(100dvh - 8px);
            border-radius: 18px;
          }

          .assetSide {
            height: 58px;
            max-height: 58px;
            padding: 6px 8px;
          }

          .assetSideHero h2 {
            display: none;
          }

          .assetLogoMark {
            width: 30px;
            height: 30px;
          }

          .assetCloseMobile {
            width: 28px;
            height: 28px;
          }

          .assetFormHeader {
            padding: 7px 8px 4px;
          }

          .assetFormHeader span {
            display: none;
          }

          .assetFormHeader h3 {
            font-size: 16px;
          }

          .assetStepTabs {
            padding: 0 8px 5px;
          }

          .assetStepTabs button span {
            display: none;
          }

          .assetStepTabs button {
            height: 30px;
          }

          .assetFormBody {
            padding: 0 8px 7px;
          }

          .assetFooter {
            padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
            gap: 6px;
          }

          .assetGhostBtn,
          .assetSoftBtn,
          .assetNextBtn,
          .assetSaveBtn {
            height: 34px;
            font-size: 11px;
          }
        }

        @media (max-height: 700px) and (max-width: 900px) {
          .assetSide {
            height: 52px;
            max-height: 52px;
            padding: 5px 8px;
          }

          .assetSideHero {
            display: none;
          }

          .assetLogoMark {
            width: 30px;
            height: 30px;
          }

          .assetCloseMobile {
            width: 28px;
            height: 28px;
          }

          .assetFormHeader {
            padding: 6px 8px 4px;
          }

          .assetFormHeader span {
            display: none;
          }

          .assetFormHeader h3 {
            font-size: 16px;
          }

          .assetStepTabs {
            padding: 0 8px 5px;
          }

          .assetStepTabs button {
            height: 30px;
          }

          .assetStepTabs button span {
            display: none;
          }

          .assetGroupHead p {
            display: none;
          }

          .assetField input,
          .assetField select {
            height: 36px;
          }

          .assetField textarea {
            min-height: 62px;
          }

          .assetFooter {
            padding-top: 6px;
            padding-bottom: calc(6px + env(safe-area-inset-bottom));
          }

          .assetGhostBtn,
          .assetSoftBtn,
          .assetNextBtn,
          .assetSaveBtn {
            height: 34px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .assetModal,
          .assetField input,
          .assetField select,
          .assetField textarea,
          .assetCloseBtn,
          .assetGhostBtn,
          .assetSoftBtn,
          .assetNextBtn,
          .assetSaveBtn {
            animation: none !important;
            transition: none !important;
          }

          .assetModal {
            transform: translate(var(--modal-x), var(--modal-y));
          }
        }
      `}</style>
    </>,
    document.body
  );
}

function FormGroup({ title, subtitle, children }) {
  return (
    <section className="assetGroup">
      <div className="assetGroupHead">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>

      <div className="assetGrid">{children}</div>
    </section>
  );
}

function Field({ label, children, wide, full }) {
  return (
    <label
      className={`assetField ${wide ? "wide" : ""} ${full ? "full" : ""}`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}