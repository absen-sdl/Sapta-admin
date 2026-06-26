export interface Anggota {
  nia: string;
  namaLengkap: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  jenjangPendidikan: string;
  namaSekolah: string;
  kelas: string;
  alamat: string;
  noHp: string;
  email: string;
  key: string;
  linkProfile: string;
  status: string;
  tanggalDaftar?: string;
}

export interface Pembayaran {
  idTransaksi: string;
  tanggal: string;
  nia: string;
  namaLengkap: string;
  namaTagihan: string;
  keterangan: string;
  nominal: number;
  status: string;
}

export interface Prestasi {
  idPrestasi: string;
  tanggal: string;
  nia: string;
  namaLengkap: string;
  jenisPrestasi: string;
  deskripsi: string;
  linkFoto: string;
}

export interface Pelanggaran {
  idPelanggaran: string;
  tanggal: string;
  nia: string;
  nama: string;
  jenisPelanggaran: 'Ringan' | 'Sedang' | 'Berat';
  namaPelanggaran: string;
  keterangan: string;
  adaDenda: 'Ya' | 'Tidak';
  nominalDenda: number;
  jenisHukuman: string;
  statusHukuman?: 'Belum Ditindak' | 'Proses' | 'Selesai';
}

export interface Absensi {
  idAbsensi: string;
  nia: string;
  namaLengkap: string;
  kelas: string;
  tanggalAbsen: string;
  waktuAbsen: string;
  keterangan: string;
  jenisKegiatan: string;
}

export interface Informasi {
  idInformasi: string;
  judul: string;
  isi: string;
  jenisKegiatan: string;
  tanggal: string;
  waktu: string;
}

export interface Surat {
  idSurat: string;
  tanggal: string;
  nia: string;
  namaLengkap: string;
  perihal: string;
  linkGoogleDoc: string;
}

export interface Peraturan {
  idPeraturan: string;
  judul: string;
  sanksi: string;
  status: 'Ringan' | 'Sedang' | 'Berat';
}

export type ActiveTab = 'dashboard' | 'anggota' | 'pembayaran' | 'prestasi' | 'pelanggaran' | 'absensi' | 'informasi' | 'surat' | 'peraturan' | 'pengaturan' | 'kelola_akun' | 'cetak_data' | 'asisten_ai';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
