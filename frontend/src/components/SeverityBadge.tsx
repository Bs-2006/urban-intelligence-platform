const m:any={ low:"bg-green-100 text-green-700", medium:"bg-yellow-100 text-yellow-700", high:"bg-orange-100 text-orange-700", critical:"bg-red-100 text-red-700"};
export default function SeverityBadge({severity}:{severity:string}){ return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m[severity]||"bg-gray-100"}`}>{severity}</span>; }
