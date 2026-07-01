/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT DATABASE INTEGRASI PORTAL SAPTA (V8 AUTO-CREATE SHEETS & COLUMNS)
 * Mendukung Operasi: READ, ADD (INPUT), EDIT (UPDATE), DELETE
 * Khusus sheet "ABSENSI" / "REKAP ABSENSI" hanya mendukung READ (Hanya Baca)
 * ==============================================================================
 * 
 * FITUR DYNAMIC AUTO-CREATE:
 * Setiap kali aplikasi membaca atau menulis data, script ini akan secara otomatis
 * mendeteksi jika sheet atau kolom yang diperlukan belum ada, lalu membuatnya secara
 * real-time tanpa memerlukan tindakan manual!
 */

// Konfigurasi Skema Struktur Kolom Sesuai Permintaan Anda
var SHEET_SCHEMAS = {
  "DATA ANGGOTA": ["NIA", "Nama Lengkap", "Tempat Lahir", "Tanggal Lahir", "Jenis Kelamin", "Jenjang Pendidikan", "Nama Sekolah", "Kelas", "Alamat", "No Hp", "E-Mail", "PIN", "Link-Profile", "Status", "edit/add by"],
  "PEMBAYARAN": ["ID Transaksi", "Tanggal", "Nia", "Nama Lengkap", "Nama Tagihan", "Keterangan", "Nominal", "Status", "Tercetak", "edit/add by"],
  "PRESTASI": ["ID Prestasi", "Tanggal", "NIA", "Nama lengkap", "Jenis Prestasi", "Deskripsi", "Link-foto", "edit/add by"],
  "PELANGGARAN": ["ID Pelanggaran", "Tanggal", "NIA", "Nama", "Jenis Pelanggaran", "Nama Pelanggaran", "Keterangan", "Ada Denda", "Nominal Denda", "Jenis Hukuman", "Status Tindak Lanjut", "edit/add by"],
  "ABSENSI": ["ID Absensi", "NIA", "Nama Lengkap", "Kelas", "Tanggal", "Waktu", "Status", "Keterangan", "Jenis Kegiatan"],
  "INFORMASI": ["idInformasi", "Judul", "Isi", "Jenis kegiatan", "Tanggal", "Waktu", "edit/add by"],
  "INFORMASI ADMIN": ["idInformasiAdmin", "Judul", "Isi", "Jenis kegiatan", "Tanggal", "Waktu", "edit/add by"],
  "BANNER": ["ID Banner", "Judul", "Link Foto", "Link Artikel", "Tanggal Input", "Sasaran", "edit/add by"],
  "SURAT": ["ID Surat", "Tanggal", "NIA", "Nama", "Perihal", "Link Dokumen", "edit/add by"],
  "PERATURAN": ["ID Peraturan", "Judul", "Sanksi", "Status", "edit/add by"],
  "LOG NOTIFIKASI": ["ID Log", "Tanggal", "Operator", "Tipe Aksi", "Menu", "Keterangan"],
  "PENGUMUMAN": ["ID Pengumuman", "Tanggal", "Judul", "Link File", "Nama File", "Tipe File", "edit/add by"]
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
        return h.toString().trim().toLowerCase();
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
      var hClean = hName.toString().trim().toLowerCase();
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

    if (!action) {
      return createJsonResponse({ error: "Parameter 'action' wajib disematkan." });
    }

    // --- FITUR AUTO-UPLOAD FOTO/FILE KE GOOGLE DRIVE ---
    if (action === "upload" || action === "uploadFile") {
      var base64Data = payload.base64Data || payload.data;
      var filename = payload.filename || "upload_file";
      if (!base64Data) {
        return createJsonResponse({ error: "Data base64 tidak ditemukan untuk proses upload." });
      }
      var uploadedUrl = uploadBase64Image(base64Data, filename, "UploadAction");
      if (uploadedUrl) {
        return createJsonResponse({ status: "success", url: uploadedUrl });
      } else {
        return createJsonResponse({ error: "Gagal mengunggah file ke Google Drive." });
      }
    }

    if (!sheetName) {
      return createJsonResponse({ error: "Parameter 'sheetName' wajib disematkan." });
    }

    // PROTEKSI: Sesuai instruksi Anda, menu REKAP ABSENSI / ABSENSI dilarang menulis/mengedit/menghapus!
    if (sheetName === "ABSENSI" && action !== "read") {
      return createJsonResponse({ error: "AKSES DITOLAK: Fitur rekap absensi bersifat Read-Only (Hanya Baca)." });
    }

    // Fitur Otomatis: Jika ada kolom bertipe base64 image (fotoProfile, linkFoto, linkProfile, linkFile), otomatis simpan ke Drive dan ganti nilainya dengan Link Google Drive URL
    if (data && typeof data === "object") {
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          var val = data[key];
          if (typeof val === "string" && val.indexOf("data:") === 0 && val.indexOf(";base64,") !== -1) {
            var uploadedUrl = uploadBase64Image(val, key, sheetName);
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
      sheet.deleteRow(i + 2); // Menghapus baris riil
      return createJsonResponse({ status: "success", message: "ID " + targetId + " berhasil dihapus secara permanen dari basis data Google Sheets." });
    }
  }

  return createJsonResponse({ error: "Data dengan ID '" + targetId + "' tidak ditemukan untuk dihapus." });
}

/**
 * FUNGSI UTILITAS / HELPER
 * Menentukan indeks kolom untuk Primary Key secara dinamis
 */
function getPrimaryKeyColIndex(sheetName, headers) {
  var name = sheetName.toUpperCase().trim();
  if (name === "AKUN SAPTA" || name === "KELOLA AKUN") {
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
  if (upper === "KELOLA AKUN" || upper === "AKUN SAPTA") {
    var ss = getActiveSpreadsheetRobust();
    if (getSheetCaseInsensitive(ss, "KELOLA AKUN")) return "KELOLA AKUN";
    if (getSheetCaseInsensitive(ss, "AKUN SAPTA")) return "AKUN SAPTA";
    return "KELOLA AKUN"; // Default
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
    "tipefile": ["tipefile", "filetype", "tipe_file"]
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
function uploadBase64Image(base64Data, fieldName, sheetName) {
  try {
    var matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    var mimeType = "image/jpeg";
    var base64Part = base64Data;
    
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      var basePart = matches[2]; // Fallback if re-parse needed
      base64Part = matches[2];
    }
    
    var decoded = Utilities.base64Decode(base64Part);
    
    var ext = "jpg";
    if (mimeType.indexOf("png") !== -1) ext = "png";
    else if (mimeType.indexOf("gif") !== -1) ext = "gif";
    else if (mimeType.indexOf("pdf") !== -1) ext = "pdf";
    else if (mimeType.indexOf("webp") !== -1) ext = "webp";
    
    var fileName = (sheetName || "Upload") + "_" + (fieldName || "file") + "_" + new Date().getTime() + "." + ext;
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    var folderName = "Aplikasi_Upload_Foto";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    var viewUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
    return viewUrl;
  } catch (err) {
    Logger.log("Gagal mengunggah foto base64: " + err.toString());
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
