import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getSupabase } from '@/lib/supabaseClient';
import { logClientAdminActivity } from '@/lib/record-admin-activity';

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
    const type = (item.type ?? '').toLowerCase();
    if (type.includes('payout') || type.includes('transfer') || type.includes('withdraw')) {
        return '/admin/finance/payout-request';
    }
    if (type.includes('document') || type.includes('fayda') || type.includes('verify')) {
        return '/admin/verify-documents';
    }
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
        const { data, error } = await getSupabase()
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
        const { error } = await getSupabase()
            .from('notification')
            .update({ is_read: true, read_at: readAt })
            .eq('id', id);
        if (error) throw error;
        logClientAdminActivity({
            action: 'update',
            resource_type: 'notification',
            resource_id: id,
            summary: `Marked notification ${id} as read`,
        });
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
        const { error } = await getSupabase()
            .from('notification')
            .update({ is_read: true, read_at: readAt })
            .eq('is_read', false);
        if (error) throw error;
        logClientAdminActivity({
            action: 'update',
            resource_type: 'notification',
            summary: 'Marked all notifications as read',
        });
        return { read_at: readAt };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read';
        return rejectWithValue(message);
    }
});

export const markNotificationsReadBulk = createAsyncThunk<
    { ids: string[]; read_at: string },
    { ids: string[] },
    { rejectValue: string }
>('notification/markNotificationsReadBulk', async ({ ids }, { rejectWithValue }) => {
    try {
        if (ids.length === 0) return { ids: [], read_at: new Date().toISOString() };
        const readAt = new Date().toISOString();
        const { error } = await getSupabase()
            .from('notification')
            .update({ is_read: true, read_at: readAt })
            .in('id', ids);
        if (error) throw error;
        logClientAdminActivity({
            action: 'update',
            resource_type: 'notification',
            summary: `Marked ${ids.length} notification(s) as read`,
            metadata: { ids },
        });
        return { ids, read_at: readAt };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to mark notifications as read';
        return rejectWithValue(message);
    }
});

export const deleteNotification = createAsyncThunk<
    { id: string },
    { id: string },
    { rejectValue: string }
>('notification/deleteNotification', async ({ id }, { rejectWithValue }) => {
    try {
        const { error } = await getSupabase()
            .from('notification')
            .delete()
            .eq('id', id);
        if (error) throw error;
        logClientAdminActivity({
            action: 'delete',
            resource_type: 'notification',
            resource_id: id,
            summary: `Deleted notification ${id}`,
        });
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
        const { error } = await getSupabase()
            .from('notification')
            .delete()
            .in('id', ids);
        if (error) throw error;
        logClientAdminActivity({
            action: 'delete',
            resource_type: 'notification',
            summary: `Deleted ${ids.length} notification(s)`,
            metadata: { ids },
        });
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
                if (state.items.length === 0) state.loading = true;
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
            .addCase(markNotificationsReadBulk.pending, (state, action) => {
                const now = new Date().toISOString();
                const idSet = new Set(action.meta.arg.ids);
                state.items.forEach((item) => {
                    if (!idSet.has(item.id)) return;
                    item.is_read = true;
                    item.read_at = now;
                });
            })
            .addCase(markNotificationsReadBulk.fulfilled, (state, action) => {
                const idSet = new Set(action.payload.ids);
                state.items.forEach((item) => {
                    if (!idSet.has(item.id)) return;
                    item.is_read = true;
                    item.read_at = action.payload.read_at;
                });
            })
            .addCase(markNotificationsReadBulk.rejected, (state, action) => {
                state.error = (action.payload as string) || 'Failed to mark notifications as read';
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
