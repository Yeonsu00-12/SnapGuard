"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cctv, Plus, Store } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface BottomNavProps {
  alertCount?: number;
  onAddClick?: () => void;
}

export default function BottomNav({ alertCount = 0, onAddClick }: BottomNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: "/",
      label: "홈",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/stores",
      label: "사이트",
      icon: (
        <Store size={24} />
      ),
    },
  ];

  const rightNavItems: NavItem[] = [
    {
      href: "/live",
      label: "CCTV",
      icon: (
        <Cctv size={26} />
      ),
    },
    {
      href: "/alerts",
      label: "알림",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      badge: alertCount,
    },
  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all ${isActive ? "text-blue-500 scale-110" : "text-gray-400 hover:text-gray-200"
          }`}
      >
        <div className="relative">
          {item.icon}
          {item.badge !== undefined && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold mt-1 uppercase">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {/* Left nav items */}
        {navItems.map(renderNavItem)}

        {/* Center Add button */}
        <button
          onClick={onAddClick}
          className="flex flex-col items-center justify-center flex-1 h-full text-slate-300 hover:text-blue-600 active:scale-90 transition-all"
        >
          <div className="bg-slate-100 hover:bg-blue-50 p-2 rounded-full transition-colors">
            <Plus size={24} />
          </div>
          <span className="text-[10px] font-bold mt-1 uppercase">추가</span>
        </button>

        {/* Right nav items */}
        {rightNavItems.map(renderNavItem)}
      </div>
    </nav>
  );
}
