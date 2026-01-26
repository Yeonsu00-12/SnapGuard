import DigestFetch from "digest-fetch";
import logger from "../utils/logger";

/**
 * ============================================================
 * Hikvision 카메라 모션 감지 서비스
 * ============================================================
 *
 * Hikvision ISAPI를 사용하여 모션 감지 영역 설정
 *
 * API 구조:
 * - 조회: GET /ISAPI/System/Video/inputs/channels/1/motionDetection
 * - 설정: PUT /ISAPI/System/Video/inputs/channels/1/motionDetection
 *
 * 인증: HTTP Digest Authentication (digest-fetch 사용)
 *
 * Grid 형식:
 * - 15x22 그리드 (330 셀)
 * - gridMap: 16진수 문자열로 인코딩 (각 셀 = 1비트)
 */
export class HikvisionDetectionService {
  /**
   * 모션 감지 설정 조회
   */
  static async getMotionDetection(
    ipAddress: string,
    username: string,
    password: string
  ): Promise<{
    enabled: boolean;
    sensitivity: number;
    gridMap: string;
  } | null> {
    const url = `http://${ipAddress}/ISAPI/System/Video/inputs/channels/1/motionDetection`;

    try {
      const client = new DigestFetch(username, password);
      const response = await client.fetch(url, { method: "GET" });

      if (!response.ok) {
        logger.warn(`[Hikvision] HTTP ${response.status} from ${url}`);
        return null;
      }

      const text = await response.text();
      logger.debug(`[Hikvision] Motion detection response: ${text.substring(0, 500)}`);

      // XML 응답 파싱
      const enabledMatch = text.match(/<enabled>([^<]+)<\/enabled>/);
      const sensitivityMatch = text.match(/<sensitivityLevel>([^<]+)<\/sensitivityLevel>/);
      const gridMapMatch = text.match(/<gridMap>([^<]+)<\/gridMap>/);

      return {
        enabled: enabledMatch ? enabledMatch[1] === "true" : false,
        sensitivity: sensitivityMatch ? parseInt(sensitivityMatch[1]) : 50,
        gridMap: gridMapMatch ? gridMapMatch[1] : "",
      };
    } catch (error) {
      logger.error(`[Hikvision] Failed to get motion detection: ${error}`);
      return null;
    }
  }

  /**
   * 모션 감지 설정 변경
   *
   * @param gridMap - 15x22 그리드의 hex 인코딩 문자열
   * @param sensitivity - 감도 (0-100)
   */
  static async setMotionDetection(
    ipAddress: string,
    username: string,
    password: string,
    enabled: boolean,
    sensitivity: number = 50,
    gridMap: string = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff3f"
  ): Promise<{ success: boolean; message: string }> {
    const url = `http://${ipAddress}/ISAPI/System/Video/inputs/channels/1/motionDetection`;

    // XML 페이로드 생성
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MotionDetection version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <enabled>${enabled}</enabled>
  <enableHighlight>true</enableHighlight>
  <samplingInterval>2</samplingInterval>
  <startTriggerTime>500</startTriggerTime>
  <endTriggerTime>500</endTriggerTime>
  <regionType>grid</regionType>
  <Grid>
    <rowGranularity>15</rowGranularity>
    <columnGranularity>22</columnGranularity>
  </Grid>
  <MotionDetectionLayout version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
    <sensitivityLevel>${sensitivity}</sensitivityLevel>
    <layout>
      <gridMap>${gridMap}</gridMap>
    </layout>
  </MotionDetectionLayout>
</MotionDetection>`;

    try {
      const client = new DigestFetch(username, password);
      const response = await client.fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/xml" },
        body: xmlPayload,
      });

      const text = await response.text();
      logger.info(`[Hikvision] Set motion detection response: ${response.status}`);

      if (response.ok) {
        return { success: true, message: "Motion detection configured" };
      }

      return { success: false, message: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    } catch (error: any) {
      logger.error(`[Hikvision] Failed to set motion detection: ${error}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * 그리드(boolean[][])를 gridMap(hex)으로 변환
   *
   * 15x22 = 330비트 → 336비트로 패딩 (6비트 추가) → 84자 hex
   */
  static gridToGridMap(grid: boolean[][]): string {
    let bits = "";
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 22; col++) {
        bits += grid[row]?.[col] ? "1" : "0";
      }
    }
    bits += "000000"; // 336비트로 패딩

    let hexStr = "";
    for (let i = 0; i < bits.length; i += 4) {
      hexStr += parseInt(bits.substring(i, i + 4), 2).toString(16);
    }
    return hexStr;
  }

  /**
   * gridMap(hex)을 그리드(boolean[][])로 변환
   */
  static gridMapToGrid(gridMap: string): boolean[][] {
    let bits = "";
    for (const char of gridMap) {
      bits += parseInt(char, 16).toString(2).padStart(4, "0");
    }

    const grid: boolean[][] = [];
    for (let row = 0; row < 15; row++) {
      grid[row] = [];
      for (let col = 0; col < 22; col++) {
        grid[row][col] = bits[row * 22 + col] === "1";
      }
    }
    return grid;
  }
}
