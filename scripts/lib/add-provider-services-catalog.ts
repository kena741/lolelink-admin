export interface ProviderServiceSeed {
    serviceName: string;
    subCategoryName: string;
    descriptionEn: string;
    descriptionAm: string;
    price?: number;
    discount?: string;
}

export const DEFAULT_PROVIDER_ID = 'de7f695e-860a-43af-af5a-d2c68a287f5c';

export const COMBINED_SERVICE_ID = 'adbbaf66-60c1-4050-b6e7-9dcad470e7ca';

export const MAINTENANCE_PROVIDER_SERVICES: ProviderServiceSeed[] = [
    {
        serviceName: 'Electrical Installation',
        subCategoryName: 'Electrician',
        descriptionEn: 'Home and office electrical wiring and installation.',
        descriptionAm: 'ለቤትና ጽሕፈት ቤት የኤሌክትሪክ ሽንት እና ጭማሪ።',
    },
    {
        serviceName: 'CCTV Camera Installation',
        subCategoryName: 'CCTV Installation',
        descriptionEn: 'CCTV camera setup, cabling, and configuration.',
        descriptionAm: 'የሲሲቲቪ ካሜራ ጭነት፣ ሽቦ እና ማስተካከል።',
    },
    {
        serviceName: 'Sanitary Installation',
        subCategoryName: 'Plumber',
        descriptionEn: 'Bathroom and kitchen sanitary fittings and pipe work.',
        descriptionAm: 'የመታጠቢያ ቤት/ወጥ ቤት የሳኒታሪ ጭማሪ እና ቧንቧ።',
    },
    {
        serviceName: 'Electronics Repair',
        subCategoryName: 'Appliance Repair',
        descriptionEn: 'TV, juicer, coffee machine and small electronics repair.',
        descriptionAm: 'ቴሌቪዥን፣ ጭማቂ፣ ቡና ማሽን እና ሌሎች ኤሌክትሮኒክስ ጥገና።',
    },
    {
        serviceName: 'Roto & Boiler Cleaning',
        subCategoryName: 'Water Tank & Pump Service',
        descriptionEn: 'Roto, boiler and pump cleaning and maintenance.',
        descriptionAm: 'ሮቶ፣ ቦይለር እና ፓምፕ ማጽዳት እና ጥገና።',
    },
    {
        serviceName: 'Washing Machine Service',
        subCategoryName: 'Appliance Repair',
        descriptionEn: 'Washing machine install, repair and maintenance.',
        descriptionAm: 'የልብስ ማጠቢያ ማሽን ጭንት፣ ጥገና እና እንክብካቤ።',
    },
    {
        serviceName: 'Dishwasher Service',
        subCategoryName: 'Appliance Repair',
        descriptionEn: 'Dishwasher install, repair and maintenance.',
        descriptionAm: 'የቆሻሻ ማሽን ጭንት፣ ጥገና እና እንክብካቤ።',
    },
    {
        serviceName: 'Office Machine Service',
        subCategoryName: 'IT Support',
        descriptionEn: 'Office printers, copiers and equipment support.',
        descriptionAm: 'የቢሮ ማተሚያ፣ ኮፒ እና ሌሎች ዕቃዎች አገልግሎት።',
    },
];

export function buildBilingualDescription(seed: ProviderServiceSeed): string {
    return `${seed.descriptionEn}\n${seed.descriptionAm}`;
}

export function slugifyServiceName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}
