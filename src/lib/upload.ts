import { supabase } from '@/lib/supabaseClient';

/**
 * Uploads files to Supabase Storage and returns their public URLs.
 * @param files Array of File objects to upload
 * @param folderPath Storage folder path (e.g. 'betegnabucket/providers/{provider_id}')
 * @returns Array of public URLs for the uploaded files
 */
export async function uploadFilesToSupabase(files: File[], folderPath: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const filePath = `${folderPath}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from('betegnabucket')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(error.message);
    const { data: publicUrlData } = supabase.storage.from('betegnabucket').getPublicUrl(filePath);
    if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');
    urls.push(publicUrlData.publicUrl);
  }
  return urls;
}
