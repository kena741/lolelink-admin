'use client';

import { useEffect, useState } from 'react';
import { isLocalhostHostname } from '@/lib/utils';

export function useIsLocalhost(): boolean {
    const [isLocalhost, setIsLocalhost] = useState(false);

    useEffect(() => {
        setIsLocalhost(isLocalhostHostname(window.location.hostname));
    }, []);

    return isLocalhost;
}
