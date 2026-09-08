export default function StatCard({title,value,icon,accent}:{title:string;value:any;icon?:React.ReactNode;accent?:string}){
  return <div className="bg-white rounded-xl border p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-gray-500">{title}</p><div className={`p-2 rounded-lg ${accent||"bg-blue-50 text-blue-600"}`}>{icon}</div></div><p className="text-2xl font-bold mt-2">{value}</p></div>;
}
