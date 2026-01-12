export interface Brand {
  id: string;
  name: string;
  logoText?: string;
  logoBg?: string;
  logoTextColor?: string;
  logoData?: string;
}

// Simple brand seeds with logo colors; can be replaced with real assets later.
export const brands: Brand[] = [
  {
    id: 'mitra',
    name: 'Mitra Bangunan',
    logoText: 'MB',
    logoBg: '#EF4444',
    logoTextColor: '#ffffff',
  },
  {
    id: 'supermart',
    name: 'Supermart',
    logoText: 'SM',
    logoBg: '#2563EB',
    logoTextColor: '#ffffff',
  },
  {
    id: 'freshlife',
    name: 'FreshLife',
    logoText: 'FL',
    logoBg: '#16A34A',
    logoTextColor: '#ffffff',
  },
];
