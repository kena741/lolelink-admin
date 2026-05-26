export const DEFAULT_SMS_APPROVED_ZERO_SERVICES =
    'ሰላም {{name}}! የብሔራዊ መታወቂያ (Fayda) ሰነድዎ ጸድቋል እናመሰግናለን። በዘመን ፕሮቫይደር መተግበሪያ ላይ እስካሁን አገልግሎት አልጨመሩም። እባክዎ አገልግሎትዎን ያስገቡ፤ ደንበኞች እርስዎን ሲፈልጉ ያገኙዎታል። ጥያቄ ካለዎት በዚህ ስልክ 0951175959 ደውለው ይጠይቁ:: ለትብብርዎ እናመሰግናለን!! መልካም ስራ!';

export const DEFAULT_SMS_FAYDA_REJECTED =
    'ሰላም {{name}}! ለዘመን አገልግሎት ሰጪነት የሚያስፈልገው የብሔራዊ መታወቂያ (Fayda) ሰነድዎ አልተቀበለም። እባክዎ ትክክለኛውን ሰነድ እንደገና ያስገቡ ወይም በዚህ ስልክ 0951175959 ደውለው ይጠይቁ:: ለትብብርዎ እናመሰግናለን!!';

export const DEFAULT_SMS_FAYDA_NO_UPLOAD =
    'ሰላም {{name}}! ከዘመን ፕሮቫይደር ሰለተመዘገቡ እናመሰግናለን። በመተግበሪያው ላይ የብሔራዊ መታወቂያ (Fayda) ሰነድ መጫን፣ አገልግሎት መጨመር እና መለያዎን ማሟላት አስፈላጊ ነው። እባክዎ መረጃዎትን ያጠናክሩ። ጥያቄ በዚህ ስልክ 0951175959 ደውለው ይጠይቁ:: ለትብብርዎ እናመሰግናለን!! መልካም ስራ!';

export const DEFAULT_SMS_FAYDA_PENDING =
    'ሰላም {{name}}! የብሔራዊ መታወቂያ (Fayda) ሰነድዎ በመገምገም ላይ ነው። ውጤቱ እንደወጣ በመተግበሪያው ይነግሮታል። ጥያቄ በዚህ ስልክ 0951175959 ደውለው ይጠይቁ:: ለትብብርዎ እናመሰግናለን!!';

export type FaydaSmsSegment = 'approved-zero-services' | 'rejected' | 'none' | 'pending';

export function parseFaydaSmsSegment(raw: string | undefined): FaydaSmsSegment | undefined {
    if (!raw) return undefined;
    const v = raw.trim().toLowerCase();
    if (
        v === 'approved-zero-services' ||
        v === 'rejected' ||
        v === 'none' ||
        v === 'pending'
    ) {
        return v as FaydaSmsSegment;
    }
    return undefined;
}

export function resolveFaydaSegmentMessageTemplate(segment: FaydaSmsSegment): string {
    switch (segment) {
        case 'approved-zero-services':
            return process.env.SMS_FAYDA_APPROVED_ZERO_SERVICES ?? DEFAULT_SMS_APPROVED_ZERO_SERVICES;
        case 'rejected':
            return process.env.SMS_FAYDA_REJECTED ?? DEFAULT_SMS_FAYDA_REJECTED;
        case 'none':
            return process.env.SMS_FAYDA_NO_UPLOAD ?? DEFAULT_SMS_FAYDA_NO_UPLOAD;
        case 'pending':
            return process.env.SMS_FAYDA_PENDING ?? DEFAULT_SMS_FAYDA_PENDING;
    }
}
