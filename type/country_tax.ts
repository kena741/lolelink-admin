export interface CountryTaxSchema {
  id: number;
  country?: string;
  name?: string;
  value?: number;
  active?: boolean;
  type?: string;
  isFix?: boolean;
  created_at?: string;
}
