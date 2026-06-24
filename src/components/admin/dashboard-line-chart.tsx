"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

interface DashboardLineChartProps {
    buckets: Array<{ label: string; value: number }>;
    emptyLabel: string;
    valueLabel: string;
    lineColor: string;
}

export function DashboardLineChart({
    buckets,
    emptyLabel,
    valueLabel,
    lineColor,
}: DashboardLineChartProps) {
    const hasData = buckets.some((bucket) => bucket.value > 0);
    const chartData = buckets.map((bucket) => ({
        period: bucket.label,
        value: bucket.value,
    }));

    const chartConfig = {
        value: {
            label: valueLabel,
            color: lineColor,
        },
    } satisfies ChartConfig;

    if (!hasData) {
        return (
            <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-background/60 px-4 text-center text-sm text-text-secondary">
                {emptyLabel}
            </div>
        );
    }

    return (
        <ChartContainer
            config={chartConfig}
            className="h-[280px] w-full min-h-[280px] rounded-xl border border-border bg-background/60 p-2"
            initialDimension={{ width: 960, height: 260 }}
        >
            <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={20}
                    interval="preserveStartEnd"
                />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={44}
                    allowDecimals={false}
                />
                <ChartTooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={<ChartTooltipContent />}
                />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--color-value)", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                />
            </LineChart>
        </ChartContainer>
    );
}
