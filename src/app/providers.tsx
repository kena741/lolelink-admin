'use client';
import ReduxProvider from '@/store/ReduxProvider';
import { RealtimeDataSync } from '@/components/RealtimeDataSync';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReduxProvider>
            <RealtimeDataSync />
            {children}
        </ReduxProvider>
    );
}
