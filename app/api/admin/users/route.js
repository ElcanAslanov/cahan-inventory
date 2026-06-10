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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "USER").trim().toUpperCase();

  if (["ADMIN", "REHBER", "USER"].includes(role)) {
    return role;
  }

  return "USER";
}

function normalizeStatus(value) {
  const status = String(value || "ACTIVE").trim().toUpperCase();

  if (["ACTIVE", "INACTIVE"].includes(status)) {
    return status;
  }

  return "ACTIVE";
}

function normalizeAccessScope(value) {
  const scope = String(value || "OWN_COMPANY").trim().toUpperCase();

  if (["OWN_COMPANY", "ALL_COMPANIES"].includes(scope)) {
    return scope;
  }

  return "OWN_COMPANY";
}

function normalizeCompanyId(value) {
  const companyId = String(value || "").trim();
  return companyId || null;
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

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      users: data || [],
    });
  } catch (e) {
    return errorResponse(e?.message || "Server xətası baş verdi.", 500);
  }
}

export async function POST(req) {
  let createdAuthUserId = null;

  try {
    const body = await req.json();

    const full_name = normalizeString(body.full_name);
    const email = normalizeEmail(body.email);
    const password = normalizeString(body.password);
    const user_role = normalizeRole(body.user_role);
    const status = normalizeStatus(body.status);
    const access_scope = normalizeAccessScope(body.access_scope);
    const company_id = normalizeCompanyId(body.company_id);

    if (!full_name) {
      return errorResponse("Ad soyad məcburidir.", 400);
    }

    if (!email) {
      return errorResponse("Email məcburidir.", 400);
    }

    if (!password || password.length < 6) {
      return errorResponse("Şifrə minimum 6 simvol olmalıdır.", 400);
    }

    const supabase = getAdminClient();

    const { data: existingProfile, error: existingProfileError } =
      await supabase
        .from("profiles")
        .select("id,email")
        .eq("email", email)
        .maybeSingle();

    if (existingProfileError) {
      return errorResponse(existingProfileError.message, 500);
    }

    if (existingProfile?.id) {
      return errorResponse("Bu email ilə istifadəçi artıq mövcuddur.", 409);
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

    if (authError) {
      return errorResponse(
        authError.message || "Auth user yaradıla bilmədi.",
        500
      );
    }

    const userId = authData?.user?.id;
    createdAuthUserId = userId || null;

    if (!userId) {
      return errorResponse("Auth user ID tapılmadı.", 500);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name,
          email,
          user_role,
          status,
          access_scope,
          company_id,
        },
        {
          onConflict: "id",
        }
      )
      .select("*")
      .single();

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);

      return errorResponse(
        profileError.message || "Profil yaradıla bilmədi.",
        500
      );
    }

    return NextResponse.json({
      user: profile,
    });
  } catch (e) {
    if (createdAuthUserId) {
      try {
        const supabase = getAdminClient();
        await supabase.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        // rollback error intentionally ignored
      }
    }

    return errorResponse(e?.message || "Server xətası baş verdi.", 500);
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();

    const id = normalizeString(body.id);
    const full_name = normalizeString(body.full_name);
    const email = normalizeEmail(body.email);
    const password = normalizeString(body.password);
    const user_role = normalizeRole(body.user_role);
    const status = normalizeStatus(body.status);
    const access_scope = normalizeAccessScope(body.access_scope);
    const company_id = normalizeCompanyId(body.company_id);

    if (!id) {
      return errorResponse("İstifadəçi ID tapılmadı.", 400);
    }

    if (!full_name) {
      return errorResponse("Ad soyad məcburidir.", 400);
    }

    if (!email) {
      return errorResponse("Email məcburidir.", 400);
    }

    if (password && password.length < 6) {
      return errorResponse("Yeni şifrə minimum 6 simvol olmalıdır.", 400);
    }

    const supabase = getAdminClient();

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("id", id)
      .maybeSingle();

    if (currentProfileError) {
      return errorResponse(currentProfileError.message, 500);
    }

    if (!currentProfile?.id) {
      return errorResponse("İstifadəçi profili tapılmadı.", 404);
    }

    const { data: sameEmailProfile, error: sameEmailError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("email", email)
      .neq("id", id)
      .maybeSingle();

    if (sameEmailError) {
      return errorResponse(sameEmailError.message, 500);
    }

    if (sameEmailProfile?.id) {
      return errorResponse("Bu email başqa istifadəçiyə məxsusdur.", 409);
    }

    const authUpdatePayload = {
      email,
      user_metadata: {
        full_name,
      },
    };

    if (password) {
      authUpdatePayload.password = password;
    }

    const { error: authUpdateError } =
      await supabase.auth.admin.updateUserById(id, authUpdatePayload);

    if (authUpdateError) {
      return errorResponse(
        authUpdateError.message ||
          "Auth istifadəçi məlumatları yenilənərkən xəta baş verdi.",
        500
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name,
        email,
        user_role,
        status,
        access_scope,
        company_id,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      user: data,
    });
  } catch (e) {
    return errorResponse(e?.message || "Server xətası baş verdi.", 500);
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = normalizeString(searchParams.get("id"));

    if (!id) {
      return errorResponse("İstifadəçi ID tapılmadı.", 400);
    }

    const supabase = getAdminClient();

    const { data: profile, error: profileFindError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("id", id)
      .maybeSingle();

    if (profileFindError) {
      return errorResponse(profileFindError.message, 500);
    }

    if (!profile?.id) {
      return errorResponse("İstifadəçi profili tapılmadı.", 404);
    }

    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileDeleteError) {
      return errorResponse(
        profileDeleteError.message || "Profil silinə bilmədi.",
        500
      );
    }

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(id);

    if (authDeleteError) {
      return errorResponse(
        authDeleteError.message || "Auth user silinə bilmədi.",
        500
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (e) {
    return errorResponse(e?.message || "Server xətası baş verdi.", 500);
  }
}