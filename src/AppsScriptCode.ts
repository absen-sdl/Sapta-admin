// ==============================================================================
// PERHATIAN: JANGAN SALIN FILE INI SECARA UTUH KE GOOGLE APPS SCRIPT EDITOR!
// File ini mengandung pembungkus TypeScript "export const GOOGLE_APPS_SCRIPT_CODE = `...`".
// Jika Anda menyalin seluruh file ini, Anda akan mendapat error "Unexpected token 'export'".
//
// CARA MENYALIN YANG BENAR:
// 1. Salin isi file "/apps-script.gs" yang ada di folder root proyek ini (itu adalah kode bersih).
// 2. ATAU klik tombol "Salin Kode Bersih" di halaman Pengaturan Aplikasi (Integrasi Database).
// ==============================================================================

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT DATABASE INTEGRASI PORTAL SAPTA (V8 AUTO-CREATE SHEETS & COLUMNS)
 * Mendukung Operasi: READ, ADD (INPUT), EDIT (UPDATE), DELETE untuk semua menu tanpa terkecuali
 * Khusus untuk ABSENSI, pengeditan dibatasi hanya pada kolom Status (Hadir, Terlambat, Sakit, Izin, Alpha)
 * ==============================================================================
 * 
 * FITUR DYNAMIC AUTO-CREATE:
 * Setiap kali aplikasi membaca atau menulis data, script ini akan secara otomatis
 * mendeteksi jika sheet atau kolom yang diperlukan belum ada, lalu membuatnya secara
 * real-time tanpa memerlukan tindakan manual!
 */

// Konfigurasi Skema Struktur Kolom Sesuai Permintaan Anda
var SHEET_SCHEMAS = {
  "KELOLA AKUN": ["Nama Lengkap", "username", "pasword", "remove menu", "Akses Aplikasi Sapta Absen", "Foto Profile"],
  "ADMIN SAPTA DATA": ["Nama Lengkap", "username", "pasword", "remove menu", "Akses Aplikasi Sapta Absen", "Foto Profile"],
  "AKUN SAPTA": ["Nama Lengkap", "username", "pasword", "remove menu", "Akses Aplikasi Sapta Absen", "Foto Profile"],
  "DATA ANGGOTA": ["No.Induk/NISN/NIA", "Nama Lengkap", "Tempat Lahir", "Tanggal Lahir", "Jenis Kelamin", "Jenjang Pendidikan", "Nama Sekolah", "Kelas", "Alamat", "No Hp", "E-Mail", "Pin", "Link-Profile", "Status", "edit/add by"],
  "ABSENSI": ["ID ABSENSI", "No.Induk/NISN/NIA", "Nama Lengkap", "Kelas", "Tanggal", "Jam Datang", "Jam Pulang", "Status", "Metode Absensi", "Jenis Kegiatan"],
  "PELANGGARAN": ["ID Pelanggaran", "Tanggal", "No.Induk/NISN/NIA", "Nama", "Jenis Pelanggaran", "Nama Pelanggaran", "Keterangan", "Ada Denda", "Nominal Denda", "Jenis Hukuman", "Status Tindak Lanjut", "edit/add by"],
  "PEMBAYARAN": ["ID Transaksi", "Tanggal", "No.Induk/NISN/NIA", "Nama Lengkap", "Nama Tagihan", "Keterangan", "Nominal", "Status", "Tercetak", "edit/add by"],
  "PRESTASI": ["ID Prestasi", "Tanggal", "No.Induk/NISN/NIA", "Nama lengkap", "Jenis Prestasi", "Deskripsi", "Link-foto", "edit/add by"],
  "SURAT": ["ID Surat", "Tanggal", "No.Induk/NISN/NIA", "Nama", "Perihal", "Link Dokumen", "edit/add by"],
  "PERATURAN": ["ID Peraturan", "Judul", "Sanksi", "Status", "edit/add by"],
  "INFORMASI": ["idInformasI", "Judul", "Isi", "Jenis kegiatan", "Tanggal", "Waktu", "edit/add by"],
  "INFORMASI ADMIN": ["idInformasiAdmin", "Judul", "Isi", "Jenis kegiatan", "Tanggal", "Waktu", "edit/add by"],
  "BANNER": ["ID Banner", "Judul", "Link Foto", "Link Artikel", "Tanggal Input", "Sasaran", "edit/add by"],
  "PENGUMUMAN": ["ID Pengumuman", "Tanggal", "Judul", "Link File", "Nama File", "Tipe File", "edit/add by"],
  "CONFIG KARTU": ["Lembaga", "Tema Warna", "Orientasi", "Bg Depan", "Bg Belakang", "Warna Teks Depan", "Warna Teks Belakang", "Sembunyikan Header", "Sembunyikan Footer", "Ketentuan", "edit/add by"],
  "LOG NOTIFIKASI": ["ID Log", "Tanggal", "Operator", "Tipe Aksi", "Menu", "Keterangan"]
};

// Menambahkan menu khusus di Google Sheets saat dokumen dibuka untuk memudahkan pembuatan kolom otomatis
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🛠️ Setup Database Sapta')
        .addItem('Buat / Sesuaikan Semua Sheet', 'setupSpreadsheetColumns')
        .addToUi();
  } catch (e) {
    // Diabaikan secara tenang tanpa log untuk mencegah membanjiri log eksekusi Web App dengan status Peringatan
  }
}

/**
 * Mendapatkan Sheet secara aman secara case-insensitive.
 */
function getSheetCaseInsensitive(ss, name) {
  var sheets = ss.getSheets();
  var nameClean = name.toString().toLowerCase().trim();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().toString().toLowerCase().trim();
    if (sName === nameClean) {
      return sheets[i];
    }
  }
  return null;
}

/**
 * Mendapatkan Sheet secara aman. Jika Sheet tidak ada, buat baru lengkap dengan kolomnya.
 * Jika Sheet sudah ada, periksa apakah ada kolom skema yang belum ada, dan tambahkan otomatis.
 * Mendukung pencarian sheet dan skema secara case-insensitive untuk keandalan maksimal!
 */
function getOrCreateSheetAndColumns(sheetName) {
  var ss = getActiveSpreadsheetRobust();
  if (!sheetName) return null;
  
  // Cari kecocokan casing resmi dari SHEET_SCHEMAS
  var officialSheetName = sheetName;
  for (var k in SHEET_SCHEMAS) {
    if (k.toLowerCase().trim() === sheetName.toLowerCase().trim()) {
      officialSheetName = k;
      break;
    }
  }

  // Dapatkan sheet secara case-insensitive
  var sheet = getSheetCaseInsensitive(ss, officialSheetName);
  var schemaHeaders = SHEET_SCHEMAS[officialSheetName] || [];
  
  if (!sheet) {
    try {
      sheet = ss.insertSheet(officialSheetName);
    } catch (e) {
      // Jika terjadi kegagalan (misalnya karena sheet name dianggap sudah ada/duplikat secara case-insensitive)
      sheet = getSheetCaseInsensitive(ss, officialSheetName);
      if (!sheet) {
        throw new Error("Gagal membuat sheet '" + officialSheetName + "': " + e.toString());
      }
    }
    
    if (sheet && schemaHeaders.length > 0) {
      sheet.getRange(1, 1, 1, schemaHeaders.length).setValues([schemaHeaders]);
      
      // Format Header agar rapi (Tebal, latar abu-abu muda, teks tengah)
      var headerRange = sheet.getRange(1, 1, 1, schemaHeaders.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f1f5f9");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      
      // Set otomatis lebar kolom yang pas
      for (var i = 1; i <= schemaHeaders.length; i++) {
        sheet.autoResizeColumn(i);
      }
    }
    return sheet;
  }
  
  // Jika sheet sudah ada, periksa apakah ada kolom dari skema yang belum ada di spreadsheet
  if (schemaHeaders.length > 0) {
    var lastCol = sheet.getLastColumn();
    var existingHeaders = [];
    if (lastCol > 0) {
      existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
        return h.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      });
    } else {
      // Baris pertama kosong, langsung isi schemaHeaders
      sheet.getRange(1, 1, 1, schemaHeaders.length).setValues([schemaHeaders]);
      var headerRange = sheet.getRange(1, 1, 1, schemaHeaders.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f1f5f9");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      for (var i = 1; i <= schemaHeaders.length; i++) {
        sheet.autoResizeColumn(i);
      }
      return sheet;
    }
    
    var missingHeaders = [];
    for (var i = 0; i < schemaHeaders.length; i++) {
      var hName = schemaHeaders[i];
      var hClean = hName.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (existingHeaders.indexOf(hClean) === -1) {
        missingHeaders.push(hName);
      }
    }
    
    if (missingHeaders.length > 0) {
      var startCol = lastCol + 1;
      // Tambahkan kolom yang kurang di baris ke-1 (header)
      for (var j = 0; j < missingHeaders.length; j++) {
        var colIndex = startCol + j;
        var cell = sheet.getRange(1, colIndex);
        cell.setValue(missingHeaders[j]);
        cell.setFontWeight("bold");
        cell.setBackground("#f1f5f9");
        cell.setHorizontalAlignment("center");
        sheet.autoResizeColumn(colIndex);
      }
    }
  }
  
  return sheet;
}

// Fungsi otomatis mendokumentasikan dan memformat kolom database
// Jalankan ini sekali untuk menyiapkan seluruh sheet & kolom secara instan!
function setupSpreadsheetColumns() {
  try {
    for (var sheetName in SHEET_SCHEMAS) {
      getOrCreateSheetAndColumns(sheetName);
    }
    if (typeof Browser !== 'undefined') {
      Browser.msgBox("Sukses!", "Semua sheet dan kolom database berhasil disinkronkan & disiapkan otomatis!", Browser.Buttons.OK);
    }
  } catch (e) {
    // Diabaikan secara tenang tanpa log peringatan
  }
}

/**
 * HANDLER HTTP GET
 */
function doGet(e) {
  // Pengaman jika dicoba klik "Run" langsung dari Editor Google Apps Script
  if (typeof e === "undefined" || !e || !e.parameter) {
    return createJsonResponse({
      status: "success",
      message: "Server web app Google Apps Script Anda AKTIF! Hubungkan dengan aplikasi React Anda menggunakan URL deployment.",
      editorRun: true
    });
  }

  try {
    var action = e.parameter.action;
    var sheetName = getSheetNameRobust(e.parameter.sheetName);
    
    // Jika dipicu tanpa action dan tanpa sheetName (misal: pengujian tautan di browser)
    if (!action && !sheetName) {
      return createJsonResponse({
        status: "success",
        message: "Server web app Google Apps Script Anda AKTIF! Hubungkan dengan aplikasi React Anda menggunakan URL Web App ini.",
        healthCheck: true
      });
    }
    
    if (!action || action === "read") {
      if (!sheetName) {
        return createJsonResponse({ error: "Sebutkan parameter 'sheetName' yang dituju." });
      }
      return readData(sheetName);
    }
    
    return createJsonResponse({ error: "Aksi '" + action + "' tidak didukung di HTTP GET. Gunakan POST untuk tambah/ubah/hapus." });
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

/**
 * HANDLER HTTP POST (Menerima raw JSON atau URLencoded parameters)
 */
function doPost(e) {
  if (typeof e === "undefined" || !e) {
    return createJsonResponse({ error: "Tidak ada data yang dikirimkan." });
  }

  try {
    var payload = {};
    
    // Parsing data yang dikirim oleh React App (bisa berupa teks JSON mentah atau form parameters)
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter || {};
      }
    } else {
      payload = e.parameter || {};
    }

    var action = payload.action;
    var sheetName = getSheetNameRobust(payload.sheetName);
    var data = payload.data || {};
    var targetId = payload.targetId || payload.primaryKey;
    var lembaga = payload.lembaga || data.Lembaga || data.lembaga || "";

    if (!action) {
      return createJsonResponse({ error: "Parameter 'action' wajib disematkan." });
    }

    // --- FITUR AUTO-UPLOAD FOTO/FILE KE GOOGLE DRIVE ---
    if (action === "upload" || action === "uploadFile") {
      var base64Data = payload.base64Data || (typeof payload.data === "string" ? payload.data : "");
      var filename = payload.filename || "upload_file";
      var uploadLembaga = payload.lembaga || "";
      var uploadSheetName = payload.sheetName || "UploadAction";
      if (!base64Data) {
        return createJsonResponse({ error: "Data base64 tidak ditemukan untuk proses upload." });
      }
      var uploadedUrl = uploadBase64Image(base64Data, filename, uploadSheetName, uploadLembaga);
      if (uploadedUrl) {
        return createJsonResponse({ status: "success", url: uploadedUrl });
      } else {
        return createJsonResponse({ error: "Gagal mengunggah file ke Google Drive." });
      }
    }

    if (action === "deleteFile") {
      var fileUrl = payload.url || payload.fileUrl;
      if (!fileUrl) {
        return createJsonResponse({ error: "Parameter 'url' file wajib disertakan." });
      }
      deleteFileByUrl(fileUrl);
      return createJsonResponse({ status: "success", message: "File berhasil dihapus dari Google Drive." });
    }

    if (!sheetName) {
      return createJsonResponse({ error: "Parameter 'sheetName' wajib disematkan." });
    }

    // Fitur Otomatis: Jika ada kolom bertipe base64 image (fotoProfile, linkFoto, linkProfile, linkFile), otomatis simpan ke Drive dan ganti nilainya dengan Link Google Drive URL
    if (data && typeof data === "object") {
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          var val = data[key];
          if (typeof val === "string" && val.indexOf("data:") === 0 && val.indexOf(";base64,") !== -1) {
            // Coba cari nama file asli dari field pendukung
            var originalFilename = "";
            if (key === "linkFile") {
              originalFilename = data.namaFile || data.nama_file || data.filename || "";
            } else if (key === "linkGoogleDoc") {
              originalFilename = data.namaFileSurat || data.nama_file_surat || data.namaFile || data.nama_file || "";
            } else if (key === "foto") {
              originalFilename = data.namaFoto || data.nama_foto || data.namaFile || data.nama_file || "";
            }
            
            var filenameParam = originalFilename || key;
            var uploadedUrl = uploadBase64Image(val, filenameParam, sheetName, lembaga);
            if (uploadedUrl) {
              data[key] = uploadedUrl;
            }
          }
        }
      }
    }

    switch (action) {
      case "read":
        return readData(sheetName);
      case "add":
      case "insert":
      case "create":
        var resAdd = addData(sheetName, data);
        writeLogActivity(action, sheetName, data, targetId);
        return resAdd;
      case "edit":
      case "update":
        var resEdit = updateData(sheetName, targetId, data);
        writeLogActivity(action, sheetName, data, targetId);
        return resEdit;
      case "delete":
        var resDelete = deleteData(sheetName, targetId);
        writeLogActivity(action, sheetName, data, targetId);
        return resDelete;
      default:
        return createJsonResponse({ error: "Aksi '" + action + "' tidak dikenali." });
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

/**
 * FUNGSI BACA DATA (READ)
 */
function readData(sheetName) {
  var ss = getActiveSpreadsheetRobust();
  var sheet = getOrCreateSheetAndColumns(sheetName);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return createJsonResponse([]); // Berikan array kosong jika belum ada data selain header
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var dataRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  var result = [];
  for (var r = 0; r < dataRows.length; r++) {
    var obj = {};
    var hasValues = false;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c].toString().trim();
      var val = dataRows[r][c];
      
      // Deteksi jika tipe data Tanggal, dikonversi menjadi format string YYYY-MM-DD agar dibaca bersih oleh React
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      
      obj[key] = val;
      if (val !== "") hasValues = true;
    }
    if (hasValues) {
      result.push(obj);
    }
  }
  
  return createJsonResponse(result);
}

/**
 * FUNGSI TAMBAH DATA (ADD)
 */
function addData(sheetName, data) {
  var ss = getActiveSpreadsheetRobust();
  var sheet = getOrCreateSheetAndColumns(sheetName);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRowValues = [];

  // Hubungkan key JSON React secara aman berdasarkan kolom spreadsheet (case-insensitive & spasi-diabaikan)
  for (var i = 0; i < headers.length; i++) {
    var colName = headers[i].toString().trim();
    var matchedValue = getObjectValueCaseInsensitive(data, colName);
    newRowValues.push(matchedValue !== undefined ? matchedValue : "");
  }

  sheet.appendRow(newRowValues);
  return createJsonResponse({ status: "success", message: "Data baru berhasil disimpan ke Google Sheets!", data: data });
}

/**
 * FUNGSI EDIT DATA (UPDATE)
 */
function updateData(sheetName, targetId, data) {
  if (typeof targetId === "undefined" || targetId === null || targetId === "") {
    return createJsonResponse({ error: "Silakan tentukan ID penunjuk (targetId) yang ingin diedit." });
  }

  // Khusus ABSENSI, saring data agar hanya mengizinkan pengubahan kolom Status
  if (sheetName.toUpperCase().trim() === "ABSENSI") {
    var statusVal = getObjectValueCaseInsensitive(data, "Status");
    if (statusVal === undefined) {
      return createJsonResponse({ error: "Khusus untuk ABSENSI, hanya diperbolehkan mengedit kolom Status." });
    }
    var validOptions = ["hadir", "terlambat", "sakit", "izin", "alpha"];
    var cleanStatus = statusVal.toString().toLowerCase().trim();
    if (validOptions.indexOf(cleanStatus) === -1) {
      return createJsonResponse({ error: "Nilai Status tidak valid. Pilihan yang tersedia: Hadir, Terlambat, Sakit, Izin, Alpha." });
    }
    // Ganti data hanya dengan field Status
    data = { "Status": statusVal };
  }

  var ss = getActiveSpreadsheetRobust();
  var sheet = getOrCreateSheetAndColumns(sheetName);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return createJsonResponse({ error: "Tidak ada baris data untuk diedit." });

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = getPrimaryKeyColIndex(sheetName, headers);
  var ids = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
  
  var rowToEdit = -1;
  var targetStr = targetId.toString().trim().toLowerCase();

  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0].toString().trim().toLowerCase() === targetStr) {
      rowToEdit = i + 2; // Baris riil (ditambah 2 karena dinilai dari baris data kedua)
      break;
    }
  }

  if (rowToEdit === -1) {
    return createJsonResponse({ error: "Data dengan ID '" + targetId + "' tidak ditemukan dalam tabel." });
  }

  // Sebelum memperbarui, bandingkan nilai lama untuk menghapus file di Google Drive jika diganti atau dihapus
  for (var colIdx = 0; colIdx < headers.length; colIdx++) {
    var colName = headers[colIdx].toString().trim();
    var newVal = getObjectValueCaseInsensitive(data, colName);
    if (newVal !== undefined) {
      var oldVal = sheet.getRange(rowToEdit, colIdx + 1).getValue().toString().trim();
      // Jika nilai baru berbeda atau dikosongkan, hapus file lama dari Google Drive
      if (oldVal !== newVal.toString().trim() && (oldVal.indexOf("drive.google.com") !== -1 || oldVal.indexOf("googleusercontent.com") !== -1)) {
        deleteFileByUrl(oldVal);
      }
    }
  }

  // Edit sel data secara dinamis berdasarkan kolom yang tersedia
  for (var colIdx = 0; colIdx < headers.length; colIdx++) {
    var colName = headers[colIdx].toString().trim();
    var val = getObjectValueCaseInsensitive(data, colName);
    if (val !== undefined) {
      sheet.getRange(rowToEdit, colIdx + 1).setValue(val);
    }
  }

  return createJsonResponse({ status: "success", message: "Data dengan ID " + targetId + " berhasil diperbarui!" });
}

/**
 * FUNGSI HAPUS DATA (DELETE)
 */
function deleteData(sheetName, targetId) {
  if (!targetId) return createJsonResponse({ error: "Sebutkan ID target (targetId) untuk dihapus." });

  var ss = getActiveSpreadsheetRobust();
  var sheet = getOrCreateSheetAndColumns(sheetName);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return createJsonResponse({ error: "Tidak ada baris data untuk dihapus." });

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = getPrimaryKeyColIndex(sheetName, headers);
  var ids = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
  var targetStr = targetId.toString().trim().toLowerCase();
  
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0].toString().trim().toLowerCase() === targetStr) {
      var rowToDelete = i + 2;
      
      // Deteksi dan hapus semua file Google Drive yang tertaut di baris yang akan dihapus
      for (var colIdx = 0; colIdx < headers.length; colIdx++) {
        var oldVal = sheet.getRange(rowToDelete, colIdx + 1).getValue().toString().trim();
        if (oldVal && (oldVal.indexOf("drive.google.com") !== -1 || oldVal.indexOf("googleusercontent.com") !== -1)) {
          deleteFileByUrl(oldVal);
        }
      }

      sheet.deleteRow(rowToDelete); // Menghapus baris riil
      return createJsonResponse({ status: "success", message: "ID " + targetId + " berhasil dihapus secara permanen dari basis data Google Sheets." });
    }
  }

  return createJsonResponse({ error: "Data dengan ID '" + targetId + "' tidak ditemukan untuk dihapus." });
}

/**
 * MENGHAPUS FILE DI GOOGLE DRIVE BERDASARKAN URL FILE
 */
function deleteFileByUrl(url) {
  if (!url || typeof url !== "string") return;
  try {
    var fileId = extractFileIdFromUrl(url);
    if (fileId) {
      var file = DriveApp.getFileById(fileId);
      if (file) {
        file.setTrashed(true); // Pindahkan ke Sampah secara aman
        Logger.log("Berhasil membuang file ke sampah dengan ID: " + fileId);
      }
    }
  } catch (err) {
    Logger.log("Gagal menghapus file dari Google Drive (URL: " + url + "): " + err.toString());
  }
}

/**
 * FUNGSI UTILITAS / HELPER
 * Menentukan indeks kolom untuk Primary Key secara dinamis
 */
function getPrimaryKeyColIndex(sheetName, headers) {
  var name = sheetName.toUpperCase().trim();
  if (name === "AKUN SAPTA" || name === "KELOLA AKUN" || name === "ADMIN SAPTA DATA") {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toString().trim().toLowerCase();
      if (h === "username" || h === "user") {
        return i + 1; // 1-based index (e.g., column B is 2)
      }
    }
  }
  return 1; // Default ke kolom pertama (A)
}

/**
 * Resolusi nama lembaran kerja (sheet) secara toleran
 */
function getSheetNameRobust(name) {
  if (!name) return null;
  var upper = name.toString().toUpperCase().trim();
  if (upper === "REKAP ABSENSI" || upper === "ABSENSI") {
    // Dipetakan ke sheet internal "ABSENSI"
    return "ABSENSI";
  }
  if (upper === "KELOLA AKUN" || upper === "AKUN SAPTA" || upper === "ADMIN SAPTA DATA") {
    var ss = getActiveSpreadsheetRobust();
    if (getSheetCaseInsensitive(ss, "KELOLA AKUN")) return "KELOLA AKUN";
    if (getSheetCaseInsensitive(ss, "AKUN SAPTA")) return "AKUN SAPTA";
    if (getSheetCaseInsensitive(ss, "ADMIN SAPTA DATA")) return "ADMIN SAPTA DATA";
    return "KELOLA AKUN"; // Default
  }
  if (upper === "INFORMASI ADMIN" || upper === "INFOMASI: ADMIN" || upper === "INFORMASI: ADMIN" || upper === "INFOMASI ADMIN" || upper === "INFORMASI_ADMIN") {
    return "INFORMASI ADMIN";
  }
  if (upper === "INFORMASI" || upper === "INFOMASI") {
    return "INFORMASI";
  }
  return name.toString().trim();
}

/**
 * Resolusi value berdasarkan nama kolom yang dinamis & aman dari inkonsistensi string/casing nama property
 */
function getObjectValueCaseInsensitive(obj, keyToFind) {
  var targetKeyClean = keyToFind.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Kamus sinonim kolom (Synonyms Mapping) untuk kebal akan inkonsistensi penamaan property React vs Kolom Google Sheet
  var synonyms = {
    "nama": ["nama", "namalengkap", "fullname", "name"],
    "namalengkap": ["nama", "namalengkap", "fullname", "name"],
    "noinduknisnnia": ["noinduknisnnia", "nia", "noinduk", "nisn", "nomorinduk", "nomorindukanggota"],
    "nia": ["noinduknisnnia", "nia", "noinduk", "nisn", "nomorinduk", "nomorindukanggota"],
    "idperaturan": ["idperaturan", "id", "id_peraturan"],
    "idsurat": ["idsurat", "id", "id_surat"],
    "idtransaksi": ["idtransaksi", "id", "id_transaksi"],
    "idprestasi": ["idprestasi", "id", "id_prestasi"],
    "idpelanggaran": ["idpelanggaran", "id", "id_pelanggaran"],
    "idinformasi": ["idinformasi", "id", "id_informasi"],
    "linkdokumen": ["linkdokumen", "linkgoogledoc", "url", "link", "linkdoc"],
    "linkgoogledoc": ["linkdokumen", "linkgoogledoc", "url", "link", "linkdoc"],
    "pin": ["pin", "key", "password", "pasword", "sandi", "kunci"],
    "key": ["pin", "key", "password", "pasword", "sandi", "kunci"],
    "tingkat": ["status", "tingkat", "level"],
    "status": ["status", "tingkat", "level"],
    "tercetak": ["tercetak", "isprinted", "printed", "sudahcetak"],
    "removemenu": ["removemenu", "removemenu", "remove_menu", "remove menu"],
    "idpengumuman": ["idpengumuman", "id", "id_pengumuman"],
    "linkfile": ["linkfile", "file", "url", "link", "link_file"],
    "namafile": ["namafile", "filename", "nama_file"],
    "tipefile": ["tipefile", "filetype", "tipe_file"],
    "aksesaplikasisaptaabsen": ["aksesaplikasisaptaabsen", "aksessaptaabsen", "akses_sapta_absen", "sapta_absen_akses", "sapta_absen", "saptaabsen", "akses aplikasi sapta absen"]
  };

  // 1. Coba pencocokan langsung (clean key)
  for (var k in obj) {
    var kClean = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (kClean === targetKeyClean) {
      return obj[k];
    }
  }

  // 2. Coba pencocokan menggunakan sinonim
  if (synonyms[targetKeyClean]) {
    var list = synonyms[targetKeyClean];
    for (var k in obj) {
      var kClean = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (list.indexOf(kClean) !== -1) {
        return obj[k];
      }
    }
  }
  
  return undefined;
}

/**
 * Mendapatkan Spreadsheet secara aman dari berbagai konteks eksekusi.
 * Mencegah error crash jika dijalankan di Standalone Web App tanpa UI aktif.
 */
function getActiveSpreadsheetRobust() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {
    // Diabaikan secara tenang, sistem otomatis beralih ke Fallback SPREADSHEET_ID jika dikonfigurasi
  }

  // --- FALLBACK SPREADSHEET ID ---
  // Jika Anda membuat Script secara standalone (bukan melalui Ekstensi Spreadsheet),
  // masukkan ID Google Sheets Anda di sini. Cara cari ID: buka Google Sheet Anda,
  // lalu salin string panjang di URL-nya: https://docs.google.com/spreadsheets/d/[ID_DI_SINI]/edit
  var SPREADSHEET_ID = ""; // Ganti dengan ID Spreadsheet Anda jika diperlukan (cth: "1aBCdeFgHiJKLmNoPq...")

  if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      console.error("Gagal membuka Spreadsheet menggunakan SPREADSHEET_ID: " + e.toString());
    }
  }

  throw new Error("Tidak dapat menyambungkan Google Sheet. " +
                  "Solusi: (1) Pastikan Apps Script ini dibuat via menu 'Ekstensi' -> 'Apps Script' langsung di Google Sheet Anda, atau " +
                  "(2) Isikan variabel SPREADSHEET_ID di dalam kode Google Apps Script.");
}

/**
 * Mengubah object menjadi teks standard ekspor JSON API dengan tajuk CORS lengkap
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNGSI BANTU UNGGAH FOTO/FILE BASE64 KE GOOGLE DRIVE
 */
function uploadBase64Image(base64Data, fieldName, sheetName, lembaga) {
  try {
    if (!base64Data || typeof base64Data !== "string") {
      Logger.log("Info: Fungsi uploadBase64Image dipicu tanpa data base64 (kemungkinan dijalankan langsung secara manual dari editor Apps Script menggunakan tombol 'Run'). Ini normal dan aman jika Anda hanya menguji di editor. Fungsi ini akan bekerja secara otomatis ketika menerima kiriman berkas/foto asli dari aplikasi web.");
      return null;
    }
    var matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    var mimeType = "image/jpeg";
    var base64Part = base64Data;
    
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Part = matches[2];
    }
    
    var decoded = Utilities.base64Decode(base64Part);
    
    var ext = "jpg";
    var lowerMime = mimeType.toLowerCase();
    if (lowerMime.indexOf("png") !== -1) ext = "png";
    else if (lowerMime.indexOf("gif") !== -1) ext = "gif";
    else if (lowerMime.indexOf("webp") !== -1) ext = "webp";
    else if (lowerMime.indexOf("pdf") !== -1) ext = "pdf";
    else if (lowerMime.indexOf("csv") !== -1) ext = "csv";
    else if (lowerMime.indexOf("excel") !== -1 || lowerMime.indexOf("spreadsheet") !== -1 || lowerMime.indexOf("xls") !== -1) ext = "xlsx";
    else if (lowerMime.indexOf("word") !== -1 || lowerMime.indexOf("document") !== -1 || lowerMime.indexOf("msword") !== -1) ext = "docx";
    else if (lowerMime.indexOf("powerpoint") !== -1 || lowerMime.indexOf("presentation") !== -1 || lowerMime.indexOf("ppt") !== -1) ext = "pptx";
    else if (lowerMime.indexOf("text") !== -1 || lowerMime.indexOf("plain") !== -1) ext = "txt";
    else if (lowerMime.indexOf("heic") !== -1) ext = "heic";
    else if (lowerMime.indexOf("heif") !== -1) ext = "heif";
    
    var filenameClean = fieldName || "file";
    var extFromFilename = "";
    if (filenameClean.indexOf(".") !== -1) {
      var parts = filenameClean.split(".");
      extFromFilename = parts[parts.length - 1].toLowerCase();
    }
    
    if (extFromFilename && ["png", "jpg", "jpeg", "gif", "webp", "pdf", "csv", "xls", "xlsx", "doc", "docx", "ppt", "pptx", "txt", "heic", "heif"].indexOf(extFromFilename) !== -1) {
      ext = extFromFilename;
    }
    
    // Hilangkan ekstensi dari nama file jika ada agar tidak double
    var baseName = filenameClean;
    if (extFromFilename && baseName.toLowerCase().endsWith("." + extFromFilename)) {
      baseName = baseName.substring(0, baseName.length - (extFromFilename.length + 1));
    }
    
    var fileName = baseName + "_" + new Date().getTime() + "." + ext;
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    var driveRoot = DriveApp.getRootFolder();
    
    // Helper to find folder excluding trashed folders
    var getActiveFolderByName = function(parent, name) {
      var folders = parent.getFoldersByName(name);
      while (folders.hasNext()) {
        var f = folders.next();
        if (!f.isTrashed()) {
          return f;
        }
      }
      return null;
    };
    
    // 1. Dapatkan atau buat Folder Utama "SAPTA DIGITAL" sebagai wadah root di Google Drive Anda
    var parentFolder = getActiveFolderByName(driveRoot, "SAPTA DIGITAL");
    if (!parentFolder) {
      parentFolder = driveRoot.createFolder("SAPTA DIGITAL");
      parentFolder.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    }
    
    // 2. Dapatkan atau buat Folder Lembaga (misal: "PRAMUKA SUNAN DRAJAT LAMONGAN", "SMKSDL", dll.)
    var cleanLembaga = (lembaga || "Lembaga Umum").toString().trim();
    var folderLembaga = getActiveFolderByName(parentFolder, cleanLembaga);
    if (!folderLembaga) {
      folderLembaga = parentFolder.createFolder(cleanLembaga);
      folderLembaga.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    }
    
    // 3. Dapatkan atau buat Folder Menu didalam Folder Lembaga
    var cleanMenu = (sheetName || "Umum").toString().trim();
    var folderMenuName = cleanMenu;
    var upperMenu = cleanMenu.toUpperCase();
    if (upperMenu === "DATA ANGGOTA" || upperMenu === "ANGGOTA") {
      folderMenuName = "Data Anggota";
    } else if (upperMenu === "KARTU IDENTITAS" || upperMenu === "KARTU_IDENTITAS" || upperMenu === "KARTU") {
      folderMenuName = "Kartu Identitas";
    } else if (upperMenu === "PRESTASI") {
      folderMenuName = "Prestasi";
    } else if (upperMenu === "SURAT") {
      folderMenuName = "Surat";
    } else if (upperMenu === "BANNER") {
      folderMenuName = "Banner";
    } else if (upperMenu === "PENGUMUMAN" || upperMenu === "KELOLA PENGUMUMAN") {
      folderMenuName = "Kelola Pengumuman";
    } else if (upperMenu === "PELANGGARAN") {
      folderMenuName = "Pelanggaran";
    } else if (upperMenu === "PEMBAYARAN") {
      folderMenuName = "Pembayaran";
    } else if (upperMenu === "INFORMASI" || upperMenu === "INFORMASI ADMIN") {
      folderMenuName = "Informasi";
    } else if (upperMenu === "KELOLA AKUN" || upperMenu === "AKUN SAPTA" || upperMenu === "ADMIN SAPTA DATA" || upperMenu === "AKUN") {
      folderMenuName = "Kelola Akun";
    } else {
      // default capitalized
      folderMenuName = cleanMenu.charAt(0).toUpperCase() + cleanMenu.slice(1).toLowerCase();
    }
    
    var targetFolder = getActiveFolderByName(folderLembaga, folderMenuName);
    if (!targetFolder) {
      targetFolder = folderLembaga.createFolder(folderMenuName);
      targetFolder.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    }
    
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    var viewUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
    return viewUrl;
  } catch (err) {
    Logger.log("Gagal mengunggah file base64: " + err.toString());
    return base64Data; // Kembalikan data asli jika gagal
  }
}

/**
 * FUNGSI MENCATAT NOTIFIKASI AKTIVITAS KE SHEET "LOG NOTIFIKASI"
 */
function writeLogActivity(action, sheetName, data, targetId) {
  if (sheetName === "LOG NOTIFIKASI") return;
  
  try {
    var ss = getActiveSpreadsheetRobust();
    var sheet = getOrCreateSheetAndColumns("LOG NOTIFIKASI");
    
    // Tentukan nama Operator
    var operator = "Super Admin";
    if (data) {
      operator = getObjectValueCaseInsensitive(data, "edit/add by") || 
                 getObjectValueCaseInsensitive(data, "operator") || 
                 getObjectValueCaseInsensitive(data, "Nama Lengkap") ||
                 "Super Admin";
    }
    
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd HH:mm:ss");
    var logId = "LOG-" + Math.floor(100000 + Math.random() * 900000);
    
    // Tipe Aksi
    var actionType = "";
    if (action === "add" || action === "insert" || action === "create") {
      actionType = "TAMBAH";
    } else if (action === "edit" || action === "update") {
      actionType = "UBAH";
    } else if (action === "delete") {
      actionType = "HAPUS";
    } else {
      actionType = action.toString().toUpperCase();
    }
    
    // Keterangan
    var description = "";
    var nameField = getObjectValueCaseInsensitive(data, "Nama Lengkap") || 
                    getObjectValueCaseInsensitive(data, "Nama") || 
                    getObjectValueCaseInsensitive(data, "Judul") || 
                    "";
                    
    if (actionType === "TAMBAH") {
      description = "Menambahkan data baru di " + sheetName + (nameField ? " (" + nameField + ")" : "") + (targetId ? " ID: " + targetId : "");
    } else if (actionType === "UBAH") {
      description = "Mengubah data di " + sheetName + (targetId ? " ID: " + targetId : "") + (nameField ? " (" + nameField + ")" : "");
    } else if (actionType === "HAPUS") {
      description = "Menghapus data di " + sheetName + (targetId ? " ID: " + targetId : "") + (nameField ? " (" + nameField + ")" : "");
    } else {
      description = "Melakukan aksi " + actionType + " di " + sheetName;
    }
    
    var rowValues = [logId, timestamp, operator, actionType, sheetName, description];
    sheet.appendRow(rowValues);
  } catch (err) {
    // Tangkap error secara tenang agar tidak menginterupsi proses CRUD utama
    console.error("Gagal mencatat log aktivitas:", err.toString());
  }
}

/**
 * Dummy myFunction untuk mencegah error trigger Apps Script bawaan / lama.
 */
function myFunction() {
  console.log("myFunction berhasil dipicu dan dijalankan dengan aman.");
}

/**
 * =========================================================================
 * FUNGSI TAMBAHAN UNTUK SPREADSHEET / APPSHEET (HAPUS & EDIT BERKAS)
 * =========================================================================
 */

/**
 * 1. FITUR HAPUS DATA & FILE DARI DRIVE (HAPUS DATA)
 * Mengambil baris aktif di Google Sheets, mendeteksi kolom URL file secara dinamis 
 * (mencari kolom foto, file, dokumen, atau surat), memindahkan file tersebut ke trash Drive,
 * lalu menghapus seluruh baris data di Spreadsheet.
 */
function hapusDataDanFile() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var baris = sheet.getActiveCell().getRow();
  
  // Baris header (baris 1) tidak boleh dihapus
  if (baris <= 1) {
    try {
      SpreadsheetApp.getUi().alert("Peringatan", "Baris header atau baris ke-1 tidak boleh dihapus!", SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      Logger.log("Peringatan: Baris header tidak boleh dihapus.");
    }
    return;
  }
  
  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return;
  
  // Ambil semua header kolom pada baris 1
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var fileUrlsToTrash = [];
  
  // Deteksi kolom yang berisi file/foto/dokumen secara otomatis
  for (var colIdx = 0; colIdx < headers.length; colIdx++) {
    var headerName = headers[colIdx].toString().trim().toLowerCase();
    
    // Kata kunci penentu kolom berkas/file/foto
    if (
      headerName.indexOf("foto") !== -1 || 
      headerName.indexOf("profile") !== -1 || 
      headerName.indexOf("dokumen") !== -1 || 
      headerName.indexOf("file") !== -1 || 
      headerName.indexOf("bukti") !== -1 || 
      headerName.indexOf("surat") !== -1 || 
      headerName.indexOf("lampiran") !== -1 ||
      headerName.indexOf("gambar") !== -1
    ) {
      var cellValue = sheet.getRange(baris, colIdx + 1).getValue().toString().trim();
      if (cellValue) {
        fileUrlsToTrash.push(cellValue);
      }
    }
  }
  
  // Jika tidak terdeteksi otomatis, gunakan kolom fallback manual (kolom B atau kolom 2)
  if (fileUrlsToTrash.length === 0) {
    var kolomLinkManual = 2; // Silakan sesuaikan indeks kolom jika ingin manual (A=1, B=2, dst)
    if (kolomLinkManual <= lastColumn) {
      var manualValue = sheet.getRange(baris, kolomLinkManual).getValue().toString().trim();
      if (manualValue) {
        fileUrlsToTrash.push(manualValue);
      }
    }
  }
  
  // Pindahkan semua file yang terdeteksi ke Trash Google Drive
  for (var i = 0; i < fileUrlsToTrash.length; i++) {
    var url = fileUrlsToTrash[i];
    if (url && (url.indexOf("drive.google.com") !== -1 || url.indexOf("googleusercontent.com") !== -1)) {
      var fileId = extractFileIdFromUrl(url);
      if (fileId) {
        try {
          DriveApp.getFileById(fileId).setTrashed(true);
          Logger.log("Berhasil memindahkan file ke sampah Drive. ID: " + fileId);
        } catch (e) {
          Logger.log("Gagal memindahkan file ke sampah Drive (ID: " + fileId + "): " + e.message);
        }
      }
    }
  }
  
  // Hapus baris aktif dari spreadsheet
  sheet.deleteRow(baris);
}

/**
 * 2. FITUR EDIT DATA (UPLOAD ULANG)
 * Menerima URL file lama Google Drive, mengekstrak File ID, 
 * lalu memindahkannya ke sampah (trash) tanpa menghapus baris di Spreadsheet.
 *
 * @param {string} linkFileLama - URL dari file lama yang ingin dibuang ke sampah.
 */
function hapusFileLamaSaatEdit(linkFileLama) {
  if (!linkFileLama || typeof linkFileLama !== "string") {
    Logger.log("Peringatan: URL file lama kosong atau tidak valid.");
    return;
  }
  
  if (linkFileLama.indexOf("drive.google.com") !== -1 || linkFileLama.indexOf("googleusercontent.com") !== -1) {
    var fileId = extractFileIdFromUrl(linkFileLama);
    if (fileId) {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
        Logger.log("Berhasil membuang file lama ke sampah Drive. ID: " + fileId);
      } catch (e) {
        Logger.log("Gagal membuang file lama ke sampah Drive (ID: " + fileId + "): " + e.message);
      }
    }
  }
}

/**
 * Fungsi pembantu untuk mengekstrak Google Drive File ID dari berbagai pola URL
 * (Google Drive Viewer, Direct Download link, atau Googleusercontent preview)
 *
 * @param {string} url - URL lengkap dari Google Drive
 * @return {string|null} ID File Google Drive, atau null jika tidak ditemukan
 */
function extractFileIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  
  // Pola 1: Menggunakan parameter query id (contoh: ?id=FILE_ID atau &id=FILE_ID)
  if (url.indexOf("id=") !== -1) {
    var parts = url.split("id=");
    if (parts.length > 1) {
      return parts[1].split("&")[0];
    }
  }
  
  // Pola 2: URL standar sharing/viewer (contoh: /file/d/FILE_ID/view atau /file/d/FILE_ID)
  if (url.indexOf("/file/d/") !== -1) {
    var parts = url.split("/file/d/");
    if (parts.length > 1) {
      return parts[1].split("/")[0];
    }
  }
  
  // Pola 3: URL host langsung googleusercontent (contoh: googleusercontent.com/d/FILE_ID)
  if (url.indexOf("googleusercontent.com/d/") !== -1) {
    var parts = url.split("googleusercontent.com/d/");
    if (parts.length > 1) {
      return parts[1].split("/")[0].split("=")[0];
    }
  }
  
  // Pola 4: Gunakan regex pencocokan umum 25 karakter atau more
  var match = url.match(/[-\w]{25,}/);
  if (match) {
    return match[0];
  }
  
  return null;
}
`;
