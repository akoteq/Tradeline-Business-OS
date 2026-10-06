export type AuthUser = {
  id: string;
  email: string;
  role: "ADMIN" | "CEO" | "BUSINESS_CEO" | "MANAGING_PARTNER" | "SENIOR_PARTNER" | "SENIOR_BDO" | "BDO" | "JUNIOR_BDO" | "INTERN";
  bdoId: string | null;
  bdoName: string | null;
  bdoCompany: string | null;
  mustChangePassword: boolean;
};

// The spec's three roles. Mirrors accessLevel() in server/src/models/User.ts — every stored role
// folds into one of these, so pages check the level instead of listing role strings.
export type AccessLevel = "GROUP_OWNER" | "BUSINESS_CEO" | "STAFF";

export function accessLevel(role: string | null | undefined): AccessLevel {
  if (role === "ADMIN" || role === "CEO") return "GROUP_OWNER";
  if (role === "BUSINESS_CEO") return "BUSINESS_CEO";
  return "STAFF";
}

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  GROUP_OWNER: "Group Owner",
  BUSINESS_CEO: "Business CEO",
  STAFF: "Staff",
};

export const isGroupOwner = (u: Pick<AuthUser, "role"> | null | undefined) => !!u && accessLevel(u.role) === "GROUP_OWNER";
export const isBusinessCeo = (u: Pick<AuthUser, "role"> | null | undefined) => !!u && accessLevel(u.role) === "BUSINESS_CEO";
export const isStaff = (u: Pick<AuthUser, "role"> | null | undefined) => !!u && accessLevel(u.role) === "STAFF";
// Group Owner or Business CEO — the two levels that manage other people's work.
export const isManager = (u: Pick<AuthUser, "role"> | null | undefined) => !!u && accessLevel(u.role) !== "STAFF";
