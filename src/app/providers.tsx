'use client';
import ReduxProvider from '@/store/ReduxProvider';
import { RealtimeDataSync } from '@/components/RealtimeDataSync';
import { NotificationBell } from '@/components/NotificationBell';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReduxProvider>
            <RealtimeDataSync />
            <NotificationBell />
            {children}
        </ReduxProvider>
    );
}
