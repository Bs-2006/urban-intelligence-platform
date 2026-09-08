export type UserRole = "admin" | "transport_officer" | "worker" | "citizen";
export interface User {
  id: number;
  email: string;
  role: UserRole;
  full_name?: string;
  is_active?: boolean;
}
export interface LoginResponse { access_token: string; token_type: string; }
