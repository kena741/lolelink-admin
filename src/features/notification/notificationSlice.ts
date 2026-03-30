import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabaseClient';

export interface NotificationItem {
    id: string;
    booking_id?: string | null;
    created_at?: string | null;
    customer_id?: string | null;
    description?: string | null;
    handyman_id?: string | null;
    provider_id?: string | null;
    sender_id?: string | null;
    title?: string | null;
    type?: string | null;
    is_read?: boolean | null;
    read_at?: string | null;
    action_url?: string | null;
}

interface NotificationState {
    items: NotificationItem[];
    loading: boolean;
    error: string | null;
}

const initialState: NotificationState = {
    items: [],
    loading: false,
    error: null,
};

function deriveActionUrl(item: NotificationItem): string {
    if (item.action_url) return item.action_url;
    if (item.booking_id) return `/admin/bookings`;
    if (item.provider_id) return `/admin/providers/${item.provider_id}`;
    if (item.customer_id) return `/admin/customers`;
    if (item.handyman_id) return `/admin/handyman`;
    return '/admin/dashboard';
}

function normalizeRows(rows: NotificationItem[] | null | undefined): NotificationItem[] {
    return (rows ?? []).map((row) => ({
        ...row,
        is_read: row.is_read ?? false,
        action_url: deriveActionUrl(row),
    }));
}

export const fetchNotifications = createAsyncThunk<
    NotificationItem[],
    void,
    { rejectValue: string }
>('notification/fetchNotifications', async (_, { rejectWithValue }) => {
    try {
        const { data, error } = await supabase
            .from('notification')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return normalizeRows(data as NotificationItem[]);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
        return rejectWithValue(message);
    }
});

export const markNotificationRead = createAsyncThunk<
    { id: string; read_at: string },
    { id: string },
    { rejectValue: string }
>('notification/markNotificationRead', async ({ id }, { rejectWithValue }) => {
    try {
        const readAt = new Date().toISOString();
        const { error } = await supabase
            .from('notification')
            .update({ is_read: true, read_at: readAt })
            .eq('id', id);
        if (error) throw error;
        return { id, read_at: readAt };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
        return rejectWithValue(message);
    }
});

export const markAllNotificationsRead = createAsyncThunk<
    { read_at: string },
    void,
    { rejectValue: string }
>('notification/markAllNotificationsRead', async (_, { rejectWithValue }) => {
    try {
        const readAt = new Date().toISOString();
        const { error } = await supabase
            .from('notification')
            .update({ is_read: true, read_at: readAt })
            .eq('is_read', false);
        if (error) throw error;
        return { read_at: readAt };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read';
        return rejectWithValue(message);
    }
});

export const deleteNotification = createAsyncThunk<
    { id: string },
    { id: string },
    { rejectValue: string }
>('notification/deleteNotification', async ({ id }, { rejectWithValue }) => {
    try {
        const { error } = await supabase
            .from('notification')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return { id };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete notification';
        return rejectWithValue(message);
    }
});

export const deleteNotificationsBulk = createAsyncThunk<
    { ids: string[] },
    { ids: string[] },
    { rejectValue: string }
>('notification/deleteNotificationsBulk', async ({ ids }, { rejectWithValue }) => {
    try {
        if (ids.length === 0) return { ids: [] };
        const { error } = await supabase
            .from('notification')
            .delete()
            .in('id', ids);
        if (error) throw error;
        return { ids };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete selected notifications';
        return rejectWithValue(message);
    }
});

const notificationSlice = createSlice({
    name: 'notification',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchNotifications.fulfilled, (state, action: PayloadAction<NotificationItem[]>) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Failed to fetch notifications';
            })
            .addCase(markNotificationRead.pending, (state, action) => {
                const item = state.items.find((notification) => notification.id === action.meta.arg.id);
                if (item) {
                    item.is_read = true;
                    item.read_at = new Date().toISOString();
                }
            })
            .addCase(markNotificationRead.rejected, (state, action) => {
                const item = state.items.find((notification) => notification.id === action.meta.arg.id);
                if (item) {
                    item.is_read = false;
                    item.read_at = null;
                }
                state.error = (action.payload as string) || 'Failed to mark notification as read';
            })
            .addCase(markNotificationRead.fulfilled, (state, action) => {
                const item = state.items.find((notification) => notification.id === action.payload.id);
                if (item) {
                    item.is_read = true;
                    item.read_at = action.payload.read_at;
                }
            })
            .addCase(markAllNotificationsRead.pending, (state) => {
                const now = new Date().toISOString();
                state.items.forEach((item) => {
                    item.is_read = true;
                    item.read_at = now;
                });
            })
            .addCase(markAllNotificationsRead.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Failed to mark all notifications as read';
            })
            .addCase(deleteNotification.fulfilled, (state, action) => {
                state.items = state.items.filter((notification) => notification.id !== action.payload.id);
            })
            .addCase(deleteNotification.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Failed to delete notification';
            })
            .addCase(deleteNotificationsBulk.fulfilled, (state, action) => {
                const idSet = new Set(action.payload.ids);
                state.items = state.items.filter((notification) => !idSet.has(notification.id));
            })
            .addCase(deleteNotificationsBulk.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Failed to delete selected notifications';
            });
    },
});

export default notificationSlice.reducer;
