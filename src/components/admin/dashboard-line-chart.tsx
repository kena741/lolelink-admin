"use client";

import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import {
    ChartConfig,
    ChartContainer,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

export interface DashboardLineChartSeries {
    key: string;
    label: string;
    color: string;
}

export const USER_ACQUISITION_SERIES: DashboardLineChartSeries[] = [
    {
        key: "customers",
        label: "Customers",
        color: "#2563EB",
    },
    {
        key: "providers",
        label: "Providers",
        color: "#EA580C",
    },
];

interface UserAcquisitionLegendProps {
    customerCount: number;
    providerCount: number;
}

export function UserAcquisitionLegend({
    customerCount,
    providerCount,
}: UserAcquisitionLegendProps) {
    const counts: Record<string, number> = {
        customers: customerCount,
        providers: providerCount,
    };

    return (
        <div className="flex flex-col items-end gap-1.5 text-xs leading-tight text-text-secondary">
            <p className="inline-flex items-center gap-2 font-medium text-text-primary">
                <span className="h-2 w-2 shrink-0" aria-hidden="true" />
                <span>
                    <span className="font-semibold tabular-nums">
                        {(customerCount + providerCount).toLocaleString("en-US")}
                    </span>{" "}
                    new users
                </span>
            </p>

            {USER_ACQUISITION_SERIES.map((line) => (
                <p key={line.key} className="inline-flex items-center gap-2">
                    <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: line.color }}
                        aria-hidden="true"
                    />
                    <span>
                        <span
                            className="font-semibold tabular-nums"
                            style={{ color: line.color }}
                        >
                            {counts[line.key].toLocaleString("en-US")}
                        </span>{" "}
                        {line.label.toLowerCase()}
                    </span>
                </p>
            ))}
        </div>
    );
}

export interface DashboardLineChartBucket {
    label: string;
    [key: string]: string | number;
}

interface DashboardLineChartProps {
    buckets: DashboardLineChartBucket[];
    series: DashboardLineChartSeries[];
    emptyLabel: string;
    showLegend?: boolean;
}

export function DashboardLineChart({
    buckets,
    series,
    emptyLabel,
    showLegend = false,
}: DashboardLineChartProps) {
    const hasData = buckets.some((bucket) =>
        series.some((line) => Number(bucket[line.key] ?? 0) > 0)
    );

    const chartData = buckets.map((bucket) => ({
        period: bucket.label,
        ...Object.fromEntries(series.map((line) => [line.key, Number(bucket[line.key] ?? 0)])),
    }));

    const chartConfig = series.reduce<ChartConfig>((config, line) => {
        config[line.key] = {
            label: line.label,
            color: line.color,
        };
        return config;
    }, {});

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
                {showLegend ? <Legend content={<ChartLegendContent />} /> : null}
                {series.map((line) => (
                    <Line
                        key={line.key}
                        type="monotone"
                        dataKey={line.key}
                        name={line.key}
                        stroke={line.color}
                        strokeWidth={3}
                        dot={{ fill: line.color, r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: line.color }}
                    />
                ))}
            </LineChart>
        </ChartContainer>
    );
}
