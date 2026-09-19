import { UserRole } from "../types/auth";
export const canAccessGovernment = (r?:UserRole)=> r==="admin"||r==="worker";
export const isWorker = (r?:UserRole)=> r==="worker";
