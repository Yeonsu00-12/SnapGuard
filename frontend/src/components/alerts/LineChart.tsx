import ReactECharts from "echarts-for-react";

export default function LineChart({ hourlyData }: { hourlyData: number[] }) {
    const chartOption = {
        tooltip: {
            trigger: "axis",
            formatter: (params: any) => {
                const hour = params[0].dataIndex;
                const value = params[0].value;
                return `${hour}시 ~ ${hour + 1}시<br/>이벤트: <b>${value}건</b>`;
            },
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "10%",
            containLabel: true,
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: Array.from({ length: 24 }, (_, i) => `${i}시`),
            axisLabel: { interval: 3, fontSize: 11, color: "#94a3b8" },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#f1f5f9" } },
            axisLabel: { fontSize: 11, color: "#94a3b8" },
        },
        series: [{
            data: hourlyData,
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { color: "#3b82f6", width: 2 },
            areaStyle: {
                color: {
                    type: "linear",
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
                        { offset: 1, color: "rgba(59, 130, 246, 0.05)" },
                    ],
                },
            },
            itemStyle: { color: "#3b82f6" },
        }],
    };
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-4">시간대별 이벤트 발생</p>
            <ReactECharts option={chartOption} style={{ height: "240px" }} />
        </div>
    )
}