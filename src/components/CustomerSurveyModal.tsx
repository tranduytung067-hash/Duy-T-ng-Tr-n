import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Gift,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Settings,
  Copy,
  Check,
  Send,
  Trash2,
  ExternalLink,
  RefreshCw,
  User,
  ChevronDown,
  ChevronUp,
  History,
  XCircle,
} from 'lucide-react';
import { CustomerSurveyRecord, GiftSurveyStatus, SurveyConfig } from '../types';
import {
  CompressedSurveyImage,
  SURVEY_APPS_SCRIPT_TEMPLATE,
  compressSurveyImage,
  formatSurveyTimestamp,
  getDrivePreviewUrl,
  saveSurveyConfig,
  submitCustomerSurvey,
  testAppsScriptConnection,
} from '../utils/surveyService';
import { useDialogFocus } from '../utils/useDialogFocus';

const OPINION_OPTIONS: {
  value: GiftSurveyStatus;
  label: string;
  activeClass: string;
}[] = [
  {
    value: 'Đồng ý mua hàng',
    label: 'Đồng ý mua hàng',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
  },
  {
    value: 'Chưa đồng ý mua hàng',
    label: 'Chưa đồng ý mua hàng',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-xs',
  },
];

interface CustomerSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    code: string;
    name: string;
    employee?: string;
    address?: string;
    avgSales?: string;
  } | null;
  currentUserName: string;
  canManageConfig: boolean;
  surveyConfig: SurveyConfig | null;
  existingSurveys: CustomerSurveyRecord[];
  onOpenSettings: () => void;
  onSubmitted?: (record: CustomerSurveyRecord) => void;
}

export function CustomerSurveyModal({
  isOpen,
  onClose,
  customer,
  currentUserName,
  canManageConfig,
  surveyConfig,
  existingSurveys,
  onOpenSettings,
  onSubmitted,
}: CustomerSurveyModalProps) {
  const [opinionChoice, setOpinionChoice] = useState<GiftSurveyStatus>('Đồng ý mua hàng');
  const [disagreeReason, setDisagreeReason] = useState('');
  const [compressedImage, setCompressedImage] = useState<CompressedSurveyImage | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<CustomerSurveyRecord | null>(null);
  const [showHistory, setShowHistory] = useState(true);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const surveyModalRef = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(isOpen && customer), surveyModalRef, onClose);

  useEffect(() => {
    if (isOpen && customer) {
      setOpinionChoice('Đồng ý mua hàng');
      setDisagreeReason('');
      setCompressedImage(null);
      setErrorMsg(null);
      setSuccessRecord(null);
      setShowHistory(existingSurveys.length > 0);
    }
  }, [isOpen, customer?.code, customer?.name]);

  if (!isOpen || !customer) return null;

  const hasScriptUrl = Boolean(surveyConfig?.appsScriptUrl && surveyConfig.appsScriptUrl.trim().length > 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setIsCompressing(true);
    try {
      const compressed = await compressSurveyImage(file);
      setCompressedImage(compressed);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xử lý ảnh. Vui lòng thử ảnh khác.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasScriptUrl) {
      setErrorMsg('Chưa kết nối Google Apps Script để ghi vào Sheet "Khảo Sát".');
      return;
    }

    if (opinionChoice === 'Chưa đồng ý mua hàng' && !disagreeReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do cụ thể khi khách hàng chưa đồng ý mua hàng.');
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await submitCustomerSurvey({
        appsScriptUrl: surveyConfig!.appsScriptUrl,
        driveFolderName: surveyConfig?.driveFolderName || 'Anh_Khao_Sat_KH',
        customerCode: customer.code || 'N/A',
        customerName: customer.name,
        customerEmployee: customer.employee || '',
        surveyor: currentUserName || 'Nhân viên',
        giftStatus: opinionChoice,
        customerFeedback: opinionChoice === 'Chưa đồng ý mua hàng' ? disagreeReason.trim() : '',
        compressedImage,
      });

      setSuccessRecord(record);
      onSubmitted?.(record);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gửi khảo sát thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="app-modal-overlay fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans"
      onClick={onClose}
    >
      <div
        ref={surveyModalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Khảo sát khách hàng ${customer.name}`}
        className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 sm:px-5 py-3.5 text-white flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              <Gift className="w-3.5 h-3.5 shrink-0" />
              <span>Khảo sát khách hàng</span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug mt-0.5 break-words">
              {customer.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-emerald-50">
              <span className="font-mono font-bold bg-white/15 px-1.5 py-0.5 rounded">
                Mã KH: {customer.code || 'N/A'}
              </span>
              {existingSurveys.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-white text-emerald-700 font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã KS ({existingSurveys.length})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canManageConfig && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Cài đặt Google Apps Script Khảo Sát"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition-colors"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {!hasScriptUrl && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Chưa kết nối Google Apps Script</div>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                    {canManageConfig
                      ? 'Vui lòng dán URL Google Apps Script của Sheet vào phần Cài đặt để ghi trực tiếp dữ liệu vào tab "Khảo Sát".'
                      : 'Vui lòng liên hệ Quản lý / Admin để hoàn tất kết nối Google Sheet "Khảo Sát".'}
                  </p>
                </div>
              </div>
              {canManageConfig && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="min-h-[40px] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shrink-0 cursor-pointer"
                >
                  Cấu hình ngay
                </button>
              )}
            </div>
          )}

          {successRecord && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-700">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Đã lưu khảo sát vào Sheet "Khảo Sát" thành công!</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                {successRecord.combinedOpinion}
              </p>
              {successRecord.imageUrl && (
                <a
                  href={successRecord.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Xem ảnh đã lưu trên Google Drive
                </a>
              )}
              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSuccessRecord(null)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-emerald-700 text-xs font-bold cursor-pointer"
                >
                  Khảo sát thêm lần nữa
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          )}

          {!successRecord && (
            <>
              {/* Thông tin cố định: Người khảo sát | Mã KH | Tên KH */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Người khảo sát:</span>
                  <span className="font-extrabold text-slate-900 inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    {currentUserName || 'Nhân viên'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <span className="text-slate-500 font-semibold">Mã Khách Hàng:</span>
                  <span className="font-mono font-extrabold text-slate-900">{customer.code || 'N/A'}</span>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <span className="text-slate-500 font-semibold shrink-0">Tên Khách Hàng:</span>
                  <span className="font-bold text-slate-900 text-right">{customer.name}</span>
                </div>
              </div>

              {/* 1. Ý Kiến (2 lựa chọn) */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  1. Ý Kiến
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {OPINION_OPTIONS.map((opt) => {
                    const isActive = opinionChoice === opt.value;
                    const IconComp = opt.value === 'Đồng ý mua hàng' ? CheckCircle2 : XCircle;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setOpinionChoice(opt.value);
                          setErrorMsg(null);
                        }}
                        className={`min-h-[52px] px-3 py-2.5 rounded-xl border text-center transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 ${
                          isActive
                            ? opt.activeClass
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <IconComp className="w-4 h-4 shrink-0" />
                        <span className="text-xs sm:text-sm font-extrabold leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Lý do cụ thể nếu chọn Chưa đồng ý mua hàng */}
                {opinionChoice === 'Chưa đồng ý mua hàng' && (
                  <div className="pt-1 space-y-1.5">
                    <label className="block text-xs font-bold text-rose-700">
                      Lý do cụ thể <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={disagreeReason}
                      onChange={(e) => setDisagreeReason(e.target.value)}
                      placeholder="Nhập lý do cụ thể khách hàng chưa đồng ý mua hàng..."
                      maxLength={1200}
                      required
                      className="w-full px-3 py-2.5 bg-white border border-rose-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* 2. Ảnh chụp tặng quà KH */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  2. Ảnh chụp tặng quà KH
                </label>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!compressedImage ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isCompressing}
                      onClick={() => cameraInputRef.current?.click()}
                      className="min-h-[48px] px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>{isCompressing ? 'Đang nén...' : 'Chụp ảnh ngay'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isCompressing}
                      onClick={() => galleryInputRef.current?.click()}
                      className="min-h-[48px] px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4 shrink-0" />
                      <span>Chọn từ thư viện</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                    <img
                      src={compressedImage.dataUrl}
                      alt="Ảnh chụp tặng quà KH"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-300 shrink-0 bg-white"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-bold text-slate-900 truncate">{compressedImage.fileName}</div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 tabular-nums">
                        Đã nén: {compressedImage.originalKB} KB → {compressedImage.compressedKB} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCompressedImage(null)}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer shrink-0"
                      title="Xóa ảnh"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Lịch sử khảo sát trước đó */}
          {existingSurveys.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-extrabold text-slate-800 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-600" />
                  Lịch sử khảo sát ({existingSurveys.length})
                </span>
                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              {showHistory && (
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {existingSurveys.map((rec, idx) => {
                    const thumbUrl = getDrivePreviewUrl(rec.imageUrl);
                    const isAgreed = rec.giftStatus === 'Đồng ý mua hàng' || rec.giftStatus === 'Đã tặng quà';
                    const isDisagreed = rec.giftStatus === 'Chưa đồng ý mua hàng' || rec.giftStatus === 'Không đủ điều kiện';
                    return (
                      <div key={rec.id || idx} className="p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 truncate">{rec.surveyor}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                isAgreed
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isDisagreed
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {rec.giftStatus}
                            </span>
                            {rec.submittedAt && (
                              <span className="text-[10px] text-slate-400 font-mono tabular-nums inline-flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatSurveyTimestamp(rec.submittedAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-700 leading-relaxed break-words">{rec.combinedOpinion}</p>

                        {rec.imageUrl && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <a
                              href={rec.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-[11px] font-bold text-emerald-700 hover:underline bg-emerald-50/70 px-2 py-1 rounded-lg border border-emerald-100"
                            >
                              {thumbUrl && (
                                <img
                                  src={thumbUrl}
                                  alt="Ảnh khảo sát"
                                  referrerPolicy="no-referrer"
                                  onError={(ev) => {
                                    (ev.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                  className="w-7 h-7 rounded object-cover border border-emerald-200"
                                />
                              )}
                              <span>Mở ảnh chụp tặng quà</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer CTA */}
          {!successRecord && (
            <div className="sticky bottom-0 -mx-4 sm:-mx-5 -mb-4 px-4 sm:px-5 py-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressing || !hasScriptUrl}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang gửi lên Sheet...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Gửi Khảo Sát</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

interface SurveySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveyConfig: SurveyConfig | null;
  currentUserName: string;
}

export function SurveySettingsModal({
  isOpen,
  onClose,
  surveyConfig,
  currentUserName,
}: SurveySettingsModalProps) {
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [driveFolderName, setDriveFolderName] = useState('Anh_Khao_Sat_KH');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showScriptCode, setShowScriptCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAppsScriptUrl(surveyConfig?.appsScriptUrl || '');
      setDriveFolderName(surveyConfig?.driveFolderName || 'Anh_Khao_Sat_KH');
      setStatusFeedback(null);
      setCopiedCode(false);
    }
  }, [isOpen, surveyConfig]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(SURVEY_APPS_SCRIPT_TEMPLATE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setStatusFeedback({ type: 'error', text: 'Không thể tự động sao chép, vui lòng bôi đen sao chép thủ công.' });
    }
  };

  const handleTest = async () => {
    setStatusFeedback(null);
    if (!appsScriptUrl.trim()) {
      setStatusFeedback({ type: 'error', text: 'Vui lòng nhập URL Web App Google Apps Script trước.' });
      return;
    }
    setIsTesting(true);
    try {
      const res = await testAppsScriptConnection(appsScriptUrl.trim());
      if (res.ok) {
        const sheetInfo = res.sheetName ? ` (File: "${res.sheetName}")` : '';
        setStatusFeedback({
          type: 'success',
          text: `${res.message || 'Kết nối thành công!'}${sheetInfo}`,
        });
      } else {
        setStatusFeedback({
          type: 'error',
          text: res.error || 'Kết nối thất bại. Kiểm tra lại URL hoặc quyền "Anyone" khi Deploy.',
        });
      }
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err?.message || 'Lỗi kiểm tra kết nối.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setStatusFeedback(null);
    const trimmed = appsScriptUrl.trim();
    if (trimmed && !trimmed.startsWith('https://script.google.com/macros/s/')) {
      setStatusFeedback({
        type: 'error',
        text: 'URL phải là link Web App Apps Script (https://script.google.com/macros/s/.../exec).',
      });
      return;
    }

    setIsSaving(true);
    try {
      await saveSurveyConfig({
        appsScriptUrl: trimmed,
        driveFolderName: driveFolderName.trim() || 'Anh_Khao_Sat_KH',
        updatedBy: currentUserName,
      });
      setStatusFeedback({ type: 'success', text: 'Đã lưu cấu hình đồng bộ cho toàn bộ nhân viên!' });
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err?.message || 'Không thể lưu cấu hình.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="app-modal-overlay fixed inset-0 z-[10000] bg-slate-900/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cấu hình Google Apps Script"
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 text-slate-900 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                Cấu hình Google Apps Script (Sheet Khảo Sát)
              </h3>
              <p className="text-[11px] text-slate-500">
                Nhân viên gửi khảo sát & ảnh trực tiếp vào Sheet mà không cần đăng nhập Google
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block font-extrabold text-slate-800 uppercase tracking-wide">
              URL Web App Google Apps Script
            </label>
            <input
              type="url"
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-extrabold text-slate-800 uppercase tracking-wide">
              Tên thư mục Google Drive lưu ảnh khảo sát
            </label>
            <input
              type="text"
              value={driveFolderName}
              onChange={(e) => setDriveFolderName(e.target.value)}
              placeholder="Anh_Khao_Sat_KH"
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {statusFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{statusFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTest}
              className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
            </button>
          </div>

          {/* Hướng dẫn triển khai 4 bước */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-slate-900 uppercase text-[11px]">
                Hướng dẫn cài đặt 1 lần trên Google Sheet
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Đã sao chép mã!' : 'Sao chép mã Apps Script'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-700 leading-relaxed">
              <li>
                Mở Google Sheet dữ liệu &rarr; chọn menu <strong>Tiện ích mở rộng</strong> &rarr; <strong>Apps Script</strong>.
              </li>
              <li>
                Xóa hết mã cũ trong file <code className="bg-slate-200 px-1 rounded">Code.gs</code> và dán đoạn mã đã sao chép vào, nhấn <strong>Lưu</strong>.
              </li>
              <li>
                Chọn <strong>Triển khai (Deploy)</strong> &rarr; <strong>Tùy chọn triển khai mới (New deployment)</strong> &rarr; Loại: <strong>Ứng dụng web (Web app)</strong>.
              </li>
              <li>
                Mục <em>Thực thi dưới danh nghĩa</em> chọn <strong>Tôi (Me)</strong>; mục <em>Ai có quyền truy cập</em> chọn <strong>Bất kỳ ai (Anyone)</strong> &rarr; bấm Triển khai, cấp quyền và dán URL vào ô trên.
              </li>
            </ol>

            <div>
              <button
                type="button"
                onClick={() => setShowScriptCode(!showScriptCode)}
                className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {showScriptCode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showScriptCode ? 'Ẩn mã nguồn Apps Script' : 'Xem trước mã nguồn Apps Script'}</span>
              </button>

              {showScriptCode && (
                <pre className="mt-2 p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[10.5px] font-mono overflow-x-auto max-h-60 leading-relaxed">
                  {SURVEY_APPS_SCRIPT_TEMPLATE}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
