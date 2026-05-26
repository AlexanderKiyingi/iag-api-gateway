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
  { prefix: "/api/v1/procurement/health", public: true },
  { prefix: "/api/v1/procurement/ready", public: true },
  { prefix: "/api/v1/procurement/healthz", public: true },
  { prefix: "/api/v1/procurement/api/v1", authenticated: true },
  { prefix: "/api/v1/contract-management/health", public: true },
  { prefix: "/api/v1/contract-management/ready", public: true },
  { prefix: "/api/v1/contract-management/v1/health", public: true },
  {
    prefix: "/api/v1/contract-management/v1/bootstrap",
    methods: ["GET"],
    authenticated: true,
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["DELETE"],
    permissions: ["contracts.delete"],
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["POST", "PUT", "PATCH"],
    permissions: ["contracts.create", "contracts.update"],
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["GET"],
    permissions: ["contracts.read"],
  },
  {
    prefix: "/api/v1/contract-management/v1/exports",
    methods: ["GET"],
    permissions: ["reports.read", "reports.create", "contracts.read"],
  },
  {
    prefix: "/api/v1/contract-management/v1/audit",
    methods: ["GET"],
    permissions: ["audit.read"],
  },
  {
    prefix: "/api/v1/contract-management/v1/audit",
    methods: ["POST"],
    permissions: ["audit.create"],
  },
  // Catch-all for the remaining workspace endpoints: authenticated callers
  // hit the service; per-endpoint permission enforcement happens inside the
  // service via the registered permission catalogue.
  {
    prefix: "/api/v1/contract-management/v1",
    authenticated: true,
  },
  { prefix: "/api/v1/crm/health", public: true },
  { prefix: "/api/v1/crm/ready", public: true },
  { prefix: "/api/v1/crm/healthz", public: true },
  {
    prefix: "/api/v1/crm/v1/bootstrap",
    methods: ["GET"],
    authenticated: true,
  },
  {
    prefix: "/api/v1/crm/v1/audit",
    methods: ["GET"],
    permissions: ["audit.read"],
  },
  {
    prefix: "/api/v1/crm/v1/audit",
    methods: ["POST"],
    permissions: ["audit.create"],
  },
  {
    prefix: "/api/v1/crm/v1/admin",
    requireStaff: true,
  },
  {
    prefix: "/api/v1/crm/v1/accounts",
    methods: ["DELETE"],
    permissions: ["accounts.delete"],
  },
  {
    prefix: "/api/v1/crm/v1/accounts",
    methods: ["POST", "PATCH"],
    permissions: ["accounts.create", "accounts.update"],
  },
  {
    prefix: "/api/v1/crm/v1/deals",
    methods: ["POST", "PATCH"],
    permissions: ["deals.create", "deals.update"],
  },
  {
    prefix: "/api/v1/crm/v1/platform/status",
    requireStaff: true,
  },
  {
    prefix: "/api/v1/crm/v1",
    authenticated: true,
  },
  { prefix: "/api/v1/dms/health", public: true },
  { prefix: "/api/v1/dms/ready", public: true },
  { prefix: "/api/v1/dms/healthz", public: true },
  { prefix: "/api/v1/dms/assets", public: true },
  { prefix: "/api/v1/dms/index.html", public: true },
  {
    prefix: "/api/v1/dms/v1/outlets",
    methods: ["POST", "PATCH"],
    permissions: ["dms.manage_outlets"],
  },
  {
    prefix: "/api/v1/dms/v1/orders",
    methods: ["POST", "PATCH"],
    permissions: ["dms.manage_orders"],
  },
  {
    prefix: "/api/v1/dms/v1/invoices",
    methods: ["POST"],
    permissions: ["dms.manage_invoices"],
  },
  {
    prefix: "/api/v1/dms/v1/claims",
    methods: ["POST"],
    permissions: ["dms.manage_claims"],
  },
  {
    prefix: "/api/v1/dms/v1/promotions",
    methods: ["POST"],
    permissions: ["dms.manage_promotions"],
  },
  {
    prefix: "/api/v1/dms/v1/dispatch",
    methods: ["POST"],
    permissions: ["dms.manage_dispatch"],
  },
  {
    prefix: "/api/v1/dms/v1/reports",
    methods: ["POST"],
    permissions: ["dms.run_reports"],
  },
  {
    prefix: "/api/v1/dms/v1/exports",
    methods: ["POST"],
    permissions: ["dms.run_reports"],
  },
  {
    prefix: "/api/v1/dms/v1/field/check-ins",
    methods: ["PATCH"],
    permissions: ["dms.field_checkin"],
  },
  {
    prefix: "/api/v1/dms/v1/field",
    methods: ["POST"],
    permissions: ["dms.field_checkin"],
  },
  {
    prefix: "/api/v1/dms/v1/audit",
    methods: ["POST"],
    permissions: ["dms.audit.create"],
  },
  {
    prefix: "/api/v1/dms/v1/audit",
    permissions: ["dms.audit.read"],
  },
  {
    prefix: "/api/v1/dms/v1/insights",
    permissions: ["dms.insights.read"],
  },
  {
    prefix: "/api/v1/dms/v1/admin",
    requireStaff: true,
  },
  {
    prefix: "/api/v1/dms/v1/platform/status",
    requireStaff: true,
  },
  {
    prefix: "/api/v1/dms/v1",
    authenticated: true,
  },
  { prefix: "/api/v1/dms", public: true },
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
