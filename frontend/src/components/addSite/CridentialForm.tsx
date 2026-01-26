export default function CridentialForm({ cameraNames, cam, setCameraName, creds, setCredential }: { cameraNames: Map<string, string>, cam: ScannedCamera, setCameraName: (ip: string, name: string) => void, creds: CameraCredentials, setCredential: (ip: string, field: keyof CameraCredentials, value: string) => void }) {
    return (
        <div className="px-4 pb-4 space-y-2">
            {/* 카메라 이름 */}
            <input
                type="text"
                value={cameraNames.get(cam.ipAddress) || ""}
                onChange={(e) => setCameraName(cam.ipAddress, e.target.value)}
                placeholder={`카메라 이름 (예: ${cam.model || "입구 카메라"})`}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
            />
            {/* 인증정보 */}
            <div className="grid grid-cols-2 gap-2">
                <input
                    type="text"
                    value={creds.username}
                    onChange={(e) => setCredential(cam.ipAddress, "username", e.target.value)}
                    placeholder="사용자명"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                />
                <input
                    type="password"
                    value={creds.password}
                    onChange={(e) => setCredential(cam.ipAddress, "password", e.target.value)}
                    placeholder="비밀번호"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                />
            </div>
        </div>
    )
}