export type AuthUser = {
  id: string;
  email: string;
  role: "ADMIN" | "BDO" | "CEO";
  bdoId: string | null;
  bdoName: string | null;
  mustChangePassword: boolean;
};
