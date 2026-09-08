import { UserRole } from "../types/auth";
export const canAccessGovernment = (r?:UserRole)=> r==="admin"||r==="transport_officer";
export const isWorker = (r?:UserRole)=> r==="worker";
