import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PERMISSION_SEED = [
  {
    key: "dashboard.view",
    label: "Dashboard görsün",
    group_name: "Əsas",
    description: "Dashboard səhifəsinə baxmaq icazəsi.",
  },

  {
    key: "inventory.view",
    label: "İnventarlara baxsın",
    group_name: "İnventarlar",
    description: "İnventar siyahısını və detalları görmək icazəsi.",
  },
  {
    key: "inventory.export",
    label: "İnventar export etsin",
    group_name: "İnventarlar",
    description: "İnventar məlumatlarını Excel/CSV/Print export etmək icazəsi.",
  },
  {
    key: "inventory.create",
    label: "Yeni inventar əlavə etsin",
    group_name: "İnventarlar",
    description: "Yeni inventar yaratmaq icazəsi.",
  },
  {
    key: "inventory.edit",
    label: "İnventarı düzəltsin",
    group_name: "İnventarlar",
    description: "Mövcud inventar məlumatlarını dəyişmək icazəsi.",
  },
  {
    key: "inventory.delete",
    label: "İnventarı silsin",
    group_name: "İnventarlar",
    description: "İnventarı sistemdən silmək icazəsi.",
  },
  {
    key: "inventory.qr.manage",
    label: "QR yaratsın / idarə etsin",
    group_name: "İnventarlar",
    description: "İnventar üçün QR yaratmaq və QR əməliyyatları icazəsi.",
  },
  {
    key: "inventory.transfer",
    label: "İnventar təhkim / transfer etsin",
    group_name: "İnventarlar",
    description: "İnventarın yerdəyişmə və təhkim əməliyyatlarını etmək icazəsi.",
  },

  {
    key: "transfers.view",
    label: "Yerdəyişmə səhifəsinə baxsın",
    group_name: "Yerdəyişmə",
    description: "Yerdəyişmə səhifəsini görmək icazəsi.",
  },
  {
    key: "transfers.create",
    label: "Yerdəyişmə yaratsın",
    group_name: "Yerdəyişmə",
    description: "Yeni yerdəyişmə əməliyyatı yaratmaq icazəsi.",
  },
  {
    key: "transfers.edit",
    label: "Yerdəyişməni düzəltsin",
    group_name: "Yerdəyişmə",
    description: "Yerdəyişmə məlumatlarını dəyişmək icazəsi.",
  },
  {
    key: "transfers.delete",
    label: "Yerdəyişməni silsin",
    group_name: "Yerdəyişmə",
    description: "Yerdəyişmə məlumatlarını silmək icazəsi.",
  },

  {
    key: "logs.view",
    label: "Loglara baxsın",
    group_name: "Loglar",
    description: "İnventar loglarına baxmaq icazəsi.",
  },
  {
    key: "logs.export",
    label: "Log export etsin",
    group_name: "Loglar",
    description: "Logları Excel/CSV/Print export etmək icazəsi.",
  },

  {
    key: "companies.view",
    label: "Şirkətlərə baxsın",
    group_name: "Şirkətlər",
    description: "Şirkət siyahısını görmək icazəsi.",
  },
  {
    key: "companies.create",
    label: "Şirkət əlavə etsin",
    group_name: "Şirkətlər",
    description: "Yeni şirkət əlavə etmək icazəsi.",
  },
  {
    key: "companies.edit",
    label: "Şirkəti düzəltsin",
    group_name: "Şirkətlər",
    description: "Şirkət məlumatlarını dəyişmək icazəsi.",
  },
  {
    key: "companies.delete",
    label: "Şirkəti silsin",
    group_name: "Şirkətlər",
    description: "Şirkəti silmək icazəsi.",
  },

  {
    key: "departments.view",
    label: "Departamentlərə baxsın",
    group_name: "Departamentlər",
    description: "Departament siyahısını görmək icazəsi.",
  },
  {
    key: "departments.create",
    label: "Departament əlavə etsin",
    group_name: "Departamentlər",
    description: "Yeni departament yaratmaq icazəsi.",
  },
  {
    key: "departments.edit",
    label: "Departamenti düzəltsin",
    group_name: "Departamentlər",
    description: "Departament məlumatlarını dəyişmək icazəsi.",
  },
  {
    key: "departments.delete",
    label: "Departamenti silsin",
    group_name: "Departamentlər",
    description: "Departamenti silmək icazəsi.",
  },

  {
    key: "categories.view",
    label: "Kateqoriyalara baxsın",
    group_name: "Kateqoriyalar",
    description: "Kateqoriya siyahısını görmək icazəsi.",
  },
  {
    key: "categories.create",
    label: "Kateqoriya əlavə etsin",
    group_name: "Kateqoriyalar",
    description: "Yeni kateqoriya yaratmaq icazəsi.",
  },
  {
    key: "categories.edit",
    label: "Kateqoriyanı düzəltsin",
    group_name: "Kateqoriyalar",
    description: "Kateqoriya məlumatlarını dəyişmək icazəsi.",
  },
  {
    key: "categories.delete",
    label: "Kateqoriyanı silsin",
    group_name: "Kateqoriyalar",
    description: "Kateqoriyanı silmək icazəsi.",
  },

  {
    key: "users.view",
    label: "İstifadəçilərə baxsın",
    group_name: "İstifadəçilər",
    description: "İstifadəçi siyahısını görmək icazəsi.",
  },
  {
    key: "users.export",
    label: "İstifadəçiləri export etsin",
    group_name: "İstifadəçilər",
    description: "İstifadəçi siyahısını Excel/CSV/Print export etmək icazəsi.",
  },
  {
    key: "users.create",
    label: "İstifadəçi əlavə etsin",
    group_name: "İstifadəçilər",
    description: "Yeni istifadəçi yaratmaq icazəsi.",
  },
  {
    key: "users.edit",
    label: "İstifadəçini düzəltsin",
    group_name: "İstifadəçilər",
    description: "İstifadəçi məlumatlarını dəyişmək icazəsi.",
  },
  {
    key: "users.delete",
    label: "İstifadəçini silsin",
    group_name: "İstifadəçilər",
    description: "İstifadəçini silmək icazəsi.",
  },

  {
    key: "permissions.view",
    label: "Yetkiləndirməyə baxsın",
    group_name: "Yetkiləndirmə",
    description: "Permission səhifəsinə baxmaq icazəsi.",
  },
  {
    key: "permissions.edit",
    label: "Yetkiləndirməni dəyişsin",
    group_name: "Yetkiləndirmə",
    description: "Rol və istifadəçi permission-larını dəyişmək icazəsi.",
  },

  {
    key: "my_inventory.view",
    label: "Mənim inventarlarım səhifəsinə baxsın",
    group_name: "Mənim inventarlarım",
    description: "İstifadəçinin öz inventarlarına baxmaq icazəsi.",
  },
  {
    key: "my_inventory.export",
    label: "Mənim inventarlarım export etsin",
    group_name: "Mənim inventarlarım",
    description:
      "Mənim inventarlarım səhifəsində Excel və Print report almaq icazəsi.",
  },

  {
    key: "audit.view",
    label: "Audit / hesabatlara baxsın",
    group_name: "Audit / Hesabat",
    description: "Audit və hesabat səhifəsinə baxmaq icazəsi.",
  },
  {
    key: "audit.export",
    label: "Audit / hesabat export etsin",
    group_name: "Audit / Hesabat",
    description: "Audit və hesabat məlumatlarını export etmək icazəsi.",
  },
];

const DEFAULT_ROLE_PERMISSIONS = {
  IZLEYICI: [
    "dashboard.view",
    "inventory.view",
    "inventory.export",
    "logs.view",
    "logs.export",
    "companies.view",
    "departments.view",
    "categories.view",
    "users.view",
    "users.export",
    "my_inventory.view",
    "my_inventory.export",
  ],

  VIEWER: [
    "dashboard.view",
    "inventory.view",
    "inventory.export",
    "logs.view",
    "logs.export",
    "companies.view",
    "departments.view",
    "categories.view",
    "users.view",
    "users.export",
    "my_inventory.view",
    "my_inventory.export",
  ],

  AUDIT: [
    "dashboard.view",
    "inventory.view",
    "inventory.export",
    "logs.view",
    "logs.export",
    "audit.view",
    "audit.export",
  ],

  REHBER: [
    "dashboard.view",
    "inventory.view",
    "inventory.export",
    "inventory.create",
    "inventory.edit",
    "inventory.qr.manage",
    "inventory.transfer",
    "transfers.view",
    "transfers.create",
    "logs.view",
    "logs.export",
    "categories.view",
    "my_inventory.view",
    "my_inventory.export",
  ],

  USER: ["dashboard.view", "my_inventory.view", "my_inventory.export"],
};

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

  if (value === "ADMIN") return "ADMIN";

  if (
    value === "RƏHBƏR" ||
    value === "REHBƏR" ||
    value === "RƏHBER" ||
    value === "REHBER"
  ) {
    return "REHBER";
  }

  if (value === "AUDİT" || value === "AUDIT" || value === "AUDITOR") {
    return "AUDIT";
  }

  if (
    value === "İZLEYICI" ||
    value === "İZLƏYİCİ" ||
    value === "IZLƏYICI" ||
    value === "IZLEYICI" ||
    value === "VIEWER"
  ) {
    return "IZLEYICI";
  }

  if (
    value === "İSTİFADƏÇİ" ||
    value === "ISTIFADECI" ||
    value === "USER"
  ) {
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

async function seedPermissions(supabase) {
  for (const permission of PERMISSION_SEED) {
    const { error } = await supabase.from("permissions").upsert(permission, {
      onConflict: "key",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("PERMISSION_SEED_UPSERT_ERROR:", {
        key: permission.key,
        error,
      });

      throw error;
    }
  }
}

async function seedDefaultRolePermissions(supabase) {
  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id,name,label");

  if (rolesError) throw rolesError;

  const { data: permissions, error: permissionsError } = await supabase
    .from("permissions")
    .select("id,key");

  if (permissionsError) throw permissionsError;

  const permissionByKey = new Map();

  (permissions || []).forEach((permission) => {
    if (permission?.key) {
      permissionByKey.set(permission.key, permission.id);
    }
  });

  const { data: existingRolePermissions, error: existingRpError } =
    await supabase.from("role_permissions").select("role_id,permission_id");

  if (existingRpError) throw existingRpError;

  const existingSet = new Set(
    (existingRolePermissions || []).map(
      (row) => `${row.role_id}:${row.permission_id}`
    )
  );

  const rowsToInsert = [];

  (roles || []).forEach((role) => {
    const roleName = normalizeRole(role.name || role.label);
    const defaultKeys = DEFAULT_ROLE_PERMISSIONS[roleName] || [];

    defaultKeys.forEach((key) => {
      const permissionId = permissionByKey.get(key);
      if (!permissionId) return;

      const pairKey = `${role.id}:${permissionId}`;
      if (existingSet.has(pairKey)) return;

      rowsToInsert.push({
        role_id: role.id,
        permission_id: permissionId,
      });
    });
  });

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("role_permissions")
      .upsert(rowsToInsert, {
        onConflict: "role_id,permission_id",
        ignoreDuplicates: true,
      });

    if (insertError) throw insertError;
  }
}

export async function GET(req) {
  const supabase = getAdminClient();

  try {
    const guard = await requireAdmin(req, supabase);

    if (guard.error) return guard.error;

    await seedPermissions(supabase);
    await seedDefaultRolePermissions(supabase);

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

      supabase.from("role_permissions").select("id,role_id,permission_id"),

      supabase.from("user_permissions").select("id,user_id,permission_id,effect"),

      supabase.from("role_company_access").select("id,role_id,company_id"),

      supabase.from("user_company_access").select("id,user_id,company_id,effect"),
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

function removeDuplicateIds(values = []) {
  return Array.from(new Set((values || []).filter(Boolean)));
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
      const permissionIds = removeDuplicateIds(
        Array.isArray(body?.permission_ids) ? body.permission_ids : []
      );

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
      const allowIds = removeDuplicateIds(
        Array.isArray(body?.allow_permission_ids)
          ? body.allow_permission_ids
          : []
      );
      const denyIds = removeDuplicateIds(
        Array.isArray(body?.deny_permission_ids) ? body.deny_permission_ids : []
      );

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
      const companyIds = removeDuplicateIds(
        Array.isArray(body?.company_ids) ? body.company_ids : []
      );

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
      const allowCompanyIds = removeDuplicateIds(
        Array.isArray(body?.allow_company_ids) ? body.allow_company_ids : []
      );
      const denyCompanyIds = removeDuplicateIds(
        Array.isArray(body?.deny_company_ids) ? body.deny_company_ids : []
      );

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