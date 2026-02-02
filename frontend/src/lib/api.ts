export const API_BASE = "/api";
export const SERVER_BASE = "http://localhost:4000";

const USER_STORAGE_KEY = "snapguard_user";

interface User {
  id: string;
  email: string;
}

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  // localStorage에서 유저 정보 가져오기
  getStoredUser(): User | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  // localStorage에 유저 정보 저장
  setStoredUser(user: User | null) {
    if (typeof window === "undefined") return;
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const user = this.getStoredUser();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // X-User-Email 헤더 추가
    if (user?.email) {
      headers["X-User-Email"] = user.email;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    this.setStoredUser(result.user);
    return result;
  }

  async register(email: string, password: string) {
    const result = await this.request<{ user: User }>("/auth/register", {
      method: "POST",
      body: { email, password },
    });
    this.setStoredUser(result.user);
    return result;
  }

  async logout() {
    this.setStoredUser(null);
    return { message: "Logged out" };
  }

  async me() {
    const user = this.getStoredUser();
    if (!user) {
      throw new Error("인증이 필요합니다");
    }
    return { user };
  }

  // Sites
  async getSites() {
    return this.request<any[]>("/sites");
  }

  async getSite(id: string) {
    return this.request<any>(`/sites/${id}`);
  }

  async createSite(data: { name: string; address?: string; description?: string }) {
    return this.request("/sites", { method: "POST", body: data });
  }

  async deleteSite(id: string) {
    return this.request(`/sites/${id}`, { method: "DELETE" });
  }

  // Cameras
  async getCameras() {
    return this.request<any[]>("/cameras");
  }

  async addCamera(data: any) {
    return this.request("/cameras", { method: "POST", body: data });
  }

  async deleteCamera(id: string) {
    return this.request(`/cameras/${id}`, { method: "DELETE" });
  }

  // Discovery
  async scanCameras(timeout: number = 5000) {
    return this.request<{ cameras: any[]; count: number; message: string }>("/discovery/scan", {
      method: "POST",
      body: { timeout },
    });
  }

  async connectCamera(
    ipAddress: string,
    username: string,
    password: string,
    port: number = 80,
    protocol: "auto" | "ONVIF" | "HIKVISION_ISAPI" = "auto"
  ) {
    return this.request<{
      success: boolean;
      ipAddress: string;
      protocol: string;
      snapshotUrl: string | null;
      rtspUrl: string | null;
      profileToken?: string;
      error?: string;
    }>("/discovery/connect", {
      method: "POST",
      body: { ipAddress, username, password, port, protocol },
    });
  }

  // Motion Detection
  async getMotionDetection(cameraId: string, username?: string, password?: string) {
    const params = new URLSearchParams();
    if (username) params.append("username", username);
    if (password) params.append("password", password);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ enabled: boolean; sensitivity: number; grid: boolean[][]; supported?: boolean }>(
      `/motion-detection/${cameraId}${query}`
    );
  }

  async setMotionDetection(
    cameraId: string,
    grid: boolean[][],
    sensitivity: number = 50,
    enabled: boolean = true
  ) {
    return this.request<{ success: boolean; message: string }>(
      `/motion-detection/${cameraId}`,
      {
        method: "PUT",
        body: { enabled, sensitivity, grid },
      }
    );
  }

  // Alarms
  async getAlarms(params?: Record<string, any>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<{ alarms: any[]; total: number }>(`/alarms${query}`);
  }

  async getAlarm(id: string) {
    return this.request<any>(`/alarms/${id}`);
  }

  async updateAlarmStatus(id: string, status: string) {
    return this.request(`/alarms/${id}/status`, { method: "PUT", body: { status } });
  }

  async getAlarmStats(params?: Record<string, any>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<any>(`/alarms/stats/summary${query}`);
  }

  // Reports
  async createReport(data: {
    alarmIds: string[];
    createdBy?: string;
    attentionOf?: string;
    authorizedBy?: string;
    incidentType?: string;
    incidentSubCategory?: string;
    policeReference?: string;
    notes?: string;
  }) {
    return this.request<any>("/reports", { method: "POST", body: data });
  }
}

export const api = new ApiClient();
