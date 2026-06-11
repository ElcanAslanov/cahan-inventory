import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase env dəyişənləri tapılmadı.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  const text = normalizeString(value);
  return text || null;
}

function normalizeId(value) {
  const text = normalizeString(value);
  return text || null;
}

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

  if (value === "AUDIT" || value === "AUDİT" || value === "AUDITOR") {
    return "AUDIT";
  }

  if (
    value === "IZLEYICI" ||
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "VIEWER"
  ) {
    return "IZLEYICI";
  }

  if (value === "USER" || value === "İSTİFADƏÇİ" || value === "ISTIFADECI") {
    return "USER";
  }

  return value || "USER";
}

function errorResponse(message, status = 500) {
  return NextResponse.json(
    {
      error: message || "Server xətası baş verdi.",
    },
    {
      status,
    }
  );
}

async function getCurrentProfile(supabase, req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Sessiya token-i tapılmadı.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user?.id) {
    throw new Error("Sessiya etibarsızdır.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      email,
      status,
      user_role,
      role_id,
      company_id,
      access_scope,
      companies (
        id,
        name
      )
    `
    )
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Profil oxunmadı.");
  }

  if (!profile?.id) {
    throw new Error("Profil tapılmadı.");
  }

  if (profile.status !== "ACTIVE") {
    throw new Error("Profil aktiv deyil.");
  }

  return {
    ...profile,
    resolved_role: normalizeRole(profile.user_role),
  };
}

function canManageTransfer(profile) {
  return ["ADMIN", "REHBER"].includes(normalizeRole(profile?.resolved_role));
}

function canViewLogs(profile) {
  return ["ADMIN", "REHBER", "AUDIT", "IZLEYICI"].includes(
    normalizeRole(profile?.resolved_role)
  );
}

function isAdmin(profile) {
  return normalizeRole(profile?.resolved_role) === "ADMIN";
}

function isRehber(profile) {
  return normalizeRole(profile?.resolved_role) === "REHBER";
}

async function validateRehberScope(profile, currentItem, payload) {
  if (!isRehber(profile)) return;

  const ownCompanyId = profile.company_id;

  if (!ownCompanyId) {
    throw new Error("REHBER profilində şirkət məlumatı yoxdur.");
  }

  const currentCompanyId = currentItem.company_id;
  const targetCompanyId = payload.to_company_id || currentCompanyId;

  if (String(currentCompanyId || "") !== String(ownCompanyId)) {
    throw new Error("REHBER yalnız öz şirkətinə aid inventarı dəyişə bilər.");
  }

  if (String(targetCompanyId || "") !== String(ownCompanyId)) {
    throw new Error("REHBER inventarı yalnız öz şirkəti daxilində hərəkət etdirə bilər.");
  }
}

async function validateDepartmentCompany(supabase, companyId, departmentId) {
  if (!departmentId) return;

  if (!companyId) {
    throw new Error("Departament seçmək üçün şirkət seçilməlidir.");
  }

  const { data, error } = await supabase
    .from("departments")
    .select("id,company_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Departament yoxlanmadı.");
  }

  if (!data?.id) {
    throw new Error("Seçilmiş departament tapılmadı.");
  }

  if (String(data.company_id) !== String(companyId)) {
    throw new Error("Seçilmiş departament bu şirkətə aid deyil.");
  }
}

export async function GET(req) {
  try {
    const supabase = getAdminClient();
    const profile = await getCurrentProfile(supabase, req);

    if (!canViewLogs(profile)) {
      return errorResponse("Bu səhifəyə baxmaq üçün icazəniz yoxdur.", 403);
    }

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 200);

    let query = supabase
      .from("inventory_transfer_logs")
      .select(
        `
        id,
        inventory_id,
        from_responsible_user_id,
        to_responsible_user_id,
        from_responsible_person_name,
        to_responsible_person_name,
        from_company_id,
        to_company_id,
        from_department_id,
        to_department_id,
        from_location,
        to_location,
        from_status,
        to_status,
        transfer_type,
        note,
        performed_by,
        created_at,

        inventory:inventory_items!inventory_transfer_logs_inventory_id_fkey (
          id,
          inventory_code,
          name,
          serial_number,
          brand,
          model
        ),

        from_user:profiles!inventory_transfer_logs_from_responsible_user_id_fkey (
          id,
          full_name,
          email
        ),

        to_user:profiles!inventory_transfer_logs_to_responsible_user_id_fkey (
          id,
          full_name,
          email
        ),

        performer:profiles!inventory_transfer_logs_performed_by_fkey (
          id,
          full_name,
          email
        ),

        from_company:companies!inventory_transfer_logs_from_company_id_fkey (
          id,
          name
        ),

        to_company:companies!inventory_transfer_logs_to_company_id_fkey (
          id,
          name
        ),

        from_department:departments!inventory_transfer_logs_from_department_id_fkey (
          id,
          name
        ),

        to_department:departments!inventory_transfer_logs_to_department_id_fkey (
          id,
          name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200);

    if (isRehber(profile) && profile.company_id) {
      query = query.or(
        `from_company_id.eq.${profile.company_id},to_company_id.eq.${profile.company_id}`
      );
    }

    const { data, error } = await query;

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      logs: data || [],
    });
  } catch (e) {
    return errorResponse(e?.message || "Server xətası baş verdi.", 500);
  }
}

export async function POST(req) {
  try {
    const supabase = getAdminClient();
    const profile = await getCurrentProfile(supabase, req);

    if (!canManageTransfer(profile)) {
      return errorResponse("Yerdəyişmə etmək üçün icazəniz yoxdur.", 403);
    }

    const body = await req.json();

    const inventory_id = normalizeId(body.inventory_id);
    const transfer_type = normalizeString(body.transfer_type || "TRANSFER").toUpperCase();

    const to_company_id = normalizeId(body.to_company_id);
    const to_department_id = normalizeId(body.to_department_id);
    const to_responsible_user_id = normalizeId(body.to_responsible_user_id);
    const to_responsible_person_name = normalizeNullableString(
      body.to_responsible_person_name
    );
    const to_location = normalizeNullableString(body.to_location);
    const note = normalizeNullableString(body.note);

    if (!inventory_id) {
      return errorResponse("İnventar seçilməlidir.", 400);
    }

    if (!["USER", "MANUAL", "WAREHOUSE"].includes(transfer_type)) {
      return errorResponse("Yerdəyişmə tipi düzgün deyil.", 400);
    }

    if (transfer_type === "USER" && !to_responsible_user_id) {
      return errorResponse("Yeni məsul şəxs seçilməlidir.", 400);
    }

    if (transfer_type === "MANUAL" && !to_responsible_person_name) {
      return errorResponse("Manual məsul şəxs adı yazılmalıdır.", 400);
    }

    const { data: currentItem, error: itemError } = await supabase
      .from("inventory_items")
      .select(
        `
        id,
        inventory_code,
        name,
        company_id,
        department_id,
        responsible_user_id,
        responsible_person_name,
        responsible_person_note,
        current_location,
        status
      `
      )
      .eq("id", inventory_id)
      .maybeSingle();

    if (itemError) {
      return errorResponse(itemError.message, 500);
    }

    if (!currentItem?.id) {
      return errorResponse("İnventar tapılmadı.", 404);
    }

    const finalCompanyId = to_company_id || currentItem.company_id || null;
    const finalDepartmentId = to_department_id || null;

    await validateRehberScope(profile, currentItem, {
      to_company_id: finalCompanyId,
    });

    await validateDepartmentCompany(supabase, finalCompanyId, finalDepartmentId);

    let updatePayload = {
      company_id: finalCompanyId,
      department_id: finalDepartmentId,
      current_location: to_location,
      responsible_user_id: null,
      responsible_person_name: null,
      responsible_person_note: null,
      status: "IN_STOCK",
    };

    if (transfer_type === "USER") {
      const { data: toUser, error: toUserError } = await supabase
        .from("profiles")
        .select("id,full_name,email,company_id,department_id,status")
        .eq("id", to_responsible_user_id)
        .maybeSingle();

      if (toUserError) {
        return errorResponse(toUserError.message, 500);
      }

      if (!toUser?.id) {
        return errorResponse("Yeni məsul şəxs tapılmadı.", 404);
      }

      if (toUser.status !== "ACTIVE") {
        return errorResponse("Seçilmiş istifadəçi aktiv deyil.", 400);
      }

      if (finalCompanyId && String(toUser.company_id || "") !== String(finalCompanyId)) {
        return errorResponse("Seçilmiş istifadəçi bu şirkətə aid deyil.", 400);
      }

      updatePayload = {
        ...updatePayload,
        department_id: finalDepartmentId || toUser.department_id || null,
        responsible_user_id: toUser.id,
        responsible_person_name: null,
        responsible_person_note: null,
        status: "ASSIGNED",
      };
    }

    if (transfer_type === "MANUAL") {
      updatePayload = {
        ...updatePayload,
        responsible_user_id: null,
        responsible_person_name: to_responsible_person_name,
        responsible_person_note: note,
        status: "ASSIGNED",
      };
    }

    if (transfer_type === "WAREHOUSE") {
      updatePayload = {
        ...updatePayload,
        responsible_user_id: null,
        responsible_person_name: null,
        responsible_person_note: null,
        status: "IN_STOCK",
      };
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update(updatePayload)
      .eq("id", currentItem.id);

    if (updateError) {
      return errorResponse(updateError.message, 500);
    }

    if (currentItem.responsible_user_id) {
      await supabase
        .from("inventory_assignments")
        .update({
          status: "RETURNED",
          returned_at: new Date().toISOString(),
          note: "Yerdəyişmə zamanı əvvəlki təhkim bağlandı.",
        })
        .eq("inventory_id", currentItem.id)
        .eq("status", "ACTIVE");
    }

    if (transfer_type === "USER" && updatePayload.responsible_user_id) {
      await supabase.from("inventory_assignments").insert({
        inventory_id: currentItem.id,
        assigned_to: updatePayload.responsible_user_id,
        status: "ACTIVE",
        note: note || "Yerdəyişmə zamanı yeni təhkim yaradıldı.",
      });
    }

    const { data: log, error: logError } = await supabase
      .from("inventory_transfer_logs")
      .insert({
        inventory_id: currentItem.id,

        from_responsible_user_id: currentItem.responsible_user_id || null,
        to_responsible_user_id:
          transfer_type === "USER" ? updatePayload.responsible_user_id : null,

        from_responsible_person_name:
          currentItem.responsible_person_name || null,
        to_responsible_person_name:
          transfer_type === "MANUAL" ? to_responsible_person_name : null,

        from_company_id: currentItem.company_id || null,
        to_company_id: updatePayload.company_id || null,

        from_department_id: currentItem.department_id || null,
        to_department_id: updatePayload.department_id || null,

        from_location: currentItem.current_location || null,
        to_location: updatePayload.current_location || null,

        from_status: currentItem.status || null,
        to_status: updatePayload.status || null,

        transfer_type,
        note,
        performed_by: profile.id,
      })
      .select("id")
      .single();

    if (logError) {
      return errorResponse(
        logError.message || "Yerdəyişmə edildi, amma log yazılmadı.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      log_id: log?.id,
    });
  } catch (e) {
    return errorResponse(e?.message || "Server xətası baş verdi.", 500);
  }
}