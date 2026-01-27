"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Mail, Lock, ChevronRight, Eye, EyeOff } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.login(email, password);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 상단 브랜딩 바 */}
      <div className="bg-slate-900 text-white py-2 text-center">
        <span className="text-[9px] font-black tracking-[0.2em] opacity-80 uppercase italic">
          ● SnapGuard Smart Monitoring System
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* 로고 섹션 */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center mb-3 relative">
              <Image src="/images/logo.png" alt="SnapGuard Logo" width={90} height={90} className="absolute left-10" />
              <h1 className="text-[#0D3B43] font-bold text-4xl tracking-tighter">SnapGuard</h1>
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Owner&apos;s Smart Portal
            </p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-xl shadow-xl p-8 border border-slate-100">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                로그인
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                계정에 로그인하세요
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  이메일
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300"
                    placeholder="아이디를 입력해주세요"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300"
                    placeholder="비밀번호를 입력해주세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    로그인
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 하단 안내 */}
          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-400 font-bold">
              24시간 스마트 보안 모니터링 시스템
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
