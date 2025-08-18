'use client';
import ReduxProvider from '@/store/ReduxProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ReduxProvider>{children}</ReduxProvider>;
}
