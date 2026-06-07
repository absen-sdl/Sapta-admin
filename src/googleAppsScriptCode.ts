export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT WEB APP - SYSTEM PANEL ANGGOTA & OPERASIONAL (V5 STABILISASI TOTAL)
 * Mendukung Semua Sheet: DATA ANGGOTA, PEMBAYARAN, PRESTASI, PELANGGARAN, ABSENSI, INFORMASI
 * 
 * Silakan SALIN dan TEMPEL kode ini di Google Apps Script Anda (Ekstensi -> Apps Script).
 * Pastikan Anda melakukan "Deploy" -> "New Deployment" -> "Web App" dengan:
 * - Execute as: Me (akun Anda)
 * - Who has access: Anyone
 */

// Menangani permintaan baca data (GET)
function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("STATUS: ONLINE. Aplikasi Web Google Apps Script siap digunakan! Harap konfigurasi tautan (URL Web App) hasil Deployment ini ke dalam panel pengaturan aplikasi Anda.")
      .setMimeType(ContentService.MimeType.TEXT);
  }
  var action = e.parameter.action;
  var sheetName = e.parameter.sheetName;
  
  if (action === "read") {
    if (!sheetName) {
      return errorResponse("Parameter 'sheetName' diperlukan.");
    }
    
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      
      // Jika tidak ketemu, cari secara case-insensitive & space-insensitive
      if (!sheet) {
        var allSheets = ss.getSheets();
        var targetSheetNameNorm = String(sheetName || "").trim().toLowerCase().replace(/[\\s\\-_.]/g, "");
        for (var k = 0; k < allSheets.length; k++) {
          var existingNameNorm = allSheets[k].getName().trim().toLowerCase().replace(/[\\s\\-_.]/g, "");
          if (existingNameNorm === targetSheetNameNorm) {
            sheet = allSheets[k];
            break;
          }
        }
      }
      
      // Jika sheet belum ada, kembalikan array kosong agar aplikasi tidak lag
      if (!sheet) {
        return successResponse([]);
      }
      
      var lastRow = sheet.getLastRow();
      var lastColumn = sheet.getLastColumn();
      if (lastRow < 2 || lastColumn === 0) {
        return successResponse([]);
      }
      
      var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      var rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
      var records = [];
      
      for (var i = 0; i < rows.length; i++) {
        var rowObj = {};
        var rowValues = rows[i];
        var hasData = false;
        
        for (var j = 0; j < headers.length; j++) {
          var headerCol = headers[j];
          if (headerCol) {
            var val = rowValues[j];
            rowObj[headerCol] = val;
            if (val !== "" && val !== null && val !== undefined) {
              hasData = true;
            }
          }
        }
        
        if (hasData) {
          records.push(rowObj);
        }
      }
      
      return successResponse(records);
    } catch (err) {
      return errorResponse(err.toString());
    }
  }
  
  return errorResponse("Action GET tidak didukung.");
}

// Menangani operasi tambah, edit, dan hapus (POST)
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ error: true, message: "Fungsi doPost dijalankan langsung dari editor. Silakan panggil fungsi doPost ini melalui REST API dengan menyertakan POST Payload body." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var sheetName = payload.sheetName;
    var data = payload.data;
    var targetId = payload.targetId;
    
    if (!action || !sheetName) {
      return errorResponse("Parameter 'action' dan 'sheetName' wajib disediakan dalam payload.");
    }
    
    // Proteksi: Tabel ABSENSI diatur murni Read-Only demi menjaga independensi rekam absensi harian
    var parsedSheetNameClean = String(sheetName || "").trim().toLowerCase().replace(/[\\s\\-_.]/g, "");
    if (parsedSheetNameClean === "absensi") {
      return errorResponse("Tabel ABSENSI diset murni Read-Only demi menjaga independensi rekam absensi harian.");
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    // Jika tidak ketemu, cari secara case-insensitive & space-insensitive
    if (!sheet) {
      var allSheets = ss.getSheets();
      var targetSheetNameNorm = String(sheetName || "").trim().toLowerCase().replace(/[\\s\\-_.]/g, "");
      for (var k = 0; k < allSheets.length; k++) {
        var existingNameNorm = allSheets[k].getName().trim().toLowerCase().replace(/[\\s\\-_.]/g, "");
        if (existingNameNorm === targetSheetNameNorm) {
          sheet = allSheets[k];
          break;
        }
      }
    }
    
    // Jika sheet tidak ditemukan, buat secara otomatis lengkap dengan headers bawaan
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Pastikan header kolom sudah ada
    var lastColumn = sheet.getLastColumn();
    var headers = [];
    if (lastColumn > 0) {
      headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      // Bersihkan header kosong di ujung kanan agar tidak mengacaukan penulisan kolom baru atau pendeteksian baris
      while (headers.length > 0 && String(headers[headers.length - 1] || "").trim() === "") {
        headers.pop();
      }
    }
    
    // Jika kolom baru kosong, inisialisasi default headers
    if (lastColumn === 0 || headers.length === 0 || !headers[0]) {
      headers = getDefaultHeaders(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Cari baris data yang memiliki ID sama jika melakukan Edit atau Delete (Gunakan pencarian Range native)
    var foundRowIndex = findRowIndexById(sheet, headers, targetId, sheetName);
    
    // 1. OPERASI: TAMBAH (ADD)
    if (action === "add" || action === "create") {
      var newRow = [];
      for (var i = 0; i < headers.length; i++) {
        var val = getObjectValueByHeaderName(data, headers[i]);
        newRow.push(val !== undefined && val !== null ? val : "");
      }
      sheet.appendRow(newRow);
      return successResponse({ success: true, message: "Data berhasil ditambahkan ke sheet " + sheetName });
    }
    
    // 2. OPERASI: EDIT (UPDATE)
    else if (action === "edit" || action === "update") {
      if (foundRowIndex === -1) {
        // Fallback jika tidak ditemukan baris lama, langsung tambahkan sebagai baris baru
        var fallbackNewRow = [];
        for (var i = 0; i < headers.length; i++) {
          var val = getObjectValueByHeaderName(data, headers[i]);
          fallbackNewRow.push(val !== undefined && val !== null ? val : "");
        }
        sheet.appendRow(fallbackNewRow);
        return successResponse({ success: true, message: "Data lama tidak ditemukan, membuat baris baru di " + sheetName });
      } else {
        var rowRange = sheet.getRange(foundRowIndex, 1, 1, headers.length);
        var currentValues = rowRange.getValues()[0];
        var updatedRow = [];
        
        for (var i = 0; i < headers.length; i++) {
          var colHeader = headers[i];
          var newVal = getObjectValueByHeaderName(data, colHeader);
          if (newVal !== undefined && newVal !== null) {
            updatedRow.push(newVal);
          } else {
            updatedRow.push(currentValues[i]); // Tetap gunakan data lama jika kolom payload kosong/tidak dikirim
          }
        }
        rowRange.setValues([updatedRow]);
        return successResponse({ success: true, message: "Data berhasil diperbarui di baris " + foundRowIndex });
      }
    }
    
    // 3. OPERASI: HAPUS (DELETE)
    else if (action === "delete") {
      if (foundRowIndex !== -1) {
        sheet.deleteRow(foundRowIndex);
        return successResponse({ success: true, message: "Baris " + foundRowIndex + " berhasil dihapus dari sheet " + sheetName });
      }
      return successResponse({ success: false, message: "Data tidak ditemukan untuk dihapus." });
    }
    
    return errorResponse("Action POST '" + action + "' tidak dikenali.");
  } catch (err) {
    return errorResponse("Kesalahan Server: " + err.toString());
  }
}

// Memetakan header ID utama yang diharapkan berdasarkan nama sheet
function getPrimaryKeyHeaderForSheet(sheetName) {
  var sName = String(sheetName || "").trim().toUpperCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/[\\s\\-_.]/g, "");
  if (sName.indexOf("ANGGOTA") !== -1 || sName.indexOf("MEMBER") !== -1) {
    return "nia";
  }
  if (sName.indexOf("PEMBAYARAN") !== -1 || sName.indexOf("TRANSAKSI") !== -1 || sName.indexOf("BAYAR") !== -1) {
    return "idtransaksi";
  }
  if (sName.indexOf("PRESTASI") !== -1) {
    return "idprestasi";
  }
  if (sName.indexOf("PELANGGARAN") !== -1 || sName.indexOf("DISIPLIN") !== -1 || sName.indexOf("SANKSI") !== -1) {
    return "idpelanggaran";
  }
  if (sName.indexOf("ABSENSI") !== -1 || sName.indexOf("HADIR") !== -1) {
    return "idabsensi";
  }
  if (sName.indexOf("INFORMASI") !== -1 || sName.indexOf("INFO") !== -1 || sName.indexOf("KABAR") !== -1) {
    return "idinformasi";
  }
  return "id";
}

// Fungsi Pencarian Baris dengan ID secara cerdas & Ultra-Presisi (Berdasarkan getDataRange-Values)
function findRowIndexById(sheet, headers, targetId, sheetName) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;
  
  var targetValStr = String(targetId !== undefined && targetId !== null ? targetId : "").trim().toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "");
  if (!targetValStr) return -1;
  
  // 1. Ambil headers dari baris pertama sheet secara riil
  var actualHeaders = data[0];
  var primaryKeyHeaderNorm = getPrimaryKeyHeaderForSheet(sheetName);
  
  // 2. Cari letak kolom ID/Kunci Utama di lembar kerja secara presisi
  var idColumnIdx = -1; 
  
  // Prioritas utama: Cari nama kolom yang 100% cocok dengan primary key yang diharapkan oleh sistem
  for (var i = 0; i < actualHeaders.length; i++) {
    var hNorm = String(actualHeaders[i] || "").trim().toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/[\\s\\-_.]/g, "");
    if (hNorm === primaryKeyHeaderNorm) {
      idColumnIdx = i;
      break;
    }
  }
  
  // Prioritas cadangan: Jika tidak ketemu, cari kolom yang mengandung kata 'id' atau 'nia' (kecuali jika itu 'nia' pada sheet non-keanggotaan)
  if (idColumnIdx === -1) {
    var idColumnsList = ["nia", "idtransaksi", "idprestasi", "idpelanggaran", "idabsensi", "idinformasi", "id", "no", "nik", "nomorinduk", "idanggota"];
    for (var i = 0; i < actualHeaders.length; i++) {
      var hNorm = String(actualHeaders[i] || "").trim().toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/[\\s\\-_.]/g, "");
      if (primaryKeyHeaderNorm !== "nia" && hNorm === "nia") {
        continue; // Lewati 'nia' agar pencarian tidak salah masuk ke kolom NIA anggota pada rincian transaksi
      }
      if (idColumnsList.indexOf(hNorm) !== -1 || hNorm.indexOf("id") !== -1) {
        idColumnIdx = i;
        break;
      }
    }
  }

  // Fallback default: Jika semua pencarian penamaan gagal, default-kan ke kolom pertama (kolom 0)
  if (idColumnIdx === -1) {
    idColumnIdx = 0;
  }
  
  // 3. Bandingkan sel pada kolom Kunci Utama dahulu (Pencarian Utama - Sangat Cepat & Akurat)
  if (idColumnIdx !== -1) {
    for (var r = 1; r < data.length; r++) {
      var rawCell = data[r][idColumnIdx];
      var cellVal = (rawCell !== undefined && rawCell !== null) ? String(rawCell).trim().toLowerCase() : "";
      if (compareValuesForId(cellVal, targetValStr)) {
        return r + 1; // Mengembalikan posisi baris riil di Google Sheets
      }
    }
  }
  
  // 4. Fallback Terakhir: Pindai seluruh tabel di baris mana saja jika mungkin ID-nya tersimpan di kolom lain
  for (var r = 1; r < data.length; r++) {
    var rowData = data[r];
    for (var c = 0; c < rowData.length; c++) {
      var rawCell = rowData[c];
      var cellVal = (rawCell !== undefined && rawCell !== null) ? String(rawCell).trim().toLowerCase() : "";
      if (cellVal && compareValuesForId(cellVal, targetValStr)) {
        return r + 1;
      }
    }
  }
  
  return -1;
}

// Fungsi pembantu pembandingan ID paling toleran & stabil terhadap format numeric/float/string
function compareValuesForId(val1, val2) {
  var v1 = String(val1 !== undefined && val1 !== null ? val1 : "").trim().toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "");
  var v2 = String(val2 !== undefined && val2 !== null ? val2 : "").trim().toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "");
  if (v1 === v2 && v1 !== "") return true;
  
  // Potong akhiran desimal seperti .0 atau .00 yang otomatis ditambahkan Google Spreadsheet pada konversi numeric
  var v1Clean = v1.replace(/\\.0+$/, "");
  var v2Clean = v2.replace(/\\.0+$/, "");
  if (v1Clean === v2Clean && v1Clean !== "") return true;
  
  // Normalisasi karakter spasi/tanda hubung/titik
  var v1Plain = v1Clean.replace(/[\\s\\-_.]/g, "");
  var v2Plain = v2Clean.replace(/[\\s\\-_.]/g, "");
  if (v1Plain === v2Plain && v1Plain !== "") return true;
  
  // Konversi numerik murni
  var n1 = Number(v1Clean);
  var n2 = Number(v2Clean);
  if (!isNaN(n1) && !isNaN(n2) && n1 === n2) return true;
  
  return false;
}

// Bantuan pencarian nilai penyesuai casing spasi dan tanda baca kolom (Serta bridging nama <-> namaLengkap)
function getObjectValueByHeaderName(obj, colHeader) {
  if (!obj) return undefined;
  var cleanHeader = String(colHeader || "").toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/[\\s\\-_.]/g, "");
  
  if (obj[colHeader] !== undefined) return obj[colHeader];
  
  // Bridging nama <-> namaLengkap demi mencegah miss-match data
  if (cleanHeader === "nama" && obj.namaLengkap !== undefined) {
    return obj.namaLengkap;
  }
  if (cleanHeader === "namalengkap" && obj.nama !== undefined) {
    return obj.nama;
  }
  if (cleanHeader === "nama" && obj.NamaLengkap !== undefined) {
    return obj.NamaLengkap;
  }
  if (cleanHeader === "namalengkap" && obj.Nama !== undefined) {
    return obj.Nama;
  }
  
  for (var key in obj) {
    var keyClean = String(key || "").toLowerCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/[\\s\\-_.]/g, "");
    if (keyClean === cleanHeader) {
      return obj[key];
    }
  }
  return undefined;
}

// Kolom standar bawaan untuk masing-masing tabel aplikasi jika tersisip sheet kosong baru (Normalized Case-Insensitive)
function getDefaultHeaders(sheetName) {
  var sName = String(sheetName || "").trim().toUpperCase().replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/[\\s\\-_.]/g, "");
  
  if (sName.indexOf("ANGGOTA") !== -1 || sName.indexOf("MEMBER") !== -1) {
    return ["nia", "namaLengkap", "tempatLahir", "tanggalLahir", "jenisKelamin", "jenjangPendidikan", "namaSekolah", "kelas", "alamat", "noHp", "email", "key", "linkProfile", "status"];
  }
  if (sName.indexOf("PEMBAYARAN") !== -1 || sName.indexOf("TRANSAKSI") !== -1 || sName.indexOf("BAYAR") !== -1) {
    return ["idTransaksi", "tanggal", "nia", "namaLengkap", "namaTagihan", "nominal", "status", "keterangan"];
  }
  if (sName.indexOf("PRESTASI") !== -1) {
    return ["idPrestasi", "tanggal", "nia", "namaLengkap", "jenisPrestasi", "deskripsi", "linkFoto"];
  }
  if (sName.indexOf("PELANGGARAN") !== -1 || sName.indexOf("DISIPLIN") !== -1 || sName.indexOf("SANKSI") !== -1) {
    return ["idPelanggaran", "tanggal", "nia", "nama", "jenisPelanggaran", "namaPelanggaran", "keterangan", "adaDenda", "nominalDenda", "jenisHukuman"];
  }
  if (sName.indexOf("ABSENSI") !== -1 || sName.indexOf("HADIR") !== -1) {
    return ["idAbsensi", "nia", "namaLengkap", "kelas", "tanggalAbsen", "waktuAbsen", "keterangan", "jenisKegiatan"];
  }
  if (sName.indexOf("INFORMASI") !== -1 || sName.indexOf("INFO") !== -1 || sName.indexOf("KABAR") !== -1) {
    return ["idInformasi", "judul", "isi", "jenisKegiatan", "tanggal", "waktu"];
  }
  return ["id"];
}

// Output JSON Berhasil untuk CORS dan Aplikasi
function successResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Output JSON Gagal untuk debugger
function errorResponse(errorMsg) {
  return ContentService.createTextOutput(JSON.stringify({ error: true, message: errorMsg }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
