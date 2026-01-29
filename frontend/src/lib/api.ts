export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const SERVER_BASE = API_BASE.replace("/api", "");

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || "GET",
      headers,
      credentials: "include", // 세션 쿠키 포함
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  }

  // Generic HTTP methods
  async get<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint);
    return { data };
  }

  async post<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, { method: "POST", body });
    return { data };
  }

  async put<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, { method: "PUT", body });
    return { data };
  }

  async delete<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, { method: "DELETE" });
    return { data };
  }

  // Auth (세션 기반)
  async login(email: string, password: string) {
    return this.request<{ user: any }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  }

  async register(email: string, password: string) {
    return this.request<{ user: any }>("/auth/register", {
      method: "POST",
      body: { email, password },
    });
  }

  async logout() {
    return this.request("/auth/logout", { method: "POST" });
  }

  async me() {
    return this.request<{ user: { id: string; email: string } }>("/auth/me");
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

  // Discovery (WS-Discovery)
  async scanCameras(timeout: number = 5000) {
    return this.request<{ cameras: any[]; count: number; message: string }>("/discovery/scan", {
      method: "POST",
      body: { timeout },
    });
  }

  // Connect camera (ONVIF or Hikvision ISAPI)
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
