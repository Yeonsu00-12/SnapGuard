import { Cam } from "onvif";
import logger from "../utils/logger";

/**
 * ============================================================
 * ONVIF 서비스
 * ============================================================
 *
 * ONVIF(Open Network Video Interface Forum)는 IP 카메라의 표준 프로토콜
 * 제조사(Hikvision, Dahua, Axis, UNIVIEW 등)에 관계없이 동일한 방식으로 통신 가능
 *
 * 주요 기능:
 * 1. getStreamUrl()   - RTSP 스트리밍 URL 획득
 * 2. getSnapshotUrl() - 스냅샷 이미지 URL 획득
 *
 * ONVIF 연결 흐름:
 * 1. new Cam() 으로 카메라에 연결 (인증 포함)
 * 2. cam.profiles 에서 사용 가능한 프로파일 목록 획득
 *    - 프로파일: 해상도, 코덱, 비트레이트 등의 설정 묶음
 *    - 보통 Main(고화질), Sub(저화질) 프로파일 존재
 * 3. profileToken을 사용하여 RTSP URL 또는 Snapshot URL 요청
 */
export class OnvifService {
  /**
   * ONVIF 카메라에서 RTSP 스트리밍 URL 획득
   *
   * @param hostname - 카메라 IP 주소 (예: "192.168.1.100")
   * @param port     - ONVIF 포트 (기본값: 80, 일부 카메라는 8080)
   * @param username - 카메라 관리자 계정
   * @param password - 카메라 관리자 비밀번호
   *
   * @returns RTSP URL과 프로파일 토큰, 실패 시 null
   *
   * @example
   * const result = await OnvifService.getStreamUrl("192.168.1.100", 80, "admin", "password");
   * // result = {
   * //   rtspUrl: "rtsp://192.168.1.100:554/Streaming/Channels/101",
   * //   profileToken: "Profile_1"
   * // }
   */
  static async getStreamUrl(
    hostname: string,
    port: number = 80,
    username: string,
    password: string
  ): Promise<{ rtspUrl: string; profileToken: string } | null> {
    // 이전 인증 실패가 많으면 건너뛰기 (카메라 잠금 방지)
    // if (shouldSkipOnvif(hostname)) {
    //   logger.warn(`[ONVIF] Skipping ${hostname} - too many previous auth failures`);
    //   return null;
    // }

    return new Promise((resolve) => {
      // Step 1: ONVIF 카메라에 연결
      const cam = new Cam(
        {
          hostname,
          port,
          username,
          password,
          timeout: 10000, // 10초 타임아웃
        },
        (err) => {
          // 연결 실패 처리
          if (err) {
            logger.error(`ONVIF connection failed: ${err.message}`);

            resolve(null);
            return;
          }

          // Step 2: 프로파일 목록 확인
          const profiles = cam.profiles;
          console.log("ONVIF profiles 사용 가능한 프로파일 :", profiles);

          // 첫 번째 프로파일 사용 (보통 Main 프로파일 = 고화질)
          const profile = cam.profiles?.[0];
          if (!profile) {
            logger.warn("No ONVIF profiles found");
            resolve(null);
            return;
          }

          // Step 3: RTSP URL 요청
          cam.getStreamUri(
            { protocol: "RTSP", profileToken: profile.token },
            (err, stream) => {
              if (err) {
                logger.error(`getStreamUri failed: ${err.message}`);
                resolve(null);
                return;
              }

              // 성공: RTSP URL 반환
              // 예: rtsp://192.168.1.100:554/Streaming/Channels/101
              logger.info(`ONVIF RTSP URL obtained: ${stream.uri}`);
              resolve({
                rtspUrl: stream.uri,
                profileToken: profile.token,
              });
            }
          );
        }
      );
    });
  }

  /**
   * ONVIF 카메라에서 스냅샷 URL 획득
   *
   * 스냅샷 URL은 HTTP GET 요청으로 JPEG 이미지를 받을 수 있는 주소
   * RTSP에서 프레임을 캡처하는 것보다 빠르고 효율적
   *
   * @param hostname - 카메라 IP 주소
   * @param port     - ONVIF 포트 (기본값: 80)
   * @param username - 카메라 관리자 계정
   * @param password - 카메라 관리자 비밀번호
   *
   * @returns 스냅샷 URL (예: "http://192.168.1.100/onvif-http/snapshot?...")
   *
   * @example
   * const snapshotUrl = await OnvifService.getSnapshotUrl("192.168.1.100", 80, "admin", "password");
   * // HTTP GET 요청으로 이미지 다운로드:
   * // curl --digest -u admin:password "http://192.168.1.100/onvif-http/snapshot?Profile_1"
   *
   * 주의: 일부 카메라는 스냅샷 URL에 접근할 때도 Digest 인증 필요
   */
  static async getSnapshotUrl(
    hostname: string,
    port: number = 80,
    username: string,
    password: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      // Step 1: ONVIF 카메라에 연결
      const cam = new Cam(
        {
          hostname,
          port,
          username,
          password,
          timeout: 10000,
        },
        (err) => {
          if (err) {
            logger.error(`ONVIF connection failed: ${err.message}`);

            resolve(null);
            return;
          }

          // Step 2: 프로파일 확인
          const profiles = cam.profiles;
          console.log("ONVIF profiles 사용 가능한 프로파일 :", profiles);

          const profile = cam.profiles?.[0];
          if (!profile) {
            logger.warn("No ONVIF profiles found");
            resolve(null);
            return;
          }

          // 디버깅: 실제로 어떤 토큰을 보내는지 확인
          const tokenToSend = profile.token || profile.$?.token;
          logger.info(`[ONVIF Snapshot] Using profile token: "${tokenToSend}" (raw profile.$: ${JSON.stringify(profile.$)})`);

          // Step 3: 스냅샷 URL 요청
          cam.getSnapshotUri({ profileToken: tokenToSend }, (err, snapshot) => {
            if (err) {
              logger.error(`getSnapshotUri failed: ${err.message}`);
              resolve(null);
              return;
            }

            // 성공: 스냅샷 URL 반환
            // 예: http://192.168.1.100/onvif-http/snapshot?auth=xxx
            logger.info(`ONVIF Snapshot URL obtained: ${snapshot.uri}`);
            resolve(snapshot.uri);
          });
        }
      );
    });
  }
}
