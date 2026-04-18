const partnerLogoWidthPx = [96, 112, 130] as const;
const partnerLogoBreakpointPx = [640, 900] as const;

export function partnerLogoImageSizes(): string {
  const [w0, w1, w2] = partnerLogoWidthPx;
  const [bpSm, bpLg] = partnerLogoBreakpointPx;
  return `(max-width: ${bpSm - 1}px) ${w0}px, (max-width: ${bpLg - 1}px) ${w1}px, ${w2}px`;
}

export const partnerLogoBoxClassName =
  "relative shrink-0 w-[96px] h-[48px] sm:w-[112px] sm:h-[56px] min-[900px]:w-[130px] min-[900px]:h-[64px]";
