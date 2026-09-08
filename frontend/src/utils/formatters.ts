export const fmtDate = (s?:string)=> s? new Date(s).toLocaleString(): "-";
export const capitalize = (s:string)=> s.charAt(0).toUpperCase()+s.slice(1).replaceAll("_"," ");
