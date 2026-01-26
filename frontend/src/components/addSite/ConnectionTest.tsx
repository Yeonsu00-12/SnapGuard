import ConnectedCamera from "./ConnectCamera";

export default function ConnectionTest({ wizard }: { wizard: any }) {
    const {
        connecting,
        currentConnectingIp,
        connectedCameras,
        selectedCameras,
        scannedCameras,
        connectionErrors,
        cameraNames,
        testConnections,
    } = wizard;

    return (
        <ConnectedCamera
            connecting={connecting}
            currentConnectingIp={currentConnectingIp}
            connectedCameras={connectedCameras}
            selectedCameras={selectedCameras}
            scannedCameras={scannedCameras}
            connectionErrors={connectionErrors}
            cameraNames={cameraNames}
            testConnections={testConnections}
        />
    );
}