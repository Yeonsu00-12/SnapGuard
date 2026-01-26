import Image from "next/image";
import { SERVER_BASE } from "@/lib/api";

export default function Thumbnail({ alarm, isAlarm }: { alarm: Alarm; isAlarm?: boolean }) {
    return (
        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 relative bg-slate-100">
            {alarm.snapshotPath ? (
                <Image
                    width={80}
                    height={80}
                    src={`${SERVER_BASE}${
                        alarm.snapshotPath.includes("/uploads/")
                        ? alarm.snapshotPath.substring(alarm.snapshotPath.indexOf("/uploads/"))
                        : alarm.snapshotPath
                    }`}
                    className="w-full h-full object-cover"
                    alt="Snapshot"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <svg
                        className="w-8 h-8 text-slate-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>
            )}
            {isAlarm && (
                <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
            )}
        </div>
    )
}