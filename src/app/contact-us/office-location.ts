export interface OfficeLocation {
  shortLabel: string;
}

export const officeLocation: OfficeLocation = {
  shortLabel: "Alemnesh Plaza, 11th floor, Bole, Addis Ababa, Ethiopia",
};

const googleMapsListingCid = "12250861967047050813";

export function getGoogleMapsEmbedSrc(): string {
  return `https://www.google.com/maps?cid=${googleMapsListingCid}&hl=en&output=embed`;
}

export function getGoogleMapsPlaceUrl(): string {
  return `https://www.google.com/maps?cid=${googleMapsListingCid}&hl=en`;
}
