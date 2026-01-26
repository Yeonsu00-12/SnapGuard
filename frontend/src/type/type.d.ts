interface Alarm {
  id: string;
  siteName: string;
  eventType: string;
  description?: string;
  detectionTime: string;
  severity: string;
  status: string;
  snapshotPath?: string;
  camera: {
    id: string;
    name: string;
    site?: {
      id: string;
      name: string;
    };
  };
}

interface DiscoveredCamera {
  ipAddress: string;
  macAddress?: string;
  deviceType?: string;
  serialNumber?: string;
  manufacturer?: string;
  snapshotUrl?: string | null;
  rtspUrl?: string;
}


interface Camera {
  id: string;
  name: string;
}

interface CameraDetails extends Camera {
  ipAddress: string;
  status: string;
  port?: number;
  protocol: string;
  macAddress?: string;
  serialNumber?: string;
  manufacturer?: string | null;
  model?: string | null;
  isOnline?: boolean;
  site?: { id: string; name: string } | null;
}

interface Site {
  id: string;
  name: string;
  address: string | null;
  description?: string | null;
  cameras?: CameraDetails[];
  _count?: { cameras: number };
}

interface AlarmEvent {
  id: string;
  eventType: string;
  severity: string;
  cameraName: string;
  siteName: string;
  detectionTime: string;
  snapshotUrl: string;
}

interface ScannedCamera {
  ipAddress: string;
  hostname?: string;
  macAddress?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  snapshotUrl?: string;
  port?: number;
}

interface CameraCredentials {
  username: string;
  password: string;
}

interface ConnectedCamera {
  ipAddress: string;
  protocol: string;
  snapshotUrl: string | null;
  rtspUrl: string | null;
}

interface ExistingSite {
  id: string;
  name: string;
  address: string | null;
}

interface AddSiteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (site: any) => void;
}