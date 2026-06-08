export interface AdminUser {
    id: string;
    user_id: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    email?: string | null;
}

export interface AdminRole {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    permissions: string[];
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateAdminPayload {
    email: string;
    password: string;
    full_name: string;
    role: string;
    is_active?: boolean;
}

export interface UpdateAdminPayload {
    full_name?: string;
    role?: string;
    is_active?: boolean;
}

export interface CreateRolePayload {
    slug: string;
    name: string;
    description?: string;
    permissions: string[];
}

export interface UpdateRolePayload {
    id: string;
    slug?: string;
    name?: string;
    description?: string;
    permissions?: string[];
}
