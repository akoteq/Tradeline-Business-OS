export type AuthUser = {
  id: string;
  email: string;
  role: "ADMIN" | "BDO" | "CEO";
  bdoId: string | null;
  bdoName: string | null;
  bdoCompany: string | null;
  mustChangePassword: boolean;
};
