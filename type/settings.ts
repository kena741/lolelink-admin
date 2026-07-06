export interface SettingsSchema {
  id?: string;
  appColor?: string;
  appName?: string;
  appVersion?: string;
  extraCharge_GST?: boolean;
  googleMapKey?: string;
  minimum_amount_deposit?: string;
  minimum_amount_withdraw?: string;
  notification_server_key?: string;
  phoneNumber?: string;
  radius?: string;
  referralAmount?: string;
  supportEmail?: string;
  supportURL?: string;
  aboutApp?: string;
  aboutAppZemenService?: string;
  aboutAppZemenProvider?: string;
  privacyPolicy?: string;
  termsAndConditions?: string;
  chapa?: string | Record<string, string | boolean | number | undefined>;
  telebirr?: string | Record<string, string | boolean | number | undefined>;
  wallet?: string | Record<string, string | boolean | number | undefined>;
}
