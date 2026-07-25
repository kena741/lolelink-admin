import { getSupabase } from '@/lib/supabaseClient';
import { compressImageFile } from '@/lib/compress-image';
import { extractSupabaseStoragePath } from '@/lib/media-url';

const BUCKET = 'betegnabucket';
const CACHE_CONTROL = '31536000';

export async function deleteStorageFilesFromUrls(urls: string[]): Promise<void> {
    const paths = urls
        .map(extractSupabaseStoragePath)
        .filter((path): path is string => Boolean(path));

    if (paths.length === 0) return;

    const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
    if (error) {
        console.warn('Storage delete failed:', error.message);
    }
}

export async function uploadFilesToSupabase(files: File[], folderPath: string): Promise<string[]> {
    const urls: string[] = [];

    for (const rawFile of files) {
        const file = rawFile.type.startsWith('image/')
            ? await compressImageFile(rawFile)
            : rawFile;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
        const filePath = `${folderPath}/${Date.now()}_${safeName || 'file'}`;
        const { error } = await getSupabase().storage
            .from(BUCKET)
            .upload(filePath, file, { cacheControl: CACHE_CONTROL, upsert: false });

        if (error) throw new Error(error.message);

        const { data: publicUrlData } = getSupabase().storage.from(BUCKET).getPublicUrl(filePath);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');
        urls.push(publicUrlData.publicUrl);
    }

    return urls;
}
