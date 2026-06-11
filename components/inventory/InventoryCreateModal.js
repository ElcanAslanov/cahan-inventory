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

const RESPONSIBLE_MODE_OPTIONS = [
  { value: "NONE", label: "Təhkim edilməyib" },
  { value: "SYSTEM_USER", label: "Sistemdə olan istifadəçi" },
  { value: "MANUAL", label: "Sistemdə olmayan məsul şəxs" },
];

const STEPS = [
  { key: "basic", label: "Əsas" },
  { key: "owner", label: "Təhkim" },
  { key: "finance", label: "Maliyyə" },
  { key: "images", label: "Şəkillər" },
];

const INITIAL_FORM = {
  inventory_code: "",
  name: "",
  description: "",
  company_id: "",
  department_id: "",
  category_id: "",
  responsible_mode: "NONE",
  responsible_user_id: "",
  responsible_person_name: "",
  responsible_person_note: "",
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

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();

  if (value === "ADMIN") return "ADMIN";

  if (
    value === "REHBER" ||
    value === "RƏHBƏR" ||
    value === "REHBƏR" ||
    value === "RƏHBER"
  ) {
    return "REHBER";
  }

  if (value === "USER" || value === "İSTİFADƏÇİ" || value === "ISTIFADECI") {
    return "USER";
  }

  if (
    value === "IZLEYICI" ||
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "VIEWER"
  ) {
    return "IZLEYICI";
  }

  if (value === "AUDIT" || value === "AUDİT" || value === "AUDITOR") {
    return "AUDIT";
  }

  return value || "USER";
}

function resolveProfileRole(profile) {
  return normalizeRole(
    profile?.resolved_role ||
      profile?.user_role ||
      profile?.roles?.name ||
      profile?.roles?.label ||
      "USER"
  );
}

function canCreateInventory(role) {
  return ["ADMIN", "REHBER"].includes(normalizeRole(role));
}

function isAdmin(role) {
  return normalizeRole(role) === "ADMIN";
}

function isRehber(role) {
  return normalizeRole(role) === "REHBER";
}

function formatFileSize(size) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createSafeFileName(fileName) {
  const original = String(fileName || "image.jpg");
  const ext = original.includes(".") ? original.split(".").pop() : "jpg";
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${Date.now()}-${random}.${ext}`
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function cleanInitialForm() {
  return { ...INITIAL_FORM };
}

export default function InventoryCreateModal({ open, onClose, onCreated }) {
  const [mounted, setMounted] = useState(false);
  const [activeStep, setActiveStep] = useState("basic");
  const [form, setForm] = useState(cleanInitialForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [me, setMe] = useState(null);

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const currentRole = resolveProfileRole(me);
  const currentCompanyId = me?.company_id || me?.companies?.id || "";

  const canCreate = canCreateInventory(currentRole);
  const rehberMode = isRehber(currentRole) && currentCompanyId;
  const adminMode = isAdmin(currentRole);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setActiveStep("basic");
    setForm(cleanInitialForm());
    setError("");
    setSaving(false);
    setImageFiles([]);

    setImagePreviews((prev) => {
      prev.forEach((image) => {
        if (image?.url) URL.revokeObjectURL(image.url);
      });
      return [];
    });

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

  useEffect(() => {
    return () => {
      imagePreviews.forEach((image) => {
        if (image?.url) URL.revokeObjectURL(image.url);
      });
    };
  }, [imagePreviews]);

  async function loadOptions() {
    setOptionsLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMe(null);
      setError("Sessiya tapılmadı. Yenidən giriş edin.");
      setOptionsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        email,
        company_id,
        status,
        user_role,
        role_id,
        access_scope,
        roles (
          id,
          name,
          label
        ),
        companies (
          id,
          name
        )
      `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("PROFILE LOAD ERROR:", profileError);
      setMe(null);
      setError("Profil məlumatı tapılmadı.");
      setOptionsLoading(false);
      return;
    }

    const role = resolveProfileRole(profile);
    const companyId = profile?.company_id || profile?.companies?.id || "";

    const finalProfile = {
      ...profile,
      resolved_role: role,
    };

    setMe(finalProfile);

    if (!canCreateInventory(role)) {
      setError(
        "Bu əməliyyat üçün icazəniz yoxdur. Yalnız ADMIN və REHBER inventar əlavə edə bilər."
      );
      setCompanies([]);
      setDepartments([]);
      setCategories([]);
      setProfiles([]);
      setOptionsLoading(false);
      return;
    }

    let companyQuery = supabase
      .from("companies")
      .select("id,name,status")
      .eq("status", "ACTIVE")
      .order("name");

    let departmentQuery = supabase
      .from("departments")
      .select("id,name,company_id,status")
      .eq("status", "ACTIVE")
      .order("name");

    let profileQuery = supabase
      .from("profiles")
      .select("id,full_name,email,company_id,department_id,status")
      .eq("status", "ACTIVE")
      .order("full_name");

    if (isRehber(role) && companyId) {
      companyQuery = companyQuery.eq("id", companyId);
      departmentQuery = departmentQuery.eq("company_id", companyId);
      profileQuery = profileQuery.eq("company_id", companyId);
    }

    const [companiesRes, departmentsRes, categoriesRes, profilesRes] =
      await Promise.all([
        companyQuery,
        departmentQuery,
        supabase
          .from("inventory_categories")
          .select("id,name,status")
          .eq("status", "ACTIVE")
          .order("name"),
        profileQuery,
      ]);

    if (companiesRes.error) console.error("companies error", companiesRes.error);
    if (departmentsRes.error)
      console.error("departments error", departmentsRes.error);
    if (categoriesRes.error)
      console.error("categories error", categoriesRes.error);
    if (profilesRes.error) console.error("profiles error", profilesRes.error);

    const nextCompanies = companiesRes.data || [];
    const nextDepartments = departmentsRes.data || [];
    const nextCategories = categoriesRes.data || [];
    const nextProfiles = profilesRes.data || [];

    setCompanies(nextCompanies);
    setDepartments(nextDepartments);
    setCategories(nextCategories);
    setProfiles(nextProfiles);

    if (isRehber(role) && companyId) {
      setForm((prev) => ({
        ...prev,
        company_id: companyId,
        department_id:
          prev.department_id &&
          nextDepartments.some(
            (department) => String(department.id) === String(prev.department_id)
          )
            ? prev.department_id
            : "",
        responsible_user_id:
          prev.responsible_user_id &&
          nextProfiles.some(
            (person) => String(person.id) === String(prev.responsible_user_id)
          )
            ? prev.responsible_user_id
            : "",
      }));
    }

    setOptionsLoading(false);
  }

  const filteredDepartments = useMemo(() => {
    if (!form.company_id) return [];
    return departments.filter(
      (item) => String(item.company_id) === String(form.company_id)
    );
  }, [departments, form.company_id]);

  const filteredProfiles = useMemo(() => {
    if (!form.company_id) return [];

    let list = profiles.filter(
      (item) => String(item.company_id) === String(form.company_id)
    );

    if (form.department_id) {
      list = list.filter(
        (item) =>
          !item.department_id ||
          String(item.department_id) === String(form.department_id)
      );
    }

    return list;
  }, [profiles, form.company_id, form.department_id]);

  const selectedCompany = companies.find(
    (x) => String(x.id) === String(form.company_id)
  );

  const selectedDepartment = departments.find(
    (x) => String(x.id) === String(form.department_id)
  );

  const selectedResponsible = profiles.find(
    (x) => String(x.id) === String(form.responsible_user_id)
  );

  const hasAnyResponsible =
    form.responsible_mode === "SYSTEM_USER"
      ? Boolean(form.responsible_user_id)
      : form.responsible_mode === "MANUAL"
        ? Boolean(form.responsible_person_name.trim())
        : false;

  function setField(name, value) {
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "company_id") {
        next.department_id = "";
        next.responsible_user_id = "";
      }

      if (name === "department_id") {
        next.responsible_user_id = "";
      }

      if (name === "responsible_mode") {
        if (value === "NONE") {
          next.responsible_user_id = "";
          next.responsible_person_name = "";
          next.responsible_person_note = "";
          next.status = "IN_STOCK";
        }

        if (value === "SYSTEM_USER") {
          next.responsible_person_name = "";
          next.responsible_person_note = "";
        }

        if (value === "MANUAL") {
          next.responsible_user_id = "";
        }
      }

      if (name === "responsible_user_id" && value) {
        next.responsible_person_name = "";
        next.responsible_person_note = "";
        next.status = "ASSIGNED";
      }

      if (name === "responsible_person_name" && String(value || "").trim()) {
        next.responsible_user_id = "";
        next.status = "ASSIGNED";
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

  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);

    if (!files.length) return;

    const acceptedFiles = [];
    const previews = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError(`${file.name} şəkil faylı deyil.`);
        continue;
      }

      if (file.size > 8 * 1024 * 1024) {
        setError(`${file.name} 8MB-dan böyükdür.`);
        continue;
      }

      acceptedFiles.push(file);
      previews.push({
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      });
    }

    if (acceptedFiles.length) {
      setError("");
      setImageFiles((prev) => [...prev, ...acceptedFiles]);
      setImagePreviews((prev) => [...prev, ...previews]);
    }

    e.target.value = "";
  }

  function removeSelectedImage(index) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));

    setImagePreviews((prev) => {
      const selected = prev[index];

      if (selected?.url) {
        URL.revokeObjectURL(selected.url);
      }

      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadInventoryImages(inventoryId) {
    if (!inventoryId || imageFiles.length === 0) return [];

    const uploaded = [];

    for (const file of imageFiles) {
      const fileName = createSafeFileName(file.name);
      const path = `${inventoryId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inventory-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploaded.push({
        path,
        name: file.name,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      });
    }

    return uploaded;
  }

  function validateCurrentStep() {
    if (activeStep === "basic") {
      if (!form.inventory_code.trim()) {
        setError("İnventar kodu məcburidir.");
        return false;
      }

      if (!form.name.trim()) {
        setError("İnventar adı məcburidir.");
        return false;
      }
    }

    if (activeStep === "owner") {
      if (rehberMode && !form.company_id) {
        setError("REHBER üçün şirkət məlumatı məcburidir.");
        return false;
      }

      if (form.responsible_mode === "SYSTEM_USER" && !form.responsible_user_id) {
        setError("Sistemdə olan məsul şəxsi seçin.");
        return false;
      }

      if (
        form.responsible_mode === "MANUAL" &&
        !form.responsible_person_name.trim()
      ) {
        setError("Sistemdə olmayan məsul şəxs üçün ad soyad yazın.");
        return false;
      }
    }

    setError("");
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;

    if (activeStep === "basic") {
      setActiveStep("owner");
      return;
    }

    if (activeStep === "owner") {
      setActiveStep("finance");
      return;
    }

    if (activeStep === "finance") {
      setActiveStep("images");
    }
  }

  function goBack() {
    setError("");

    if (activeStep === "images") {
      setActiveStep("finance");
      return;
    }

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

    if (!canCreate) {
      setError(
        "Bu əməliyyat üçün icazəniz yoxdur. Yalnız ADMIN və REHBER inventar əlavə edə bilər."
      );
      setSaving(false);
      return;
    }

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

    if (rehberMode && String(form.company_id) !== String(currentCompanyId)) {
      setActiveStep("owner");
      setError("REHBER yalnız öz şirkəti üçün inventar əlavə edə bilər.");
      setSaving(false);
      return;
    }

    if (
      form.responsible_mode === "SYSTEM_USER" &&
      !form.responsible_user_id
    ) {
      setActiveStep("owner");
      setError("Sistemdə olan məsul şəxsi seçin.");
      setSaving(false);
      return;
    }

    if (
      form.responsible_mode === "MANUAL" &&
      !form.responsible_person_name.trim()
    ) {
      setActiveStep("owner");
      setError("Sistemdə olmayan məsul şəxs üçün ad soyad yazın.");
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

      responsible_user_id:
        form.responsible_mode === "SYSTEM_USER"
          ? form.responsible_user_id || null
          : null,

      responsible_person_name:
        form.responsible_mode === "MANUAL"
          ? form.responsible_person_name.trim() || null
          : null,

      responsible_person_note:
        form.responsible_mode === "MANUAL"
          ? form.responsible_person_note.trim() || null
          : null,

      current_location: form.current_location.trim() || null,

      purchase_date: toDateOrNull(form.purchase_date),
      purchase_price: toNumberOrNull(form.purchase_price),
      currency: form.currency || "AZN",

      serial_number: form.serial_number.trim() || null,
      model: form.model.trim() || null,
      brand: form.brand.trim() || null,

      status: hasAnyResponsible ? "ASSIGNED" : form.status,
      condition: form.condition || "GOOD",

      warranty_start_date: toDateOrNull(form.warranty_start_date),
      warranty_end_date: toDateOrNull(form.warranty_end_date),

      depreciation_rate: toNumberOrNull(form.depreciation_rate),
      useful_life_months: toNumberOrNull(form.useful_life_months),

      note: form.note.trim() || null,
      images: [],
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

    let uploadedImages = [];

    try {
      uploadedImages = await uploadInventoryImages(data.id);
    } catch (uploadError) {
      console.error("INVENTORY IMAGE UPLOAD ERROR:", uploadError);

      await supabase.from("inventory_items").delete().eq("id", data.id);

      setError(
        uploadError.message ||
          "Şəkillər yüklənərkən xəta baş verdi. İnventar yaradılmadı."
      );
      setSaving(false);
      return;
    }

    if (uploadedImages.length > 0) {
      const { error: imagesUpdateError } = await supabase
        .from("inventory_items")
        .update({
          images: uploadedImages,
        })
        .eq("id", data.id);

      if (imagesUpdateError) {
        console.error("INVENTORY IMAGES UPDATE ERROR:", imagesUpdateError);
        setError(
          imagesUpdateError.message ||
            "Şəkillər yükləndi, amma inventar məlumatına yazılmadı."
        );
        setSaving(false);
        return;
      }
    }

    if (payload.responsible_user_id && data?.id) {
      const { error: assignmentError } = await supabase
        .from("inventory_assignments")
        .insert({
          inventory_id: data.id,
          assigned_to: payload.responsible_user_id,
          status: "ACTIVE",
          note: "İnventar yaradılarkən avtomatik təhkim edildi.",
        });

      if (assignmentError) {
        console.error("INVENTORY ASSIGNMENT INSERT ERROR:", assignmentError);
      }
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
                İnventarı mərhələlərlə əlavə et: əsas məlumat, təhkim, maliyyə
                və şəkillər.
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
                  {hasAnyResponsible
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
                <span>Departament</span>
                <strong>{selectedDepartment?.name || "Seçilməyib"}</strong>
              </div>

              <div>
                <span>Məsul</span>
                <strong>
                  {form.responsible_mode === "SYSTEM_USER"
                    ? selectedResponsible?.full_name || "Seçilməyib"
                    : form.responsible_mode === "MANUAL"
                      ? form.responsible_person_name || "Manual"
                      : "Yoxdur"}
                </strong>
              </div>

              <div>
                <span>Şəkil</span>
                <strong>
                  {imageFiles.length ? `${imageFiles.length} ədəd` : "Yoxdur"}
                </strong>
              </div>
            </div>

            <div className="assetSmartBox">
              <div>
                <span>Access mode</span>
                <strong>{adminMode ? "All" : rehberMode ? "Company" : "Read"}</strong>
              </div>
              <p>
                ADMIN bütün şirkətlər üçün, REHBER isə öz şirkəti üçün inventar
                əlavə edə bilər.
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
                  onClick={() => {
                    if (step.key !== activeStep && !validateCurrentStep()) return;
                    setActiveStep(step.key);
                  }}
                >
                  <i>{index + 1}</i>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            {error && <div className="assetAlert">{error}</div>}

            {optionsLoading && (
              <div className="assetAlert assetInfoAlert">
                Məlumatlar yüklənir...
              </div>
            )}

            {!canCreate && !optionsLoading && (
              <div className="assetPermissionBox">
                <strong>İcazə yoxdur</strong>
                <p>
                  Bu istifadəçi rolu ilə inventar əlavə etmək mümkün deyil.
                  İcazə verilən rollar: ADMIN və REHBER.
                </p>
              </div>
            )}

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
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="İnventar adı *" wide>
                    <input
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="Məs: HP LaserJet Printer"
                      required
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Brand">
                    <input
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                      placeholder="Məs: Lenovo"
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Model">
                    <input
                      value={form.model}
                      onChange={(e) => setField("model", e.target.value)}
                      placeholder="Məs: ThinkPad X1"
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Seriya nömrəsi">
                    <input
                      value={form.serial_number}
                      onChange={(e) =>
                        setField("serial_number", e.target.value)
                      }
                      placeholder="SN-..."
                      disabled={!canCreate || saving}
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
                      disabled={!canCreate || saving}
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
                      disabled={!canCreate || saving || rehberMode}
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
                      disabled={!canCreate || saving || !form.company_id}
                    >
                      <option value="">
                        {form.company_id
                          ? "Seçilməyib"
                          : "Əvvəl şirkət seçin"}
                      </option>
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
                      disabled={!canCreate || saving}
                    >
                      <option value="">Seçilməyib</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Məsul şəxs tipi">
                    <select
                      value={form.responsible_mode}
                      onChange={(e) =>
                        setField("responsible_mode", e.target.value)
                      }
                      disabled={!canCreate || saving}
                    >
                      {RESPONSIBLE_MODE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {form.responsible_mode === "SYSTEM_USER" && (
                    <Field label="Sistemdə olan məsul şəxs" wide>
                      <select
                        value={form.responsible_user_id}
                        onChange={(e) =>
                          setField("responsible_user_id", e.target.value)
                        }
                        disabled={!canCreate || saving || !form.company_id}
                      >
                        <option value="">
                          {form.company_id
                            ? "Məsul şəxs seçilməyib"
                            : "Əvvəl şirkət seçin"}
                        </option>
                        {filteredProfiles.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.full_name} {item.email ? `(${item.email})` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {form.responsible_mode === "MANUAL" && (
                    <>
                      <Field label="Manual məsul şəxs adı *" wide>
                        <input
                          value={form.responsible_person_name}
                          onChange={(e) =>
                            setField("responsible_person_name", e.target.value)
                          }
                          placeholder="Məs: Əli Məmmədov"
                          disabled={!canCreate || saving}
                        />
                      </Field>

                      <Field label="Manual məsul şəxs qeydi" full>
                        <textarea
                          value={form.responsible_person_note}
                          onChange={(e) =>
                            setField("responsible_person_note", e.target.value)
                          }
                          placeholder="Məs: Sistemdə hesabı yoxdur, anbar əməkdaşıdır..."
                          rows={3}
                          disabled={!canCreate || saving}
                        />
                      </Field>
                    </>
                  )}

                  <Field label="Cari yerləşmə" wide>
                    <input
                      value={form.current_location}
                      onChange={(e) =>
                        setField("current_location", e.target.value)
                      }
                      placeholder="Məs: Baş ofis, 2-ci mərtəbə"
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Seçilən məsul şəxs" full>
                    <div className="assetInlineInfo">
                      <strong>
                        {form.responsible_mode === "SYSTEM_USER"
                          ? selectedResponsible?.full_name || "Təyin edilməyib"
                          : form.responsible_mode === "MANUAL"
                            ? form.responsible_person_name ||
                              "Manual məsul şəxs yazılmayıb"
                            : "Təhkim edilməyib"}
                      </strong>
                      <span>
                        {form.responsible_mode === "SYSTEM_USER"
                          ? selectedResponsible?.email ||
                            "Sistemdə olan məsul şəxs seçilsə, status avtomatik təhkim olunub olacaq."
                          : form.responsible_mode === "MANUAL"
                            ? "Bu şəxs sistemə giriş edən istifadəçi deyil, sadəcə inventarın məsul şəxsi kimi saxlanacaq."
                            : "Məsul şəxs seçilməsə status seçdiyiniz kimi qalacaq."}
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
                      value={hasAnyResponsible ? "ASSIGNED" : form.status}
                      onChange={(e) => setField("status", e.target.value)}
                      disabled={!canCreate || saving || hasAnyResponsible}
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
                      disabled={!canCreate || saving}
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
                      disabled={!canCreate || saving}
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
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Valyuta">
                    <select
                      value={form.currency}
                      onChange={(e) => setField("currency", e.target.value)}
                      disabled={!canCreate || saving}
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
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Zəmanət başlanğıcı">
                    <input
                      type="date"
                      value={form.warranty_start_date}
                      onChange={(e) =>
                        setField("warranty_start_date", e.target.value)
                      }
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Zəmanət bitmə tarixi">
                    <input
                      type="date"
                      value={form.warranty_end_date}
                      onChange={(e) =>
                        setField("warranty_end_date", e.target.value)
                      }
                      disabled={!canCreate || saving}
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
                      disabled={!canCreate || saving}
                    />
                  </Field>

                  <Field label="Qeyd" full>
                    <textarea
                      value={form.note}
                      onChange={(e) => setField("note", e.target.value)}
                      placeholder="Əlavə qeydlər..."
                      rows={3}
                      disabled={!canCreate || saving}
                    />
                  </Field>
                </FormGroup>
              )}

              {activeStep === "images" && (
                <FormGroup
                  title="İnventar şəkilləri"
                  subtitle="Şəkillər private Supabase Storage bucket-də saxlanacaq. Sonradan yalnız giriş etmiş istifadəçilər signed URL ilə görə biləcək."
                >
                  <Field label="Şəkil seç" full>
                    <div className="assetImageUploadBox">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        disabled={!canCreate || saving}
                      />

                      <div>
                        <strong>Şəkilləri seçin</strong>
                        <span>
                          JPG, PNG, WEBP və digər image formatları. Maksimum 8MB.
                        </span>
                      </div>
                    </div>
                  </Field>

                  {imagePreviews.length > 0 ? (
                    <Field label="Seçilmiş şəkillər" full>
                      <div className="assetImagePreviewGrid">
                        {imagePreviews.map((image, index) => (
                          <div
                            key={`${image.name}-${index}`}
                            className="assetImagePreview"
                          >
                            <img src={image.url} alt={image.name} />

                            <div>
                              <strong>{image.name}</strong>
                              <span>{formatFileSize(image.size)}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeSelectedImage(index)}
                              disabled={saving}
                            >
                              Sil
                            </button>
                          </div>
                        ))}
                      </div>
                    </Field>
                  ) : (
                    <Field label="Qeyd" full>
                      <div className="assetInlineInfo">
                        <strong>Şəkil əlavə edilməyib</strong>
                        <span>
                          Bu addımı boş keçə bilərsiniz. İnventar şəkilsiz də
                          yaradılacaq.
                        </span>
                      </div>
                    </Field>
                  )}
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
                    disabled={saving}
                  >
                    Geri
                  </button>
                )}

                {activeStep !== "images" ? (
                  <button
                    type="button"
                    className="assetNextBtn"
                    onClick={goNext}
                    disabled={!canCreate || saving || optionsLoading}
                  >
                    Davam et
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canCreate || saving || optionsLoading}
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
          grid-template-columns: repeat(4, 1fr);
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

        .assetStepTabs button:disabled,
        .assetGhostBtn:disabled,
        .assetSoftBtn:disabled,
        .assetNextBtn:disabled,
        .assetSaveBtn:disabled,
        .assetImagePreview button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
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

        .assetInfoAlert {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .assetPermissionBox {
          margin: 0 24px 14px;
          border: 1px solid #fde68a;
          background: #fffbeb;
          color: #92400e;
          border-radius: 20px;
          padding: 14px 16px;
        }

        .assetPermissionBox strong {
          display: block;
          color: #78350f;
          font-size: 14px;
          font-weight: 900;
        }

        .assetPermissionBox p {
          margin: 6px 0 0;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 700;
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

        .assetField input:disabled,
        .assetField select:disabled,
        .assetField textarea:disabled {
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

        .assetImageUploadBox {
          position: relative;
          min-height: 126px;
          border: 1px dashed #93c5fd;
          border-radius: 22px;
          background:
            radial-gradient(circle at 100% 0%, rgba(37, 99, 235, 0.09), transparent 28%),
            #f8fafc;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 18px;
          overflow: hidden;
        }

        .assetImageUploadBox input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }

        .assetImageUploadBox strong {
          display: block;
          color: #0f172a;
          font-size: 15px;
          font-weight: 900;
        }

        .assetImageUploadBox span {
          display: block;
          margin-top: 6px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .assetImagePreviewGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
          gap: 12px;
        }

        .assetImagePreview {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }

        .assetImagePreview img {
          width: 100%;
          height: 112px;
          object-fit: cover;
          display: block;
          background: #f1f5f9;
        }

        .assetImagePreview div {
          padding: 10px;
          display: grid;
          gap: 3px;
        }

        .assetImagePreview strong {
          color: #0f172a;
          font-size: 12px;
          font-weight: 900;
          word-break: break-word;
        }

        .assetImagePreview span {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .assetImagePreview button {
          width: 100%;
          height: 34px;
          border: 0;
          border-top: 1px solid #fee2e2;
          background: #fef2f2;
          color: #991b1b;
          cursor: pointer;
          font-weight: 900;
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
            grid-template-columns: repeat(4, 1fr);
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

          .assetPermissionBox {
            margin: 0 12px 7px;
            padding: 10px 12px;
            border-radius: 16px;
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