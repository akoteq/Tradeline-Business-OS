export type LinkedDeal = { id: string; type: "TRADELINE" | "GRANT"; label: string; status: string };

export type SME = {
  id: string;
  bizId: string | null;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  address: string | null;
  valueChain: string | null;
  region: string | null;
  district: string | null;
  businessDescription: string | null;
  status: string;
  followUpDate: string | null;
  investorReadinessScore: number | null;
  bankabilityTier?: string;
  collateralStatus: string | null;
  dateOfIncorporation: string | null;
  yearsInOperation: number | null;
  revenueGhs2023: number | null;
  revenueGhs2024: number | null;
  revenueGhs2025: number | null;
  revenueGhs2026: number | null;
  bdoId: string | null;
  bdo: { id: string; name: string } | null;
  notes: string | null;
  tradelineCount?: number;
  grantCount?: number;
  linkedDeals?: LinkedDeal[];
  activities?: string[];
  // Shared clients: which companies serve the client, and what this viewer may do with it.
  servedBy?: string[];
  canEdit?: boolean;
  fullAccess?: boolean;
};

export type BdoOption = { id: string; name: string; company: string };

/** A client that may already exist (GET /sme/duplicates). */
export type ClientMatch = { id: string; name: string; region: string | null; servedBy: string[] };

export const STATUS_OPTS = ["IN_PROGRESS", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const TIER_OPTS = ["UNSCORED", "TIER_1", "TIER_2", "TIER_3"] as const;
export const REVENUE_YEARS = ["2023", "2024", "2025", "2026"] as const;

export const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In progress", ACTIVE: "Active", INACTIVE: "Inactive", ARCHIVED: "Archived",
};
export const TIER_LABEL: Record<string, string> = {
  UNSCORED: "Not scored", TIER_1: "Tier 1", TIER_2: "Tier 2", TIER_3: "Tier 3",
};

export const EMPTY_FORM = {
  companyName: "", contactName: "", email: "", phone: "", altPhone: "", address: "",
  valueChain: "", region: "", district: "", businessDescription: "",
  status: "IN_PROGRESS", bankabilityTier: "UNSCORED", collateralStatus: "",
  investorReadinessScore: "", followUpDate: "", notes: "",
  dateOfIncorporation: "", yearsInOperation: "",
  revenueGhs2023: "", revenueGhs2024: "", revenueGhs2025: "", revenueGhs2026: "",
  bdoId: "", activities: "",
};

export type ClientForm = typeof EMPTY_FORM;

const num = (v: string | number | null) => (v != null ? String(v) : "");

export function smeToForm(sme: SME): ClientForm {
  return {
    companyName: sme.companyName,
    contactName: sme.contactName ?? "",
    email: sme.email ?? "",
    phone: sme.phone ?? "",
    altPhone: sme.altPhone ?? "",
    address: sme.address ?? "",
    valueChain: sme.valueChain ?? "",
    region: sme.region ?? "",
    district: sme.district ?? "",
    businessDescription: sme.businessDescription ?? "",
    status: sme.status,
    bankabilityTier: sme.bankabilityTier ?? "UNSCORED",
    activities: (sme.activities ?? []).join(", "),
    collateralStatus: sme.collateralStatus ?? "",
    investorReadinessScore: num(sme.investorReadinessScore),
    followUpDate: sme.followUpDate ? sme.followUpDate.slice(0, 10) : "",
    notes: sme.notes ?? "",
    dateOfIncorporation: sme.dateOfIncorporation ? sme.dateOfIncorporation.slice(0, 10) : "",
    yearsInOperation: num(sme.yearsInOperation),
    revenueGhs2023: num(sme.revenueGhs2023),
    revenueGhs2024: num(sme.revenueGhs2024),
    revenueGhs2025: num(sme.revenueGhs2025),
    revenueGhs2026: num(sme.revenueGhs2026),
    bdoId: sme.bdoId ?? "",
  };
}

// Tradeline's financing fields are left out entirely for everyone else, so saving never clears them.
export function formToBody(form: ClientForm, tradelineView: boolean) {
  const orNull = (v: string) => v.trim() || null;
  const numOrNull = (v: string) => (v !== "" ? Number(v) : null);
  const body: Record<string, unknown> = {
    companyName: form.companyName.trim(),
    contactName: orNull(form.contactName),
    email: orNull(form.email),
    phone: orNull(form.phone),
    altPhone: orNull(form.altPhone),
    address: orNull(form.address),
    valueChain: orNull(form.valueChain),
    region: orNull(form.region),
    district: orNull(form.district),
    businessDescription: orNull(form.businessDescription),
    status: form.status,
    activities: form.activities.split(",").map((a) => a.trim()).filter(Boolean),
    followUpDate: form.followUpDate || null,
    notes: orNull(form.notes),
    dateOfIncorporation: form.dateOfIncorporation || null,
    yearsInOperation: numOrNull(form.yearsInOperation),
    bdoId: form.bdoId || null,
  };
  if (tradelineView) {
    Object.assign(body, {
      bankabilityTier: form.bankabilityTier,
      collateralStatus: orNull(form.collateralStatus),
      investorReadinessScore: numOrNull(form.investorReadinessScore),
      revenueGhs2023: numOrNull(form.revenueGhs2023),
      revenueGhs2024: numOrNull(form.revenueGhs2024),
      revenueGhs2025: numOrNull(form.revenueGhs2025),
      revenueGhs2026: numOrNull(form.revenueGhs2026),
    });
  }
  return body;
}
