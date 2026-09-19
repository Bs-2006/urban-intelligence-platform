export type UserRole = "admin" | "worker";
export interface User {
  id: number;
  email: string;
  role: UserRole;
  full_name?: string;
  specialization?: string;
  is_active?: boolean;
  is_verified?: boolean;
}
export interface LoginResponse { access_token: string; token_type: string; }
