export type AuthUser = {
  id: string;
  email: string;
  role: "ADMIN" | "CEO" | "MANAGING_PARTNER" | "SENIOR_PARTNER" | "SENIOR_BDO" | "BDO" | "JUNIOR_BDO" | "INTERN";
  bdoId: string | null;
  bdoName: string | null;
  bdoCompany: string | null;
  mustChangePassword: boolean;
};
