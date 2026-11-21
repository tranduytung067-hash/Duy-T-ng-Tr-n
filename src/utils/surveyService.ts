import {
  db,
  doc,
  collection,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { fetchWithFallbacks } from './sheetParser';
import { CustomerSurveyRecord, GiftSurveyStatus, SurveyConfig } from '../types';

export const SURVEY_SHEET_TAB_ALIASES = ['Khảo Sát', 'Khao Sat', 'Khảo sát'];

export const SURVEY_APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script - Ghi dữ liệu Khảo Sát Khách Hàng & Upload Ảnh lên Google Drive
 * Sheet mục tiêu: "Khảo Sát" (5 cột: Người Khảo Sát | Mã Khách Hàng | Tên Khách Hàng | Ý Kiến | Ảnh Khảo Sát)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Survey Web App is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Ping test kết nối
    if (data.action === 'ping') {
      var pingSheet = ss.getSheetByName('Khảo Sát');
      return jsonResponse_({
        ok: true,
        sheetName: ss.getName(),
        hasKhaoSatTab: !!pingSheet,
        message: 'Kết nối Google Apps Script thành công!'
      });
    }

    // 2. Xử lý upload ảnh lên Google Drive (nếu có)
    var imageUrl = '';
    if (data.imageBase64 && String(data.imageBase64).length > 10) {
      var mimeType = data.imageMimeType || 'image/jpeg';
      var bytes = Utilities.base64Decode(data.imageBase64);
      var safeCode = String(data.customerCode || 'KH').replace(/[^a-zA-Z0-9_-]/g, '_');
      var fileName = data.imageFileName || ('KhaoSat_' + safeCode + '_' + Date.now() + '.jpg');
      var blob = Utilities.newBlob(bytes, mimeType, fileName);

      var folderName = String(data.driveFolderName || 'Anh_Khao_Sat_KH').trim() || 'Anh_Khao_Sat_KH';
      var folder = getOrCreateFolder_(folderName);
      var file = folder ? folder.createFile(blob) : DriveApp.createFile(blob);

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        // Bỏ qua nếu domain hạn chế chia sẻ công khai, vẫn lưu link Drive
      }
      imageUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    }

    // 3. Ghi dữ liệu vào Tab "Khảo Sát" (5 cột cố định A -> E)
    var sheet = ss.getSheetByName('Khảo Sát');
    if (!sheet) {
      sheet = ss.insertSheet('Khảo Sát');
      sheet.appendRow(['Người Khảo Sát', 'Mã Khách Hàng', 'Tên Khách Hàng', 'Ý Kiến', 'Ảnh Khảo Sát']);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Người Khảo Sát', 'Mã Khách Hàng', 'Tên Khách Hàng', 'Ý Kiến', 'Ảnh Khảo Sát']);
    }

    sheet.appendRow([
      String(data.surveyor || ''),
      String(data.customerCode || ''),
      String(data.customerName || ''),
      String(data.combinedOpinion || ''),
      imageUrl
    ]);

    return jsonResponse_({
      ok: true,
      imageUrl: imageUrl,
      sheetRow: sheet.getLastRow(),
      message: 'Đã lưu khảo sát vào Sheet "Khảo Sát".'
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateFolder_(folderName) {
  try {
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    }
    return DriveApp.createFolder(folderName);
  } catch (e) {
    return null;
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export interface CompressedSurveyImage {
  base64: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  originalKB: number;
  compressedKB: number;
}

/**
 * Compresses an uploaded/captured image on the client via <canvas>:
 * - Max edge: 1024px
 * - Format: JPEG quality 0.72
 */
export async function compressSurveyImage(file: File): Promise<CompressedSurveyImage> {
  const originalKB = Math.max(1, Math.round(file.size / 1024));
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn.'));
      image.src = objectUrl;
    });

    const maxEdge = 1024;
    let targetWidth = img.naturalWidth || img.width || maxEdge;
    let targetHeight = img.naturalHeight || img.height || maxEdge;

    if (targetWidth > maxEdge || targetHeight > maxEdge) {
      const ratio = Math.min(maxEdge / targetWidth, maxEdge / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * ratio));
      targetHeight = Math.max(1, Math.round(targetHeight * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ nén ảnh.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const mimeType = 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, 0.72);
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const compressedBytes = Math.round((base64.length * 3) / 4);
    const compressedKB = Math.max(1, Math.round(compressedBytes / 1024));

    const cleanBaseName = (file.name || 'survey')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    return {
      base64,
      dataUrl,
      mimeType,
      fileName: `${cleanBaseName || 'survey'}_${Date.now()}.jpg`,
      originalKB,
      compressedKB,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function formatSurveyTimestamp(dateInput: Date | string = new Date()): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formats purchase survey decision + optional reason into Column D ("Ý Kiến").
 */
export function formatSurveyOpinion(params: {
  giftStatus: GiftSurveyStatus | string;
  giftName?: string;
  giftQty?: number;
  customerFeedback?: string;
  date?: Date | string;
}): string {
  const ts = formatSurveyTimestamp(params.date || new Date());
  const status = (params.giftStatus || 'Đồng ý mua hàng').trim();
  const reason = (params.customerFeedback || '').trim();

  if (status === 'Chưa đồng ý mua hàng') {
    const text = reason
      ? `[${ts}] Chưa đồng ý mua hàng - Lý do: ${reason}`
      : `[${ts}] Chưa đồng ý mua hàng`;
    return text.slice(0, 1950);
  }

  return `[${ts}] Đồng ý mua hàng`.slice(0, 1950);
}

export function normalizeSurveyCode(code: string | undefined | null): string {
  const raw = String(code || '').trim().toLowerCase();
  if (!raw || raw === 'n/a' || raw === '#n/a' || raw === 'na' || raw === 'null' || raw === 'undefined' || raw === '-') {
    return '';
  }
  return raw.replace(/\s+/g, '');
}

export function normalizeSurveyName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function normalizeSurveyCustomerKey(code: string | undefined | null, name: string | undefined | null): string {
  const normCode = normalizeSurveyCode(code);
  if (normCode) return `code:${normCode}`;
  const normName = normalizeSurveyName(name);
  return normName ? `name:${normName}` : '';
}

/**
 * Finds all survey records matching a customer either by valid customerCode or normalized customerName.
 */
export function findSurveysForCustomer(
  surveys: CustomerSurveyRecord[],
  code: string | undefined | null,
  name: string | undefined | null
): CustomerSurveyRecord[] {
  const targetCode = normalizeSurveyCode(code);
  const targetName = normalizeSurveyName(name);
  if (!targetCode && !targetName) return [];

  const matched = surveys.filter((s) => {
    const recCode = normalizeSurveyCode(s.customerCode);
    if (targetCode && recCode && targetCode === recCode) return true;
    const recName = normalizeSurveyName(s.customerName);
    if (targetName && recName && targetName === recName) return true;
    return false;
  });

  return matched.sort((a, b) => {
    const ta = new Date(a.submittedAt || 0).getTime() || 0;
    const tb = new Date(b.submittedAt || 0).getTime() || 0;
    return tb - ta;
  });
}

/**
 * Converts a Google Drive share URL into a direct thumbnail preview URL for <img> rendering.
 */
export function getDrivePreviewUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w800`;
  }
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1] && trimmed.includes('drive.google.com')) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  }
  return trimmed;
}

function getFieldValue(row: any, colLetter: string, aliases: string[]): string {
  if (!row || typeof row !== 'object') return '';
  if (row[colLetter] !== undefined && row[colLetter] !== null && String(row[colLetter]).trim() !== '') {
    return String(row[colLetter]).trim();
  }
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find((k) => k.toLowerCase().trim().includes(alias));
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

/**
 * Reads existing survey records directly from the Google Sheet tab "Khảo Sát".
 */
export async function fetchKhaoSatSheetRecords(sheetId: string): Promise<CustomerSurveyRecord[]> {
  if (!sheetId) return [];
  try {
    const rows = await fetchWithFallbacks(sheetId, SURVEY_SHEET_TAB_ALIASES, undefined, true);
    if (!rows || rows.length === 0) return [];

    const records: CustomerSurveyRecord[] = [];
    rows.forEach((row, index) => {
      const surveyor = getFieldValue(row, 'A', ['người khảo sát', 'nguoi khao sat']);
      const customerCode = getFieldValue(row, 'B', ['mã khách hàng', 'ma khach hang', 'mã kh', 'ma kh']);
      const customerName = getFieldValue(row, 'C', ['tên khách hàng', 'ten khach hang', 'tên kh', 'khách hàng']);
      const combinedOpinion = getFieldValue(row, 'D', ['ý kiến', 'y kien']);
      const imageUrl = getFieldValue(row, 'E', ['ảnh khảo sát', 'anh khao sat', 'ảnh', 'hình ảnh']);

      if (!customerName && !customerCode) return;

      // Skip repeated header rows if any
      const lowName = customerName.toLowerCase();
      if (lowName === 'tên khách hàng' || lowName === 'ten khach hang') return;

      // Extract optional timestamp & decision status from Column D
      let extractedStatus = 'Đã khảo sát';
      const lowerOp = combinedOpinion.toLowerCase();
      const statusMatch = combinedOpinion.match(/^\[\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\]\s*\[([^\]]+)\]/);
      if (statusMatch && statusMatch[1]) {
        extractedStatus = statusMatch[1].trim();
      } else if (lowerOp.includes('chưa đồng ý mua hàng') || lowerOp.includes('chua dong y mua hang')) {
        extractedStatus = 'Chưa đồng ý mua hàng';
      } else if (lowerOp.includes('đồng ý mua hàng') || lowerOp.includes('dong y mua hang')) {
        extractedStatus = 'Đồng ý mua hàng';
      } else if (lowerOp.includes('chưa tặng')) {
        extractedStatus = 'Chưa tặng / Hẹn lại';
      } else if (lowerOp.includes('không đủ điều kiện')) {
        extractedStatus = 'Không đủ điều kiện';
      } else if (lowerOp.includes('đã tặng')) {
        extractedStatus = 'Đã tặng quà';
      }

      records.push({
        id: `sheet_row_${index}`,
        customerCode: customerCode || 'N/A',
        customerName: customerName || customerCode,
        surveyor: surveyor || 'Từ Google Sheet',
        giftStatus: extractedStatus,
        combinedOpinion,
        imageUrl: imageUrl || '',
        sheetSynced: true,
        submittedAt: '',
        source: 'sheet',
      });
    });

    return records;
  } catch (err) {
    console.warn('Không thể đọc tab Khảo Sát từ Google Sheet:', err);
    return [];
  }
}

export function subscribeSurveyConfig(callback: (config: SurveyConfig | null) => void) {
  const path = 'app_settings/survey_config';
  return onSnapshot(
    doc(db, 'app_settings', 'survey_config'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SurveyConfig;
        callback({
          appsScriptUrl: data.appsScriptUrl || '',
          driveFolderName: data.driveFolderName || 'Anh_Khao_Sat_KH',
          updatedBy: data.updatedBy || '',
          updatedAt: data.updatedAt || '',
        });
      } else {
        callback({ appsScriptUrl: '', driveFolderName: 'Anh_Khao_Sat_KH' });
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function saveSurveyConfig(config: SurveyConfig) {
  const path = 'app_settings/survey_config';
  try {
    await setDoc(
      doc(db, 'app_settings', 'survey_config'),
      {
        appsScriptUrl: (config.appsScriptUrl || '').trim(),
        driveFolderName: (config.driveFolderName || 'Anh_Khao_Sat_KH').trim() || 'Anh_Khao_Sat_KH',
        updatedBy: config.updatedBy || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeCustomerSurveys(callback: (records: CustomerSurveyRecord[]) => void) {
  const path = 'customer_surveys';
  const q = query(collection(db, 'customer_surveys'), orderBy('submittedAt', 'desc'), limit(1500));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CustomerSurveyRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CustomerSurveyRecord;
        list.push({
          ...data,
          id: docSnap.id,
          source: 'firestore',
        });
      });
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

function sanitizeSurveyId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `ks_${Date.now()}`;
}

export async function saveCustomerSurveyToFirestore(record: CustomerSurveyRecord): Promise<void> {
  const safeId = sanitizeSurveyId(record.id);
  const path = `customer_surveys/${safeId}`;
  try {
    const payload: Record<string, any> = {
      id: safeId,
      customerCode: String(record.customerCode || 'N/A').trim().slice(0, 80),
      customerName: String(record.customerName || 'Khách hàng').trim().slice(0, 240),
      surveyor: String(record.surveyor || 'Nhân viên').trim().slice(0, 120),
      giftStatus: String(record.giftStatus || 'Đồng ý mua hàng').trim().slice(0, 80),
      combinedOpinion: String(record.combinedOpinion || '').trim().slice(0, 2000),
      sheetSynced: Boolean(record.sheetSynced),
      submittedAt: String(record.submittedAt || new Date().toISOString()).slice(0, 64),
    };

    if (record.customerEmployee && record.customerEmployee.trim()) {
      payload.customerEmployee = record.customerEmployee.trim().slice(0, 120);
    }
    if (record.giftName && record.giftName.trim()) {
      payload.giftName = record.giftName.trim().slice(0, 200);
    }
    if (typeof record.giftQty === 'number' && !isNaN(record.giftQty)) {
      payload.giftQty = Math.min(9999, Math.max(0, Math.round(record.giftQty)));
    }
    if (record.customerFeedback && record.customerFeedback.trim()) {
      payload.customerFeedback = record.customerFeedback.trim().slice(0, 1500);
    }
    if (record.imageUrl && record.imageUrl.trim()) {
      payload.imageUrl = record.imageUrl.trim().slice(0, 600);
    }

    await setDoc(doc(db, 'customer_surveys', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function testAppsScriptConnection(
  appsScriptUrl: string
): Promise<{ ok: boolean; message?: string; error?: string; sheetName?: string; hasKhaoSatTab?: boolean }> {
  const res = await fetch('/api/survey/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appsScriptUrl: appsScriptUrl.trim() }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Phản hồi máy chủ không hợp lệ.' }));
  return data;
}

export async function submitCustomerSurvey(params: {
  appsScriptUrl: string;
  driveFolderName?: string;
  customerCode: string;
  customerName: string;
  customerEmployee?: string;
  surveyor: string;
  giftStatus: GiftSurveyStatus | string;
  giftName?: string;
  giftQty?: number;
  customerFeedback?: string;
  compressedImage?: CompressedSurveyImage | null;
}): Promise<CustomerSurveyRecord> {
  const nowIso = new Date().toISOString();
  const combinedOpinion = formatSurveyOpinion({
    giftStatus: params.giftStatus,
    giftName: params.giftName,
    giftQty: params.giftQty,
    customerFeedback: params.customerFeedback,
    date: nowIso,
  });

  const payload = {
    surveyor: params.surveyor,
    customerCode: params.customerCode || 'N/A',
    customerName: params.customerName,
    combinedOpinion,
    driveFolderName: params.driveFolderName || 'Anh_Khao_Sat_KH',
    imageBase64: params.compressedImage?.base64 || '',
    imageMimeType: params.compressedImage?.mimeType || 'image/jpeg',
    imageFileName: params.compressedImage?.fileName || '',
  };

  const res = await fetch('/api/survey/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appsScriptUrl: params.appsScriptUrl.trim(),
      payload,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    throw new Error(data?.error || 'Không thể gửi dữ liệu khảo sát vào Google Sheet. Vui lòng thử lại.');
  }

  const rand = Math.random().toString(36).slice(2, 7);
  const record: CustomerSurveyRecord = {
    id: `ks_${Date.now()}_${rand}`,
    customerCode: params.customerCode || 'N/A',
    customerName: params.customerName,
    customerEmployee: params.customerEmployee || '',
    surveyor: params.surveyor,
    giftStatus: params.giftStatus,
    giftName: params.giftName || '',
    giftQty: typeof params.giftQty === 'number' ? params.giftQty : 0,
    customerFeedback: params.customerFeedback || '',
    combinedOpinion,
    imageUrl: data.imageUrl || '',
    sheetSynced: true,
    submittedAt: nowIso,
    source: 'firestore',
  };

  await saveCustomerSurveyToFirestore(record);
  return record;
}
