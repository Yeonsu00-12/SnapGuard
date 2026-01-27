declare module 'onvif' {
  export const Discovery: {
    probe: (options: { timeout: number }, callback: (err: Error | null, camInfos: any[]) => void) => void;
  };

  export class Cam {
    constructor(options: {
      hostname: string;
      port?: number;
      username: string;
      password: string;
      timeout?: number;
    }, callback: (err: Error | null) => void);

    getDeviceInformation(callback: (err: Error | null, info: any) => void): void;
    getStreamUri(options: { protocol: string; profileToken?: string }, callback: (err: Error | null, stream: any) => void): void;
    getSnapshotUri(options: { profileToken?: string }, callback: (err: Error | null, snapshot: any) => void): void;
    createPullPointSubscription(callback: (err: Error | null, subscription: any) => void): void;
    pullMessages(options: { timeout: number; messageLimit: number }, callback: (err: Error | null, events: any[]) => void): void;
    unsubscribe(subscription: any): Promise<void>;
    profiles: any[];
  }
}

declare module 'digest-fetch' {
  export default class DigestFetch {
    constructor(username: string, password: string);
    fetch(url: string, options?: RequestInit): Promise<Response>;
  }
}
