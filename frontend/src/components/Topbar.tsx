export default function Topbar({title}:{title:string}){
  return <div className="h-14 bg-white border-b flex items-center px-6 justify-between"><h1 className="font-semibold text-gray-800">{title}</h1><span className="text-xs text-gray-500">Government Operations Center</span></div>;
}
