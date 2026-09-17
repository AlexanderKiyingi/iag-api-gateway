/**
 * Coarse permission sets for gateway edge checks on operations services.
 * Services enforce finer-grained RBAC per route; these lists mirror the
 * codenames registered with iag-authentication (OR semantics at gateway).
 */

/** Per-microservice gateway gate — user must hold the codename (AND with route perms). */
export const PLATFORM_ACCESS = {
  users: "platform.access_users",
  finance: "platform.access_finance",
  notifications: "platform.access_notifications",
  fleet: "platform.access_fleet",
  procurement: "platform.access_procurement",
  supplyChain: "platform.access_supply_chain",
  traceability: "platform.access_traceability",
  projectManagement: "platform.access_project_management",
  contractManagement: "platform.access_contract_management",
  crm: "platform.access_crm",
  dms: "platform.access_dms",
  chat: "platform.access_chat",
  mes: "platform.access_mes",
  erp: "platform.access_erp",
  production: "platform.access_production",
  qualityControl: "platform.access_quality_control",
  warehouse: "platform.access_warehouse",
} as const;

export const warehouseViewPermissions = [
  "warehouse.view_overview",
  "warehouse.view_location",
  "warehouse.view_item",
  "warehouse.view_stock",
  "warehouse.view_receipt",
  "warehouse.view_issue",
  "warehouse.view_asset",
];

export const warehouseMutatePermissions = [
  "warehouse.add_location",
  "warehouse.change_location",
  "warehouse.add_item",
  "warehouse.change_item",
  "warehouse.add_receipt",
  "warehouse.post_receipt",
  "warehouse.add_issue",
  "warehouse.post_issue",
  "warehouse.issue_consumable",
  "warehouse.production_consume",
  "warehouse.production_output",
  "warehouse.add_transfer",
  "warehouse.adjust_stock",
  "warehouse.cycle_count",
  "warehouse.add_asset",
  "warehouse.checkin_asset",
  "warehouse.checkout_asset",
  "warehouse.add_pick",
  "warehouse.confirm_pick",
  "warehouse.add_pack",
  "warehouse.admin.read",
];

export const mesViewPermissions = [
  "mes.view_overview",
  "mes.view_plant",
  "mes.view_asset",
  "mes.view_work_order",
  "mes.view_downtime",
  "mes.view_shift",
  "mes.view_kpi",
  "mes.view_alert",
  "mes.view_telemetry",
  "mes.view_ai",
  "mes.view_energy",
];

export const mesMutatePermissions = [
  "mes.change_plant",
  "mes.change_asset",
  "mes.add_work_order",
  "mes.change_work_order",
  "mes.complete_work_order",
  "mes.add_downtime",
  "mes.change_shift",
  "mes.ack_alert",
  "mes.change_ai",
  "mes.add_energy",
];

export const productionViewPermissions = [
  "production.view_overview",
  "production.view_run",
  "production.view_schedule",
  "production.view_shift",
];

export const productionMutatePermissions = [
  "production.add_run",
  "production.change_run",
  "production.change_schedule",
  "production.change_shift",
];

export const productionAdminWritePermissions = [
  "production.admin.write",
  "production.sync_integrations",
];

/**
 * These two lists are an any-of pre-filter: a caller missing every codename
 * here is refused at the edge, before iag-erp's own RequirePermission ever
 * runs. So a partial list does not merely under-document — it makes whole
 * modules unreachable for the roles that own them.
 *
 * Both were copies of iag-erp's HR-and-production surface as it stood when the
 * route was added, and the service has since registered twenty more codenames:
 * payroll, compensation, payslips, recruitment, lifecycle, performance,
 * disciplinary, training and the generic HR record store. A payroll officer
 * holding `erp.view_payroll` and nothing else was getting a gateway 403 on a
 * service that would have served them.
 *
 * Source of truth is iag-erp's own internal/models/permissions.go —
 * PermissionDescriptors(), which the service self-registers at boot. Keep these
 * in step with it; policies.coverage.test.ts pins the pairing.
 */
export const erpViewPermissions = [
  "erp.view_hr_overview",
  "erp.view_employee",
  "erp.view_leave",
  "erp.view_attendance",
  "erp.view_all_hr",
  "erp.view_compensation",
  "erp.view_payslip",
  "erp.view_payroll",
  "erp.view_recruitment",
  "erp.view_lifecycle",
  "erp.view_performance",
  "erp.view_disciplinary",
  "erp.view_training",
  "erp.view_hr_records",
  "erp.view_production_order",
];

export const erpMutatePermissions = [
  "erp.change_employee",
  "erp.change_leave",
  "erp.approve_leave",
  "erp.change_attendance",
  "erp.change_compensation",
  "erp.run_payroll",
  "erp.approve_payroll",
  "erp.post_payroll",
  "erp.change_recruitment",
  "erp.change_lifecycle",
  "erp.complete_checklist_item",
  "erp.change_performance",
  "erp.manage_performance",
  "erp.change_disciplinary",
  "erp.change_training",
  "erp.change_hr_records",
  "erp.change_production_order",
];

export const erpAdminReadPermissions = [
  "erp.admin.read",
  "audit.view_api_log",
];

export const mesAdminWritePermissions = [
  "mes.admin.write",
  "mes.sync_integrations",
];

const fleetEntities = [
  "vehicle",
  "driver",
  "jmp",
  "cargo",
  "cargo_doc",
  "maintenance_item",
  "part",
  "tyre",
  "trip",
  "safety_event",
  "compliance_item",
  "service_request",
  "task_item",
  "deployment_day",
  "fuel_record",
] as const;

export const fleetViewPermissions = [
  ...fleetEntities.map((e) => `fleet.view_${e}`),
  "fleet.view_audit_entry",
  "fleet.view_operator_ticker",
  "fleet.view_telemetry",
  "fleet.view_notification",
  "fleet.view_pm_schedule",
  // 0049 taxonomy and 0057 operations records. The gate is OR across this
  // list, so these matter only for a principal whose sole fleet grant is one
  // of them — a weighbridge clerk, say.
  ...[
    "vehicle_category", "permit_class", "permit_authorisation",
    "vehicle_inspection", "inspection_template", "fuel_request",
    "weighbridge_ticket", "vehicle_diagnostic", "driver_hos_log",
    "driver_safety_score", "fuel_card_reconciliation", "service_reminder",
    "emissions_entry", "route_eta", "carrier", "trip_pod",
  ].map((e) => `fleet.view_${e}`),
];

export const fleetMutatePermissions = [
  ...fleetEntities.flatMap((e) => [
    `fleet.add_${e}`,
    `fleet.change_${e}`,
    `fleet.delete_${e}`,
  ]),
  "fleet.approve_mileage_jmp",
  // Fuel and service-request decisions. fleet gates `POST /api/fuel-requests/
  // :id/approve` and `POST /api/requests/:id/approve` on these, but the gateway
  // 403'd a principal whose only fleet grant was the approve permission before
  // the request ever reached fleet's own RequirePerm.
  "fleet.approve_fuel_request",
  "fleet.approve_service_request",
  "fleet.approve_assignment",
  "fleet.approve_deployment",
  "fleet.approve_jmp",
  "fleet.complete_toolbox_jmp",
  "fleet.complete_jmp",
  "fleet.cancel_jmp",
  "fleet.advance_stage_cargo",
  "fleet.offload_cargo",
  "fleet.demobilise_cargo",
  "fleet.assign_request",
  "fleet.complete_task",
  "fleet.seed_deployment",
  "fleet.add_deployment_entry",
  "fleet.simulate_vehicles",
  "fleet.manage_iot_device",
  "fleet.change_notification",
  "fleet.add_pm_schedule",
  "fleet.change_pm_schedule",
  "fleet.delete_pm_schedule",
  "fleet.change_vehicle_inspection",
  "fleet.change_operator_ticker",
  "fleet.export_data",
  "fleet.import_data",
  "fleet.reset_data",
  // 0049 taxonomy and 0057 operations records, full verb set.
  ...[
    "vehicle_category", "permit_class", "permit_authorisation",
    "vehicle_inspection", "inspection_template", "fuel_request",
    "weighbridge_ticket", "vehicle_diagnostic", "driver_hos_log",
    "driver_safety_score", "fuel_card_reconciliation", "service_reminder",
    "emissions_entry", "route_eta", "carrier", "trip_pod",
  ].flatMap((e) => [`fleet.add_${e}`, `fleet.change_${e}`, `fleet.delete_${e}`]),
];

export const procurementViewPermissions = [
  "procurement.view_seed",
  "procurement.view_inbox",
  "procurement.view_own_po",
  "procurement.view_own_invoice",
  "audit.view_api_log",
];

export const procurementMutatePermissions = [
  "procurement.add_requisition",
  "procurement.change_requisition",
  "procurement.delete_requisition",
  "procurement.add_purchase_order",
  "procurement.change_purchase_order",
  "procurement.delete_purchase_order",
  "procurement.add_vendor",
  "procurement.change_vendor",
  "procurement.delete_vendor",
  "procurement.add_item",
  "procurement.change_item",
  "procurement.delete_item",
  "procurement.add_budget",
  "procurement.change_budget",
  "procurement.delete_budget",
  "procurement.add_rfq",
  "procurement.change_rfq",
  "procurement.delete_rfq",
  "procurement.add_grn",
  "procurement.change_grn",
  "procurement.delete_grn",
  "procurement.add_invoice",
  "procurement.change_invoice",
  "procurement.delete_invoice",
  "procurement.add_contract",
  "procurement.change_contract",
  "procurement.delete_contract",
  "procurement.emit_notification",
];

export const scmViewPermissions = [
  "traceability.view_farmer",
  "traceability.view_batch",
  "traceability.view_chain",
  "traceability.view_events",
  "scm.view_supplier",
  "scm.view_own_supplier",
  "scm.view_own_batch",
  "scm.view_own_farm",
  "scm.view_purchaseorder",
  "scm.view_inventory",
  "scm.view_salesorder",
  "compliance.view_certification",
  "finance.view_farmerpayment",
  "finance.view_own_payment",
  "finance.view_own_ap",
  "admin.view_user",
  "admin.view_group",
  "admin.view_permission",
  "admin.view_auditlog",
];

export const scmMutatePermissions = [
  "traceability.add_farmer",
  "traceability.change_farmer",
  "traceability.change_batch",
  "traceability.add_trace_event",
  "traceability.publish_qr",
  "scm.add_supplier",
  "scm.change_supplier",
  "scm.add_purchaseorder",
  "scm.change_purchaseorder",
  "scm.add_salesorder",
  "scm.change_salesorder",
  "scm.change_inventory",
  "finance.change_farmerpayment",
  "compliance.change_certification",
  "admin.add_user",
  "admin.change_user",
  "admin.delete_user",
  "admin.add_group",
  "admin.change_group",
  "admin.delete_group",
  "system.change_settings",
  "system.run_demo_seed",
];
