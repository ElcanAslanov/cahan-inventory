import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabaseServer";

export async function getCurrentUserProfile() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      email,
      status,
      company_id,
      department_id,
      roles (
        id,
        name,
        label
      ),
      companies (
        id,
        name
      ),
      departments (
        id,
        name
      )
    `
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  return {
    user,
    profile,
    role: profile.roles?.name || null,
  };
}

export async function requireAuth() {
  const session = await getCurrentUserProfile();

  if (!session) {
    redirect("/login");
  }

  if (session.profile?.status !== "ACTIVE") {
    redirect("/login?error=inactive");
  }

  return session;
}

export async function requireRole(allowedRoles = []) {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }

  return session;
}