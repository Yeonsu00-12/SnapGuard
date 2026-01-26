import { create } from "zustand";

interface AddSiteState {
  // Step 1: 매장 정보
  isNewSite: boolean;
  siteName: string;
  siteAddress: string;
  detailAddress: string;
  selectedSiteId: string;
  showPostcode: boolean;
  existingSites: ExistingSite[];
  loadingSites: boolean;

  // Step 3: CCTV 선택 + 인증정보
  scannedCameras: ScannedCamera[];
  selectedCameras: string[];
  cameraCredentials: Map<string, CameraCredentials>;
  defaultUsername: string;
  defaultPassword: string;
  cameraNames: Map<string, string>;

  // Step 4: 연결 테스트
  connecting: boolean;
  connectedCameras: Map<string, ConnectedCamera>;
  connectionErrors: Map<string, string>;
  currentConnectingIp: string;

  // Step 5: 감지 영역 설정
  currentCameraIndex: number;
  detectionGrids: Map<string, boolean[][]>;
  sensitivities: Map<string, number>;
  configuringDetection: boolean;

  // 공통
  step: number;
  scanning: boolean;
  saving: boolean;
  error: string;
  toast: string;

  // Actions - Step 1
  setIsNewSite: (value: boolean) => void;
  setSiteName: (name: string) => void;
  setSiteAddress: (address: string) => void;
  setDetailAddress: (address: string) => void;
  setSelectedSiteId: (id: string) => void;
  setShowPostcode: (show: boolean) => void;
  setExistingSites: (sites: ExistingSite[]) => void;
  setLoadingSites: (loading: boolean) => void;

  // Actions - Step 3
  setScannedCameras: (cameras: ScannedCamera[]) => void;
  setSelectedCameras: (cameras: string[]) => void;
  toggleCamera: (ip: string) => void;
  setCredential: (ip: string, field: keyof CameraCredentials, value: string) => void;
  setDefaultUsername: (username: string) => void;
  setDefaultPassword: (password: string) => void;
  setCameraName: (ip: string, name: string) => void;
  getCredentials: (ip: string) => CameraCredentials;

  // Actions - Step 4
  setConnecting: (connecting: boolean) => void;
  setConnectedCamera: (ip: string, camera: ConnectedCamera) => void;
  setConnectionError: (ip: string, error: string) => void;
  setCurrentConnectingIp: (ip: string) => void;
  resetConnectionState: () => void;

  // Actions - Step 5
  setCurrentCameraIndex: (index: number) => void;
  setDetectionGrid: (ip: string, grid: boolean[][]) => void;
  setSensitivity: (ip: string, sensitivity: number) => void;
  setConfiguringDetection: (configuring: boolean) => void;

  // Actions - 공통
  setStep: (step: number) => void;
  setScanning: (scanning: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string) => void;
  showToast: (message: string) => void;
  reset: () => void;
}

const initialState = {
  // Step 1
  isNewSite: true,
  siteName: "",
  siteAddress: "",
  detailAddress: "",
  selectedSiteId: "",
  showPostcode: false,
  existingSites: [] as ExistingSite[],
  loadingSites: false,

  // Step 3
  scannedCameras: [] as ScannedCamera[],
  selectedCameras: [] as string[],
  cameraCredentials: new Map<string, CameraCredentials>(),
  defaultUsername: "admin",
  defaultPassword: "",
  cameraNames: new Map<string, string>(),

  // Step 4
  connecting: false,
  connectedCameras: new Map<string, ConnectedCamera>(),
  connectionErrors: new Map<string, string>(),
  currentConnectingIp: "",

  // Step 5
  currentCameraIndex: 0,
  detectionGrids: new Map<string, boolean[][]>(),
  sensitivities: new Map<string, number>(),
  configuringDetection: false,

  // 공통
  step: 1,
  scanning: false,
  saving: false,
  error: "",
  toast: "",
};

export const useAddSiteStore = create<AddSiteState>((set, get) => ({
  ...initialState,

  // Actions - Step 1
  setIsNewSite: (value) => set({ isNewSite: value }),
  setSiteName: (name) => set({ siteName: name }),
  setSiteAddress: (address) => set({ siteAddress: address }),
  setDetailAddress: (address) => set({ detailAddress: address }),
  setSelectedSiteId: (id) => set({ selectedSiteId: id }),
  setShowPostcode: (show) => set({ showPostcode: show }),
  setExistingSites: (sites) => set({ existingSites: sites }),
  setLoadingSites: (loading) => set({ loadingSites: loading }),

  // Actions - Step 3
  setScannedCameras: (cameras) => set({ scannedCameras: cameras }),
  setSelectedCameras: (cameras) => set({ selectedCameras: cameras }),
  toggleCamera: (ip) => {
    const { selectedCameras } = get();
    set({
      selectedCameras: selectedCameras.includes(ip)
        ? selectedCameras.filter((i) => i !== ip)
        : [...selectedCameras, ip],
    });
  },
  setCredential: (ip, field, value) => {
    const { cameraCredentials, defaultUsername, defaultPassword } = get();
    const newMap = new Map(cameraCredentials);
    const current = newMap.get(ip) || { username: defaultUsername, password: defaultPassword };
    newMap.set(ip, { ...current, [field]: value });
    set({ cameraCredentials: newMap });
  },
  setDefaultUsername: (username) => set({ defaultUsername: username }),
  setDefaultPassword: (password) => set({ defaultPassword: password }),
  setCameraName: (ip, name) => {
    const { cameraNames } = get();
    const newMap = new Map(cameraNames);
    newMap.set(ip, name);
    set({ cameraNames: newMap });
  },
  getCredentials: (ip) => {
    const { cameraCredentials, defaultUsername, defaultPassword } = get();
    return cameraCredentials.get(ip) || { username: defaultUsername, password: defaultPassword };
  },

  // Actions - Step 4
  setConnecting: (connecting) => set({ connecting }),
  setConnectedCamera: (ip, camera) => {
    const { connectedCameras } = get();
    const newMap = new Map(connectedCameras);
    newMap.set(ip, camera);
    set({ connectedCameras: newMap });
  },
  setConnectionError: (ip, error) => {
    const { connectionErrors } = get();
    const newMap = new Map(connectionErrors);
    newMap.set(ip, error);
    set({ connectionErrors: newMap });
  },
  setCurrentConnectingIp: (ip) => set({ currentConnectingIp: ip }),
  resetConnectionState: () => {
    set({
      connectedCameras: new Map(),
      connectionErrors: new Map(),
    });
  },

  // Actions - Step 5
  setCurrentCameraIndex: (index) => set({ currentCameraIndex: index }),
  setDetectionGrid: (ip, grid) => {
    const { detectionGrids } = get();
    const newMap = new Map(detectionGrids);
    newMap.set(ip, grid);
    set({ detectionGrids: newMap });
  },
  setSensitivity: (ip, sensitivity) => {
    const { sensitivities } = get();
    const newMap = new Map(sensitivities);
    newMap.set(ip, sensitivity);
    set({ sensitivities: newMap });
  },
  setConfiguringDetection: (configuring) => set({ configuringDetection: configuring }),

  // Actions - 공통
  setStep: (step) => set({ step }),
  setScanning: (scanning) => set({ scanning }),
  setSaving: (saving) => set({ saving }),
  setError: (error) => set({ error }),
  showToast: (message) => {
    set({ toast: message });
    setTimeout(() => set({ toast: "" }), 3000);
  },
  reset: () =>
    set({
      ...initialState,
      cameraCredentials: new Map(),
      cameraNames: new Map(),
      connectedCameras: new Map(),
      connectionErrors: new Map(),
      detectionGrids: new Map(),
      sensitivities: new Map(),
    }),
}));
