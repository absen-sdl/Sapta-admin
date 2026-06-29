export function parseCSV(csvText: string): any[] {
  const lines = [];
  let currentLine: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentValue.trim());
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentLine.push(currentValue.trim());
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  if (currentValue || currentLine.length > 0) {
    currentLine.push(currentValue.trim());
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  // Filter empty lines
  const cleanLines = lines.filter(l => l.length > 0 && l.some(cell => cell !== ''));
  if (cleanLines.length < 2) return [];

  // Remove byte order mark (BOM) if present, and replace spaces, hyphens, underscores, parentheses, brackets
  const headers = cleanLines[0].map((h: string) => h.trim().toLowerCase().replace(/^\uFEFF/g, '').replace(/[\s\-_()[\]]/g, ''));
  
  return cleanLines.slice(1).map((line) => {
    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      let keyName = header;
      if (header === 'nia' || header === 'nomorinduk' || header === 'nomorindukanggota') keyName = 'nia';
      else if (header === 'namalengkap' || header === 'nama' || header.includes('namalengkap') || header === 'namasesuaiidentitas' || header === 'fullname') keyName = 'namaLengkap';
      else if (header === 'tanggallahir' || header === 'tgl_lahir' || header === 'tgllahir' || header.includes('tanggallahir') || header.includes('tgllhr') || header.includes('tgllahir') || header.includes('birthdate') || header.includes('dob')) keyName = 'tanggalLahir';
      else if (header === 'tempatlahir' || header === 'tempat_lahir' || header === 'tmplahir' || header.includes('tempatlahir') || header.includes('tempatlhr') || header.includes('birthplace')) keyName = 'tempatLahir';
      else if (header === 'jeniskelamin' || header === 'kelamin' || header === 'jk' || header === 'gender' || header.includes('kelamin') || header.includes('gender')) keyName = 'jenisKelamin';
      else if (header === 'jenjangpendidikan' || header === 'jenjang' || header === 'pendidikan' || header.includes('jenjang') || header.includes('pendidikan') || header.includes('education')) keyName = 'jenjangPendidikan';
      else if (header === 'namasekolah' || header === 'sekolah' || header.includes('sekolah') || header.includes('institusi') || header.includes('school')) keyName = 'namaSekolah';
      else if (header === 'kelas' || header === 'class' || header.includes('kelas') || header.includes('class')) keyName = 'kelas';
      else if (header === 'alamat' || header === 'address' || header.includes('alamat') || header.includes('address')) keyName = 'alamat';
      else if (header === 'nohp' || header === 'nohandphone' || header === 'notelp' || header === 'phone' || header.includes('hp') || header.includes('wa') || header.includes('phone') || header.includes('telp') || header.includes('contact')) keyName = 'noHp';
      else if (header === 'email' || header === 'gmail' || header.includes('email') || header.includes('mail')) keyName = 'email';
      else if (header === 'urlappscript' || header === 'linkappscript' || header === 'urlappsscript' || header === 'linkappsscript' || header.includes('appscript') || header.includes('appsscript') || header.includes('server') || header.includes('script')) keyName = 'urlAppScript';
      else if (header === 'urlabsensi' || header === 'linkabsensi' || header.includes('absensi') || header.includes('rekapabsen')) keyName = 'urlAbsensi';
      else if (header === 'linkprofile' || header === 'link_profile' || header === 'lnkprofile' || header === 'foto' || header === 'photo' || header === 'avatar' || header.includes('profile') || header.includes('profil') || header.includes('photo') || header.includes('foto') || header.includes('pic') || header.includes('image') || header.includes('aksesfotoprofil') || header.includes('link')) keyName = 'linkProfile';
      else if (header === 'key' || header === 'pin' || header === 'kunci' || header === 'password' || header === 'pasword' || header === 'reference' || header === 'uniq' || header.includes('key') || header.includes('pin') || header.includes('pass')) keyName = 'key';
      else if (header === 'status' || header.includes('status')) keyName = 'status';
      else if (header === 'idabsensi' || header === 'id_absensi' || header === 'idabs' || header.includes('idabsensi')) keyName = 'idAbsensi';
      else if (header === 'jammasuk' || header === 'jam_masuk' || header === 'jamdatang' || header.includes('masuk') || header.includes('datang')) keyName = 'jamMasuk';
      else if (header === 'jampulang' || header === 'jam_pulang' || header.includes('pulang')) keyName = 'jamPulang';
      else if (header === 'keterangan' || header === 'ket' || header.includes('keterangan') || header.includes('catatan')) keyName = 'keterangan';
      else if (header === 'tanggalabsen' || header === 'tanggal_absen' || header.includes('tanggalabsen')) keyName = 'tanggalAbsen';
      else if (header === 'waktuabsen' || header === 'waktu_absen' || header.includes('waktuabsen') || header === 'jamabsen' || header === 'jam') keyName = 'waktuAbsen';
      else if (header === 'jeniskegiatan' || header === 'jenis_kegiatan' || header.includes('jeniskegiatan') || header.includes('kegiatan')) keyName = 'jenisKegiatan';
      else if (header === 'tanggal' || header === 'tgl' || header === 'date' || header.includes('tanggal')) keyName = 'tanggal';
      
      obj[keyName] = (line[index] || '').trim();
    });
    return obj;
  });
}

export function generateId(prefix: 'TRX' | 'PST' | 'PLG' | 'ABS' | 'INF' | 'SRT' | 'REG' | 'BAN'): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  return `${prefix}-${year}-${randomNum}`;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDateString(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}

export function terbilang(num: number): string {
  const words = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  let temp = "";
  const n = Math.floor(num);
  if (n < 0) {
    return "minus " + terbilang(Math.abs(n));
  }
  if (n < 12) {
    temp = " " + words[n];
  } else if (n < 20) {
    temp = terbilang(n - 10) + " belas";
  } else if (n < 100) {
    temp = terbilang(Math.floor(n / 10)) + " puluh" + terbilang(n % 10);
  } else if (n < 200) {
    temp = " seratus" + terbilang(n - 100);
  } else if (n < 1000) {
    temp = terbilang(Math.floor(n / 100)) + " ratus" + terbilang(n % 100);
  } else if (n < 2000) {
    temp = " seribu" + terbilang(n - 1000);
  } else if (n < 1000000) {
    temp = terbilang(Math.floor(n / 1000)) + " ribu" + terbilang(n % 1000);
  } else if (n < 1000000000) {
    temp = terbilang(Math.floor(n / 1000000)) + " juta" + terbilang(n % 1000000);
  } else if (n < 1000000000000) {
    temp = terbilang(Math.floor(n / 1000000000)) + " milyar" + terbilang(num % 1000000000);
  } else if (n < 1000000000000000) {
    temp = terbilang(Math.floor(n / 1000000000000)) + " trilyun" + terbilang(num % 1000000000000);
  }
  return temp.trim();
}

export function getProp(obj: any, ...keys: string[]): any {
  if (!obj) return '';
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  const normalizedSearchKeys = keys.map(k => k.toLowerCase().replace(/[\s\-_.]/g, ''));
  for (const rawKey of Object.keys(obj)) {
    const normRawKey = rawKey.toLowerCase().replace(/[\s\-_.]/g, '');
    if (normalizedSearchKeys.includes(normRawKey)) {
      if (obj[rawKey] !== undefined && obj[rawKey] !== null) {
        return obj[rawKey];
      }
    }
  }
  return '';
}
