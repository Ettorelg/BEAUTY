export const BUSINESS_TYPES = ["BEAUTY", "PET_CARE", "CONSULTING", "GENERAL"] as const;
export type BusinessType = typeof BUSINESS_TYPES[number];
export const OPTIONAL_MODULES = ["STAFF", "PAYMENTS", "FIDELITY", "STATISTICS", "INVENTORY"] as const;
export type BusinessModule = typeof OPTIONAL_MODULES[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  BEAUTY: "Bellezza",
  PET_CARE: "Cura animali",
  CONSULTING: "Consulenze",
  GENERAL: "Generico",
};
export const MODULE_LABELS: Record<BusinessModule, string> = {
  STAFF: "Staff e turni",
  PAYMENTS: "Pagamenti sospesi",
  FIDELITY: "Fidelity e promozioni",
  STATISTICS: "Statistiche",
  INVENTORY: "Magazzino e vendita articoli",
};
const presets: Record<BusinessType, BusinessModule[]> = {
  BEAUTY: ["STAFF", "PAYMENTS", "FIDELITY", "STATISTICS", "INVENTORY"],
  PET_CARE: ["STAFF", "PAYMENTS", "FIDELITY", "STATISTICS", "INVENTORY"],
  CONSULTING: ["STAFF", "PAYMENTS", "STATISTICS"],
  GENERAL: ["STAFF", "STATISTICS"],
};
export function normalizeBusinessType(value: unknown): BusinessType { return BUSINESS_TYPES.includes(value as BusinessType) ? value as BusinessType : "BEAUTY"; }
export function presetModules(type: BusinessType) { return presets[type]; }
export function parseModules(value: string | null | undefined): BusinessModule[] { const values=(value??"").split(","); return OPTIONAL_MODULES.filter(module=>values.includes(module)); }
export function serializeModules(modules: readonly BusinessModule[]) { return OPTIONAL_MODULES.filter(module=>modules.includes(module)).join(","); }
export function terminology(type: BusinessType) { return type==="PET_CARE"?{services:"Trattamenti",customers:"Clienti e animali",staff:"Staff",profile:"Profilo attività"}:type==="CONSULTING"?{services:"Consulenze",customers:"Clienti",staff:"Collaboratori",profile:"Profilo studio"}:{services:"Servizi",customers:"Clienti",staff:"Staff",profile:"Profilo attività"}; }
