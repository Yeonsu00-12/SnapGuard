import { BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FilterTag({ selectedCamera, setSelectedCamera, cameras }: { selectedCamera: string | null; setSelectedCamera: (cameraId: string | null) => void; cameras: { id: string; name: string }[] }) {
    const route = useRouter();

    return (
        <div className="flex flex-row justify-between items-center">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedCamera(null)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition-all ${selectedCamera === null
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-400 hover:bg-gray-200"
                        }`}
                >
                    모든 카메라
                </button>
                {cameras.map((camera) => (
                    <button
                        key={camera.id}
                        onClick={() => setSelectedCamera(camera.id)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition-all ${selectedCamera === camera.id
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-400 hover:bg-gray-200"
                            }`}
                    >
                        {camera.name}
                    </button>
                ))}
            </div>
            {/* <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-600 cursor-pointer text-sm hover:bg-blue-200 transition-colors">
                <button onClick={() => route.push("/statistics")}>
                    <BarChart3 size={16} className="inline-block mr-1" />
                    통계
                </button>
            </div> */}
        </div>
    )
}