import { AlarmClock, Bell, Cctv, Store } from "lucide-react";

interface StatisticsBoardProps {
    sites: Site[];
    totalCameras: number;
    alertCount: number
}

export default function StatisticsBoard({ sites, totalCameras, alertCount }: StatisticsBoardProps) {
    return (
        <>
            <section className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#0888FF]/60 shadow-sm rounded-xl text-center flex flex-col gap-1 justify-center p-3">
                    <p className="p-1 w-fit rounded-md bg-[#0888FF29]">
                        <Store size={16} className="text-[#0888FF]" />
                    </p>
                    <div className="flex flex-row items-center justify-between">
                        <p className="text-xs sm:text-sm font-bold text-[#8E8E9A] tracking-tighter whitespace-nowrap">
                            운영 사이트
                        </p>
                        <p className="text-sm font-bold">{sites.length}곳</p>
                    </div>
                </div>
                <div className="bg-white border border-[#31C6B4]/60 shadow-sm rounded-xl text-center flex flex-col gap-1 justify-center p-3">
                    <p className="p-1 w-fit rounded-md bg-[#31C6B414]">
                        <Cctv size={16} className="text-[#31C6B4]" />
                    </p>
                    <div className="flex flex-row items-center justify-between">
                        <p className="text-xs sm:text-sm font-bold text-[#8E8E9A] tracking-tighter whitespace-nowrap">
                            연결 카메라
                        </p>
                        <p className="text-sm font-bold">{totalCameras}대</p>
                    </div>
                </div>
                <div
                    className={`p-3 rounded-xl flex flex-col gap-1 justify-center border bg-white border-[#FF2D46]/60`}
                >
                    <p className="p-1 w-fit rounded-md bg-[#FF2D46]/20"><Bell size={16} className="text-[#FF2D46]" /></p>
                    <div className="flex flex-row items-center justify-between">
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-tighter text-[#8E8E9A] whitespace-nowrap">오늘 알림</p>
                        <p className={`text-sm font-bold ${alertCount > 0 && "text-[#FF2D46]"}`}>{alertCount}건</p>
                    </div>
                </div>
            </section>
        </>
    )
}