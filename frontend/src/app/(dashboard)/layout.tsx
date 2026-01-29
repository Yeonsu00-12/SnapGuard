"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import BottomNav from "@/components/BottomNav";
import AddSiteWizard from "@/components/AddSiteWizard";
import { LogOut } from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [showAddWizard, setShowAddWizard] = useState(false);

  // 오늘의 NEW 알람 개수 가져오기
  const fetchTodayAlarmCount = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const alarmStats = await api.getAlarmStats({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      });
      setAlertCount(alarmStats.byStatus?.NEW || 0);
    } catch (error) {
      console.error("Failed to fetch alarm count:", error);
    }
  };

  useEffect(() => {
    // 현재 사용자 정보 가져오기
    const checkAuth = async () => {
      try {
        const response = await api.me();
        setUser(response.user);
        setLoading(false);
        fetchTodayAlarmCount();
      } catch (error) {
        // 인증 실패 시 로그인 페이지로 리다이렉트
        router.push("/login");
      }
    };

    checkAuth();

    // 알람 읽음 이벤트 리스너
    const handleAlarmRead = () => {
      fetchTodayAlarmCount();
    };

    window.addEventListener("alarm-read", handleAlarmRead);

    return () => {
      window.removeEventListener("alarm-read", handleAlarmRead);
    };
  }, [router]);

  const handleSiteAdded = (site: any) => {
    // 커스텀 이벤트를 발생시켜 stores 페이지가 데이터를 새로고침하도록 함
    window.dispatchEvent(new CustomEvent("site-updated"));
    // 새로 만든 사이트 상세 페이지로 이동
    router.push(`/sites/${site.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative">
        <div className="flex items-center text-text mb-4">
          <Image src="/images/logo.png" alt="SnapGuard Logo" width={60} height={60} />
          <span className="font-black text-2xl tracking-tighter italic">SnapGuard</span>
        </div>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* 상단 브랜딩 바 */}
      {/* <div className="bg-slate-900 text-white py-2 text-center">
        <span className="text-[9px] font-black tracking-[0.2em] opacity-80 uppercase italic">
          ● SnapGuard Smart Monitoring Active
        </span>
      </div> */}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm h-25">
        <div className="max-w-lg mx-auto px-2 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-text relative">
            <Image src="/images/logo.png" alt="SnapGuard Logo" width={60} height={60} className="absolute left-0" />
            <h1 className="font-black text-lg tracking-tighter pl-12">SnapGuard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">{user?.email}</span>
            <button
              onClick={() => {
                api.logout();
                router.push("/login");
              }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-red-100 rounded-lg transition-colors"
              title="로그아웃"
            >
              <LogOut size={16} className="hover:text-red-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav alertCount={alertCount} onAddClick={() => setShowAddWizard(true)} />

      {/* Add Site Wizard */}
      <AddSiteWizard
        isOpen={showAddWizard}
        onClose={() => setShowAddWizard(false)}
        onSuccess={handleSiteAdded}
      />
    </div>
  );
}
