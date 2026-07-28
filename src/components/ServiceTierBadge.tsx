import { cn } from '@/lib/utils';

interface ServiceTierBadgeProps {
    tierMax?: number | null;
    className?: string;
}

export function ServiceTierBadge({ tierMax, className }: ServiceTierBadgeProps) {
    const max = tierMax ?? 0;

    return (
        <span
            className={cn(
                'inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-muted/50 px-1.5 text-[10px] font-normal tabular-nums text-muted-foreground',
                className
            )}
            title={`Service tier max: ${max}`}
        >
            Tier {max}
        </span>
    );
}
