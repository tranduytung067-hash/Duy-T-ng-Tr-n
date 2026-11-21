import React, { useState, useRef } from 'react';
import { X, CheckCircle2, ImageIcon, Copy, Download, ExternalLink, Send } from 'lucide-react';
import { useDialogFocus } from '../utils/useDialogFocus';

export function ZaloIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C12.95 4 4 11.97 4 21.8C4 26.85 7.02 31.33 11.83 34.45L9.67 41.56C9.45 42.28 10.21 42.89 10.88 42.53L18.06 38.67C19.96 39.27 21.94 39.6 24 39.6C35.05 39.6 44 31.63 44 21.8C44 11.97 35.05 4 24 4Z" fill="#0068FF"/>
      <path d="M15.2 28H19.8V26.2H17.2L20.2 21.8V20H15.6V21.8H18.2L15.2 26.2V28ZM21.2 28H23V20H21.2V28ZM24.4 28H26.2V25.2H28.4C29.8 25.2 30.8 24.2 30.8 22.6C30.8 21 29.8 20 28.4 20H24.4V28ZM26.2 23.6V21.6H28.2C28.8 21.6 29.2 22 29.2 22.6C29.2 23.2 28.8 23.6 28.2 23.6H26.2ZM32.4 28C34.4 28 36 26.4 36 24C36 21.6 34.4 20 32.4 20C30.4 20 28.8 21.6 28.8 24C28.8 26.4 30.4 28 32.4 28ZM32.4 26.4C31.4 26.4 30.6 25.4 30.6 24C30.6 22.6 31.4 21.6 32.4 21.6C33.4 21.6 34.2 22.6 34.2 24C34.2 25.4 33.4 26.4 32.4 26.4Z" fill="white"/>
    </svg>
  );
}

export interface ZaloShareImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subTitle?: string;
  dataUrl: string;
  blob: Blob | null;
  fileName: string;
  copied?: boolean;
}

export default function ZaloShareImageModal({
  isOpen,
  onClose,
  title,
  subTitle,
  dataUrl,
  blob,
  fileName,
  copied: initialCopied = false
}: ZaloShareImageModalProps) {
  const [copied, setCopied] = useState(initialCopied);
  const [targetPhone, setTargetPhone] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const handleCopyImage = async () => {
    if (!blob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleDownloadImage = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div
      className="app-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Official Zalo Brand Styling */}
        <div className="bg-[#0068FF] px-4 sm:px-5 py-3.5 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shrink-0">
              <ZaloIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white truncate">
                  {title}
                </h3>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/30 hidden sm:inline-block shrink-0">
                  Hình Ảnh PNG
                </span>
              </div>
              {subTitle && (
                <p className="text-xs text-blue-100 font-medium truncate max-w-[280px] sm:max-w-[420px]">
                  {subTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
          {/* Automatic Copy Alert Banner */}
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
            copied
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${copied ? 'text-emerald-600' : 'text-blue-600'}`} />
            <div className="space-y-0.5">
              <p className="font-extrabold text-xs">
                {copied
                  ? 'ĐÃ SAO CHÉP HÌNH ẢNH VÀO CLIPBOARD (BỘ NHỚ TẠM)!'
                  : 'HÌNH ẢNH BÁO CÁO ĐÃ SẴN SÀNG GỬI QUA ZALO'}
              </p>
              <p className="text-[11px] text-slate-600 leading-snug">
                Bạn có thể mở cửa sổ Zalo và nhấn tổ hợp phím <kbd className="bg-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">Ctrl + V</kbd> (hoặc chạm giữ chọn <strong className="text-slate-900 font-bold">Dán</strong>) để dán và gửi ảnh ngay lập tức!
              </p>
            </div>
          </div>

          {/* IMAGE PREVIEW BOX */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#0068FF]" />
                <span>Xem Trước Hình Ảnh (.PNG):</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="px-3 py-1.5 bg-[#0068FF] hover:bg-[#0052cc] text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="Sao chép ảnh vào Bộ nhớ tạm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Đã Sao Chép!' : 'Sao Chép Ảnh'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="Tải file ảnh PNG về máy"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Ảnh (.PNG)</span>
                </button>
              </div>
            </div>

            {/* IMAGE CONTAINER */}
            <div className="border border-slate-200 rounded-xl bg-slate-100 p-2 sm:p-3 overflow-auto max-h-[380px] flex justify-center shadow-inner">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="Báo cáo Zalo"
                  className="w-full h-auto rounded-lg shadow-md border border-slate-300 object-contain"
                />
              ) : (
                <div className="p-8 text-center text-slate-400 font-bold">Đang tải hình ảnh...</div>
              )}
            </div>
          </div>

          {/* SĐT ZALO OPTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ZaloIcon className="w-4 h-4" />
              <span>SĐT Zalo Người Nhận (Tùy chọn):</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nhập SĐT Zalo (VD: 0912345678)..."
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                className="flex-1 bg-white border border-slate-300 text-slate-800 text-xs font-mono font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0068FF]"
              />
              <button
                type="button"
                onClick={() => {
                  window.open('https://chat.zalo.me', '_blank');
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shrink-0 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở Zalo Web</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Đóng Cửa Sổ
          </button>
        </div>
      </div>
    </div>
  );
}
