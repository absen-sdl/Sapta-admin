import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home,
  Users,
  User,
  CreditCard,
  Trophy,
  AlertTriangle,
  Calendar,
  Settings,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Check,
  CheckCircle,
  X,
  XCircle,
  Info,
  Database,
  Send,
  Smartphone,
  Mail,
  MailOpen,
  MapPin,
  School,
  Image,
  ChevronRight,
  DownloadCloud,
  CheckSquare,
  DollarSign,
  AlertCircle,
  Award,
  ChevronDown,
  Lock,
  LogOut,
  EyeOff,
  Menu,
  Scale,
  FileText,
  Sun,
  Moon,
  UserCheck,
  Printer,
  Download
} from 'lucide-react';

import { initializeDatabase } from './dataSdk';
import { parseCSV, generateId, formatRupiah, formatDateString, getProp, terbilang } from './utils';
import { Anggota, Pembayaran, Prestasi, Pelanggaran, Absensi, Informasi, Surat, Peraturan, ActiveTab, ToastMessage } from './types';
import { GOOGLE_APPS_SCRIPT_CODE } from './googleAppsScriptCode';

// Local fetch override to transparently proxy external requests and bypass iframe sandbox CORS limitations
const originalFetch = window.fetch;
const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof input === 'object' && 'url' in input) {
    url = (input as any).url;
  }

  if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes(window.location.host)) {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    if (typeof input === 'string') {
      return originalFetch(proxyUrl, init);
    } else {
      try {
        const reqObj = input as Request;
        const headers: Record<string, string> = {};
        if (reqObj.headers) {
          reqObj.headers.forEach((value, key) => {
            headers[key] = value;
          });
        }
        
        let body: any = undefined;
        if (reqObj.method !== 'GET' && reqObj.method !== 'HEAD' && !reqObj.bodyUsed) {
          try {
            body = await reqObj.clone().text();
          } catch (e) {
            console.warn("Failed to clone request body:", e);
          }
        }
        
        return originalFetch(proxyUrl, {
          method: reqObj.method,
          headers: {
            ...headers,
            ...(init?.headers || {})
          },
          body: body || init?.body,
          credentials: reqObj.credentials || init?.credentials,
          mode: 'cors'
        });
      } catch (err) {
        console.warn("Proxy mapping failed, falling back to direct fetch", err);
        return originalFetch(input, init);
      }
    }
  }
  return originalFetch(input, init);
};

function getRowPrimaryKey(tab: string, row: any): string {
  if (!row) return '';
  if (tab === 'anggota') {
    return String(getProp(row, 'nia', 'id', 'nomorinduk', 'nomor') || '').trim();
  } else if (tab === 'pembayaran') {
    return String(getProp(row, 'idTransaksi', 'idtransaksi', 'id', 'transid') || '').trim();
  } else if (tab === 'prestasi') {
    return String(getProp(row, 'idPrestasi', 'idprestasi', 'id') || '').trim();
  } else if (tab === 'pelanggaran') {
    return String(getProp(row, 'idPelanggaran', 'idpelanggaran', 'id') || '').trim();
  } else if (tab === 'absensi') {
    return String(getProp(row, 'idAbsensi', 'idabsensi', 'id') || '').trim();
  } else if (tab === 'informasi') {
    return String(getProp(row, 'idInformasi', 'idinformasi', 'id') || '').trim();
  } else if (tab === 'surat') {
    return String(getProp(row, 'idSurat', 'idsurat', 'id') || '').trim();
  } else if (tab === 'peraturan') {
    return String(getProp(row, 'idPeraturan', 'idperaturan', 'id') || '').trim();
  }
  return '';
}

function MemberAvatar({ linkProfile, namaLengkap, className = "w-full h-full object-cover" }: { linkProfile: string; namaLengkap: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  const initials = namaLengkap ? namaLengkap.trim().substring(0, 2).toUpperCase() : '??';

  const isImageUrl = (url: string) => {
    if (!url) return false;
    const str = url.trim();
    return str.startsWith('http') || str.startsWith('data:image') || (str.includes('.') && str.includes('/'));
  };

  if (linkProfile && isImageUrl(linkProfile) && !hasError) {
    return (
      <img
        src={linkProfile}
        alt={namaLengkap}
        className={className}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    );
  }

  return <span className="select-none font-bold text-center tracking-normal leading-none flex items-center justify-center w-full h-full text-xs">{initials}</span>;
}

const getAbsensiStatus = (keterangan: string, status?: string): 'Hadir' | 'Izin' | 'Alpha' | 'Sakit' => {
  const s = (status || '').trim().toLowerCase();
  if (s.includes('sakit') || s === 's') return 'Sakit';
  if (s.includes('izin') || s.includes('ijin') || s === 'i') return 'Izin';
  if (s.includes('alpha') || s.includes('alpa') || s === 'a' || s.includes('tanpa') || s === 'bolos') return 'Alpha';
  if (s.includes('hadir') || s === 'h') return 'Hadir';

  const k = (keterangan || '').trim().toLowerCase();
  if (k.includes('sakit') || k === 's' || k.includes('dokter') || k.includes('opname') || k.includes('rawat')) return 'Sakit';
  if (k.includes('izin') || k.includes('ijin') || k === 'i' || k.includes('acara') || k.includes('keluarga') || k.includes('pergi') || k.includes('cuti') || k.includes('halangan') || k.includes('pulkam') || k.includes('dispen')) return 'Izin';
  if (k.includes('alpha') || k.includes('alpa') || k === 'a' || k.includes('tanpa keterangan') || k.includes('mangkir') || k === 'bolos') return 'Alpha';
  return 'Hadir';
};

const getCSVUrlForGid = (url: string, targetGid: string = '0'): string => {
  if (!url) return '';
  const trimmed = url.trim();
  
  if (trimmed.includes('/pub')) {
    let result = trimmed;
    if (result.includes('/pubhtml')) {
      result = result.replace('/pubhtml', '/pub');
    }
    if (!result.includes('output=csv')) {
      result += (result.includes('?') ? '&' : '?') + 'output=csv';
    }
    if (result.includes('gid=')) {
      result = result.replace(/gid=\d+/, `gid=${targetGid}`);
    } else {
      result += `&gid=${targetGid}`;
    }
    return result;
  }
  
  if (trimmed.includes('/spreadsheets/d/')) {
    const dMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (dMatch && dMatch[1]) {
      const spreadsheetId = dMatch[1];
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${targetGid}`;
    }
  }
  
  return trimmed;
};

const isSameDay = (d1Str: string, d2Str: string): boolean => {
  if (!d1Str || !d2Str) return false;
  try {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    }
  } catch (e) {
    // ignore
  }
  
  const getCleanDate = (s: string) => {
    return s.split('T')[0].trim();
  };
  return getCleanDate(d1Str) === getCleanDate(d2Str);
};

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [toastList, setToastList] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>('');
  const [absensiStatusFilter, setAbsensiStatusFilter] = useState<'Semua' | 'Hadir' | 'Izin' | 'Alpha' | 'Sakit'>('Semua');
  const [selectedKelasAnggota, setSelectedKelasAnggota] = useState<string>('Semua');
  const [selectedKelasAbsensi, setSelectedKelasAbsensi] = useState<string>('Semua');
  const [selectedNamaAbsensi, setSelectedNamaAbsensi] = useState<string>('Semua');
  const [isNamaDropdownOpen, setIsNamaDropdownOpen] = useState<boolean>(false);
  const [searchNamaQuery, setSearchNamaQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  
  // Theme state for main content area (Terang/Gelap)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Custom sidebar and dashboard view states
  const [isBiodataOpen, setIsBiodataOpen] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    setIsInIframe(window.self !== window.top);
    return () => clearInterval(timer);
  }, []);

  const formattedDateString = useMemo(() => {
    const days = ['Min', 'Senn', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dayName = days[currentTime.getDay()];
    const dateNum = currentTime.getDate();
    // Use year from image or current year dynamically
    const year = currentTime.getFullYear();
    let hours = currentTime.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = String(hours);
    let minutesStr = String(currentTime.getMinutes());
    if (minutesStr.length < 2) minutesStr = '0' + minutesStr;
    return `${dayName}, ${dateNum}, ${year}, ${hoursStr}:${minutesStr} ${ampm}`;
  }, [currentTime]);
  
  // Data State managed locally (from localStorage / initialized seed)
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [pembayaranList, setPembayaranList] = useState<Pembayaran[]>([]);
  const [prestasiList, setPrestasiList] = useState<Prestasi[]>([]);
  const [pelanggaranList, setPelanggaranList] = useState<Pelanggaran[]>([]);
  const [absensiList, setAbsensiList] = useState<Absensi[]>([]);
  const [informasiList, setInformasiList] = useState<Informasi[]>([]);
  const [suratList, setSuratList] = useState<Surat[]>([]);
  const [peraturanList, setPeraturanList] = useState<Peraturan[]>([]);

  // Integration Settings
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('status_login') === 'true';
  });

  const [gmailLogin, setGmailLogin] = useState<string>(() => {
    return localStorage.getItem('G-MAIL_LOGIN') || '';
  });

  const [lembagaLogin, setLembagaLogin] = useState<string>(() => {
    return localStorage.getItem('LEMBAGA_LOGIN') || '';
  });

  const [institusiProfileUrl, setInstitusiProfileUrl] = useState<string>(() => {
    return localStorage.getItem('LINK_PROFILE') || '';
  });

  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    if (localStorage.getItem('status_login') === 'true') {
      const savedScript = localStorage.getItem('LINK_SCRIPT_UTAMA');
      if (savedScript) return savedScript;
    }
    const cached = localStorage.getItem('google_apps_script_url');
    const oldUrl = 'https://script.google.com/macros/s/AKfycbwFdtUzcwC03yKoDgclL6923X0Cf2PAtOWuh3yzjTmEdNlLFZpYqZIEZeoH2NKMRFk/exec';
    const firstUpdateUrl = 'https://script.google.com/macros/s/AKfycbxu5Z5Mx4il8_8HQP_vySI5EhsBs3K_1yxd1qJmXlciCcqkQhwMD5NcDJPj9E776PI/exec';
    const oldDefaultUrl = 'https://script.google.com/macros/s/AKfycbyq9m26XszhhGeGZXnrWbJ_RqEVPeV4xM1uEMxhFUCkXhhibIkR2f6Q3PiwLYhVmaw/exec';
    if (!cached || cached === oldUrl || cached === firstUpdateUrl || cached === oldDefaultUrl) {
      return '';
    }
    return cached;
  });

  const [absensiCsvPublishUrl, setAbsensiCsvPublishUrl] = useState<string>(() => {
    if (localStorage.getItem('status_login') === 'true') {
      const savedAbsensi = localStorage.getItem('LINK_ABSENSI');
      if (savedAbsensi) {
        const targetGidMatch = savedAbsensi.match(/gid=(\d+)/);
        const targetGid = targetGidMatch && targetGidMatch[1] ? targetGidMatch[1] : '987258577';
        return getCSVUrlForGid(savedAbsensi, targetGid);
      }
    }
    return localStorage.getItem('google_sheets_absensi_csv_url') || '';
  });

  // --- SUB-ACCOUNT PORTAL INTEGRATION STATES ---
  const [userNama, setUserNama] = useState<string>(() => {
    return localStorage.getItem('USER_NAMA') || '';
  });

  const [userUsername, setUserUsername] = useState<string>(() => {
    return localStorage.getItem('USER_USERNAME') || '';
  });

  const [userMenu, setUserMenu] = useState<string>(() => {
    return localStorage.getItem('USER_MENU') || '';
  });

  const [userRemoveMenu, setUserRemoveMenu] = useState<string>(() => {
    return localStorage.getItem('USER_REMOVE_MENU') || '';
  });

  const [isLembagaVerified, setIsLembagaVerified] = useState<boolean>(false);
  const [lembagaAkunList, setLembagaAkunList] = useState<any[]>([]);

  // States for Manage Accounts (Kelola Akun Sapta) by Master Account
  const [subAccountList, setSubAccountList] = useState<any[]>([]);
  const [isLoadingSubAccounts, setIsLoadingSubAccounts] = useState<boolean>(false);
  const [subAccountsError, setSubAccountsError] = useState<string | null>(null);
  const [subAccountSearchQuery, setSubAccountSearchQuery] = useState<string>('');
  const [isSubAccountModalOpen, setIsSubAccountModalOpen] = useState<boolean>(false);
  const [subAccountModalType, setSubAccountModalType] = useState<'add' | 'edit'>('add');
  const [editingSubAccount, setEditingSubAccount] = useState<any | null>(null);
  const [subAccountFormValues, setSubAccountFormValues] = useState({
    nama: '',
    username: '',
    pasword: '',
    remove_menu: ''
  });
  const [isSavingSubAccount, setIsSavingSubAccount] = useState<boolean>(false);

  // --- STATES FOR CETAK & SIMPAN DATA TAB ---
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [printNotification, setPrintNotification] = useState<string | null>(null);
  const [cetakActiveSubTab, setCetakActiveSubTab] = useState<'kartu' | 'absensi' | 'pelanggaran'>('kartu');
  const [cetakSelectedNia, setCetakSelectedNia] = useState<string>('');
  const [cetakSelectedClass, setCetakSelectedClass] = useState<string>('Semua');
  const [cetakSelectedStatus, setCetakSelectedStatus] = useState<string>('Semua');
  const [cetakCardTheme, setCetakCardTheme] = useState<'blue' | 'gold' | 'red' | 'emerald'>(() => (localStorage.getItem('CETAK_CARD_THEME') as any) || 'blue');
  const [cetakCardOrientation, setCetakCardOrientation] = useState<'horizontal' | 'vertical'>(() => (localStorage.getItem('CETAK_CARD_ORIENTATION') as any) || 'horizontal');
  const [cetakSelectedMonth, setCetakSelectedMonth] = useState<string>('Semua');
  const [cetakCardBgFront, setCetakCardBgFront] = useState<string | null>(() => localStorage.getItem('CETAK_CARD_BG_FRONT') || null);
  const [cetakCardBgBack, setCetakCardBgBack] = useState<string | null>(() => localStorage.getItem('CETAK_CARD_BG_BACK') || null);
  const [cetakCardTextColorFront, setCetakCardTextColorFront] = useState<'white' | 'black'>(() => (localStorage.getItem('CETAK_CARD_TEXT_COLOR_FRONT') as any) || 'white');
  const [cetakCardTextColorBack, setCetakCardTextColorBack] = useState<'white' | 'black'>(() => (localStorage.getItem('CETAK_CARD_TEXT_COLOR_BACK') as any) || 'black');
  const [cetakCardHideHeader, setCetakCardHideHeader] = useState<boolean>(() => localStorage.getItem('CETAK_CARD_HIDE_HEADER') === 'true');
  const [cetakCardHideFooter, setCetakCardHideFooter] = useState<boolean>(() => localStorage.getItem('CETAK_CARD_HIDE_FOOTER') === 'true');
  const [printElementId, setPrintElementId] = useState<string | null>(null);

  const isMenuAllowed = (tab: ActiveTab): boolean => {
    if (tab === 'dashboard' || tab === 'pengaturan' || tab === 'cetak_data') return true;
    
    // Master account (Super Admin) can access everything, including kelola_akun
    const currentUsername = (localStorage.getItem('USER_USERNAME') || userUsername || '').toLowerCase();
    const currentGmail = (localStorage.getItem('G-MAIL_LOGIN') || gmailLogin || '').toLowerCase();
    const isMaster = isLoggedIn && currentUsername === currentGmail && currentGmail !== '';
    
    if (tab === 'kelola_akun') {
      return isMaster;
    }
    if (isMaster) return true;

    // Check if the tab is blocked by remove_menu column
    const removeMenuStr = localStorage.getItem('USER_REMOVE_MENU') || userRemoveMenu || '';
    if (removeMenuStr) {
      const removedList = removeMenuStr.toLowerCase().split(',').map(s => s.trim());
      const matchesTab = (term: string) => {
        if (!term) return false;
        if (term === tab) return true;
        if (tab === 'anggota' && (term.includes('anggota') || term.includes('member'))) return true;
        if (tab === 'pembayaran' && (term.includes('bayar') || term.includes('pembayaran') || term.includes('nominal') || term.includes('uang') || term.includes('keuangan') || term.includes('transaksi'))) return true;
        if (tab === 'prestasi' && term.includes('prestasi')) return true;
        if (tab === 'pelanggaran' && (term.includes('pelanggaran') || term.includes('hukum') || term.includes('disiplin'))) return true;
        if (tab === 'absensi' && (term.includes('absen') || term.includes('hadir') || term.includes('presensi'))) return true;
        if (tab === 'informasi' && (term.includes('informasi') || term.includes('info') || term.includes('kabar') || term.includes('pengumuman'))) return true;
        if (tab === 'surat' && (term.includes('surat') || term.includes('dokumen') || term.includes('letter'))) return true;
        if (tab === 'peraturan' && (term.includes('aturan') || term.includes('peraturan') || term.includes('regulasi'))) return true;
        return false;
      };
      if (removedList.some(term => matchesTab(term))) {
        return false; // Specifically removed/blocked!
      }
    }

    // Existing allow-list compatibility
    const savedMenu = localStorage.getItem('USER_MENU') || userMenu;
    if (savedMenu && savedMenu.trim() !== '') {
      const allowedNormalized = savedMenu.toLowerCase();
      if (tab === 'anggota' && (allowedNormalized.includes('anggota') || allowedNormalized.includes('member'))) return true;
      if (tab === 'pembayaran' && (allowedNormalized.includes('bayar') || allowedNormalized.includes('pembayaran') || allowedNormalized.includes('nominal') || allowedNormalized.includes('uang') || allowedNormalized.includes('keuangan') || allowedNormalized.includes('transaksi'))) return true;
      if (tab === 'prestasi' && allowedNormalized.includes('prestasi')) return true;
      if (tab === 'pelanggaran' && (allowedNormalized.includes('pelanggaran') || allowedNormalized.includes('hukum') || allowedNormalized.includes('disiplin'))) return true;
      if (tab === 'absensi' && (allowedNormalized.includes('absen') || allowedNormalized.includes('hadir') || allowedNormalized.includes('presensi'))) return true;
      if (tab === 'informasi' && (allowedNormalized.includes('informasi') || allowedNormalized.includes('info') || allowedNormalized.includes('kabar') || allowedNormalized.includes('pengumuman'))) return true;
      if (tab === 'surat' && (allowedNormalized.includes('surat') || allowedNormalized.includes('dokumen') || allowedNormalized.includes('letter'))) return true;
      if (tab === 'peraturan' && (allowedNormalized.includes('aturan') || allowedNormalized.includes('peraturan') || allowedNormalized.includes('regulasi'))) return true;
      
      return false;
    }
    
    return true;
  };

  const executeDevicePrint = (elementId: string) => {
    setPrintElementId(elementId);
    setPrintNotification("Menginisialisasi modul pencetakan perangkat...");
    const timeout = setTimeout(() => {
      try {
        window.print();
        setPrintNotification("Perintah cetak dikirim ke printer perangkat!");
      } catch (error) {
        console.error("Gagal meluncurkan print dialog:", error);
        setPrintNotification("Gagal mencetak. Silakan buka aplikasi pada Tab Baru demi compatibility penuh.");
      }
      setTimeout(() => setPrintNotification(null), 5000);
      setPrintElementId(null);
    }, 450);
  };

  const handleAutoPrint = (
    subTab: 'kartu' | 'absensi' | 'pelanggaran', 
    primaryKey: string, 
    elementId: string
  ) => {
    setActiveTab('cetak_data');
    setCetakActiveSubTab(subTab);
    if (subTab === 'kartu') {
      setCetakSelectedNia(primaryKey);
    } else if (subTab === 'absensi') {
      setCetakSelectedNia(primaryKey);
    } else if (subTab === 'pelanggaran') {
      setCetakSelectedNia(primaryKey);
    }
    executeDevicePrint(elementId);
  };

  const fetchSubAccounts = async () => {
    const endpoint = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || '';
    if (!endpoint) return;
    setIsLoadingSubAccounts(true);
    setSubAccountsError(null);
    try {
      const targetUrl = endpoint + (endpoint.includes('?') ? '&' : '?') + 'action=read&sheetName=' + encodeURIComponent('KELOLA AKUN');
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error('Gagal menghubungi App Script lembaga.');
      const resText = await response.text();
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(resText);
      } catch (e) {
        throw new Error('Data dari server tidak berformat JSON valid.');
      }
      if (parsedJson && parsedJson.error) {
        throw new Error(parsedJson.message || 'Error internal Google Sheets App Script.');
      }
      if (Array.isArray(parsedJson)) {
        const parsedAccounts = parsedJson.map((item: any) => {
          let nama = '';
          let username = '';
          let pasword = '';
          let removeMenu = '';
          let menu = '';

          Object.keys(item).forEach(key => {
            const lowerK = key.toLowerCase().replace(/_/g, ' ');
            const val = String(item[key] || '').trim();
            if (lowerK === 'nama' || lowerK === 'name' || lowerK.includes('nama lengkap') || lowerK.includes('fullname')) {
              nama = val;
            } else if (lowerK === 'username' || lowerK === 'user' || lowerK === 'login') {
              username = val;
            } else if (lowerK === 'pasword' || lowerK === 'password' || lowerK.includes('pass') || lowerK.includes('word')) {
              pasword = val;
            } else if (lowerK === 'menu' || lowerK.includes('akses') || lowerK.includes('fitur') || lowerK.includes('role')) {
              menu = val;
            } else if (lowerK === 'remove menu' || lowerK === 'remove_menu' || lowerK === 'removemenu' || lowerK.includes('hapus menu') || lowerK.includes('tidak diizinkan') || lowerK.includes('restricted')) {
              removeMenu = val;
            }
          });

          if (!nama) nama = String(item['nama'] || item['name'] || '').trim();
          if (!username) username = String(item['username'] || item['user'] || '').trim();
          if (!pasword) pasword = String(item['pasword'] || item['password'] || '').trim();
          if (!removeMenu) removeMenu = String(item['remove_menu'] || item['remove menu'] || item['hapus_menu'] || item['hapus menu'] || '').trim();
          if (!menu) menu = String(item['menu'] || item['aksesMenu'] || item['akses_menu'] || '').trim();

          return { nama, username, pasword, remove_menu: removeMenu, menu };
        }).filter(acc => acc.username || acc.nama);
        setSubAccountList(parsedAccounts);
      } else {
        throw new Error('Format dari sheet KELOLA AKUN tidak sesuai.');
      }
    } catch (err: any) {
      console.error(err);
      setSubAccountsError(err.message || 'Terjadi kesalahan saat memuat data akun sapta.');
    } finally {
      setIsLoadingSubAccounts(false);
    }
  };

  // --- AKUN SAPTA STATE FOR LOGIN PAGE ---
  const [akunList, setAkunList] = useState<any[]>([]);
  const [isFetchingAkun, setIsFetchingAkun] = useState<boolean>(false);
  const [fetchAkunError, setFetchAkunError] = useState<string | null>(null);
  
  // Login input fields state
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [selectedLembaga, setSelectedLembaga] = useState<string>('');
  const [lembagaSearch, setLembagaSearch] = useState<string>('');
  const [isLembagaDropdownOpen, setIsLembagaDropdownOpen] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isVerifyingLembaga, setIsVerifyingLembaga] = useState<boolean>(false);
  const [loginProgressText, setLoginProgressText] = useState<string>('');
  const [loginProgressStep, setLoginProgressStep] = useState<'idle' | 'auth' | 'anggota' | 'keuangan' | 'absensi' | 'selesai'>('idle');

  // Load Akun Sapta data from public Google Sheet
  const loadAkunData = async () => {
    setIsFetchingAkun(true);
    setFetchAkunError(null);
    try {
      const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlr9fg7nNZTIJ0v7s_qmQeXGEUL6iSW45TWeUy2pyPz-_660IiiQsbihqXX6oRxuOEPJ9P1uCmFtti/pub?gid=0&single=true&output=csv';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Koneksi sheet AKUN SAPTA gagal.');
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      if (parsed && parsed.length > 0) {
        const formatted = parsed.map((item: any) => {
          let gmail = '';
          let pasword = '';
          let lembaga = '';
          let urlAppScript = '';
          let urlAbsensi = '';
          let linkProfile = '';

          // Dynamically matches keys-case/space insensitive and handles any automated transformations by parseCSV
          Object.keys(item).forEach(key => {
            const rawKey = key.trim();
            const cleanKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            const val = String(item[key] || '').trim();

            if (cleanKey === 'gmail' || cleanKey === 'email' || cleanKey === 'gmailaddress' || cleanKey === 'mail' || cleanKey.includes('gmail') || cleanKey.includes('email') || cleanKey.includes('mail')) {
              gmail = val;
            } else if (cleanKey === 'pasword' || cleanKey === 'password' || cleanKey === 'pin' || cleanKey === 'key' || cleanKey.includes('pass') || cleanKey.includes('word') || cleanKey.includes('key')) {
              pasword = val;
            } else if ((cleanKey.includes('lembaga') && !cleanKey.includes('profile') && !cleanKey.includes('logo') && !cleanKey.includes('link')) || cleanKey === 'nama') {
              lembaga = val;
            } else if (cleanKey.includes('appscript') || cleanKey.includes('appsscript') || cleanKey.includes('linkserver') || cleanKey.includes('urlserver') || cleanKey.includes('script')) {
              urlAppScript = val;
            } else if (cleanKey.includes('profile') || cleanKey.includes('logo') || cleanKey.includes('foto') || cleanKey.includes('photo')) {
              linkProfile = val;
            } else if (cleanKey.includes('absensi') || (cleanKey.includes('absen') && !cleanKey.includes('id'))) {
              urlAbsensi = val;
            }
          });

          // Accurate fallbacks matching direct keys (including mappings done by parseCSV)
          if (!gmail) gmail = String(item['email'] || item['gmail'] || item['G-Mail'] || item['Gmail'] || '').trim();
          if (!pasword) pasword = String(item['key'] || item['Pasword'] || item['Password'] || item['pasword'] || item['password'] || '').trim();
          if (!lembaga) lembaga = String(item['lembaga'] || item['Lembaga USER NAME'] || item['Lembaga Username'] || item['Lembaga'] || '').trim();
          if (!urlAppScript) urlAppScript = String(item['urlAppScript'] || item['Link_App_script'] || item['Link_App_Script'] || item['url_app_script'] || '').trim();
          if (!linkProfile) linkProfile = String(item['linkProfile'] || item['profile lembaga'] || item['Profile Lembaga'] || item['link_profile'] || item['profile'] || '').trim();
          if (!urlAbsensi) urlAbsensi = String(item['urlAbsensi'] || item['url_absensi'] || item['Url Absensi'] || '').trim();

          return { gmail, pasword, lembaga, urlAppScript, urlAbsensi, linkProfile };
        }).filter(acc => acc.gmail || acc.lembaga);
        
        console.log('AKUN_SAPTA loaded successfully. Parsed count:', formatted.length, formatted);
        setAkunList(formatted);
      } else {
        throw new Error('Data sheet AKUN SAPTA kosong atau format tidak sesuai.');
      }
    } catch (err: any) {
      console.error(err);
      setFetchAkunError(err.message || 'Gagal mengambil data akun.');
    } finally {
      setIsFetchingAkun(false);
    }
  };

  // Synchronized cloud fetch helper
  const syncDataFromCloudUrls = async (
    customAppsScriptUrl?: string, 
    attendanceUrl?: string,
    onProgress?: (step: 'idle' | 'auth' | 'anggota' | 'keuangan' | 'absensi' | 'selesai', text: string) => void
  ) => {
    setIsLoading(true);
    addToast('Memulai pembaruan data otomatis dari basis data...', 'info');

    let syncAnggotaSuccess = false;
    let syncAbsensiSuccess = false;

    try {
      // Resolve the active Google Apps Script Web App URL
      const activeScriptUrl = customAppsScriptUrl || appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || localStorage.getItem('google_apps_script_url') || '';
      
      if (activeScriptUrl) {
        // Universal helper to fetch a sheet name and sync with local storage
        const fetchAndSyncSheet = async (
          sheetName: string,
          idKey: string,
          mapper: (item: any, idx: number) => any
        ): Promise<boolean> => {
          try {
            const targetUrl = activeScriptUrl + (activeScriptUrl.includes('?') ? '&' : '?') + 'action=read&sheetName=' + encodeURIComponent(sheetName);
            const response = await fetch(targetUrl);
            if (response.ok) {
              const resText = await response.text();
              let parsed: any[] = [];
              try {
                const json = JSON.parse(resText);
                if (Array.isArray(json)) {
                  parsed = json;
                } else if (json && Array.isArray(json.data)) {
                  parsed = json.data;
                } else if (json && Array.isArray(json.records)) {
                  parsed = json.records;
                }
              } catch (e) {
                parsed = parseCSV(resText);
              }

              const formatted = (parsed || [])
                .map((item: any, idx: number) => mapper(item, idx))
                .filter((x: any) => x && x[idKey]);

              const incomingIds = new Set(formatted.map((x: any) => String(x[idKey]).trim()).filter(Boolean));
              
              // Clean up local items that are NOT present in the downloaded Google Sheet data
              const localItems = window.dataSdk.read(sheetName);
              localItems.forEach((localItem: any) => {
                const idVal = String(localItem[idKey]).trim();
                // If the item ID is not in incoming Google Sheet list, delete it!
                if (idVal && !incomingIds.has(idVal)) {
                  window.dataSdk.delete(sheetName, localItem[idKey]);
                }
              });

              // Write/update incoming items to local database
              formatted.forEach((item: any) => {
                if (!item[idKey]) return;
                const existing = window.dataSdk.read(sheetName);
                const match = existing.find((e: any) => String(e[idKey]).trim() === String(item[idKey]).trim());
                if (match) {
                  window.dataSdk.update(sheetName, item[idKey], item);
                } else {
                  window.dataSdk.create(sheetName, item);
                }
              });
              return true;
            }
          } catch (sheetErr) {
            console.error(`Gagal sinkronisasi data sheet ${sheetName}:`, sheetErr);
          }
          return false;
        };

        // Sync DATA ANGGOTA (Member Data)
        onProgress?.('anggota', 'Menyelaraskan data Anggota Lembaga secara realtime...');
        syncAnggotaSuccess = await fetchAndSyncSheet('DATA ANGGOTA', 'nia', (item: any) => ({
          nia: String(getProp(item, 'nia', 'id', 'nomorinduk', 'nomor')).trim(),
          namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
          tempatLahir: String(getProp(item, 'tempatLahir', 'tempatlahir', 'tempat')).trim(),
          tanggalLahir: String(getProp(item, 'tanggalLahir', 'tanggallahir', 'tgllahir')).trim(),
          jenisKelamin: String(getProp(item, 'jenisKelamin', 'jeniskelamin', 'jk', 'gender')).trim(),
          jenjangPendidikan: String(getProp(item, 'jenjangPendidikan', 'jenjangpendidikan', 'jenjang', 'pendidikan')).trim(),
          namaSekolah: String(getProp(item, 'namaSekolah', 'namasekolah', 'sekolah')).trim(),
          kelas: String(getProp(item, 'kelas', 'class')).trim(),
          alamat: String(getProp(item, 'alamat', 'address')).trim(),
          noHp: String(getProp(item, 'noHp', 'nohp', 'phone', 'telepon', 'hp')).trim(),
          email: String(getProp(item, 'email', 'gmail')).trim(),
          key: String(getProp(item, 'key', 'pin', 'kunci', 'pass', 'sandi')).trim(),
          linkProfile: String(getProp(item, 'linkProfile', 'linkprofile', 'foto', 'photo', 'aksesfotoprofil', 'profile')).trim(),
          status: String(getProp(item, 'status', 'keadaan') || 'Aktif').trim(),
        }));

        // Sync PEMBAYARAN (Payments Data)
        onProgress?.('keuangan', 'Menyelaraskan buku besar keuangan, prestasi, sanksi, dan informasi...');
        await fetchAndSyncSheet('PEMBAYARAN', 'idTransaksi', (item: any, idx: number) => ({
          idTransaksi: String(getProp(item, 'idTransaksi', 'idtransaksi', 'id', 'transid') || `TRX-CL-${idx + 10001}`).trim(),
          tanggal: String(getProp(item, 'tanggal', 'tgl', 'date') || new Date().toISOString().split('T')[0]).trim(),
          nia: String(getProp(item, 'nia', 'idanggota', 'nomorinduk')).trim(),
          namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
          namaTagihan: String(getProp(item, 'namaTagihan', 'namatagihan', 'tagihan', 'keperluan', 'keterangan') || 'Pembayaran Kas/Spp').trim(),
          nominal: Number(getProp(item, 'nominal', 'jumlah', 'nominaltagihan', 'amount') || 0),
          status: String(getProp(item, 'status') || 'Lunas').trim(),
          keterangan: String(getProp(item, 'keterangan', 'notes', 'catatan')).trim()
        }));

        // Sync PRESTASI (Achievements Data)
        await fetchAndSyncSheet('PRESTASI', 'idPrestasi', (item: any, idx: number) => ({
          idPrestasi: String(getProp(item, 'idPrestasi', 'idprestasi', 'id') || `PST-CL-${idx + 10001}`).trim(),
          tanggal: String(getProp(item, 'tanggal', 'tgl', 'date') || new Date().toISOString().split('T')[0]).trim(),
          nia: String(getProp(item, 'nia', 'idanggota', 'nomorinduk')).trim(),
          namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
          jenisPrestasi: String(getProp(item, 'jenisPrestasi', 'jenisprestasi', 'kategori', 'jenis') || 'Sains').trim(),
          deskripsi: String(getProp(item, 'deskripsi', 'description', 'keterangan') || '').trim(),
          linkFoto: String(getProp(item, 'linkFoto', 'linkfoto', 'foto', 'photo', 'gambar') || '').trim()
        }));

        // Sync PELANGGARAN (Violations Data)
        await fetchAndSyncSheet('PELANGGARAN', 'idPelanggaran', (item: any, idx: number) => ({
          idPelanggaran: String(getProp(item, 'idPelanggaran', 'idpelanggaran', 'id') || `PLG-CL-${idx + 10001}`).trim(),
          tanggal: String(getProp(item, 'tanggal', 'tgl', 'date') || new Date().toISOString().split('T')[0]).trim(),
          nia: String(getProp(item, 'nia', 'idanggota', 'nomorinduk')).trim(),
          nama: String(getProp(item, 'nama', 'namalengkap', 'fullname')).trim(),
          jenisPelanggaran: String(getProp(item, 'jenisPelanggaran', 'jenispelanggaran', 'kategori', 'tingkat') || 'Ringan').trim(),
          namaPelanggaran: String(getProp(item, 'namaPelanggaran', 'namapelanggaran', 'pelanggaran', 'kasus') || '').trim(),
          keterangan: String(getProp(item, 'keterangan', 'notes', 'catatan', 'deskripsi') || '').trim(),
          adaDenda: String(getProp(item, 'adaDenda', 'adadenda', 'denda') || 'Tidak').trim(),
          nominalDenda: Number(getProp(item, 'nominalDenda', 'nominaldenda', 'jumlahdenda', 'dendatagihan') || 0),
          jenisHukuman: String(getProp(item, 'jenisHukuman', 'jenishukuman', 'sanksi', 'hukuman') || '').trim(),
          statusHukuman: String(getProp(item, 'statusHukuman', 'statushukuman', 'statustindaklanjut', 'tindaklanjut') || 'Belum Ditindak').trim() as any
        }));

        // Sync INFORMASI (Announcements/Information Data)
        await fetchAndSyncSheet('INFORMASI', 'idInformasi', (item: any, idx: number) => ({
          idInformasi: String(getProp(item, 'idInformasi', 'idinformasi', 'id') || `INF-CL-${idx + 10001}`).trim(),
          judul: String(getProp(item, 'judul', 'title', 'headline') || '').trim(),
          isi: String(getProp(item, 'isi', 'content', 'deskripsi', 'pengumuman') || '').trim(),
          jenisKegiatan: String(getProp(item, 'jenisKegiatan', 'jeniskegiatan', 'kategori', 'jenis') || 'Latihan Bersama').trim(),
          tanggal: String(getProp(item, 'tanggal', 'tgl', 'date') || new Date().toISOString().split('T')[0]).trim(),
          waktu: String(getProp(item, 'waktu', 'time', 'jam') || '--:--').trim()
        }));

        // Sync SURAT (Letter Data)
        await fetchAndSyncSheet('SURAT', 'idSurat', (item: any, idx: number) => ({
          idSurat: String(getProp(item, 'idSurat', 'idsurat', 'id') || `SRT-CL-${idx + 10001}`).trim(),
          tanggal: String(getProp(item, 'tanggal', 'tgl', 'date') || new Date().toISOString().split('T')[0]).trim(),
          nia: String(getProp(item, 'nia', 'idanggota', 'nomorinduk')).trim(),
          namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
          perihal: String(getProp(item, 'perihal', 'perihalsurat', 'hal', 'about') || '').trim(),
          linkGoogleDoc: String(getProp(item, 'linkGoogleDoc', 'linkgoogledoc', 'linkdokumen', 'url', 'link') || '').trim()
        }));

        // Sync PERATURAN (Rules Data)
        await fetchAndSyncSheet('PERATURAN', 'idPeraturan', (item: any, idx: number) => ({
          idPeraturan: String(getProp(item, 'idPeraturan', 'idperaturan', 'id') || `REG-CL-${idx + 10001}`).trim(),
          judul: String(getProp(item, 'judul', 'judulperaturan', 'peraturan', 'rule') || '').trim(),
          sanksi: String(getProp(item, 'sanksi', 'konsekuensi', 'hukuman') || '').trim(),
          status: String(getProp(item, 'status', 'tingkat', 'statuspelanggaran') || 'Ringan').trim() as any
        }));

        // 2. ABSENSI (read 100% from Google Apps Script Web App as requested)
        onProgress?.('absensi', 'Menyelaraskan data Rekap Absensi secara realtime dari server...');
        syncAbsensiSuccess = await fetchAndSyncSheet('ABSENSI', 'idAbsensi', (item: any, idx: number) => {
          const nia = String(getProp(item, 'nia', 'nomorinduk', 'idanggota', 'id')).trim();
          const tanggalAbsen = String(getProp(item, 'tanggal', 'tanggalAbsen', 'tanggalabsen', 'date') || new Date().toISOString().split('T')[0]).trim();
          const computedId = String(getProp(item, 'idAbsensi', 'idabsensi', 'id') || (nia && tanggalAbsen ? `${nia}-${tanggalAbsen}` : '') || `ABS-CL-${idx + 10001}`).trim();
          return {
            idAbsensi: computedId,
            nia: nia,
            namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
            kelas: String(getProp(item, 'kelas', 'class')).trim(),
            tanggalAbsen: tanggalAbsen,
            waktuAbsen: String(getProp(item, 'waktu', 'waktuAbsen', 'waktuabsen', 'waktu_absen', 'jamMasuk', 'jammasuk', 'jam_masuk', 'jam', 'jamabsen', 'jam_absen') || '--:--').trim(),
            status: String(getProp(item, 'status', 'kehadiran', 'state') || '').trim(),
            keterangan: String(getProp(item, 'keterangan', 'notes', 'catatan', 'keteranganabsen', 'remarks') || '').trim(),
            jenisKegiatan: String(getProp(item, 'jenisKegiatan', 'jeniskegiatan', 'kegiatan') || '').trim()
          };
        });
      } else {
        console.warn('Kemungkinan URL Apps Script belum terkonfigurasi untuk menyinkronkan data Anggota.');
      }

      refreshAllData();
      onProgress?.('selesai', 'Selesai! Mempersiapkan dashboard sistem...');

      if (syncAnggotaSuccess && syncAbsensiSuccess) {
        addToast('Lengkap! Data Anggota & Rekap Absensi berhasil diperbarui.', 'success');
      } else if (syncAnggotaSuccess) {
        addToast('Lengkap! Database Anggota & operasional berhasil diperbarui.', 'success');
      } else if (syncAbsensiSuccess) {
        addToast('Lengkap! Rekap Absensi berhasil diperbarui.', 'success');
      } else {
        addToast('Pemeriksaan file data selesai (Tidak ada perubahan baru).', 'info');
      }
    } catch (err: any) {
      console.error(err);
      addToast('Kesalahan penyelarasan data otomatis: ' + (err.message || err), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      loadAkunData();
      hasAutoSyncedRef.current = false;
    } else {
      if (!hasAutoSyncedRef.current) {
        hasAutoSyncedRef.current = true;
        const savedScript = localStorage.getItem('LINK_SCRIPT_UTAMA');
        const savedAbsensi = localStorage.getItem('LINK_ABSENSI');
        syncDataFromCloudUrls(savedScript || undefined, savedAbsensi || undefined);
      }
    }
  }, [isLoggedIn]);

  const handleVerifyLembaga = async () => {
    if (!selectedLembaga) {
      setLoginError('Silakan pilih Lembaga Anda terlebih dahulu.');
      return;
    }
    setIsVerifyingLembaga(true);
    setLoginError(null);
    try {
      // Find the selected institution in the master spreadsheet list
      let localAkunList = akunList;
      if (localAkunList.length === 0) {
        try {
          const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlr9fg7nNZTIJ0v7s_qmQeXGEUL6iSW45TWeUy2pyPz-_660IiiQsbihqXX6oRxuOEPJ9P1uCmFtti/pub?gid=0&single=true&output=csv';
          const response = await fetch(url);
          if (response.ok) {
            const csvText = await response.text();
            const parsed = parseCSV(csvText);
            if (parsed && parsed.length > 0) {
               localAkunList = parsed.map((item: any) => {
                let gmail = '';
                let pasword = '';
                let lembaga = '';
                let urlAppScript = '';
                let urlAbsensi = '';
                let linkProfile = '';

                Object.keys(item).forEach(key => {
                  const rawKey = key.trim();
                  const cleanKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const val = String(item[key] || '').trim();

                  if (cleanKey === 'gmail' || cleanKey === 'email' || cleanKey === 'gmailaddress' || cleanKey === 'mail' || cleanKey.includes('gmail') || cleanKey.includes('email') || cleanKey.includes('mail')) {
                    gmail = val;
                  } else if (cleanKey === 'pasword' || cleanKey === 'password' || cleanKey === 'pin' || cleanKey === 'key' || cleanKey.includes('pass') || cleanKey.includes('word') || cleanKey.includes('key')) {
                    pasword = val;
                  } else if ((cleanKey.includes('lembaga') && !cleanKey.includes('profile') && !cleanKey.includes('logo') && !cleanKey.includes('link')) || cleanKey === 'nama') {
                    lembaga = val;
                  } else if (cleanKey.includes('appscript') || cleanKey.includes('appsscript') || cleanKey.includes('linkserver') || cleanKey.includes('urlserver') || cleanKey.includes('script')) {
                    urlAppScript = val;
                  } else if (cleanKey.includes('profile') || cleanKey.includes('logo') || cleanKey.includes('foto') || cleanKey.includes('photo')) {
                    linkProfile = val;
                  } else if (cleanKey.includes('absensi') || (cleanKey.includes('absen') && !cleanKey.includes('id'))) {
                    urlAbsensi = val;
                  }
                });

                if (!gmail) gmail = String(item['email'] || item['gmail'] || item['G-Mail'] || item['Gmail'] || '').trim();
                if (!pasword) pasword = String(item['key'] || item['Pasword'] || item['Password'] || item['pasword'] || item['password'] || '').trim();
                if (!lembaga) lembaga = String(item['lembaga'] || item['Lembaga USER NAME'] || item['Lembaga Username'] || item['Lembaga'] || '').trim();
                if (!urlAppScript) urlAppScript = String(item['urlAppScript'] || item['Link_App_script'] || item['Link_App_Script'] || item['url_app_script'] || '').trim();
                if (!linkProfile) linkProfile = String(item['linkProfile'] || item['profile lembaga'] || item['Profile Lembaga'] || item['link_profile'] || item['profile'] || '').trim();
                if (!urlAbsensi) urlAbsensi = String(item['urlAbsensi'] || item['url_absensi'] || item['Url Absensi'] || '').trim();

                return { gmail, pasword, lembaga, urlAppScript, urlAbsensi, linkProfile };
              }).filter(acc => acc.gmail || acc.lembaga);
              setAkunList(localAkunList);
            }
          }
        } catch (fetchErr) {
          console.error("Gagal memuat darurat database lembaga:", fetchErr);
        }
      }

      const match = localAkunList.find(acc => acc.lembaga.toLowerCase() === selectedLembaga.toLowerCase());
      if (!match) {
        throw new Error('Lembaga tidak terdaftar dalam database utama.');
      }

      if (!match.urlAppScript) {
        throw new Error('Konfigurasi URL Google Apps Script untuk lembaga ini belum lengkap.');
      }

      // Fetch user sub-accounts from 'KELOLA AKUN' sheet via Google Apps Script
      setLoginProgressText('Membuka koneksi & mengunduh database akun...');
      const targetUrl = match.urlAppScript + (match.urlAppScript.includes('?') ? '&' : '?') + 'action=read&sheetName=' + encodeURIComponent('KELOLA AKUN');
      
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error('Gagal berkomunikasi dengan server App Script lembaga.');
      }

      const resText = await response.text();
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(resText);
      } catch (e) {
        throw new Error('Data user dari server tidak berformat JSON valid.');
      }

      if (parsedJson && parsedJson.error) {
        throw new Error(parsedJson.message || 'Error internal Google Sheets App Script.');
      }

      if (Array.isArray(parsedJson)) {
        const parsedAccounts = parsedJson.map((item: any) => {
          let nama = '';
          let username = '';
          let pasword = '';
          let menu = '';
          let removeMenu = '';

          Object.keys(item).forEach(key => {
            const lowerK = key.toLowerCase().replace(/_/g, ' ');
            const val = String(item[key] || '').trim();
            if (lowerK === 'nama' || lowerK === 'name' || lowerK.includes('nama lengkap') || lowerK.includes('fullname')) {
              nama = val;
            } else if (lowerK === 'username' || lowerK === 'user' || lowerK === 'login') {
              username = val;
            } else if (lowerK === 'pasword' || lowerK === 'password' || lowerK.includes('pass') || lowerK.includes('word')) {
              pasword = val;
            } else if (lowerK === 'menu' || lowerK.includes('akses') || lowerK.includes('fitur') || lowerK.includes('role')) {
              menu = val;
            } else if (lowerK === 'remove menu' || lowerK === 'remove_menu' || lowerK === 'removemenu' || lowerK.includes('hapus menu') || lowerK.includes('tidak diizinkan') || lowerK.includes('restricted')) {
              removeMenu = val;
            }
          });

          if (!nama) nama = String(item['nama'] || item['name'] || '').trim();
          if (!username) username = String(item['username'] || item['user'] || '').trim();
          if (!pasword) pasword = String(item['pasword'] || item['password'] || '').trim();
          if (!menu) menu = String(item['menu'] || item['aksesMenu'] || item['akses_menu'] || '').trim();
          if (!removeMenu) removeMenu = String(item['remove_menu'] || item['remove menu'] || item['hapus_menu'] || item['hapus menu'] || '').trim();

          return { nama, username, pasword, menu, removeMenu };
        }).filter(acc => acc.username || acc.nama);

        setLembagaAkunList(parsedAccounts);
        setIsLembagaVerified(true);
        addToast('Lembaga Terhubung! Silakan masukkan username dan password akun Anda.', 'success');
      } else {
        throw new Error('Sistem gagal membaca sheet "KELOLA AKUN". Buat sheet baru bernama KELOLA AKUN di Spreadsheet lembaga terlebih dahulu.');
      }
    } catch (err: any) {
      console.error(err);
      setLoginError('Error Verifikasi: ' + (err.message || 'Gagal memverifikasi lembaga.'));
    } finally {
      setIsVerifyingLembaga(false);
      setLoginProgressText('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setLoginError(null);

    const usernameTrimmed = emailInput.trim();
    const passwordTrimmed = passwordInput.trim();
    const lembagaTrimmed = selectedLembaga.trim();

    if (!lembagaTrimmed) {
      setLoginError('Silakan pilih Lembaga Anda.');
      return;
    }

    if (!isLembagaVerified) {
      setLoginError('Silakan klik "OKE" untuk verifikasi & memuat database akun lembaga Anda terlebih dahulu.');
      return;
    }

    if (!usernameTrimmed) {
      setLoginError('Silakan masukkan Username Anda.');
      return;
    }

    if (!passwordTrimmed) {
      setLoginError('Silakan masukkan Sandi Password Anda.');
      return;
    }

    setIsLoggingIn(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      const match = akunList.find(acc => acc.lembaga.toLowerCase() === lembagaTrimmed.toLowerCase());
      if (!match) {
        setLoginError('Sistem tidak menemukan informasi server untuk lembaga terpilih.');
        setIsLoggingIn(false);
        return;
      }

      // Check sub-accounts from 'KELOLA AKUN'
      let matchedUser = lembagaAkunList.find(u => 
        u.username.toLowerCase() === usernameTrimmed.toLowerCase() && 
        u.pasword === passwordTrimmed
      );

      // Superadmin fallback (Gmail master / password registered in the master list)
      if (!matchedUser) {
        const isMasterMatch = match.gmail.toLowerCase() === usernameTrimmed.toLowerCase() && match.pasword === passwordTrimmed;
        if (isMasterMatch) {
          matchedUser = {
            nama: 'Super Admin',
            username: match.gmail,
            pasword: match.pasword,
            menu: '', // Empty means all privileges
            removeMenu: ''
          };
        }
      }

       if (matchedUser) {
        const targetGidMatch = (match.urlAbsensi || '').match(/gid=(\d+)/);
        const targetGid = targetGidMatch && targetGidMatch[1] ? targetGidMatch[1] : '987258577';
        const formattedAbsensiUrl = match.urlAbsensi ? getCSVUrlForGid(match.urlAbsensi, targetGid) : '';

        setLoginProgressStep('auth');
        setLoginProgressText('Mengautentikasi dan menyelaraskan sesi lembaga...');
        await new Promise(resolve => setTimeout(resolve, 600));

        localStorage.setItem('LINK_SCRIPT_UTAMA', match.urlAppScript || '');
        localStorage.setItem('LINK_ABSENSI', match.urlAbsensi || '');
        localStorage.setItem('G-MAIL_LOGIN', match.gmail);
        localStorage.setItem('LEMBAGA_LOGIN', match.lembaga);
        localStorage.setItem('LINK_PROFILE', match.linkProfile || '');

        // Store sub-account custom states
        localStorage.setItem('USER_NAMA', matchedUser.nama || 'Amd');
        localStorage.setItem('USER_USERNAME', matchedUser.username);
        localStorage.setItem('USER_MENU', matchedUser.menu || '');
        localStorage.setItem('USER_REMOVE_MENU', matchedUser.removeMenu || '');

        localStorage.setItem('google_sheets_absensi_csv_url', formattedAbsensiUrl);
        localStorage.setItem('google_apps_script_url', match.urlAppScript);

        // Wipe default dummy offline sandbox data to avoid mixing with real custom Google Sheets data
        localStorage.removeItem('panel_anggota');
        localStorage.removeItem('panel_pembayaran');
        localStorage.removeItem('panel_prestasi');
        localStorage.removeItem('panel_pelanggaran');
        localStorage.removeItem('panel_absensi');
        localStorage.removeItem('panel_informasi');

        setAppsScriptUrl(match.urlAppScript);
        setAbsensiCsvPublishUrl(formattedAbsensiUrl);
        setGmailLogin(match.gmail);
        setLembagaLogin(match.lembaga);
        setInstitusiProfileUrl(match.linkProfile || '');

        // Set React States for Sub-Account
        setUserNama(matchedUser.nama || 'Amd');
        setUserUsername(matchedUser.username);
        setUserMenu(matchedUser.menu || '');
        setUserRemoveMenu(matchedUser.removeMenu || '');

        // Run sync data from cloud urls synchronously BEFORE declaring user logged in!
        await syncDataFromCloudUrls(match.urlAppScript, formattedAbsensiUrl, (step, text) => {
          setLoginProgressStep(step);
          setLoginProgressText(text);
        });

        setLoginProgressStep('selesai');
        setLoginProgressText('Selesai! Menyiapkan antarmuka utama...');
        await new Promise(resolve => setTimeout(resolve, 600));

        localStorage.setItem('status_login', 'true');
        setIsLoggedIn(true);
        setActiveTab('dashboard');
        
        hasAutoSyncedRef.current = true;
        addToast(`Login Berhasil! Selamat datang, ${matchedUser.nama || matchedUser.username}.`, 'success');
      } else {
        setLoginError('Username atau Sandi Password tidak cocok dengan database Lembaga terpilih.');
      }
    } catch (err: any) {
      setLoginError('Terjadi kesalahan koneksi server. Silakan coba lagi.');
    } finally {
      setIsLoggingIn(false);
      setLoginProgressStep('idle');
      setLoginProgressText('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('status_login');
    localStorage.removeItem('LINK_SCRIPT_UTAMA');
    localStorage.removeItem('LINK_ABSENSI');
    localStorage.removeItem('G-MAIL_LOGIN');
    localStorage.removeItem('LEMBAGA_LOGIN');
    localStorage.removeItem('LINK_PROFILE');
    localStorage.removeItem('google_apps_script_url');
    localStorage.removeItem('google_sheets_absensi_csv_url');
    localStorage.removeItem('USER_NAMA');
    localStorage.removeItem('USER_USERNAME');
    localStorage.removeItem('USER_MENU');
    localStorage.removeItem('USER_REMOVE_MENU');

    setAppsScriptUrl('');
    setAbsensiCsvPublishUrl('');
    setGmailLogin('');
    setLembagaLogin('');
    setInstitusiProfileUrl('');
    setIsLoggedIn(false);
    setEmailInput('');
    setPasswordInput('');
    setSelectedLembaga('');
    setLembagaSearch('');
    
    // Clear sub-account states
    setUserNama('');
    setUserUsername('');
    setUserMenu('');
    setUserRemoveMenu('');
    setIsLembagaVerified(false);
    setLembagaAkunList([]);

    hasAutoSyncedRef.current = false;
    addToast('Anda berhasil keluar dari sistem.', 'info');
  };

  // --- SUB-ACCOUNT MANAGE METHODS BY MASTER ADMIN ---
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  
  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const handleOpenAddSubAccount = () => {
    setSubAccountModalType('add');
    setEditingSubAccount(null);
    setSubAccountFormValues({
      nama: '',
      username: '',
      pasword: '',
      remove_menu: ''
    });
    setIsSubAccountModalOpen(true);
  };

  const handleOpenEditSubAccount = (acc: any) => {
    setSubAccountModalType('edit');
    setEditingSubAccount(acc);
    setSubAccountFormValues({
      nama: acc.nama,
      username: acc.username,
      pasword: acc.pasword,
      remove_menu: acc.remove_menu || ''
    });
    setIsSubAccountModalOpen(true);
  };

  const handleToggleRemoveMenu = (menuKey: string) => {
    const currentList = subAccountFormValues.remove_menu ? subAccountFormValues.remove_menu.split(',').map(s => s.trim()).filter(Boolean) : [];
    let newList: string[];
    if (currentList.includes(menuKey)) {
      newList = currentList.filter(m => m !== menuKey);
    } else {
      newList = [...currentList, menuKey];
    }
    setSubAccountFormValues(prev => ({
      ...prev,
      remove_menu: newList.join(',')
    }));
  };

  const handleSaveSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSubAccount) return;
    
    const namaVal = subAccountFormValues.nama.trim();
    const usernameVal = subAccountFormValues.username.trim();
    const passwordVal = subAccountFormValues.pasword.trim();
    
    if (!namaVal) {
      addToast('Nama lengkap tidak boleh kosong.', 'error');
      return;
    }
    if (!usernameVal) {
      addToast('Username tidak boleh kosong.', 'error');
      return;
    }
    if (!passwordVal) {
      addToast('Kata sandi tidak boleh kosong.', 'error');
      return;
    }
    
    if (subAccountModalType === 'add') {
      const usernameExists = subAccountList.some(acc => acc.username.toLowerCase() === usernameVal.toLowerCase());
      if (usernameExists) {
        addToast(`Username "@${usernameVal}" sudah terdaftar dalam sistem.`, 'error');
        return;
      }
    }
    
    setIsSavingSubAccount(true);
    
    const payload = {
      action: subAccountModalType === 'add' ? 'add' : 'edit',
      sheetName: 'KELOLA AKUN',
      targetId: subAccountModalType === 'edit' ? editingSubAccount.username : undefined,
      data: {
        nama: namaVal,
        username: usernameVal,
        pasword: passwordVal,
        remove_menu: subAccountFormValues.remove_menu,
        menu: ''
      }
    };

    if (subAccountModalType === 'add') {
      setSubAccountList(prev => [...prev, payload.data]);
    } else {
      setSubAccountList(prev => prev.map(acc => acc.username === editingSubAccount.username ? payload.data : acc));
    }

    try {
      const endpoint = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || '';
      if (!endpoint) {
        addToast('Gagal menyimpan: Tautan Google Apps Script tidak diset.', 'error');
        setIsSavingSubAccount(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      const resText = await response.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch (err) {}

      if (resJson && resJson.error) {
        throw new Error(resJson.message || 'Error dari server Sheets.');
      }

      addToast(subAccountModalType === 'add' ? 'Akun sub-member berhasil ditambahkan!' : 'Akun sub-member berhasil disimpan!', 'success');
      setIsSubAccountModalOpen(false);
      
      setTimeout(() => {
        fetchSubAccounts();
      }, 800);
    } catch (err: any) {
      console.error(err);
      addToast('Gagal sinkron cloud: ' + (err.message || 'Error koneksi'), 'error');
    } finally {
      setIsSavingSubAccount(false);
    }
  };

  const handleDeleteSubAccount = async (account: any) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun sub-member "${account.nama}" (@${account.username})?`)) {
      return;
    }
    
    setSubAccountList(prev => prev.filter(acc => acc.username !== account.username));
    addToast('Akun sedang dihapus...', 'info');

    const endpoint = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || '';
    if (!endpoint) {
      addToast('Tautan Google Apps Script kosong.', 'error');
      return;
    }

    const payload = {
      action: 'delete',
      sheetName: 'KELOLA AKUN',
      data: account,
      targetId: account.username
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      const resText = await response.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch (err) {}

      if (resJson && resJson.error) {
        throw new Error(resJson.message || 'Error dari server Sheets.');
      }

      addToast('Akun sub-member berhasil dihapus dari Google Sheets!', 'success');
      setTimeout(() => {
        fetchSubAccounts();
      }, 800);
    } catch (err: any) {
      console.error(err);
      addToast('Gagal menghapus akun di Cloud: ' + (err.message || 'Error koneksi'), 'error');
    }
  };

  // Selected details
  const [selectedProfile, setSelectedProfile] = useState<Anggota | null>(null);

  // Dynamic Form Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [modalTargetTab, setModalTargetTab] = useState<Exclude<ActiveTab, 'dashboard' | 'absensi' | 'pengaturan'>>('anggota');
  const [editTargetId, setEditTargetId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Dynamic Form Fields state
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  
  // Custom states for multi payments
  const [paymentItems, setPaymentItems] = useState<{ namaTagihan: string; nominal: number; keterangan: string }[]>([
    { namaTagihan: '', nominal: 0, keterangan: '' }
  ]);

  const handleUpdatePaymentItem = (index: number, key: string, value: any) => {
    setPaymentItems(prev => {
      const updated = prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, [key]: value };
        }
        return item;
      });

      // Auto-create next row if the current last row has some text
      const lastItem = updated[updated.length - 1];
      const hasContent = (lastItem.namaTagihan && String(lastItem.namaTagihan).trim() !== '') || 
                         (lastItem.nominal !== null && lastItem.nominal !== undefined && Number(lastItem.nominal) > 0);

      if (hasContent && index === prev.length - 1) {
        updated.push({ namaTagihan: '', nominal: 0, keterangan: '' });
      }

      return updated;
    });
  };
  
  // Custom Dropdown Seach State inside forms
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [isDropdownSearchOpen, setIsDropdownSearchOpen] = useState<boolean>(false);
  const [modalSelectedKelas, setModalSelectedKelas] = useState<string>('Semua');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasAutoSyncedRef = useRef<boolean>(false);

  // Custom Confirmation Dialog states to replace blocked iframe window.confirm APIs
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ tab: Exclude<ActiveTab, 'dashboard' | 'pengaturan'>; row: any } | null>(null);
  const [cleanConfirmOpen, setCleanConfirmOpen] = useState<boolean>(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState<boolean>(false);

  // Official transaction receipt (struk) modal states
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Official transaction receipt (struk) customization states loaded from localStorage or default
  const [receiptHeaderTitle, setReceiptHeaderTitle] = useState<string>(() => localStorage.getItem('RECEIPT_HEADER_TITLE') || '');
  const [receiptHeaderSub, setReceiptHeaderSub] = useState<string>(() => localStorage.getItem('RECEIPT_HEADER_SUB') || 'Bukti Pembayaran Resmi (Lunas)');
  const [receiptHeaderEmail, setReceiptHeaderEmail] = useState<string>(() => localStorage.getItem('RECEIPT_HEADER_EMAIL') || '');
  const [receiptHeaderAddress, setReceiptHeaderAddress] = useState<string>(() => localStorage.getItem('RECEIPT_HEADER_ADDRESS') || 'Jl. Raya Sektor Bersama No. 10, Jakarta');
  const [receiptShowTrxDetails, setReceiptShowTrxDetails] = useState<boolean>(() => localStorage.getItem('RECEIPT_SHOW_TRX_DETAILS') !== 'false');
  const [receiptDiscountPercent, setReceiptDiscountPercent] = useState<number>(() => Number(localStorage.getItem('RECEIPT_DISCOUNT_PERCENT') || '0'));
  const [receiptPpnPercent, setReceiptPpnPercent] = useState<number>(() => Number(localStorage.getItem('RECEIPT_PPN_PERCENT') || '0'));
  const [receiptFooterThankYou, setReceiptFooterThankYou] = useState<string>(() => localStorage.getItem('RECEIPT_FOOTER_THANK_Y') || 'TERIMA KASIH ATAS KOPERASI & PEMBAYARAN ANDA');
  const [receiptFooterSub, setReceiptFooterSub] = useState<string>(() => localStorage.getItem('RECEIPT_FOOTER_SUB') || '*struk resmi yang diakui secara digital oleh bendahara lembaga.');
  const [receiptMediaSosial, setReceiptMediaSosial] = useState<string>(() => localStorage.getItem('RECEIPT_MEDIA_SOSIAL') || '@sapta.official • www.saptaweb.id');
  const [receiptCashPaid, setReceiptCashPaid] = useState<number>(0);

  // Effect to persist receipt customization settings
  useEffect(() => {
    localStorage.setItem('RECEIPT_HEADER_TITLE', receiptHeaderTitle);
    localStorage.setItem('RECEIPT_HEADER_SUB', receiptHeaderSub);
    localStorage.setItem('RECEIPT_HEADER_EMAIL', receiptHeaderEmail);
    localStorage.setItem('RECEIPT_HEADER_ADDRESS', receiptHeaderAddress);
    localStorage.setItem('RECEIPT_SHOW_TRX_DETAILS', String(receiptShowTrxDetails));
    localStorage.setItem('RECEIPT_DISCOUNT_PERCENT', String(receiptDiscountPercent));
    localStorage.setItem('RECEIPT_PPN_PERCENT', String(receiptPpnPercent));
    localStorage.setItem('RECEIPT_FOOTER_THANK_Y', receiptFooterThankYou);
    localStorage.setItem('RECEIPT_FOOTER_SUB', receiptFooterSub);
    localStorage.setItem('RECEIPT_MEDIA_SOSIAL', receiptMediaSosial);
  }, [receiptHeaderTitle, receiptHeaderSub, receiptHeaderEmail, receiptHeaderAddress, receiptShowTrxDetails, receiptDiscountPercent, receiptPpnPercent, receiptFooterThankYou, receiptFooterSub, receiptMediaSosial]);

  // Effect to persist ID Card design settings
  useEffect(() => {
    localStorage.setItem('CETAK_CARD_THEME', cetakCardTheme);
    localStorage.setItem('CETAK_CARD_ORIENTATION', cetakCardOrientation);
    if (cetakCardBgFront) localStorage.setItem('CETAK_CARD_BG_FRONT', cetakCardBgFront);
    else localStorage.removeItem('CETAK_CARD_BG_FRONT');
    if (cetakCardBgBack) localStorage.setItem('CETAK_CARD_BG_BACK', cetakCardBgBack);
    else localStorage.removeItem('CETAK_CARD_BG_BACK');
    localStorage.setItem('CETAK_CARD_TEXT_COLOR_FRONT', cetakCardTextColorFront);
    localStorage.setItem('CETAK_CARD_TEXT_COLOR_BACK', cetakCardTextColorBack);
    localStorage.setItem('CETAK_CARD_HIDE_HEADER', String(cetakCardHideHeader));
    localStorage.setItem('CETAK_CARD_HIDE_FOOTER', String(cetakCardHideFooter));
  }, [cetakCardTheme, cetakCardOrientation, cetakCardBgFront, cetakCardBgBack, cetakCardTextColorFront, cetakCardTextColorBack, cetakCardHideHeader, cetakCardHideFooter]);

  // Load and initialize data
  const refreshAllData = () => {
    initializeDatabase();
    setAnggotaList(window.dataSdk.read('DATA ANGGOTA'));
    setPembayaranList(window.dataSdk.read('PEMBAYARAN'));
    setPrestasiList(window.dataSdk.read('PRESTASI'));
    setPelanggaranList(window.dataSdk.read('PELANGGARAN'));
    setAbsensiList(window.dataSdk.read('ABSENSI'));
    setInformasiList(window.dataSdk.read('INFORMASI'));
    setSuratList(window.dataSdk.read('SURAT'));
    setPeraturanList(window.dataSdk.read('PERATURAN'));
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Close custom drop search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- TOAST NOTIFICATIONS ---
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    setToastList((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToastList((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToastList((prev) => prev.filter((t) => t.id !== id));
  };

  // --- SYNC FROM GOOGLE APPS SCRIPT WEB APP (DATA ANGGOTA) ---
  const handleSyncAnggota = async () => {
    setIsLoading(true);
    try {
      const activeScriptUrl = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || localStorage.getItem('google_apps_script_url') || '';
      if (!activeScriptUrl) {
        addToast('Gagal pembaruan: Tautan server utama belum dikonfigurasi. Silakan masuk atau konfigurasi di bagian Pengaturan.', 'error');
        setIsLoading(false);
        return;
      }
      addToast('Memulai pembaruan data dari basis data pusat...', 'info');
      const url = activeScriptUrl + (activeScriptUrl.includes('?') ? '&' : '?') + 'action=read&sheetName=DATA%20ANGGOTA';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Koneksi Web App Server gagal.');
      const resText = await response.text();
      
      let parsed: any[] = [];
      try {
        const json = JSON.parse(resText);
        if (Array.isArray(json)) {
          parsed = json;
        } else if (json && Array.isArray(json.data)) {
          parsed = json.data;
        } else if (json && Array.isArray(json.records)) {
          parsed = json.records;
        }
      } catch (jsonErr) {
        parsed = parseCSV(resText);
      }
      
      if (parsed && parsed.length > 0) {
        // Standardize properties keys slightly to match lowercase keys or expected schema inside app
        const formatted = parsed.map((item: any) => ({
          nia: String(getProp(item, 'nia', 'id', 'nomorinduk', 'nomor')).trim(),
          namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
          tempatLahir: String(getProp(item, 'tempatLahir', 'tempatlahir', 'tempat')).trim(),
          tanggalLahir: String(getProp(item, 'tanggalLahir', 'tanggallahir', 'tgllahir')).trim(),
          jenisKelamin: String(getProp(item, 'jenisKelamin', 'jeniskelamin', 'jk', 'gender')).trim(),
          jenjangPendidikan: String(getProp(item, 'jenjangPendidikan', 'jenjangpendidikan', 'jenjang', 'pendidikan')).trim(),
          namaSekolah: String(getProp(item, 'namaSekolah', 'namasekolah', 'sekolah')).trim(),
          kelas: String(getProp(item, 'kelas', 'class')).trim(),
          alamat: String(getProp(item, 'alamat', 'address')).trim(),
          noHp: String(getProp(item, 'noHp', 'nohp', 'phone', 'telepon', 'hp')).trim(),
          email: String(getProp(item, 'email', 'gmail')).trim(),
          key: String(getProp(item, 'key', 'pin', 'kunci', 'pass', 'sandi')).trim(),
          linkProfile: String(getProp(item, 'linkProfile', 'linkprofile', 'foto', 'photo', 'aksesfotoprofil', 'profile')).trim(),
          status: String(getProp(item, 'status', 'keadaan') || 'Aktif').trim()
        })).filter(m => m.nia);

        let deleteCount = 0;
        if (formatted.length > 0) {
          // 1. Clean up local members that are NOT present in the downloaded Google Sheet data
          const incomingNias = new Set(
            formatted
              .map((m: any) => String(m.nia).trim())
              .filter(Boolean)
          );

          const localMembers = window.dataSdk.read('DATA ANGGOTA');
          localMembers.forEach((localMember: any) => {
            const niaStr = String(localMember.nia).trim();
            if (niaStr && !incomingNias.has(niaStr)) {
              window.dataSdk.delete('DATA ANGGOTA', localMember.nia);
              deleteCount++;
            }
          });

          // 2. Write/update incoming members to local SDK
          formatted.forEach((member) => {
            if (!member.nia) return;
            const existing = window.dataSdk.read('DATA ANGGOTA');
            const match = existing.find((e: any) => String(e.nia).trim() === String(member.nia).trim());
            if (match) {
              window.dataSdk.update('DATA ANGGOTA', member.nia, member);
            } else {
              window.dataSdk.create('DATA ANGGOTA', member);
            }
          });
        }

        refreshAllData();
        if (deleteCount > 0) {
          addToast(`Pembaruan sukses! Menghapus ${deleteCount} anggota yang tidak aktif dari database.`, 'success');
        } else {
          addToast(`Data Anggota berhasil diperbarui (${formatted.length} rekam)!`, 'success');
        }
      } else {
        addToast('Data CSV kosong atau tidak valid.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      addToast('Gagal memperbarui data berkas, menggunakan basis data lokal.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAbsensi = async () => {
    setIsLoading(true);
    addToast('Memulai pembaruan rekap absensi dari database pusat...', 'info');
    try {
      const activeAbsensiUrl = absensiCsvPublishUrl || localStorage.getItem('LINK_ABSENSI') || localStorage.getItem('google_sheets_absensi_csv_url') || '';
      if (!activeAbsensiUrl) {
        addToast('Gagal pembaruan: Tautan Rekap Absensi belum dikonfigurasi. Silakan masuk atau konfigurasi di bagian Pengaturan.', 'error');
        setIsLoading(false);
        return;
      }
      
      const targetAbsensiGid = activeAbsensiUrl.includes('gid=') ? (activeAbsensiUrl.match(/gid=(\d+)/)?.[1] || '987258577') : '987258577';
      const url = getCSVUrlForGid(activeAbsensiUrl, targetAbsensiGid);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Koneksi sheet absensi gagal.');
      
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      
      if (parsed && parsed.length > 0) {
        const formatted = parsed.map((item: any, idx: number) => {
          const computedId = String(item.idAbsensi || item.idabsensi || item.id || `ABS-CL-${idx + 10001}`).trim();

          return {
            idAbsensi: computedId,
            nia: String(getProp(item, 'nia', 'nomorinduk', 'idanggota')).trim(),
            namaLengkap: String(getProp(item, 'namaLengkap', 'namalengkap', 'nama', 'fullname')).trim(),
            kelas: String(getProp(item, 'kelas', 'class')).trim(),
            tanggalAbsen: String(getProp(item, 'tanggalAbsen', 'tanggalabsen', 'tanggal', 'date') || new Date().toISOString().split('T')[0]).trim(),
            waktuAbsen: String(getProp(item, 'waktuAbsen', 'waktuabsen', 'waktu_absen', 'waktu', 'jamMasuk', 'jammasuk', 'jam_masuk', 'jam', 'jamabsen', 'jam_absen') || '--:--').trim(),
            keterangan: String(getProp(item, 'keterangan', 'notes', 'catatan', 'keteranganabsen', 'remarks') || '').trim(),
            jenisKegiatan: String(getProp(item, 'jenisKegiatan', 'jeniskegiatan', 'kegiatan') || '').trim()
          };
        });

        let deleteCount = 0;
        if (formatted.length > 0) {
          // 1. Clean up local absensi that is NOT present in the downloaded Google Sheet / Apps Script data
          const incomingIds = new Set(
            formatted
              .map((a: any) => String(a.idAbsensi).trim())
              .filter(Boolean)
          );

          const localAbsensi = window.dataSdk.read('ABSENSI');
          localAbsensi.forEach((localItem: any) => {
            const itemId = String(localItem.idAbsensi).trim();
            if (itemId && !incomingIds.has(itemId)) {
              window.dataSdk.delete('ABSENSI', localItem.idAbsensi);
              deleteCount++;
            }
          });

          // 2. Write/update incoming absensi to local SDK
          formatted.forEach((abs) => {
            if (!abs.idAbsensi) return;
            const existing = window.dataSdk.read('ABSENSI');
            const match = existing.find((e: any) => String(e.idAbsensi).trim() === String(abs.idAbsensi).trim());
            if (match) {
              window.dataSdk.update('ABSENSI', abs.idAbsensi, abs);
            } else {
              window.dataSdk.create('ABSENSI', abs);
            }
          });
        }

        refreshAllData();
        if (deleteCount > 0) {
          addToast(`Pembaruan sukses! Menghapus ${deleteCount} rekam absensi usang. Berhasil memuat ${formatted.length} rekam absensi baru ke dalam sistem.`, 'success');
        } else {
          addToast(`Rekap Absensi berhasil diperbarui (${formatted.length} rekam)!`, 'success');
        }
      } else {
        addToast('Data absensi kosong atau tidak valid.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      addToast('Gagal memperbarui data absensi dari berkas database.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- DELETE ALL MEMBERS ---
  const handleDeleteAllAnggota = () => {
    setDeleteAllConfirmOpen(true);
  };

  const executeDeleteAllAnggota = () => {
    setDeleteAllConfirmOpen(false);
    try {
      localStorage.setItem('panel_anggota', JSON.stringify([]));
      setAnggotaList([]);
      addToast('Semua data anggota lokal berhasil dihapus!', 'success');
    } catch (e: any) {
      addToast('Gagal menghapus data anggota: ' + e.message, 'error');
    }
  };

  // --- DELETE UNREGISTERED MEMBERS ---
  const handleDeleteUnregisteredMembers = async () => {
    setCleanConfirmOpen(true);
  };

  const executeDeleteUnregisteredMembers = async () => {
    setCleanConfirmOpen(false);
    setIsLoading(true);
    try {
      const activeScriptUrl = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || localStorage.getItem('google_apps_script_url') || '';
      if (!activeScriptUrl) {
        addToast('Gagal pembaruan: Tautan server utama belum dikonfigurasi. Silakan masuk atau konfigurasi di bagian Pengaturan.', 'error');
        setIsLoading(false);
        return;
      }
      addToast('Memeriksa keanggotaan aktif dari basis data pusat...', 'info');
      const url = activeScriptUrl + (activeScriptUrl.includes('?') ? '&' : '?') + 'action=read&sheetName=DATA%20ANGGOTA';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Koneksi Web App Server gagal.');
      const resText = await response.text();
      
      let parsed: any[] = [];
      try {
        const json = JSON.parse(resText);
        if (Array.isArray(json)) {
          parsed = json;
        } else if (json && Array.isArray(json.data)) {
          parsed = json.data;
        } else if (json && Array.isArray(json.records)) {
          parsed = json.records;
        }
      } catch (jsonErr) {
        parsed = parseCSV(resText);
      }
      
      if (parsed && parsed.length > 0) {
        // Ambil daftar NIA di Google Sheet
        const sheetNias = new Set(
          parsed.map((item: any) => String(getProp(item, 'nia', 'id', 'nomorinduk', 'nomor') || '').trim()).filter(Boolean)
        );

        // Ambil anggota lokal
        const localMembers = window.dataSdk.read('DATA ANGGOTA');
        let deleteCount = 0;

        localMembers.forEach((localMember: any) => {
          const niaStr = String(localMember.nia).trim();
          if (niaStr && !sheetNias.has(niaStr)) {
            window.dataSdk.delete('DATA ANGGOTA', localMember.nia);
            deleteCount++;
          }
        });

        refreshAllData();
        if (deleteCount > 0) {
          addToast(`Berhasil! Menghapus ${deleteCount} anggota lokal yang tidak ditemukan/tidak aktif di server utama.`, 'success');
        } else {
          addToast('Seluruh data anggota lokal Anda sudah sesuai dengan database utama!', 'info');
        }
      } else {
        addToast('Gagal memuat data utama atau format kosong.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      addToast('Gagal memeriksa data utama. Silakan periksa URL berkas Anda.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- DYNAMIC FORM CONFIGS ---
  const modalConfigs = useMemo(() => {
    return {
      anggota: {
        title: modalType === 'add' ? 'Tambah Anggota Baru' : 'Edit Data Anggota',
        sheetName: 'DATA ANGGOTA',
        fields: [
          { name: 'nia', label: 'NIA', type: 'text', required: true, placeholder: 'Contoh: 20260005', disabled: modalType === 'edit' },
          { name: 'namaLengkap', label: 'Nama Lengkap', type: 'text', required: true, placeholder: 'Nama sesuai identitas resmi' },
          { name: 'tempatLahir', label: 'Tempat Lahir', type: 'text', required: true, placeholder: 'Kota kelahiran' },
          { name: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date', required: true },
          { name: 'jenisKelamin', label: 'Jenis Kelamin', type: 'select', options: ['Laki-laki', 'Perempuan'], required: true },
          { name: 'jenjangPendidikan', label: 'Jenjang Pendidikan', type: 'select', options: ['SD', 'SMP', 'SMA', 'Kuliah', 'Umum'], required: true },
          { name: 'namaSekolah', label: 'Nama Sekolah', type: 'text', placeholder: 'Ketik nama sekolah/institusi' },
          { name: 'kelas', label: 'Kelas', type: 'text', placeholder: 'Contoh: 11 IPA 3' },
          { name: 'alamat', label: 'Alamat', type: 'textarea', placeholder: 'Alamat lengkap beserta kode pos jika ada' },
          { name: 'noHp', label: 'No Hp', type: 'text', placeholder: '08xxxxxxxxxx' },
          { name: 'email', label: 'E-Mail', type: 'text', placeholder: 'alamat@email.com' },
          { name: 'key', label: 'PIN', type: 'text', placeholder: 'Ketik PIN login' },
          { name: 'linkProfile', label: 'Link-Profile', type: 'text', placeholder: 'https://images.unsplash.com/...' },
          { name: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Non-Aktif', 'Alumni'], required: true }
        ]
      },
      pembayaran: {
        title: modalType === 'add' ? 'Catat Transaksi Pembayaran' : 'Edit Transaksi Pembayaran',
        sheetName: 'PEMBAYARAN',
        fields: [
          { name: 'tanggal', label: 'Tanggal Transaksi', type: 'date', required: true },
          { name: 'nia', label: 'Pilih Anggota', type: 'dropdown-search', required: true },
          { name: 'namaTagihan', label: 'Nama Tagihan / Keperluan', type: 'text', required: true, placeholder: 'SPP Mei 2026, Uang Pangkal, Seragam, dll.' },
          { name: 'nominal', label: 'Nominal Tagihan (Rupiah)', type: 'number', required: true, placeholder: 'Jumlah nominal tanpa simbol Rp atau titik' },
          { name: 'status', label: 'Status Pembayaran', type: 'select', options: ['Lunas', 'Sebagian', 'Belum Bayar'], required: true },
          { name: 'keterangan', label: 'Keterangan Tambahan', type: 'textarea', placeholder: 'Contoh: Pembayaran cicilan tahap 1' }
        ]
      },
      prestasi: {
        title: modalType === 'add' ? 'Unggah Prestasi Anggota' : 'Edit Data Prestasi',
        sheetName: 'PRESTASI',
        fields: [
          { name: 'tanggal', label: 'Tanggal Pencapaian', type: 'date', required: true },
          { name: 'nia', label: 'Pilih Anggota', type: 'dropdown-search', required: true },
          { name: 'jenisPrestasi', label: 'Jenis Kategori Prestasi', type: 'select', options: ['Akademik', 'Sains', 'Olahraga', 'Seni', 'Agama', 'Sosial', 'Lainnya'], required: true },
          { name: 'deskripsi', label: 'Deskripsi / Detail Penghargaan', type: 'textarea', required: true, placeholder: 'Contoh: Juara 1 Kejuaraan Karate antar wilayah se-DKI' },
          { name: 'linkFoto', label: 'Link Foto Piagam/Piala (URL)', type: 'text', placeholder: 'URL gambar piala atau sertifikat' }
        ]
      },
      pelanggaran: {
        title: modalType === 'add' ? 'Catat Indisipliner / Pelanggaran' : 'Edit Data Pelanggaran',
        sheetName: 'PELANGGARAN',
        fields: [
          { name: 'tanggal', label: 'Tanggal Kejadian', type: 'date', required: true },
          { name: 'nia', label: 'Pilih Anggota', type: 'dropdown-search', required: true },
          { name: 'jenisPelanggaran', label: 'Kadar Pelanggaran', type: 'select', options: ['Ringan', 'Sedang', 'Berat'], required: true },
          { name: 'namaPelanggaran', label: 'Nama/Jenis Pelanggaran', type: 'text', required: true, placeholder: 'Contoh: Membolos, Merokok, Berantem' },
          { name: 'keterangan', label: 'Keterangan Kronologi', type: 'textarea', placeholder: 'Rincian detail kronologi kejadian di tempat' },
          { name: 'adaDenda', label: 'Dikenai Denda Uang?', type: 'select', options: ['Tidak', 'Ya'], required: true },
          { name: 'nominalDenda', label: 'Nominal Denda (Jika Ada)', type: 'number', placeholder: 'Isi 0 jika tidak ada denda' },
          { name: 'jenisHukuman', label: 'Bentuk Hukuman / Sanksi', type: 'text', required: true, placeholder: 'Teguran tertulis, Kerja sosial, Skorsing 3 hari' },
          { name: 'statusHukuman', label: 'Status Tindak Lanjut', type: 'select', options: ['Belum Ditindak', 'Proses', 'Selesai'], required: true }
        ]
      },
      informasi: {
        title: modalType === 'add' ? 'Tambah Informasi Baru' : 'Edit Rekam Informasi',
        sheetName: 'INFORMASI',
        fields: [
          { name: 'judul', label: 'Judul Informasi', type: 'text', required: true, placeholder: 'Contoh: Latihan Rutin Gabungan atau Pengumuman Posko' },
          { name: 'isi', label: 'Isi Informasi / Pengumuman', type: 'textarea', required: true, placeholder: 'Ketik pesan lengkap atau detail pengumuman...' },
          { name: 'jenisKegiatan', label: 'Jenis Kegiatan', type: 'text', required: true, placeholder: 'Contoh: Latihan Bersama, Sosialisasi, Ujian, Rapat' },
          { name: 'tanggal', label: 'Tanggal Pelaksanaan', type: 'date', required: true },
          { name: 'waktu', label: 'Waktu (Jam)', type: 'text', required: true, placeholder: 'Contoh: 15:30 WIB atau 09:00 - 12:00' }
        ]
      },
      surat: {
        title: modalType === 'add' ? 'Buat / Tambah Surat Baru' : 'Edit Rekam Surat',
        sheetName: 'SURAT',
        fields: [
          { name: 'tanggal', label: 'Tanggal Surat', type: 'date', required: true },
          { name: 'nia', label: 'Pilih Anggota Terkait', type: 'dropdown-search', required: true },
          { name: 'perihal', label: 'Perihal Surat', type: 'textarea', required: true, placeholder: 'Keterangan perihal surat, contoh: Pemanggilan atas pelanggaran tingkat berat...' },
          { name: 'linkGoogleDoc', label: 'Link Dokumen', type: 'text', required: true, placeholder: 'https://docs.google.com/document/d/...' }
        ]
      },
      peraturan: {
        title: modalType === 'add' ? 'Tambah Peraturan' : 'Edit Peraturan',
        sheetName: 'PERATURAN',
        fields: [
          { name: 'judul', label: 'Judul Peraturan', type: 'text', required: true, placeholder: 'Contoh: Aturan Ketertiban Asrama / Jam Malam' },
          { name: 'sanksi', label: 'Sanksi / Konsekuensi', type: 'textarea', required: true, placeholder: 'Tulis penjelasan sanksi/konsekuensi regulasi ini...' },
          { name: 'status', label: 'Status Pelanggaran (Mekanisme)', type: 'select', options: ['Ringan', 'Sedang', 'Berat'], required: true }
        ]
      }
    };
  }, [modalType]);

  // --- OPEN FORM MODAL ACTION ---
  const handleOpenAddModal = (tab: Exclude<ActiveTab, 'dashboard' | 'absensi' | 'pengaturan'>) => {
    setModalTargetTab(tab);
    setModalType('add');
    setModalSelectedKelas('Semua');
    
    // Set default initial values nicely
    const today = new Date().toISOString().split('T')[0];
    const initialVals: Record<string, any> = {};
    
    if (tab === 'pembayaran') {
      initialVals.tanggal = today;
      initialVals.nominal = 0;
      initialVals.status = 'Lunas';
      setPaymentItems([{ namaTagihan: '', nominal: 0, keterangan: '' }]);
    } else if (tab === 'prestasi') {
      initialVals.tanggal = today;
      initialVals.jenisPrestasi = 'Akademik';
    } else if (tab === 'pelanggaran') {
      initialVals.tanggal = today;
      initialVals.jenisPelanggaran = 'Ringan';
      initialVals.adaDenda = 'Tidak';
      initialVals.nominalDenda = 0;
      initialVals.statusHukuman = 'Belum Ditindak';
    } else if (tab === 'anggota') {
      initialVals.status = 'Aktif';
      initialVals.jenisKelamin = 'Laki-laki';
      initialVals.jenjangPendidikan = 'SMA';
    } else if (tab === 'informasi') {
      initialVals.tanggal = today;
      initialVals.waktu = '09:00 WIB';
      initialVals.jenisKegiatan = 'Sosialisasi';
    } else if (tab === 'surat') {
      initialVals.tanggal = today;
      initialVals.perihal = '';
      initialVals.linkGoogleDoc = '';
    } else if (tab === 'peraturan') {
      initialVals.status = 'Ringan';
      initialVals.judul = '';
      initialVals.sanksi = '';
    }
    
    setFormValues(initialVals);
    setMemberSearchQuery('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tab: Exclude<ActiveTab, 'dashboard' | 'absensi' | 'pengaturan'>, row: any) => {
    setModalTargetTab(tab);
    setModalType('edit');
    setModalSelectedKelas('Semua');
    
    // Map ID keys using robust helper
    const idValue = getRowPrimaryKey(tab, row);
    
    setEditTargetId(idValue);
    setFormValues({ ...row });
    
    // Pre-populate dropdown-search display
    const matchedMember = anggotaList.find(m => String(m.nia) === String(row.nia));
    if (matchedMember) {
      setMemberSearchQuery(`${matchedMember.nia} | ${matchedMember.namaLengkap}`);
    } else {
      setMemberSearchQuery(row.nia || '');
    }
    
    setIsModalOpen(true);
  };

  // --- SUBMIT FORM HANDLER (PARALLEL & ANTI-STUCK) ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const config = modalConfigs[modalTargetTab];
    const sheetName = config.sheetName;

    // Programmatic verification of all required fields
    for (const field of config.fields) {
      if (modalTargetTab === 'pembayaran' && modalType === 'add' && ['namaTagihan', 'nominal'].includes(field.name)) {
        continue;
      }
      if (field.required) {
        const val = formValues[field.name];
        if (val === undefined || val === null || String(val).trim() === '') {
          addToast(`Kolom "${field.label}" wajib diisi!`, 'error');
          setIsSubmitting(false);
          return;
        }
      }
    }
    
    // Validate custom multi-payment items if adding payment
    let validItems = [...paymentItems];
    if (modalTargetTab === 'pembayaran' && modalType === 'add') {
      validItems = paymentItems.filter(item => item.namaTagihan && item.namaTagihan.trim() !== '');
      if (validItems.length === 0) {
        addToast('Harap isi minimal 1 item pembayaran!', 'error');
        setIsSubmitting(false);
        return;
      }
    }
    
    // Auto generate ID based on Type if adding
    let submissionData = { ...formValues };
    let primaryKey = '';
    
    if (modalType === 'add') {
      if (modalTargetTab === 'pembayaran') {
        primaryKey = generateId('TRX');
        submissionData.idTransaksi = primaryKey;
      } else if (modalTargetTab === 'prestasi') {
        primaryKey = generateId('PST');
        submissionData.idPrestasi = primaryKey;
      } else if (modalTargetTab === 'pelanggaran') {
        primaryKey = generateId('PLG');
        submissionData.idPelanggaran = primaryKey;
      } else if (modalTargetTab === 'informasi') {
        primaryKey = generateId('INF');
        submissionData.idInformasi = primaryKey;
      } else if (modalTargetTab === 'surat') {
        primaryKey = generateId('SRT');
        submissionData.idSurat = primaryKey;
      } else if (modalTargetTab === 'peraturan') {
        primaryKey = generateId('REG');
        submissionData.idPeraturan = primaryKey;
      } else {
        primaryKey = submissionData.nia;
        submissionData.tanggalDaftar = new Date().toISOString().split('T')[0];
      }
    } else {
      primaryKey = editTargetId;
      // Force populate primary key field in submissionData based on active tab on edit mode
      if (modalTargetTab === 'pembayaran') {
        submissionData.idTransaksi = primaryKey;
      } else if (modalTargetTab === 'prestasi') {
        submissionData.idPrestasi = primaryKey;
      } else if (modalTargetTab === 'pelanggaran') {
        submissionData.idPelanggaran = primaryKey;
      } else if (modalTargetTab === 'informasi') {
        submissionData.idInformasi = primaryKey;
      } else if (modalTargetTab === 'surat') {
        submissionData.idSurat = primaryKey;
      } else if (modalTargetTab === 'peraturan') {
        submissionData.idPeraturan = primaryKey;
      } else {
        submissionData.nia = primaryKey;
      }
    }

    // Auto-populate Name field in transaction databases by matching NIA
    if (modalTargetTab !== 'anggota' && modalTargetTab !== 'informasi' && modalTargetTab !== 'peraturan') {
      const selectedNia = submissionData.nia;
      if (selectedNia && selectedNia !== 'ALL_MEMBERS') {
        const matchedMember = anggotaList.find(m => String(m.nia) === String(selectedNia));
        if (matchedMember) {
          submissionData.namaLengkap = matchedMember.namaLengkap;
          submissionData.nama = matchedMember.namaLengkap; // Pelanggaran has 'nama' field, others 'namaLengkap'
        }
      }
    }

    const isBulk = modalTargetTab === 'pembayaran' && submissionData.nia === 'ALL_MEMBERS';
    let recordsToSync: { data: any; targetId: string }[] = [];

    // 1. LOCAL TRANSACTION SAVE (Encased in try-catch to avoid blocking SPA)
    try {
      if (modalType === 'add') {
        if (modalTargetTab === 'pembayaran') {
          if (isBulk) {
            // Bulk Insert - create transaction for every single member in database for each paid item
            recordsToSync = [];
            anggotaList.forEach((member) => {
              validItems.forEach((item) => {
                const trxId = generateId('TRX');
                const bulkRecord = {
                  ...submissionData,
                  idTransaksi: trxId,
                  nia: member.nia,
                  namaLengkap: member.namaLengkap,
                  namaTagihan: item.namaTagihan,
                  nominal: Number(item.nominal) || 0,
                  keterangan: item.keterangan || ''
                };
                recordsToSync.push({
                  data: bulkRecord,
                  targetId: trxId
                });
              });
            });

            recordsToSync.forEach((rec) => {
              window.dataSdk.create(sheetName, rec.data);
            });
          } else {
            // Personal Insert - dynamic multi items for single member
            recordsToSync = [];
            validItems.forEach((item) => {
              const trxId = generateId('TRX');
              const singleRecord = {
                ...submissionData,
                idTransaksi: trxId,
                namaTagihan: item.namaTagihan,
                nominal: Number(item.nominal) || 0,
                keterangan: item.keterangan || ''
              };
              recordsToSync.push({
                data: singleRecord,
                targetId: trxId
              });
            });

            recordsToSync.forEach((rec) => {
              window.dataSdk.create(sheetName, rec.data);
            });
          }
        } else {
          window.dataSdk.create(sheetName, submissionData);
          recordsToSync.push({ data: submissionData, targetId: primaryKey });
        }
      } else {
        window.dataSdk.update(sheetName, primaryKey, submissionData);
        recordsToSync.push({ data: submissionData, targetId: primaryKey });
      }
    } catch (localErr) {
      console.warn("Fungsi database lokal (window.dataSdk) mengalami kendala, error diabaikan:", localErr);
      if (recordsToSync.length === 0) {
        if (modalTargetTab === 'pembayaran' && modalType === 'add') {
          if (isBulk) {
            recordsToSync = [];
            anggotaList.forEach((member) => {
              validItems.forEach((item) => {
                const trxId = generateId('TRX');
                const bulkRecord = {
                  ...submissionData,
                  idTransaksi: trxId,
                  nia: member.nia,
                  namaLengkap: member.namaLengkap,
                  namaTagihan: item.namaTagihan,
                  nominal: Number(item.nominal) || 0,
                  keterangan: item.keterangan || ''
                };
                recordsToSync.push({ data: bulkRecord, targetId: trxId });
              });
            });
          } else {
            recordsToSync = [];
            validItems.forEach((item) => {
              const trxId = generateId('TRX');
              const singleRecord = {
                ...submissionData,
                idTransaksi: trxId,
                namaTagihan: item.namaTagihan,
                nominal: Number(item.nominal) || 0,
                keterangan: item.keterangan || ''
              };
              recordsToSync.push({ data: singleRecord, targetId: trxId });
            });
          }
        } else {
          if (isBulk) {
            recordsToSync = anggotaList.map((member) => {
              const trxId = generateId('TRX');
              return {
                data: {
                  ...submissionData,
                  idTransaksi: trxId,
                  nia: member.nia,
                  namaLengkap: member.namaLengkap
                },
                targetId: trxId
              };
            });
          } else {
            recordsToSync.push({ data: submissionData, targetId: primaryKey });
          }
        }
      }
    }

    // 2. PARALLEL & ASYNCHRONOUS EXPORT TO GOOGLE SCRIPT WEB APP
    const syncToAppsScript = async () => {
      const endpoint = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || localStorage.getItem('google_apps_script_url') || '';
      if (!endpoint) {
        console.warn("Sinkronisasi Apps Script ditiadakan: URL kosong.");
        return;
      }
      
      try {
        await Promise.all(
          recordsToSync.map(async (item) => {
            const payload = {
              action: modalType === 'add' ? 'add' : 'edit',
              sheetName: sheetName,
              data: item.data,
              targetId: item.targetId
            };

            await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'text/plain'
              },
              body: JSON.stringify(payload)
            });
          })
        );
      } catch (cloudErr) {
        console.error("Gagal sinkronisasi data ke cloud Google Apps Script:", cloudErr);
      }
    };

    // Run parallelly without awaiting to ensure frictionless user execution
    syncToAppsScript();

    // 3. UI RESPONSE AND REFRESH DEFERRAL
    setIsModalOpen(false);
    addToast('Data Diproses!', 'success');

    // Check if payment transaction is official and completed (Lunas) to display physical/digital receipt popup
    if (modalTargetTab === 'pembayaran' && submissionData.status === 'Lunas') {
      setReceiptData(submissionData);
      setIsReceiptModalOpen(true);
    }
    
    // Delay refresh to provide seamless transition and let Apps script network run slightly
    setTimeout(() => {
      refreshAllData();
      setIsSubmitting(false);
      // Optional state reload
    }, 850);
  };

  const handleKirimSuratWa = (row: Surat) => {
    const matchedMem = anggotaList.find(m => String(m.nia) === String(row.nia));
    const rawNoHp = matchedMem ? matchedMem.noHp : '';
    let cleanPhone = rawNoHp.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }
    
    const messageTemplate = `Halo Bapak/Ibu Wali dari ${row.namaLengkap} (NIA: ${row.nia}),\n\n` +
      `Kami menyampaikan surat resmi perihal: "${row.perihal || '-'}".\n\n` +
      `Silakan akses & unduh dokumen resmi melalui tautan berikut:\n` +
      `${row.linkGoogleDoc}\n\n` +
      `Terima kasih atas perhatian Bapak/Ibu,\n` +
      `Lembaga Admin Panel`;
      
    const encodedMessage = encodeURIComponent(messageTemplate);
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;
      
    window.open(waUrl, '_blank');
  };

  // --- DELETE HANDLER (Custom trigger to avoid iframe prompt block) ---
  const handleDeleteRow = async (tab: Exclude<ActiveTab, 'dashboard' | 'pengaturan'>, row: any) => {
    setDeleteConfirmTarget({ tab, row });
  };

  const executeDeleteRow = async (tab: Exclude<ActiveTab, 'dashboard' | 'pengaturan'>, row: any) => {
    setDeleteConfirmTarget(null);
    let sheetName = '';

    if (tab === 'anggota') {
      sheetName = 'DATA ANGGOTA';
    } else if (tab === 'pembayaran') {
      sheetName = 'PEMBAYARAN';
    } else if (tab === 'prestasi') {
      sheetName = 'PRESTASI';
    } else if (tab === 'pelanggaran') {
      sheetName = 'PELANGGARAN';
    } else if (tab === 'absensi') {
      sheetName = 'ABSENSI';
    } else if (tab === 'informasi') {
      sheetName = 'INFORMASI';
    } else if (tab === 'surat') {
      sheetName = 'SURAT';
    } else if (tab === 'peraturan') {
      sheetName = 'PERATURAN';
    }

    const targetId = getRowPrimaryKey(tab, row);

    // 1. Local Delete with try-catch
    try {
      window.dataSdk.delete(sheetName, targetId);
      refreshAllData(); // Refresh local list state immediately!
    } catch (localErr) {
      console.warn("Bypass local delete error:", localErr);
    }

    // 2. Parallel Cloud sync delete
    const deleteFromCloud = async () => {
      const endpoint = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || localStorage.getItem('google_apps_script_url') || '';
      if (!endpoint) {
        console.warn("Sinkronisasi hapus Apps Script ditiadakan: URL kosong.");
        return;
      }
      const payload = {
        action: 'delete',
        sheetName: sheetName,
        data: row,
        targetId: targetId
      };
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify(payload)
        });
      } catch (cloudErr) {
        console.error("Gagal sinkron data hapus dari cloud:", cloudErr);
      }
    };
    
    deleteFromCloud();

    addToast('Data berhasil dihapus dan perintah sinkronisasi dikirim!', 'success');
  };

  // --- STATE FOR INTERACTIVE DASHBOARD TABLES ---
  const [newDataAnggotaBaru, setNewDataAnggotaBaru] = useState([
    { id: '1', nama: 'Nama Lengkap', ttl: '25 May 2024', wa: '0921 5567789', email: 'saptadipndigital.com', status: 'Pending', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
    { id: '2', nama: 'Siti Sarah', ttl: '23 May 2024', wa: '0921 5567789', email: 'sayla@spndigital.com', status: 'Diperlukan Verifikasi WA', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
    { id: '3', nama: 'Ahmad Dani', ttl: '25 May 2024', wa: '0021 5567789', email: 'saytadtpndigital.com', status: 'Diperlukan Verifikasi WA', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' }
  ]);

  const handleApproveAnggotaBaru = (id: string, name: string) => {
    setNewDataAnggotaBaru(prev => prev.map(item => item.id === id ? { ...item, status: 'Disetujui' } : item));
    addToast(`Anggota ${name} berhasil disetujui!`, 'success');
  };

  const handleRejectAnggotaBaru = (id: string, name: string) => {
    setNewDataAnggotaBaru(prev => prev.map(item => item.id === id ? { ...item, status: 'Ditolak' } : item));
    addToast(`Verifikasi anggota ${name} ditolak.`, 'error');
  };

  // --- DYNAMIC UNIQUE CLASS OPTIONS ---
  const uniqueClassesAnggota = useMemo(() => {
    const classes = anggotaList
      .map(m => m ? m.kelas : '')
      .filter(Boolean)
      .map(c => String(c).trim());
    return Array.from(new Set(classes)).sort((a: string, b: string) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [anggotaList]);

  const uniqueClassesAbsensi = useMemo(() => {
    const classes = absensiList
      .map(a => a ? a.kelas : '')
      .filter(Boolean)
      .map(c => String(c).trim());
    return Array.from(new Set(classes)).sort((a: string, b: string) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [absensiList]);

  const uniqueNamasAbsensi = useMemo(() => {
    let list = absensiList;
    if (selectedKelasAbsensi !== 'Semua') {
      list = list.filter(a => a && String(a.kelas).trim() === selectedKelasAbsensi);
    }
    const map = new Map<string, { namaLengkap: string, nia: string }>();
    list.forEach(a => {
      if (a && a.namaLengkap) {
        const name = String(a.namaLengkap).trim();
        const nia = String(a.nia || '').trim();
        const key = `${name} | ${nia}`;
        if (!map.has(key)) {
          map.set(key, { namaLengkap: name, nia });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
  }, [absensiList, selectedKelasAbsensi]);

  const filteredNamasInDropdown = useMemo(() => {
    if (!searchNamaQuery) return uniqueNamasAbsensi;
    const q = searchNamaQuery.toLowerCase();
    return uniqueNamasAbsensi.filter(item => 
      item.namaLengkap.toLowerCase().includes(q) || 
      item.nia.toLowerCase().includes(q)
    );
  }, [uniqueNamasAbsensi, searchNamaQuery]);

  // --- MATCHING SEARCH INTEGRITY ---
  const filteredAnggota = useMemo(() => {
    let list = anggotaList;
    if (selectedKelasAnggota !== 'Semua') {
      list = list.filter(m => m && String(m.kelas).trim() === selectedKelasAnggota);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((m) =>
        m.namaLengkap.toLowerCase().includes(q) ||
        m.nia.toLowerCase().includes(q) ||
        (m.namaSekolah && m.namaSekolah.toLowerCase().includes(q))
      );
    }
    return list;
  }, [anggotaList, searchTerm, selectedKelasAnggota]);

  const filteredPembayaran = useMemo(() => {
    if (!searchTerm) return pembayaranList;
    return pembayaranList.filter((p) =>
      p.namaLengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.namaTagihan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.idTransaksi.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pembayaranList, searchTerm]);

  const filteredPrestasi = useMemo(() => {
    if (!searchTerm) return prestasiList;
    return prestasiList.filter((pr) =>
      pr.namaLengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pr.nia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pr.jenisPrestasi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pr.deskripsi.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [prestasiList, searchTerm]);

  const filteredPelanggaran = useMemo(() => {
    if (!searchTerm) return pelanggaranList;
    return pelanggaranList.filter((pel) =>
      (pel.nama && pel.nama.toLowerCase().includes(searchTerm.toLowerCase())) ||
      pel.nia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pel.namaPelanggaran.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pel.jenisPelanggaran.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pelanggaranList, searchTerm]);

  const filteredAbsensi = useMemo(() => {
    let list = absensiList;
    if (selectedKelasAbsensi !== 'Semua') {
      list = list.filter(a => a && String(a.kelas).trim() === selectedKelasAbsensi);
    }
    if (selectedNamaAbsensi !== 'Semua') {
      list = list.filter(a => a && String(a.namaLengkap).trim() === selectedNamaAbsensi);
    }
    if (searchTerm) {
      list = list.filter((a) =>
        a.namaLengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.nia.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.kelas && a.kelas.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.keterangan && a.keterangan.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.jenisKegiatan && a.jenisKegiatan.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    if (absensiStatusFilter !== 'Semua') {
      list = list.filter(a => getAbsensiStatus(a.keterangan, a.status) === absensiStatusFilter);
    }
    return list;
  }, [absensiList, searchTerm, absensiStatusFilter, selectedKelasAbsensi, selectedNamaAbsensi]);

  const filteredInformasi = useMemo(() => {
    if (!searchTerm) return informasiList;
    return informasiList.filter((inf) =>
      inf.judul.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.isi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.jenisKegiatan.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [informasiList, searchTerm]);

  const filteredSurat = useMemo(() => {
    if (!searchTerm) return suratList;
    const query = searchTerm.toLowerCase();
    return suratList.filter((s) =>
      (s.namaLengkap || '').toLowerCase().includes(query) ||
      (s.nia || '').toLowerCase().includes(query) ||
      (s.perihal || '').toLowerCase().includes(query)
    );
  }, [suratList, searchTerm]);

  const filteredPeraturan = useMemo(() => {
    if (!searchTerm) return peraturanList;
    const query = searchTerm.toLowerCase();
    return peraturanList.filter((p) =>
      (p.judul || '').toLowerCase().includes(query) ||
      (p.sanksi || '').toLowerCase().includes(query) ||
      (p.status || '').toLowerCase().includes(query)
    );
  }, [peraturanList, searchTerm]);

  // Dropdown list matching values
  const dropdownFilteredMembers = useMemo(() => {
    let list = anggotaList;
    if (modalSelectedKelas && modalSelectedKelas !== 'Semua') {
      list = list.filter(m => String(m.kelas || '').trim() === modalSelectedKelas);
    }
    const cleanQuery = memberSearchQuery.split('|')[0].trim().toLowerCase();
    if (!cleanQuery) return list;
    return list.filter(m => 
      m.namaLengkap.toLowerCase().includes(cleanQuery) ||
      m.nia.toLowerCase().includes(cleanQuery)
    );
  }, [anggotaList, memberSearchQuery, modalSelectedKelas]);

  // --- STATS COMPUTATION FOR DASHBOARD ---
  const dashboardStats = useMemo(() => {
    const totalAnggota = anggotaList.length;
    const activeAnggota = anggotaList.filter(m => m.status === 'Aktif').length;
    const countLaki = anggotaList.filter(m => {
      const jk = (m.jenisKelamin || '').trim().toLowerCase();
      return jk === 'laki-laki' || jk === 'laki laki' || jk === 'lakilaki' || jk === 'l' || jk === 'pria' || jk === 'lk' || jk === 'cowok';
    }).length;
    const countPerempuan = anggotaList.filter(m => {
      const jk = (m.jenisKelamin || '').trim().toLowerCase();
      return jk === 'perempuan' || jk === 'p' || jk === 'wanita' || jk === 'pr' || jk === 'cewek';
    }).length;
    
    // Pembayaran stats
    const totalNominalPaid = pembayaranList
      .filter(p => p.status === 'Lunas')
      .reduce((sum, current) => sum + Number(current.nominal || 0), 0);
    const countLunas = pembayaranList.filter(p => p.status === 'Lunas').length;
    const countSebagian = pembayaranList.filter(p => p.status === 'Sebagian').length;
    const countBelum = pembayaranList.filter(p => !p.status || p.status.toLowerCase().includes('belum') || p.status.toLowerCase() === 'belum bayar' || p.status.toLowerCase() === 'belum lunas').length;
    const totalPembayaranDocs = pembayaranList.length;

    const percentLunas = totalPembayaranDocs > 0 ? Math.round((countLunas / totalPembayaranDocs) * 100) : 0;
    const percentSebagian = totalPembayaranDocs > 0 ? Math.round((countSebagian / totalPembayaranDocs) * 100) : 0;
    const percentBelum = totalPembayaranDocs > 0 ? Math.round((countBelum / totalPembayaranDocs) * 100) : 0;
    
    // Achievements
    const totalPrestasi = prestasiList.length;
    
    // Violations
    const totalPelanggaran = pelanggaranList.length;
    const totalDendaRule = pelanggaranList
      .filter(p => p.adaDenda === 'Ya')
      .reduce((sum, current) => sum + Number(current.nominalDenda || 0), 0);

    // Document, Info & Regulation counters
    const totalPeraturan = peraturanList.length;
    const totalSurat = suratList.length;

    // Attendance Rate and exact breakdown today/overall
    let countHadir = 0;
    let countIzin = 0;
    let countAlpha = 0;
    let countSakit = 0;

    absensiList.forEach(a => {
      const status = getAbsensiStatus(a.keterangan, a.status);
      if (status === 'Hadir') countHadir++;
      else if (status === 'Izin') countIzin++;
      else if (status === 'Alpha') countAlpha++;
      else if (status === 'Sakit') countSakit++;
    });

    const totalAbsensiHariIni = absensiList.length;
    const persentaseKehadiran = totalAbsensiHariIni > 0 
      ? Math.round((countHadir / totalAbsensiHariIni) * 100) 
      : 100;

    return {
      totalAnggota,
      activeAnggota,
      countLaki,
      countPerempuan,
      totalNominalPaid,
      countLunas,
      countSebagian,
      countBelum,
      totalPembayaranDocs,
      percentLunas,
      percentSebagian,
      percentBelum,
      totalPrestasi,
      totalPelanggaran,
      totalDendaRule,
      totalPeraturan,
      totalSurat,
      countHadir,
      countIzin,
      countAlpha,
      countSakit,
      persentaseKehadiran
    };
  }, [anggotaList, pembayaranList, prestasiList, pelanggaranList, absensiList, peraturanList, suratList]);

  const newMembersList = useMemo(() => {
    const today = new Date();
    return anggotaList.filter(m => {
      let regDate: Date;
      if (m.tanggalDaftar) {
        regDate = new Date(m.tanggalDaftar);
      } else {
        const index = anggotaList.findIndex(x => x.nia === m.nia);
        if (index >= anggotaList.length - 5 && index >= 0) {
          const daysAgo = (anggotaList.length - 1 - index) * 3 + 2;
          const d = new Date();
          d.setDate(today.getDate() - daysAgo);
          regDate = d;
        } else {
          const d = new Date();
          d.setDate(today.getDate() - 60);
          regDate = d;
        }
      }
      const diffTime = Math.abs(today.getTime() - regDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    }).sort((a, b) => {
      return String(b.nia || '').localeCompare(String(a.nia || ''));
    });
  }, [anggotaList]);

  const todayInformasiList = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return informasiList.filter(info => {
      return String(info.tanggal || '').trim() === todayStr;
    });
  }, [informasiList]);

  const latestPelanggaranList = useMemo(() => {
    return [...pelanggaranList].sort((a, b) => {
      const dateA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
      const dateB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 4);
  }, [pelanggaranList]);

  const paymentPieData = useMemo(() => {
    const r = 45;
    const C = 2 * Math.PI * r;
    const totalVal = dashboardStats.totalPembayaranDocs || 0;

    const lunasVal = dashboardStats.countLunas || 0;
    const sebagianVal = dashboardStats.countSebagian || 0;
    const belumVal = dashboardStats.countBelum || 0;

    const lunasRatio = totalVal > 0 ? lunasVal / totalVal : 0;
    const sebagianRatio = totalVal > 0 ? sebagianVal / totalVal : 0;
    const belumRatio = totalVal > 0 ? belumVal / totalVal : 0;

    const lunasDash = lunasRatio * C;
    const sebagianDash = sebagianRatio * C;
    const belumDash = belumRatio * C;

    return {
      r,
      C,
      totalVal,
      lunasDash,
      sebagianDash,
      belumDash
    };
  }, [dashboardStats]);

  const attendanceTrend = useMemo(() => {
    const groups: { [key: string]: { total: number; hadir: number; dateValue: Date; formattedDate: string } } = {};
    
    absensiList.forEach(a => {
      const dateStr = a.tanggalAbsen ? a.tanggalAbsen.trim() : '';
      if (!dateStr) return;
      
      const status = getAbsensiStatus(a.keterangan, a.status);
      
      if (!groups[dateStr]) {
        let dateObj = new Date(dateStr);
        // Fallback: If invalid date, parse from other formats or use default
        if (isNaN(dateObj.getTime())) {
          dateObj = new Date();
        }
        
        groups[dateStr] = {
          total: 0,
          hadir: 0,
          dateValue: dateObj,
          formattedDate: formatDateString(dateStr)
        };
      }
      
      groups[dateStr].total += 1;
      if (status === 'Hadir') {
        groups[dateStr].hadir += 1;
      }
    });

    const sortedDatesStr = Object.keys(groups).sort((a, b) => {
      const gA = groups[a];
      const gB = groups[b];
      const timeA = gA.dateValue.getTime();
      const timeB = gB.dateValue.getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.localeCompare(b);
    });

    return sortedDatesStr.map(dateStr => {
      const g = groups[dateStr];
      const percent = g.total > 0 ? Math.round((g.hadir / g.total) * 105) : 0; // scaled nicely
      // Wait, let's keep actual percentage max at 100
      const actualPercent = g.total > 0 ? Math.round((g.hadir / g.total) * 100) : 0;
      return {
        key: dateStr,
        formattedDate: g.formattedDate,
        total: g.total,
        hadir: g.hadir,
        percentage: actualPercent
      };
    });
  }, [absensiList]);

  // Render individual member card histories inside profile details
  const currentProfileLogs = useMemo(() => {
    if (!selectedProfile) return { payments: [], awards: [], violations: [] };
    const niaRef = selectedProfile.nia;
    return {
      payments: pembayaranList.filter(p => String(p.nia) === String(niaRef)),
      awards: prestasiList.filter(p => String(p.nia) === String(niaRef)),
      violations: pelanggaranList.filter(p => String(p.nia) === String(niaRef))
    };
  }, [selectedProfile, pembayaranList, prestasiList, pelanggaranList]);

  // Clear search term when switching tab
  const handleTabSwitch = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchTerm('');
    setSelectedKelasAnggota('Semua');
    setSelectedKelasAbsensi('Semua');
    setSelectedNamaAbsensi('Semua');
    setSearchNamaQuery('');
    setIsNamaDropdownOpen(false);
    setIsSidebarOpen(false);
  };

  const uniqueLembagaList = useMemo(() => {
    const all = akunList.map(a => a.lembaga).filter(Boolean);
    return Array.from(new Set(all)).sort((a: any, b: any) => a.localeCompare(b));
  }, [akunList]);

  if (!isLoggedIn) {
    const filteredLembaga = uniqueLembagaList.filter((l: string) => 
      l.toLowerCase().includes(lembagaSearch.toLowerCase())
    );

    return (
      <div className="min-h-screen w-full bg-[#070a13] text-slate-100 flex flex-col justify-between p-4 md:p-8 relative font-sans select-none overflow-y-auto">
        {/* Soft, beautiful organic light orbs in the background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/10 to-violet-500/5 rounded-full filter blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-indigo-900/10 to-purple-500/10 rounded-full filter blur-[100px] pointer-events-none"></div>

        <div></div>

        <div className="w-full max-w-md mx-auto my-auto z-10 py-6">
          {/* Header Portal Info */}
          <div className="text-center space-y-1 mb-2 flex flex-col items-center">
            <div className="w-[240px] overflow-hidden flex items-center justify-center">
              <img
                src="https://i.ibb.co.com/s9PmXBn3/20260605-214518.png"
                alt="SAPTA ADMIN Logo"
                className="w-full h-auto block"
                style={{
                  marginTop: '-18%',
                  marginBottom: '-18%',
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase">Sistem Akses Pribadi Tatakelola Anggota</p>
            </div>
          </div>

          {/* Login Card with Glassmorphic styles and custom top laser glow */}
          <div className="bg-[#0f142c]/50 backdrop-blur-3xl border border-slate-800/80 rounded-[2.2rem] p-6 md:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.7)] relative overflow-hidden">
            {/* Fine laser line top border */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent"></div>
            
            {/* Header network status bar in card */}
            <div className="flex items-center justify-between border-b border-slate-800/50 pb-5 mb-6">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${
                  isLoggingIn 
                    ? 'bg-amber-400 animate-pulse text-amber-400' 
                    : isFetchingAkun 
                      ? 'bg-indigo-400 animate-pulse text-indigo-400' 
                      : 'bg-emerald-400 text-emerald-400'
                }`}></span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {isLoggingIn 
                    ? 'Penyelarasan Server...' 
                    : isFetchingAkun 
                      ? 'Sinkronisasi Lembaga...' 
                      : 'Server Terhubung'}
                </span>
              </div>
              <span className="text-[9px] font-mono bg-slate-900/80 text-indigo-300 px-3 py-1 rounded-full border border-slate-800 font-bold">
                SECURE SSL
              </span>
            </div>

            {fetchAkunError && (
              <div className="bg-amber-950/20 border border-amber-900/60 text-amber-200 rounded-2xl p-4 mb-6 text-left animate-slide-in">
                <div className="flex space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <h4 className="text-xs font-bold text-amber-200">Koneksi Terhambat</h4>
                    <p className="text-[10px] text-amber-400 leading-relaxed font-sans">Gagal memuat database lembaga dari server utama secara realtime. Gunakan cadangan lokal jika tersedia.</p>
                    <button
                      type="button"
                      onClick={() => loadAkunData()}
                      className="px-3 py-1 bg-amber-800 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer active:scale-95"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Coba Lagi</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loginError && (
              <div className="bg-rose-950/20 border border-rose-900/60 text-rose-300 rounded-2xl p-4 mb-6 text-xs font-semibold leading-relaxed flex items-center space-x-2.5 text-left animate-shake">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5 text-left">
              {!isLembagaVerified ? (
                <>
                  {/* Institution Selection custom searchable field */}
                  <div className="space-y-4">
                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">Pilih Lembaga Anda</label>
                      <div className="relative">
                        <School className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          disabled={isVerifyingLembaga}
                          placeholder={selectedLembaga ? selectedLembaga : "Cari Lembaga Anda..."}
                          value={lembagaSearch}
                          onChange={(e) => {
                            setLembagaSearch(e.target.value);
                            setIsLembagaDropdownOpen(true);
                          }}
                          onFocus={() => setIsLembagaDropdownOpen(true)}
                          className="w-full text-xs pl-11 pr-20 py-3.5 bg-slate-950/70 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-100 placeholder-slate-500 font-semibold shadow-inner"
                        />
                        {selectedLembaga && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLembaga('');
                              setLembagaSearch('');
                            }}
                            className="absolute right-12 top-1/2 -translate-y-1/2 text-rose-400 hover:text-rose-300 font-bold p-1 text-[10px] cursor-pointer bg-rose-950/20 px-2 py-0.5 rounded-md border border-rose-900/40"
                          >
                            Batal
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsLembagaDropdownOpen(!isLembagaDropdownOpen)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-850 rounded cursor-pointer transition text-slate-400"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isLembagaDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Combobox List dropdown */}
                      {isLembagaDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-2 bg-[#0a0d1e] border border-slate-800 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-800/60 animate-slide-down">
                          {filteredLembaga.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500 font-medium font-sans">
                              {isFetchingAkun ? 'Memuat data lembaga...' : 'Lembaga tidak ditemukan'}
                            </div>
                          ) : (
                            filteredLembaga.map((lemb) => (
                              <button
                                key={lemb}
                                type="button"
                                onClick={() => {
                                  setSelectedLembaga(lemb);
                                  setLembagaSearch(lemb);
                                  setIsLembagaDropdownOpen(false);
                                  setLoginError(null);
                                }}
                                className={`w-full text-left px-4 py-3 text-xs font-semibold select-none flex items-center justify-between transition cursor-pointer ${
                                  selectedLembaga === lemb 
                                    ? 'bg-indigo-950/50 text-indigo-300 font-bold' 
                                    : 'text-slate-300 hover:bg-slate-900'
                                }`}
                              >
                                <span className="font-mono">{lemb}</span>
                                {selectedLembaga === lemb && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {isVerifyingLembaga && loginProgressText && (
                      <div className="text-center py-2 text-[10px] text-slate-400 font-mono flex items-center justify-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                        <span>{loginProgressText}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleVerifyLembaga}
                      disabled={isVerifyingLembaga || !selectedLembaga}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-slate-800 disabled:to-slate-900 disabled:opacity-45 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all shadow-lg shadow-indigo-950/50 cursor-pointer flex items-center justify-center space-x-2 border border-indigo-500/20"
                    >
                      {isVerifyingLembaga ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                          <span>Menghubungkan Server...</span>
                        </>
                      ) : (
                        <>
                          <span>OKE (Pilih Lembaga)</span>
                          <Check className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Lembaga Terhubung Header */}
                  <div className="bg-indigo-950/30 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0">
                        <School className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Lembaga Terhubung</p>
                        <p className="text-xs font-bold text-slate-100 font-mono mt-0.5 truncate">{selectedLembaga}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLembagaVerified(false);
                        setLembagaAkunList([]);
                        setEmailInput('');
                        setPasswordInput('');
                        setLoginError(null);
                      }}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/20 px-2.5 py-1 rounded-md border border-rose-900/40 shrink-0 hover:bg-rose-950/40 cursor-pointer active:scale-95 transition"
                    >
                      Ubah
                    </button>
                  </div>

                  {/* Username / E-mail Input */}
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">Username Akun</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        disabled={isLoggingIn}
                        autoFocus
                        placeholder="Masukkan Username Anda"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          setLoginError(null);
                        }}
                        className="w-full text-xs pl-11 pr-4 py-3.5 bg-slate-950/70 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-100 placeholder-slate-500 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">Sandi Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        disabled={isLoggingIn}
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          setLoginError(null);
                        }}
                        className="w-full text-xs pl-11 pr-12 py-3.5 bg-slate-950/70 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-100 placeholder-slate-500 shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-850 rounded text-slate-400 hover:text-slate-200 cursor-pointer transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit button with beautiful layout and active hover transitions */}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:from-indigo-800 disabled:to-indigo-900 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all shadow-lg shadow-indigo-950/50 cursor-pointer flex items-center justify-center space-x-2 border border-indigo-500/20"
                  >
                    <span>Masuk Ke Sistem Portal</span>
                    <ChevronRight className="w-4 h-4 text-indigo-200" />
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        {/* Full-screen absolute blurred overlay when logging in */}
        {isLoggingIn && (
          <div className="absolute inset-0 bg-[#070a13]/80 backdrop-blur-md z-50 flex flex-col justify-center items-center p-6 text-center animate-fade-in space-y-6">
            <div className="bg-slate-950/90 border border-slate-800/80 rounded-[2rem] p-8 max-w-sm w-full mx-auto shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center space-y-5 animate-scale-up">
              {/* IMMERSIVE SPINNING PULSE SPINNER */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/10"></div>
                {/* Outermost rotator ring */}
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" style={{ animationDuration: '0.8s' }}></div>
                {/* Secondary inner reverse rotator */}
                <div className="absolute inset-2 rounded-full border border-dashed border-indigo-400/30 animate-pulse"></div>
                <Lock className="w-6 h-6 text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-1.5 text-center">
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">Mencoba Masuk Ke Akun...</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">Mohon tunggu, sistem sedang memverifikasi identitas Anda secara aman...</p>
              </div>
              <p className="text-[10px] text-indigo-300 font-mono font-bold px-3 py-1 bg-indigo-950/60 border border-indigo-900/40 rounded-full inline-block">
                {selectedLembaga || 'Lembaga Sapta'}
              </p>
            </div>
          </div>
        )}

        {/* Footer info lock copyright */}
        <div className="text-center text-[10px] text-slate-500 font-mono z-10 py-4 select-none uppercase tracking-wider">
          SAPTA SECURE GATEWAY • VERSION 5.2 • STABLE RELIABLE ENGINE
        </div>

        {/* Float toasts overlay rendering so any notifications appear beautifully */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full">
          {toastList.map((toast) => (
            <div
              key={toast.id}
              className={`p-4 rounded-xl shadow-xl flex items-start space-x-3 border animate-slide-in ${
                toast.type === 'success'
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-100'
                  : toast.type === 'error'
                    ? 'bg-rose-955 border-rose-800 text-rose-100'
                    : 'bg-slate-900 border-slate-800 text-slate-100'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : toast.type === 'error' ? (
                <XCircle className="w-5 h-5 text-rose-450 shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-[#38bdf8] shrink-0" />
              )}
              <div className="text-xs font-semibold leading-normal flex-1 font-sans">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-0.5 hover:bg-white/10 rounded transition text-white/50 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-[#0f172a] font-sans overflow-hidden relative">
      
      {/* Global CSS overrides for browser print pipeline printing */}
      <style>{`
        @media print {
          /* Unlock parent scroll boundaries for full page layout flow across multiple sheets */
          html, body, #root,
          .flex.h-screen.w-full,
          main,
          main > div,
          .overflow-y-auto,
          .overflow-hidden {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            overflow-y: visible !important;
            position: static !important;
          }

          /* Hide controls, banners, tables non-targets & layout panels */
          .print-exclude, 
          aside, 
          header, 
          nav, 
          button, 
          input, 
          select, 
          option, 
          textarea {
            display: none !important;
            visibility: hidden !important;
          }

          /* Format targets sheet area to display as full relative width blocks */
          .print-now {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0px auto !important;
            padding: 0px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure functional layouts like flex / columns inside printed sheets are supported */
          .print-now .flex {
            display: flex !important;
          }
          .print-now .grid {
            display: grid !important;
          }

          .print-now * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Dedicated parameters styling for physical receipt receipts */
          #area-struk-pembayaran.print-now {
            display: block !important;
            position: relative !important;
            margin: 20px auto !important;
            width: 360px !important;
            max-width: 360px !important;
            background: white !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 10px rgba(0,0,0,0.06) !important;
            padding: 24px !important;
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #area-struk-pembayaran.print-now * {
            visibility: visible !important;
          }
        }
      `}</style>
      
      {/* Mobile Sidebar overlay backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden transition-opacity duration-300 cursor-pointer"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. SIDEBAR NAVIGATION */}
      <aside className={`fixed inset-y-0 left-0 lg:static w-[260px] bg-[#0c1322] text-[#94a3b8] flex flex-col justify-between shrink-0 border-r border-[#1e293b] select-none z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
          
          {/* Logo Brand Frame */}
          <div className="h-14 border-b border-[#1e293b] flex items-center bg-[#090d16] px-5 shrink-0">
            <img
              src="https://i.ibb.co.com/s9PmXBn3/20260605-214518.png"
              alt="SAPTA ADMIN Logo"
              className="w-full h-auto block"
              style={{
                marginTop: '-18%',
                marginBottom: '-18%',
              }}
              referrerPolicy="no-referrer"
            />
          </div>

          {/* User Profile Info Section */}
          <div className="p-3 border-b border-[#1e293b] bg-[#0c1322] flex items-center space-x-2.5 text-left shrink-0">
            <div className="relative w-8 h-8 rounded-full shrink-0">
              <img
                src={institusiProfileUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=256&h=256&q=80"}
                alt={userNama || lembagaLogin || "Administrator"}
                className="w-full h-full object-cover rounded-full border border-slate-700"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=256&h=256&q=80";
                }}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10b981] border border-[#0c1322] animate-pulse"></span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[11px] font-bold text-white truncate leading-tight font-sans" title={userNama || lembagaLogin}>
                {userNama || 'Admin Sapta'}
              </p>
              <p className="text-[9px] text-[#64748b] truncate font-sans tracking-wide mt-0.5 uppercase">
                {userUsername ? `@${userUsername} • ` : ''}{lembagaLogin || 'Lembaga'}
              </p>
            </div>
          </div>

          {/* Connected DB status */}
          <div className="px-3.5 py-1.5 bg-[#090d16]/30 border-b border-[#1e293b] flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span>Koneksi DB:</span>
            <span className="text-[#10b981] flex items-center gap-1 font-bold font-sans">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-ping"></span>
              LIVE
            </span>
          </div>

          {/* Nav Links */}
          <nav className="p-4 flex flex-col gap-1.5">
            <button
              onClick={() => handleTabSwitch('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                  : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
              }`}
            >
              <Home className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
              <span>Dashboard</span>
            </button>

            {isMenuAllowed('anggota') && (
              <button
                onClick={() => handleTabSwitch('anggota')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'anggota'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <Users className={`w-4 h-4 shrink-0 ${activeTab === 'anggota' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Daftar Anggota</span>
              </button>
            )}

            {isMenuAllowed('pembayaran') && (
              <button
                onClick={() => handleTabSwitch('pembayaran')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'pembayaran'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <CreditCard className={`w-4 h-4 shrink-0 ${activeTab === 'pembayaran' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Pembayaran</span>
              </button>
            )}

            {isMenuAllowed('prestasi') && (
              <button
                onClick={() => handleTabSwitch('prestasi')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'prestasi'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <Trophy className={`w-4 h-4 shrink-0 ${activeTab === 'prestasi' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Prestasi</span>
              </button>
            )}

            {isMenuAllowed('pelanggaran') && (
              <button
                onClick={() => handleTabSwitch('pelanggaran')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'pelanggaran'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 ${activeTab === 'pelanggaran' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Pelanggaran</span>
              </button>
            )}

            {isMenuAllowed('absensi') && (
              <button
                onClick={() => handleTabSwitch('absensi')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'absensi'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'absensi' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Rekap Absensi</span>
              </button>
            )}

            {isMenuAllowed('informasi') && (
              <button
                onClick={() => handleTabSwitch('informasi')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'informasi'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <Info className={`w-4 h-4 shrink-0 ${activeTab === 'informasi' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Informasi</span>
              </button>
            )}

            {isMenuAllowed('surat') && (
              <button
                onClick={() => handleTabSwitch('surat')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'surat'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <MailOpen className={`w-4 h-4 shrink-0 ${activeTab === 'surat' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Surat</span>
              </button>
            )}

            {isMenuAllowed('peraturan') && (
              <button
                onClick={() => handleTabSwitch('peraturan')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'peraturan'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <Scale className={`w-4 h-4 shrink-0 ${activeTab === 'peraturan' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Peraturan</span>
              </button>
            )}

            {isMenuAllowed('kelola_akun') && (
              <button
                onClick={() => handleTabSwitch('kelola_akun')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'kelola_akun'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === 'kelola_akun' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Kelola Akun</span>
              </button>
            )}

            {isMenuAllowed('cetak_data') && (
              <button
                onClick={() => handleTabSwitch('cetak_data')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                  activeTab === 'cetak_data'
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                    : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
                }`}
              >
                <Printer className={`w-4 h-4 shrink-0 ${activeTab === 'cetak_data' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
                <span>Cetak & Simpan Data</span>
              </button>
            )}

            <button
              onClick={() => handleTabSwitch('pengaturan')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 select-none border-l-4 ${
                activeTab === 'pengaturan'
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500 font-semibold'
                  : 'text-[#94a3b8] hover:bg-slate-800/40 hover:text-slate-100 border-transparent hover:translate-x-0.5'
              }`}
            >
              <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'pengaturan' ? 'text-indigo-400' : 'text-[#94a3b8]'}`} />
              <span>Pengaturan</span>
            </button>
          </nav>
        </div>

        {/* User Workspace Info (Simplified match) */}
        <div className="p-3 border-t border-[#1e293b] bg-[#090d16]/30 flex flex-col gap-2 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-rose-950/10 hover:bg-rose-900/20 text-rose-400 hover:text-rose-300 border border-rose-500/10 hover:border-rose-500/25 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* 2. CHOSEN CONTENT VIEW (SCROLLABLE AREA) */}
      <main className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-colors duration-200 ${theme === 'dark' ? 'dark-theme-main bg-[#0b0f19] text-slate-100' : 'bg-[#f8fafc]'}`}>
        
        {/* Global Toolbar Header matches Top Header style with mobile responsiveness */}
        <header className="relative bg-white border-b border-[#e2e8f0]/80 h-14 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* Hamburger menu for mobile screen */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Left-aligned title shown for all menus except dashboard and pengaturan */}
            {activeTab !== 'dashboard' && activeTab !== 'pengaturan' && (
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-wide font-sans whitespace-nowrap">
                {activeTab === 'anggota' ? 'Daftar Anggota' :
                 activeTab === 'pembayaran' ? 'Pembayaran' :
                 activeTab === 'prestasi' ? 'Prestasi' :
                 activeTab === 'pelanggaran' ? 'Pelanggaran' :
                 activeTab === 'absensi' ? 'Rekap Absensi' :
                 activeTab === 'informasi' ? 'Informasi' :
                 activeTab === 'surat' ? 'Surat' :
                 activeTab === 'peraturan' ? 'Peraturan' :
                 activeTab === 'kelola_akun' ? 'Kelola Akun' :
                 activeTab === 'cetak_data' ? 'Cetak & Simpan Data' :
                 activeTab.replace('-', ' ')}
              </h2>
            )}
          </div>

          {/* Centered Header Title only for dashboard and pengaturan */}
          {(activeTab === 'dashboard' || activeTab === 'pengaturan') && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none sm:pointer-events-auto z-10">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-wide font-sans text-center whitespace-nowrap">
                {activeTab === 'dashboard' ? 'Dashboard' : 'Pengaturan'}
              </h2>
            </div>
          )}

          {/* Centered Search Bar for all menus except dashboard, pengaturan, kelola_akun, and cetak_data */}
          {activeTab !== 'dashboard' && activeTab !== 'pengaturan' && activeTab !== 'kelola_akun' && activeTab !== 'cetak_data' && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-28 xs:w-36 sm:w-48 md:w-64">
              <div className="flex items-center bg-[#f1f5f9]/70 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg gap-1.5 border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all duration-200">
                <Search className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] sm:text-xs w-full text-slate-800 placeholder-[#94a3b8] font-medium"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="text-[#94a3b8] hover:text-[#475569] transition cursor-pointer"
                    title="Bersihkan Pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-1.5 sm:space-x-3 z-0">
            {/* Dynamic Tambah Data Trigger (Exclude dashboard, absensi, pengaturan, kelola_akun, and cetak_data) */}
            {activeTab !== 'dashboard' && activeTab !== 'absensi' && activeTab !== 'pengaturan' && activeTab !== 'kelola_akun' && activeTab !== 'cetak_data' && (
              <button
                onClick={() => handleOpenAddModal(activeTab as any)}
                className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold shadow-sm shadow-indigo-600/10 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 shrink-0"
              >
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1 shrink-0" />
                <span className="hidden sm:inline">Tambah Data</span>
                <span className="inline sm:hidden">Tambah</span>
              </button>
            )}
            
            {/* Global Sync/Refresh Button - applies to entire app, remains on same page */}
            <button
              onClick={() => syncDataFromCloudUrls()}
              disabled={isLoading}
              title="Muat Ulang / Perbarui Seluruh Data Aplikasi"
              className="flex items-center gap-1 text-[10px] sm:text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Theme toggle button - ONLY shown when activeTab is dashboard */}
            {activeTab === 'dashboard' && (
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                title={theme === 'light' ? 'Tema Gelap' : 'Tema Terang'}
                className="flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200/50 p-1.5 sm:p-2 rounded-lg font-bold transition-all duration-200 cursor-pointer shadow-xs"
              >
                {theme === 'light' ? (
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
                ) : (
                  <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 animate-pulse" />
                )}
              </button>
            )}

            <div className="hidden xs:flex w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 border border-slate-200/60 shrink-0 items-center justify-center text-[10px] sm:text-xs font-extrabold text-slate-700 font-mono shadow-xs select-none">
              SA
            </div>
          </div>
        </header>

        {/* Scrollable View Area Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {/* ======================= VIEW: DASHBOARD ======================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in font-sans">
              


              {/* CORE COUNTER CARDS (STATS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* CARD 1: TOTAL ANGGOTA */}
                {isMenuAllowed('anggota') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-indigo-200 transition duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Total Anggota</span>
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition duration-300">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.totalAnggota}</span>
                      <div className="text-[11px] font-medium text-indigo-600">
                        <span>{dashboardStats.activeAnggota} aktif</span>
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 2: JUMLAH LAKI-LAKI */}
                {isMenuAllowed('anggota') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-sky-200 transition duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-sky-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Laki-Laki</span>
                      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 group-hover:scale-110 transition duration-300">
                        <Users className="w-4 h-4 text-sky-550" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.countLaki}</span>
                      <div className="text-[11px] font-medium text-sky-650">
                        Siswa putra
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 3: JUMLAH PEREMPUAN */}
                {isMenuAllowed('anggota') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-rose-200 transition duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Perempuan</span>
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-605 group-hover:scale-110 transition duration-300">
                        <Users className="w-4 h-4 text-rose-550" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.countPerempuan}</span>
                      <div className="text-[11px] font-medium text-rose-650">
                        Siswa putri
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 4: PRESTASI */}
                {isMenuAllowed('prestasi') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-amber-200 transition duration-300 relative overflow-hidden group hover:cursor-pointer" onClick={() => handleTabSwitch('prestasi')}>
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Prestasi</span>
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition duration-300">
                        <Trophy className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.totalPrestasi}</span>
                      <div className="text-[11px] font-medium text-amber-600">
                        Active season
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 5: PERATURAN */}
                {isMenuAllowed('peraturan') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-orange-200 transition duration-300 relative overflow-hidden group hover:cursor-pointer" onClick={() => handleTabSwitch('peraturan')}>
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-orange-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Peraturan</span>
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-650 group-hover:scale-110 transition duration-300">
                        <Scale className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.totalPeraturan}</span>
                      <div className="text-[11px] font-medium text-orange-600">
                        Kebijakan lembaga
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 6: SURAT */}
                {isMenuAllowed('surat') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-violet-200 transition duration-300 relative overflow-hidden group hover:cursor-pointer" onClick={() => handleTabSwitch('surat')}>
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-violet-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Surat</span>
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 group-hover:scale-110 transition duration-300">
                        <MailOpen className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.totalSurat}</span>
                      <div className="text-[11px] font-medium text-violet-605">
                        Arsip arsip resmi
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 7: TOTAL PEMBAYARAN LUNAS */}
                {isMenuAllowed('pembayaran') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-emerald-200 transition duration-300 relative overflow-hidden group hover:cursor-pointer" onClick={() => handleTabSwitch('pembayaran')}>
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">TOTAL BAYAR</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition duration-300">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-lg font-black text-slate-900 tracking-tight block truncate" title={formatRupiah(dashboardStats.totalNominalPaid)}>
                        {formatRupiah(dashboardStats.totalNominalPaid)}
                      </span>
                      <div className="text-[11px] font-medium text-emerald-600">
                        {dashboardStats.countLunas} transaksi lunas
                      </div>
                    </div>
                  </div>
                )}
 
                {/* CARD 8: TOTAL PELANGGARAN */}
                {isMenuAllowed('pelanggaran') && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] hover:shadow-md flex flex-col gap-3 hover:border-red-200 transition duration-300 relative overflow-hidden group hover:cursor-pointer" onClick={() => handleTabSwitch('pelanggaran')}>
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-red-500"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">Pelanggaran</span>
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-650 group-hover:scale-110 transition duration-300">
                        <AlertTriangle className="w-4 h-4 text-red-650" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{dashboardStats.totalPelanggaran}</span>
                      <div className="text-[11px] font-medium text-red-600">
                        total denda : {formatRupiah(dashboardStats.totalDendaRule)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
 
              {/* STATISTIK DETAIL: PEMBAYARAN & KEHADIRAN (BENTO GRID ROW) */}
              {(isMenuAllowed('pembayaran') || isMenuAllowed('absensi')) && (
                <div className={`grid grid-cols-1 ${isMenuAllowed('pembayaran') && isMenuAllowed('absensi') ? 'lg:grid-cols-2' : ''} gap-6`}>

                  {/* REKAP PEMBAYARAN (Persentase Lunas, Sebagian, Belum Lunas) */}
                  {isMenuAllowed('pembayaran') && (
                    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0]/75 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="font-bold text-[#0f172a] text-sm tracking-tight flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-indigo-500" />
                              Statistik & Status Pembayaran
                            </h4>
                            <p className="text-[11px] text-[#64748b]">Persentase status rekam transaksi iuran/kas terdaftar</p>
                          </div>
                          <span className="text-xs bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg font-mono text-slate-705 font-bold">
                            {dashboardStats.totalPembayaranDocs} Catatan
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center py-6">
                          <div className="relative w-44 h-44 flex items-center justify-center">
                            <svg width="176" height="176" viewBox="0 0 120 120" className="transform -rotate-90">
                              {/* Outer track background */}
                              <circle
                                cx="60"
                                cy="60"
                                r="45"
                                fill="transparent"
                                stroke="#f1f5f9"
                                strokeWidth="11"
                              />
                              {paymentPieData.totalVal > 0 ? (
                                <>
                                  {/* Slice 1: Lunas (Emerald / Hijau) */}
                                  {paymentPieData.lunasDash > 0 && (
                                    <circle
                                      cx="60"
                                      cy="60"
                                      r="45"
                                      fill="transparent"
                                      stroke="#10b981"
                                      strokeWidth="12"
                                      strokeDasharray={`${paymentPieData.lunasDash} ${paymentPieData.C}`}
                                      strokeDashoffset={0}
                                      className="transition-all duration-300 hover:stroke-emerald-600 cursor-pointer"
                                    />
                                  )}
                                  {/* Slice 2: Sebagian (Orange) */}
                                  {paymentPieData.sebagianDash > 0 && (
                                    <circle
                                      cx="60"
                                      cy="60"
                                      r="45"
                                      fill="transparent"
                                      stroke="#f97316"
                                      strokeWidth="12"
                                      strokeDasharray={`${paymentPieData.sebagianDash} ${paymentPieData.C}`}
                                      strokeDashoffset={-paymentPieData.lunasDash}
                                      className="transition-all duration-300 hover:stroke-orange-600 cursor-pointer"
                                    />
                                  )}
                                  {/* Slice 3: Belum Bayar (Merah) */}
                                  {paymentPieData.belumDash > 0 && (
                                    <circle
                                      cx="60"
                                      cy="60"
                                      r="45"
                                      fill="transparent"
                                      stroke="#ef4444"
                                      strokeWidth="12"
                                      strokeDasharray={`${paymentPieData.belumDash} ${paymentPieData.C}`}
                                      strokeDashoffset={-(paymentPieData.lunasDash + paymentPieData.sebagianDash)}
                                      className="transition-all duration-300 hover:stroke-red-600 cursor-pointer"
                                    />
                                  )}
                                </>
                              ) : null}
                            </svg>

                            {/* Inner Label for Donut */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider leading-none mb-1">Total</span>
                              <span className="text-2xl font-black text-slate-800 font-sans tracking-tight leading-none">
                                {paymentPieData.totalVal}
                              </span>
                              <span className="text-[10px] text-slate-405 font-bold mt-1">Siswa</span>
                            </div>
                          </div>

                          {/* Small Quick Centered Legend */}
                          <div className="flex items-center gap-4 mt-6 text-[11px] font-semibold text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                              <span>Lunas ({dashboardStats.percentLunas}%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                              <span>Sebagian ({dashboardStats.percentSebagian}%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                              <span>Belum ({dashboardStats.percentBelum}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-50 flex justify-between items-center text-[10.5px] text-[#64748b]">
                        <span>Kas terhitung lunas: {formatRupiah(dashboardStats.totalNominalPaid)}</span>
                        <button onClick={() => handleTabSwitch('pembayaran')} className="text-indigo-600 hover:underline font-bold transition">Kelola Iuran ↗</button>
                      </div>
                    </div>
                  )}

                  {/* REKAP KEHADIRAN: DIAGRAM GARIS */}
                  {isMenuAllowed('absensi') && (
                    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0]/75 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="font-bold text-[#0f172a] text-sm tracking-tight flex items-center gap-2">
                              <CheckSquare className="w-4 h-4 text-violet-500" />
                              Statistik & Kehadiran Anggota
                            </h4>
                            <p className="text-[11px] text-[#64748b]">Tingkat kehadiran (%) berdasarkan rentetan tanggal perekaman</p>
                          </div>
                          <span className="text-xs bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg font-mono text-slate-705 font-bold">
                            {attendanceTrend.length} Hari Perekaman
                          </span>
                        </div>

                        {/* SVG Line Chart Container */}
                        <div className="relative w-full overflow-hidden py-1" style={{ minHeight: '230px' }}>
                          {attendanceTrend.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                              <p className="text-xs font-semibold text-slate-400">Belum ada data absensi yang tercatat untuk menampilkan diagram tren harian.</p>
                            </div>
                          ) : (
                            <div className="w-full relative">
                              <svg viewBox="0 0 500 240" className="w-full h-auto overflow-visible select-none">
                                <defs>
                                  <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.00" />
                                  </linearGradient>
                                </defs>

                                {/* Grid Lines & Y-Axis Labels */}
                                {[0, 25, 50, 75, 100].map((tick) => {
                                  const yPos = 30 + (180 - (tick * 1.8));
                                  return (
                                    <g key={tick} className="opacity-40">
                                      <line
                                        x1="45"
                                        y1={yPos}
                                        x2="465"
                                        y2={yPos}
                                        stroke="#cbd5e1"
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                      />
                                      <text
                                        x="15"
                                        y={yPos + 3}
                                        className="font-mono text-[9px] fill-slate-400 text-right leading-none"
                                        textAnchor="start"
                                      >
                                        {tick}%
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Path Drawing */}
                                {attendanceTrend.length > 0 && (() => {
                                  const N = attendanceTrend.length;
                                  const paddingX = 45;
                                  const paddingY = 30;
                                  const drawW = 420; // 465 - 45
                                  const drawH = 180;

                                  const points = attendanceTrend.map((item, i) => {
                                    const x = N > 1 ? paddingX + (i * (drawW / (N - 1))) : paddingX + (drawW / 2);
                                    const y = paddingY + drawH - (item.percentage * (drawH / 100));
                                    return { x, y, ...item };
                                  });

                                  // Generate path line
                                  let pathD = "";
                                  if (N === 1) {
                                    pathD = `M ${points[0].x - 15} ${points[0].y} L ${points[0].x + 15} ${points[0].y}`;
                                  } else {
                                    pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
                                  }

                                  // Generate area path for gradient
                                  let areaD = "";
                                  if (N === 1) {
                                    areaD = `M ${points[0].x - 15} ${points[0].y} L ${points[0].x + 15} ${points[0].y} L ${points[0].x + 15} ${paddingY + drawH} L ${points[0].x - 15} ${paddingY + drawH} Z`;
                                  } else {
                                    areaD = `${pathD} L ${points[N - 1].x} ${paddingY + drawH} L ${points[0].x} ${paddingY + drawH} Z`;
                                  }

                                  return (
                                    <>
                                      {/* Fill Area with Gradient */}
                                      <path d={areaD} fill="url(#violetGrad)" />

                                      {/* Stroke Line */}
                                      <path
                                        d={pathD}
                                        fill="none"
                                        stroke="#7c3aed"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />

                                      {/* Interactive Circles & Hover Hotspots */}
                                      {points.map((p, i) => {
                                        const isHovered = hoveredTrendIndex === i;
                                        return (
                                          <g key={i}>
                                            {/* Hover line guide to bottom */}
                                            {isHovered && (
                                              <line
                                                x1={p.x}
                                                y1={30}
                                                x2={p.x}
                                                y2={210}
                                                stroke="#8b5cf6"
                                                strokeWidth="1"
                                                strokeDasharray="2 2"
                                                className="opacity-60"
                                              />
                                            )}

                                            {/* Outer pulsing circle on hover */}
                                            <circle
                                              cx={p.x}
                                              cy={p.y}
                                              r={isHovered ? 7 : 4}
                                              fill={isHovered ? "#8b5cf6" : "#ffffff"}
                                              stroke="#7c3aed"
                                              strokeWidth={isHovered ? 2 : 2}
                                              className="transition-all duration-150 cursor-pointer animate-fade-in"
                                            />

                                            {/* Hotspot anchor */}
                                            <circle
                                              cx={p.x}
                                              cy={p.y}
                                              r="14"
                                              fill="transparent"
                                              className="cursor-pointer"
                                              onMouseEnter={() => setHoveredTrendIndex(i)}
                                              onMouseLeave={() => setHoveredTrendIndex(null)}
                                            />
                                          </g>
                                        );
                                      })}

                                      {/* Compact X-Axis Labels */}
                                      {points.map((p, i) => {
                                        const maxLabels = 6;
                                        const step = Math.ceil(N / maxLabels);
                                        const shouldDrawLabel = i === 0 || i === N - 1 || i % step === 0;

                                        if (!shouldDrawLabel) return null;

                                        let displayLabel = p.key;
                                        try {
                                          const d = new Date(p.key);
                                          if (!isNaN(d.getTime())) {
                                            displayLabel = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                                          }
                                        } catch (e) {}

                                        return (
                                          <text
                                            key={i}
                                            x={p.x}
                                            y="230"
                                            className="font-semibold font-mono text-[9px] fill-slate-500 text-center"
                                            textAnchor="middle"
                                          >
                                            {displayLabel}
                                          </text>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </svg>

                              {/* Floating dynamic rich tooltip */}
                              {hoveredTrendIndex !== null && attendanceTrend[hoveredTrendIndex] && (() => {
                                const currentItem = attendanceTrend[hoveredTrendIndex];
                                return (
                                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-[#0f172a] text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700/80 pointer-events-none animate-fade-in z-20 flex flex-col gap-1 w-44">
                                    <div className="font-bold border-b border-white/10 pb-1 text-[11px] text-slate-300">
                                      {currentItem.formattedDate}
                                    </div>
                                    <div className="flex justify-between mt-0.5">
                                      <span className="text-slate-400">Rasio Hadir:</span>
                                      <span className="font-extrabold text-emerald-400">{currentItem.percentage}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Siswa Hadir:</span>
                                      <span className="font-bold text-white">{currentItem.hadir} / {currentItem.total}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-50 flex justify-between items-center text-[10.5px] text-[#64748b]">
                        <span>Rata Kehadiran Aktif: <strong className="text-indigo-600 font-bold">{dashboardStats.persentaseKehadiran}%</strong></span>
                        <button onClick={() => handleTabSwitch('absensi')} className="text-indigo-600 hover:underline font-bold transition">Buka Absensi ↗</button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ANNOUNCEMENT BOARD FOR TODAY & LATEST VIOLATIONS BOARD (ROW GID) */}
              {(isMenuAllowed('informasi') || isMenuAllowed('pelanggaran')) && (
                <div className={`grid grid-cols-1 ${isMenuAllowed('informasi') && isMenuAllowed('pelanggaran') ? 'lg:grid-cols-2' : ''} gap-6`}>
                  
                  {/* INFORMASI HARI INI */}
                  {isMenuAllowed('informasi') && (
                    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0]/75 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-5 border-b border-[#f1f5f9] pb-4">
                          <div>
                            <h3 className="font-bold text-[#0f172a] text-sm tracking-tight flex items-center gap-2">
                              <Info className="w-4 h-4 text-sky-500" />
                              Informasi & Kegiatan Hari Ini
                            </h3>
                            <p className="text-xs text-[#64748b] mt-0.5">Informasi terbaru dan berita penting yang dirilis hari ini</p>
                          </div>
                          <span className="text-[9px] bg-sky-50 text-sky-750 border border-sky-200 font-mono px-2 py-0.5 rounded-md font-bold uppercase">
                            HARI INI
                          </span>
                        </div>

                        <div className="space-y-4">
                          {todayInformasiList.length === 0 ? (
                            <div className="bg-slate-50/70 border border-slate-150 rounded-2xl p-6 text-center">
                              <p className="text-xs text-slate-500 italic">Tidak ada pengumuman / informasi resmi baru untuk hari ini.</p>
                              <p className="text-[10px] text-slate-405 mt-1">Seluruh kegiatan dan agenda operasional berjalan lancar sesuai jadwal.</p>
                              
                              {/* Fallback to latest info */}
                              {informasiList.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-slate-200/50 text-left">
                                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block mb-2 font-mono">Arsip Informasi Terakhir:</span>
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col gap-1.5 shadow-3xs">
                                    <div className="flex justify-between items-start gap-1">
                                      <h5 className="text-xs font-bold text-slate-800 line-clamp-1">{informasiList[informasiList.length - 1].judul}</h5>
                                      <span className="text-[8px] bg-slate-100 border text-slate-600 px-1.5 py-0.5 rounded whitespace-nowrap font-mono">{formatDateString(informasiList[informasiList.length - 1].tanggal)}</span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-500 line-clamp-2 leading-relaxed">{informasiList[informasiList.length - 1].isi}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            todayInformasiList.map((info, idx) => (
                              <div 
                                key={info.idInformasi || idx}
                                className="bg-indigo-50/40 border border-indigo-100/70 rounded-2xl p-5 relative overflow-hidden group shadow-3xs"
                              >
                                <span className="text-[9px] bg-indigo-505 text-white font-mono rounded px-2 py-0.5 font-bold uppercase tracking-wide">
                                  {info.jenisKegiatan || 'Penting'}
                                </span>
                                <h4 className="text-sm font-extrabold text-slate-900 mt-2.5 font-sans block">{info.judul}</h4>
                                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-sans whitespace-pre-wrap">{info.isi}</p>
                                
                                <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono pt-3 border-t border-indigo-100/50">
                                  <span>Waktu: {info.waktu || 'Tidak Ditentukan'}</span>
                                  <span>Tgl: {formatDateString(info.tanggal)}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-50 flex justify-end">
                        <button 
                          onClick={() => handleTabSwitch('informasi')}
                          className="text-xs font-bold text-[#6366f1] hover:text-[#4f46e5] flex items-center gap-0.5 cursor-pointer"
                        >
                          Buka Papan Informasi <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PELANGGARAN TERBARU */}
                  {isMenuAllowed('pelanggaran') && (
                    <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0]/75 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-5 border-b border-[#f1f5f9] pb-4">
                          <div>
                            <h3 className="font-bold text-[#0f172a] text-sm tracking-tight flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                              Rekam Pelanggaran Terbaru
                            </h3>
                            <p className="text-xs text-[#64748b] mt-0.5">Catatan ketertiban dan kedisiplinan siswa terakhir</p>
                          </div>
                          <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-mono px-2 py-0.5 rounded-md font-bold uppercase">
                            {pelanggaranList.length} TOTAL
                          </span>
                        </div>

                        <div className="space-y-3">
                          {latestPelanggaranList.length === 0 ? (
                            <p className="text-xs text-[#64748b] text-center py-8">Belum ada rekam pelanggaran yang dicatat dalam sistem.</p>
                          ) : (
                            latestPelanggaranList.map((caseRow, idx) => (
                              <div 
                                key={caseRow.idPelanggaran || idx}
                                className="p-3 rounded-xl border border-[#f1f5f9] hover:border-indigo-100 hover:bg-[#f8fafc]/50 transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 font-bold shrink-0 text-xs">
                                    {caseRow.jenisPelanggaran ? caseRow.jenisPelanggaran[0].toUpperCase() : 'P'}
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-[#0f172a] leading-tight flex items-center gap-1.5">
                                      {caseRow.nama}
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                        caseRow.jenisPelanggaran === 'Berat' 
                                          ? 'bg-rose-100 text-rose-700' 
                                          : caseRow.jenisPelanggaran === 'Sedang'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {caseRow.jenisPelanggaran}
                                      </span>
                                    </h4>
                                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{caseRow.namaPelanggaran}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[9px] text-[#64748b] font-mono block">{formatDateString(caseRow.tanggal)}</span>
                                  {caseRow.adaDenda === 'Ya' && (
                                    <span className="text-[10px] font-bold text-rose-600 block mt-0.5">{formatRupiah(caseRow.nominalDenda)}</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-50 flex justify-end">
                        <button 
                          onClick={() => handleTabSwitch('pelanggaran')}
                          className="text-xs font-bold text-[#6366f1] hover:text-[#4f46e5] flex items-center gap-0.5 cursor-pointer"
                        >
                          Buka Kelola Pelanggaran <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ANGGOTA BARU TERDAFTAR (ABSOLUTE BOTTOM) */}
              {isMenuAllowed('anggota') && (
                <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0]/75 shadow-xs flex flex-col justify-between mt-6">
                  <div>
                    <div className="flex items-center justify-between mb-5 border-b border-[#f1f5f9] pb-4">
                      <div>
                        <h3 className="font-bold text-[#0f172a] text-sm tracking-tight flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-500" />
                          Daftar Anggota / Siswa Baru
                        </h3>
                        <p className="text-xs text-[#64748b] mt-0.5">Anggota baru yang terdaftar semenjak 2 s.d 4 minggu terakhir</p>
                      </div>
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono px-2 py-0.5 rounded-md font-bold uppercase">
                        {newMembersList.length} BARU
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {newMembersList.length === 0 ? (
                        <div className="col-span-full py-8 text-center text-xs text-[#64748b]">
                          Belum ada anggota baru yang masuk dalam jangka waktu 1 month.
                        </div>
                      ) : (
                        newMembersList.slice(0, 4).map((member, idx) => (
                          <div 
                             key={member.nia || idx}
                             onClick={() => setSelectedProfile(member)}
                             className="flex items-center justify-between p-3 rounded-xl border border-[#f1f5f9] hover:border-indigo-100 hover:bg-slate-50/40 transition duration-200 cursor-pointer"
                          >
                            <div className="flex items-center space-x-3.5 animate-slide-in">
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-[#e2e8f0] shrink-0 bg-[#f1f5f9] flex items-center justify-center font-bold text-[#64748b] text-sm shadow-xs">
                                <MemberAvatar linkProfile={member.linkProfile} namaLengkap={member.namaLengkap} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-[#0f172a] leading-tight line-clamp-1">{member.namaLengkap}</h4>
                                <p className="text-[10px] text-[#64748b] font-mono mt-0.5">NIA: {member.nia}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[9px] text-[#475569] bg-slate-100 px-1.5 py-0.5 rounded font-mono">{member.kelas || member.jenjangPendidikan || '-'}</span>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[8px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5">
                                Baru
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-50 flex justify-end">
                    <button 
                      onClick={() => handleTabSwitch('anggota')}
                      className="text-xs font-bold text-[#6366f1] hover:text-[#4f46e5] flex items-center gap-0.5 cursor-pointer"
                    >
                      Buka Kelola Anggota <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================= VIEW: DAFTAR ANGGOTA ======================= */}
          {activeTab === 'anggota' && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden animate-fade-in">
              <div className="p-5 border-b border-[#f1f5f9] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-sm">Tabel Data Anggota</h3>
                  <p className="text-xs text-[#64748b]">Total terhitung {filteredAnggota.length} anggota di dalam filter ini</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Saring Kelas */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                    <span>Saring Kelas:</span>
                    <select
                      value={selectedKelasAnggota}
                      onChange={(e) => setSelectedKelasAnggota(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Semua">Semua Kelas</option>
                      {uniqueClassesAnggota.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] text-[#64748b] text-[11px] tracking-wider uppercase font-semibold font-sans whitespace-nowrap">
                      <th className="py-4 px-4">NIA</th>
                      <th className="py-4 px-4">Nama Lengkap</th>
                      <th className="py-4 px-4">Tempat Lahir</th>
                      <th className="py-4 px-4">Tanggal Lahir</th>
                      <th className="py-4 px-4">Jenis Kelamin</th>
                      <th className="py-4 px-4">Jenjang Pendidikan</th>
                      <th className="py-4 px-4">Nama Sekolah</th>
                      <th className="py-4 px-4">Kelas</th>
                      <th className="py-4 px-4">Alamat</th>
                      <th className="py-4 px-4">No Hp</th>
                      <th className="py-4 px-4">E-Mail</th>
                      <th className="py-4 px-4">PIN</th>
                      <th className="py-4 px-4">Link-Profile</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-xs">
                    {filteredAnggota.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="py-10 text-center text-[#94a3b8]">
                          Tidak ditemukan data anggota yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAnggota.map((member) => (
                        <tr 
                          key={member.nia}
                          onClick={() => setSelectedProfile(member)}
                          className="hover:bg-[#f8fafc] cursor-pointer transition duration-150 group whitespace-nowrap"
                        >
                          <td className="py-4 px-4 font-mono font-bold text-[#6366f1]">{member.nia}</td>
                          <td className="py-4 px-4 font-medium text-[#0f172a] group-hover:text-[#6366f1] transition">{member.namaLengkap}</td>
                          <td className="py-4 px-4 text-[#475569]">{member.tempatLahir || '-'}</td>
                          <td className="py-4 px-4 text-[#475569]">{formatDateString(member.tanggalLahir)}</td>
                          <td className="py-4 px-4 text-[#475569]">{member.jenisKelamin || '-'}</td>
                          <td className="py-4 px-4 text-[#475569]">{member.jenjangPendidikan || '-'}</td>
                          <td className="py-4 px-4 text-[#475569]">{member.namaSekolah || 'Umum'}</td>
                          <td className="py-4 px-4 text-[#475569]">Kelas {member.kelas || '-'}</td>
                          <td className="py-4 px-4 text-[#475569] max-w-xs truncate" title={member.alamat}>{member.alamat || '-'}</td>
                          <td className="py-4 px-4 font-mono text-[#475569]">{member.noHp || '-'}</td>
                          <td className="py-4 px-4 text-[#475569]">{member.email || '-'}</td>
                          <td className="py-4 px-4 font-mono text-[#475569]">{member.key || '-'}</td>
                          <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center font-bold text-[#64748b] shrink-0">
                                <MemberAvatar linkProfile={member.linkProfile} namaLengkap={member.namaLengkap} />
                              </div>
                              {member.linkProfile && member.linkProfile.startsWith('http') ? (
                                <a 
                                  href={member.linkProfile} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center shrink-0 cursor-pointer"
                                >
                                  Buka Foto ↗
                                </a>
                              ) : (
                                <span className="text-[10px] text-[#94a3b8] italic">No Link</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-block ${
                              member.status === 'Aktif' 
                                ? 'bg-[#ecfdf5] text-[#059669]' 
                                : member.status === 'Alumni' 
                                  ? 'bg-[#eff6ff] text-[#1d4ed8]'
                                  : 'bg-[#f1f5f9] text-[#64748b]'
                            }`}>
                              {member.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end space-x-2">
                              {isMenuAllowed('cetak_data') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAutoPrint('kartu', member.nia, 'area-kartu-identitas');
                                  }}
                                  className="p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                                  title="Cetak Kartu Tanda Anggota (KTA)"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditModal('anggota', member)}
                                className="p-1.5 rounded bg-[#f1f5f9] text-[#475569] hover:bg-[#cbd5e1] hover:text-[#0f172a] transition cursor-pointer"
                                title="Edit Anggota"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow('anggota', member)}
                                className="p-1.5 rounded bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] transition cursor-pointer"
                                title="Hapus Anggota"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* ======================= VIEW: PEMBAYARAN ======================= */}
          {activeTab === 'pembayaran' && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden animate-fade-in">
              <div className="p-5 border-b border-[#f1f5f9] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-sm">Transaksi Pembayaran / Tagihan</h3>
                  <p className="text-xs text-[#64748b]">Ditemukan {filteredPembayaran.length} transaksi di dalam filter</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] bg--[#f8fafc] text-[#64748b] text-[11px] tracking-wider uppercase font-semibold font-sans">
                      <th className="py-4 px-6">ID Transaksi</th>
                      <th className="py-4 px-6">Tanggal</th>
                      <th className="py-4 px-6">NIA</th>
                      <th className="py-4 px-6">Nama Anggota</th>
                      <th className="py-4 px-6">Nama Tagihan</th>
                      <th className="py-4 px-6">Keterangan</th>
                      <th className="py-4 px-6">Nominal</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-xs">
                    {filteredPembayaran.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-[#94a3b8]">
                          Belum ada transaksi pembayaran yang dicatat.
                        </td>
                      </tr>
                    ) : (
                      filteredPembayaran.map((payment) => (
                        <tr key={payment.idTransaksi} className="hover:bg-[#f8fafc] transition duration-150">
                          <td className="py-4 px-6 font-mono font-bold text-[#0f172a]">{payment.idTransaksi}</td>
                          <td className="py-4 px-6 text-[#64748b] font-mono">{formatDateString(payment.tanggal)}</td>
                          <td className="py-4 px-6 font-mono font-semibold text-[#6366f1]">{payment.nia}</td>
                          <td className="py-4 px-6 font-bold text-[#334155]">{payment.namaLengkap}</td>
                          <td className="py-4 px-6 text-[#475569] font-medium">{payment.namaTagihan}</td>
                          <td className="py-4 px-6 text-[#64748b] italic max-w-[150px] truncate" title={payment.keterangan || ''}>{payment.keterangan || '-'}</td>
                          <td className="py-4 px-6 font-mono font-bold text-[#334155] text-xs">{formatRupiah(payment.nominal)}</td>
                          <td className="py-4 px-6 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-block ${
                              payment.status === 'Lunas' 
                                ? 'bg-[#ecfdf5] text-[#059669]' 
                                : payment.status === 'Sebagian'
                                  ? 'bg-[#fffbeb] text-[#b45309]'
                                  : 'bg-[#fef2f2] text-[#b91c1c]'
                            }`}>
                              {payment.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {payment.status === 'Lunas' && (
                                <button
                                  onClick={() => {
                                    setReceiptData(payment);
                                    setIsReceiptModalOpen(true);
                                  }}
                                  className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                                  title="Cetak Struk Resmi"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditModal('pembayaran', payment)}
                                className="p-1.5 rounded bg-[#f1f5f9] text-[#475569] hover:bg-[#cbd5e1] hover:text-[#0f172a] transition cursor-pointer"
                                title="Edit Catatan"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow('pembayaran', payment)}
                                className="p-1.5 rounded bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] transition cursor-pointer"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* ======================= VIEW: PRESTASI ======================= */}
          {activeTab === 'prestasi' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex items-center justify-between shadow-xs">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-sm">Pencapaian & Prestasi Anggota</h3>
                  <p className="text-xs text-[#64748b]">Total {filteredPrestasi.length} catatan prestasi</p>
                </div>
              </div>

              {filteredPrestasi.length === 0 ? (
                <div className="bg-white py-12 px-6 rounded-xl border border-[#e2e8f0] text-center text-[#94a3b8] text-xs">
                  Belum ada prestasi yang terekam di dalam sistem.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPrestasi.map((item) => (
                    <div key={item.idPrestasi} className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col justify-between hover:shadow-xs hover:border-[#cbd5e1] transition duration-200 group">
                      
                      {/* Image header if available, otherwise beautiful abstract gradient backdrop */}
                      <div className="h-44 relative bg-[#0f172a] border-b border-[#f1f5f9]">
                        {item.linkFoto && item.linkFoto.startsWith('http') ? (
                          <img src={item.linkFoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-[#0f172a] to-[#1e293b] flex flex-col items-center justify-center p-4">
                            <Trophy className="w-10 h-10 text-amber-500 animate-bounce" />
                            <span className="text-[10px] text-[#cbd5e1] font-mono mt-2 uppercase tracking-widest">DOKUMENTASI KOSONG</span>
                          </div>
                        )}
                        <span className="absolute left-3.5 top-3.5 text-[10px] bg-slate-950/80 text-white font-mono px-2.5 py-1 rounded-md font-semibold">
                          {item.idPrestasi}
                        </span>
                        
                        <span className="absolute right-3.5 top-3.5 text-[10px] bg-amber-500 text-white font-bold px-2.5 py-1 rounded-md">
                          {item.jenisPrestasi.toUpperCase()}
                        </span>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-[#64748b]">{formatDateString(item.tanggal)}</span>
                          <h4 className="text-xs font-bold text-[#64748b] font-mono truncate">NIA: {item.nia}</h4>
                          <h3 className="text-sm font-bold text-[#0f172a] leading-tight group-hover:text-[#6366f1] transition">{item.namaLengkap}</h3>
                          <p className="text-xs text-[#475569] leading-relaxed italic border-l-2 border-indigo-200 pl-3 py-1 bg-[#f8fafc] rounded-r-md">
                            "{item.deskripsi}"
                          </p>
                        </div>

                        <div className="flex items-center justify-end space-x-2 mt-5 pt-3 border-t border-[#f1f5f9] shrink-0">
                          <button
                            onClick={() => handleOpenEditModal('prestasi', item)}
                            className="bg-[#f1f5f9] text-[#475569] hover:bg-[#cbd5e1] hover:text-[#0f172a] px-3 py-1.5 rounded text-xs font-semibold flex items-center transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRow('prestasi', item)}
                            className="bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] px-3 py-1.5 rounded text-xs font-semibold flex items-center transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ======================= VIEW: PELANGGARAN ======================= */}
          {activeTab === 'pelanggaran' && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden animate-fade-in">
              <div className="p-5 border-b border-[#f1f5f9] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-sm">Catatan Pelanggaran</h3>
                  <p className="text-xs text-[#64748b]">Daftar {filteredPelanggaran.length} rekam indisipliner siswa</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] text-[#64748b] text-[11px] tracking-wider uppercase font-semibold font-sans">
                      <th className="py-4 px-6">ID Kasus</th>
                      <th className="py-4 px-6">Tanggal</th>
                      <th className="py-4 px-6">NIA</th>
                      <th className="py-4 px-6">Nama Anggota</th>
                      <th className="py-4 px-6">Kadar</th>
                      <th className="py-4 px-6">Bentuk Pelanggaran</th>
                      <th className="py-4 px-6">Sanksi / Hukuman</th>
                      <th className="py-4 px-6">Denda</th>
                      <th className="py-4 px-6">Status Tindak Lanjut</th>
                      <th className="py-4 px-6 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-xs">
                    {filteredPelanggaran.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-[#94a3b8]">
                          Kejadian Pelanggaran nihil. Seluruh anggota tertib menjaga keamanan!
                        </td>
                      </tr>
                    ) : (
                      filteredPelanggaran.map((caseRow) => (
                        <tr key={caseRow.idPelanggaran} className="hover:bg-[#f8fafc] transition duration-150">
                          <td className="py-4 px-6 font-mono font-bold text-[#0f172a]">{caseRow.idPelanggaran}</td>
                          <td className="py-4 px-6 text-[#64748b] font-mono">{formatDateString(caseRow.tanggal)}</td>
                          <td className="py-4 px-6 font-mono font-semibold text-[#6366f1]">{caseRow.nia}</td>
                          <td className="py-4 px-6 font-bold text-[#334155]">{caseRow.nama}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              caseRow.jenisPelanggaran === 'Berat' 
                                ? 'bg-[#fef2f2] text-[#b91c1c]'
                                : caseRow.jenisPelanggaran === 'Sedang'
                                  ? 'bg-[#fffbeb] text-[#b45309]'
                                  : 'bg-[#fef3c7] text-[#92400e]'
                            }`}>
                              {caseRow.jenisPelanggaran.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[#475569] font-medium">
                            <span>{caseRow.namaPelanggaran}</span>
                            <span className="text-[10px] text-[#94a3b8] block mt-0.5 max-w-[200px] truncate" title={caseRow.keterangan || ''}>
                              {caseRow.keterangan || '-'}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-medium text-[#475569]">{caseRow.jenisHukuman}</td>
                          <td className="py-4 px-6 font-mono font-bold text-[#b91c1c]">
                            {caseRow.adaDenda === 'Ya' ? formatRupiah(caseRow.nominalDenda) : '-'}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                              (caseRow.statusHukuman || '').toLowerCase() === 'selesai'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                                : (caseRow.statusHukuman || '').toLowerCase() === 'proses'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/50'
                                : 'bg-rose-50 text-rose-700 border-rose-200/50'
                            }`}>
                              {caseRow.statusHukuman || 'Belum Ditindak'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {isMenuAllowed('cetak_data') && (
                                <button
                                  onClick={() => handleAutoPrint('pelanggaran', caseRow.nia, 'area-laporan-pelanggaran')}
                                  className="p-1.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                                  title="Cetak Surat Laporan Pelanggaran"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditModal('pelanggaran', caseRow)}
                                className="p-1.5 rounded bg-[#f1f5f9] text-[#475569] hover:bg-[#cbd5e1] hover:text-[#0f172a] transition cursor-pointer"
                                title="Edit Pelanggaran"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow('pelanggaran', caseRow)}
                                className="p-1.5 rounded bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] transition cursor-pointer"
                                title="Hapus Pelanggaran"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* ======================= VIEW: REKAP ABSENSI (READ-ONLY) ======================= */}
          {activeTab === 'absensi' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Absensi Action Banner */}
              <div className="bg-white border border-[#e2e8f0] p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-[#0f172a]">Rekap Absensi Anggota</h4>
                  <p className="text-xs text-[#64748b]">Informasi rekap absensi dan catatan kehadiran anggota</p>
                </div>
              </div>

              {/* Status Overview cards clock */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] text-center shadow-xs">
                  <span className="text-[10px] text-[#64748b] font-mono uppercase font-bold tracking-wider">Total Hari Absen</span>
                  <p className="text-2xl font-black text-[#6366f1] mt-2">
                    {new Set(absensiList.map((a) => a.tanggalAbsen).filter(Boolean)).size}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] text-center shadow-xs">
                  <span className="text-[10px] text-[#64748b] font-mono uppercase font-bold tracking-wider">Siswa Terdata</span>
                  <p className="text-2xl font-black text-[#0d9488] mt-2">{new Set(absensiList.map(a => a.nia).filter(Boolean)).size}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] text-center shadow-xs">
                  <span className="text-[10px] text-[#64748b] font-mono uppercase font-bold tracking-wider">Jumlah Kelas</span>
                  <p className="text-2xl font-black text-[#b45309] mt-2">{new Set(absensiList.map(a => a.kelas).filter(Boolean)).size}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] text-center shadow-xs">
                  <span className="text-[10px] text-[#64748b] font-mono uppercase font-bold tracking-wider">Ragam Kegiatan</span>
                  <p className="text-2xl font-black text-[#c026d3] mt-2">{new Set(absensiList.map(a => a.jenisKegiatan).filter(Boolean)).size}</p>
                </div>
              </div>

              {/* Statistik Status Absensi dari Kolom Keterangan */}
              <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-xl space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                      Statistik &amp; Filter Absensi
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Klik salah satu kartu di bawah ini untuk menyaring tabel rekam absensi secara langsung.
                    </p>
                  </div>
                  {absensiStatusFilter !== 'Semua' && (
                    <button
                      onClick={() => setAbsensiStatusFilter('Semua')}
                      className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-1 px-3 rounded-full border border-indigo-200 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center"
                    >
                      <span>Tampilkan Semua Data</span>
                      <span className="font-mono text-base leading-none">&times;</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  {/* Card HADIR */}
                  <div
                    onClick={() => setAbsensiStatusFilter('Hadir')}
                    className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-center relative overflow-hidden select-none transform hover:-translate-y-0.5 ${
                      absensiStatusFilter === 'Hadir'
                        ? 'border-emerald-500 bg-emerald-50/45 shadow-md ring-4 ring-emerald-500/10 scale-[1.03]'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/10 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[10px] text-emerald-600 font-bold tracking-wider block">HADIR</span>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                      {absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Hadir').length}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                      {absensiList.length > 0 
                        ? `${Math.round((absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Hadir').length / absensiList.length) * 100)}% Rasio` 
                        : '0%'
                      }
                    </span>
                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 bg-emerald-500 ${absensiStatusFilter === 'Hadir' ? 'h-2' : 'h-1'}`}></div>
                  </div>

                  {/* Card IZIN */}
                  <div
                    onClick={() => setAbsensiStatusFilter('Izin')}
                    className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-center relative overflow-hidden select-none transform hover:-translate-y-0.5 ${
                      absensiStatusFilter === 'Izin'
                        ? 'border-amber-500 bg-amber-50/45 shadow-md ring-4 ring-amber-500/10 scale-[1.03]'
                        : 'border-slate-200 bg-white hover:border-amber-350 hover:bg-amber-50/10 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[10px] text-amber-600 font-bold tracking-wider block">IZIN</span>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">
                      {absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Izin').length}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                      {absensiList.length > 0 
                        ? `${Math.round((absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Izin').length / absensiList.length) * 100)}% Rasio` 
                        : '0%'
                      }
                    </span>
                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 bg-amber-500 ${absensiStatusFilter === 'Izin' ? 'h-2' : 'h-1'}`}></div>
                  </div>

                  {/* Card ALPHA */}
                  <div
                    onClick={() => setAbsensiStatusFilter('Alpha')}
                    className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-center relative overflow-hidden select-none transform hover:-translate-y-0.5 ${
                      absensiStatusFilter === 'Alpha'
                        ? 'border-rose-500 bg-rose-50/45 shadow-md ring-4 ring-rose-500/10 scale-[1.03]'
                        : 'border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/10 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[10px] text-rose-600 font-bold tracking-wider block">ALPHA</span>
                    <p className="text-2xl font-extrabold text-[#e11d48] mt-1">
                      {absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Alpha').length}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                      {absensiList.length > 0 
                        ? `${Math.round((absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Alpha').length / absensiList.length) * 100)}% Rasio` 
                        : '0%'
                      }
                    </span>
                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 bg-rose-500 ${absensiStatusFilter === 'Alpha' ? 'h-2' : 'h-1'}`}></div>
                  </div>

                  {/* Card SAKIT */}
                  <div
                    onClick={() => setAbsensiStatusFilter('Sakit')}
                    className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer text-center relative overflow-hidden select-none transform hover:-translate-y-0.5 ${
                      absensiStatusFilter === 'Sakit'
                        ? 'border-blue-500 bg-blue-50/45 shadow-md ring-4 ring-blue-500/10 scale-[1.03]'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/10 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-[10px] text-blue-650 font-bold tracking-wider block">SAKIT</span>
                    <p className="text-2xl font-extrabold text-blue-600 mt-1">
                      {absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Sakit').length}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                      {absensiList.length > 0 
                        ? `${Math.round((absensiList.filter((a) => getAbsensiStatus(a.keterangan, a.status) === 'Sakit').length / absensiList.length) * 100)}% Rasio` 
                        : '0%'
                      }
                    </span>
                    <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 bg-blue-500 ${absensiStatusFilter === 'Sakit' ? 'h-2' : 'h-1'}`}></div>
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden">
                <div className="p-5 border-b border-[#f1f5f9] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[#0f172a] text-xs font-mono uppercase">Log Rekam Absensi Harian</h3>
                    <p className="text-[11px] text-[#64748b] mt-0.5">
                      Menampilkan {filteredAbsensi.length} dari {absensiList.length} rekam absensi harian {absensiStatusFilter !== 'Semua' ? `(Saringan aktif: ${absensiStatusFilter})` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Pilih Kelas */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                      <span>Pilih Kelas:</span>
                      <select
                        value={selectedKelasAbsensi}
                        onChange={(e) => {
                          setSelectedKelasAbsensi(e.target.value);
                          setSelectedNamaAbsensi('Semua');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="Semua">Semua Kelas</option>
                        {uniqueClassesAbsensi.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>

                    {/* Pilih Nama Searchable Dropdown */}
                    {selectedKelasAbsensi !== 'Semua' && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold animate-fade-in relative select-none">
                        <span>Pilih Nama:</span>
                        <div className="relative">
                          {/* Dropdown Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIsNamaDropdownOpen(!isNamaDropdownOpen)}
                            className="flex items-center justify-between gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[140px] max-w-[190px] text-left transition"
                          >
                            <span className="truncate">{selectedNamaAbsensi === 'Semua' ? 'Semua Nama' : selectedNamaAbsensi}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isNamaDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Backdrop Click Outside */}
                          {isNamaDropdownOpen && (
                            <div 
                              className="fixed inset-0 z-40 bg-transparent cursor-default" 
                              onClick={() => {
                                setIsNamaDropdownOpen(false);
                                setSearchNamaQuery('');
                              }}
                            />
                          )}

                          {/* Dropdown Menu Popup */}
                          {isNamaDropdownOpen && (
                            <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-slate-700 animate-slide-down">
                              {/* Search Input Box */}
                              <div className="flex items-center gap-1.5 px-2 bg-slate-50 border border-slate-200/80 rounded-lg mb-1.5">
                                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                  type="text"
                                  placeholder="Cari nama atau NIA..."
                                  value={searchNamaQuery}
                                  onChange={(e) => setSearchNamaQuery(e.target.value)}
                                  className="w-full bg-transparent border-none outline-none py-1.5 text-xs text-slate-800 placeholder-slate-400 font-medium font-sans"
                                  autoFocus
                                />
                                {searchNamaQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setSearchNamaQuery('')}
                                    className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Options List */}
                              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedNamaAbsensi('Semua');
                                    setIsNamaDropdownOpen(false);
                                    setSearchNamaQuery('');
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 text-[11.5px] rounded-lg transition-colors cursor-pointer block truncate ${
                                    selectedNamaAbsensi === 'Semua'
                                      ? 'bg-indigo-50 text-indigo-600 font-bold'
                                      : 'hover:bg-slate-50 text-slate-700 font-medium'
                                  }`}
                                >
                                  Semua Nama
                                </button>
                                
                                {filteredNamasInDropdown.length === 0 ? (
                                  <p className="text-center text-[10.5px] text-slate-400 py-3 font-medium font-sans">Nama tidak ditemukan</p>
                                ) : (
                                  filteredNamasInDropdown.map(item => (
                                    <button
                                      key={`${item.namaLengkap}-${item.nia}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedNamaAbsensi(item.namaLengkap);
                                        setIsNamaDropdownOpen(false);
                                        setSearchNamaQuery('');
                                      }}
                                      className={`w-full text-left px-2.5 py-2.5 rounded-lg transition-colors cursor-pointer block border border-transparent ${
                                        selectedNamaAbsensi === item.namaLengkap
                                          ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200/20'
                                          : 'hover:bg-slate-50 text-slate-700 hover:border-slate-100'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-0.5 text-left">
                                        <span className="font-bold text-[11.5px] leading-tight block truncate">
                                          {item.namaLengkap}
                                        </span>
                                        {item.nia && (
                                          <span className="text-[9.5px] text-slate-400 font-mono font-medium block">
                                            NIA: {item.nia}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(absensiStatusFilter !== 'Semua' || selectedKelasAbsensi !== 'Semua' || selectedNamaAbsensi !== 'Semua') && (
                      <button
                        onClick={() => {
                          setAbsensiStatusFilter('Semua');
                          setSelectedKelasAbsensi('Semua');
                          setSelectedNamaAbsensi('Semua');
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-50 border border-rose-200/50 rounded-lg transition cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    )}

                    {absensiStatusFilter !== 'Semua' && (
                      <span className="text-[10.5px] bg-[#f8fafc] border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono font-medium">
                        Filter Status: <strong className="text-slate-800 uppercase">{absensiStatusFilter}</strong>
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] text-[#64748b] text-[11px] tracking-wider uppercase font-extrabold font-sans">
                        <th className="py-4 px-6">NIA</th>
                        <th className="py-4 px-6">Nama Lengkap</th>
                        <th className="py-4 px-6">Kelas</th>
                        <th className="py-4 px-6">Tanggal</th>
                        <th className="py-4 px-6">Waktu</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] text-xs">
                      {filteredAbsensi.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[#94a3b8] font-sans">
                            <p className="font-medium text-slate-500">Tidak ditemukan data absensi untuk saringan "{absensiStatusFilter}".</p>
                            <button
                              onClick={() => setAbsensiStatusFilter('Semua')}
                              className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-4 py-1.5 rounded-lg cursor-pointer transition"
                            >
                              Reset Saringan Data
                            </button>
                          </td>
                        </tr>
                      ) : (
                        filteredAbsensi.map((row) => {
                          const statusVal = getAbsensiStatus(row.keterangan, row.status);
                          return (
                            <tr key={row.idAbsensi} className="hover:bg-[#f8fafc]/40 transition duration-150 font-medium text-[#475569]">
                              <td className="py-4 px-6 font-mono font-bold text-[#6366f1]">{row.nia}</td>
                              <td className="py-4 px-6 font-black text-[#1e293b]">{row.namaLengkap}</td>
                              <td className="py-4 px-6 font-bold text-slate-700 font-mono">{row.kelas || '-'}</td>
                              <td className="py-4 px-6 text-[#64748b] font-mono">{formatDateString(row.tanggalAbsen)}</td>
                              <td className="py-4 px-6 font-mono font-bold text-slate-800">
                                <span className="bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 text-[10.5px]">
                                  {row.waktuAbsen || '--:--'}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center">
                                {statusVal === 'Sakit' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-150 uppercase">SAKIT</span>
                                )}
                                {statusVal === 'Izin' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-150 uppercase font-sans">IZIN</span>
                                )}
                                {statusVal === 'Alpha' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-150 uppercase font-sans">ALPHA</span>
                                )}
                                {statusVal === 'Hadir' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-150 uppercase font-sans">HADIR</span>
                                )}
                              </td>
                              <td className="py-4 px-6 italic text-slate-500 max-w-[200px] truncate" title={row.keterangan || '-'}>
                                {row.keterangan || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ======================= VIEW: INFORMASI ======================= */}
          {activeTab === 'informasi' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="font-bold text-[#0f172a] text-sm">Papan Informasi & Pengumuman</h3>
                  <p className="text-xs text-[#64748b]">Total {filteredInformasi.length} informasi dan kegiatan aktif</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafc] text-[#475569] uppercase text-[10px] font-bold font-mono border-b border-[#e2e8f0]">
                        <th className="py-4 px-6">ID Info</th>
                        <th className="py-4 px-6">Judul</th>
                        <th className="py-4 px-6">Isi Pengumuman</th>
                        <th className="py-4 px-6">Jenis Kegiatan</th>
                        <th className="py-4 px-6 text-center">Tanggal</th>
                        <th className="py-4 px-6 text-center">Waktu</th>
                        <th className="py-4 px-6 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] text-xs">
                      {filteredInformasi.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[#94a3b8]">
                            Tidak ditemukan data informasi pengumuman.
                          </td>
                        </tr>
                      ) : (
                        filteredInformasi.map((row) => (
                          <tr key={row.idInformasi} className="hover:bg-[#f8fafc] transition duration-150">
                            <td className="py-4 px-6 font-mono text-[#64748b] font-bold">{row.idInformasi}</td>
                            <td className="py-4 px-6 font-bold text-[#0f172a]">{row.judul}</td>
                            <td className="py-4 px-6 text-[#475569] max-w-sm font-medium">{row.isi}</td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-1 rounded bg-[#eff6ff] text-[#1d4ed8] text-[10px] font-bold">
                                {row.jenisKegiatan}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center text-[#64748b] font-mono">{formatDateString(row.tanggal)}</td>
                            <td className="py-4 px-6 text-center text-[#64748b] font-mono font-medium">{row.waktu}</td>
                            <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditModal('informasi', row)}
                                  className="p-1.5 rounded bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] transition cursor-pointer"
                                  title="Edit Informasi"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRow('informasi', row)}
                                  className="p-1.5 rounded bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] transition cursor-pointer"
                                  title="Hapus Informasi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ======================= VIEW: SURAT RESMI ======================= */}
          {activeTab === 'surat' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Header Box */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
                <div>
                  <h3 className="font-extrabold text-[#0f172a] text-base tracking-tight">Persuratan & Dokumen Resmi</h3>
                  <p className="text-xs text-slate-500 mt-1">Total {filteredSurat.length} surat</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshAllData}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center"
                    title="Segarkan Data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table List Container */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
                
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="text-[12.5px] font-extrabold text-slate-700 font-sans tracking-wide">
                    DAFTAR SURAT DAN LINK DOKUMEN
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Ditemukan {filteredSurat.length} Data</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="bg-slate-50/70 text-[#475569] uppercase text-[9.5px] font-extrabold tracking-wider border-b border-slate-100">
                        <th className="py-4 px-6 text-center w-24">ID Surat</th>
                        <th className="py-4 px-6 text-center w-28">NIA</th>
                        <th className="py-4 px-6">Nama</th>
                        <th className="py-4 px-6">Perihal</th>
                        <th className="py-4 px-6">Link Dokumen</th>
                        <th className="py-4 px-6 text-center w-36">Tanggal</th>
                        <th className="py-4 px-6 text-right w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-medium">
                      {filteredSurat.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <MailOpen className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                              <p className="text-xs">Tidak ditemukan rekam data dokumen surat yang sesuai.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSurat.map((row, idx) => {
                          const matchedMem = anggotaList.find(m => m && String(m.nia) === String(row.nia));
                          const linkProfile = matchedMem ? matchedMem.linkProfile : '';

                          return (
                            <tr key={row.idSurat || `surat-${idx}`} className="hover:bg-slate-50/40 transition duration-150">
                              
                              {/* ID Surat */}
                              <td className="py-4 px-6 text-center">
                                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-extrabold border border-indigo-100/50">
                                  {row.idSurat}
                                </span>
                              </td>

                              {/* NIA */}
                              <td className="py-4 px-6 text-center font-mono font-bold text-slate-700">
                                {row.nia}
                              </td>

                              {/* Nama */}
                              <td className="py-4 px-6">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-500 font-mono text-xs select-none">
                                    <MemberAvatar linkProfile={linkProfile} namaLengkap={row.namaLengkap} />
                                  </div>
                                  <span className="font-bold text-slate-800">{row.namaLengkap}</span>
                                </div>
                              </td>

                              {/* Perihal */}
                              <td className="py-4 px-6 max-w-xs">
                                <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">{row.perihal || 'Tidak ada perihal.'}</p>
                              </td>

                              {/* Google Doc Link / Action */}
                              <td className="py-4 px-6">
                                {row.linkGoogleDoc ? (
                                  <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                    <a
                                      href={row.linkGoogleDoc}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100/60 px-2.5 py-1 rounded-lg text-[10.5px] font-bold tracking-wide transition"
                                    >
                                      <span>Buka Dokumen</span>
                                      <span className="text-[10px]">↗</span>
                                    </a>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(row.linkGoogleDoc);
                                        addToast('Tautan disalin ke papan klip!', 'success');
                                      }}
                                      className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer text-[10.5px] font-bold px-2 py-1 border border-slate-200 inline"
                                      title="Salin Tautan Dokumen"
                                    >
                                      Salin
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 italic text-[11px]">Belum diisi</span>
                                )}
                              </td>

                              {/* Tanggal */}
                              <td className="py-4 px-6 text-center text-slate-500 font-mono text-[11px]">
                                {formatDateString(row.tanggal)}
                              </td>

                              {/* Aksi */}
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenEditModal('surat', row)}
                                    className="p-1.5 rounded bg-[#f1f5f9] text-[#475569] hover:bg-[#cbd5e1] hover:text-[#0f172a] transition cursor-pointer"
                                    title="Edit Surat"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRow('surat', row)}
                                    className="p-1.5 rounded bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] transition cursor-pointer"
                                    title="Hapus Surat"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ======================= VIEW: PERATURAN ======================= */}
          {activeTab === 'peraturan' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Header Box */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
                <div>
                  <h3 className="font-extrabold text-[#0f172a] text-base tracking-tight">Peraturan & Kebijakan</h3>
                  <p className="text-xs text-slate-500 mt-1">Menginput dan mengelola standar regulasi bagi siswa, anggota, maupun sanksi pelanggaran.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshAllData}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center"
                    title="Segarkan Data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-1">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center space-x-4 font-sans">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Aturan</span>
                    <span className="text-xl font-black text-slate-800 leading-none block mt-1">{peraturanList.length} Regulasi</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center space-x-4 font-sans">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Pelanggaran Berat</span>
                    <span className="text-xl font-black text-rose-700 leading-none block mt-1">
                      {peraturanList.filter(p => p && p.status === 'Berat').length} Aturan
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center space-x-4 font-sans">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Pelanggaran Sedang</span>
                    <span className="text-xl font-black text-amber-700 leading-none block mt-1">
                      {peraturanList.filter(p => p && p.status === 'Sedang').length} Aturan
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center space-x-4 font-sans">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Pelanggaran Ringan</span>
                    <span className="text-xl font-black text-sky-700 leading-none block mt-1">
                      {peraturanList.filter(p => p && p.status === 'Ringan').length} Aturan
                    </span>
                  </div>
                </div>
              </div>

              {/* Table Render */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
                
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="text-[12.5px] font-extrabold text-slate-700 font-sans tracking-wide">
                    DAFTAR REGULASI STANDAR ORGANISASI
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Ditemukan {filteredPeraturan.length} Aturan</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="bg-slate-50/70 text-[#475569] uppercase text-[9.5px] font-extrabold tracking-wider border-b border-slate-100">
                        <th className="py-4 px-6 text-center w-28">ID Aturan</th>
                        <th className="py-4 px-6">Judul Peraturan</th>
                        <th className="py-4 px-6">Sanksi / Konsekuensi</th>
                        <th className="py-4 px-6 text-center w-36">Status (Tingkat)</th>
                        <th className="py-4 px-6 text-right w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-medium">
                      {filteredPeraturan.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Scale className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                              <p className="text-xs">Tidak ditemukan rekam data peraturan yang sesuai.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredPeraturan.map((row, idx) => {
                          return (
                            <tr key={row.idPeraturan || `peraturan-${idx}`} className="hover:bg-slate-50/40 transition duration-150">
                              
                              {/* ID Peraturan */}
                              <td className="py-4 px-6 text-center">
                                <span className="px-2.5 py-1 rounded bg-[#6366f1]/5 text-indigo-700 font-mono text-[10px] font-extrabold border border-indigo-100/50">
                                  {row.idPeraturan}
                                </span>
                              </td>

                              {/* Title */}
                              <td className="py-4 px-6">
                                <span className="font-bold text-slate-800 text-sm">{row.judul}</span>
                              </td>

                              {/* Sanksi */}
                              <td className="py-4 px-6 max-w-sm">
                                <p className="text-slate-500 text-[11.5px] leading-relaxed line-clamp-3 font-sans">
                                  {row.sanksi || '-'}
                                </p>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-block text-[10px] px-3 py-1 font-extrabold rounded-full border ${
                                  row.status === 'Berat'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200/50'
                                    : row.status === 'Sedang'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                                }`}>
                                  {row.status}
                                </span>
                              </td>

                              {/* Aksi */}
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenEditModal('peraturan', row)}
                                    className="p-1.5 rounded bg-[#f1f5f9] text-[#475569] hover:bg-[#cbd5e1] hover:text-[#0f172a] transition cursor-pointer"
                                    title="Edit Peraturan"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRow('peraturan', row)}
                                    className="p-1.5 rounded bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] transition cursor-pointer"
                                    title="Hapus Peraturan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ======================= VIEW: PENGATURAN ======================= */}
          {activeTab === 'pengaturan' && (
            <div className="space-y-8 animate-fade-in">

              {/* Theme Settings Card Panel */}
              <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Pengaturan Tema & Tampilan</h3>
                  <p className="text-[11px] text-[#64748b]">Ubah tema tampilan halaman utama (tidak termasuk menu sidebar).</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-600/5'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Terang (Light Theme)</span>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-indigo-400 bg-slate-800 text-indigo-400 shadow-sm shadow-indigo-400/5'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Gelap (Dark Theme)</span>
                  </button>
                </div>
              </div>

                           {/* ========================================================================= */}
              {/* =========== PENGATURAN BUKTI PEMBAYARAN (STRUK THERMAL) ================ */}
              {/* ========================================================================= */}
              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] space-y-4">
                <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#0f172a]">
                      Pengaturan Bukti Pembayaran (Struk Thermal)
                    </h3>
                    <p className="text-[10px] text-[#64748b]">
                      Sesuaikan rincian tata letak kop header, email, diskon default, dan ucapan kaki struk thermal.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Column: Form Controls */}
                  <div className="lg:col-span-8 space-y-3 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Kop Utama */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">Nama Kop Utama (Header)</label>
                        <input
                          type="text"
                          value={receiptHeaderTitle}
                          onChange={(e) => setReceiptHeaderTitle(e.target.value)}
                          placeholder={lembagaLogin || "PORTAL SEKTOR BERSAMA"}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Kosongkan untuk nama lembaga aktif ({lembagaLogin || 'Default'}).</span>
                      </div>

                      {/* Judul Sub Kop */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">Sub-Judul Kwitansi</label>
                        <input
                          type="text"
                          value={receiptHeaderSub}
                          onChange={(e) => setReceiptHeaderSub(e.target.value)}
                          placeholder="Bukti Pembayaran Resmi (Lunas)"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 font-medium text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">Alamat Lembaga (Header Kop)</label>
                      <input
                        type="text"
                        value={receiptHeaderAddress}
                        onChange={(e) => setReceiptHeaderAddress(e.target.value)}
                        placeholder="Jl. Raya Sektor Bersama No. 10, Jakarta"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-750"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Kop Kontak / Email */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">Kontak / Email Informasi</label>
                        <input
                          type="text"
                          value={receiptHeaderEmail}
                          onChange={(e) => setReceiptHeaderEmail(e.target.value)}
                          placeholder={gmailLogin || 'info@sapta-portal.id'}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Kosongkan untuk email aktif ({gmailLogin || 'Default'}).</span>
                      </div>

                      {/* Default Discount Percent */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">Potongan Diskon (%)</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={receiptDiscountPercent}
                            onChange={(e) => {
                              const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                              setReceiptDiscountPercent(v);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 font-bold text-slate-850"
                          />
                          <span className="text-xs text-slate-500 shrink-0 font-bold">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* PPN (%) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">Pajak PPN (%)</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={receiptPpnPercent}
                            onChange={(e) => {
                              const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                              setReceiptPpnPercent(v);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 font-bold text-slate-850"
                          />
                          <span className="text-xs text-slate-500 shrink-0 font-bold">%</span>
                        </div>
                      </div>

                      {/* Media Sosial */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 block">Informasi Media Sosial (Footer)</label>
                        <input
                          type="text"
                          value={receiptMediaSosial}
                          onChange={(e) => setReceiptMediaSosial(e.target.value)}
                          placeholder="@sapta.official • www.saptaweb.id"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 font-mono text-slate-705"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">Ucapan Terima Kasih (Footer)</label>
                      <input
                        type="text"
                        value={receiptFooterThankYou}
                        onChange={(e) => setReceiptFooterThankYou(e.target.value)}
                        placeholder="TERIMA KASIH ATAS KOPERASI & PEMBAYARAN ANDA"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 block">Keterangan Catatan Kaki Akhir (Undertitle)</label>
                      <textarea
                        rows={2}
                        value={receiptFooterSub}
                        onChange={(e) => setReceiptFooterSub(e.target.value)}
                        placeholder="*struk resmi yang diakui secara digital oleh bendahara lembaga."
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-600 text-[10px] leading-relaxed"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-150">
                      <div className="flex flex-col text-left">
                        <span className="text-[10px] font-bold text-slate-800">Visibilitas Detail Transaksi</span>
                        <span className="text-[8px] text-slate-400">Tampilkan No. Transaksi, Tanggal, dan Admin pada struk cetak.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReceiptShowTrxDetails(!receiptShowTrxDetails)}
                        className={`px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[#0f172a] text-[9px] font-black uppercase transition cursor-pointer border ${
                          receiptShowTrxDetails
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        {receiptShowTrxDetails ? 'TAMPILKAN (ON)' : 'SEMBUNYIKAN (OFF)'}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Instant Miniature Live Preview of Receipt */}
                  <div className="lg:col-span-4 flex flex-col items-center justify-center bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
                    <span className="text-[8px] tracking-widest text-[#94a3b8] font-black block mb-2 uppercase leading-none">
                      🔍 PREVIEW STRUK MINI
                    </span>

                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs max-w-[220px] w-full text-slate-800 text-[8px] relative overflow-hidden font-mono select-none pointer-events-none">
                      {/* Receipt Serrated Border Decor at Top */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-repeat-x overflow-hidden" 
                        style={{
                          backgroundImage: `linear-gradient(-45deg, transparent 3px, white 3px), linear-gradient(45deg, transparent 3px, white 3px)`,
                          backgroundSize: '6px 6px'
                        }}
                      />

                      <div className="text-center pb-2 mb-2 border-b border-dashed border-slate-250">
                        <h4 className="text-[9px] font-black tracking-wide uppercase text-slate-900 leading-tight">
                          {receiptHeaderTitle || lembagaLogin || "PORTAL SEKTOR BERSAMA"}
                        </h4>
                        {receiptHeaderSub && (
                          <p className="text-[7.5px] text-slate-501 font-bold tracking-wider pt-0.5 uppercase">
                            {receiptHeaderSub}
                          </p>
                        )}
                        {receiptHeaderAddress && (
                          <p className="text-[7px] text-slate-400 mt-0.5 uppercase max-w-[170px] mx-auto truncate text-center">
                            {receiptHeaderAddress}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 text-[8px]">
                        {receiptShowTrxDetails && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-bold uppercase text-[7px]">KODE STRUK</span>
                              <span className="font-extrabold text-slate-900 font-mono">TRX-SAMPLE01</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-bold uppercase text-[7px]">TANGGAL</span>
                              <span className="font-bold text-slate-800">10 Juni 2026</span>
                            </div>
                            <div className="border-b border-dashed border-slate-150 my-1" />
                          </>
                        )}

                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase text-[7px]">ANGGOTA</span>
                          <span className="font-black text-slate-900 truncate max-w-[100px] uppercase">Achmad Fauzi (Contoh)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase text-[7px]">KEPERLUAN</span>
                          <span className="font-bold text-slate-800 truncate max-w-[100px]">Iuran Bulanan</span>
                        </div>

                        <div className="border-b border-dashed border-slate-250 my-1.5" />

                        {/* Calculations */}
                        {(() => {
                          const originalNominal = 150000;
                          const discountAmount = (originalNominal * receiptDiscountPercent) / 100;
                          const taxableTotal = originalNominal - discountAmount;
                          const ppnAmount = (taxableTotal * receiptPpnPercent) / 100;
                          const finalTotal = taxableTotal + ppnAmount;
                          return (
                            <>
                              <div className="flex justify-between text-slate-600 font-bold">
                                <span className="uppercase text-[7.5px]">Subtotal</span>
                                <span className="font-mono">{formatRupiah(originalNominal)}</span>
                              </div>

                              {receiptDiscountPercent > 0 && (
                                <div className="flex justify-between text-rose-600 font-bold">
                                  <span className="uppercase text-[7.5px]">Diskon ({receiptDiscountPercent}%)</span>
                                  <span className="font-mono">-{formatRupiah(discountAmount)}</span>
                                </div>
                              )}

                              {receiptPpnPercent > 0 && (
                                <div className="flex justify-between text-indigo-600 font-bold">
                                  <span className="uppercase text-[7.5px]">PPN ({receiptPpnPercent}%)</span>
                                  <span className="font-mono">+{formatRupiah(ppnAmount)}</span>
                                </div>
                              )}

                              <div className="flex justify-between items-center bg-slate-50 p-1 rounded border border-slate-100 mt-1">
                                <span className="text-[7.5px] font-black text-slate-705 uppercase">TOTAL</span>
                                <span className="text-[9px] font-black text-emerald-600 font-mono">
                                  {formatRupiah(finalTotal)}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="text-center pt-2 mt-2 border-t border-dashed border-slate-250">
                        <p className="text-[7px] text-slate-400 font-black uppercase">
                          {receiptFooterThankYou}
                        </p>
                      </div>

                      {/* Receipt Serrated Border Decor at Bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-repeat-x overflow-hidden" 
                        style={{
                          backgroundImage: `linear-gradient(45deg, transparent 3px, white 3px), linear-gradient(-45deg, transparent 3px, white 3px)`,
                          backgroundSize: '6px 6px',
                          transform: 'translateY(1.5px)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* ============== PENGATURAN DESAIN KARTU TANDA ANGGOTA =================== */}
              {/* ========================================================================= */}
              <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>Desain Kartu Tanda Anggota (KTA)</span>
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    Kelola warna tema, orientasi cetak kartu, background grafis kustom depan & belakang, serta visibilitas informasi kop.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left controls */}
                  <div className="lg:col-span-7 space-y-5 text-left">
                    {/* Template Warna */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">Warna Utama Tema Kartu</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['blue', 'gold', 'red', 'emerald'] as const).map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setCetakCardTheme(col)}
                            className={`p-2 rounded-lg border text-[10px] font-bold capitalize transition cursor-pointer text-center ${
                              cetakCardTheme === col
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {col}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Orientasi Kartu */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">Orientasi Cetak</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['horizontal', 'vertical'] as const).map((orient) => (
                          <button
                            key={orient}
                            type="button"
                            onClick={() => setCetakCardOrientation(orient)}
                            className={`p-2 rounded-lg border text-[10px] font-bold capitalize transition cursor-pointer text-center ${
                              cetakCardOrientation === orient
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {orient === 'horizontal' ? 'Horizontal (Landscape)' : 'Vertical (Portrait)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Images */}
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-[#0f172a] uppercase tracking-wider">
                          🌄 Gambar Background Kustom
                        </span>
                        {(cetakCardBgFront || cetakCardBgBack) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCetakCardBgFront(null);
                              setCetakCardBgBack(null);
                              setCetakCardTextColorFront('white');
                              setCetakCardTextColorBack('black');
                            }}
                            className="text-[9px] text-rose-600 hover:underline font-bold cursor-pointer"
                          >
                            Reset Background
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Front file */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-600 block">Sisi Depan (Front BG)</label>
                          <div className="flex items-center space-x-2">
                            {cetakCardBgFront && (
                              <div className="relative group shrink-0 w-11 h-11 border border-slate-300 rounded-lg overflow-hidden bg-slate-100">
                                <img src={cetakCardBgFront} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setCetakCardBgFront(null)}
                                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[8px] font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </div>
                            )}
                            <label className="flex-1 border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 p-2.5 rounded-lg text-center cursor-pointer transition text-[10px] font-bold text-slate-600 block leading-none">
                              <span>📁 Unggah Gambar</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const r = new FileReader();
                                    r.onload = (ev) => {
                                      if (ev.target?.result) {
                                        setCetakCardBgFront(ev.target.result as string);
                                      }
                                    };
                                    r.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Back file */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-600 block">Sisi Belakang (Back BG)</label>
                          <div className="flex items-center space-x-2">
                            {cetakCardBgBack && (
                              <div className="relative group shrink-0 w-11 h-11 border border-slate-300 rounded-lg overflow-hidden bg-slate-100">
                                <img src={cetakCardBgBack} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setCetakCardBgBack(null)}
                                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[8px] font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </div>
                            )}
                            <label className="flex-1 border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 p-2.5 rounded-lg text-center cursor-pointer transition text-[10px] font-bold text-slate-600 block leading-none">
                              <span>📁 Unggah Gambar</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const r = new FileReader();
                                    r.onload = (ev) => {
                                      if (ev.target?.result) {
                                        setCetakCardBgBack(ev.target.result as string);
                                      }
                                    };
                                    r.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Text color and visibility */}
                      <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-extrabold text-slate-600 uppercase block tracking-wider pb-1 border-b border-slate-200">
                          Pengaturan Lanjutan Tampilan
                        </span>

                        {/* Text colors controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {cetakCardBgFront && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-bold text-slate-700">Teks Depan</span>
                              <div className="flex space-x-1.5">
                                {(['white', 'black'] as const).map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setCetakCardTextColorFront(color)}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition cursor-pointer ${
                                      cetakCardTextColorFront === color
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {color === 'white' ? 'Terang' : 'Gelap'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {cetakCardBgBack && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-bold text-slate-700">Teks Belakang</span>
                              <div className="flex space-x-1.5">
                                {(['white', 'black'] as const).map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setCetakCardTextColorBack(color)}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition cursor-pointer ${
                                      cetakCardTextColorBack === color
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {color === 'white' ? 'Terang' : 'Gelap'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Visibilities checkboxes/switches */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => setCetakCardHideHeader(!cetakCardHideHeader)}
                            className={`flex items-center justify-center space-x-1 bg-white p-2 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                              cetakCardHideHeader ? 'border-rose-300 text-rose-700 bg-rose-50/50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cetakCardHideHeader ? '❌ Sembunyikan Kop Atas' : '👁️ Tampilkan Kop Atas'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCetakCardHideFooter(!cetakCardHideFooter)}
                            className={`flex items-center justify-center space-x-1 bg-white p-2 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                              cetakCardHideFooter ? 'border-rose-300 text-rose-700 bg-rose-50/50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cetakCardHideFooter ? '❌ Sembunyikan Kontak Bawah' : '👁️ Tampilkan Kontak Bawah'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side preview of ID Card */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-250 min-h-[350px]">
                    <span className="text-[9px] tracking-widest text-[#94a3b8] font-black block mb-3 uppercase leading-none">
                      🔍 MINIATUR PREVIEW KARTU DESAIN
                    </span>

                    {/* Simulating card rendering inside settings */}
                    {(() => {
                      // Color schemes
                      const themeColors = {
                        blue: { bg: 'from-blue-650 to-indigo-850', border: 'border-blue-400', banner: 'bg-blue-900/30', text: 'text-blue-200' },
                        gold: { bg: 'from-amber-500 to-yellow-700', border: 'border-amber-300', banner: 'bg-amber-950/30', text: 'text-amber-100' },
                        red: { bg: 'from-rose-600 to-red-800', border: 'border-rose-400', banner: 'bg-rose-900/30', text: 'text-rose-200' },
                        emerald: { bg: 'from-emerald-600 to-teal-800', border: 'border-emerald-400', banner: 'bg-emerald-900/30', text: 'text-emerald-200' }
                      };
                      const sTheme = themeColors[cetakCardTheme] || themeColors.blue;
                      return (
                        <div 
                          className={`relative overflow-hidden rounded-xl border shadow-md flex flex-col justify-between p-3 select-none ${
                            cetakCardBgFront ? (cetakCardTextColorFront === 'white' ? 'text-white' : 'text-slate-900 bg-white') : 'text-white bg-gradient-to-br ' + sTheme.bg
                          } ${sTheme.border}`}
                          style={{
                            width: '230px',
                            height: '146px',
                            backgroundImage: cetakCardBgFront ? `url(${cetakCardBgFront})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          {/* Inner content simulator */}
                          {!cetakCardHideHeader && (
                            <div className="flex items-center space-x-1 pb-1 border-b border-white/20 select-none">
                              <School className="w-3.5 h-3.5 shrink-0" />
                              <div className="leading-tight">
                                <p className="text-[7px] font-black uppercase tracking-wide truncate max-w-[170px]">{lembagaLogin || "PORTAL SAPTA INDONESIA"}</p>
                                <p className="text-[5px] opacity-70 tracking-tighter truncate max-w-[170px]">KARTU TANDA REGISTRASI ANGGOTA RESMI</p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-grow py-1 select-none">
                            <div className="w-10 h-12 bg-slate-300/40 rounded border border-white/25 flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 opacity-40 shrink-0" />
                            </div>
                            <div className="leading-none space-y-0.5">
                              <p className="text-[7.5px] font-black uppercase text-ellipsis overflow-hidden whitespace-nowrap max-w-[150px]">Achmad Fauzi</p>
                              <p className="text-[6.5px] font-bold opacity-80">NIA: 20260001</p>
                              <p className="text-[5.5px] opacity-75">Kelas: Utama</p>
                              <p className="text-[5px] bg-black/25 px-1 py-0.2 rounded font-black uppercase text-white tracking-widest max-w-max">AKTIF</p>
                            </div>
                          </div>

                          {!cetakCardHideFooter && (
                            <div className="text-[5px] text-center opacity-60 border-t border-white/10 pt-1 leading-none select-none">
                              Email: {gmailLogin || "info@sapta-portal.id"} • Sistem Valid terdaftar otomatis
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* ======================= VIEW: KELOLA AKUN ======================= */}
          {activeTab === 'kelola_akun' && (
            <div className="space-y-6 animate-fade-in print-exclude p-6">
              {/* Info Header Card */}
              <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#0f172a] flex items-center space-x-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    <span>Kelola Sub-Akun Akses (KELOLA AKUN)</span>
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    Atur hak akses akun member lembaga, tambah akun baru atau hapus menu tertentu dari akun tersebut.
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Open the Add Sub-Account Modal
                    setSubAccountFormValues({
                      nama: '',
                      username: '',
                      pasword: '',
                      remove_menu: ''
                    });
                    setEditingSubAccount(null);
                    setSubAccountModalType('add');
                    setIsSubAccountModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Sub-Akun</span>
                </button>
              </div>

              {/* Sub-Account Search Panel */}
              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] flex items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari sub-akun berdasarkan nama atau username..."
                    value={subAccountSearchQuery}
                    onChange={(e) => setSubAccountSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-slate-50/50"
                  />
                </div>
                <button
                  onClick={fetchSubAccounts}
                  disabled={isLoadingSubAccounts}
                  className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSubAccounts ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Sub Accounts Table list */}
              <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase select-none">
                        <th className="px-6 py-3.5">Nama</th>
                        <th className="px-6 py-3.5">username</th>
                        <th className="px-6 py-3.5">pasword</th>
                        <th className="px-6 py-3.5">remove menu</th>
                        <th className="px-6 py-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] text-[11px] font-semibold text-[#334155]">
                      {isLoadingSubAccounts ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-400 select-none">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                              <span>Memuat data Akun Sapta...</span>
                            </div>
                          </td>
                        </tr>
                      ) : subAccountsError ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-rose-500 select-none">
                            {subAccountsError}
                          </td>
                        </tr>
                      ) : subAccountList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-400 select-none">
                            Belum ada sub-akun dikonfigurasi. Klik tombol "Tambah Sub-Akun" di atas.
                          </td>
                        </tr>
                      ) : (
                        subAccountList
                          .filter(acc => 
                            (acc.nama || '').toLowerCase().includes(subAccountSearchQuery.toLowerCase()) ||
                            (acc.username || '').toLowerCase().includes(subAccountSearchQuery.toLowerCase())
                          )
                          .map((acc, index) => {
                            const blockedMenus = acc.remove_menu
                              ? acc.remove_menu.split(',').map((s: string) => s.trim()).filter(Boolean)
                              : [];
                            return (
                              <tr key={index} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 font-bold text-slate-800">{acc.nama}</td>
                                <td className="px-6 py-4 font-mono text-xs text-indigo-600 bg-indigo-50/20 px-2 py-0.5 rounded max-w-max">
                                  {acc.username}
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-600">
                                  <span>{acc.pasword}</span>
                                </td>
                                <td className="px-6 py-4">
                                  {blockedMenus.length === 0 ? (
                                    <span className="text-emerald-600 bg-emerald-50 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                      Akses Penuh (Full Access)
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {blockedMenus.map((m: string, idx: number) => (
                                        <span key={idx} className="text-rose-600 bg-rose-50 text-[9px] px-2 py-0.5 rounded font-bold capitalize">
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingSubAccount(acc);
                                        setSubAccountFormValues({
                                          nama: acc.nama,
                                          username: acc.username,
                                          pasword: acc.pasword,
                                          remove_menu: acc.remove_menu || ''
                                        });
                                        setSubAccountModalType('edit');
                                        setIsSubAccountModalOpen(true);
                                      }}
                                      title="Edit Akun"
                                      className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded transition cursor-pointer flex items-center space-x-1"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (window.confirm(`Apakah Anda yakin ingin menghapus sub-akun "${acc.nama}"?`)) {
                                          try {
                                            setIsLoadingSubAccounts(true);
                                            const endpoint = appsScriptUrl || localStorage.getItem('LINK_SCRIPT_UTAMA') || '';
                                            if (!endpoint) throw new Error('Script URL Utama kosong.');

                                            const targetUrl = endpoint;
                                            const response = await fetch(targetUrl, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                              body: new URLSearchParams({
                                                action: 'delete',
                                                sheetName: 'KELOLA AKUN',
                                                primaryKey: acc.username // Use username as key
                                              })
                                            });
                                            if (!response.ok) throw new Error('Respons server gagal.');
                                            const resTxt = await response.text();
                                            const resJson = JSON.parse(resTxt);
                                            if (resJson.error) throw new Error(resJson.message);

                                            addToast(`Sukses menghapus akun ${acc.nama}`, 'success');
                                            fetchSubAccounts();
                                          } catch (err: any) {
                                            addToast(`Gagal menghapus: ${err.message}`, 'error');
                                          } finally {
                                            setIsLoadingSubAccounts(false);
                                          }
                                        }
                                      }}
                                      title="Hapus Akun"
                                      className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition cursor-pointer flex items-center space-x-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Hapus</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* ================ SUB-ACCOUNT EDIT / ADD MODAL ============ */}
          {/* ========================================================== */}
          {isSubAccountModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
              <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between border border-[#e2e8f0] animate-scale-up">
                
                {/* Modal Header */}
                <header className="px-6 py-5 border-b border-[#f1f5f9] flex items-center justify-between bg-white rounded-t-2xl shrink-0">
                  <h3 className="font-extrabold text-[#0f172a] font-sans text-base tracking-tight">
                    {subAccountModalType === 'add' ? 'Tambah Sub-Akun Baru' : 'Edit Sub-Akun Akses'}
                  </h3>
                  <button
                    onClick={() => setIsSubAccountModalOpen(false)}
                    className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </header>

                {/* Modal Body / Form */}
                <form onSubmit={handleSaveSubAccount} className="p-6 space-y-5">
                  
                  {/* Field: NAMA LENGKAP */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      NAMA LENGKAP
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama lengkap..."
                      value={subAccountFormValues.nama}
                      onChange={(e) => setSubAccountFormValues(prev => ({ ...prev, nama: e.target.value }))}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-850"
                    />
                  </div>

                  {/* Field: NAMA PENGGUNA (USERNAME) */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      NAMA PENGGUNA (USERNAME)
                    </label>
                    <input
                      type="text"
                      required
                      disabled={subAccountModalType === 'edit'}
                      placeholder="Masukkan username (contoh: admin_baru)..."
                      value={subAccountFormValues.username}
                      onChange={(e) => {
                        const cleanValue = e.target.value.toLowerCase().replace(/\s+/g, '');
                        setSubAccountFormValues(prev => ({ ...prev, username: cleanValue }));
                      }}
                      className={`w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-500 text-slate-850 ${
                        subAccountModalType === 'edit' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50/50'
                      }`}
                    />
                    {subAccountModalType === 'edit' && (
                      <p className="text-[10px] text-slate-400 italic font-medium">Username tidak dapat diubah setelah dibuat.</p>
                    )}
                  </div>

                  {/* Field: KATA SANDI (PASSWORD) */}
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      KATA SANDI (PASSWORD)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan kata sandi..."
                      value={subAccountFormValues.pasword}
                      onChange={(e) => setSubAccountFormValues(prev => ({ ...prev, pasword: e.target.value }))}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-850"
                    />
                  </div>

                  {/* Checkboxes: MENU TERBLOKIR */}
                  <div className="pt-2 border-t border-slate-150 text-left">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      MENU TERBLOKIR
                    </label>
                    <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                      Centang di bawah ini untuk memblokir hak akses halaman tertentu dari akun ini. Biarkan kosong untuk memberikan akses penuh.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-slate-50/20">
                      {[
                        { key: 'anggota', label: 'Daftar Anggota' },
                        { key: 'pembayaran', label: 'Pembayaran / Keuangan' },
                        { key: 'prestasi', label: 'Prestasi Anggota' },
                        { key: 'pelanggaran', label: 'Pelanggaran / Ketertiban' },
                        { key: 'absensi', label: 'Rekap Absensi' },
                        { key: 'informasi', label: 'Informasi / Kabar' },
                        { key: 'surat', label: 'Surat Resmi' },
                        { key: 'peraturan', label: 'Peraturan & Regulasi' },
                        { key: 'cetak_data', label: 'Cetak & Simpan Data' },
                        { key: 'pengaturan', label: 'Pengaturan Sistem' },
                      ].map((menuItem) => {
                        const isBlocked = subAccountFormValues.remove_menu
                          ? subAccountFormValues.remove_menu.split(',').map(s => s.trim().toLowerCase()).includes(menuItem.key.toLowerCase())
                          : false;
                        return (
                          <label
                            key={menuItem.key}
                            className={`flex items-center space-x-2.5 p-2 rounded-lg border transition cursor-pointer select-none text-[11px] font-semibold ${
                              isBlocked
                                ? 'border-rose-200 bg-rose-50/50 text-rose-700 font-bold'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBlocked}
                              onChange={() => handleToggleRemoveMenu(menuItem.key)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                            />
                            <span>{menuItem.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-[#f1f5f9] flex justify-end gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setIsSubAccountModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-[#f8fafc] transition cursor-pointer shadow-sm"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingSubAccount}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer shadow-sm flex items-center justify-center space-x-1"
                    >
                      {isSavingSubAccount ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <span>Simpan Akun</span>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}


          {/* ======================= VIEW: CETAK & SIMPAN DATA ======================= */}
          {activeTab === 'cetak_data' && (
            <div className="space-y-6 animate-fade-in p-6">
              {printNotification && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg border border-slate-700/50 flex items-center space-x-2 animate-bounce print-exclude">
                  <Printer className="w-4 h-4 text-indigo-400 animate-pulse animate-spin" />
                  <span>{printNotification}</span>
                </div>
              )}

              {isInIframe && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-medium text-amber-800 flex items-start space-x-3 print-exclude shadow-sm">
                  <span className="text-sm">⚠️</span>
                  <div className="space-y-1 text-left">
                    <p className="font-bold">Mode Preview Terdeteksi</p>
                    <p className="leading-relaxed font-normal text-amber-700">
                      Jika tombol cetak tidak memunculkan dialog pencetakan di perangkat Anda, silakan klik tombol <strong>"Buka Tab Baru"</strong> di pojok kanan atas untuk menghindari pemblokiran iframe oleh browser Anda.
                    </p>
                  </div>
                </div>
              )}

              {/* Global print stylesheet handles all printing layouts */}

              {/* Sub Navigation Tabs */}
              <div className="bg-white p-2 rounded-xl border border-[#e2e8f0] flex flex-wrap gap-1 print-exclude shadow-sm">
                <button
                  onClick={() => setCetakActiveSubTab('kartu')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    cetakActiveSubTab === 'kartu'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/15'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>1. Kartu Identitas Anggota</span>
                </button>
                <button
                  onClick={() => setCetakActiveSubTab('absensi')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    cetakActiveSubTab === 'absensi'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/15'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>2. Rekap Absensi</span>
                </button>
                <button
                  onClick={() => setCetakActiveSubTab('pelanggaran')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    cetakActiveSubTab === 'pelanggaran'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/15'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>3. Laporan Pelanggaran</span>
                </button>
              </div>

              {/* SECTION 1: KARTU IDENTITAS ANGGOTA */}
              {cetakActiveSubTab === 'kartu' && (() => {
                const currentNia = cetakSelectedNia || (anggotaList[0] ? anggotaList[0].nia : '');
                const selectedAnggota = anggotaList.find(a => String(a.nia) === String(currentNia));

                const themeColors = {
                  blue: {
                    accent: 'bg-blue-600 text-white',
                    border: 'border-blue-600',
                    gradient: 'from-blue-700 to-indigo-950',
                    text: 'text-blue-700'
                  },
                  gold: {
                    accent: 'bg-amber-600 text-white',
                    border: 'border-amber-500',
                    gradient: 'from-amber-600 to-amber-950',
                    text: 'text-amber-700'
                  },
                  red: {
                    accent: 'bg-rose-600 text-white',
                    border: 'border-rose-600',
                    gradient: 'from-rose-700 to-red-950',
                    text: 'text-rose-700'
                  },
                  emerald: {
                    accent: 'bg-emerald-600 text-white',
                    border: 'border-emerald-600',
                    gradient: 'from-emerald-700 to-teal-950',
                    text: 'text-emerald-700'
                  }
                };
                const themeClasses = themeColors[cetakCardTheme] || themeColors.blue;

                return (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Controls Side Panel */}
                    <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-5 print-exclude shadow-sm text-left">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
                        Konfigurasi Kartu
                      </h4>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">Pilih Anggota</label>
                        <select
                          value={currentNia}
                          onChange={(e) => setCetakSelectedNia(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 cursor-pointer bg-white"
                        >
                          {anggotaList.map((a) => (
                            <option key={a.nia} value={a.nia}>
                              {a.namaLengkap} - {a.nia}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">Template Warna</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['blue', 'gold', 'red', 'emerald'] as const).map((col) => (
                            <button
                              key={col}
                              onClick={() => setCetakCardTheme(col)}
                              className={`p-2 rounded-lg border text-[10px] font-bold capitalize transition cursor-pointer text-center ${
                                cetakCardTheme === col
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">Orientasi Kartu</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['horizontal', 'vertical'] as const).map((orient) => (
                            <button
                              key={orient}
                              onClick={() => setCetakCardOrientation(orient)}
                              className={`p-2 rounded-lg border text-[10px] font-bold capitalize transition cursor-pointer text-center ${
                                cetakCardOrientation === orient
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {orient}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* --- CUSTOM BACKGOUND UPLOADER FOR CARD DESIGN --- */}
                      <div className="space-y-3.5 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-wider">
                            🎨 Desain Background Kustom
                          </h5>
                          {(cetakCardBgFront || cetakCardBgBack) && (
                            <button
                              type="button"
                              onClick={() => {
                                setCetakCardBgFront(null);
                                setCetakCardBgBack(null);
                                setCetakCardTextColorFront('white');
                                setCetakCardTextColorBack('black');
                                setCetakCardHideHeader(false);
                                setCetakCardHideFooter(false);
                              }}
                              className="text-[9px] text-rose-600 hover:underline font-bold cursor-pointer"
                            >
                              Reset Semua
                            </button>
                          )}
                        </div>

                        {/* Front background design */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-600 block">Desain Sisi Depan (Front)</label>
                          <div className="flex items-center space-x-2">
                            {cetakCardBgFront ? (
                              <div className="relative group shrink-0 w-11 h-11 border border-slate-300 rounded-lg overflow-hidden bg-slate-100">
                                <img src={cetakCardBgFront} className="w-full h-full object-cover animate-fade-in" />
                                <button
                                  type="button"
                                  onClick={() => setCetakCardBgFront(null)}
                                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[8px] font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </div>
                            ) : null}
                            <label className="flex-1 border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 p-2.5 rounded-lg text-center cursor-pointer transition text-[10px] font-bold text-slate-600 block leading-none">
                              <span>📁 Pilih File Gambar</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (reEv) => {
                                      setCetakCardBgFront(reEv.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Back background design */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-600 block">Desain Sisi Belakang (Back)</label>
                          <div className="flex items-center space-x-2">
                            {cetakCardBgBack ? (
                              <div className="relative group shrink-0 w-11 h-11 border border-slate-300 rounded-lg overflow-hidden bg-slate-100">
                                <img src={cetakCardBgBack} className="w-full h-full object-cover animate-fade-in" />
                                <button
                                  type="button"
                                  onClick={() => setCetakCardBgBack(null)}
                                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[8px] font-bold cursor-pointer"
                                >
                                  Hapus
                                </button>
                              </div>
                            ) : null}
                            <label className="flex-1 border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 p-2.5 rounded-lg text-center cursor-pointer transition text-[10px] font-bold text-slate-600 block leading-none">
                              <span>📁 Pilih File Gambar</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (reEv) => {
                                      setCetakCardBgBack(reEv.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Extra controls if either bg is uploaded */}
                        {(cetakCardBgFront || cetakCardBgBack) && (
                          <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-left">
                            <span className="text-[9px] font-extrabold text-slate-600 uppercase block tracking-wider pb-1 border-b">
                              Pengaturan Tampilan
                            </span>

                            {cetakCardBgFront && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-slate-700">Warna Teks Depan</span>
                                <div className="flex space-x-1">
                                  {(['white', 'black'] as const).map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setCetakCardTextColorFront(color)}
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition cursor-pointer ${
                                        cetakCardTextColorFront === color
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {color === 'white' ? 'Terang' : 'Gelap'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {cetakCardBgBack && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-slate-700">Warna Teks Belakang</span>
                                <div className="flex space-x-1">
                                  {(['white', 'black'] as const).map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setCetakCardTextColorBack(color)}
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition cursor-pointer ${
                                        cetakCardTextColorBack === color
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {color === 'white' ? 'Terang' : 'Gelap'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 font-medium">
                              <label className="flex items-center space-x-2 text-[10px] text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cetakCardHideHeader}
                                  onChange={(e) => setCetakCardHideHeader(e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                />
                                <span>Sembunyikan Header KTA/KTS</span>
                              </label>

                              <label className="flex items-center space-x-2 text-[10px] text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cetakCardHideFooter}
                                  onChange={(e) => setCetakCardHideFooter(e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                />
                                <span>Sembunyikan Label validasi bawah</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t">
                        <button
                          onClick={() => executeDevicePrint('area-kartu-identitas')}
                          disabled={!selectedAnggota}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Cetak Kartu Tanda Anggota</span>
                        </button>
                      </div>
                    </div>

                    {/* Preview Area */}
                    <div className="xl:col-span-2 flex flex-col items-center justify-center space-y-4">
                      <div className="w-full text-center print-exclude">
                        <span className="text-[10px] tracking-widest text-[#94a3b8] font-bold block">
                          REAL-TIME DIGITAL PREVIEW
                        </span>
                      </div>

                      <div
                        id="area-kartu-identitas"
                        className={`flex flex-col items-center gap-6 p-6 bg-white rounded-2xl w-full max-w-2xl border border-[#e2e8f0] shadow-sm ${
                          printElementId === 'area-kartu-identitas' ? 'print-now' : ''
                        }`}
                      >
                        {selectedAnggota ? (
                          <div className={`w-full flex ${cetakCardOrientation === 'horizontal' ? 'flex-col md:flex-row md:flex-wrap md:justify-center' : 'flex-col items-center'} gap-6 justify-center items-center`}>
                            
                            {/* FRONT OF THE CARD */}
                            <div
                              className={`relative overflow-hidden rounded-xl border-2 ${themeClasses.border} shadow-lg shrink-0 flex flex-col justify-between ${
                                cetakCardBgFront 
                                  ? (cetakCardTextColorFront === 'white' ? 'text-white' : 'text-slate-900') 
                                  : 'text-white bg-gradient-to-br ' + themeClasses.gradient
                              }`}
                              style={{
                                width: cetakCardOrientation === 'horizontal' ? '340px' : '240px',
                                height: cetakCardOrientation === 'horizontal' ? '216px' : '340px',
                                ...(cetakCardBgFront ? {
                                  backgroundImage: `url(${cetakCardBgFront})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                } : {})
                              }}
                            >
                              {/* Background Overlays */}
                              {!cetakCardBgFront && (
                                <>
                                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-yellow-300 via-rose-300 to-indigo-800" />
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
                                </>
                              )}

                              {/* Card Header */}
                              {!cetakCardHideHeader && (
                                <div className={`p-3 border-b flex items-center space-x-2 z-10 ${
                                  cetakCardBgFront 
                                    ? (cetakCardTextColorFront === 'white' ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-100/60') 
                                    : 'border-white/20 bg-black/10'
                                }`}>
                                  <div className={`p-1 rounded ${cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'bg-slate-200' : 'bg-white/10'}`}>
                                    <School className={`w-4 h-4 ${cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-indigo-600' : 'text-yellow-300'}`} />
                                  </div>
                                  <div className="leading-tight text-left">
                                    <h3 className={`text-[9px] font-black tracking-wider uppercase truncate max-w-[200px] ${
                                      cetakCardBgFront 
                                        ? (cetakCardTextColorFront === 'white' ? 'text-yellow-300' : 'text-indigo-950')
                                        : 'text-yellow-300'
                                    }`}>
                                      {lembagaLogin || "Lembaga Sapta"}
                                    </h3>
                                    <p className={`text-[7px] uppercase tracking-widest font-mono ${
                                      cetakCardBgFront 
                                        ? (cetakCardTextColorFront === 'white' ? 'text-white/80' : 'text-slate-500')
                                        : 'text-white/80'
                                    }`}>
                                      KARTU TANDA ANGGOTA
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Card Body */}
                              <div className={`p-4 flex ${cetakCardOrientation === 'horizontal' ? 'flex-row' : 'flex-col items-center text-center'} gap-3 z-10 flex-1 justify-center`}>
                                {/* Profile image photo frame with Barcode */}
                                <div className="shrink-0 flex flex-col items-center justify-center space-y-1 bg-black/5 p-1 rounded border border-white/10">
                                  <img
                                    src={selectedAnggota.linkProfile || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop"}
                                    alt="Foto"
                                    referrerPolicy="no-referrer"
                                    className="w-14 h-18 bg-slate-300 object-cover rounded border border-white/40 shadow shadow-black/30"
                                  />
                                  {/* Front Barcode */}
                                  <div className="flex flex-col items-center justify-center p-0.5 bg-white rounded border border-slate-200 shadow-xs leading-none">
                                    <img
                                      src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(selectedAnggota.nia || '')}&scale=2&height=8&includetext=false`}
                                      alt="Barcode"
                                      referrerPolicy="no-referrer"
                                      className="h-3 w-12 object-contain block"
                                      onError={(e) => {
                                        // fallback to tec-it if bwipjs returns error
                                        e.currentTarget.src = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(selectedAnggota.nia || '')}&code=Code128&translate-esc=true&dpi=96`;
                                      }}
                                    />
                                    <span className="text-[5px] font-mono tracking-wider text-slate-800 font-extrabold mt-0.5 leading-none block">
                                      {selectedAnggota.nia}
                                    </span>
                                  </div>
                                </div>

                                {/* Text data credentials */}
                                <div className="space-y-1.5 text-left leading-tight flex-1 min-w-0">
                                  <div>
                                    <span className={`text-[6px] tracking-wider uppercase block ${
                                      cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-500' : 'text-white/70'
                                    }`}>
                                      NOMOR INDUK ANGGOTA
                                    </span>
                                    <span className={`text-[11px] font-mono font-black tracking-widest ${
                                      cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-indigo-600' : 'text-yellow-200'
                                    }`}>
                                      {selectedAnggota.nia}
                                    </span>
                                  </div>
                                  <div>
                                    <span className={`text-[6px] tracking-wider uppercase block ${
                                      cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-500' : 'text-white/70'
                                    }`}>
                                      NAMA LENGKAP
                                    </span>
                                    <h4 className={`text-[10px] font-black uppercase tracking-wide border-b pb-0.5 truncate ${
                                      cetakCardBgFront 
                                        ? (cetakCardTextColorFront === 'white' ? 'text-white border-white/15' : 'text-slate-900 border-slate-200')
                                        : 'text-white border-white/15'
                                    }`}>
                                      {selectedAnggota.namaLengkap}
                                    </h4>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                                    <div>
                                      <span className={`text-[5px] tracking-wider block ${
                                        cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-400' : 'text-white/60'
                                      }`}>
                                        KELAS / TINGKAT
                                      </span>
                                      <span className={`text-[8px] font-bold uppercase truncate block ${
                                        cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-800' : 'text-white'
                                      }`}>{selectedAnggota.kelas || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className={`text-[5px] tracking-wider block ${
                                        cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-400' : 'text-white/60'
                                      }`}>
                                        JABATAN
                                      </span>
                                      <span className={`text-[8px] font-bold uppercase truncate block ${
                                        cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-800' : 'text-white'
                                      }`}>{selectedAnggota.status || 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer */}
                              {!cetakCardHideFooter && (
                                <div className={`p-2 border-t text-center z-10 flex items-center justify-between ${
                                  cetakCardBgFront 
                                    ? (cetakCardTextColorFront === 'white' ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-slate-100/50') 
                                    : 'border-white/10 bg-black/20'
                                }`}>
                                  <span className={`text-[6px] tracking-widest font-mono ${
                                    cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-slate-500' : 'opacity-70'
                                  }`}>
                                    SAPTA DIGITAL CARD
                                  </span>
                                  <span className={`text-[6px] font-bold ${
                                    cetakCardBgFront && cetakCardTextColorFront === 'black' ? 'text-indigo-600' : 'text-yellow-300'
                                  }`}>
                                    VALID PERMANEN
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* BACK OF THE CARD */}
                            <div
                              className={`relative overflow-hidden rounded-xl border border-slate-300 shadow-lg shrink-0 flex flex-col justify-between ${
                                cetakCardBgBack 
                                  ? (cetakCardTextColorBack === 'white' ? 'text-white bg-slate-900' : 'text-slate-800 bg-white') 
                                  : 'bg-white text-slate-800'
                              }`}
                              style={{
                                width: cetakCardOrientation === 'horizontal' ? '340px' : '240px',
                                height: cetakCardOrientation === 'horizontal' ? '216px' : '340px',
                                ...(cetakCardBgBack ? {
                                  backgroundImage: `url(${cetakCardBgBack})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                } : {}),
                              }}
                            >
                              {/* Overlay pattern background */}
                              {!cetakCardBgBack && (
                                <div className="absolute inset-x-0 bottom-0 top-1/2 bg-slate-50 border-t border-slate-100" />
                              )}
                              
                              {/* Rules guidelines heading */}
                              {!cetakCardHideHeader && (
                                <div className={`p-2 text-center z-10 ${
                                  cetakCardBgBack 
                                    ? (cetakCardTextColorBack === 'white' ? 'bg-black/30 border-b border-white/10' : 'bg-slate-100/80 border-b border-slate-200') 
                                    : 'bg-slate-100 border-b border-slate-200'
                                }`}>
                                  <h4 className={`text-[8px] font-bold tracking-wider uppercase ${
                                    cetakCardBgBack && cetakCardTextColorBack === 'white' ? 'text-yellow-400' : 'text-slate-700'
                                  }`}>Ketentuan Pemegang Kartu</h4>
                                </div>
                              )}

                              {/* Rules list body */}
                              <div className={`p-3.5 space-y-1 text-left text-[7px] leading-relaxed z-10 font-bold flex-1 ${
                                cetakCardBgBack && cetakCardTextColorBack === 'white' ? 'text-slate-100' : 'text-slate-600'
                              }`}>
                                <p>1. Kartu ini milik sah lembaga {lembagaLogin || "Portal Sapta"}.</p>
                                <p>2. Kartu wajib dibawa dan ditunjukkan pada setiap jenis kegiatan formal.</p>
                                <p>3. Dilarang keras menyalahgunakan atau merusak fisik kartu ini.</p>
                                <p>4. Jika menemukan kartu ini, harap hubungi pengelola sekretariat.</p>
                              </div>

                              {/* QR Code representation zone */}
                              <div className={`p-2 flex flex-col items-center justify-center space-y-1 z-10 leading-none ${
                                cetakCardBgBack 
                                  ? (cetakCardTextColorBack === 'white' ? 'bg-black/35 border-t border-white/10' : 'bg-white/95 border-t border-slate-100') 
                                  : 'bg-white border-t border-slate-100'
                              }`}>
                                <div className="p-0.5 bg-white rounded border border-slate-200 inline-block shadow-xs">
                                  <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(selectedAnggota.nia || '')}`}
                                    alt="QR Code"
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 block"
                                  />
                                </div>
                                <span className={`text-[6px] font-mono tracking-wider font-extrabold leading-none ${
                                  cetakCardBgBack && cetakCardTextColorBack === 'white' ? 'text-slate-300' : 'text-slate-500'
                                }`}>
                                  SCAN ABSENSI: {selectedAnggota.nia}
                                </span>
                              </div>
                            </div>

                          </div>
                        ) : (
                          <div className="p-10 text-center text-slate-400 font-bold select-none text-xs">
                            Unggah data anggota terlebih dahulu untuk melihat preview kartu identitas.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SECTION 2: REKAP ABSENSI ANGGOTA */}
              {cetakActiveSubTab === 'absensi' && (() => {
                // Get pre-filtered absensi by Nia & Class for base counters
                const baseAbsensi = absensiList.filter(item => {
                  const matchNia = cetakSelectedNia === 'Semua' || !cetakSelectedNia || String(item.nia) === String(cetakSelectedNia);
                  const matchClass = cetakSelectedClass === 'Semua' || (item.kelas || '').toLowerCase() === cetakSelectedClass.toLowerCase();
                  return matchNia && matchClass;
                });

                // Compute counters using the base selection and correct helper
                const hadirCount = baseAbsensi.filter(a => getAbsensiStatus(a.keterangan) === 'Hadir').length;
                const izinCount = baseAbsensi.filter(a => getAbsensiStatus(a.keterangan) === 'Izin').length;
                const sakitCount = baseAbsensi.filter(a => getAbsensiStatus(a.keterangan) === 'Sakit').length;
                const alfaCount = baseAbsensi.filter(a => getAbsensiStatus(a.keterangan) === 'Alpha').length;

                // Get final printed/displayed target filtered by status selection
                const targetAbsensi = baseAbsensi.filter(item => {
                  if (cetakSelectedStatus === 'Semua') return true;
                  const statusVal = getAbsensiStatus(item.keterangan);
                  return statusVal === cetakSelectedStatus;
                });

                // Unique Class options list
                const kelasList = Array.from(new Set(anggotaList.map(a => a.kelas).filter(Boolean)));

                return (
                  <div className="space-y-6">
                    {/* Controls Header Row view - Ordered: Kelas, Anggota, Status */}
                    <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-4 gap-4 items-end print-exclude shadow-sm">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Filter Kelas</label>
                        <select
                          value={cetakSelectedClass}
                          onChange={(e) => setCetakSelectedClass(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg outline-none cursor-pointer bg-white"
                        >
                          <option value="Semua">-- Semua Kelas --</option>
                          {kelasList.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Filter Anggota</label>
                        <select
                          value={cetakSelectedNia}
                          onChange={(e) => setCetakSelectedNia(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg outline-none cursor-pointer bg-white"
                        >
                          <option value="Semua">-- Semua Anggota --</option>
                          {anggotaList.map((a) => (
                            <option key={a.nia} value={a.nia}>
                              {a.namaLengkap} ({a.nia})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Filter Status</label>
                        <select
                          value={cetakSelectedStatus}
                          onChange={(e) => setCetakSelectedStatus(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg outline-none cursor-pointer bg-white"
                        >
                          <option value="Semua">Semua Kehadiran</option>
                          <option value="Hadir">Hadir ({hadirCount})</option>
                          <option value="Izin">Izin ({izinCount})</option>
                          <option value="Sakit">Sakit ({sakitCount})</option>
                          <option value="Alpha">Alpha/Tanpa Keterangan ({alfaCount})</option>
                        </select>
                      </div>

                      <div>
                        <button
                          onClick={() => executeDevicePrint('area-rekap-absensi')}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Printer className="w-4 h-4 text-white" />
                          <span>Cetak Rekap Absensi</span>
                        </button>
                      </div>
                    </div>

                    {/* Report statement Sheet layout */}
                    <div
                      id="area-rekap-absensi"
                      className={`bg-white rounded-2xl border border-slate-200 p-8 max-w-4xl mx-auto shadow-sm ${
                        printElementId === 'area-rekap-absensi' ? 'print-now text-black' : 'text-slate-800'
                      }`}
                    >
                      {/* Letterhead */}
                      <div className="border-b-4 border-double border-slate-900 pb-2.5 mb-6 text-center">
                        <h2 className="text-xl font-extrabold tracking-wide uppercase text-slate-900">
                          {lembagaLogin || "SEKRETARIAT UTAMA LEMBAGA SAPTA INDONESIA"}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold tracking-wider pt-0.5">
                          Sistem Pemantauan Terpadu • Email: {gmailLogin || 'info@sapta-portal.id'}
                        </p>
                      </div>

                      <div className="text-center space-y-1 mb-6 leading-relaxed">
                        <h3 className="text-sm font-bold tracking-wider text-slate-900 uppercase underline">
                          LAPORAN REKAPITULASI PRESENSI & KEHADIRAN ANGGOTA
                        </h3>
                        <p className="text-[10px] text-slate-500 tracking-wide">
                          Dicetak pada: {formatDateString(new Date().toISOString().substring(0,10))}
                        </p>
                      </div>

                      {/* Filter Details Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/75 border rounded-xl p-4 mb-6 text-[10px] font-bold text-slate-600 leading-tight text-left">
                        <div>
                          <span className="block text-slate-400 font-normal">FILTER ANGGOTA</span>
                          <span className="text-slate-800 leading-normal block">
                            {cetakSelectedNia === 'Semua' || !cetakSelectedNia ? 'Semua Anggota' : anggotaList.find(a=>String(a.nia)===String(cetakSelectedNia))?.namaLengkap || 'Anggota Mandiri'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-400 font-normal">KELAS / TINGKAT</span>
                          <span className="text-slate-800 leading-normal block">{cetakSelectedClass}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400 font-normal">SITUASI / STATUS</span>
                          <span className="text-emerald-600 leading-normal block uppercase font-extrabold">{cetakSelectedStatus}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400 font-normal">TOTAL ENTRI DICETAK</span>
                          <span className="text-indigo-600 leading-normal font-mono block">{targetAbsensi.length} Baris Data</span>
                        </div>
                      </div>

                      {/* Table detail list */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                        <table className="w-full text-left border-collapse text-[10px] font-semibold">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                              <th className="px-4 py-2">NIA</th>
                              <th className="px-4 py-2">Nama Lengkap</th>
                              <th className="px-4 py-2">Kelas</th>
                              <th className="px-4 py-2">Tanggal</th>
                              <th className="px-3 py-2">Waktu</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-4 py-2">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {targetAbsensi.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 select-none">
                                  Belum ada entri catatan kehadiran sesuai filter yang dipilih.
                                </td>
                              </tr>
                            ) : (
                              targetAbsensi.map((a, idx) => {
                                const statusValue = getAbsensiStatus(a.keterangan);
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2 font-mono font-bold text-slate-800">{a.nia}</td>
                                    <td className="px-4 py-2 uppercase font-black">{a.namaLengkap}</td>
                                    <td className="px-4 py-2">{a.kelas || '-'}</td>
                                    <td className="px-4 py-2">{formatDateString(a.tanggalAbsen)}</td>
                                    <td className="px-3 py-2 font-mono">{a.waktuAbsen || '-'}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] ${
                                        statusValue === 'Hadir' ? 'text-emerald-600 bg-emerald-50' :
                                        statusValue === 'Izin' ? 'text-amber-600 bg-amber-50' :
                                        statusValue === 'Sakit' ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'
                                      }`}>
                                        {statusValue}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-500 italic font-medium">{a.keterangan || '-'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Signature Lines */}
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-800 mt-10">
                        <div className="w-40 text-center leading-relaxed">
                          <p className="opacity-0">Placeholder</p>
                          <p className="pb-16">Petugas Administrasi,</p>
                          <p className="underline uppercase font-extrabold">{userNama || "ADMIN SAPTA"}</p>
                          <p className="text-[8px] text-slate-400">NIP / Jabatan Terverifikasi</p>
                        </div>
                        <div className="w-40 text-center leading-relaxed">
                          <p>Mengetahui,</p>
                          <p className="pb-16">Pembimbing / Pembina,</p>
                          <p className="underline uppercase font-extrabold">______________________</p>
                          <p className="text-[8px] text-slate-400">Lembaga {lembagaLogin || "Sapta"}</p>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* SECTION 3: LAPORAN PELANGGARAN ANGGOTA */}
              {cetakActiveSubTab === 'pelanggaran' && (() => {
                const targetPelanggaran = pelanggaranList.filter(item => {
                  const matchNia = cetakSelectedNia === 'Semua' || !cetakSelectedNia || String(item.nia) === String(cetakSelectedNia);
                  return matchNia;
                });

                // Calculate cumulative penalty fines
                const totalDenda = targetPelanggaran.reduce((acc, p) => acc + (Number(p.nominalDenda) || 0), 0);
                const unpaidFine = targetPelanggaran.filter(p => !p.statusTindakLanjut || p.statusTindakLanjut.toLowerCase().includes('belum')).reduce((acc, p) => acc + (Number(p.nominalDenda) || 0), 0);

                return (
                  <div className="space-y-6">
                    {/* Controls Row and Action */}
                    <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-3 gap-4 items-end print-exclude shadow-sm">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Pilih Anggota</label>
                        <select
                          value={cetakSelectedNia}
                          onChange={(e) => setCetakSelectedNia(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg outline-none cursor-pointer"
                        >
                          <option value="Semua">-- Semua Anggota --</option>
                          {anggotaList.map((a) => (
                            <option key={a.nia} value={a.nia}>
                              {a.namaLengkap} ({a.nia})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 text-right">
                        <button
                          onClick={() => executeDevicePrint('area-laporan-pelanggaran')}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer max-w-max ml-auto shadow-md hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Cetak Laporan Ketertiban</span>
                        </button>
                      </div>
                    </div>

                    {/* Report Sheet Layout */}
                    <div
                      id="area-laporan-pelanggaran"
                      className={`bg-white rounded-2xl border border-slate-200 p-8 max-w-4xl mx-auto shadow-sm ${
                        printElementId === 'area-laporan-pelanggaran' ? 'print-now text-black' : 'text-slate-800'
                      }`}
                    >
                      {/* Letterhead */}
                      <div className="border-b-4 border-double border-slate-900 pb-2.5 mb-6 text-center">
                        <h2 className="text-xl font-extrabold tracking-wide uppercase text-slate-900">
                          {lembagaLogin || "SEKRETARIAT UTAMA LEMBAGA SAPTA INDONESIA"}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold tracking-wider pt-0.5">
                          Seksi Ketertiban & Regulasi Konselong Disiplin • Email: {gmailLogin || 'info@sapta-portal.id'}
                        </p>
                      </div>

                      <div className="text-center space-y-1 mb-6 leading-relaxed">
                        <h3 className="text-sm font-bold tracking-wider text-slate-950 uppercase underline">
                          SURAT LAPORAN DISIPLIN & SANKSI PELANGGARAN ANGGOTA
                        </h3>
                        <p className="text-[9px] text-slate-500 tracking-wider">
                          Nomor Transkrip: DISIP-{new Date().getFullYear()}-{Math.floor(1000 + Math.random() * 9000)}
                        </p>
                      </div>

                      {/* Header detail grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 border rounded-xl p-4 mb-6 text-[10px] font-bold text-slate-600 text-left">
                        <div>
                          <span className="block text-slate-400 font-normal">NAMA ANGGOTA SASARAN</span>
                          <span className="text-slate-800 uppercase block leading-normal font-extrabold">
                            {cetakSelectedNia === 'Semua' || !cetakSelectedNia ? 'Semua Terdaftar' : anggotaList.find(a=>String(a.nia)===String(cetakSelectedNia))?.namaLengkap || 'Anggota Mandiri'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-400 font-normal">NOMOR INDUK ANGGOTA</span>
                          <span className="text-slate-800 block leading-normal font-mono">{cetakSelectedNia === 'Semua' ? 'MULTI NIA' : cetakSelectedNia}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400 font-normal">TOTAL AKUMULASI DENDA</span>
                          <span className="text-rose-600 block leading-normal text-xs font-black">{formatRupiah(totalDenda)}</span>
                        </div>
                      </div>

                      {/* Fine information bar */}
                      {totalDenda > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-[10px] font-bold text-rose-800 mb-6 leading-relaxed text-left">
                          ⚠️ PERHATIAN: Masih terdapat total tagihan denda tindak lanjut sejumlah <span className="text-rose-700 font-black underline">{formatRupiah(unpaidFine)}</span> yang belum dibayarkan secara penuh ke bendahara ketertiban lembaga.
                        </div>
                      )}

                      {/* Violation detail table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                        <table className="w-full text-left border-collapse text-[10px] font-semibold">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                              <th className="px-4 py-2 w-20">ID Laporan</th>
                              <th className="px-4 py-2 w-28">Tanggal</th>
                              <th className="px-4 py-2">Nama Pelanggaran</th>
                              <th className="px-3 py-2 w-16">Tingkat</th>
                              <th className="px-4 py-2 w-20">Denda</th>
                              <th className="px-4 py-2">Hukuman / Sanksi</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                            {targetPelanggaran.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 select-none">
                                  Sempurna! Tidak ada catatan pelanggaran disiplin terdeteksi untuk filter saat ini.
                                </td>
                              </tr>
                            ) : (
                              targetPelanggaran.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-2 font-mono text-slate-600">{p.idPelanggaran || idx + 1}</td>
                                  <td className="px-4 py-2">{formatDateString(p.tanggal)}</td>
                                  <td className="px-4 py-2 font-bold text-slate-900 uppercase text-left">
                                    {p.namaPelanggaran}
                                    <span className="block text-[8px] font-medium text-slate-400 leading-normal lowercase italic">{p.keterangan || ''}</span>
                                  </td>
                                  <td className="px-3 py-2 font-bold">{p.jenisPelanggaran || 'Sedang'}</td>
                                  <td className="px-4 py-2 font-mono text-rose-600 font-bold">{formatRupiah(Number(p.nominalDenda) || 0)}</td>
                                  <td className="px-4 py-2 text-slate-500">{p.jenisHukuman || 'Peringatan keras'}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                      (p.statusTindakLanjut || '').toLowerCase().includes('sudah') || (p.statusTindakLanjut || '').toLowerCase().includes('selesai')
                                        ? 'text-emerald-600 bg-emerald-50'
                                        : 'text-rose-600 bg-rose-50'
                                    }`}>
                                      {p.statusTindakLanjut || 'Belum Selesai'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Regulatory guidelines foot */}
                      <div className="text-[8px] text-slate-400 leading-normal space-y-1 mb-8 pr-4 text-left">
                        <p>* Segala bentuk pelanggaran disiplin dicatat berdasarkan AD/ART tata tertib hukum lembaga Sapta.</p>
                        <p>* Hubungi komisi konseling kedisiplinan dan koordinasi wali murid jika pelanggaran berstatus denda atau tindak lanjut akumulatif tinggi.</p>
                      </div>

                      {/* Signatures */}
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-800 mt-10">
                        <div className="w-40 text-center leading-relaxed">
                          <p>Mengetahui,</p>
                          <p className="pb-16">Orang Tua / Wali Anggota,</p>
                          <p className="underline uppercase font-extrabold">______________________</p>
                        </div>
                        <div className="w-40 text-center leading-relaxed">
                          <p>Lembaga Koordinator,</p>
                          <p className="pb-16">Kepala Bidang Konseling,</p>
                          <p className="underline uppercase font-extrabold">______________________</p>
                          <p className="text-[8px] text-slate-400">Komisi Disiplin Sapta</p>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

            </div>
          )}

        </div>
      </main>

      {/* ========================================================== */}
      {/* ===================== FLOATING TOASTS ==================== */}
      {/* ========================================================== */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full">
        {toastList.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-xl flex items-start space-x-3 border animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-900 border-emerald-800 text-emerald-100'
                : toast.type === 'error'
                  ? 'bg-rose-950 border-rose-900 text-rose-100'
                  : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />}
            
            <div className="flex-1 text-xs font-semibold">
              {toast.message}
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* ========================================================== */}
      {/* ================= UNIVERSAL FORM DATA MODAL ============== */}
      {/* ========================================================== */}
      {isModalOpen && (
        <div className={`fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs ${theme === 'dark' ? 'dark-theme-main' : ''}`}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between border border-[#e2e8f0] animate-scale-up">
            
            {/* Modal Header */}
            <header className="px-6 py-5 border-b border-[#f1f5f9] flex items-center justify-between bg-white rounded-t-2xl shrink-0">
              <h3 className="font-extrabold text-[#0f172a] font-sans text-base tracking-tight">
                {modalConfigs[modalTargetTab].title}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Modal Form Submission container */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modalConfigs[modalTargetTab].fields.map((field) => {
                  
                  // Check if field isDisabled in Edit state
                  const isFieldDisabled = field.disabled || false;

                  if (modalTargetTab === 'pembayaran' && modalType === 'add' && ['namaTagihan', 'nominal', 'keterangan'].includes(field.name)) {
                    return null;
                  }

                  return (
                    <div 
                      key={field.name} 
                      className={`space-y-1.5 ${
                        field.type === 'textarea' || 
                        field.name === 'linkProfile' || 
                        field.name === 'linkFoto' || 
                        field.name === 'alamat' ||
                        (field.type === 'dropdown-search' && modalType === 'add' && ['pembayaran', 'prestasi', 'pelanggaran', 'surat'].includes(modalTargetTab))
                          ? 'md:col-span-2' 
                          : ''
                      }`}
                    >
                      {!(field.type === 'dropdown-search' && modalType === 'add' && ['pembayaran', 'prestasi', 'pelanggaran', 'surat'].includes(modalTargetTab)) && (
                        <label className="text-xs font-semibold text-[#334155] flex items-center uppercase tracking-wide">
                          {field.label}
                          {field.required && <span className="text-[#e11d48] ml-1">•</span>}
                        </label>
                      )}

                      {/* FIELD TYPE: DROP-DOWN SEARCH (Special Custom Selection) */}
                      {field.type === 'dropdown-search' ? (
                        modalType === 'add' && ['pembayaran', 'prestasi', 'pelanggaran', 'surat'].includes(modalTargetTab) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Filter Kelas */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-[#475569] flex items-center uppercase tracking-wide">
                                Filter Kelas
                              </label>
                              <select
                                value={modalSelectedKelas}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setModalSelectedKelas(val);
                                  // Reset selected member so they don't have mismatch
                                  setFormValues(prev => ({ ...prev, nia: '' }));
                                  setMemberSearchQuery('');
                                }}
                                className="w-full px-4 py-2.5 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans cursor-pointer h-[42px]"
                              >
                                <option value="Semua">Semua Kelas</option>
                                {uniqueClassesAnggota.map((cls) => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </div>

                            {/* Pilih Nama (Searchable Dropdown) */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-[#475569] flex items-center uppercase tracking-wide">
                                {field.label}
                                {field.required && <span className="text-[#e11d48] ml-1">•</span>}
                              </label>
                              <div className="relative" ref={dropdownRef}>
                                <div 
                                  onClick={() => !isFieldDisabled && setIsDropdownSearchOpen(true)}
                                  className={`w-full px-3 py-2.5 text-xs border rounded-xl flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500/15 h-[42px] ${
                                    isFieldDisabled 
                                      ? 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0] cursor-not-allowed' 
                                      : 'bg-white border-[#cbd5e1] text-[#0f172a] hover:border-slate-350'
                                  }`}
                                >
                                  <span className="truncate font-medium">
                                    {formValues.nia === 'ALL_MEMBERS' 
                                      ? '-- Pilih Semua (Kas Transaksi Massal) --' 
                                      : memberSearchQuery || 'Cari & pilih Anggota...'}
                                  </span>
                                  <ChevronDown className="w-4 h-4 text-[#64748b] shrink-0" />
                                </div>

                                {isDropdownSearchOpen && (
                                  <div className="absolute left-0 right-0 mt-1 bg-white border border-[#cbd5e1] rounded-xl shadow-xl z-50 p-2 space-y-2 max-h-56 overflow-y-auto">
                                    <input
                                      type="text"
                                      placeholder="Ketik nama atau NIA..."
                                      value={memberSearchQuery}
                                      onChange={(e) => {
                                        setMemberSearchQuery(e.target.value);
                                        // Update state in case user deletes selection
                                        if (!e.target.value) {
                                          setFormValues(prev => ({ ...prev, nia: '' }));
                                        }
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs rounded border border-[#cbd5e1] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      autoFocus
                                    />

                                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto w-full">
                                      
                                      {/* Option Special "-- Pilih Semua --" (Pembayaran only) */}
                                      {modalTargetTab === 'pembayaran' && (
                                        <div
                                          onClick={() => {
                                            setFormValues(prev => ({ ...prev, nia: 'ALL_MEMBERS' }));
                                            setMemberSearchQuery('-- Pilih Semua (Bulk Insert ke Semua Anggota) --');
                                            setIsDropdownSearchOpen(false);
                                          }}
                                          className="px-3 py-2 text-xs font-bold text-[#6366f1] hover:bg-[#f8fafc] cursor-pointer"
                                        >
                                          -- Pilih Semua (Kas Transaksi Massal) --
                                        </div>
                                      )}

                                      {dropdownFilteredMembers.length === 0 ? (
                                        <div className="px-3 py-2.5 text-center text-[11px] text-[#94a3b8]">
                                          Anggota tidak ditemukan.
                                        </div>
                                      ) : (
                                        dropdownFilteredMembers.map((member) => (
                                          <div
                                            key={member.nia}
                                            onClick={() => {
                                              setFormValues(prev => ({ ...prev, nia: member.nia }));
                                              setMemberSearchQuery(`${member.nia} | ${member.namaLengkap}`);
                                              setIsDropdownSearchOpen(false);
                                            }}
                                            className="px-3 py-2 hover:bg-[#eff6ff] cursor-pointer flex items-center justify-between text-xs"
                                          >
                                            <div className="text-left">
                                              <span className="font-bold text-[#0f172a]">{member.namaLengkap}</span>
                                              <p className="text-[10px] text-[#64748b] font-mono mt-0.5">
                                                NIA: {member.nia} • Kelas: {member.kelas || '-'}
                                              </p>
                                            </div>
                                            <span className="text-[10px] bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded font-mono font-bold shrink-0">{member.jenjangPendidikan}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Standard searchable dropdown for other tabs / edit mode
                          <div className="relative" ref={dropdownRef}>
                            <div 
                              onClick={() => !isFieldDisabled && setIsDropdownSearchOpen(true)}
                              className={`w-full px-3 py-2.5 text-xs border rounded-xl flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500/15 h-[42px] ${
                                isFieldDisabled 
                                  ? 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0] cursor-not-allowed' 
                                  : 'bg-white border-[#cbd5e1] text-[#0f172a] hover:border-slate-350'
                              }`}
                            >
                              <span className="truncate font-medium">
                                {formValues.nia === 'ALL_MEMBERS' 
                                  ? '-- Pilih Semua (Kas Transaksi Massal) --' 
                                  : memberSearchQuery || 'Cari & pilih Anggota lewat NIK/Nama...'}
                              </span>
                              <ChevronDown className="w-4 h-4 text-[#64748b] shrink-0" />
                            </div>

                            {isDropdownSearchOpen && (
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-[#cbd5e1] rounded-xl shadow-xl z-50 p-2 space-y-2 max-h-56 overflow-y-auto">
                                <input
                                  type="text"
                                  placeholder="Ketik NIA atau Nama lengkap..."
                                  value={memberSearchQuery}
                                  onChange={(e) => {
                                    setMemberSearchQuery(e.target.value);
                                    // Update state in case user deletes selection
                                    if (!e.target.value) {
                                      setFormValues(prev => ({ ...prev, nia: '' }));
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs rounded border border-[#cbd5e1] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  autoFocus
                                />

                                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto w-full">
                                  
                                  {/* Option Special "-- Pilih Semua --" (Pembayaran only) */}
                                  {modalTargetTab === 'pembayaran' && (
                                    <div
                                      onClick={() => {
                                        setFormValues(prev => ({ ...prev, nia: 'ALL_MEMBERS' }));
                                        setMemberSearchQuery('-- Pilih Semua (Bulk Insert ke Semua Anggota) --');
                                        setIsDropdownSearchOpen(false);
                                      }}
                                      className="px-3 py-2 text-xs font-bold text-[#6366f1] hover:bg-[#f8fafc] cursor-pointer"
                                    >
                                      -- Pilih Semua (Kas Transaksi Massal) --
                                    </div>
                                  )}

                                  {dropdownFilteredMembers.length === 0 ? (
                                    <div className="px-3 py-2.5 text-center text-[11px] text-[#94a3b8]">
                                      Anggota tidak ditemukan.
                                    </div>
                                  ) : (
                                    dropdownFilteredMembers.map((member) => (
                                      <div
                                        key={member.nia}
                                        onClick={() => {
                                          setFormValues(prev => ({ ...prev, nia: member.nia }));
                                          setMemberSearchQuery(`${member.nia} | ${member.namaLengkap}`);
                                          setIsDropdownSearchOpen(false);
                                        }}
                                        className="px-3 py-2 hover:bg-[#eff6ff] cursor-pointer flex items-center justify-between text-xs"
                                      >
                                        <div className="text-left">
                                          <span className="font-bold text-[#0f172a]">{member.namaLengkap}</span>
                                          <p className="text-[10px] text-[#64748b] font-mono mt-0.5">NIA: {member.nia} • Kelas: {member.kelas || '-'} • {member.namaSekolah || 'Umum'}</p>
                                        </div>
                                        <span className="text-[10px] bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded font-mono font-bold shrink-0">{member.jenjangPendidikan}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          disabled={isFieldDisabled}
                          value={formValues[field.name] || ''}
                          onChange={(e) => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                          className={`w-full px-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${
                            isFieldDisabled 
                              ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] cursor-not-allowed' 
                              : 'bg-white border-[#cbd5e1] text-[#0f172a] focus:bg-white'
                          }`}
                        >
                          <option value="">-- Silakan Pilih --</option>
                          {field.options && field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          placeholder={field.placeholder}
                          required={field.required}
                          disabled={isFieldDisabled}
                          value={formValues[field.name] || ''}
                          rows={3}
                          onChange={(e) => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                          className={`w-full px-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${
                            isFieldDisabled
                              ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] cursor-not-allowed'
                              : 'bg-white border-[#cbd5e1] text-[#0f172a] focus:bg-white'
                          }`}
                        />
                      ) : (
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          required={field.required}
                          disabled={isFieldDisabled}
                          value={formValues[field.name] || ''}
                          onChange={(e) => {
                            const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
                            setFormValues(prev => ({ ...prev, [field.name]: val }));
                          }}
                          className={`w-full px-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${
                            isFieldDisabled
                              ? 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b] cursor-not-allowed font-mono'
                              : 'bg-white border-[#cbd5e1] text-[#0f172a] focus:bg-white'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Integration for multiple item payment entry */}
              {modalTargetTab === 'pembayaran' && modalType === 'add' && (
                <div className="space-y-4 pt-4 border-t border-dashed border-slate-200">
                  <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <div className="text-left">
                      <h5 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                        <span>💰 RINCIAN ITEM PEMBAYARAN</span>
                      </h5>
                      <p className="text-[10px] text-indigo-500 font-medium mt-0.5 leading-snug">
                        Isi baris pembayaran ke-1, maka otomatis baris pembayaran berikutnya akan terbuka.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentItems(prev => [...prev, { namaTagihan: '', nominal: 0, keterangan: '' }])}
                      className="px-2.5 py-1.5 text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                    >
                      + Baris Baru
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {paymentItems.map((item, index) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-xl border border-[#cbd5e1]/60 space-y-3 relative group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] bg-slate-200/85 text-slate-700 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide animate-pulse">
                            Pembayaran {index + 1}
                          </span>
                          {paymentItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentItems(prev => prev.filter((_, idx) => idx !== index));
                              }}
                              className="text-rose-600 hover:text-rose-800 text-xs font-bold font-sans transition"
                            >
                              Hapus
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                            {/* Nama Tagihan */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Nama Tagihan / Keperluan *</label>
                              <input
                                type="text"
                                required={index === 0}
                                placeholder="Contoh: SPP Bulanan, Seragam, dsb."
                                value={item.namaTagihan}
                                onChange={(e) => handleUpdatePaymentItem(index, 'namaTagihan', e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans"
                              />
                            </div>

                            {/* Nominal */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Nominal (Rupiah) *</label>
                              <input
                                type="number"
                                required={index === 0}
                                placeholder="Masukkan nominal, contoh: 150000"
                                value={item.nominal || ''}
                                onChange={(e) => handleUpdatePaymentItem(index, 'nominal', e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans"
                              />
                            </div>

                            {/* Keterangan */}
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Keterangan Tambahan / Detail Catatan</label>
                              <input
                                type="text"
                                placeholder="Keterangan opsional seperti cicilan, nama bulan, dsb."
                                value={item.keterangan}
                                onChange={(e) => handleUpdatePaymentItem(index, 'keterangan', e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-sans"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Action buttons with Double Click Shielding constraint */}
              <footer className="pt-5 border-t border-[#f1f5f9] flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-xs font-semibold tracking-wide transition disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold tracking-wide shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center disabled:bg-slate-400 disabled:cursor-not-allowed cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Data'
                  )}
                </button>
              </footer>

            </form>

          </div>
        </div>
      )}


      {/* ========================================================== */}
      {/* =========== DETAIL PROFIL & LEDGER CARD MODAL ============ */}
      {/* ========================================================== */}
      {selectedProfile && (
        <div className={`fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto ${theme === 'dark' ? 'dark-theme-main' : ''}`}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl border border-[#e2e8f0] animate-scale-up flex flex-col justify-between">
            
            {/* Header profile Detail */}
            <header className="px-6 py-5 border-b border-[#f1f5f9] flex items-center justify-between bg-white rounded-t-2xl shrink-0">
              <h3 className="font-bold text-[#0f172a] font-sans text-sm flex items-center uppercase font-mono tracking-wider">
                <Users className="w-4 h-4 mr-2 text-[#6366f1]" /> Detail Profil & Rekam Ledger Anggota
              </h3>
              <button
                onClick={() => setSelectedProfile(null)}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Profile Detail Content Grid */}
            <div className="p-6 md:p-8 space-y-8">
              
              {/* Profile Card Header row */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 border-b border-[#f1f5f9] pb-6 shrink-0">
                
                {/* Photo profiling render */}
                <div className="w-32 h-32 rounded-2xl overflow-hidden border border-[#e2e8f0] shadow-xs shrink-0 bg-[#f8fafc] flex items-center justify-center font-bold text-[#64748b] text-2xl relative group">
                  <MemberAvatar 
                    linkProfile={selectedProfile.linkProfile} 
                    namaLengkap={selectedProfile.namaLengkap} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1.5 justify-center md:justify-start">
                      <h4 className="text-xl font-extrabold text-[#0f172a] tracking-tight">{selectedProfile.namaLengkap}</h4>
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-block self-center max-w-max uppercase ${
                        selectedProfile.status === 'Aktif' 
                          ? 'bg-[#ecfdf5] text-[#059669]' 
                          : 'bg-[#f1f5f9] text-[#64748b]'
                      }`}>
                        {selectedProfile.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-semibold text-[#6366f1]">NIA: {selectedProfile.nia} • PIN: {selectedProfile.key || '-'}</p>
                  </div>

                  {/* Contact Badge Pills */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-[#475569]">
                    <span className="flex items-center">
                      <Smartphone className="w-3.5 h-3.5 mr-1.5 text-[#94a3b8]" />
                      {selectedProfile.noHp || '-'}
                    </span>
                    <span className="flex items-center">
                      <Mail className="w-3.5 h-3.5 mr-1.5 text-[#94a3b8]" />
                      {selectedProfile.email || '-'}
                    </span>
                    <span className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#94a3b8]" />
                      {selectedProfile.alamat || 'Alamat kosong'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profil Information Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Keanggotaan Detail */}
                <div className="space-y-4">
                  <h4 className="text-xs font-mono font-bold text-[#64748b] uppercase tracking-widest border-b border-[#f1f5f9] pb-1.5">Data Diri & Identitas</h4>
                  <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                    <div>
                      <span className="text-[#94a3b8] font-medium block">Tempat Lahir</span>
                      <p className="font-bold text-[#334155] mt-0.5">{selectedProfile.tempatLahir}</p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8] font-medium block">Tanggal Lahir</span>
                      <p className="font-bold text-[#334155] mt-0.5">{formatDateString(selectedProfile.tanggalLahir)}</p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8] font-medium block">Jenis Kelamin</span>
                      <p className="font-bold text-[#334155] mt-0.5">{selectedProfile.jenisKelamin}</p>
                    </div>
                  </div>
                </div>

                {/* Pendidikan Detail */}
                <div className="space-y-4">
                  <h4 className="text-xs font-mono font-bold text-[#64748b] uppercase tracking-widest border-b border-[#f1f5f9] pb-1.5 font-sans">Rincian Akademis</h4>
                  <div className="grid grid-cols-2 gap-y-3.5 text-xs">
                    <div>
                      <span className="text-[#94a3b8] font-medium block">Jenjang Sekolah</span>
                      <p className="font-bold text-[#334155] mt-0.5">{selectedProfile.jenjangPendidikan}</p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8] font-medium block">Institusi Sekolah</span>
                      <p className="font-bold text-[#334155] mt-0.5 flex items-center">
                        <School className="w-3.5 h-3.5 mr-1 text-[#6366f1] shrink-0" />
                        {selectedProfile.namaSekolah || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#94a3b8] font-medium block">Kelas / Tingkat</span>
                      <p className="font-bold text-[#334155] mt-0.5">{selectedProfile.kelas || '-'}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* INTEGRATED HISTORIC LEDGER TABLES CARD */}
              <div className="space-y-6 pt-4 border-t border-[#f1f5f9]">
                <h4 className="text-xs font-mono font-bold text-[#64748b] uppercase tracking-wider">Histori Jurnal & Ledger Anggota</h4>

                {/* Tab layout inside profile ledger card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                  
                  {/* Ledger 1: Pembayaran */}
                  <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0] space-y-3 flex flex-col justify-between">
                    <h5 className="font-bold text-[#334155] flex items-center justify-between border-b border-[#f1f5f9] pb-1.5 uppercase font-mono tracking-wide text-[10px]">
                      <span>Kas Pembayaran</span>
                      <span className="text-[10px] bg-[#e2e8f0] px-2 py-0.5 rounded-full font-mono">{currentProfileLogs.payments.length} trx</span>
                    </h5>
                    
                    <div className="space-y-2 flex-1 max-h-36 overflow-y-auto">
                      {currentProfileLogs.payments.length === 0 ? (
                        <p className="text-[11px] text-[#94a3b8] italic">Belum pernah melakukan transaksi.</p>
                      ) : (
                        currentProfileLogs.payments.map((p, idx) => (
                          <div key={p.idTransaksi || idx} className="p-2 bg-white rounded border border-[#e2e8f0] flex justify-between items-center text-[11px]">
                            <div>
                              <span className="font-bold text-[#334155] block truncate max-w-[135px]">{p.namaTagihan}</span>
                              <span className="text-[9px] text-[#94a3b8] font-mono block mt-0.5">{p.tanggal}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold block text-[#334155]">{formatRupiah(p.nominal)}</span>
                              <span className={`text-[8px] font-bold uppercase ${p.status === 'Lunas' ? 'text-[#059669]' : 'text-[#b45309]'}`}>{p.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Ledger 2: Prestasi */}
                  <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0] space-y-3 flex flex-col justify-between font-sans">
                    <h5 className="font-bold text-[#334155] flex items-center justify-between border-b border-[#f1f5f9] pb-1.5 uppercase font-mono tracking-wide text-[10px]">
                      <span>Jurnal Prestasi</span>
                      <span className="text-[10px] bg-[#e2e8f0] px-2 py-0.5 rounded-full font-mono">{currentProfileLogs.awards.length} item</span>
                    </h5>

                    <div className="space-y-2 flex-1 max-h-36 overflow-y-auto">
                      {currentProfileLogs.awards.length === 0 ? (
                        <p className="text-[11px] text-[#94a3b8] italic">Belum ada torehan piagam prestasi.</p>
                      ) : (
                        currentProfileLogs.awards.map((a, idx) => (
                          <div key={a.idPrestasi || idx} className="p-2 bg-white rounded border border-[#e2e8f0] space-y-1 text-[11px]">
                            <div className="flex justify-between items-center bg-[#f8fafc] p-1 rounded">
                              <span className="font-bold text-[#334155] font-mono text-[9px]">{a.jenisPrestasi}</span>
                              <span className="text-[9px] text-[#94a3b8] font-mono">{a.tanggal}</span>
                            </div>
                            <p className="text-[10px] leading-tight text-[#475569] italic">"{a.deskripsi}"</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Ledger 3: Pelanggaran */}
                  <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0] space-y-3 flex flex-col justify-between font-sans">
                    <h5 className="font-bold text-[#334155] flex items-center justify-between border-b border-[#f1f5f9] pb-1.5 uppercase font-mono tracking-wide text-[10px]">
                      <span>Log Pelanggaran</span>
                      <span className="text-[10px] bg-[#e2e8f0] px-2 py-0.5 rounded-full font-mono">{currentProfileLogs.violations.length} kasus</span>
                    </h5>

                    <div className="space-y-2 flex-1 max-h-36 overflow-y-auto">
                      {currentProfileLogs.violations.length === 0 ? (
                        <p className="text-[11px] text-[#059669] font-semibold flex items-center">
                          <Check className="w-3.5 h-3.5 mr-1" /> Anggota sangat disiplin!
                        </p>
                      ) : (
                        currentProfileLogs.violations.map((v, idx) => (
                          <div key={v.idPelanggaran || idx} className="p-2 bg-white rounded border border-[#e2e8f0] space-y-1 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#b91c1c] font-mono text-[9px]">{v.jenisPelanggaran.toUpperCase()}</span>
                              <span className="text-[9px] text-[#94a3b8] font-mono">{v.tanggal}</span>
                            </div>
                            <span className="font-semibold text-[#334155] block truncate">{v.namaPelanggaran}</span>
                            <span className="text-[10px] text-[#64748b] block max-h-12 overflow-hidden truncate">Sanksi: {v.jenisHukuman}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Modal Profile Footer */}
            <header className="px-6 py-4 border-t border-[#f1f5f9] flex items-center justify-between bg-white rounded-b-2xl shrink-0">
              <button
                onClick={() => {
                  const toDelete = selectedProfile;
                  setSelectedProfile(null);
                  handleDeleteRow('anggota', toDelete);
                }}
                className="px-4 py-2 bg-[#fef2f2] hover:bg-[#fee2e2] text-[#b91c1c] rounded-lg text-xs font-bold border border-[#fca5a5] transition cursor-pointer flex items-center"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Hapus Anggota Ini
              </button>
              <button
                onClick={() => setSelectedProfile(null)}
                className="px-5 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer"
              >
                Tutup Detail
              </button>
            </header>

          </div>
        </div>
      )}

      {/* ======================= MODAL: CUSTOM DELETE CONFIRMATION ======================= */}
      {deleteConfirmTarget && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-fade-in ${theme === 'dark' ? 'dark-theme-main' : ''}`}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-[#e2e8f0] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center text-[#ef4444] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#0f172a] text-sm">Konfirmasi Hapus Data</h3>
                <p className="text-xs text-[#64748b]">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              Apakah Anda yakin ingin menghapus data ini secara permanen? Perintah penghapusan juga akan dikirimkan untuk diselaraskan ke database pusat Anda.
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] pt-4 mt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  executeDeleteRow(deleteConfirmTarget.tab, deleteConfirmTarget.row);
                }}
                className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: CUSTOM SHEETS CLEANUP CONFIRMATION ======================= */}
      {cleanConfirmOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-fade-in ${theme === 'dark' ? 'dark-theme-main' : ''}`}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-[#e2e8f0] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fffbeb] flex items-center justify-center text-[#d97706] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#d97706] text-sm">Bersihkan Anggota Non-Aktif</h3>
                <p className="text-xs text-[#64748b]">Pemutakhiran & Pembersihan Lokal</p>
              </div>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              Sistem akan mencocokkan data lokal Anda dengan data keanggotaan aktif dari akun pusat. Seluruh data anggota lokal yang tidak terdaftar di server utama akan dihapus secara permanen. Apakah Anda yakin ingin melanjutkan tindakan ini?
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] pt-4 mt-1">
              <button
                type="button"
                onClick={() => setCleanConfirmOpen(false)}
                className="px-4 py-2 bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  executeDeleteUnregisteredMembers();
                }}
                className="px-4 py-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Ya, Bersihkan & Perbarui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: CUSTOM DELETE ALL CONFIRMATION ======================= */}
      {deleteAllConfirmOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-fade-in ${theme === 'dark' ? 'dark-theme-main' : ''}`}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-[#e2e8f0] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center text-[#ef4444] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#b91c1c] text-sm">Hapus Semua Anggota</h3>
                <p className="text-xs text-[#64748b]">Tindakan ini menghapus data anggota lokal secara permanen</p>
              </div>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              Apakah Anda yakin ingin menghapus seluruh data anggota di dalam database lokal? Tindakan ini akan mengosongkan semua data anggota yang saat ini tersimpan di browser Anda agar Anda dapat memuat ulang seluruh berkas secara bersih dari server utama.
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] pt-4 mt-1">
              <button
                type="button"
                onClick={() => setDeleteAllConfirmOpen(false)}
                className="px-4 py-2 bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteAllAnggota}
                className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: STRUK PEMBAYARAN RESMI (RECEIPT) ======================= */}
      {isReceiptModalOpen && receiptData && (() => {
        // Collect all paid transactions for the same member on the same calendar day
        const matchedPayments = pembayaranList.filter(p => {
          if (p.status !== 'Lunas') return false;
          if (!p.tanggal || !receiptData.tanggal) return false;
          if (!isSameDay(p.tanggal, receiptData.tanggal)) return false;
          
          if (receiptData.nia && receiptData.nia !== 'ALL_MEMBERS') {
            return p.nia === receiptData.nia;
          }
          return p.namaLengkap && receiptData.namaLengkap && p.namaLengkap.toLowerCase() === receiptData.namaLengkap.toLowerCase();
        });

        // Use gathered payments; fallback to receiptData if empty or not found in state
        const finalPaymentsForReceipt = matchedPayments.length > 0 ? matchedPayments : [receiptData];
        
        // Dynamic aggregations
        const totalOriginalNominal = finalPaymentsForReceipt.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const discountAmount = (totalOriginalNominal * receiptDiscountPercent) / 100;
        const taxableTotal = totalOriginalNominal - discountAmount;
        const ppnAmount = (taxableTotal * receiptPpnPercent) / 100;
        const grandTotal = Math.ceil(taxableTotal + ppnAmount);
        
        const actualTunai = receiptCashPaid > 0 ? receiptCashPaid : grandTotal;
        const kembalian = Math.max(0, actualTunai - grandTotal);

        return (
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-fade-in ${theme === 'dark' ? 'dark-theme-main' : ''} ${printElementId === 'area-struk-pembayaran' ? 'print:bg-transparent print:p-0 print:backdrop-blur-none print:shadow-none' : ''}`}>
            <div className={`bg-slate-100 rounded-2xl w-full max-w-sm p-4 border border-[#e2e8f0] shadow-2xl flex flex-col gap-4 max-h-[95vh] overflow-y-auto ${printElementId === 'area-struk-pembayaran' ? 'print:bg-transparent print:border-none print:shadow-none print:p-0 print:max-h-none print:w-auto print:gap-0' : ''}`}>
              
              {/* Printable Receipt Area */}
              <div
                id="area-struk-pembayaran"
                className={`bg-white rounded-xl border border-slate-200 p-6 shadow-sm mx-auto w-full relative ${
                  printElementId === 'area-struk-pembayaran' ? 'print-now text-black' : 'text-slate-850'
                }`}
                style={{ fontFamily: 'monospace' }}
              >
                {/* Receipt Serrated Border Decor at Top */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-repeat-x overflow-hidden rounded-t-xl" 
                  style={{
                    backgroundImage: `linear-gradient(-45deg, transparent 4px, white 4px), linear-gradient(45deg, transparent 4px, white 4px)`,
                    backgroundSize: '8px 8px',
                    transform: 'translateY(-4px)'
                  }}
                />

                {/* Letterhead / Header */}
                <div className="text-center pb-4 mb-4 border-b border-dashed border-slate-350">
                  <h4 className="text-xs font-black tracking-wide uppercase text-slate-900 leading-tight">
                    {receiptHeaderTitle || lembagaLogin || "PORTAL SEKTOR BERSAMA"}
                  </h4>
                  {receiptHeaderSub && (
                    <p className="text-[9px] text-slate-500 font-bold tracking-wider pt-0.5 uppercase">
                      {receiptHeaderSub}
                    </p>
                  )}
                  {receiptHeaderAddress && (
                    <p className="text-[8px] text-slate-400 mt-0.5 uppercase leading-snug font-serif font-black">
                      {receiptHeaderAddress}
                    </p>
                  )}
                  <p className="text-[8px] text-slate-400 mt-0.5 lowercase font-mono">
                    {receiptHeaderEmail || gmailLogin || 'info@sapta-portal.id'}
                  </p>
                </div>

                {/* Receipt Details */}
                <div className="space-y-2 text-[10.5px] leading-relaxed">
                  {receiptShowTrxDetails && (
                    <>
                      <div className="flex justify-between gap-1">
                        <span className="text-slate-400 uppercase font-bold text-[9px] shrink-0">Kode Struk</span>
                        <span className="font-extrabold text-slate-900 truncate font-mono text-[10px]">{receiptData.idTransaksi || receiptData.id || '-'}</span>
                      </div>
                      <div className="flex justify-between gap-1">
                        <span className="text-slate-400 uppercase font-bold text-[9px] shrink-0">Tanggal</span>
                        <span className="font-bold text-slate-800">{formatDateString(receiptData.tanggal)}</span>
                      </div>
                      <div className="flex justify-between gap-1">
                        <span className="text-slate-400 uppercase font-bold text-[9px] shrink-0">Admin</span>
                        <span className="font-semibold text-slate-800 font-mono text-[9px]">@{userUsername || 'admin'} (Otomatis)</span>
                      </div>
                      <div className="border-b border-dashed border-slate-200 my-1.5" />
                    </>
                  )}

                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400 uppercase font-bold text-[9px] shrink-0">Anggota</span>
                    <span className="font-black text-slate-900 uppercase text-right max-w-[180px] break-words">
                      {receiptData.namaLengkap || 'Semua Anggota'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span className="text-slate-400 uppercase font-bold text-[9px] shrink-0">NIA</span>
                    <span className="font-bold text-slate-800 font-mono">{receiptData.nia === 'ALL_MEMBERS' ? 'Semua Anggota' : receiptData.nia}</span>
                  </div>

                  {/* Rincian Item Pembayaran (Grouped) */}
                  <div className="border-t border-b border-dashed border-slate-200 py-2 my-2 space-y-1.5">
                    <div className="text-[8px] font-black text-slate-450 uppercase tracking-wider mb-1">Rincian Keperluan ({finalPaymentsForReceipt.length} Item):</div>
                    {finalPaymentsForReceipt.map((p, idx) => (
                      <div key={p.idTransaksi || idx} className="flex justify-between items-start gap-2 text-[10px] leading-snug">
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-slate-800">
                            {idx + 1}. {p.namaTagihan || 'Tanpa Kategori'}
                          </span>
                          {p.keterangan && (
                            <span className="text-[8px] text-slate-500 font-mono pl-3">
                              ({p.keterangan})
                            </span>
                          )}
                          <span className="text-[7.5px] text-slate-400 font-mono pl-3">
                            ID: {p.idTransaksi}
                          </span>
                        </div>
                        <span className="font-bold text-slate-700 font-mono text-[10.5px] shrink-0">
                          {formatRupiah(Number(p.nominal) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-dashed border-slate-355 my-2" />

                  {/* Sub-total */}
                  <div className="flex justify-between items-center text-[10.5px]">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Sub-Total</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {formatRupiah(totalOriginalNominal)}
                    </span>
                  </div>

                  {receiptDiscountPercent > 0 && (
                    <div className="flex justify-between items-center text-[10.5px] mt-1 text-rose-600 font-bold">
                      <span className="text-rose-400 font-bold uppercase text-[9px]">Diskon ({receiptDiscountPercent}%)</span>
                      <span className="font-mono">
                        -{formatRupiah(discountAmount)}
                      </span>
                    </div>
                  )}

                  {receiptPpnPercent > 0 && (
                    <div className="flex justify-between items-center text-[10.5px] mt-1 text-[#4f46e5] font-bold">
                      <span className="text-indigo-400 font-bold uppercase text-[9px]">PPN ({receiptPpnPercent}%)</span>
                      <span className="font-mono">
                        +{formatRupiah(ppnAmount)}
                      </span>
                    </div>
                  )}

                  {/* Total Section */}
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                    <span className="text-[10px] font-extrabold text-[#334155] uppercase">TOTAL</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>

                  {/* Cash Paid and Change */}
                  <div className="flex justify-between items-center text-[10.5px] mt-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Tunai</span>
                    <span className="font-bold text-slate-850 font-mono">
                      {formatRupiah(actualTunai)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10.5px] mt-1">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Kembali</span>
                    <span className="font-black text-indigo-600 font-mono">
                      {formatRupiah(kembalian)}
                    </span>
                  </div>

                  {/* Terbilang block */}
                  <div className="text-[8.5px] text-slate-500 italic mt-2 text-left leading-relaxed bg-[#f8fafc] p-2 rounded border border-slate-100 uppercase tracking-tight font-bold">
                    Terbilang: {terbilang(grandTotal)} rupiah
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-400 uppercase font-bold text-[9px]">Status</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] uppercase border border-emerald-200">
                      {receiptData.status || 'Lunas'}
                    </span>
                  </div>
                </div>

                {/* Thank you foot decoration */}
                <div className="text-center pt-5 mt-5 border-t border-dashed border-slate-300 space-y-1.5">
                  <p className="text-[9px] text-slate-400 leading-normal font-black uppercase">
                    {receiptFooterThankYou}
                  </p>
                  {receiptFooterSub && (
                    <p className="text-[7.5px] text-slate-400 font-normal lowercase italic">
                      {receiptFooterSub}
                    </p>
                  )}
                  {receiptMediaSosial && (
                    <p className="text-[8px] text-slate-400 leading-normal font-bold lowercase italic border-t border-slate-100 pt-1 font-mono">
                      {receiptMediaSosial}
                    </p>
                  )}
                </div>

                {/* Receipt Serrated Border Decor at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-repeat-x overflow-hidden rounded-b-xl" 
                  style={{
                    backgroundImage: `linear-gradient(45deg, transparent 4px, white 4px), linear-gradient(-45deg, transparent 4px, white 4px)`,
                    backgroundSize: '8px 8px',
                    transform: 'translateY(4px)'
                  }}
                />
              </div>

              {/* Tunai / Cash Payment Keyboard (print-exclude) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-left print-exclude">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">💵 PEMBAYARAN TUNAI</span>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-black font-mono">LIVE CALC</span>
                </div>
                
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 font-bold shrink-0">Rp</span>
                  <input
                    type="text"
                    placeholder="Masukkan pembayaran tunai..."
                    value={receiptCashPaid || ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setReceiptCashPaid(Number(raw) || 0);
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 bg-slate-50/50 text-slate-800"
                  />
                </div>

                {/* Quick denominator buttons */}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setReceiptCashPaid(grandTotal)}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded text-[9px] font-extrabold text-indigo-700 cursor-pointer transition select-none"
                  >
                    Pas ({formatRupiah(grandTotal)})
                  </button>
                  {[50000, 100000, 150000, 200000, 300000, 500000].map((denom) => {
                    if (denom > grandTotal) {
                      return (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => setReceiptCashPaid(denom)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-600 cursor-pointer transition select-none"
                        >
                          {formatRupiah(denom)}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Print and Close controls */}
              <div className="flex gap-2 w-full mt-1 print-exclude">
                <button
                  type="button"
                  onClick={() => executeDevicePrint('area-struk-pembayaran')}
                  className="flex-1 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <span>Cetak Struk</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setReceiptData(null);
                    setReceiptCashPaid(0);
                  }}
                  className="flex-1 py-2 bg-white border border-[#e2e8f0] text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 hover:bg-[#f8fafc] cursor-pointer shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                >
                  <X className="w-4 h-4 text-slate-500" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
