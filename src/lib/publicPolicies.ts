import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface AppSettingsRow {
  id: string;
  data: unknown;
}

export interface PolicyContent {
  privacyPolicy: string;
  termsOfService: string;
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toPolicyValue(value: unknown): string {
  const text = toString(value).trim();
  if (!text) return "";
  if (text.startsWith("PASTE_") && text.endsWith("_HERE")) return "";
  return text;
}

export async function getPublicPolicies(): Promise<PolicyContent> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("id, data")
    .in("id", ["settings", "policy"]);

  if (error || !data)
    return { privacyPolicy: "", termsOfService: "" };

  const rows = data as AppSettingsRow[];
  const settingsRow = rows.find((row) => row.id === "settings");
  const policyRow = rows.find((row) => row.id === "policy");

  const settingsData = toObject(settingsRow?.data);
  const policyData = toObject(policyRow?.data);

  return {
    privacyPolicy: toPolicyValue(policyData.privacyPolicy) || toPolicyValue(settingsData.privacyPolicy),
    termsOfService:
      toPolicyValue(policyData.termsAndConditions) || toPolicyValue(settingsData.termsAndConditions),
  };
}
