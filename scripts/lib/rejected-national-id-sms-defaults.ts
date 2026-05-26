export const DEFAULT_SMS_REJECTED_NATIONAL_ID =
    'ሰላም {{name}}! የብሔራዊ መታወቂያ (Fayda) ሰነድዎ ተገምጎ ውድቅ ተደርጓል። እባክዎ ትክክለኛውን የብሔራዊ መታወቂያ ሰነድ በዘመን ፕሮቫይደር መተግበሪያ ላይ እንደገና ያስገቡ ወይም ያዘምኑት። ጥያቄ በዚህ ስልክ 0951175959 ደውለው ይጠይቁ:: ለትብብርዎ እኡመሰግናለን!!';

export function resolveRejectedNationalIdMessageTemplate(): string {
    return process.env.SMS_REJECTED_NATIONAL_ID ?? DEFAULT_SMS_REJECTED_NATIONAL_ID;
}
