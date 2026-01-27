const getSeverityColor = (severity: string) => {
    switch (severity) {
        case "CRITICAL":
            return "bg-purple-600";
        case "HIGH":
            return "bg-red-600";
        case "MEDIUM":
            return "bg-orange-500";
        case "LOW":
            return "bg-yellow-500";
        default:
            return "bg-gray-500";
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case "ONLINE":
            return "bg-green-100 text-green-800";
        case "OFFLINE":
            return "bg-red-100 text-red-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
};

const getSeverityBorder = (severity: string) => {
    switch (severity) {
        case "CRITICAL":
            return "border-purple-600";
        case "HIGH":
            return "border-red-600";
        case "MEDIUM":
            return "border-orange-500";
        case "LOW":
            return "border-yellow-500";
        default:
            return "border-gray-500";
    }
}

const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
        MOTION_DETECTION: "움직임 감지",
        INTRUSION_DETECTION: "침입 감지",
        LINE_CROSSING: "라인 크로싱",
    };
    return labels[eventType] || eventType.replace(/_/g, " ");
};

const SEVERITY_COLORS: Record<string, string> = {
    LOW: "bg-green-100 text-green-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-orange-100 text-orange-800",
};

const STATUS_COLORS: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-800",
    ACKNOWLEDGED: "bg-purple-100 text-purple-800",
    INVESTIGATING: "bg-yellow-100 text-yellow-800",
    RESOLVED: "bg-green-100 text-green-800",
    FALSE_ALARM: "bg-gray-100 text-gray-800",
};

export {
    getSeverityColor,
    getStatusColor,
    getSeverityBorder,
    getEventTypeLabel,
    SEVERITY_COLORS,
    STATUS_COLORS,
};