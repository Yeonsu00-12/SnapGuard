import DigestFetch from "digest-fetch";
import logger from "../utils/logger";

/**
 * ============================================================
 * Dahua 카메라 모션 감지 서비스
 * ============================================================
 *
 * Dahua CGI API를 사용하여 모션 감지 영역 설정
 *
 * API 구조:
 * - 조회: GET /cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect
 * - 설정: GET /cgi-bin/configManager.cgi?action=setConfig&MotionDetect[0].Enable=true&...
 *
 * 인증: HTTP Digest Authentication (digest-fetch 사용)
 *
 * Region 형식:
 * - 폴리곤 좌표 (0-8191 범위)
 * - 예: "0,0,8191,0,8191,8191,0,8191" (전체 영역)
 */
export class DahuaDetectionService {
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
        threshold: number;
        regions: string[];
    } | null> {
        const url = `http://${ipAddress}/cgi-bin/configManager.cgi?action=getConfig&name=MotionDetect`;

        try {
            const client = new DigestFetch(username, password);
            const response = await client.fetch(url, { method: "GET" });

            if (!response.ok) {
                logger.warn(`[Dahua] HTTP ${response.status} from ${url}`);
                return null;
            }

            const text = await response.text();
            logger.debug(`[Dahua] Motion detection response: ${text.substring(0, 500)}`);

            // 응답 파싱
            // 예: MotionDetect[0].Enable=true
            //     MotionDetect[0].MotionDetectWindow[0].Sensitive=6
            const enabled = text.includes("Enable=true");

            const sensitiveMatch = text.match(/Sensitive=(\d+)/);
            const sensitivity = sensitiveMatch ? parseInt(sensitiveMatch[1]) : 6;

            const thresholdMatch = text.match(/Threshold=(\d+)/);
            const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 10;

            // Region 추출 (여러 개 가능)
            const regions: string[] = [];
            const regionMatches = text.matchAll(/Region\[(\d+)\]=([^\r\n]+)/g);
            for (const match of regionMatches) {
                regions.push(match[2]);
            }

            return { enabled, sensitivity, threshold, regions };
        } catch (error) {
            logger.error(`[Dahua] Failed to get motion detection: ${error}`);
            return null;
        }
    }

    /**
     * 모션 감지 설정 변경
     *
     * @param regions - 폴리곤 좌표 배열 (0-8191 범위)
     *                  예: ["0,0,4095,0,4095,4095,0,4095"] (좌측 절반)
     */
    static async setMotionDetection(
        ipAddress: string,
        username: string,
        password: string,
        enabled: boolean,
        sensitivity: number = 6,
        threshold: number = 10,
        regions: string[] = ["0,0,8191,0,8191,8191,0,8191"] // 기본값: 전체 영역
    ): Promise<{ success: boolean; message: string }> {
        // 설정 파라미터 구성
        const params = [
            `MotionDetect[0].Enable=${enabled}`,
            `MotionDetect[0].EventHandler.Dejitter=1`,
        ];

        // 각 Region 설정
        regions.forEach((region, index) => {
            params.push(
                `MotionDetect[0].MotionDetectWindow[${index}].Name=Region${index + 1}`,
                `MotionDetect[0].MotionDetectWindow[${index}].Region=${region}`,
                `MotionDetect[0].MotionDetectWindow[${index}].Sensitive=${sensitivity}`,
                `MotionDetect[0].MotionDetectWindow[${index}].Threshold=${threshold}`
            );
        });

        const url = `http://${ipAddress}/cgi-bin/configManager.cgi?action=setConfig&${params.join("&")}`;

        try {
            const client = new DigestFetch(username, password);
            const response = await client.fetch(url, { method: "GET" });

            const text = await response.text();
            logger.info(`[Dahua] Set motion detection response: ${text}`);

            // Dahua는 성공 시 "OK" 반환
            if (text.includes("OK")) {
                return { success: true, message: "Motion detection configured" };
            }

            return { success: false, message: text.trim() || "Unknown error" };
        } catch (error: any) {
            logger.error(`[Dahua] Failed to set motion detection: ${error}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * 그리드(boolean[][])를 Dahua Region 좌표로 변환
     *
     * Dahua는 폴리곤 좌표 방식 (0-8191)
     * 그리드를 여러 개의 직사각형 Region으로 변환
     *
     * 간단한 구현: 활성화된 셀들의 bounding box를 하나의 Region으로
     */
    static gridToRegions(grid: boolean[][], rows: number = 15, cols: number = 22): string[] {
        // 활성화된 셀들의 bounding box 찾기
        let minRow = rows, maxRow = -1, minCol = cols, maxCol = -1;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (grid[row]?.[col]) {
                    minRow = Math.min(minRow, row);
                    maxRow = Math.max(maxRow, row);
                    minCol = Math.min(minCol, col);
                    maxCol = Math.max(maxCol, col);
                }
            }
        }

        // 활성화된 셀이 없으면 빈 배열 반환
        if (maxRow === -1) {
            return [];
        }

        // 그리드 좌표를 Dahua 좌표(0-8191)로 변환
        const cellWidth = 8192 / cols;
        const cellHeight = 8192 / rows;

        const x1 = Math.floor(minCol * cellWidth);
        const y1 = Math.floor(minRow * cellHeight);
        const x2 = Math.floor((maxCol + 1) * cellWidth) - 1;
        const y2 = Math.floor((maxRow + 1) * cellHeight) - 1;

        // 사각형 폴리곤: 좌상단, 우상단, 우하단, 좌하단
        const region = `${x1},${y1},${x2},${y1},${x2},${y2},${x1},${y2}`;

        return [region];
    }

    /**
     * Dahua Region 좌표를 그리드(boolean[][])로 변환
     */
    static regionsToGrid(regions: string[], rows: number = 15, cols: number = 22): boolean[][] {
        const grid: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));

        for (const region of regions) {
            const coords = region.split(",").map(Number);
            if (coords.length < 8) continue;

            // 첫 번째 점과 세 번째 점으로 bounding box 계산 (사각형 가정)
            const x1 = Math.min(coords[0], coords[4]);
            const y1 = Math.min(coords[1], coords[5]);
            const x2 = Math.max(coords[0], coords[4]);
            const y2 = Math.max(coords[1], coords[5]);

            // Dahua 좌표(0-8191)를 그리드 좌표로 변환
            const cellWidth = 8192 / cols;
            const cellHeight = 8192 / rows;

            const startCol = Math.floor(x1 / cellWidth);
            const endCol = Math.min(Math.ceil(x2 / cellWidth), cols - 1);
            const startRow = Math.floor(y1 / cellHeight);
            const endRow = Math.min(Math.ceil(y2 / cellHeight), rows - 1);

            // 해당 셀들 활성화
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    grid[row][col] = true;
                }
            }
        }

        return grid;
    }
}
