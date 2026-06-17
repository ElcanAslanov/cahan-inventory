"use client";

import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/permissions.css";

const USER_PAGE_SIZE = 50;
const CACHE_KEY = "permissions-page-cache-v3";
const CACHE_TTL_MS = 1000 * 60 * 5;

const TABS = [
    {
        key: "ROLE_PERMISSIONS",
        title: "Rol yetkiləri",
        desc: "Rolun görə biləcəyi səhifə və əməliyyatlar",
    },
    {
        key: "USER_PERMISSIONS",
        title: "İstifadəçi override",
        desc: "İstifadəçiyə əlavə icazə ver və ya blokla",
    },
    {
        key: "ROLE_COMPANIES",
        title: "Rol şirkətləri",
        desc: "Rolun görə biləcəyi şirkətlər",
    },
    {
        key: "USER_COMPANIES",
        title: "İstifadəçi şirkət override",
        desc: "İstifadəçiyə şirkət üzrə xüsusi icazə ver",
    },
];

const USER_TABS = ["USER_PERMISSIONS", "USER_COMPANIES"];

const IMPORTANT_PERMISSION_KEYS = [
    "dashboard.view",

    "inventory.view",
    "inventory.export",
    "inventory.import",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "inventory.qr.manage",
    "inventory.transfer",

    "transfers.view",
    "transfers.create",
    "transfers.edit",
    "transfers.delete",

    "logs.view",
    "logs.export",

    "companies.view",
    "companies.create",
    "companies.edit",
    "companies.delete",

    "departments.view",
    "departments.create",
    "departments.edit",
    "departments.delete",

    "categories.view",
    "categories.create",
    "categories.edit",
    "categories.delete",

    "users.view",
    "users.export",
    "users.create",
    "users.edit",
    "users.delete",

    "permissions.view",
    "permissions.edit",

    "my_inventory.view",
    "my_inventory.export",

    "audit.view",
    "audit.export",
];

const DEFAULT_LABELS = {
    "dashboard.view": "Dashboard görsün",

    "inventory.view": "İnventarlara baxsın",
    "inventory.export": "İnventar export etsin",
    "inventory.import": "İnventar import etsin",
    "inventory.create": "Yeni inventar əlavə etsin",
    "inventory.edit": "İnventarı düzəltsin",
    "inventory.delete": "İnventarı silsin",
    "inventory.qr.manage": "QR yaratsın / idarə etsin",
    "inventory.transfer": "İnventar təhkim / transfer etsin",

    "transfers.view": "Yerdəyişmə səhifəsinə baxsın",
    "transfers.create": "Yerdəyişmə yaratsın",
    "transfers.edit": "Yerdəyişməni düzəltsin",
    "transfers.delete": "Yerdəyişməni silsin",

    "logs.view": "Loglara baxsın",
    "logs.export": "Log export etsin",

    "companies.view": "Şirkətlərə baxsın",
    "companies.create": "Şirkət əlavə etsin",
    "companies.edit": "Şirkəti düzəltsin",
    "companies.delete": "Şirkəti silsin",

    "departments.view": "Departamentlərə baxsın",
    "departments.create": "Departament əlavə etsin",
    "departments.edit": "Departamenti düzəltsin",
    "departments.delete": "Departamenti silsin",

    "categories.view": "Kateqoriyalara baxsın",
    "categories.create": "Kateqoriya əlavə etsin",
    "categories.edit": "Kateqoriyanı düzəltsin",
    "categories.delete": "Kateqoriyanı silsin",

    "users.view": "İstifadəçilərə baxsın",
    "users.export": "İstifadəçiləri export etsin",
    "users.create": "İstifadəçi əlavə etsin",
    "users.edit": "İstifadəçini düzəltsin",
    "users.delete": "İstifadəçini silsin",

    "permissions.view": "Yetkiləndirməyə baxsın",
    "permissions.edit": "Yetkiləndirməni dəyişsin",

    "my_inventory.view": "Mənim inventarlarım səhifəsinə baxsın",
    "my_inventory.export": "Mənim inventarlarım export etsin",

    "audit.view": "Audit / hesabatlara baxsın",
    "audit.export": "Audit / hesabat export etsin",
};

const DEFAULT_GROUPS = {
    dashboard: "Əsas",
    inventory: "İnventarlar",
    transfers: "Yerdəyişmə",
    logs: "Loglar",
    companies: "Şirkətlər",
    departments: "Departamentlər",
    categories: "Kateqoriyalar",
    users: "İstifadəçilər",
    permissions: "Yetkiləndirmə",
    my_inventory: "Mənim inventarlarım",
    audit: "Audit / Hesabat",
};

function normalizeRole(value) {
    const role = String(value || "").trim().toUpperCase();

    if (role === "ADMIN") return "ADMIN";

    if (
        role === "RƏHBƏR" ||
        role === "REHBƏR" ||
        role === "RƏHBER" ||
        role === "REHBER"
    ) {
        return "REHBER";
    }

    if (role === "AUDİT" || role === "AUDIT" || role === "AUDITOR") {
        return "AUDIT";
    }

    if (
        role === "İZLEYICI" ||
        role === "İZLƏYİCİ" ||
        role === "IZLƏYICI" ||
        role === "IZLEYICI" ||
        role === "VIEWER"
    ) {
        return "IZLEYICI";
    }

    if (
        role === "İSTİFADƏÇİ" ||
        role === "ISTIFADECI" ||
        role === "USER"
    ) {
        return "USER";
    }

    return role || "USER";
}

function roleLabel(role) {
    const normalized = normalizeRole(role?.name || role?.label || "");

    if (normalized === "ADMIN") return role?.label || "Admin";
    if (normalized === "REHBER") return role?.label || "Rəhbər";
    if (normalized === "IZLEYICI") return role?.label || "İzləyici";
    if (normalized === "AUDIT") return role?.label || "Audit";
    if (normalized === "USER") return role?.label || "İstifadəçi";

    return role?.label || role?.name || "-";
}

function userLabel(user) {
    return user?.full_name || user?.email || user?.id || "-";
}

function permissionGroupName(permission) {
    if (permission.group_name) return permission.group_name;

    const prefix = String(permission.key || "").split(".")[0];

    return DEFAULT_GROUPS[prefix] || "Ümumi";
}

function permissionLabel(permission) {
    return permission.label || DEFAULT_LABELS[permission.key] || permission.key;
}

function permissionActionType(permission) {
    const key = String(permission.key || "");
    const action = key.split(".").pop();

    if (action === "view") return "view";
    if (action === "export") return "export";
    if (action === "import") return "import";
    if (action === "create") return "create";
    if (action === "edit") return "edit";
    if (action === "delete") return "delete";
    if (action === "transfer") return "transfer";
    if (action === "manage") return "manage";

    if (key.includes("qr.manage")) return "manage";

    return "other";
}

function permissionSortWeight(permission) {
    const action = permissionActionType(permission);

    const order = {
        view: 1,
        export: 2,
        import: 3,
        create: 4,
        edit: 5,
        delete: 6,
        transfer: 7,
        manage: 8,
        other: 99,
    };

    return order[action] || 99;
}

function normalizePermission(permission) {
    return {
        ...permission,
        label: permissionLabel(permission),
        group_name: permissionGroupName(permission),
        action_type: permissionActionType(permission),
    };
}

function groupByPermission(permissions) {
    const map = new Map();

    permissions.forEach((permission) => {
        const normalized = normalizePermission(permission);
        const group = normalized.group_name || "Ümumi";

        if (!map.has(group)) {
            map.set(group, []);
        }

        map.get(group).push(normalized);
    });

    return Array.from(map.entries()).map(([group, items]) => ({
        group,
        items: items.sort((a, b) => {
            const weightDiff = permissionSortWeight(a) - permissionSortWeight(b);
            if (weightDiff !== 0) return weightDiff;

            return String(a.key || "").localeCompare(String(b.key || ""), "az");
        }),
    }));
}

function ensureImportantPermissions(list) {
    const byKey = new Map();

    (list || []).forEach((permission) => {
        if (permission?.key) {
            byKey.set(permission.key, normalizePermission(permission));
        }
    });

    IMPORTANT_PERMISSION_KEYS.forEach((key) => {
        if (!byKey.has(key)) {
            byKey.set(key, {
                id: `virtual-${key}`,
                key,
                label: DEFAULT_LABELS[key] || key,
                group_name: DEFAULT_GROUPS[key.split(".")[0]] || "Ümumi",
                description:
                    "Bu permission hələ bazada yoxdur. /api/admin/permissions seed hissəsinə əlavə edilməlidir.",
                virtual: true,
            });
        }
    });

    return Array.from(byKey.values()).sort((a, b) => {
        const groupCompare = permissionGroupName(a).localeCompare(
            permissionGroupName(b),
            "az"
        );

        if (groupCompare !== 0) return groupCompare;

        const weightDiff = permissionSortWeight(a) - permissionSortWeight(b);
        if (weightDiff !== 0) return weightDiff;

        return String(a.key || "").localeCompare(String(b.key || ""), "az");
    });
}

async function getAuthHeaders() {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
    };
}

function normalizePermissionKeys(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasPermission(permissionKeys, key) {
    return normalizePermissionKeys(permissionKeys).includes(key);
}

function getUserAccessScope(user) {
    return String(user?.access_scope || "OWN_COMPANY").trim().toUpperCase();
}

function getUserAccessScopeText(user) {
    const scope = getUserAccessScope(user);

    if (scope === "ALL_COMPANIES") {
        return "Bütün şirkətlər";
    }

    return "Öz şirkəti";
}

function isVirtualPermissionId(permissionId) {
    return String(permissionId || "").startsWith("virtual-");
}

function readCache() {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed?.created_at) return null;

        if (Date.now() - parsed.created_at > CACHE_TTL_MS) return null;

        return parsed;
    } catch {
        return null;
    }
}

function writeCache(payload) {
    if (typeof window === "undefined") return;

    try {
        window.sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
                ...payload,
                created_at: Date.now(),
            })
        );
    } catch {
        // cache fail olarsa səhifə qırılmasın
    }
}

export default function PermissionsPage() {
    const didBootRef = useRef(false);

    const [pageReady, setPageReady] = useState(false);
    const [booting, setBooting] = useState(true);
    const [baseLoading, setBaseLoading] = useState(false);
    const [permissionError, setPermissionError] = useState("");
    const [saving, setSaving] = useState(false);

    const [myPermissionKeys, setMyPermissionKeys] = useState([]);

    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [users, setUsers] = useState([]);

    const [rolePermissions, setRolePermissions] = useState([]);
    const [userPermissions, setUserPermissions] = useState([]);
    const [roleCompanyAccess, setRoleCompanyAccess] = useState([]);
    const [userCompanyAccess, setUserCompanyAccess] = useState([]);

    const [activeTab, setActiveTab] = useState("ROLE_PERMISSIONS");

    const [selectedRoleId, setSelectedRoleId] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");

    const [rolePermissionIds, setRolePermissionIds] = useState([]);
    const [userAllowPermissionIds, setUserAllowPermissionIds] = useState([]);
    const [userDenyPermissionIds, setUserDenyPermissionIds] = useState([]);

    const [roleCompanyIds, setRoleCompanyIds] = useState([]);
    const [userAllowCompanyIds, setUserAllowCompanyIds] = useState([]);
    const [userDenyCompanyIds, setUserDenyCompanyIds] = useState([]);

    const [searchPermission, setSearchPermission] = useState("");
    const [searchCompany, setSearchCompany] = useState("");
    const [searchUser, setSearchUser] = useState("");

    const [usersLoading, setUsersLoading] = useState(false);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [userPage, setUserPage] = useState(1);

    const canView = hasPermission(myPermissionKeys, "permissions.view");
    const canEdit = hasPermission(myPermissionKeys, "permissions.edit");
    const isUserTab = USER_TABS.includes(activeTab);

    useEffect(() => {
        if (didBootRef.current) return;
        didBootRef.current = true;

        const cached = readCache();

        if (cached) {
            hydrateBase(cached);
            setPageReady(true);
            setBooting(false);
            bootPage({ silent: true });
            return;
        }

        setPageReady(true);
        setBooting(true);
        bootPage({ silent: false });
    }, []);

    useEffect(() => {
        if (!selectedRoleId && roles.length > 0) {
            const izleyici = roles.find(
                (role) => normalizeRole(role.name || role.label) === "IZLEYICI"
            );

            setSelectedRoleId(izleyici?.id || roles[0].id);
        }
    }, [roles, selectedRoleId]);

    useEffect(() => {
        if (!selectedUserId && users.length > 0) {
            setSelectedUserId(users[0].id);
        }
    }, [users, selectedUserId]);

    useEffect(() => {
        if (!selectedRoleId) {
            setRolePermissionIds([]);
            setRoleCompanyIds([]);
            return;
        }

        setRolePermissionIds(
            rolePermissions
                .filter((row) => row.role_id === selectedRoleId)
                .map((row) => row.permission_id)
        );

        setRoleCompanyIds(
            roleCompanyAccess
                .filter((row) => row.role_id === selectedRoleId)
                .map((row) => row.company_id)
        );
    }, [selectedRoleId, rolePermissions, roleCompanyAccess]);

    useEffect(() => {
        if (!selectedUserId) {
            setUserAllowPermissionIds([]);
            setUserDenyPermissionIds([]);
            setUserAllowCompanyIds([]);
            setUserDenyCompanyIds([]);
            return;
        }

        const userPerms = userPermissions.filter(
            (row) => row.user_id === selectedUserId
        );

        setUserAllowPermissionIds(
            userPerms
                .filter((row) => row.effect === "ALLOW")
                .map((row) => row.permission_id)
        );

        setUserDenyPermissionIds(
            userPerms
                .filter((row) => row.effect === "DENY")
                .map((row) => row.permission_id)
        );

        const userCompanies = userCompanyAccess.filter(
            (row) => row.user_id === selectedUserId
        );

        setUserAllowCompanyIds(
            userCompanies
                .filter((row) => row.effect === "ALLOW")
                .map((row) => row.company_id)
        );

        setUserDenyCompanyIds(
            userCompanies
                .filter((row) => row.effect === "DENY")
                .map((row) => row.company_id)
        );
    }, [selectedUserId, userPermissions, userCompanyAccess]);

    useEffect(() => {
        if (isUserTab && canView && !usersLoaded && !usersLoading) {
            loadUsers();
        }
    }, [isUserTab, canView, usersLoaded, usersLoading]);

    useEffect(() => {
        setUserPage(1);
    }, [searchUser]);

    function hydrateBase(json) {
        const receivedPermissions = json.permissions || [];
        const ensuredPermissions = ensureImportantPermissions(receivedPermissions);

        setPermissions(ensuredPermissions);
        setRoles(json.roles || []);
        setCompanies(json.companies || []);
        setRolePermissions(json.rolePermissions || []);
        setUserPermissions(json.userPermissions || []);
        setRoleCompanyAccess(json.roleCompanyAccess || []);
        setUserCompanyAccess(json.userCompanyAccess || []);

        if (Array.isArray(json.users) && json.users.length > 0) {
            setUsers(json.users);
            setUsersLoaded(true);
        }

        if (Array.isArray(json.permissionKeys)) {
            setMyPermissionKeys(json.permissionKeys);
        }
    }

    async function bootPage({ silent } = { silent: false }) {
        if (!silent) {
            setBooting(true);
        }

        setPermissionError("");

        try {
            const headers = await getAuthHeaders();

            const permissionPromise = fetch("/api/me/permissions", {
                method: "GET",
                headers,
                cache: "no-store",
            });

            const basePromise = fetch("/api/admin/permissions?scope=base", {
                method: "GET",
                headers,
                cache: "no-store",
            });

            const [permissionRes, baseRes] = await Promise.all([
                permissionPromise,
                basePromise,
            ]);

            const permissionText = await permissionRes.text();
            const permissionJson = permissionText ? JSON.parse(permissionText) : {};

            if (!permissionRes.ok) {
                throw new Error(
                    permissionJson?.error || "Permission məlumatı alınmadı."
                );
            }

            const keys = normalizePermissionKeys(permissionJson.permissionKeys);
            setMyPermissionKeys(keys);

            if (!hasPermission(keys, "permissions.view")) {
                setBooting(false);
                setBaseLoading(false);
                return;
            }

            const baseText = await baseRes.text();
            const baseJson = baseText ? JSON.parse(baseText) : {};

            if (!baseRes.ok) {
                throw new Error(
                    baseJson.error || "Yetkilər yüklənərkən xəta baş verdi."
                );
            }

            const payload = {
                ...baseJson,
                permissionKeys: keys,
            };

            hydrateBase(payload);
            writeCache(payload);
        } catch (err) {
            console.error("PERMISSIONS_BOOT_ERROR:", err);
            setPermissionError(err?.message || "Permission məlumatı alınmadı.");
        } finally {
            setBooting(false);
            setBaseLoading(false);
        }
    }

    async function loadBaseData({ silent } = { silent: false }) {
        if (!silent) setBaseLoading(true);

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/admin/permissions?scope=base", {
                method: "GET",
                headers,
                cache: "no-store",
            });

            const text = await res.text();
            const json = text ? JSON.parse(text) : {};

            if (!res.ok) {
                throw new Error(json.error || "Yetkilər yüklənərkən xəta baş verdi.");
            }

            const payload = {
                ...json,
                permissionKeys: myPermissionKeys,
            };

            hydrateBase(payload);
            writeCache(payload);
        } catch (err) {
            console.error("PERMISSIONS_PAGE_LOAD_ERROR:", err);
            alert(err?.message || "Yetkilər yüklənərkən xəta baş verdi.");
        } finally {
            setBaseLoading(false);
        }
    }

    async function loadUsers() {
        setUsersLoading(true);

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/admin/permissions?scope=users", {
                method: "GET",
                headers,
                cache: "no-store",
            });

            const text = await res.text();
            const json = text ? JSON.parse(text) : {};

            if (!res.ok) {
                throw new Error(json.error || "İstifadəçilər yüklənmədi.");
            }

            setUsers(json.users || []);
            setUserPermissions(json.userPermissions || []);
            setUserCompanyAccess(json.userCompanyAccess || []);
            setUsersLoaded(true);
        } catch (err) {
            console.error("PERMISSIONS_USERS_LOAD_ERROR:", err);
            alert(err?.message || "İstifadəçilər yüklənmədi.");
        } finally {
            setUsersLoading(false);
        }
    }

    async function refreshAll() {
        setUsersLoaded(false);
        setUsers([]);
        setSelectedUserId("");
        await bootPage({ silent: false });

        if (isUserTab) {
            await loadUsers();
        }
    }

    const activeTabData = useMemo(() => {
        return TABS.find((tab) => tab.key === activeTab) || TABS[0];
    }, [activeTab]);

    const selectedRole = useMemo(() => {
        return roles.find((role) => role.id === selectedRoleId) || null;
    }, [roles, selectedRoleId]);

    const selectedUser = useMemo(() => {
        return users.find((user) => user.id === selectedUserId) || null;
    }, [users, selectedUserId]);

    const selectedRoleNormalized = useMemo(() => {
        return normalizeRole(selectedRole?.name || selectedRole?.label);
    }, [selectedRole]);

    const companyMap = useMemo(() => {
        const map = new Map();

        companies.forEach((company) => {
            map.set(company.id, company.name);
        });

        return map;
    }, [companies]);

    const filteredUsers = useMemo(() => {
        const q = searchUser.trim().toLowerCase();

        if (!q) return users;

        return users.filter((user) => {
            const companyName = companyMap.get(user.company_id) || "";
            const accessScopeText = getUserAccessScopeText(user);

            return (
                String(user.full_name || "").toLowerCase().includes(q) ||
                String(user.email || "").toLowerCase().includes(q) ||
                String(user.role || user.user_role || "").toLowerCase().includes(q) ||
                String(companyName || "").toLowerCase().includes(q) ||
                String(accessScopeText || "").toLowerCase().includes(q)
            );
        });
    }, [users, searchUser, companyMap]);

    const userTotalPages = useMemo(() => {
        return Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE));
    }, [filteredUsers.length]);

    const visibleUsers = useMemo(() => {
        const safePage = Math.min(userPage, userTotalPages);
        const start = (safePage - 1) * USER_PAGE_SIZE;
        return filteredUsers.slice(start, start + USER_PAGE_SIZE);
    }, [filteredUsers, userPage, userTotalPages]);

    const filteredPermissions = useMemo(() => {
        const q = searchPermission.trim().toLowerCase();

        if (!q) return permissions;

        return permissions.filter((permission) => {
            return (
                String(permission.key || "").toLowerCase().includes(q) ||
                String(permission.label || "").toLowerCase().includes(q) ||
                String(permission.group_name || "").toLowerCase().includes(q) ||
                String(permission.description || "").toLowerCase().includes(q)
            );
        });
    }, [permissions, searchPermission]);

    const permissionGroups = useMemo(() => {
        return groupByPermission(filteredPermissions);
    }, [filteredPermissions]);

    const filteredCompanies = useMemo(() => {
        const q = searchCompany.trim().toLowerCase();

        if (!q) return companies;

        return companies.filter((company) =>
            String(company.name || "").toLowerCase().includes(q)
        );
    }, [companies, searchCompany]);

    const selectedUserRole = useMemo(() => {
        const userRoleName = normalizeRole(
            selectedUser?.role || selectedUser?.user_role
        );

        if (selectedUser?.role_id) {
            const byId = roles.find((role) => role.id === selectedUser.role_id);
            if (byId) return byId;
        }

        return roles.find((role) => normalizeRole(role.name) === userRoleName) || null;
    }, [selectedUser, roles]);

    const inheritedUserPermissionIds = useMemo(() => {
        if (!selectedUserRole) return [];

        return rolePermissions
            .filter((row) => row.role_id === selectedUserRole.id)
            .map((row) => row.permission_id);
    }, [selectedUserRole, rolePermissions]);

    const inheritedUserCompanyIds = useMemo(() => {
        const set = new Set();

        const accessScope = getUserAccessScope(selectedUser);

        if (accessScope === "ALL_COMPANIES") {
            companies.forEach((company) => {
                if (company.id) {
                    set.add(company.id);
                }
            });

            return Array.from(set);
        }

        if (selectedUser?.company_id) {
            set.add(selectedUser.company_id);
        }

        if (selectedUserRole) {
            roleCompanyAccess
                .filter((row) => row.role_id === selectedUserRole.id)
                .forEach((row) => {
                    if (row.company_id) {
                        set.add(row.company_id);
                    }
                });
        }

        return Array.from(set);
    }, [selectedUser, selectedUserRole, roleCompanyAccess, companies]);

    const pageStats = useMemo(() => {
        return {
            permissions: permissions.filter((x) => !x.virtual).length,
            virtualPermissions: permissions.filter((x) => x.virtual).length,
            roles: roles.length,
            users: users.length,
            companies: companies.length,
        };
    }, [permissions, roles, users, companies]);

    const selectedRolePermissionSummary = useMemo(() => {
        const selectedSet = new Set(rolePermissionIds);

        const keys = permissions
            .filter((permission) => selectedSet.has(permission.id))
            .map((permission) => permission.key);

        return {
            view: keys.filter((key) => key.endsWith(".view")).length,
            export: keys.filter((key) => key.endsWith(".export")).length,
            write: keys.filter(
                (key) =>
                    key.endsWith(".create") ||
                    key.endsWith(".edit") ||
                    key.endsWith(".delete") ||
                    key.endsWith(".transfer") ||
                    key.includes(".manage")
            ).length,
        };
    }, [permissions, rolePermissionIds]);

    function getUserRoleText(user) {
        return user?.user_role || user?.role || "-";
    }

    function getUserCompanyText(user) {
        if (!user?.company_id) return "Şirkət seçilməyib";
        return companyMap.get(user.company_id) || user.company_name || "Naməlum şirkət";
    }

    function getDefaultCompanyText(user) {
        if (getUserAccessScope(user) === "ALL_COMPANIES") {
            return "Bütün şirkətlər";
        }

        return getUserCompanyText(user);
    }

    function ensureEditable() {
        if (canEdit) return true;

        alert("Bu əməliyyat üçün permissions.edit icazəsi lazımdır.");
        return false;
    }

    const toggleArrayValue = useCallback(
        (setter, value) => {
            if (!ensureEditable()) return;

            if (isVirtualPermissionId(value)) {
                alert(
                    "Bu permission hələ bazada yoxdur. Əvvəlcə /api/admin/permissions seed hissəsinə əlavə edilməlidir."
                );
                return;
            }

            setter((prev) => {
                if (prev.includes(value)) {
                    return prev.filter((x) => x !== value);
                }

                return [...prev, value];
            });
        },
        [canEdit]
    );

    const setUserPermissionEffect = useCallback(
        (permissionId, effect) => {
            if (!ensureEditable()) return;

            if (isVirtualPermissionId(permissionId)) {
                alert(
                    "Bu permission hələ bazada yoxdur. Əvvəlcə /api/admin/permissions seed hissəsinə əlavə edilməlidir."
                );
                return;
            }

            setUserAllowPermissionIds((prev) =>
                prev.filter((id) => id !== permissionId)
            );
            setUserDenyPermissionIds((prev) =>
                prev.filter((id) => id !== permissionId)
            );

            if (effect === "ALLOW") {
                setUserAllowPermissionIds((prev) => [...prev, permissionId]);
            }

            if (effect === "DENY") {
                setUserDenyPermissionIds((prev) => [...prev, permissionId]);
            }
        },
        [canEdit]
    );

    const setUserCompanyEffect = useCallback(
        (companyId, effect) => {
            if (!ensureEditable()) return;

            setUserAllowCompanyIds((prev) => prev.filter((id) => id !== companyId));
            setUserDenyCompanyIds((prev) => prev.filter((id) => id !== companyId));

            if (effect === "ALLOW") {
                setUserAllowCompanyIds((prev) => [...prev, companyId]);
            }

            if (effect === "DENY") {
                setUserDenyCompanyIds((prev) => [...prev, companyId]);
            }
        },
        [canEdit]
    );

    function applyIzleyiciDefaultPermissions() {
        if (!ensureEditable()) return;

        const ids = permissions
            .filter((permission) =>
                [
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
                ].includes(permission.key)
            )
            .filter((permission) => !permission.virtual)
            .map((permission) => permission.id);

        setRolePermissionIds(ids);
    }

    function selectViewExportOnly() {
        if (!ensureEditable()) return;

        const ids = permissions
            .filter((permission) => {
                if (permission.virtual) return false;

                const key = String(permission.key || "");

                return key.endsWith(".view") || key.endsWith(".export");
            })
            .map((permission) => permission.id);

        setRolePermissionIds(ids);
    }

    function removeWritePermissions() {
        if (!ensureEditable()) return;

        const writeKeys = permissions
            .filter((permission) => {
                const key = String(permission.key || "");

                return (
                    key.endsWith(".create") ||
                    key.endsWith(".edit") ||
                    key.endsWith(".delete") ||
                    key.endsWith(".transfer") ||
                    key.includes(".manage")
                );
            })
            .map((permission) => permission.id);

        setRolePermissionIds((prev) =>
            prev.filter((permissionId) => !writeKeys.includes(permissionId))
        );
    }

    async function saveRolePermissions() {
        if (!selectedRoleId) return;
        if (!ensureEditable()) return;

        setSaving(true);

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/admin/permissions", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    mode: "ROLE_PERMISSIONS",
                    role_id: selectedRoleId,
                    permission_ids: rolePermissionIds.filter(
                        (id) => !isVirtualPermissionId(id)
                    ),
                }),
            });

            const text = await res.text();
            const json = text ? JSON.parse(text) : {};

            if (!res.ok) throw new Error(json.error || "Rol yetkiləri saxlanılmadı.");

            await loadBaseData({ silent: true });
            alert("Rol yetkiləri yadda saxlanıldı.");
        } catch (err) {
            console.error("SAVE_ROLE_PERMISSIONS_ERROR:", err);
            alert(err?.message || "Rol yetkiləri saxlanılmadı.");
        } finally {
            setSaving(false);
        }
    }

    async function saveUserPermissions() {
        if (!selectedUserId) return;
        if (!ensureEditable()) return;

        setSaving(true);

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/admin/permissions", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    mode: "USER_PERMISSIONS",
                    user_id: selectedUserId,
                    allow_permission_ids: userAllowPermissionIds.filter(
                        (id) => !isVirtualPermissionId(id)
                    ),
                    deny_permission_ids: userDenyPermissionIds.filter(
                        (id) => !isVirtualPermissionId(id)
                    ),
                }),
            });

            const text = await res.text();
            const json = text ? JSON.parse(text) : {};

            if (!res.ok) {
                throw new Error(json.error || "İstifadəçi yetkiləri saxlanılmadı.");
            }

            await loadUsers();
            alert("İstifadəçi yetkiləri yadda saxlanıldı.");
        } catch (err) {
            console.error("SAVE_USER_PERMISSIONS_ERROR:", err);
            alert(err?.message || "İstifadəçi yetkiləri saxlanılmadı.");
        } finally {
            setSaving(false);
        }
    }

    async function saveRoleCompanies() {
        if (!selectedRoleId) return;
        if (!ensureEditable()) return;

        setSaving(true);

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/admin/permissions", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    mode: "ROLE_COMPANIES",
                    role_id: selectedRoleId,
                    company_ids: roleCompanyIds,
                }),
            });

            const text = await res.text();
            const json = text ? JSON.parse(text) : {};

            if (!res.ok) {
                throw new Error(json.error || "Rol şirkət yetkiləri saxlanılmadı.");
            }

            await loadBaseData({ silent: true });
            alert("Rol şirkət yetkiləri yadda saxlanıldı.");
        } catch (err) {
            console.error("SAVE_ROLE_COMPANIES_ERROR:", err);
            alert(err?.message || "Rol şirkət yetkiləri saxlanılmadı.");
        } finally {
            setSaving(false);
        }
    }

    async function saveUserCompanies() {
        if (!selectedUserId) return;
        if (!ensureEditable()) return;

        setSaving(true);

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/admin/permissions", {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    mode: "USER_COMPANIES",
                    user_id: selectedUserId,
                    allow_company_ids: userAllowCompanyIds,
                    deny_company_ids: userDenyCompanyIds,
                }),
            });

            const text = await res.text();
            const json = text ? JSON.parse(text) : {};

            if (!res.ok) {
                throw new Error(
                    json.error || "İstifadəçi şirkət yetkiləri saxlanılmadı."
                );
            }

            await loadUsers();
            alert("İstifadəçi şirkət yetkiləri yadda saxlanıldı.");
        } catch (err) {
            console.error("SAVE_USER_COMPANIES_ERROR:", err);
            alert(err?.message || "İstifadəçi şirkət yetkiləri saxlanılmadı.");
        } finally {
            setSaving(false);
        }
    }

    const getEffectivePermissionStatus = useCallback(
        (permissionId) => {
            if (userDenyPermissionIds.includes(permissionId)) return "DENY";
            if (userAllowPermissionIds.includes(permissionId)) return "ALLOW";
            if (inheritedUserPermissionIds.includes(permissionId)) return "INHERITED";
            return "NONE";
        },
        [
            userDenyPermissionIds,
            userAllowPermissionIds,
            inheritedUserPermissionIds,
        ]
    );

    const getEffectiveCompanyStatus = useCallback(
        (companyId) => {
            if (userDenyCompanyIds.includes(companyId)) return "DENY";
            if (userAllowCompanyIds.includes(companyId)) return "ALLOW";
            if (inheritedUserCompanyIds.includes(companyId)) return "INHERITED";
            return "NONE";
        },
        [userDenyCompanyIds, userAllowCompanyIds, inheritedUserCompanyIds]
    );

    if (!pageReady) {
        return null;
    }

    if (permissionError && !roles.length && !permissions.length) {
        return (
            <section className="permissions-page">
                <div className="permissions-empty">
                    <strong>Permission xətası</strong>
                    <p>{permissionError}</p>
                    <button type="button" onClick={() => bootPage({ silent: false })}>
                        Yenidən yoxla
                    </button>
                </div>
            </section>
        );
    }

    if (!booting && myPermissionKeys.length > 0 && !canView) {
        return (
            <section className="permissions-page">
                <div className="permissions-empty">
                    <strong>Giriş icazəsi yoxdur</strong>
                    <p>
                        Bu səhifəyə baxmaq üçün <b>permissions.view</b> icazəsi lazımdır.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="permissions-page">
            <div className="permissions-hero">
                <div>
                    <h1>Yetkiləndirmə</h1>
                    <p>
                        Rollar və istifadəçilər üçün səhifə görünüşü, export və dəyişiklik
                        icazələrini idarə et.
                    </p>

                    {!booting && !canEdit && canView && (
                        <p className="permissions-readonly-note">
                            Bu hesabda yalnız baxış icazəsi var. Dəyişiklik etmək üçün{" "}
                            <b>permissions.edit</b> icazəsi lazımdır.
                        </p>
                    )}

                    {(booting || baseLoading) && (
                        <p className="permissions-readonly-note">
                            Məlumat yenilənir, səhifədən istifadə edə bilərsiniz...
                        </p>
                    )}
                </div>

                <div className="permissions-hero-actions">
                    <div className="permissions-hero-stat">
                        <strong>{pageStats.permissions || "..."}</strong>
                        <small>İcazə</small>
                    </div>

                    <div className="permissions-hero-stat">
                        <strong>{pageStats.roles || "..."}</strong>
                        <small>Rol</small>
                    </div>

                    <button
                        type="button"
                        onClick={refreshAll}
                        disabled={baseLoading || saving || booting}
                    >
                        {baseLoading || booting ? "Yenilənir..." : "Yenilə"}
                    </button>
                </div>
            </div>

            {permissionError && (
                <div className="permissions-warning">
                    <strong>Xəbərdarlıq:</strong> {permissionError}
                </div>
            )}

            {pageStats.virtualPermissions > 0 && (
                <div className="permissions-warning">
                    <strong>Diqqət:</strong>{" "}
                    {pageStats.virtualPermissions} permission açarı UI-da göstərilir, amma
                    bazada yoxdur. Bu açarları `/api/admin/permissions` seed hissəsinə
                    əlavə etmək lazımdır.
                </div>
            )}

            <div className="permissions-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? "active" : ""}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <strong>{tab.title}</strong>
                        <span>{tab.desc}</span>
                    </button>
                ))}
            </div>

            {(activeTab === "ROLE_PERMISSIONS" ||
                activeTab === "ROLE_COMPANIES") && (
                    <div className="permissions-layout">
                        <aside className="permissions-side-card">
                            <div className="permissions-side-head">
                                <div>
                                    <h3>Rollar</h3>
                                </div>

                                <b>{roles.length || "..."}</b>
                            </div>

                            {roles.length === 0 ? (
                                <InlineLoading text="Rollar hazırlanır..." />
                            ) : (
                                <RoleList
                                    roles={roles}
                                    selectedRoleId={selectedRoleId}
                                    onSelect={setSelectedRoleId}
                                />
                            )}
                        </aside>

                        <main className="permissions-main-card">
                            {activeTab === "ROLE_PERMISSIONS" ? (
                                <>
                                    <div className="permissions-card-head">
                                        <div>
                                            <span>{activeTabData.desc}</span>
                                            <h2>{selectedRole ? roleLabel(selectedRole) : "Rol"}</h2>
                                        </div>

                                        {canEdit && (
                                            <button
                                                type="button"
                                                className="primary"
                                                onClick={saveRolePermissions}
                                                disabled={saving || !selectedRoleId}
                                            >
                                                {saving ? "Saxlanılır..." : "Yadda saxla"}
                                            </button>
                                        )}
                                    </div>

                                    {canEdit && (
                                        <div className="permissions-quick-actions">
                                            <button
                                                type="button"
                                                onClick={selectViewExportOnly}
                                                disabled={saving || permissions.length === 0}
                                            >
                                                View + Export seç
                                            </button>

                                            <button
                                                type="button"
                                                onClick={removeWritePermissions}
                                                disabled={saving || permissions.length === 0}
                                            >
                                                Create/Edit/Delete bağla
                                            </button>

                                            {selectedRoleNormalized === "IZLEYICI" && (
                                                <button
                                                    type="button"
                                                    className="highlight"
                                                    onClick={applyIzleyiciDefaultPermissions}
                                                    disabled={saving || permissions.length === 0}
                                                >
                                                    İzləyici default ver
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="permissions-role-summary">
                                        <div>
                                            <span>View</span>
                                            <strong>{selectedRolePermissionSummary.view}</strong>
                                        </div>

                                        <div>
                                            <span>Export</span>
                                            <strong>{selectedRolePermissionSummary.export}</strong>
                                        </div>

                                        <div>
                                            <span>Dəyişiklik icazələri</span>
                                            <strong>{selectedRolePermissionSummary.write}</strong>
                                        </div>
                                    </div>

                                    <div className="permissions-toolbar">
                                        <input
                                            className="permissions-search"
                                            placeholder="Permission adı, açarı və ya qrup üzrə axtar..."
                                            value={searchPermission}
                                            onChange={(e) => setSearchPermission(e.target.value)}
                                        />

                                        <div className="permissions-counter-pill">
                                            <strong>{rolePermissionIds.length}</strong>
                                            <span>aktiv icazə</span>
                                        </div>
                                    </div>

                                    {permissions.length === 0 ? (
                                        <InlineLoading text="Permission siyahısı hazırlanır..." />
                                    ) : (
                                        <PermissionSwitchList
                                            groups={permissionGroups}
                                            checkedIds={rolePermissionIds}
                                            disabled={!canEdit}
                                            onToggle={(permissionId) =>
                                                toggleArrayValue(setRolePermissionIds, permissionId)
                                            }
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="permissions-card-head">
                                        <div>
                                            <span>{activeTabData.desc}</span>
                                            <h2>{selectedRole ? roleLabel(selectedRole) : "Rol"}</h2>
                                        </div>

                                        {canEdit && (
                                            <button
                                                type="button"
                                                className="primary"
                                                onClick={saveRoleCompanies}
                                                disabled={saving || !selectedRoleId}
                                            >
                                                {saving ? "Saxlanılır..." : "Yadda saxla"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="permissions-toolbar">
                                        <input
                                            className="permissions-search"
                                            placeholder="Şirkət axtar..."
                                            value={searchCompany}
                                            onChange={(e) => setSearchCompany(e.target.value)}
                                        />

                                        <div className="permissions-counter-pill">
                                            <strong>{roleCompanyIds.length}</strong>
                                            <span>şirkət</span>
                                        </div>
                                    </div>

                                    {companies.length === 0 ? (
                                        <InlineLoading text="Şirkətlər hazırlanır..." />
                                    ) : (
                                        <CompanySwitchList
                                            companies={filteredCompanies}
                                            checkedIds={roleCompanyIds}
                                            disabled={!canEdit}
                                            onToggle={(companyId) =>
                                                toggleArrayValue(setRoleCompanyIds, companyId)
                                            }
                                        />
                                    )}
                                </>
                            )}
                        </main>
                    </div>
                )}

            {(activeTab === "USER_PERMISSIONS" ||
                activeTab === "USER_COMPANIES") && (
                    <div className="permissions-layout">
                        <aside className="permissions-side-card">
                            <div className="permissions-side-head">
                                <div>
                                    <h3>İstifadəçilər</h3>
                                </div>

                                <b>{usersLoading ? "..." : users.length}</b>
                            </div>

                            <input
                                className="permissions-search small"
                                placeholder="Ad, email, rol, access scope və ya şirkət üzrə axtar..."
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                            />

                            {usersLoading && (
                                <InlineLoading text="İstifadəçilər yüklənir..." compact />
                            )}

                            {!usersLoading && usersLoaded && users.length === 0 && (
                                <InlineLoading text="İstifadəçi tapılmadı." compact />
                            )}

                            <UserList
                                users={visibleUsers}
                                selectedUserId={selectedUserId}
                                onSelect={setSelectedUserId}
                                getUserRoleText={getUserRoleText}
                                getUserCompanyText={getUserCompanyText}
                            />

                            {filteredUsers.length > USER_PAGE_SIZE && (
                                <div className="permissions-pagination">
                                    <button
                                        type="button"
                                        disabled={userPage <= 1}
                                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                                    >
                                        Əvvəlki
                                    </button>

                                    <span>
                                        {Math.min(userPage, userTotalPages)} / {userTotalPages}
                                    </span>

                                    <button
                                        type="button"
                                        disabled={userPage >= userTotalPages}
                                        onClick={() =>
                                            setUserPage((p) => Math.min(userTotalPages, p + 1))
                                        }
                                    >
                                        Növbəti
                                    </button>
                                </div>
                            )}
                        </aside>

                        <main className="permissions-main-card">
                            {activeTab === "USER_PERMISSIONS" ? (
                                <>
                                    <div className="permissions-card-head">
                                        <div>
                                            <span>{activeTabData.desc}</span>
                                            <h2>{selectedUser ? userLabel(selectedUser) : "User"}</h2>
                                        </div>

                                        {canEdit && (
                                            <button
                                                type="button"
                                                className="primary"
                                                onClick={saveUserPermissions}
                                                disabled={saving || usersLoading || !selectedUserId}
                                            >
                                                {saving ? "Saxlanılır..." : "Yadda saxla"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="permissions-help">
                                        <div>
                                            <b>Default</b>
                                            <span>İstifadəçi rolundan gələn qaydaya tabe olur.</span>
                                        </div>

                                        <div>
                                            <b>Allow</b>
                                            <span>Rolda olmasa belə bu istifadəçiyə icazə verir.</span>
                                        </div>

                                        <div>
                                            <b>Deny</b>
                                            <span>Rolda olsa belə bu istifadəçidə bloklayır.</span>
                                        </div>
                                    </div>

                                    <div className="permissions-toolbar">
                                        <input
                                            className="permissions-search"
                                            placeholder="Permission axtar..."
                                            value={searchPermission}
                                            onChange={(e) => setSearchPermission(e.target.value)}
                                        />

                                        <div className="permissions-counter-pill">
                                            <strong>
                                                {userAllowPermissionIds.length +
                                                    userDenyPermissionIds.length}
                                            </strong>
                                            <span>override</span>
                                        </div>
                                    </div>

                                    {permissions.length === 0 ? (
                                        <InlineLoading text="Permission siyahısı hazırlanır..." />
                                    ) : (
                                        <UserPermissionOverrideList
                                            groups={permissionGroups}
                                            disabled={!canEdit || usersLoading || !selectedUserId}
                                            getStatus={getEffectivePermissionStatus}
                                            onSetEffect={setUserPermissionEffect}
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="permissions-card-head">
                                        <div>
                                            <span>{activeTabData.desc}</span>
                                            <h2>{selectedUser ? userLabel(selectedUser) : "User"}</h2>
                                        </div>

                                        {canEdit && (
                                            <button
                                                type="button"
                                                className="primary"
                                                onClick={saveUserCompanies}
                                                disabled={saving || usersLoading || !selectedUserId}
                                            >
                                                {saving ? "Saxlanılır..." : "Yadda saxla"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="permissions-help">
                                        <div>
                                            <b>Default</b>
                                            <span>
                                                Access scope Bütün şirkətlərdirsə hamısı, yoxdursa öz
                                                şirkəti və rol şirkətləri avtomatik aktiv görünür.
                                            </span>
                                        </div>

                                        <div>
                                            <b>Allow</b>
                                            <span>Bu şirkəti əlavə olaraq görə bilsin.</span>
                                        </div>

                                        <div>
                                            <b>Deny</b>
                                            <span>Default gəlsə belə bu şirkəti görməsin.</span>
                                        </div>
                                    </div>

                                    <div className="permissions-user-company-info">
                                        <div>
                                            <span>Access scope</span>
                                            <strong>
                                                {selectedUser
                                                    ? getUserAccessScopeText(selectedUser)
                                                    : "-"}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Default şirkət</span>
                                            <strong>
                                                {selectedUser ? getDefaultCompanyText(selectedUser) : "-"}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="permissions-toolbar">
                                        <input
                                            className="permissions-search"
                                            placeholder="Şirkət axtar..."
                                            value={searchCompany}
                                            onChange={(e) => setSearchCompany(e.target.value)}
                                        />

                                        <div className="permissions-counter-pill">
                                            <strong>
                                                {userAllowCompanyIds.length +
                                                    userDenyCompanyIds.length}
                                            </strong>
                                            <span>override</span>
                                        </div>
                                    </div>

                                    {companies.length === 0 ? (
                                        <InlineLoading text="Şirkətlər hazırlanır..." />
                                    ) : (
                                        <UserCompanyOverrideList
                                            companies={filteredCompanies}
                                            disabled={!canEdit || usersLoading || !selectedUserId}
                                            getStatus={getEffectiveCompanyStatus}
                                            onSetEffect={setUserCompanyEffect}
                                            selectedUser={selectedUser}
                                        />
                                    )}
                                </>
                            )}
                        </main>
                    </div>
                )}
        </section>
    );
}

const InlineLoading = memo(function InlineLoading({ text, compact }) {
    return (
        <div className={compact ? "permissions-mini-loading" : "permissions-empty"}>
            <span className="permissions-loader" />
            <strong>{text}</strong>
        </div>
    );
});

const RoleList = memo(function RoleList({ roles, selectedRoleId, onSelect }) {
    return (
        <div className="permissions-list">
            {roles.map((role) => {
                const normalized = normalizeRole(role.name || role.label);

                return (
                    <button
                        key={role.id}
                        type="button"
                        className={selectedRoleId === role.id ? "active" : ""}
                        onClick={() => onSelect(role.id)}
                    >
                        <div>
                            <strong>{roleLabel(role)}</strong>
                            <span>{role.name}</span>
                        </div>

                        <em>
                            {selectedRoleId === role.id
                                ? normalized === "IZLEYICI"
                                    ? "İzləyici"
                                    : "Aktiv"
                                : "Seç"}
                        </em>
                    </button>
                );
            })}
        </div>
    );
});

const UserList = memo(function UserList({
    users,
    selectedUserId,
    onSelect,
    getUserRoleText,
    getUserCompanyText,
}) {
    return (
        <div className="permissions-list">
            {users.map((user) => (
                <button
                    key={user.id}
                    type="button"
                    className={selectedUserId === user.id ? "active" : ""}
                    onClick={() => onSelect(user.id)}
                >
                    <div>
                        <strong>{userLabel(user)}</strong>
                        <span>
                            {(user.email || "-") +
                                " · " +
                                getUserRoleText(user) +
                                " · " +
                                getUserAccessScopeText(user) +
                                " · " +
                                getUserCompanyText(user)}
                        </span>
                    </div>

                    <em>{selectedUserId === user.id ? "Aktiv" : "Seç"}</em>
                </button>
            ))}
        </div>
    );
});

const PermissionSwitchList = memo(function PermissionSwitchList({
    groups,
    checkedIds,
    onToggle,
    disabled,
}) {
    const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

    return (
        <div className="permissions-groups">
            {groups.map((group) => (
                <div className="permissions-group" key={group.group}>
                    <div className="permissions-group-title">
                        <h3>{group.group}</h3>
                        <span>{group.items.length} icazə</span>
                    </div>

                    <div className="permissions-switch-list">
                        {group.items.map((permission) => {
                            const checked = checkedSet.has(permission.id);

                            return (
                                <button
                                    key={permission.id}
                                    type="button"
                                    disabled={disabled}
                                    className={`permission-switch-row ${checked ? "is-on" : ""
                                        } ${permission.virtual ? "is-virtual" : ""} ${disabled ? "is-disabled" : ""
                                        }`}
                                    onClick={() => onToggle(permission.id)}
                                >
                                    <div className="permission-switch-info">
                                        <strong>{permission.label}</strong>

                                        <small>
                                            {permission.key}
                                            {permission.virtual ? " · bazada yoxdur" : ""}
                                        </small>

                                        {permission.description && <p>{permission.description}</p>}
                                    </div>

                                    <div className="permission-switch-meta">
                                        <PermissionActionPill type={permission.action_type} />
                                        <IosSwitch checked={checked} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
});

const CompanySwitchList = memo(function CompanySwitchList({
    companies,
    checkedIds,
    onToggle,
    disabled,
}) {
    const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

    return (
        <div className="permissions-switch-list">
            {companies.map((company) => {
                const checked = checkedSet.has(company.id);

                return (
                    <button
                        key={company.id}
                        type="button"
                        disabled={disabled}
                        className={`permission-switch-row ${checked ? "is-on" : ""} ${disabled ? "is-disabled" : ""
                            }`}
                        onClick={() => onToggle(company.id)}
                    >
                        <div className="permission-switch-info">
                            <strong>{company.name}</strong>
                            <small>{company.status || "status yoxdur"}</small>
                            <p>
                                Bu rol üçün şirkət görünüşünü{" "}
                                {checked ? "aktiv edir." : "deaktiv saxlayır."}
                            </p>
                        </div>

                        <IosSwitch checked={checked} />
                    </button>
                );
            })}
        </div>
    );
});

const UserPermissionOverrideList = memo(function UserPermissionOverrideList({
    groups,
    getStatus,
    onSetEffect,
    disabled,
}) {
    return (
        <div className="permissions-groups">
            {groups.map((group) => (
                <div className="permissions-group" key={group.group}>
                    <div className="permissions-group-title">
                        <h3>{group.group}</h3>
                        <span>{group.items.length} icazə</span>
                    </div>

                    <div className="permission-override-list">
                        {group.items.map((permission) => {
                            const status = getStatus(permission.id);

                            return (
                                <div
                                    className={`permission-override-row status-${status.toLowerCase()} ${permission.virtual ? "is-virtual" : ""
                                        } ${disabled ? "is-disabled" : ""}`}
                                    key={permission.id}
                                >
                                    <div className="permission-switch-info">
                                        <strong>{permission.label}</strong>

                                        <small>
                                            {permission.key}
                                            {permission.virtual ? " · bazada yoxdur" : ""}
                                        </small>

                                        {permission.description && <p>{permission.description}</p>}
                                    </div>

                                    <div className="permission-override-actions">
                                        <PermissionActionPill type={permission.action_type} />

                                        <OverrideControl
                                            status={status}
                                            disabled={disabled}
                                            onChange={(effect) => onSetEffect(permission.id, effect)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
});

const UserCompanyOverrideList = memo(function UserCompanyOverrideList({
    companies,
    getStatus,
    onSetEffect,
    selectedUser,
    disabled,
}) {
    const accessScope = String(selectedUser?.access_scope || "OWN_COMPANY")
        .trim()
        .toUpperCase();

    const isAllCompanies = accessScope === "ALL_COMPANIES";

    return (
        <div className="permission-override-list">
            {companies.map((company) => {
                const status = getStatus(company.id);

                return (
                    <div
                        className={`permission-override-row status-${status.toLowerCase()} ${disabled ? "is-disabled" : ""
                            }`}
                        key={company.id}
                    >
                        <div className="permission-switch-info">
                            <strong>{company.name}</strong>
                            <small>{company.status || "status yoxdur"}</small>

                            <p>
                                {status === "INHERITED" && isAllCompanies
                                    ? "Bu şirkət access scope Bütün şirkətlər olduğu üçün avtomatik gəlir."
                                    : status === "INHERITED"
                                        ? "Bu şirkət istifadəçinin öz şirkəti və ya rolundan avtomatik gəlir."
                                        : status === "ALLOW"
                                            ? "Bu şirkət istifadəçiyə əlavə olaraq açılıb."
                                            : status === "DENY"
                                                ? "Bu şirkət istifadəçidə xüsusi olaraq bloklanıb."
                                                : "Bu şirkət üçün xüsusi access yoxdur."}
                            </p>
                        </div>

                        <OverrideControl
                            status={status}
                            disabled={disabled}
                            onChange={(effect) => onSetEffect(company.id, effect)}
                        />
                    </div>
                );
            })}
        </div>
    );
});

const PermissionActionPill = memo(function PermissionActionPill({ type }) {
    const labels = {
        view: "View",
        export: "Export",
        import: "Import",
        create: "Create",
        edit: "Edit",
        delete: "Delete",
        transfer: "Transfer",
        manage: "Manage",
        other: "Other",
    };

    return (
        <span className={`permission-action-pill action-${type || "other"}`}>
            {labels[type] || "Other"}
        </span>
    );
});

const IosSwitch = memo(function IosSwitch({ checked }) {
    return (
        <span className={`ios-switch ${checked ? "on" : ""}`} aria-hidden="true">
            <span />
        </span>
    );
});

const OverrideControl = memo(function OverrideControl({ status, onChange, disabled }) {
    const effective = status === "INHERITED" ? "DEFAULT" : status;

    return (
        <div className={`override-control ${disabled ? "is-disabled" : ""}`}>
            <button
                type="button"
                disabled={disabled}
                className={effective === "DEFAULT" ? "active default" : ""}
                onClick={() => onChange("NONE")}
            >
                Default
            </button>

            <button
                type="button"
                disabled={disabled}
                className={effective === "ALLOW" ? "active allow" : ""}
                onClick={() => onChange("ALLOW")}
            >
                Allow
            </button>

            <button
                type="button"
                disabled={disabled}
                className={effective === "DENY" ? "active deny" : ""}
                onClick={() => onChange("DENY")}
            >
                Deny
            </button>

            <span
                className={`override-status-dot status-${String(status).toLowerCase()}`}
                title={status}
            />
        </div>
    );
});
