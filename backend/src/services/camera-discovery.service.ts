import * as dgram from "dgram";
import * as crypto from "crypto";
import logger from "../utils/logger";

/** ONVIF WS-Discovery 멀티캐스트 주소 */
const WS_DISCOVERY_MULTICAST_IP = "239.255.255.250";
const WS_DISCOVERY_PORT = 3702;

/** WS-Discovery Probe XML 생성 */
const getWsDiscoveryProbeXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
    <e:Header>
        <w:MessageID>uuid:${crypto.randomUUID()}</w:MessageID>
        <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
        <w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
    </e:Header>
    <e:Body>
        <d:Probe>
            <d:Types>dn:NetworkVideoTransmitter</d:Types>
        </d:Probe>
    </e:Body>
</e:Envelope>`;

/** 발견된 카메라 정보 */
export interface DiscoveredCamera {
  ip: string;
  port?: number;
  mac?: string;
  brand?: string;
  model?: string;
}

/**
 * 카메라 발견 서비스
 * - WS-Discovery (ONVIF) 기반 카메라 탐색
 * - 멀티캐스트 Probe로 네트워크 내 ONVIF 카메라 자동 발견
 */
export class CameraDiscoveryService {
  /**
   * ONVIF WS-Discovery로 카메라 발견
   * - 멀티캐스트 Probe 전송 후 ProbeMatch 응답 수집
   * - MAC, Brand, Model 정보는 Scopes에서 추출
   */
  static discover(timeout: number = 5000): Promise<DiscoveredCamera[]> {
    return new Promise((resolve) => {
      logger.info("[WS-Discovery] Starting...");

      const devices = new Map<string, DiscoveredCamera>();
      const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

      socket.on("message", async (msg, rinfo) => {
        const msgStr = msg.toString();

        // ProbeMatch 응답만 처리 (자신의 Probe 제외)
        if (!msgStr.includes("ProbeMatch") || msgStr.includes("<d:Probe>")) {
          return;
        }

        // Scopes에서 정보 추출
        const scopesMatch = msgStr.match(/<(?:\w+:)?Scopes>([^<]+)<\/(?:\w+:)?Scopes>/);
        const scopes = scopesMatch ? scopesMatch[1] : "";

        // Brand 추출
        let brand: string | undefined;
        const manufacturerMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/manufacturer\/([^\s]+)/);
        if (manufacturerMatch) {
          brand = decodeURIComponent(manufacturerMatch[1]).replace(/%20/g, " ");
        } else {
          const nameMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/name\/([^\s]+)/);
          if (nameMatch) {
            brand = decodeURIComponent(nameMatch[1]).split(/[\s%]/)[0];
          }
        }

        // Model 추출
        let model: string | undefined;
        const hardwareMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/hardware\/([^\s]+)/);
        if (hardwareMatch) {
          model = decodeURIComponent(hardwareMatch[1]);
        }

        // MAC 추출
        let mac: string | undefined;
        const macMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/(?:MAC|macaddress|macaddr)\/([^\s]+)/i);
        if (macMatch) {
          mac = macMatch[1].replace(/:/g, "").toUpperCase();
        }

        // XAddrs에서 IP/Port 추출
        const xaddrsMatch = msgStr.match(/<(?:\w+:)?XAddrs>([^<]+)<\/(?:\w+:)?XAddrs>/);
        let deviceIp = rinfo.address;
        let port = 80;

        if (xaddrsMatch) {
          const urls = xaddrsMatch[1].split(/\s+/);
          for (const url of urls) {
            const urlMatch = url.match(/http:\/\/(\d+\.\d+\.\d+\.\d+)(?::(\d+))?/);
            // IPv4만, link-local 제외
            if (urlMatch && !urlMatch[1].startsWith("169.254") && !urlMatch[1].startsWith("0.")) {
              deviceIp = urlMatch[1];
              port = urlMatch[2] ? parseInt(urlMatch[2], 10) : 80;
              break;
            }
          }
        }

        if (!devices.has(deviceIp)) {
          devices.set(deviceIp, { ip: deviceIp, port, brand, model, mac });
          logger.debug(`[WS-Discovery] Found: ${deviceIp} (${brand || "?"} ${model || "?"})`);
        }
      });

      socket.on("error", (err) => {
        logger.error("[WS-Discovery] Socket error:", err);
      });

      // 랜덤 포트에 바인딩
      socket.bind(0, () => {
        try {
          // 브로드캐스트 및 멀티캐스트 설정
          socket.setBroadcast(true);
          // 멀티캐스트 그룹 가입
          socket.setMulticastTTL(5);
          socket.addMembership(WS_DISCOVERY_MULTICAST_IP);
        } catch (e) {
          logger.warn(`[WS-Discovery] Multicast setup warning: ${e}`);
        }

        // Probe 전송
        const message = Buffer.from(getWsDiscoveryProbeXml());
        socket.send(message, 0, message.length, WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST_IP, (err) => {
          if (err) {
            logger.error(`[WS-Discovery] Send error: ${err}`);
          } else {
            logger.info(`[WS-Discovery] Probe sent`);
          }
        });
      });

      // 타임아웃 후 결과 반환
      setTimeout(async () => {
        socket.close();
        const cameras = Array.from(devices.values());
        logger.info(`[WS-Discovery] Checking ARP for cameras without MAC addresses...`);

        // MAC 주소가 없는 카메라에 대해 ARP 테이블 조회
        for (const camera of cameras) {
          if (!camera.mac) {
            const mac = await this.getMacFormArp(camera.ip);
            if (mac) {
              camera.mac = mac;
              logger.info(`[ARP] Found MAC for ${camera.ip} -> ${mac}`);
            }
          }
        }
        const generalCamera = cameras.filter(cam => cam.brand === "General");
        if (generalCamera.length > 0) {
          logger.info(`[WS-Discovery] Detected ${generalCamera.length} General/Dahua cameras`);
          generalCamera.forEach(cam => {
            cam.brand = "Dahua";
            logger.debug(`[Brand] ${cam.ip} brand set to Dahua`);
          });
        }

        const result = Array.from(devices.values());
        logger.info(`[WS-Discovery] Found ${result.length} cameras`);
        resolve(result);
      }, timeout);
    });
  }

  /**
     * ARP 테이블에서 MAC 주소 조회
  */
  private static async getMacFormArp(ip: string): Promise<string | null> {
    try {
      // child_Process: OS 쉘(command line)을 실행하는 것. 시스템 명령어 실행 가능.
      const { exec } = require('child_process');
      // callback 기반 exec 함수를 Promise 기반으로 변환
      const { promisify } = require('util');
      // 마치 터미널에서 명령어 실행하는 것처럼 사용
      const execAsync = promisify(exec);

      // ARP 조회 전 ping으로 ARP 캐시 생성 시도
      await execAsync(`ping -c 1 -W 1 ${ip}`);
      // ARP 테이블에서 MAC 주소 조회 / 쉘 명령어 실행
      const { stdout } = await execAsync(`arp -n ${ip}`);

      // 출력에서 MAC 주소 추출
      const macMatch = stdout.match(/(([a-fA-F0-9]{1,2}[:-]){5}[a-fA-F0-9]{1,2})/);
      if (macMatch) {
        const mac = macMatch[0].toUpperCase().replace(/[:-]/g, "");
        logger.info(`[ARP] Found MAC for ${ip} -> ${mac}`);
        return mac;
      }
    } catch (err) {
      logger.warn(`[ARP] Failed to get MAC for ${ip}: ${err}`);
    }
    return null;
  }
}
