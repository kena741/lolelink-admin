"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeEditModal, setCoverIdx, setImages, updateService } from "@/features/service/editServiceSlice";
import { fetchProviderServices } from "@/features/provider/providerSlice";
import { uploadFilesToSupabase } from "@/lib/upload";

const toMinutesString = (val: string | number | undefined | null): string => {
    if (val == null) return "";
    const s = String(val).toLowerCase().trim();
    if (/^\d+$/.test(s)) return s;
    const hrMatch = s.match(/(\d+)\s*h/);
    const minMatch = s.match(/(\d+)\s*m/);
    let minutes = 0;
    if (hrMatch) minutes += parseInt(hrMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);
    if (minutes > 0) return String(minutes);
    const onlyNums = s.replace(/[^\d]/g, "");
    return onlyNums;
};

export default function EditServiceModal() {
    const params = useParams();
    const providerId = (params?.id as string) || "";
    const dispatch = useAppDispatch();
    const { open, service, coverIdx, images, loading, error, success } = useAppSelector((s) => s.editService);

    const [form, setForm] = useState({
        serviceName: "",
        type: "Fixed",
        price: "",
        discount: "",
        duration: "",
        description: "",
        serviceLocationMode: "onsite",
    });
    const [mediaType, setMediaType] = useState<"images" | "video">("images");
    const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [removeVideo, setRemoveVideo] = useState(false);
    const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

    useEffect(() => {
        if (!service) return;
        setForm({
            serviceName: service.serviceName || "",
            type: service.type || "Fixed",
            price: service.price ? String(service.price) : "",
            discount: service.discount ? String(service.discount) : "",
            duration: toMinutesString(service.duration),
            description: service.description || "",
            serviceLocationMode: service.serviceLocationMode || "onsite",
        });
        if (service.video) {
            setMediaType("video");
            setExistingVideoUrl(service.video);
        } else {
            setMediaType("images");
            setExistingVideoUrl(null);
        }
        setRemoveVideo(false);
        setVideoFile(null);
        if (videoPreviewUrl) {
            URL.revokeObjectURL(videoPreviewUrl);
            setVideoPreviewUrl(null);
        }
    }, [service, videoPreviewUrl]);

    useEffect(() => {
        if (success && providerId) {
            dispatch(fetchProviderServices(providerId));
            dispatch(closeEditModal());
        }
    }, [success, providerId, dispatch]);

    useEffect(() => {
        return () => {
            if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
            // Revoke any pending image previews
            pendingPreviews.forEach((u) => {
                try { URL.revokeObjectURL(u); } catch { }
            });
        };
    }, [videoPreviewUrl, pendingPreviews]);

    if (!open || !service) return null;

    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const onImageFiles = async (files: FileList | null) => {
        if (!files || files.length === 0 || !providerId) return;
        try {
            // Show immediate local previews
            const locals = Array.from(files).map((f) => URL.createObjectURL(f));
            setPendingPreviews((prev) => [...locals, ...prev]);
            const urls = await uploadFilesToSupabase(Array.from(files), `provider/${providerId}`);
            const validUrls = (urls || []).filter(Boolean) as string[];
            if (validUrls.length > 0) {
                const next = [...(images || [])];
                validUrls.forEach((u) => next.unshift(u));
                dispatch(setImages(next));
                dispatch(setCoverIdx(0));
            }
            // Clear local previews after successful upload
            setPendingPreviews((prev) => {
                prev.forEach((u) => { try { URL.revokeObjectURL(u); } catch { } });
                return [];
            });
        } catch (e) {
            console.warn("Image upload failed", e);
            // On failure, still clear local previews
            setPendingPreviews((prev) => {
                prev.forEach((u) => { try { URL.revokeObjectURL(u); } catch { } });
                return [];
            });
        }
    };

    const onRemoveImage = (idx: number) => {
        const next = (images || []).filter((_, i) => i !== idx);
        dispatch(setImages(next));
        if (coverIdx >= next.length) dispatch(setCoverIdx(0));
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (videoPreviewUrl) {
            URL.revokeObjectURL(videoPreviewUrl);
            setVideoPreviewUrl(null);
        }
        setVideoFile(null);
        setRemoveVideo(false);
        if (!file) return;
        const maxBytes = 100 * 1024 * 1024;
        if (file.size > maxBytes) {
            alert("Video too large. Please upload under 100MB.");
            e.currentTarget.value = "";
            return;
        }
        const url = URL.createObjectURL(file);
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.src = url;
        probe.onloadedmetadata = () => {
            const d = probe.duration;
            if (Number.isFinite(d) && d > 60.5) {
                URL.revokeObjectURL(url);
                alert("Video too long. Please upload a clip up to 60 seconds.");
                e.currentTarget.value = "";
            } else {
                setVideoFile(file);
                setVideoPreviewUrl(url);
                setExistingVideoUrl(null);
            }
        };
        probe.onerror = () => {
            URL.revokeObjectURL(url);
            alert("Invalid video file.");
            e.currentTarget.value = "";
        };
    };

    const handleRemoveVideo = () => {
        if (videoPreviewUrl) {
            URL.revokeObjectURL(videoPreviewUrl);
            setVideoPreviewUrl(null);
        }
        setVideoFile(null);
        if (existingVideoUrl) setRemoveVideo(true);
        setExistingVideoUrl(null);
    };

    const onSave = async () => {
        if (!form.serviceName.trim()) {
            alert("Missing service name");
            return;
        }
        if (!form.description.trim()) {
            alert("Missing description");
            return;
        }
        const priceNum = Number(form.price);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
            alert("Invalid price");
            return;
        }
        const normalizedDuration = toMinutesString(form.duration);
        dispatch(updateService({
            id: service.id,
            serviceName: form.serviceName,
            type: form.type,
            price: form.price,
            discount: form.discount,
            duration: normalizedDuration,
            description: form.description,
            serviceLocationMode: form.serviceLocationMode,
            serviceImage: images,
            videoFile: mediaType === 'video' ? (videoFile ?? undefined) : undefined,
            removeVideo: mediaType === 'video' ? (removeVideo ? true : undefined) : (existingVideoUrl ? true : undefined),
        }));
    };

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/70" onClick={() => dispatch(closeEditModal())} />
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl max-h-screen -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Edit Service</h2>
                    <button onClick={() => dispatch(closeEditModal())} aria-label="Close" className="p-1 rounded hover:bg-gray-100">✕</button>
                </div>
                {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
                <div className="mt-6 space-y-6">
                    <div>
                        <label className="text-sm font-medium" htmlFor="svc-name">Service Name</label>
                        <input id="svc-name" name="serviceName" value={form.serviceName} onChange={onChange} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium" htmlFor="svc-type">Type</label>
                            <select id="svc-type" name="type" value={form.type} onChange={onChange} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                                <option value="Fixed">Fixed</option>
                                <option value="Hourly">Hourly</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium" htmlFor="svc-price">Price</label>
                            <input id="svc-price" name="price" value={form.price} onChange={onChange} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" inputMode="decimal" />
                        </div>
                        <div>
                            <label className="text-sm font-medium" htmlFor="svc-discount">Discount</label>
                            <input id="svc-discount" name="discount" value={form.discount} onChange={onChange} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" inputMode="decimal" />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium" htmlFor="svc-duration">Duration (minutes)</label>
                        <input id="svc-duration" name="duration" value={form.duration} onChange={onChange} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. 90 or 1h 30m" />
                    </div>
                    <div>
                        <label className="text-sm font-medium" htmlFor="svc-desc">Description</label>
                        <textarea id="svc-desc" name="description" value={form.description} onChange={onChange} className="mt-1 w-full min-h-[90px] rounded-md border px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Service Location Mode</label>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {['onsite', 'offsite', 'remote'].map((mode) => (
                                <label key={mode} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${form.serviceLocationMode === mode ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}`}>
                                    <input type="radio" name="serviceLocationMode" value={mode} checked={form.serviceLocationMode === mode} onChange={onChange} />
                                    <span className="capitalize">{mode}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Media</label>
                        <div className="mt-2 flex items-center gap-2">
                            <button type="button" className={`px-3 py-1.5 rounded-md text-sm border ${mediaType === 'images' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300'}`} onClick={() => setMediaType('images')}>Images</button>
                            <button type="button" className={`px-3 py-1.5 rounded-md text-sm border ${mediaType === 'video' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300'}`} onClick={() => setMediaType('video')}>Video</button>
                        </div>
                        {mediaType === 'images' ? (
                            <div className="mt-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                                    {/* Pending local previews (uploading) */}
                                    {pendingPreviews.map((img, idx) => (
                                        <div key={`pending-${idx}`} className="relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img} alt={`uploading-${idx}`} className="w-full aspect-square object-cover rounded-lg ring-1 ring-gray-200 opacity-70" />
                                            <div className="absolute inset-0 grid place-items-center">
                                                <div className="rounded bg-black/50 text-white text-xs px-2 py-1">Uploading…</div>
                                            </div>
                                        </div>
                                    ))}
                                    {(images || []).map((img, idx) => (
                                        <div key={img + idx} className="relative group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img} alt={`img-${idx}`} className="w-full aspect-square object-cover rounded-lg ring-1 ring-gray-200" />
                                            <button type="button" className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-1 text-xs border" onClick={() => {
                                                if (idx !== 0) {
                                                    const next = [...(images || [])];
                                                    const [sel] = next.splice(idx, 1);
                                                    next.unshift(sel);
                                                    dispatch(setImages(next));
                                                }
                                                dispatch(setCoverIdx(0));
                                            }}>Cover</button>
                                            <button type="button" className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-1 text-xs border" onClick={() => onRemoveImage(idx)}>Remove</button>
                                        </div>
                                    ))}
                                    <label className="cursor-pointer">
                                        <div className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg text-sm text-gray-600">
                                            Upload
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => onImageFiles(e.target.files)} />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3">
                                <label className="text-sm font-medium" htmlFor="videoUpload">Upload a video (max 60s)</label>
                                <input id="videoUpload" type="file" accept="video/mp4,video/webm,video/quicktime" className="mt-1 block w-full text-sm" onChange={handleVideoChange} />
                                {(videoPreviewUrl || existingVideoUrl) ? (
                                    <div className="mt-3">
                                        <video src={videoPreviewUrl || existingVideoUrl || undefined} controls className="w-full rounded" />
                                        <button type="button" className="mt-2 rounded border px-3 py-1.5 text-sm" onClick={handleRemoveVideo}>Remove video</button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-2">No video selected.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => dispatch(closeEditModal())}>Cancel</button>
                    <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm disabled:opacity-60" onClick={onSave} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
                </div>
            </div>
        </>
    );
}
