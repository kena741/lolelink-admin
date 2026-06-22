'use client';

import { useEffect, useState } from 'react';
import { isWalletMetricsDebugHost } from '@/lib/utils';

export function useWalletMetricsDebugVisible(): boolean {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(isWalletMetricsDebugHost(window.location.hostname));
    }, []);

    return isVisible;
}
