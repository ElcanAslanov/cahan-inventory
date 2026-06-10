export const ROLES = {
  ADMIN: "ADMIN",
  REHBER: "REHBER",
  USER: "USER",
  IZLEYICI: "IZLEYICI",
  AUDIT: "AUDIT",
};

export function normalizeRole(role) {
  return String(role || "USER").toUpperCase();
}

export function canViewInventory(role) {
  const currentRole = normalizeRole(role);
  return ["ADMIN", "REHBER", "IZLEYICI", "AUDIT"].includes(currentRole);
}

export function canCreateInventory(role) {
  const currentRole = normalizeRole(role);
  return ["ADMIN", "REHBER"].includes(currentRole);
}

export function canEditInventory(role) {
  const currentRole = normalizeRole(role);
  return ["ADMIN", "REHBER"].includes(currentRole);
}

export function canDeleteInventory(role) {
  const currentRole = normalizeRole(role);
  return currentRole === "ADMIN";
}

export function canViewReports(role) {
  const currentRole = normalizeRole(role);
  return ["ADMIN", "REHBER", "IZLEYICI", "AUDIT"].includes(currentRole);
}

export function canManageSettings(role) {
  const currentRole = normalizeRole(role);
  return currentRole === "ADMIN";
}

export function canViewMyInventory(role) {
  const currentRole = normalizeRole(role);
  return ["ADMIN", "REHBER", "USER"].includes(currentRole);
}

export function canViewAudit(role) {
  const currentRole = normalizeRole(role);
  return ["ADMIN", "AUDIT"].includes(currentRole);
}