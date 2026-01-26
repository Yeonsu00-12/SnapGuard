import { ChevronRight, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SiteMapper({ sites }: { sites: Site[] }) {
    const router = useRouter();
    return (
        <>
            {sites.map((site) => (
              <div
                key={site.id}
                onClick={() => router.push(`/sites/${site.id}`)}
                className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between group cursor-pointer shadow-sm hover:border-blue-200 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-800">{site.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {site._count?.cameras || 0}대 카메라 연결됨
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={20}
                  className="text-slate-200 group-hover:text-blue-600 transition-colors"
                />
              </div>
            ))}
        </>
    )
}