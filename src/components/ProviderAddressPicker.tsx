"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADDIS_ABABA_CENTER, loadGoogleMapsPlaces } from "@/lib/google-maps-loader";
import type { ProviderAddressValue } from "@/lib/provider-location";
import type {
    GoogleMapsAutocomplete,
    GoogleMapsGeocoder,
    GoogleMapsMap,
    GoogleMapsMarker,
} from "@/types/google-maps";

interface ProviderAddressPickerProps {
    id?: string;
    label?: string;
    value: ProviderAddressValue;
    onChange: (value: ProviderAddressValue) => void;
    disabled?: boolean;
}

function latLngFromPlace(place: ReturnType<GoogleMapsAutocomplete["getPlace"]>): {
    lat: number | null;
    lng: number | null;
} {
    const loc = place.geometry?.location;
    if (!loc) return { lat: null, lng: null };
    return { lat: loc.lat(), lng: loc.lng() };
}

export function ProviderAddressPicker({
    id: idProp,
    label = "Address",
    value,
    onChange,
    disabled = false,
}: ProviderAddressPickerProps) {
    const autoId = useId();
    const inputId = idProp ?? `provider-address-${autoId}`;
    const inputRef = useRef<HTMLInputElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<GoogleMapsMap | null>(null);
    const markerRef = useRef<GoogleMapsMarker | null>(null);
    const autocompleteRef = useRef<GoogleMapsAutocomplete | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [mapsReady, setMapsReady] = useState(false);
    const [mapsError, setMapsError] = useState<string | null>(null);
    const [mapOpen, setMapOpen] = useState(false);
    const [mapDraft, setMapDraft] = useState<ProviderAddressValue>(value);
    const [mapLoading, setMapLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadGoogleMapsPlaces()
            .then(() => {
                if (!cancelled) {
                    setMapsReady(true);
                    setMapsError(null);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setMapsError(e instanceof Error ? e.message : "Failed to load Google Maps");
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!mapsReady || disabled || !inputRef.current || !window.google?.maps?.places) return;

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            fields: ["formatted_address", "geometry"],
            componentRestrictions: { country: "et" },
        });
        autocompleteRef.current = autocomplete;

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const { lat, lng } = latLngFromPlace(place);
            onChangeRef.current({
                address: place.formatted_address ?? inputRef.current?.value ?? "",
                latitude: lat,
                longitude: lng,
            });
        });

        return () => {
            if (window.google?.maps?.event && autocompleteRef.current) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }
            autocompleteRef.current = null;
        };
    }, [mapsReady, disabled]);

    const reverseGeocode = useCallback((lat: number, lng: number): Promise<string> => {
        return new Promise((resolve) => {
            if (!window.google?.maps) {
                resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                return;
            }
            const geocoder: GoogleMapsGeocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === "OK" && results?.[0]?.formatted_address) {
                    resolve(results[0].formatted_address);
                    return;
                }
                resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            });
        });
    }, []);

    const initMapPicker = useCallback(async () => {
        if (!mapContainerRef.current || !window.google?.maps) return;

        const center =
            mapDraft.latitude != null && mapDraft.longitude != null
                ? { lat: mapDraft.latitude, lng: mapDraft.longitude }
                : ADDIS_ABABA_CENTER;

        if (!mapRef.current) {
            mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
                center,
                zoom: 15,
                mapTypeControl: false,
            });
            markerRef.current = new window.google.maps.Marker({
                map: mapRef.current,
                position: center,
                draggable: true,
            });

            const applyPosition = async (lat: number, lng: number) => {
                setMapLoading(true);
                const address = await reverseGeocode(lat, lng);
                setMapDraft({ address, latitude: lat, longitude: lng });
                setMapLoading(false);
            };

            mapRef.current.addListener("click", (e) => {
                const ll = e.latLng;
                if (!ll) return;
                const lat = ll.lat();
                const lng = ll.lng();
                markerRef.current?.setPosition({ lat, lng });
                void applyPosition(lat, lng);
            });

            markerRef.current.addListener("dragend", () => {
                const pos = markerRef.current?.getPosition();
                if (!pos) return;
                void applyPosition(pos.lat(), pos.lng());
            });
        } else {
            mapRef.current.setCenter(center);
            markerRef.current?.setPosition(center);
        }
    }, [mapDraft.latitude, mapDraft.longitude, reverseGeocode]);

    useEffect(() => {
        if (!mapOpen) {
            mapRef.current = null;
            markerRef.current = null;
            return;
        }
        if (!mapsReady) return;
        const t = window.setTimeout(() => {
            void initMapPicker();
        }, 50);
        return () => window.clearTimeout(t);
    }, [mapOpen, mapsReady, initMapPicker]);

    const openMapPicker = () => {
        setMapDraft(value);
        setMapOpen(true);
    };

    const confirmMapPick = () => {
        onChange(mapDraft);
        setMapOpen(false);
    };

    const hasCoords = value.latitude != null && value.longitude != null;

    return (
        <div className="grid gap-1.5">
            <Label htmlFor={inputId}>{label}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                    ref={inputRef}
                    id={inputId}
                    name="address"
                    value={value.address}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            address: e.target.value,
                        })
                    }
                    placeholder="Search address or pick on map"
                    disabled={disabled || !mapsReady}
                    autoComplete="off"
                    className="flex-1"
                />
                <Button
                    type="button"
                    variant="outline"
                    className="h-[40px] shrink-0 gap-2"
                    onClick={openMapPicker}
                    disabled={disabled || !mapsReady}
                >
                    <MapPin className="h-4 w-4" aria-hidden />
                    Pick on map
                </Button>
            </div>
            {mapsError && <p className="text-sm text-destructive">{mapsError}</p>}
            {!mapsError && !mapsReady && (
                <p className="text-sm text-muted-foreground">Loading address search…</p>
            )}
            {hasCoords && (
                <p className="text-[13px] text-muted-foreground">
                    {value.latitude?.toFixed(5)}, {value.longitude?.toFixed(5)}
                </p>
            )}

            {mapOpen && (
                <div className="fixed inset-0 z-[110]">
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setMapOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute inset-0 grid place-items-center p-4">
                        <div
                            className="w-full max-w-2xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="map-picker-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h3
                                    id="map-picker-title"
                                    className="text-base font-semibold text-card-foreground"
                                >
                                    Pick address on map
                                </h3>
                                <button
                                    type="button"
                                    className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                                    onClick={() => setMapOpen(false)}
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>
                            <div
                                ref={mapContainerRef}
                                className="h-[360px] w-full overflow-hidden rounded-md border border-border bg-muted"
                            />
                            <p className="mt-2 text-sm text-muted-foreground">
                                {mapLoading
                                    ? "Loading address…"
                                    : mapDraft.address ||
                                      "Tap the map or drag the pin to set a location."}
                            </p>
                            <div className="mt-4 flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setMapOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="button" onClick={confirmMapPick} disabled={mapLoading}>
                                    Use this address
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
