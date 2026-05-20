/** Gateway route authorization — Django-style permissions and staff flags. */

export interface RoutePolicy {
  prefix: string;
  methods?: string[];
  public?: boolean;
  authenticated?: boolean;
  /** Require is_staff / staff-capable group / superuser */
  requireStaff?: boolean;
  /** Require Django admin access (superuser or staff+admin perms) */
  requireAdmin?: boolean;
  /** At least one permission codename (app_label.action_model) */
  permissions?: string[];
}

export const routePolicies: RoutePolicy[] = [
  { prefix: "/health", public: true },
  { prefix: "/api/v1/authentication/oauth/token", public: true },
  { prefix: "/api/v1/authentication/.well-known", public: true },
  { prefix: "/api/v1/authentication/health", public: true },
  { prefix: "/api/v1/authentication/ready", public: true },
  { prefix: "/api/v1/authentication/v1/admin", requireAdmin: true },
  { prefix: "/api/v1/authentication/v1", authenticated: true },
  { prefix: "/api/v1/accounts/v1/admin", requireAdmin: true },
  { prefix: "/api/v1/notifications/v1/admin", requireAdmin: true },
  {
    prefix: "/api/v1/accounts/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: [
      "accounts.change_ledger",
      "finance.change_ledger",
      "finance.change_operations",
    ],
  },
  {
    prefix: "/api/v1/accounts/v1",
    permissions: [
      "accounts.view_ledger",
      "finance.view_ledger",
      "finance.view_operations",
    ],
  },
  {
    prefix: "/api/v1/notifications/v1/dispatch",
    methods: ["POST"],
    permissions: ["platform.add_servicecall"],
  },
  {
    prefix: "/api/v1/notifications/v1/templates",
    requireStaff: true,
    permissions: ["auth.change_group"],
  },
  { prefix: "/api/v1/notifications/health", public: true },
  { prefix: "/api/v1/notifications/ready", public: true },
  {
    prefix: "/api/v1/notifications/v1/realtime",
    authenticated: true,
  },
  { prefix: "/api/v1/reports/health", public: true },
  { prefix: "/api/v1/reports/ready", public: true },
  { prefix: "/api/v1/accounts/health", public: true },
  { prefix: "/api/v1/accounts/ready", public: true },
  { prefix: "/api/v1/finance/v1/admin", requireAdmin: true },
  {
    prefix: "/api/v1/finance/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: ["finance.change_ledger", "finance.change_operations"],
  },
  {
    prefix: "/api/v1/finance/v1",
    permissions: ["finance.view_ledger", "finance.view_operations"],
  },
  { prefix: "/api/v1/finance/health", public: true },
  { prefix: "/api/v1/finance/ready", public: true },
  {
    prefix: "/api/v1/reports",
    permissions: ["reports.view_report"],
  },
  { prefix: "/api/v1/supply-chain/health", public: true },
  { prefix: "/api/v1/supply-chain/ready", public: true },
  { prefix: "/api/v1/supply-chain/openapi.yaml", public: true },
  { prefix: "/api/v1/supply-chain/public", public: true },
  { prefix: "/api/v1/supply-chain/api/v1/admin", requireAdmin: true },
  { prefix: "/api/v1/supply-chain/api/v1", authenticated: true },
  { prefix: "/api/v1/fleet/health", public: true },
  { prefix: "/api/v1/fleet/ready", public: true },
  { prefix: "/api/v1/fleet/healthz", public: true },
  {
    prefix: "/api/v1/fleet/api/iot/pings",
    methods: ["POST"],
    public: true,
  },
  { prefix: "/api/v1/fleet/api", authenticated: true },
  { prefix: "/api/v1/project-management/health", public: true },
  { prefix: "/api/v1/project-management/ready", public: true },
  { prefix: "/api/v1/project-management/healthz", public: true },
  { prefix: "/api/v1/project-management/api/v1", authenticated: true },
];

export function matchPolicy(path: string, method: string): RoutePolicy | undefined {
  const sorted = [...routePolicies].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  return sorted.find((p) => {
    if (path !== p.prefix && !path.startsWith(p.prefix + "/")) {
      return false;
    }
    if (!p.methods?.length) {
      return true;
    }
    return p.methods.includes(method.toUpperCase());
  });
}
