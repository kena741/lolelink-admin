"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

interface DashboardBarChartProps {
    buckets: Array<{ label: string; value: number }>;
    emptyLabel: string;
    valueLabel: string;
    barColor: string;
    isCurrency?: boolean;
}

function formatChartCurrency(value: number): string {
    return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatChartAxisCurrency(value: number): string {
    if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
    }
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function DashboardBarChart({
    buckets,
    emptyLabel,
    valueLabel,
    barColor,
    isCurrency = false,
}: DashboardBarChartProps) {
    const hasData = buckets.some((bucket) => bucket.value > 0);
    const chartData = buckets.map((bucket) => ({
        period: bucket.label,
        value: bucket.value,
    }));

    const chartConfig = {
        value: {
            label: valueLabel,
            color: barColor,
        },
    } satisfies ChartConfig;

    if (!hasData) {
        return (
            <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-background/60 px-4 text-center text-sm text-text-secondary">
                {emptyLabel}
            </div>
        );
    }

    return (
        <ChartContainer
            config={chartConfig}
            className="h-[240px] w-full min-h-[240px] rounded-xl border border-border bg-background/60 p-2"
            initialDimension={{ width: 640, height: 220 }}
        >
            <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
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
                    width={isCurrency ? 52 : 44}
                    allowDecimals={isCurrency}
                    tickFormatter={isCurrency ? formatChartAxisCurrency : undefined}
                />
                <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                    content={
                        <ChartTooltipContent
                            formatter={
                                isCurrency
                                    ? (value) => formatChartCurrency(Number(value))
                                    : undefined
                            }
                        />
                    }
                />
                <Bar
                    dataKey="value"
                    fill="var(--color-value)"
                    radius={[8, 8, 2, 2]}
                    maxBarSize={56}
                />
            </BarChart>
        </ChartContainer>
    );
}
