import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();

  if (
    value === "RƏHBƏR" ||
    value === "REHBƏR" ||
    value === "RƏHBER"
  ) {
    return "REHBER";
  }

  if (value === "AUDİT" || value === "AUDITOR") {
    return "AUDIT";
  }

  if (
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "IZLƏYICI" ||
    value === "VIEWER"
  ) {
    return "IZLEYICI";
  }

  if (value === "İSTİFADƏÇİ" || value === "ISTIFADECI") {
    return "USER";
  }

  return value || "USER";
}

async function getAuthUser(req, supabase) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

async function requireAdmin(req, supabase) {
  const authUser = await getAuthUser(req, supabase);

  if (!authUser) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,user_role,role_id,status,access_scope")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    console.error("ADMIN_PERMISSIONS_PROFILE_ERROR:", error);

    return {
      error: NextResponse.json(
        {
          error:
            error.message ||
            error.details ||
            "Profil yoxlanılarkən xəta baş verdi.",
        },
        { status: 500 }
      ),
    };
  }

  if (!profile) {
    return {
      error: NextResponse.json(
        { error: "Profil tapılmadı." },
        { status: 404 }
      ),
    };
  }

  if (profile.status && profile.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { error: "İstifadəçi aktiv deyil." },
        { status: 403 }
      ),
    };
  }

  const role = normalizeRole(profile.user_role);

  if (role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Bu əməliyyat üçün ADMIN icazəsi lazımdır." },
        { status: 403 }
      ),
    };
  }

  return { authUser, profile };
}

function buildCompanyNameMap(companies = []) {
  const map = new Map();

  companies.forEach((company) => {
    if (company?.id) {
      map.set(company.id, company.name || "-");
    }
  });

  return map;
}

function normalizeUserRows(users = [], companyMap) {
  return users.map((user) => ({
    ...user,
    role: user.user_role,
    company_name: user.company_id
      ? companyMap.get(user.company_id) || "Naməlum şirkət"
      : "Şirkət seçilməyib",
  }));
}

export async function GET(req) {
  const supabase = getAdminClient();

  try {
    const guard = await requireAdmin(req, supabase);

    if (guard.error) return guard.error;

    const [
      permissionsRes,
      rolesRes,
      companiesRes,
      profilesRes,
      rolePermissionsRes,
      userPermissionsRes,
      roleCompanyAccessRes,
      userCompanyAccessRes,
    ] = await Promise.all([
      supabase
        .from("permissions")
        .select("id,key,label,group_name,description,created_at")
        .order("group_name", { ascending: true })
        .order("key", { ascending: true }),

      supabase
        .from("roles")
        .select("id,name,label")
        .order("name", { ascending: true }),

      supabase
        .from("companies")
        .select("id,name,status")
        .order("name", { ascending: true }),

      supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          user_role,
          role_id,
          company_id,
          access_scope,
          status
        `
        )
        .order("full_name", { ascending: true }),

      supabase
        .from("role_permissions")
        .select("id,role_id,permission_id"),

      supabase
        .from("user_permissions")
        .select("id,user_id,permission_id,effect"),

      supabase
        .from("role_company_access")
        .select("id,role_id,company_id"),

      supabase
        .from("user_company_access")
        .select("id,user_id,company_id,effect"),
    ]);

    const responses = [
      permissionsRes,
      rolesRes,
      companiesRes,
      profilesRes,
      rolePermissionsRes,
      userPermissionsRes,
      roleCompanyAccessRes,
      userCompanyAccessRes,
    ];

    const failed = responses.find((res) => res.error);

    if (failed?.error) {
      console.error("ADMIN_PERMISSIONS_LOAD_FAILED:", {
        message: failed.error.message,
        details: failed.error.details,
        hint: failed.error.hint,
        code: failed.error.code,
      });

      throw failed.error;
    }

    const companyMap = buildCompanyNameMap(companiesRes.data || []);
    const normalizedUsers = normalizeUserRows(profilesRes.data || [], companyMap);

    return NextResponse.json({
      permissions: permissionsRes.data || [],
      roles: rolesRes.data || [],
      companies: companiesRes.data || [],
      users: normalizedUsers,
      rolePermissions: rolePermissionsRes.data || [],
      userPermissions: userPermissionsRes.data || [],
      roleCompanyAccess: roleCompanyAccessRes.data || [],
      userCompanyAccess: userCompanyAccessRes.data || [],
    });
  } catch (err) {
    console.error("PERMISSIONS_GET_ERROR:", {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
      raw: err,
    });

    return NextResponse.json(
      {
        error:
          err?.message ||
          err?.details ||
          "Yetkilər yüklənərkən xəta baş verdi.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  const supabase = getAdminClient();

  try {
    const guard = await requireAdmin(req, supabase);

    if (guard.error) return guard.error;

    const body = await req.json();
    const mode = body?.mode;

    if (mode === "ROLE_PERMISSIONS") {
      const roleId = body?.role_id;
      const permissionIds = Array.isArray(body?.permission_ids)
        ? body.permission_ids
        : [];

      if (!roleId) {
        return NextResponse.json(
          { error: "role_id lazımdır." },
          { status: 400 }
        );
      }

      const { error: delError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);

      if (delError) throw delError;

      if (permissionIds.length > 0) {
        const rows = permissionIds.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
        }));

        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(rows);

        if (insertError) throw insertError;
      }

      return NextResponse.json({ ok: true });
    }

    if (mode === "USER_PERMISSIONS") {
      const userId = body?.user_id;
      const allowIds = Array.isArray(body?.allow_permission_ids)
        ? body.allow_permission_ids
        : [];
      const denyIds = Array.isArray(body?.deny_permission_ids)
        ? body.deny_permission_ids
        : [];

      if (!userId) {
        return NextResponse.json(
          { error: "user_id lazımdır." },
          { status: 400 }
        );
      }

      const conflictIds = allowIds.filter((id) => denyIds.includes(id));

      if (conflictIds.length > 0) {
        return NextResponse.json(
          { error: "Eyni permission həm Allow, həm Deny ola bilməz." },
          { status: 400 }
        );
      }

      const { error: delError } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);

      if (delError) throw delError;

      const rows = [
        ...allowIds.map((permissionId) => ({
          user_id: userId,
          permission_id: permissionId,
          effect: "ALLOW",
        })),
        ...denyIds.map((permissionId) => ({
          user_id: userId,
          permission_id: permissionId,
          effect: "DENY",
        })),
      ];

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("user_permissions")
          .insert(rows);

        if (insertError) throw insertError;
      }

      return NextResponse.json({ ok: true });
    }

    if (mode === "ROLE_COMPANIES") {
      const roleId = body?.role_id;
      const companyIds = Array.isArray(body?.company_ids)
        ? body.company_ids
        : [];

      if (!roleId) {
        return NextResponse.json(
          { error: "role_id lazımdır." },
          { status: 400 }
        );
      }

      const { error: delError } = await supabase
        .from("role_company_access")
        .delete()
        .eq("role_id", roleId);

      if (delError) throw delError;

      if (companyIds.length > 0) {
        const rows = companyIds.map((companyId) => ({
          role_id: roleId,
          company_id: companyId,
        }));

        const { error: insertError } = await supabase
          .from("role_company_access")
          .insert(rows);

        if (insertError) throw insertError;
      }

      return NextResponse.json({ ok: true });
    }

    if (mode === "USER_COMPANIES") {
      const userId = body?.user_id;
      const allowCompanyIds = Array.isArray(body?.allow_company_ids)
        ? body.allow_company_ids
        : [];
      const denyCompanyIds = Array.isArray(body?.deny_company_ids)
        ? body.deny_company_ids
        : [];

      if (!userId) {
        return NextResponse.json(
          { error: "user_id lazımdır." },
          { status: 400 }
        );
      }

      const conflictIds = allowCompanyIds.filter((id) =>
        denyCompanyIds.includes(id)
      );

      if (conflictIds.length > 0) {
        return NextResponse.json(
          { error: "Eyni şirkət həm Allow, həm Deny ola bilməz." },
          { status: 400 }
        );
      }

      const { error: delError } = await supabase
        .from("user_company_access")
        .delete()
        .eq("user_id", userId);

      if (delError) throw delError;

      const rows = [
        ...allowCompanyIds.map((companyId) => ({
          user_id: userId,
          company_id: companyId,
          effect: "ALLOW",
        })),
        ...denyCompanyIds.map((companyId) => ({
          user_id: userId,
          company_id: companyId,
          effect: "DENY",
        })),
      ];

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("user_company_access")
          .insert(rows);

        if (insertError) throw insertError;
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Yanlış mode göndərilib." },
      { status: 400 }
    );
  } catch (err) {
    console.error("PERMISSIONS_PUT_ERROR:", {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
      raw: err,
    });

    return NextResponse.json(
      {
        error:
          err?.message ||
          err?.details ||
          "Yetkilər yadda saxlanılarkən xəta baş verdi.",
      },
      { status: 500 }
    );
  }
}