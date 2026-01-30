import { create } from "zustand";

interface AlarmStore {
  // 상태
  recentAlarms: Alarm[];
  todayAlarmCount: number;
  isConnected: boolean;

  // 액션
  addAlarm: (alarm: Alarm) => void;
  setRecentAlarms: (alarms: Alarm[]) => void;
  setTodayAlarmCount: (count: number) => void;
  incrementTodayCount: () => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useAlarmStore = create<AlarmStore>((set) => ({
  // 초기 상태
  recentAlarms: [],
  todayAlarmCount: 0,
  isConnected: false,

  // 새 알람 추가 (맨 앞에 추가, 최대 20개 유지)
  addAlarm: (alarm) =>
    set((state) => ({
      recentAlarms: [alarm, ...state.recentAlarms].slice(0, 20),
      todayAlarmCount: state.todayAlarmCount + 1,
    })),

  // 알람 목록 설정 (초기 로드 시)
  setRecentAlarms: (alarms) => set({ recentAlarms: alarms }),

  // 오늘 알람 수 설정
  setTodayAlarmCount: (count) => set({ todayAlarmCount: count }),

  // 오늘 알람 수 증가
  incrementTodayCount: () =>
    set((state) => ({ todayAlarmCount: state.todayAlarmCount + 1 })),

  // 연결 상태 설정
  setConnected: (connected) => set({ isConnected: connected }),

  // 초기화
  reset: () =>
    set({
      recentAlarms: [],
      todayAlarmCount: 0,
      isConnected: false,
    }),
}));
