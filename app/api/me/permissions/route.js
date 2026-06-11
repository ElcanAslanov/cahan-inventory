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

  if (value === "RƏHBƏR" || value === "REHBƏR" || value === "RƏHBER") {
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

export async function GET(req) {
  const supabase = getAdminClient();

  try {
    const authUser = await getAuthUser(req, supabase);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", permissionKeys: [] },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,user_role,role_id,status")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("ME_PERMISSIONS_PROFILE_ERROR:", profileError);

      return NextResponse.json(
        {
          error:
            profileError.message ||
            "Profil permission üçün oxunarkən xəta baş verdi.",
          permissionKeys: [],
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Profil tapılmadı.", permissionKeys: [] },
        { status: 404 }
      );
    }

    if (profile.status && profile.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "İstifadəçi aktiv deyil.", permissionKeys: [] },
        { status: 403 }
      );
    }

    let roleId = profile.role_id || null;
    const roleName = normalizeRole(profile.user_role);

    if (!roleId && roleName) {
      const { data: roleRow, error: roleError } = await supabase
        .from("roles")
        .select("id,name")
        .eq("name", roleName)
        .maybeSingle();

      if (roleError) {
        console.error("ME_PERMISSIONS_ROLE_ERROR:", roleError);
      }

      roleId = roleRow?.id || null;
    }

    if (roleName === "ADMIN") {
      const { data: allPermissions, error: allPermissionsError } =
        await supabase.from("permissions").select("key");

      if (allPermissionsError) throw allPermissionsError;

      return NextResponse.json({
        permissionKeys: (allPermissions || [])
          .map((row) => row.key)
          .filter(Boolean),
      });
    }

    const permissionSet = new Set();

    if (roleId) {
      const { data: rolePermissionRows, error: rolePermissionError } =
        await supabase
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

      if (rolePermissionError) throw rolePermissionError;

      (rolePermissionRows || []).forEach((row) => {
        const key = row.permissions?.key;
        if (key) permissionSet.add(key);
      });
    }

    const { data: userPermissionRows, error: userPermissionError } =
      await supabase
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
        .eq("user_id", authUser.id);

    if (userPermissionError) throw userPermissionError;

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

    return NextResponse.json({
      permissionKeys: Array.from(permissionSet),
    });
  } catch (err) {
    console.error("ME_PERMISSIONS_GET_ERROR:", err);

    return NextResponse.json(
      {
        error: err?.message || "Permission məlumatı alınmadı.",
        permissionKeys: [],
      },
      { status: 500 }
    );
  }
}