import React, { useState, useEffect, useRef } from 'react';
import { Search, Bot, User, Send, RefreshCw, Package, Filter, AlertTriangle, CheckCircle2, ChevronRight, Layers, ArrowDownUp, FileSpreadsheet, Box, Gift, Tag, Trophy, Award, BarChart3, HelpCircle, Camera, Copy, Download, Check, Share2, X, Image as ImageIcon, Coins } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { InventoryItem, ThiDuaBlock } from '../types';
import { fetchInventorySheetData, fetchThiDuaSheetData, generateMockThiDuaData } from '../utils/sheetParser';
import { useDialogFocus } from '../utils/useDialogFocus';

interface InventoryLookupProps {
  sheetId: string;
  syncKey?: string | number;
  currentUser?: {
    name?: string;
    role?: string;
    email?: string;
    hoVaTen?: string;
  };
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  matchedItems?: InventoryItem[];
  matchedThiDuaBlocks?: ThiDuaBlock[];
  matchedEmployeeThiDua?: {
    employeeName: string;
    results: { programName: string; range: string; row: Record<string, string> }[];
  };
}

/**
 * Helper to get list of CTKM programs
 */
export const getCTKMList = (item: InventoryItem): { label: string; value: string }[] => {
  const list: { label: string; value: string }[] = [];
  if (item.ctkm1) list.push({ label: 'CTKM 1', value: item.ctkm1 });
  if (item.ctkm2) list.push({ label: 'CTKM 2', value: item.ctkm2 });
  if (item.ctkm3) list.push({ label: 'CTKM 3', value: item.ctkm3 });
  return list;
};

/**
 * Helper to determine stock status:
 * Các sản phẩm chỉ báo hết kho khi hết đồng thời cả đơn vị thùng và đơn vị lẻ
 */
export const getStockStatus = (item: InventoryItem): { label: string; badgeClass: string } => {
  const tonThung = item.tonThung || 0;
  const tonLe = item.tonLe || 0;

  if (tonThung === 0 && tonLe === 0) {
    return { label: 'Hết kho', badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200' };
  }
  if (tonThung > 20) {
    return { label: 'Còn hàng', badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
  }
  return { label: 'Sắp hết', badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200' };
};

/**
 * Formats numeric currency values (VND)
 */
export const formatCurrency = (val?: number): string => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(val)) + ' ₫';
};

/**
 * Removes Vietnamese diacritics/accents for flexible searching
 */
export const removeVietnameseTones = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
};

/**
 * Maps employee Thi Dua row fields directly to exact user requested column definitions
 */
export const getFormattedEmpThiDuaRow = (
  programName: string,
  range: string,
  row: Record<string, string>
): { label: string; col: string; value: string }[] => {
  const pLower = (programName + ' ' + range).toLowerCase();

  if (pLower.includes('bột ngọt') || range.includes('A2:E11')) {
    return [
      { label: 'Tên Nhân Viên', col: 'B', value: row['B'] || row['Tên Nhân Viên'] || row['Nhân Viên'] || '-' },
      { label: 'Số Thùng Đã Bán', col: 'C', value: row['C'] || row['Số Thùng Đã Bán'] || '-' },
      { label: 'Mức Thưởng', col: 'D', value: row['D'] || row['Mức Thưởng'] || '-' },
      { label: 'Tiền Thưởng', col: 'E', value: row['E'] || row['Tiền Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('mcc') || range.includes('G2:N11')) {
    return [
      { label: 'Nhân Viên', col: 'H', value: row['H'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'Bột Nếp (Thùng)', col: 'I', value: row['I'] || row['Bột Nếp'] || '-' },
      { label: 'Bột Gạo (Thùng)', col: 'J', value: row['J'] || row['Bột Gạo'] || '-' },
      { label: 'Chỉ Tiêu MCC (Tấn)', col: 'K', value: row['K'] || row['Chỉ Tiêu MCC'] || '-' },
      { label: 'Thực Hiện (Tấn)', col: 'L', value: row['L'] || row['Thực Hiện'] || '-' },
      { label: '% Hoàn Thành', col: 'M', value: row['M'] || row['% Hoàn Thành'] || '-' },
      { label: 'Thưởng', col: 'N', value: row['N'] || row['Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('gạo') || range.includes('P2:U11')) {
    return [
      { label: 'Nhân Viên', col: 'Q', value: row['Q'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'Chỉ Tiêu', col: 'R', value: row['R'] || row['Chỉ Tiêu'] || '-' },
      { label: 'Thực Hiện', col: 'S', value: row['S'] || row['Thực Hiện'] || '-' },
      { label: 'Hoàn Thành', col: 'T', value: row['T'] || row['Hoàn Thành'] || '-' },
      { label: 'Xét Thưởng', col: 'U', value: row['U'] || row['Xét Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('cao cấp') || range.includes('W2:AC11')) {
    return [
      { label: 'Nhân Viên', col: 'X', value: row['X'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'NRC Lô Hội', col: 'Y', value: row['Y'] || row['NRC Lô Hội'] || '-' },
      { label: 'NRC Bưởi Tây', col: 'Z', value: row['Z'] || row['NRC Bưởi Tây'] || '-' },
      { label: 'Tổng Thùng', col: 'AA', value: row['AA'] || row['Tổng Thùng'] || '-' },
      { label: 'Xét Thưởng', col: 'AB', value: row['AB'] || row['Xét Thưởng'] || '-' },
      { label: 'Thưởng', col: 'AC', value: row['AC'] || row['Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('giặt xả') || range.includes('AE2:AO11')) {
    return [
      { label: 'Nhân Viên', col: 'AF', value: row['AF'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'Nước Xả Vải', col: 'AG', value: row['AG'] || row['Nước Xả Vải'] || '-' },
      { label: 'Nước Giặt 3kg', col: 'AH', value: row['AH'] || row['Nước Giặt 3kg'] || '-' },
      { label: 'Nước Giặt 2.5kg', col: 'AI', value: row['AI'] || row['Nước Giặt 2.5kg'] || '-' },
      { label: 'Nước Giặt 3.2kg, 3.4kg, 9kg', col: 'AJ', value: row['AJ'] || row['Nước Giặt 3.2kg, 3.4kg, 9kg'] || '-' },
      { label: 'Viên Giặt', col: 'AK', value: row['AK'] || row['Viên Giặt'] || '-' },
      { label: 'Bột Giặt QR', col: 'AL', value: row['AL'] || row['Bột Giặt QR'] || '-' },
      { label: 'Tổng Thùng', col: 'AM', value: row['AM'] || row['Tổng Thùng'] || '-' },
      { label: 'Xét Thưởng', col: 'AN', value: row['AN'] || row['Xét Thưởng'] || '-' },
      { label: 'Tiền Thưởng', col: 'AO', value: row['AO'] || row['Tiền Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('quế') || range.includes('AQ2:AV11')) {
    return [
      { label: 'Nhân Viên', col: 'AR', value: row['AR'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'Số Thùng NRC Quế', col: 'AS', value: row['AS'] || row['Số Thùng NRC Quế'] || row['Số Thùng'] || '-' },
      { label: 'Kích Hoạt Khách Hàng', col: 'AT', value: row['AT'] || row['Kích Hoạt Khách Hàng'] || row['Kích Hoạt'] || '-' },
      { label: 'Xét Thưởng', col: 'AU', value: row['AU'] || row['Xét Thưởng'] || '-' },
      { label: 'Tiền Thưởng', col: 'AV', value: row['AV'] || row['Tiền Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('hpc') || range.includes('AX2:BC11')) {
    return [
      { label: 'Nhân Viên', col: 'AX', value: row['AX'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'Chỉ Tiêu', col: 'AY', value: row['AY'] || row['Chỉ Tiêu'] || '-' },
      { label: 'Thực Hiện', col: 'AZ', value: row['AZ'] || row['Thực Hiện'] || '-' },
      { label: '% Hoàn Thành', col: 'BA', value: row['BA'] || row['% Hoàn Thành'] || '-' },
      { label: 'Xét Thưởng', col: 'BB', value: row['BB'] || row['Xét Thưởng'] || '-' },
      { label: 'Tiền Thưởng', col: 'BC', value: row['BC'] || row['Tiền Thưởng'] || '-' },
    ];
  }

  if (pLower.includes('meizan') || pLower.includes('bột mì') || range.includes('BE2:BI11')) {
    const rawBF = row['BF'] || row['Chỉ Tiêu'] || row['Số Chỉ Tiêu'] || row['Số Thùng'] || '-';
    const rawBG = row['BG'] || row['Thực Hiện'] || row['Số Thực Hiện'] || row['KH Kích Hoạt'] || '-';
    const numBF = parseFloat(String(rawBF).replace(/,/g, '')) || 0;
    const numBG = parseFloat(String(rawBG).replace(/,/g, '')) || 0;
    const pct = numBF > 0 ? ((numBG / numBF) * 100).toFixed(1) + '%' : (row['% Hoàn Thành'] || '-');

    return [
      { label: 'Nhân Viên', col: 'BE', value: row['BE'] || row['Nhân Viên'] || row['Tên Nhân Viên'] || '-' },
      { label: 'Chỉ Tiêu', col: 'BF', value: rawBF },
      { label: 'Thực Hiện', col: 'BG', value: rawBG },
      { label: '% Hoàn Thành', col: 'PCT', value: pct },
      { label: 'Xét Thưởng', col: 'BH', value: row['BH'] || row['Xét Thưởng'] || '-' },
      { label: 'Tiền Thưởng', col: 'BI', value: row['BI'] || row['Tiền Thưởng'] || '-' },
    ];
  }

  return Object.entries(row)
    .filter(([k]) => k.length > 2)
    .map(([k, v]) => ({ label: k, col: '', value: v || '-' }));
};

/**
 * Removes common conversational filler phrases to leave the core product search term.
 */
export const stripConversationalFillers = (query: string): string => {
  let q = query.trim();
  const fillers = [
    /\b(cho\s+tôi\s+xem|cho\s+em\s+xem|cho\s+mình\s+xem|cho\s+hoi|cho\s+hỏi|xem\s+giúp|xem\s+giup)\b/gi,
    /\b(xem\s+tồn\s+kho|xem\s+ton\s+kho|kiểm\s+tra|kiem\s+tra|tra\s+cứu|tra\s+cuu|tìm\s+kiếm|tim\s+kiem|tìm\s+giúp|tim\s+giup)\b/gi,
    /\b(thông\s+tin|thong\s+tin|tồn\s+kho\s+của|ton\s+kho\s+cua|tồn\s+kho|ton\s+kho|mặt\s+hàng|mat\s+hang|sản\s+phẩm|san\s+pham|mã\s+hàng|ma\s+hang|mã|ma)\b/gi,
    /\b(còn\s+bao\s+nhiêu|con\s+bao\s+nhieu|bao\s+nhiêu|bao\s+nhieu|thế\s+nào|the\s+nao|như\s+thế\s+nào|nhu\s+the\s+nao)\b/gi,
    /\b(giúp\s+tôi|giup\s+toi|với|voi|được\s+không|duoc\s+khong|nhé|nhe|ạ|a)\b/gi
  ];

  fillers.forEach(rgx => {
    q = q.replace(rgx, ' ');
  });

  return q.replace(/\s+/g, ' ').trim();
};

/**
 * Normalizes number + unit patterns (e.g. "100 g" -> "100g", "1 l" -> "1l", "500 ml" -> "500ml")
 */
const normalizeUnitSpaces = (str: string): string => {
  return str.replace(/(\d+)\s+(g|kg|ml|l|thùng|thung|tui|túi|chai|lon|gói|goi|bao|can)\b/gi, '$1$2');
};

/**
 * Checks if a single search token matches any word in the product's code or name or CTKM.
 */
const matchesToken = (
  token: string,
  wordsAccented: string[],
  wordsUnaccented: string[]
): boolean => {
  const tokenLower = token.toLowerCase();
  const tokenNorm = removeVietnameseTones(tokenLower);
  const hasAccents = tokenLower !== tokenNorm;

  for (let i = 0; i < wordsAccented.length; i++) {
    const wAcc = wordsAccented[i];
    const wNorm = wordsUnaccented[i];

    if (hasAccents) {
      // Token has Vietnamese diacritics (e.g. "ngũ", "vị", "nành", "gạo")
      if (wAcc === tokenLower) return true;
      if (wAcc.startsWith(tokenLower)) return true;
      if (tokenLower.length >= 3 && wAcc.includes(tokenLower)) return true;
    } else {
      // Token is unaccented (e.g. "ngu", "vi", "meizan", "584", "10021")
      // 1. Exact match against unaccented word (e.g. "ngu" === "ngu", "vi" === "vi")
      if (wNorm === tokenNorm) return true;

      // 2. Prefix match for longer tokens (e.g. "meiz" -> "meizan", "1002" -> "10021")
      if (tokenNorm.length >= 4 && wNorm.startsWith(tokenNorm)) return true;

      // 3. Code/numeric tokens: if token is numeric and word equals or contains the code
      if (/^\d+$/.test(tokenNorm) && wNorm.includes(tokenNorm)) return true;
    }
  }

  return false;
};

/**
 * Helper to identify if an item is a promotional product (KM / Khuyến mãi / quà tặng / SPKM).
 */
export const isPromotionalItem = (item: InventoryItem): boolean => {
  if (!item || !item.tenSanPham) return false;
  const normName = removeVietnameseTones(item.tenSanPham.toLowerCase().trim());
  return (
    normName.includes('(km)') ||
    normName.includes('- km') ||
    normName.includes('hang km') ||
    normName.includes('spkm') ||
    normName.includes('khuyen mai') ||
    normName.includes('qua tang') ||
    normName.includes('hang tang') ||
    normName.startsWith('km ') ||
    normName.startsWith('km-') ||
    normName.endsWith(' km')
  );
};

/**
 * Smart multi-keyword match function for inventory items:
 * Searches strictly within Product Name (tenSanPham) and Product Code (maCDS).
 * Excludes promotional products (sản phẩm khuyến / KM) and CTKM text matching.
 */
export const matchInventoryQuery = (item: InventoryItem, query: string): boolean => {
  if (!query) return false;

  // Do not search promotional products (Ko tìm sản phẩm khuyến)
  if (isPromotionalItem(item)) return false;

  const cleanRawQuery = query.trim().toLowerCase();
  if (!cleanRawQuery) return false;

  // Clean conversational noise ("cho tôi xem tồn kho dầu meizan" -> "dầu meizan")
  const strippedQuery = stripConversationalFillers(cleanRawQuery);
  const effectiveQuery = strippedQuery.length > 0 ? strippedQuery : cleanRawQuery;

  // Only search in Product Name (tenSanPham) and Product Code (maCDS), NOT in CTKM columns
  const rawItemText = `${item.maCDS || ''} ${item.tenSanPham || ''}`.toLowerCase();
  const normalizedItemText = removeVietnameseTones(rawItemText);
  const queryNorm = removeVietnameseTones(effectiveQuery);

  // 1. Exact phrase substring match (accented or unaccented)
  if (rawItemText.includes(effectiveQuery) || normalizedItemText.includes(queryNorm)) {
    return true;
  }

  // 2. Unit/code space-normalized match (e.g. "100 g" vs "100g", "1 l" vs "1l")
  const normItemWithUnits = normalizeUnitSpaces(normalizedItemText);
  const normQueryWithUnits = normalizeUnitSpaces(queryNorm);
  if (normQueryWithUnits.length > 0 && normItemWithUnits.includes(normQueryWithUnits)) {
    return true;
  }

  // 3. Multi-token word-level matching
  const tokens = queryNorm.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  const wordsAccented = rawItemText.split(/[\s\/\-_,\.\(\)\+]+/).filter(Boolean);
  const wordsUnaccented = normalizedItemText.split(/[\s\/\-_,\.\(\)\+]+/).filter(Boolean);

  return tokens.every(token => matchesToken(token, wordsAccented, wordsUnaccented));
};

export default function InventoryLookup({ sheetId, syncKey, currentUser }: InventoryLookupProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [thiDuaBlocks, setThiDuaBlocks] = useState<ThiDuaBlock[]>([]);
  const [selectedThiDuaIdx, setSelectedThiDuaIdx] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'chat' | 'table'>('chat');

  // Helper to generate personalized welcome greeting based on role/user
  const getWelcomeText = (user?: { name?: string; role?: string; email?: string; hoVaTen?: string }) => {
    const name = (user?.hoVaTen || user?.name || '').toLowerCase();
    const role = (user?.role || '').toLowerCase();
    const email = (user?.email || '').toLowerCase();

    const isTung = email.includes('tungluu1992ab') || 
                   name.includes('tùng') || 
                   name.includes('tung') ||
                   ((role === 'manager' || role === 'supervisor' || role === 'mkt sup' || role.includes('giám sát') || role.includes('giam sat')) && 
                    (name.includes('tùng') || name.includes('tung') || email.includes('tung')));

    if (isTung) {
      return 'Xin chào anh Tùng, Tôi là Trợ Lý Tra Cứu Tồn Kho. Bạn có thể tra cứu tồn kho sản phẩm, số lượng thùng/lẻ, đơn giá (vd: "Meizan Nành", "Mã 10021", "Gạo ST25", "Tồn kho thấp", "Sản phẩm hết hàng"...)!';
    }

    const employeeGreetings = [
      'Xin chào Lục Bình, ở đây chỉ có thể hỏi đáp về thông tin tồn kho sản phẩm, không phải chỗ đưa lí do đâu nhé !',
      'Xin chào con vợ, anh có thể giúp gì nào ?',
      'Hỏi gì thì hỏi đi, không mất tiền đâu !',
      'Lại là Lục Bình à? Tra tồn kho xong thì nhớ lo đi chốt đơn nhanh lên nhé !',
      'Alo alo Lục Bình nghe rõ trả lời! Hôm nay định "oanh tạc" mã hàng nào đây ?',
      'Chào chiến thần chốt đơn! Cần check kho món gì để quét sạch hàng hôm nay nào ?',
      'Có kho đây rồi, hỏi nhanh đáp gọn để còn ra thị trường chiến tiếp nào !',
      'Xin chào Lục Bình, kho còn đầy hàng nhưng không có sẵn lý do bào chữa đâu nha !'
    ];

    const randomIndex = Math.floor(Math.random() * employeeGreetings.length);
    return employeeGreetings[randomIndex];
  };

  // Image Cropping & Clipboard state
  const [croppedModal, setCroppedModal] = useState<{
    isOpen: boolean;
    dataUrl: string;
    title: string;
    range: string;
  } | null>(null);
  const croppedModalRef = useRef<HTMLDivElement>(null);
  useDialogFocus(!!(croppedModal && croppedModal.isOpen), croppedModalRef, () => setCroppedModal(null));

  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopyImageDirectly = async (elementId: string, title: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      showToast('Không tìm thấy vùng dữ liệu để cắt.');
      return;
    }
    setIsCapturing(true);
    try {
      const blob = await toBlob(el, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast(`Đã sao chép ảnh "${title}" vào Clipboard. Nhấn Ctrl+V để gửi.`);
      } else {
        showToast('Không thể tạo ảnh từ vùng này.');
      }
    } catch (err) {
      console.warn('Lỗi copy clipboard trực tiếp:', err);
      handleCropAndOpenModal(elementId, title, '');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCropAndOpenModal = async (elementId: string, title: string, range: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      showToast('Không tìm thấy vùng dữ liệu để cắt.');
      return;
    }
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      setCroppedModal({
        isOpen: true,
        dataUrl,
        title,
        range,
      });
    } catch (err) {
      console.error('Lỗi cắt ảnh:', err);
      showToast('Có lỗi xảy ra khi cắt ảnh.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopyFromDataUrl = async (dataUrl: string, title: string) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast(`Đã sao chép ảnh "${title}" vào Clipboard. Nhấn Ctrl+V để gửi.`);
    } catch (err) {
      console.error('Lỗi copy modal:', err);
      showToast('Không thể sao chép trực tiếp. Hãy bấm Tải Ảnh Về.');
    }
  };

  const handleDownloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    showToast(`Đã tải ảnh "${filename}" về máy`);
  };

  // Chatbot conversation history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: getWelcomeText(currentUser),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Synchronize welcome message when currentUser changes
  useEffect(() => {
    const welcomeText = getWelcomeText(currentUser);
    setMessages(prev => {
      const exists = prev.some(m => m.id === 'welcome');
      if (!exists) {
        return [
          {
            id: 'welcome',
            sender: 'bot',
            text: welcomeText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ];
      }
      return prev.map(m => m.id === 'welcome' ? { ...m, text: welcomeText } : m);
    });
  }, [currentUser]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Default fallback mock data if Google Sheet tab "Tồn Kho" is not available or empty
  const mockInventory: InventoryItem[] = [
    { maCDS: '10021', tenSanPham: 'Gạo ST25 Lúa Tôm Thượng Hạng 5kg', tonThung: 145, tonLe: 12, donGiaThung: 420000, donGiaLe: 88000, ctkm1: 'Mua 10 thùng tặng 1 túi 1kg', ctkm2: 'Chiết khấu 3%', colI: '145', colJ: '12', colL: '420000', colM: '88000', colN: 'Mua 10 thùng tặng 1 túi 1kg', colO: 'Chiết khấu 3%' },
    { maCDS: '10022', tenSanPham: 'Nước Mắm 584 Nha Trang 30N 500ml', tonThung: 82, tonLe: 6, donGiaThung: 360000, donGiaLe: 32000, ctkm1: 'Tặng 1 chai lẻ 250ml khi mua 5 thùng', colI: '82', colJ: '6', colL: '360000', colM: '32000', colN: 'Tặng 1 chai lẻ 250ml khi mua 5 thùng' },
    { maCDS: '10023', tenSanPham: 'DẦU ĐẬU NÀNH NHÃN HIỆU MEIZAN 1L', tonThung: 210, tonLe: 0, donGiaThung: 540000, donGiaLe: 46000, ctkm1: 'Giảm 20k/thùng', ctkm2: 'Tặng 1 chai Dầu Meizan Gold 1L', colI: '210', colJ: '0', colL: '540000', colM: '46000', colN: 'Giảm 20k/thùng', colO: 'Tặng 1 chai Dầu Meizan Gold 1L' },
    { maCDS: '10024', tenSanPham: 'DẦU ĐẬU NÀNH NHÃN HIỆU MEIZAN 5L', tonThung: 5, tonLe: 2, donGiaThung: 850000, donGiaLe: 215000, ctkm1: 'Tặng kèm 1 ca đong 500ml', colI: '5', colJ: '2', colL: '850000', colM: '215000', colN: 'Tặng kèm 1 ca đong 500ml' },
    { maCDS: '10025', tenSanPham: 'DẦU ĂN THƯỢNG HẠNG MEIZAN GOLD 1L', tonThung: 0, tonLe: 0, donGiaThung: 510000, donGiaLe: 44000, ctkm1: 'Tặng 1 tô sứ cao cấp', colI: '0', colJ: '0', colL: '510000', colM: '44000', colN: 'Tặng 1 tô sứ cao cấp' },
    { maCDS: '10026', tenSanPham: 'Hạt Nêm VFM Nấm Hương 400g', tonThung: 45, tonLe: 18, donGiaThung: 620000, donGiaLe: 28000, ctkm1: 'Mua 3 thùng tặng 1 hũ nêm 200g', colI: '45', colJ: '18', colL: '620000', colM: '28000', colN: 'Mua 3 thùng tặng 1 hũ nêm 200g' },
    { maCDS: '10027', tenSanPham: 'Đường Tinh Luyện CLF Cao Cấp 1kg', tonThung: 0, tonLe: 12, donGiaThung: 480000, donGiaLe: 25000, colI: '0', colJ: '12', colL: '480000', colM: '25000' },
    { maCDS: '10028', tenSanPham: 'Bánh Quy Bơ Thượng Hạng MCC 350g', tonThung: 0, tonLe: 0, donGiaThung: 720000, donGiaLe: 65000, ctkm1: 'Giảm 5% đơn từ 10 thùng', colI: '0', colJ: '0', colL: '720000', colM: '65000', colN: 'Giảm 5% đơn từ 10 thùng' },
    { maCDS: '10029', tenSanPham: 'Sữa Chua Uống NDFC Vị Dâu 110ml', tonThung: 320, tonLe: 24, donGiaThung: 310000, donGiaLe: 7500, ctkm1: 'Mua 2 lốc tặng 1 bình nước', colI: '320', colJ: '24', colL: '310000', colM: '7500', colN: 'Mua 2 lốc tặng 1 bình nước' },
    { maCDS: '584NT', tenSanPham: 'Thùng Nước Mắm 584 Nha Trang 40N', tonThung: 50, tonLe: 0, donGiaThung: 980000, donGiaLe: 85000, ctkm1: 'Tặng 1 chai 40N khi mua 3 thùng', colI: '50', colJ: '0', colL: '980000', colM: '85000', colN: 'Tặng 1 chai 40N khi mua 3 thùng' }
  ];

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Inventory Sheet Data
      const invData = await fetchInventorySheetData(sheetId);
      if (invData && invData.length > 0) {
        setItems(invData);
      } else {
        setItems(mockInventory);
      }

      // 2. Fetch Thi Dua Sheet Data
      const thiDuaRes = await fetchThiDuaSheetData(sheetId);
      if (thiDuaRes && thiDuaRes.length > 0) {
        setThiDuaBlocks(thiDuaRes);
      } else {
        setThiDuaBlocks(generateMockThiDuaData());
      }
    } catch (err: any) {
      console.warn('Lỗi tải dữ liệu Sheet, sử dụng dữ liệu mẫu:', err);
      setError('Chưa kết nối Sheet Tồn Kho/Thi Đua. Hệ thống đang hiển thị dữ liệu mẫu.');
      setItems(mockInventory);
      setThiDuaBlocks(generateMockThiDuaData());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sheetId, syncKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle bot answer logic
  const handleSendMessage = (customQuery?: string) => {
    const query = (customQuery || inputQuery).trim();
    if (!query) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: userTime
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customQuery) setInputQuery('');

    const rawClean = query.trim().toLowerCase();
    const normalizedClean = removeVietnameseTones(rawClean);

    // INVENTORY SEARCH
    let matches: InventoryItem[] = [];
    let isSpecialQuery: 'all' | 'out' | 'low' | 'issue' | 'ctkm' | 'none' = 'none';

    const isOut = normalizedClean.includes('het hang') || normalizedClean.includes('het ton kho') || normalizedClean.includes('ton kho 0') || normalizedClean.includes('bang 0') || normalizedClean.includes('het kho') || normalizedClean.includes('mat hang het');
    const isLow = normalizedClean.includes('sap het') || normalizedClean.includes('duoi 10') || normalizedClean.includes('ton kho thap') || normalizedClean.includes('thap') || normalizedClean.includes('canh bao') || normalizedClean.includes('nguy co') || normalizedClean.includes('can nhap');
    const isAll = normalizedClean.includes('tat ca') || normalizedClean.includes('danh sach');
    const isPromo = normalizedClean.includes('khuyen mai') || normalizedClean.includes('ctkm') || normalizedClean.includes('qua tang') || normalizedClean.includes('uu dai') || normalizedClean.includes('tang kem');

    if (isAll) {
      matches = items.filter(i => !isPromotionalItem(i)).slice(0, 15);
      isSpecialQuery = 'all';
    } else if (isOut && !isLow) {
      matches = items.filter(i => !isPromotionalItem(i) && i.tonThung === 0 && i.tonLe === 0);
      isSpecialQuery = 'out';
    } else if (isLow && !isOut) {
      matches = items.filter(i => !isPromotionalItem(i) && i.tonThung <= 10 && (i.tonThung > 0 || i.tonLe > 0));
      isSpecialQuery = 'low';
    } else if (isOut || isLow || normalizedClean.includes('van de') || normalizedClean.includes('su co') || normalizedClean.includes('tong hop')) {
      matches = items.filter(i => !isPromotionalItem(i) && i.tonThung <= 10);
      isSpecialQuery = 'issue';
    } else if (isPromo && !stripConversationalFillers(query)) {
      matches = items.filter(i => !isPromotionalItem(i) && !!(i.ctkm1 || i.ctkm2 || i.ctkm3));
      isSpecialQuery = 'ctkm';
    } else {
      // General code or name search using smart multi-keyword matching in tenSanPham
      matches = items.filter(item => matchInventoryQuery(item, query));

      // Smart Fallback if 0 matches found: try matching any significant token ONLY in tenSanPham
      if (matches.length === 0) {
        const coreTerm = stripConversationalFillers(query) || query;
        const tokens = removeVietnameseTones(coreTerm)
          .split(/\s+/)
          .filter(t => t.length >= 3 || /^\d+$/.test(t));

        if (tokens.length > 0) {
          matches = items.filter(item => {
            if (isPromotionalItem(item)) return false;
            const rawText = removeVietnameseTones(`${item.maCDS || ''} ${item.tenSanPham || ''}`);
            return tokens.some(t => rawText.includes(t));
          }).slice(0, 10);
        }
      }
    }

    setTimeout(() => {
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let responseText = '';

      if (isSpecialQuery === 'out') {
        responseText = `**BÁO CÁO CÁC SẢN PHẨM HẾT TỒN KHO**:\nTìm thấy **${matches.length}** sản phẩm hiện tại đã HẾT HÀNG hoàn toàn. Đề xuất đặt hàng ngay:`;
      } else if (isSpecialQuery === 'low') {
        responseText = `**BÁO CÁO CÁC SẢN PHẨM TỒN KHO THẤP**:\nTìm thấy **${matches.length}** sản phẩm thuộc ngưỡng tồn kho thấp (≤10 Thùng). Bạn nên xem xét lên kế hoạch nhập hàng bổ sung:`;
      } else if (isSpecialQuery === 'issue') {
        responseText = `**TỔNG HỢP VẤN ĐỀ TỒN KHO (HẾT KHO & TỒN THẤP)**:\nTìm thấy **${matches.length}** sản phẩm cần lưu ý (≤10 Thùng hoặc đã Hết Hàng). Chi tiết danh sách bên dưới:`;
      } else if (isSpecialQuery === 'ctkm') {
        responseText = `**DANH SÁCH SẢN PHẨM CÓ CHƯƠNG TRÌNH KHUYẾN MÃI (CTKM)**:\nTìm thấy **${matches.length}** sản phẩm hiện đang có quà tặng / chiết khấu khuyến mãi đi kèm:`;
      } else if (matches.length === 1) {
        const item = matches[0];
        const ctkmList = getCTKMList(item);
        const ctkmText = ctkmList.length > 0
          ? `\n• **Chương Trình Khuyến Mãi (CTKM)**:\n` + ctkmList.map(c => `  - ${c.label}: ${c.value}`).join('\n')
          : '';
        responseText = `Đã tìm thấy thông tin sản phẩm cho mã **${item.maCDS}**:\n• **Tên sản phẩm**: ${item.tenSanPham}\n• **Tồn Thùng**: ${item.tonThung.toLocaleString()} Thùng (Giá: ${formatCurrency(item.donGiaThung)})\n• **Tồn Lẻ**: ${item.tonLe.toLocaleString()} Lẻ (Giá: ${formatCurrency(item.donGiaLe)})${ctkmText}`;
      } else if (matches.length > 1) {
        responseText = `Tìm thấy **${matches.length}** sản phẩm phù hợp với từ khóa "${query}". Chi tiết Thùng & Lẻ bên dưới:`;
      } else {
        responseText = `Không tìm thấy sản phẩm phù hợp với từ khóa "${query}".\nGợi ý: Bạn có thể thử tìm theo tên sản phẩm (vd: "Meizan Nành", "Gạo ST25"), mã sản phẩm (vd: "10021"), hoặc từ khóa "Tồn kho thấp".`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: responseText,
        timestamp: botTime,
        matchedItems: matches.length > 0 ? matches : undefined
      };

      setMessages(prev => [...prev, botMsg]);
    }, 300);
  };

  // Filtered list for Table view
  const filteredTableItems = items.filter(item => {
    return !tableSearch.trim() || matchInventoryQuery(item, tableSearch);
  });

  const totalThung = items.reduce((sum, item) => sum + item.tonThung, 0);
  const totalLe = items.reduce((sum, item) => sum + item.tonLe, 0);
  const totalInventoryValue = items.reduce(
    (sum, item) => sum + (item.tonThung * (item.donGiaThung || 0)) + (item.tonLe * (item.donGiaLe || 0)),
    0
  );

  const activeThiDuaBlock = thiDuaBlocks[selectedThiDuaIdx] || thiDuaBlocks[0];

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* HEADER BANNER */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 text-slate-800 shadow-xs border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-xl font-extrabold tracking-tight text-slate-900 truncate">
                Tra Cứu Tồn Kho Sản Phẩm
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-700 font-semibold">
                Dữ liệu trực tuyến
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            title="Tải lại Sheet Tồn Kho"
            className="sm:hidden w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-teal-600 rounded-xl transition-all border border-slate-200 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            title="Tải lại Sheet Tồn Kho"
            className="hidden sm:flex p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-teal-600 rounded-xl transition-all border border-slate-200 active:scale-95 cursor-pointer disabled:opacity-50 items-center justify-center shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 grid grid-cols-2 sm:flex items-center text-xs font-semibold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('chat')}
              className={`h-9 sm:h-auto px-3 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                viewMode === 'chat'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span>Chatbot AI</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`h-9 sm:h-auto px-3 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white text-teal-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Bảng Tồn Kho ({items.length})</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{error}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Hệ thống tự động sử dụng danh sách sản phẩm mẫu để Chatbot tiếp tục phản hồi mượt mà.
            </p>
          </div>
        </div>
      )}

      {/* QUICK SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Tổng SKU Tồn</p>
            <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5 font-tabular">{items.length}</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-teal-50 rounded-lg text-teal-600 shrink-0">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Tổng Thùng</p>
            <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5 font-tabular">{totalThung.toLocaleString()}</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <Box className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Tổng Lẻ</p>
            <p className="text-base sm:text-lg font-black text-sky-700 mt-0.5 font-tabular">{totalLe.toLocaleString()}</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-sky-50 rounded-lg text-sky-600 shrink-0">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Giá Trị Tồn</p>
            <p className="text-sm sm:text-lg font-black text-amber-700 mt-0.5 font-tabular truncate">{formatCurrency(totalInventoryValue)}</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* CHATBOT VIEW */}
      {viewMode === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[calc(100dvh-280px)] min-h-[380px] sm:h-[600px]">
          {/* CHATBOT HEADER */}
          <div className="p-3.5 sm:p-4 bg-white text-slate-900 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  Tra Cứu Tồn Kho & Thi Đua
                </h3>
              </div>
            </div>
          </div>

          {/* CHAT MESSAGES BODY */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[90%] sm:max-w-[80%] space-y-2`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-teal-700 text-white rounded-tr-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-line font-sans">{msg.text}</div>

                    {/* Matched Inventory Result Cards */}
                    {msg.matchedItems && msg.matchedItems.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                        {msg.matchedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-slate-800 hover:border-teal-500 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="inline-block px-2 py-0.5 bg-teal-100 text-teal-800 font-mono font-bold text-[10px] rounded border border-teal-200">
                                Mã CDS: {item.maCDS}
                              </span>
                              {(() => {
                                const status = getStockStatus(item);
                                return (
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${status.badgeClass}`}>
                                    {status.label}
                                  </span>
                                );
                              })()}
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 mt-1.5 leading-snug">
                              {item.tenSanPham}
                            </h4>

                            {getCTKMList(item).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {getCTKMList(item).map((c, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded text-[10px] font-medium"
                                  >
                                    <Gift className="w-2.5 h-2.5 shrink-0 text-rose-500" />
                                    <span><strong>{c.label}:</strong> {c.value}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/60">
                              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                                <span className="text-[10px] text-slate-500 font-bold block">Tồn kho Thùng:</span>
                                <span className="text-xs font-extrabold text-emerald-700">{item.tonThung.toLocaleString()} thùng</span>
                                <span className="text-[10px] text-slate-600 block mt-0.5">Giá: <strong className="text-amber-700">{formatCurrency(item.donGiaThung)}</strong></span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                                <span className="text-[10px] text-slate-500 font-bold block">Tồn kho Lẻ:</span>
                                <span className="text-xs font-extrabold text-sky-700">{item.tonLe.toLocaleString()} lẻ</span>
                                <span className="text-[10px] text-slate-600 block mt-0.5">Giá: <strong className="text-indigo-700">{formatCurrency(item.donGiaLe)}</strong></span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Matched Thi Dua Program Blocks */}
                    {msg.matchedThiDuaBlocks && msg.matchedThiDuaBlocks.length > 0 && (
                      <div className="mt-3 space-y-3 pt-2 border-t border-slate-200/80">
                        {msg.matchedThiDuaBlocks.map((blk, bIdx) => {
                          const captureId = `chat-thidua-block-${msg.id}-${bIdx}`;
                          return (
                            <div key={bIdx} id={captureId} className="bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-3.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                                <span className="font-extrabold text-emerald-800 text-xs flex items-center gap-1.5">
                                  <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  {blk.programName}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 bg-white text-slate-600 font-mono text-[10px] rounded border border-slate-200">
                                    Range: {blk.range}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyImageDirectly(captureId, `${blk.programName} (${blk.range})`)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Sao chép ảnh trực tiếp vào Clipboard"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copy ảnh</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCropAndOpenModal(captureId, blk.programName, blk.range)}
                                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Xem & Cắt ảnh phạm vi chỉ định"
                                  >
                                    <Camera className="w-3 h-3 text-emerald-600" />
                                    <span>Cắt ảnh {blk.range}</span>
                                  </button>
                                </div>
                              </div>

                              <div className="overflow-x-auto mt-2">
                                <table className="w-full text-[11px] text-left">
                                  <thead>
                                    <tr className="text-slate-600 border-b border-slate-200 font-bold">
                                      {blk.headers.slice(0, 5).map((h, hIdx) => (
                                        <th key={hIdx} className="py-1 px-1.5 whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {blk.rows.slice(0, 6).map((r, rIdx) => (
                                      <tr key={rIdx} className="hover:bg-white">
                                        {blk.headers.slice(0, 5).map((h, hIdx) => (
                                          <td key={hIdx} className="py-1.5 px-1.5 font-medium text-slate-800 whitespace-nowrap">
                                            {r[h] || r[Object.keys(r)[hIdx]] || '-'}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Matched Employee Thi Dua Result */}
                    {msg.matchedEmployeeThiDua && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-slate-200">
                        {msg.matchedEmployeeThiDua.results.map((res, rIdx) => {
                          const empCaptureId = `chat-emp-result-${msg.id}-${rIdx}`;
                          return (
                            <div key={rIdx} id={empCaptureId} className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-slate-800 shadow-2xs">
                              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 border-b border-amber-200/60 pb-1.5 mb-2">
                                <span className="flex items-center gap-1.5">
                                  <span className="font-black text-amber-600 tracking-tighter text-xs leading-none">$$$</span>
                                  {res.programName}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300/60">
                                    {res.range}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyImageDirectly(empCaptureId, `Thi đua - ${res.programName}`)}
                                    className="px-1.5 py-0.5 bg-amber-200/80 hover:bg-amber-300 text-amber-950 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>Copy ảnh</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCropAndOpenModal(empCaptureId, res.programName, res.range)}
                                    className="px-1.5 py-0.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-amber-600" />
                                    <span>Cắt ảnh</span>
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                                {getFormattedEmpThiDuaRow(res.programName, res.range, res.row).map((f, fIdx) => (
                                  <div key={fIdx} className="bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs">
                                    <span className="text-[10px] text-slate-500 font-semibold block">{f.label} {f.col ? `(${f.col})` : ''}:</span>
                                    <span className="font-extrabold text-slate-900 text-xs">{f.value || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={`text-[9px] mt-1 text-right ${msg.sender === 'user' ? 'text-teal-200' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* SUGGESTION CHIPS BAR */}
          <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0 px-1">Gợi ý:</span>
            <button
              type="button"
              onClick={() => handleSendMessage('Meizan Nành')}
              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
            >
              Meizan Nành
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('ST25')}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
            >
              Gạo ST25
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('10021')}
              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
            >
              Mã 10021
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Tồn kho thấp')}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
            >
              Tồn kho thấp
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Hết hàng')}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
            >
              Sản phẩm hết hàng
            </button>
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Nhập Mã CDS, Tên SP, 'Meizan Nành', '10021', 'Tồn kho thấp'..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Gửi</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* DATA TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm nhanh Mã CDS hoặc Tên sản phẩm trong Bảng..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-slate-700 text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-4 text-center">Mã CDS</th>
                  <th className="py-3 px-4">Tên Sản Phẩm</th>
                  <th className="py-3 px-4 text-center">Tồn Thùng</th>
                  <th className="py-3 px-4 text-center">Tồn Lẻ</th>
                  <th className="py-3 px-4 text-right">Đơn Giá Thùng</th>
                  <th className="py-3 px-4 text-right">Đơn Giá Lẻ</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredTableItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      Không tìm thấy dữ liệu tồn kho thỏa mãn điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredTableItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-teal-800 bg-teal-50/50">
                        {item.maCDS}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div>{item.tenSanPham}</div>
                        {getCTKMList(item).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 font-normal">
                            {getCTKMList(item).map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded text-[10px] font-medium"
                              >
                                <Gift className="w-2.5 h-2.5 shrink-0 text-rose-500" />
                                <span><strong>{c.label}:</strong> {c.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-emerald-700 bg-emerald-50/30">
                        {item.tonThung.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">thùng</span>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-sky-700 bg-sky-50/30">
                        {item.tonLe.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">lẻ</span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-amber-700 bg-amber-50/20">
                        {formatCurrency(item.donGiaThung)}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-indigo-700 bg-indigo-50/20">
                        {formatCurrency(item.donGiaLe)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(() => {
                          const status = getStockStatus(item);
                          return (
                            <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold rounded-full ${status.badgeClass}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CROPPED IMAGE MODAL */}
      {croppedModal && croppedModal.isOpen && (
        <div className="app-modal-overlay fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            ref={croppedModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`Kết quả cắt ảnh: ${croppedModal.title}`}
            className="bg-white border border-slate-200 text-slate-800 rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col outline-none"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Kết Quả Cắt Ảnh: {croppedModal.title} {croppedModal.range ? `(${croppedModal.range})` : ''}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCroppedModal(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-center min-h-[220px]">
              <img
                src={croppedModal.dataUrl}
                alt="Cropped Range"
                className="max-w-full max-h-[50vh] object-contain rounded-lg border border-slate-200 shadow-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                Bấm <strong>"Sao chép ảnh"</strong> rồi mở Zalo/Messenger nhấn <strong>Ctrl+V</strong> để dán ảnh.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleCopyFromDataUrl(croppedModal.dataUrl, croppedModal.title)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Sao Chép Ảnh (Clipboard)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadDataUrl(croppedModal.dataUrl, `ThiDua_${croppedModal.range || 'Range'}.png`)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Ảnh Về</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-5 right-5 z-50 bg-white text-slate-800 px-4 py-3 rounded-2xl shadow-lg border border-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-4 duration-300">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
