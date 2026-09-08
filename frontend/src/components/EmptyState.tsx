export default function EmptyState({title,desc}:{title:string;desc?:string}){
  return <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-gray-50"><p className="font-semibold text-gray-700">{title}</p>{desc&&<p className="text-sm text-gray-500 mt-1">{desc}</p>}</div>;
}
