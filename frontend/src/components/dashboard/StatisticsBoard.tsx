interface StatisticsBoardProps {
    sites: Site[];
    totalCameras: number;
    alertCount: number
}

export default function StatisticsBoard({ sites, totalCameras, alertCount }: StatisticsBoardProps) {
    return (
        <>
            <section className="grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">
                        운영 매장
                    </p>
                    <p className="text-md font-semibold text-slate-800">{sites.length}곳</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">
                        연결 카메라
                    </p>
                    <p className="text-md font-semibold text-slate-800">{totalCameras}대</p>
                </div>
                <div
                    className={`p-4 rounded-xl border shadow-sm text-center transition-colors ${alertCount > 0
                        ? "bg-red-50 border-red-100 text-red-600"
                        : "bg-white border-slate-100"
                        }`}
                >
                    <p className="text-[10px] font-bold uppercase tracking-tighter">오늘 알림</p>
                    <p className="text-md font-semibold">{alertCount}건</p>
                </div>
            </section>
        </>
    )
}