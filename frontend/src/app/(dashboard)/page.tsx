"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAlarmStore } from "@/stores/useAlarmStore";
import { AlertTriangle, CheckIcon, Store } from "lucide-react";
import StatisticsBoard from "@/components/dashboard/StatisticsBoard";
import AlarmInfo from "@/components/dashboard/AlarmInfo";
import Thumbnail from "@/components/dashboard/Tumbnail";
import SiteMapper from "@/components/dashboard/SiteMapper";
import AlarmFeedHeader from "@/components/dashboard/AlarmFeedHeader";

export default function HomePage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [totalCameras, setTotalCameras] = useState(0);
  const [loading, setLoading] = useState(true);

  // Zustand 스토어에서 알람 데이터 구독
  const { recentAlarms, todayAlarmCount, setRecentAlarms, setTodayAlarmCount } = useAlarmStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 오늘 날짜 범위 계산
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const [sitesData, alarmsData, alarmStats, camerasData] = await Promise.all([
        api.getSites(),
        api.getAlarms({ limit: "5" }),
        api.getAlarmStats({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
        api.getCameras(),
      ]);

      setSites(sitesData);
      // Zustand 스토어에 초기 데이터 설정
      setRecentAlarms(alarmsData.alarms);
      setTodayAlarmCount(alarmStats.total || 0);
      setTotalCameras(camerasData.length);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-40">
      {/* 상단 통계 위젯 */}
      <StatisticsBoard sites={sites} totalCameras={totalCameras} alertCount={todayAlarmCount} />

      {/* 실시간 알림 피드 */}
      <section className="space-y-3">
        <AlarmFeedHeader />

        {recentAlarms.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckIcon size={24} className="text-green-500 animate-bounce-short" />
            </div>
            <p className="text-slate-500 font-bold">감지된 이벤트가 없습니다.</p>
            <p className="text-sm text-slate-400 mt-1">현재 모든 것이 정상입니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAlarms.slice(0, 5).map((alarm) => {
              const isAlarm = alarm.severity === "CRITICAL" || alarm.severity === "HIGH";
              return (
                <div
                  key={alarm.id}
                  onClick={() => router.push(`/alerts?alarmId=${alarm.id}`)}
                  className={`bg-white p-4 rounded-lg border flex gap-4 shadow-sm transition-all active:scale-[0.98] cursor-pointer ${isAlarm ? "border-red-200 bg-red-50/30" : "border-slate-100"
                    }`}
                >
                  {/* 썸네일 */}
                  <Thumbnail alarm={alarm} isAlarm={isAlarm} />

                  {/* 정보 */}
                  <AlarmInfo alarm={alarm} isAlarm={isAlarm} />

                  {/* 알람 아이콘 */}
                  {isAlarm && (
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-100">
                        <AlertTriangle size={20} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 사용자가 만든 사이트 */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 px-1">
          <Store size={18} /> 사이트 목록
        </h2>

        {sites.length === 0 ? (
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 text-center">
            <p className="text-slate-400 font-bold">등록된 매장이 없습니다</p>
            <p className="text-sm text-slate-400 mt-1">
              하단의 추가 버튼을 눌러 매장을 등록하세요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <SiteMapper sites={sites} />
          </div>
        )}
      </section>
      <style jsx>{`
        @keyframes bounce-short {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .animate-bounce-short {
          animation: bounce-short 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
