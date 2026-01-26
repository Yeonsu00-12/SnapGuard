import { getEventTypeLabel } from "@/lib/severity";
import { formatTime } from "@/lib/timeformatter";

interface AlarmInfoProps {
    alarm: Alarm;
    isAlarm?: boolean;
}

export default function AlarmInfo({ alarm, isAlarm }: AlarmInfoProps) {
    return (
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-start mb-0.5">
                <span
                className={`text-sm font-bold uppercase ${
                    isAlarm ? "text-red-500" : "text-slate-400"
                }`}
                >
                {alarm.camera.site?.name || "알 수 없음"} - {alarm.camera.name}
                </span>
                <span className="text-xs text-slate-400">
                {formatTime(alarm.detectionTime)}
                </span>
            </div>
            <p className="font-bold text-sm text-slate-800 truncate">
                {getEventTypeLabel(alarm.eventType)}
            </p>
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {alarm.description || "이벤트가 감지되었습니다"}
            </p>
        </div>
    )
}