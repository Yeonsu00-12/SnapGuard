import { api } from "@/lib/api";
import { useAddSiteStore } from "@/stores/useAddSiteStore";
import { useEffect } from "react";

export function useAddSiteWizard(
    isOpen: boolean,
    onSuccess: (site: any) => void,
    onClose: () => void
) {
    const store = useAddSiteStore();

    // 초기화
    useEffect(() => {
        if (isOpen) {
            loadExistingSites();
        } else {
            store.reset();
        }
    }, [isOpen]);

    useEffect(() => {
        if (store.existingSites.length === 0) {
            store.setIsNewSite(true);
        }
    }, [store.existingSites]);

    // 기존 매장 목록 불러오기
    const loadExistingSites = async () => {
        store.setLoadingSites(true);
        try {
            const sites = await api.getSites();
            store.setExistingSites(sites.map(s => ({
                id: s.id,
                name: s.name,
                address: s.address,
            })));
        } catch (err) {
            console.error("Failed to load sites:", err);
        } finally {
            store.setLoadingSites(false);
        }
    };

    const scanCameras = async () => {
        store.setScanning(true);
        store.setError("");
        try {
            const result = await api.scanCameras(5000);
            store.setScannedCameras(result.cameras || []);
            if (result.cameras?.length === 0) {
                store.setError("발견된 CCTV가 없습니다. 같은 네트워크에 연결되어 있는지 확인해주세요.");
            }
        } catch (err) {
            store.setError("CCTV 스캔 중 오류가 발생했습니다.");
            console.error(err);
        } finally {
            store.setScanning(false);
            store.setStep(3);
        }
    };

    const testConnections = async () => {
        store.setConnecting(true);
        store.resetConnectionState();

        for (const ip of store.selectedCameras) {
            store.setCurrentConnectingIp(ip);
            const creds = store.getCredentials(ip);
            const camera = store.scannedCameras.find((c) => c.ipAddress === ip);

            try {
                const result = await api.connectCamera(
                    ip,
                    creds.username,
                    creds.password,
                    camera?.port || 80
                );

                if (result.success) {
                    store.setConnectedCamera(ip, {
                        ipAddress: ip,
                        protocol: result.protocol,
                        snapshotUrl: result.snapshotUrl,
                        rtspUrl: result.rtspUrl,
                    });
                } else {
                    store.setConnectionError(ip, result.error || "연결 실패");
                }
            } catch (err: any) {
                store.setConnectionError(ip, err.message || "연결 중 오류 발생");
            }
        }

        store.setCurrentConnectingIp("");
        store.setConnecting(false);
    };

    const handleComplete = async () => {
        if (store.connectedCameras.size === 0) {
            store.setError("연결된 CCTV가 없습니다.");
            return;
        }

        store.setSaving(true);
        store.setError("");

        try {
            let siteId: string;
            let siteNameForToast: string;

            if (store.isNewSite) {
                const fullAddress = store.detailAddress
                    ? `${store.siteAddress} ${store.detailAddress}`
                    : store.siteAddress;
                const site = await api.createSite({
                    name: store.siteName,
                    address: fullAddress || undefined,
                });
                siteId = (site as any).id;
                siteNameForToast = store.siteName;
            } else {
                siteId = store.selectedSiteId;
                const selectedSite = store.existingSites.find((s) => s.id === store.selectedSiteId);
                siteNameForToast = selectedSite?.name || "매장";
            }

            const connectedEntries = Array.from(store.connectedCameras.entries());
            for (const [ip, connected] of connectedEntries) {
                const scannedCamera = store.scannedCameras.find((c) => c.ipAddress === ip);
                const creds = store.getCredentials(ip);
                const customName = store.cameraNames.get(ip);
                const cameraName = customName?.trim() || scannedCamera?.model || `CCTV ${ip}`;

                await api.addCamera({
                    siteId,
                    name: cameraName,
                    ipAddress: ip,
                    port: scannedCamera?.port || 80,
                    protocol: connected.protocol,
                    username: creds.username,
                    password: creds.password,
                    rtspMainStream: connected.rtspUrl || undefined,
                    macAddress: scannedCamera?.macAddress,
                    serialNumber: scannedCamera?.serialNumber,
                });
            }

            store.showToast(
                `'${siteNameForToast}'에 ${store.connectedCameras.size}대 CCTV가 추가되었습니다.`
            );

            window.dispatchEvent(new CustomEvent("site-updated"));

            const resultSite = store.isNewSite
                ? { id: siteId, name: store.siteName }
                : store.existingSites.find((s) => s.id === store.selectedSiteId);

            onSuccess(resultSite);
            onClose();
        } catch (err) {
            store.setError("CCTV 추가 중 오류가 발생했습니다.");
            console.error(err);
        } finally {
            store.setSaving(false);
            store.setConfiguringDetection(false);
        }
    };

    const handleNextStep = async () => {
        if (store.step === 1) {
            if (!store.isNewSite) {
                if (!store.selectedSiteId) {
                    store.setError("매장을 선택해주세요.");
                    return;
                }
            } else {
                if (!store.siteName.trim()) {
                    store.setError("매장 이름을 입력해주세요.");
                    return;
                }
            }
            store.setError("");
            store.setStep(2);
            await scanCameras();
        }
    };

    // Step별 진행 로직도 추가
    const handleStep3Next = async () => {
        if (store.selectedCameras.length === 0) {
            store.setError("CCTV를 최소 1개 이상 선택해주세요.");
            return;
        }
        const hasEmptyPassword = store.selectedCameras.some((ip) => {
            const creds = store.getCredentials(ip);
            return !creds.password;
        });
        if (hasEmptyPassword) {
            store.setError("선택한 CCTV의 비밀번호를 입력해주세요.");
            return;
        }
        store.setError("");
        store.setStep(4);
        await testConnections();
    };

    const handleStep4Next = () => {
        if (store.connectedCameras.size === 0) {
            store.setError("연결된 CCTV가 없습니다. 인증정보를 확인해주세요.");
            return;
        }
        store.setError("");
        store.setCurrentCameraIndex(0);
        store.setStep(5);
    };

    return {
        ...store,
        loadExistingSites,
        scanCameras,
        testConnections,
        handleComplete,
        handleStep1Next: handleNextStep,
        handleStep3Next,
        handleStep4Next
    }
}

