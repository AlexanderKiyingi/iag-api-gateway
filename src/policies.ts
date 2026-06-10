/** Gateway route authorization — Django-style permissions and staff flags. */

import {
  fleetMutatePermissions,
  fleetViewPermissions,
  mesAdminWritePermissions,
  mesMutatePermissions,
  mesViewPermissions,
  productionAdminWritePermissions,
  productionMutatePermissions,
  productionViewPermissions,
  erpAdminReadPermissions,
  erpMutatePermissions,
  erpViewPermissions,
  PLATFORM_ACCESS,
  procurementMutatePermissions,
  procurementViewPermissions,
  scmMutatePermissions,
  scmViewPermissions,
} from "./service-permissions.js";

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
  /** Every codename required (e.g. platform.access_* service gate) */
  requireAllPermissions?: string[];
  /** Allow platform `admin` group read access without explicit fleet.view_* on the JWT */
  fleetPlatformAdminRead?: boolean;
}

export const routePolicies: RoutePolicy[] = [
  { prefix: "/health", public: true },
  { prefix: "/api/v1/authentication/oauth/token", public: true },
  { prefix: "/api/v1/authentication/oauth/external", public: true },
  { prefix: "/api/v1/authentication/.well-known", public: true },
  { prefix: "/api/v1/authentication/health", public: true },
  { prefix: "/api/v1/authentication/ready", public: true },
  { prefix: "/api/v1/authentication/v1/auth/forgot-password", public: true },
  { prefix: "/api/v1/authentication/v1/auth/reset-password", public: true },
  { prefix: "/api/v1/authentication/v1/admin", requireAdmin: true },
  { prefix: "/api/v1/authentication/v1", authenticated: true },
  { prefix: "/api/v1/accounts/v1/admin", requireAdmin: true },
  { prefix: "/api/v1/notifications/v1/admin", requireAdmin: true },
  /** @deprecated Legacy prefix — mirrors /api/v1/finance RBAC until clients migrate */
  {
    prefix: "/api/v1/accounts/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: ["finance.change_ledger", "finance.change_operations"],
    requireAllPermissions: [PLATFORM_ACCESS.finance],
  },
  {
    prefix: "/api/v1/accounts/v1",
    permissions: ["finance.view_ledger", "finance.view_operations"],
    requireAllPermissions: [PLATFORM_ACCESS.finance],
  },
  {
    prefix: "/api/v1/notifications/v1/dispatch",
    methods: ["POST"],
    permissions: ["notifications.dispatch", "platform.add_servicecall"],
    requireAllPermissions: [PLATFORM_ACCESS.notifications],
  },
  {
    prefix: "/api/v1/notifications/v1/templates",
    requireStaff: true,
    permissions: ["notifications.manage_templates", "auth.change_group"],
    requireAllPermissions: [PLATFORM_ACCESS.notifications],
  },
  { prefix: "/api/v1/notifications/health", public: true },
  { prefix: "/api/v1/notifications/ready", public: true },
  {
    prefix: "/api/v1/notifications/v1/realtime",
    requireAllPermissions: [PLATFORM_ACCESS.notifications],
  },
  { prefix: "/api/v1/reports/health", public: true },
  { prefix: "/api/v1/reports/ready", public: true },
  { prefix: "/api/v1/accounts/health", public: true },
  { prefix: "/api/v1/accounts/ready", public: true },
  {
    prefix: "/api/v1/finance/v1/portal",
    authenticated: true,
  },
  { prefix: "/api/v1/finance/v1/admin", requireAdmin: true },
  {
    prefix: "/api/v1/finance/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: ["finance.change_ledger", "finance.change_operations"],
    requireAllPermissions: [PLATFORM_ACCESS.finance],
  },
  {
    prefix: "/api/v1/finance/v1",
    permissions: ["finance.view_ledger", "finance.view_operations"],
    requireAllPermissions: [PLATFORM_ACCESS.finance],
  },
  { prefix: "/api/v1/finance/health", public: true },
  { prefix: "/api/v1/finance/ready", public: true },
  {
    prefix: "/api/v1/reports",
    permissions: ["reports.view_report"],
    requireAllPermissions: [PLATFORM_ACCESS.reports],
  },
  { prefix: "/api/v1/supply-chain/health", public: true },
  { prefix: "/api/v1/supply-chain/ready", public: true },
  { prefix: "/api/v1/supply-chain/openapi.yaml", public: true },
  { prefix: "/api/v1/supply-chain/public", public: true },
  {
    prefix: "/api/v1/supply-chain/api/v1/portal",
    authenticated: true,
  },
  { prefix: "/api/v1/supply-chain/api/v1/admin", requireAdmin: true },
  {
    prefix: "/api/v1/supply-chain/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: scmMutatePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.supplyChain],
  },
  {
    prefix: "/api/v1/supply-chain/api/v1",
    permissions: scmViewPermissions,
    requireAllPermissions: [PLATFORM_ACCESS.supplyChain],
  },
  { prefix: "/api/v1/fleet/health", public: true },
  { prefix: "/api/v1/fleet/ready", public: true },
  { prefix: "/api/v1/fleet/healthz", public: true },
  {
    prefix: "/api/v1/fleet/api/iot/pings",
    methods: ["POST"],
    public: true,
  },
  {
    prefix: "/api/v1/fleet/api",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: fleetMutatePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.fleet],
  },
  {
    prefix: "/api/v1/fleet/api/admin/audit-logs",
    permissions: ["fleet.view_audit_entry"],
    requireAllPermissions: [PLATFORM_ACCESS.fleet],
  },
  {
    prefix: "/api/v1/fleet/api",
    permissions: fleetViewPermissions,
    fleetPlatformAdminRead: true,
    requireAllPermissions: [PLATFORM_ACCESS.fleet],
  },
  { prefix: "/api/v1/project-management/health", public: true },
  { prefix: "/api/v1/project-management/ready", public: true },
  { prefix: "/api/v1/project-management/healthz", public: true },
  {
    prefix: "/api/v1/project-management/api/v1/workspace/members",
    methods: ["POST", "PATCH", "DELETE"],
    permissions: ["pm.admin"],
    requireAllPermissions: [PLATFORM_ACCESS.projectManagement],
  },
  {
    prefix: "/api/v1/project-management/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: ["pm.mutate_workspace"],
    requireAllPermissions: [PLATFORM_ACCESS.projectManagement],
  },
  {
    prefix: "/api/v1/project-management/api/v1",
    permissions: ["pm.view_workspace", "pm.mutate_workspace"],
    requireAllPermissions: [PLATFORM_ACCESS.projectManagement],
  },
  { prefix: "/api/v1/procurement/health", public: true },
  { prefix: "/api/v1/procurement/ready", public: true },
  { prefix: "/api/v1/procurement/healthz", public: true },
  {
    prefix: "/api/v1/procurement/api/v1/portal",
    authenticated: true,
  },
  {
    prefix: "/api/v1/procurement/api/v1/notifications/emit",
    methods: ["POST"],
    permissions: ["procurement.emit_notification"],
    requireAllPermissions: [PLATFORM_ACCESS.procurement],
  },
  {
    prefix: "/api/v1/procurement/api/v1/notifications",
    permissions: ["procurement.view_inbox"],
    requireAllPermissions: [PLATFORM_ACCESS.procurement],
  },
  { prefix: "/api/v1/procurement/api/v1/auth/me", authenticated: true },
  {
    prefix: "/api/v1/procurement/api/v1/admin/audit-logs",
    permissions: ["audit.view_api_log"],
    requireAllPermissions: [PLATFORM_ACCESS.procurement],
  },
  {
    prefix: "/api/v1/procurement/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: procurementMutatePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.procurement],
  },
  {
    prefix: "/api/v1/procurement/api/v1",
    permissions: procurementViewPermissions,
    requireAllPermissions: [PLATFORM_ACCESS.procurement],
  },
  { prefix: "/api/v1/contract-management/health", public: true },
  { prefix: "/api/v1/contract-management/ready", public: true },
  { prefix: "/api/v1/contract-management/v1/health", public: true },
  {
    prefix: "/api/v1/contract-management/v1/bootstrap",
    methods: ["GET"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["DELETE"],
    permissions: ["contracts.delete"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["PATCH"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["POST", "PUT"],
    permissions: ["contracts.create", "contracts.update"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/contracts",
    methods: ["GET"],
    permissions: ["contracts.read"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/exports",
    methods: ["GET"],
    permissions: ["reports.read", "reports.create", "contracts.read"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/audit",
    methods: ["GET"],
    permissions: ["audit.read"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/audit",
    methods: ["POST"],
    permissions: ["audit.create"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/admin/audit-logs",
    permissions: ["audit.read"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1/admin/monitoring",
    permissions: ["audit.read"],
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  {
    prefix: "/api/v1/contract-management/v1",
    requireAllPermissions: [PLATFORM_ACCESS.contractManagement],
  },
  { prefix: "/api/v1/crm/health", public: true },
  { prefix: "/api/v1/crm/ready", public: true },
  { prefix: "/api/v1/crm/healthz", public: true },
  {
    prefix: "/api/v1/crm/v1/bootstrap",
    methods: ["GET"],
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/audit",
    methods: ["GET"],
    permissions: ["audit.read"],
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/audit",
    methods: ["POST"],
    permissions: ["audit.create"],
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/admin",
    requireStaff: true,
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/accounts",
    methods: ["DELETE"],
    permissions: ["accounts.delete"],
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/accounts",
    methods: ["POST", "PATCH"],
    permissions: ["accounts.create", "accounts.update"],
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/deals",
    methods: ["POST", "PATCH"],
    permissions: ["deals.create", "deals.update"],
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1/platform/status",
    requireStaff: true,
    requireAllPermissions: [PLATFORM_ACCESS.crm],
  },
  {
    prefix: "/api/v1/crm/v1",
    requireAllPermissions: [PLATFORM_ACCESS.crm],
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
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/orders",
    methods: ["POST", "PATCH"],
    permissions: ["dms.manage_orders"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/invoices",
    methods: ["POST"],
    permissions: ["dms.manage_invoices"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/claims",
    methods: ["POST"],
    permissions: ["dms.manage_claims"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/promotions",
    methods: ["POST"],
    permissions: ["dms.manage_promotions"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/dispatch",
    methods: ["POST"],
    permissions: ["dms.manage_dispatch"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/reports",
    methods: ["POST"],
    permissions: ["dms.run_reports"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/exports",
    methods: ["POST"],
    permissions: ["dms.run_reports"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/field/check-ins",
    methods: ["PATCH"],
    permissions: ["dms.field_checkin"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/field",
    methods: ["POST"],
    permissions: ["dms.field_checkin"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/audit",
    methods: ["POST"],
    permissions: ["dms.audit.create"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/audit",
    permissions: ["dms.audit.read"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/insights",
    permissions: ["dms.insights.read"],
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/admin",
    requireStaff: true,
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1/platform/status",
    requireStaff: true,
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  {
    prefix: "/api/v1/dms/v1",
    requireAllPermissions: [PLATFORM_ACCESS.dms],
  },
  { prefix: "/api/v1/dms", public: true },
  { prefix: "/api/v1/traceability/health", public: true },
  { prefix: "/api/v1/traceability/ready", public: true },
  { prefix: "/api/v1/traceability/healthz", public: true },
  { prefix: "/api/v1/traceability/public", public: true },
  {
    prefix: "/api/v1/traceability/api/v1/lots",
    methods: ["POST"],
    permissions: ["traceability.publish_qr"],
    requireAllPermissions: [PLATFORM_ACCESS.traceability],
  },
  {
    prefix: "/api/v1/traceability/api/v1/events",
    methods: ["POST"],
    permissions: ["traceability.add_trace_event"],
    requireAllPermissions: [PLATFORM_ACCESS.traceability],
  },
  {
    prefix: "/api/v1/traceability/api/v1/events",
    permissions: ["traceability.view_events"],
    requireAllPermissions: [PLATFORM_ACCESS.traceability],
  },
  {
    prefix: "/api/v1/traceability/api/v1/admin/audit-logs",
    permissions: ["audit.view_api_log"],
    requireAllPermissions: [PLATFORM_ACCESS.traceability],
  },
  {
    prefix: "/api/v1/traceability/api/v1/admin/monitoring",
    permissions: ["audit.view_api_log"],
    requireAllPermissions: [PLATFORM_ACCESS.traceability],
  },
  {
    prefix: "/api/v1/traceability/api/v1",
    permissions: ["traceability.view_chain", "traceability.view_events"],
    requireAllPermissions: [PLATFORM_ACCESS.traceability],
  },
  { prefix: "/api/v1/mes/health", public: true },
  { prefix: "/api/v1/mes/ready", public: true },
  {
    prefix: "/api/v1/mes/api/v1/admin",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: mesAdminWritePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.mes],
  },
  {
    prefix: "/api/v1/mes/api/v1/admin",
    permissions: ["mes.admin.read", "audit.view_api_log"],
    requireAllPermissions: [PLATFORM_ACCESS.mes],
  },
  {
    prefix: "/api/v1/mes/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: mesMutatePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.mes],
  },
  {
    prefix: "/api/v1/mes/api/v1",
    permissions: mesViewPermissions,
    requireAllPermissions: [PLATFORM_ACCESS.mes],
  },
  { prefix: "/api/v1/production/health", public: true },
  { prefix: "/api/v1/production/ready", public: true },
  {
    prefix: "/api/v1/production/api/v1/admin",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: productionAdminWritePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.production],
  },
  {
    prefix: "/api/v1/production/api/v1/admin",
    permissions: ["production.admin.read", "audit.view_api_log"],
    requireAllPermissions: [PLATFORM_ACCESS.production],
  },
  {
    prefix: "/api/v1/production/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: productionMutatePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.production],
  },
  {
    prefix: "/api/v1/production/api/v1",
    permissions: productionViewPermissions,
    requireAllPermissions: [PLATFORM_ACCESS.production],
  },
  { prefix: "/api/v1/erp/health", public: true },
  { prefix: "/api/v1/erp/ready", public: true },
  {
    prefix: "/api/v1/erp/api/v1/admin",
    permissions: erpAdminReadPermissions,
    requireAllPermissions: [PLATFORM_ACCESS.erp],
  },
  {
    prefix: "/api/v1/erp/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    permissions: erpMutatePermissions,
    requireAllPermissions: [PLATFORM_ACCESS.erp],
  },
  {
    prefix: "/api/v1/erp/api/v1",
    permissions: erpViewPermissions,
    requireAllPermissions: [PLATFORM_ACCESS.erp],
  },
  { prefix: "/api/v1/warehouse/health", public: true },
  { prefix: "/api/v1/warehouse/ready", public: true },
  { prefix: "/api/v1/warehouse/healthz", public: true },
  {
    prefix: "/api/v1/warehouse/api/v1/admin",
    permissions: ["warehouse.admin.read"],
    requireAllPermissions: [PLATFORM_ACCESS.warehouse],
  },
  {
    prefix: "/api/v1/warehouse/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    requireAllPermissions: [PLATFORM_ACCESS.warehouse],
  },
  {
    prefix: "/api/v1/warehouse/api/v1",
    requireAllPermissions: [PLATFORM_ACCESS.warehouse],
  },
  { prefix: "/api/v1/quality-control/health", public: true },
  { prefix: "/api/v1/quality-control/ready", public: true },
  {
    prefix: "/api/v1/quality-control/api/v1/admin",
    permissions: ["audit.view_api_log"],
    requireAllPermissions: [PLATFORM_ACCESS.qualityControl],
  },
  {
    prefix: "/api/v1/quality-control/api/v1",
    methods: ["POST", "PUT", "PATCH", "DELETE"],
    requireAllPermissions: [PLATFORM_ACCESS.qualityControl],
  },
  {
    prefix: "/api/v1/quality-control/api/v1",
    requireAllPermissions: [PLATFORM_ACCESS.qualityControl],
  },
  { prefix: "/api/v1/users/health", public: true },
  { prefix: "/api/v1/users/ready", public: true },
  {
    prefix: "/api/v1/users/v1/admin",
    permissions: ["users.admin"],
    requireAllPermissions: [PLATFORM_ACCESS.users],
  },
  {
    prefix: "/api/v1/users/v1/users",
    methods: ["GET"],
    permissions: ["users.read_profile", "users.admin"],
    requireAllPermissions: [PLATFORM_ACCESS.users],
  },
  {
    prefix: "/api/v1/users/v1/me/profile",
    methods: ["PATCH"],
    authenticated: true,
  },
  { prefix: "/api/v1/users/v1/me/profile", authenticated: true },
  {
    prefix: "/api/v1/users/v1/orgs",
    methods: ["POST", "PATCH", "DELETE"],
    requireAllPermissions: [PLATFORM_ACCESS.users],
  },
  {
    prefix: "/api/v1/users/v1/orgs",
    methods: ["GET"],
    requireAllPermissions: [PLATFORM_ACCESS.users],
  },
  {
    prefix: "/api/v1/users/v1",
    requireAllPermissions: [PLATFORM_ACCESS.users],
  },
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
