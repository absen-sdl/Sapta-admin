import { Anggota, Pembayaran, Prestasi, Pelanggaran, Absensi, Informasi, Banner } from './types';

declare global {
  interface Window {
    dataSdk: {
      create: (sheetName: string, data: any) => void;
      update: (sheetName: string, id: string, data: any) => void;
      delete: (sheetName: string, id: string) => void;
      read: (sheetName: string) => any[];
    };
  }
}

const STORAGE_KEYS: Record<string, string> = {
  'DATA ANGGOTA': 'panel_anggota',
  'PEMBAYARAN': 'panel_pembayaran',
  'PRESTASI': 'panel_prestasi',
  'PELANGGARAN': 'panel_pelanggaran',
  'ABSENSI': 'panel_absensi',
  'INFORMASI': 'panel_informasi',
  'INFORMASI ADMIN': 'panel_informasi_admin',
  'SURAT': 'panel_surat',
  'PERATURAN': 'panel_peraturan',
  'BANNER': 'panel_banner',
  'LOG NOTIFIKASI': 'panel_log_notifikasi',
};

// All mock/bot data arrays are completely empty, keeping only clean user-generated or synced data
const defaultAnggota: Anggota[] = [];
const defaultPembayaran: Pembayaran[] = [];
const defaultPrestasi: Prestasi[] = [];
const defaultPelanggaran: Pelanggaran[] = [];
const defaultAbsensi: Absensi[] = [];
const defaultInformasi: Informasi[] = [];
const defaultSurat: any[] = [];
const defaultPeraturan: any[] = [];
const defaultBanners: Banner[] = [];

export function initializeDatabase() {
  const isLoggedIn = localStorage.getItem('status_login') === 'true';
  const members = isLoggedIn ? [] : defaultAnggota;
  const pay = isLoggedIn ? [] : defaultPembayaran;
  const pres = isLoggedIn ? [] : defaultPrestasi;
  const plg = isLoggedIn ? [] : defaultPelanggaran;
  const abs = isLoggedIn ? [] : defaultAbsensi;
  const inf = isLoggedIn ? [] : defaultInformasi;
  const srt = isLoggedIn ? [] : defaultSurat;
  const reg = isLoggedIn ? [] : defaultPeraturan;
  const ban = isLoggedIn ? [] : defaultBanners;

  if (!localStorage.getItem(STORAGE_KEYS['DATA ANGGOTA'])) {
    localStorage.setItem(STORAGE_KEYS['DATA ANGGOTA'], JSON.stringify(members));
  }
  if (!localStorage.getItem(STORAGE_KEYS['PEMBAYARAN'])) {
    localStorage.setItem(STORAGE_KEYS['PEMBAYARAN'], JSON.stringify(pay));
  }
  if (!localStorage.getItem(STORAGE_KEYS['PRESTASI'])) {
    localStorage.setItem(STORAGE_KEYS['PRESTASI'], JSON.stringify(pres));
  }
  if (!localStorage.getItem(STORAGE_KEYS['PELANGGARAN'])) {
    localStorage.setItem(STORAGE_KEYS['PELANGGARAN'], JSON.stringify(plg));
  }
  if (!localStorage.getItem(STORAGE_KEYS['ABSENSI'])) {
    localStorage.setItem(STORAGE_KEYS['ABSENSI'], JSON.stringify(abs));
  }
  if (!localStorage.getItem(STORAGE_KEYS['INFORMASI'])) {
    localStorage.setItem(STORAGE_KEYS['INFORMASI'], JSON.stringify(inf));
  }
  if (!localStorage.getItem(STORAGE_KEYS['SURAT'])) {
    localStorage.setItem(STORAGE_KEYS['SURAT'], JSON.stringify(srt));
  }
  if (!localStorage.getItem(STORAGE_KEYS['PERATURAN'])) {
    localStorage.setItem(STORAGE_KEYS['PERATURAN'], JSON.stringify(reg));
  }
  if (!localStorage.getItem(STORAGE_KEYS['BANNER'])) {
    localStorage.setItem(STORAGE_KEYS['BANNER'], JSON.stringify(ban));
  }
  if (!localStorage.getItem(STORAGE_KEYS['INFORMASI ADMIN'])) {
    localStorage.setItem(STORAGE_KEYS['INFORMASI ADMIN'], JSON.stringify([]));
  }

  // FORCE RETROACTIVE CLEANUP OF OLD MOCK BOTS IN LOCAL STORAGE
  const botNias = ['20260001', '20260002', '20260003', '20260004'];
  const botNames = ['achmad fauzi', 'budi santoso', 'citra kirana', 'dewi lestari'];

  // Cleanup DATA ANGGOTA
  try {
    const rawAnggota = localStorage.getItem(STORAGE_KEYS['DATA ANGGOTA']);
    if (rawAnggota) {
      const data: Anggota[] = JSON.parse(rawAnggota);
      const cleaned = data.filter(item => 
        !botNias.includes(String(item.nia)) && 
        !botNames.includes(String(item.namaLengkap || '').toLowerCase())
      );
      if (cleaned.length !== data.length) {
        localStorage.setItem(STORAGE_KEYS['DATA ANGGOTA'], JSON.stringify(cleaned));
      }
    }
  } catch (e) {
    console.error('Error cleaning up members localStorage:', e);
  }

  // Cleanup PEMBAYARAN
  try {
    const rawPembayaran = localStorage.getItem(STORAGE_KEYS['PEMBAYARAN']);
    if (rawPembayaran) {
      const data: Pembayaran[] = JSON.parse(rawPembayaran);
      const cleaned = data.filter(item => 
        !botNias.includes(String(item.nia)) && 
        !botNames.includes(String(item.namaLengkap || '').toLowerCase())
      );
      if (cleaned.length !== data.length) {
        localStorage.setItem(STORAGE_KEYS['PEMBAYARAN'], JSON.stringify(cleaned));
      }
    }
  } catch (e) {
    console.error('Error cleaning up payments localStorage:', e);
  }

  // Cleanup PRESTASI
  try {
    const rawPrestasi = localStorage.getItem(STORAGE_KEYS['PRESTASI']);
    if (rawPrestasi) {
      const data: Prestasi[] = JSON.parse(rawPrestasi);
      const cleaned = data.filter(item => 
        !botNias.includes(String(item.nia)) && 
        !botNames.includes(String(item.namaLengkap || '').toLowerCase())
      );
      if (cleaned.length !== data.length) {
        localStorage.setItem(STORAGE_KEYS['PRESTASI'], JSON.stringify(cleaned));
      }
    }
  } catch (e) {
    console.error('Error cleaning up achievements localStorage:', e);
  }

  // Cleanup PELANGGARAN
  try {
    const rawPelanggaran = localStorage.getItem(STORAGE_KEYS['PELANGGARAN']);
    if (rawPelanggaran) {
      const data: Pelanggaran[] = JSON.parse(rawPelanggaran);
      const cleaned = data.filter(item => 
        !botNias.includes(String(item.nia)) && 
        !botNames.includes(String(item.nama || '').toLowerCase())
      );
      if (cleaned.length !== data.length) {
        localStorage.setItem(STORAGE_KEYS['PELANGGARAN'], JSON.stringify(cleaned));
      }
    }
  } catch (e) {
    console.error('Error cleaning up violations localStorage:', e);
  }

  // Cleanup ABSENSI
  try {
    const rawAbsensi = localStorage.getItem(STORAGE_KEYS['ABSENSI']);
    if (rawAbsensi) {
      const data: Absensi[] = JSON.parse(rawAbsensi);
      const cleaned = data.filter(item => 
        !botNias.includes(String(item.nia)) && 
        !botNames.includes(String(item.namaLengkap || '').toLowerCase())
      );
      if (cleaned.length !== data.length) {
        localStorage.setItem(STORAGE_KEYS['ABSENSI'], JSON.stringify(cleaned));
      }
    }
  } catch (e) {
    console.error('Error cleaning up attendance localStorage:', e);
  }
}

// Implement the global dataSdk
window.dataSdk = {
  create: (sheetName: string, data: any) => {
    initializeDatabase();
    const storageKey = STORAGE_KEYS[sheetName] || `panel_${sheetName.toLowerCase().replace(/\s+/g, '_')}`;
    const currentData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    currentData.push(data);
    localStorage.setItem(storageKey, JSON.stringify(currentData));
  },
  
  update: (sheetName: string, id: string, data: any) => {
    initializeDatabase();
    const storageKey = STORAGE_KEYS[sheetName] || `panel_${sheetName.toLowerCase().replace(/\s+/g, '_')}`;
    let currentData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // Find key based on sheet table structure
    const idKey = getIdKeyForSheet(sheetName);
    
    currentData = currentData.map((item: any) => {
      if (String(item[idKey]) === String(id) || String(item['nia']) === String(id) || String(item['Key'] || item['key']) === String(id)) {
        return { ...item, ...data };
      }
      return item;
    });
    localStorage.setItem(storageKey, JSON.stringify(currentData));
  },
  
  delete: (sheetName: string, id: string) => {
    initializeDatabase();
    const storageKey = STORAGE_KEYS[sheetName] || `panel_${sheetName.toLowerCase().replace(/\s+/g, '_')}`;
    let currentData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const idKey = getIdKeyForSheet(sheetName);
    
    currentData = currentData.filter((item: any) => {
      return String(item[idKey]) !== String(id) && String(item['nia']) !== String(id) && String(item['Key'] || item['key']) !== String(id);
    });
    localStorage.setItem(storageKey, JSON.stringify(currentData));
  },
  
  read: (sheetName: string) => {
    initializeDatabase();
    const storageKey = STORAGE_KEYS[sheetName] || `panel_${sheetName.toLowerCase().replace(/\s+/g, '_')}`;
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  }
};

function getIdKeyForSheet(sheetName: string): string {
  switch (sheetName) {
    case 'DATA ANGGOTA':
      return 'nia';
    case 'PEMBAYARAN':
      return 'idTransaksi';
    case 'PRESTASI':
      return 'idPrestasi';
    case 'PELANGGARAN':
      return 'idPelanggaran';
    case 'ABSENSI':
      return 'idAbsensi';
    case 'INFORMASI':
      return 'idInformasi';
    case 'INFORMASI ADMIN':
      return 'idInformasiAdmin';
    case 'SURAT':
      return 'idSurat';
    case 'PERATURAN':
      return 'idPeraturan';
    case 'BANNER':
      return 'idBanner';
    case 'LOG NOTIFIKASI':
      return 'idLog';
    default:
      return 'id';
  }
}
