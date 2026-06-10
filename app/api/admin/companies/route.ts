import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment dəyişənləri tapılmadı.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getCurrentUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const supabase = getAdminClient();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

async function requireAdmin(req: Request) {
  const user = await getCurrentUser(req);

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Giriş edilməyib." },
        { status: 401 }
      ),
    };
  }

  const supabase = getAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Profil tapılmadı." },
        { status: 403 }
      ),
    };
  }

  if (profile.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bu əməliyyat üçün icazəniz yoxdur." },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("companies")
      .select("id,name,status,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Şirkətlər yüklənərkən xəta baş verdi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ companies: data || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server xətası baş verdi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const permission = await requireAdmin(req);
    if (!permission.ok) return permission.response;

    const body = await req.json();

    const name = String(body.name || "").trim();
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    if (!name) {
      return NextResponse.json(
        { error: "Şirkət adı məcburidir." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("companies")
      .insert({
        name,
        status,
      })
      .select("id,name,status,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Şirkət əlavə edilərkən xəta baş verdi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server xətası baş verdi." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const permission = await requireAdmin(req);
    if (!permission.ok) return permission.response;

    const body = await req.json();

    const id = body.id;
    const name = String(body.name || "").trim();
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    if (!id) {
      return NextResponse.json(
        { error: "Şirkət ID tapılmadı." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Şirkət adı məcburidir." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("companies")
      .update({
        name,
        status,
      })
      .eq("id", id)
      .select("id,name,status,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Şirkət yenilənərkən xəta baş verdi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server xətası baş verdi." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const permission = await requireAdmin(req);
    if (!permission.ok) return permission.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Şirkət ID tapılmadı." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { error } = await supabase.from("companies").delete().eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Şirkət silinərkən xəta baş verdi. Bu şirkət inventarlara bağlı ola bilər.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server xətası baş verdi." },
      { status: 500 }
    );
  }
}