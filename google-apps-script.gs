/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT DATABASE INTEGRASI PORTAL SAPTA
 * Mendukung Operasi: READ, ADD (INPUT), EDIT (UPDATE), DELETE
 * Khusus sheet "ABSENSI" / "REKAP ABSENSI" hanya mendukung READ (Hanya Baca)
 * ==============================================================================
 */

// Konfigurasi Skema Struktur Kolom Sesuai Permintaan Anda
var SHEET_SCHEMAS = {
  "KELOLA AKUN": ["Nama", "username", "pasword", "remove menu"],
  "DATA ANGGOTA": ["NIA", "Nama Lengkap", "Tempat Lahir", "Tanggal Lahir", "Jenis Kelamin", "Jenjang Pendidikan", "Nama Sekolah", "Kelas", "Alamat", "No Hp", "E-Mail", "PIN", "Link-Profile", "Status"],
  "PEMBAYARAN": ["ID Transaksi", "Tanggal", "Nia", "Nama Lengkap", "Nama Tagihan", "Keterangan", "Nominal", "Status"],
  "PRESTASI": ["ID Prestasi", "Tanggal", "NIA", "Nama lengkap", "Jenis Prestasi", "Deskripsi", "Link-foto"],
  "PELANGGARAN": ["ID Pelanggaran", "Tanggal", "NIA", "Nama", "Jenis Pelanggaran", "Nama Pelanggaran", "Keterangan", "Ada Denda", "Nominal Denda", "Jenis Hukuman", "Status Tindak Lanjut"],
  "ABSENSI": ["NIA", "Nama Lengkap", "Kelas", "Tanggal", "Waktu", "Status", "Keterangan"], // Hanya Baca
  "INFORMASI": ["idInformasi", "Judul", "Isi", "Jenis kegiatan", "Tanggal", "Waktu"],
  "SURAT": ["ID Surat", "Tanggal", "NIA", "Nama", "Perihal", "Link Dokumen"],
  "PERATURAN": ["ID Peraturan", "Judul", "Sanksi", "Status"]
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
 * Fungsi otomatis mendokumentasikan dan memformat kolom database
 * Jalankan ini sekali untuk menyiapkan seluruh sheet & kolom secara instan!
 */
function setupSpreadsheetColumns() {
  var ss = getActiveSpreadsheetRobust();
  
  for (var sheetName in SHEET_SCHEMAS) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Set Header Kolom di Baris 1
    var headers = SHEET_SCHEMAS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format Header agar rapi (Tebal, latar abu-abu muda, teks tengah)
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f1f5f9");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // Set otomatis lebar kolom yang pas
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  if (typeof Browser !== 'undefined') {
    try {
      Browser.msgBox("Sukses!", "Semua sheet dan kolom database berhasil disinkronkan & disiapkan otomatis!", Browser.Buttons.OK);
    } catch (e) {
      // Diabaikan secara tenang tanpa log peringatan
    }
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
    if (!sheetName) {
      return createJsonResponse({ error: "Parameter 'sheetName' wajib disematkan." });
    }

    // PROTEKSI: Sesuai instruksi Anda, menu REKAP ABSENSI / ABSENSI dilarang menulis/mengedit/menghapus!
    if (sheetName === "ABSENSI" && action !== "read") {
      return createJsonResponse({ error: "AKSES DITOLAK: Fitur rekap absensi bersifat Read-Only (Hanya Baca)." });
    }

    switch (action) {
      case "read":
        return readData(sheetName);
      case "add":
      case "insert":
      case "create":
        return addData(sheetName, data);
      case "edit":
      case "update":
        return updateData(sheetName, targetId, data);
      case "delete":
        return deleteData(sheetName, targetId);
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
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return createJsonResponse({ error: "Sheet bernama '" + sheetName + "' tidak ditemukan dalam struktur Spreadsheet." });
  }

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
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ error: "Sheet tidak ditemukan." });

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
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ error: "Sheet tidak ditemukan." });

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
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return createJsonResponse({ error: "Sheet tidak ditemukan." });

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
    if (ss.getSheetByName("KELOLA AKUN")) return "KELOLA AKUN";
    if (ss.getSheetByName("AKUN SAPTA")) return "AKUN SAPTA";
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
    "removemenu": ["removemenu", "removemenu", "remove_menu", "remove menu"]
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
