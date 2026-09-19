import api from "./api";
export async function login(email:string,password:string){
  const params=new URLSearchParams(); params.append("username",email); params.append("password",password);
  const res=await api.post("/auth/login", params, { headers:{ "Content-Type":"application/x-www-form-urlencoded"}});
  return res.data as { access_token:string; token_type:string };
}
export async function register(data:any){
  const res=await api.post("/auth/register", data);
  return res.data;
}
export async function verifyEmail(email:string,otp:string){
  const res=await api.post("/auth/verify-email", { email, otp });
  return res.data;
}
export async function resendOtp(email:string){
  const res=await api.post("/auth/resend-otp", { email });
  return res.data;
}
export async function fetchMe(){ const r=await api.get("/users/me"); return r.data; }
export async function updateMe(data:any){ const r=await api.patch("/users/me",data); return r.data; }
