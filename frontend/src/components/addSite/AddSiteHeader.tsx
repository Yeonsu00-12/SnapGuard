import { ChevronLeft, X } from "lucide-react";

interface AddSiteHeaderProps {
    onClose: () => void;
    step: number;
    onBack: () => void;  // 뒤로가기 콜백
}

export default function AddSiteHeader({ onClose, step, onBack }: AddSiteHeaderProps) {
    return (
        <header className="px-6 py-3 border-b flex items-center justify-between bg-white">
            <button
                onClick={onBack}
                disabled={step <= 1}
                className={`p-2 rounded-xl transition-colors ${
                    step > 1
                        ? "text-slate-400 hover:bg-slate-100"
                        : "text-slate-200 cursor-not-allowed"
                }`}
            >
                <ChevronLeft size={28} />
            </button>
            <span className="font-bold text-sm text-text">
                사이트 생성 단계 ({step}/5)
            </span>
            <button
                onClick={onClose}
                className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
                <X size={24} />
            </button>
        </header>
    )
}