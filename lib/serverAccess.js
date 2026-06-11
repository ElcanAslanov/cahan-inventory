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

export async function getAllowedCompanyIds(supabase, userId) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,user_role,role_id,company_id,access_scope,status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    return {
      all: false,
      companyIds: [],
    };
  }

  if (profile.status && profile.status !== "ACTIVE") {
    return {
      all: false,
      companyIds: [],
    };
  }

  const roleName = normalizeRole(profile.user_role);

  if (roleName === "ADMIN" || profile.access_scope === "ALL_COMPANIES") {
    return {
      all: true,
      companyIds: [],
    };
  }

  const companySet = new Set();

  if (profile.company_id) {
    companySet.add(profile.company_id);
  }

  let roleId = profile.role_id || null;

  if (!roleId && roleName) {
    const { data: roleRow, error: roleError } = await supabase
      .from("roles")
      .select("id,name")
      .eq("name", roleName)
      .maybeSingle();

    if (roleError) throw roleError;

    roleId = roleRow?.id || null;
  }

  if (roleId) {
    const { data: roleCompanies, error: roleCompanyError } = await supabase
      .from("role_company_access")
      .select("company_id")
      .eq("role_id", roleId);

    if (roleCompanyError) throw roleCompanyError;

    (roleCompanies || []).forEach((row) => {
      if (row.company_id) {
        companySet.add(row.company_id);
      }
    });
  }

  const { data: userCompanies, error: userCompanyError } = await supabase
    .from("user_company_access")
    .select("company_id,effect")
    .eq("user_id", userId);

  if (userCompanyError) throw userCompanyError;

  (userCompanies || []).forEach((row) => {
    if (!row.company_id) return;

    if (row.effect === "ALLOW") {
      companySet.add(row.company_id);
    }

    if (row.effect === "DENY") {
      companySet.delete(row.company_id);
    }
  });

  return {
    all: false,
    companyIds: Array.from(companySet),
  };
}

export function applyCompanyAccessToQuery(query, access, columnName = "company_id") {
  if (access?.all) {
    return query;
  }

  if (!access?.companyIds || access.companyIds.length === 0) {
    return null;
  }

  return query.in(columnName, access.companyIds);
}