const partnerLogoWidthPx = [96, 112, 144, 172] as const;
const partnerLogoBreakpointPx = [640, 900, 1200] as const;

export function partnerLogoImageSizes(): string {
  const [w0, w1, w2, w3] = partnerLogoWidthPx;
  const [bpSm, bpLg, bpXl] = partnerLogoBreakpointPx;
  return `(max-width: ${bpSm - 1}px) ${w0}px, (max-width: ${bpLg - 1}px) ${w1}px, (max-width: ${bpXl - 1}px) ${w2}px, ${w3}px`;
}

export const partnerLogoBoxClassName =
  "relative shrink-0 w-[96px] h-[48px] sm:w-[112px] sm:h-[56px] min-[900px]:w-[144px] min-[900px]:h-[72px] min-[1200px]:w-[172px] min-[1200px]:h-[86px]";
