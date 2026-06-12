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

function normalizeAccessScope(scope) {
  const value = String(scope || "").trim().toUpperCase();

  if (value === "ALL_COMPANIES") return "ALL_COMPANIES";

  return "OWN_COMPANY";
}

async function getAuthUser(req, supabase) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

function uniqueArray(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

async function resolveRoleId(supabase, profile, roleName) {
  if (profile?.role_id) return profile.role_id;

  if (!roleName) return null;

  const { data: roleRow, error: roleError } = await supabase
    .from("roles")
    .select("id,name,label")
    .eq("name", roleName)
    .maybeSingle();

  if (roleError) {
    console.error("ME_PERMISSIONS_ROLE_ERROR:", roleError);
    return null;
  }

  return roleRow?.id || null;
}

async function getRolePermissions(supabase, roleId) {
  if (!roleId) return [];

  const { data, error } = await supabase
    .from("role_permissions")
    .select(
      `
      permission_id,
      permissions (
        key
      )
    `
    )
    .eq("role_id", roleId);

  if (error) throw error;

  return (data || [])
    .map((row) => row.permissions?.key)
    .filter(Boolean);
}

async function getUserPermissionOverrides(supabase, userId) {
  const { data, error } = await supabase
    .from("user_permissions")
    .select(
      `
      permission_id,
      effect,
      permissions (
        key
      )
    `
    )
    .eq("user_id", userId);

  if (error) throw error;

  return data || [];
}

async function getAllPermissionKeys(supabase) {
  const { data, error } = await supabase
    .from("permissions")
    .select("key")
    .order("key", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => row.key).filter(Boolean);
}

async function getRoleCompanyIds(supabase, roleId) {
  if (!roleId) return [];

  const { data, error } = await supabase
    .from("role_company_access")
    .select("company_id")
    .eq("role_id", roleId);

  if (error) throw error;

  return (data || []).map((row) => row.company_id).filter(Boolean);
}

async function getUserCompanyOverrides(supabase, userId) {
  const { data, error } = await supabase
    .from("user_company_access")
    .select("company_id,effect")
    .eq("user_id", userId);

  if (error) throw error;

  return data || [];
}

async function getAllCompanyIds(supabase) {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .order("id", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => row.id).filter(Boolean);
}

function applyUserPermissionOverrides(permissionSet, userPermissionRows) {
  (userPermissionRows || []).forEach((row) => {
    const key = row.permissions?.key;

    if (!key) return;

    if (row.effect === "ALLOW") {
      permissionSet.add(key);
    }

    if (row.effect === "DENY") {
      permissionSet.delete(key);
    }
  });

  return permissionSet;
}

function applyUserCompanyOverrides(companySet, userCompanyRows) {
  (userCompanyRows || []).forEach((row) => {
    if (!row.company_id) return;

    if (row.effect === "ALLOW") {
      companySet.add(row.company_id);
    }

    if (row.effect === "DENY") {
      companySet.delete(row.company_id);
    }
  });

  return companySet;
}

function makeCan(permissionKeys) {
  const set = new Set(permissionKeys || []);

  return {
    inventory: {
      view: set.has("inventory.view"),
      export: set.has("inventory.export"),
      create: set.has("inventory.create"),
      edit: set.has("inventory.edit"),
      delete: set.has("inventory.delete"),
      qrManage: set.has("inventory.qr.manage"),
      transfer: set.has("inventory.transfer"),
    },
    logs: {
      view: set.has("logs.view"),
      export: set.has("logs.export"),
    },
    companies: {
      view: set.has("companies.view"),
      create: set.has("companies.create"),
      edit: set.has("companies.edit"),
      delete: set.has("companies.delete"),
    },
    departments: {
      view: set.has("departments.view"),
      create: set.has("departments.create"),
      edit: set.has("departments.edit"),
      delete: set.has("departments.delete"),
    },
    categories: {
      view: set.has("categories.view"),
      create: set.has("categories.create"),
      edit: set.has("categories.edit"),
      delete: set.has("categories.delete"),
    },
    users: {
      view: set.has("users.view"),
      create: set.has("users.create"),
      edit: set.has("users.edit"),
      delete: set.has("users.delete"),
    },
    permissions: {
      view: set.has("permissions.view"),
      edit: set.has("permissions.edit"),
    },
  };
}

export async function GET(req) {
  const supabase = getAdminClient();

  try {
    const authUser = await getAuthUser(req, supabase);

    if (!authUser) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          profile: null,
          role: "GUEST",
          accessScope: "OWN_COMPANY",
          permissionKeys: [],
          can: makeCan([]),
          companyAccess: {
            all: false,
            companyIds: [],
          },
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
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
        status,
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
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("ME_PERMISSIONS_PROFILE_ERROR:", profileError);

      return NextResponse.json(
        {
          error:
            profileError.message ||
            "Profil permission üçün oxunarkən xəta baş verdi.",
          profile: null,
          role: "GUEST",
          accessScope: "OWN_COMPANY",
          permissionKeys: [],
          can: makeCan([]),
          companyAccess: {
            all: false,
            companyIds: [],
          },
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: "Profil tapılmadı.",
          profile: null,
          role: "GUEST",
          accessScope: "OWN_COMPANY",
          permissionKeys: [],
          can: makeCan([]),
          companyAccess: {
            all: false,
            companyIds: [],
          },
        },
        { status: 404 }
      );
    }

    if (profile.status && profile.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "İstifadəçi aktiv deyil.",
          profile: {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            status: profile.status,
          },
          role: normalizeRole(profile.user_role),
          accessScope: normalizeAccessScope(profile.access_scope),
          permissionKeys: [],
          can: makeCan([]),
          companyAccess: {
            all: false,
            companyIds: [],
          },
        },
        { status: 403 }
      );
    }

    const roleName = normalizeRole(
      profile.roles?.name || profile.user_role || "USER"
    );

    const accessScope = normalizeAccessScope(profile.access_scope);
    const roleId = await resolveRoleId(supabase, profile, roleName);

    let permissionKeys = [];

    if (roleName === "ADMIN") {
      permissionKeys = await getAllPermissionKeys(supabase);
    } else {
      const rolePermissionKeys = await getRolePermissions(supabase, roleId);
      const permissionSet = new Set(rolePermissionKeys);

      const userPermissionRows = await getUserPermissionOverrides(
        supabase,
        authUser.id
      );

      applyUserPermissionOverrides(permissionSet, userPermissionRows);

      permissionKeys = Array.from(permissionSet);
    }

    permissionKeys = uniqueArray(permissionKeys).sort();

    let companyAccess = {
      all: false,
      companyIds: [],
    };

    if (roleName === "ADMIN" || accessScope === "ALL_COMPANIES") {
      const allCompanyIds = await getAllCompanyIds(supabase);

      const companySet = new Set(allCompanyIds);
      const userCompanyRows = await getUserCompanyOverrides(
        supabase,
        authUser.id
      );

      applyUserCompanyOverrides(companySet, userCompanyRows);

      companyAccess = {
        all: true,
        companyIds: Array.from(companySet),
      };
    } else {
      const companySet = new Set();

      if (profile.company_id) {
        companySet.add(profile.company_id);
      }

      const roleCompanyIds = await getRoleCompanyIds(supabase, roleId);
      roleCompanyIds.forEach((companyId) => {
        if (companyId) companySet.add(companyId);
      });

      const userCompanyRows = await getUserCompanyOverrides(
        supabase,
        authUser.id
      );

      applyUserCompanyOverrides(companySet, userCompanyRows);

      companyAccess = {
        all: false,
        companyIds: Array.from(companySet),
      };
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        status: profile.status,
        user_role: profile.user_role,
        role_id: roleId,
        role_name: roleName,
        role_label: profile.roles?.label || roleName,
        company_id: profile.company_id,
        company_name: profile.companies?.name || null,
        access_scope: accessScope,
      },
      role: roleName,
      accessScope,
      permissionKeys,
      can: makeCan(permissionKeys),
      companyAccess,
    });
  } catch (err) {
    console.error("ME_PERMISSIONS_GET_ERROR:", {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
      raw: err,
    });

    return NextResponse.json(
      {
        error: err?.message || "Permission məlumatı alınmadı.",
        profile: null,
        role: "GUEST",
        accessScope: "OWN_COMPANY",
        permissionKeys: [],
        can: makeCan([]),
        companyAccess: {
          all: false,
          companyIds: [],
        },
      },
      { status: 500 }
    );
  }
}
