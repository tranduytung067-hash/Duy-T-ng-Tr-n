import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Award,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  History,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  Clock,
  User,
  Check,
  Power,
  FileText,
  TrendingUp,
  Info,
  Gift,
  Sliders,
  Archive,
  ArchiveRestore
} from 'lucide-react';
import { CompetitionProgramConfig, CompetitionSchemeTier, CompetitionProgramLog } from '../types';
import {
  saveCompetitionProgram,
  toggleCompetitionProgramActive,
  archiveCompetitionProgram,
  resetAllProgramsToDefaults,
  subscribeCompetitionLogs,
  isProgramActiveStrict,
  isProgramArchivedStrict
} from '../utils/competitionService';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';

interface CompetitionSchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs: CompetitionProgramConfig[];
  isSupervisor: boolean;
  isMarketSupervisor?: boolean;
  currentUserName: string;
  initialSelectedProgramId?: string | null;
  onOpenDynamicBuilder?: (program?: CompetitionProgramConfig) => void;
  onToggleActive?: (programId: string, newActive: boolean) => void;
  onUpdateProgram?: (updated: CompetitionProgramConfig) => void;
}

export default function CompetitionSchemeModal({
  isOpen,
  onClose,
  programs,
  isSupervisor,
  isMarketSupervisor,
  currentUserName,
  initialSelectedProgramId,
  onOpenDynamicBuilder,
  onToggleActive,
  onUpdateProgram
}: CompetitionSchemeModalProps) {
  const [activeTab, setActiveTab] = useState<'programs' | 'audit'>('programs');
  
  // Quyền tạo & cấu hình chương trình thi đua mới: CHỈ DÀNH RIÊNG cho Giám Sát Thị Trường
  const canCreateDynamic = isMarketSupervisor !== undefined ? isMarketSupervisor : (isSupervisor && Boolean(onOpenDynamicBuilder));
  
  const displayPrograms = useMemo(() => {
    return isSupervisor ? programs : programs.filter(isProgramActiveStrict);
  }, [programs, isSupervisor]);

  const activeAndPausedPrograms = useMemo(
    () => programs.filter((p) => !isProgramArchivedStrict(p)),
    [programs]
  );
  const archivedPrograms = useMemo(
    () => programs.filter((p) => isProgramArchivedStrict(p)),
    [programs]
  );

  const [showArchived, setShowArchived] = useState<boolean>(false);

  const [selectedProgramId, setSelectedProgramId] = useState<string>(() => {
    if (initialSelectedProgramId) return initialSelectedProgramId;
    return displayPrograms.length > 0 ? displayPrograms[0].id : (programs.length > 0 ? programs[0].id : 'bot_ngot');
  });

  // Editing state for Supervisor
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<CompetitionProgramConfig | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<CompetitionProgramLog[]>([]);

  useEffect(() => {
    if (initialSelectedProgramId) {
      setSelectedProgramId(initialSelectedProgramId);
    } else if (!isSupervisor && displayPrograms.length > 0) {
      if (!displayPrograms.some((p) => p.id === selectedProgramId)) {
        setSelectedProgramId(displayPrograms[0].id);
      }
    }
  }, [initialSelectedProgramId, displayPrograms, isSupervisor]);

  // Subscribe to audit logs if supervisor
  useEffect(() => {
    if (isSupervisor && isOpen) {
      const unsub = subscribeCompetitionLogs((logs) => {
        setAuditLogs(logs);
      });
      return () => unsub();
    }
  }, [isSupervisor, isOpen]);

  const currentProgram = displayPrograms.find((p) => p.id === selectedProgramId) || displayPrograms[0];

  // Start editing handler
  const handleStartEdit = (program: CompetitionProgramConfig) => {
    setEditFormData(JSON.parse(JSON.stringify(program)));
    setIsEditing(true);
    setSaveSuccessMsg(null);
  };

  // Cancel edit handler
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData(null);
  };

  // Save changes handler
  const handleSaveProgram = async () => {
    if (!editFormData) return;
    setIsSaving(true);
    try {
      if (onUpdateProgram) {
        onUpdateProgram(editFormData);
      }
      await saveCompetitionProgram(
        editFormData,
        currentUserName || 'Giám Sát',
        `Cập nhật cơ cấu chương trình: ${editFormData.title} (${editFormData.time})`
      );
      setSaveSuccessMsg('Đã lưu và đồng bộ cấu hình thành công đến toàn bộ hệ thống!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Lỗi lưu chương trình thi đua:', err);
      notify.error('Đã xảy ra lỗi khi lưu cấu hình. Vui lòng thử lại!');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status handler
  const handleToggleActive = async (prog: CompetitionProgramConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSupervisor) return;
    const newState = !isProgramActiveStrict(prog);
    if (onToggleActive) {
      onToggleActive(prog.id, newState);
    }
    try {
      await toggleCompetitionProgramActive(
        prog.id,
        prog.title,
        newState,
        currentUserName || 'Giám Sát'
      );
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err);
      if (onToggleActive) {
        onToggleActive(prog.id, !newState);
      }
    }
  };

  // Archive / unarchive handler
  const handleArchiveToggle = async (prog: CompetitionProgramConfig, shouldArchive: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isSupervisor) return;
    try {
      await archiveCompetitionProgram(
        prog.id,
        prog.title,
        shouldArchive,
        currentUserName || 'Giám Sát'
      );
      if (shouldArchive) {
        setShowArchived(true);
        setSaveSuccessMsg(`Đã ngừng & lưu trữ chương trình "${prog.shortTitle || prog.title}". Chương trình sẽ không bao giờ tự bật lại.`);
      } else {
        setSaveSuccessMsg(`Đã khôi phục "${prog.shortTitle || prog.title}" về danh sách (đang ở trạng thái Tắt).`);
      }
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Lỗi lưu trữ chương trình:', err);
      notify.error('Không thể cập nhật trạng thái lưu trữ. Vui lòng thử lại!');
    }
  };

  // Reset to default handler (two-step inline confirmation)
  const handleResetDefaults = async () => {
    if (!isSupervisor) return;
    if (!confirmingReset) {
      setConfirmingReset(true);
      notify.info('Bấm "Khôi phục mặc định" thêm lần nữa để xác nhận. Các chương trình đang Tắt/Lưu trữ vẫn được giữ nguyên.');
      setTimeout(() => setConfirmingReset(false), 6000);
      return;
    }
    setConfirmingReset(false);

    try {
      await resetAllProgramsToDefaults(currentUserName || 'Giám Sát');
      setSaveSuccessMsg('Đã khôi phục nội dung cơ cấu về mặc định (giữ nguyên trạng thái Tắt/Lưu trữ hiện tại)!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
      notify.error('Không thể khôi phục mặc định. Vui lòng thử lại!');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Cơ cấu các chương trình thi đua"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-4 sm:px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/20 shrink-0 shadow-inner">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  {isSupervisor
                    ? 'Cơ Cấu Các Chương Trình Thi Đua'
                    : `Cơ Cấu: ${currentProgram?.title || 'Chương Trình Thi Đua'}`}
                </h3>
                {isSupervisor ? (
                  <span className="bg-amber-400/90 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300/50 flex items-center gap-1 shadow-2xs">
                    <Shield className="w-3 h-3" />
                    <span>Quyền Giám Sát</span>
                  </span>
                ) : (
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/30">
                    Cơ Cấu Chi Tiết
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-100 font-medium">
                {isSupervisor
                  ? 'Cấu hình tập trung thời gian, điều kiện & mức thưởng thi đua - Tự động đồng bộ toàn hệ thống'
                  : 'Chi tiết thể lệ, thời gian áp dụng và mức thưởng chương trình thi đua đang chọn'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation for Supervisor */}
        {isSupervisor && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('programs');
                  setIsEditing(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'programs'
                    ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cơ Cấu Thi Đua ({programs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('audit');
                  setIsEditing(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch Sử Cập Nhật ({auditLogs.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {canCreateDynamic && onOpenDynamicBuilder && (
                <button
                  type="button"
                  onClick={() => onOpenDynamicBuilder()}
                  className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                  title="Tạo chương trình thi đua mới với cấu trúc động"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Tạo CT Mới</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                title="Khôi phục tất cả về cấu hình gốc"
              >
                <RotateCcw className="w-3 h-3 text-amber-700" />
                <span className="hidden sm:inline">Khôi Phục Mặc Định</span>
              </button>
            </div>
          </div>
        )}

        {/* Save Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 text-emerald-900 text-xs font-bold animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50">
          {activeTab === 'audit' && isSupervisor ? (
            /* TAB 2: AUDIT LOGS HISTORY */
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-600" />
                    <span>Nhật Ký Thay Đổi Cấu Hình Thi Đua</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ghi nhận tự động mọi chỉnh sửa về thời gian, điều kiện và mức thưởng
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  {auditLogs.length} sự kiện
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-2">
                  <Info className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    Chưa có thay đổi nào được ghi nhận gần đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditLogs.map((log) => {
                    const logDate = log.timestamp
                      ? new Date(log.timestamp).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })
                      : '-';

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 transition-all shadow-2xs space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                                log.action === 'reset_defaults'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : log.action === 'toggle_status'
                                  ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                  : log.action === 'archive'
                                  ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                  : log.action === 'unarchive'
                                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {log.action === 'reset_defaults'
                                ? 'KHÔI PHỤC GỐC'
                                : log.action === 'toggle_status'
                                ? 'ĐỔI TRẠNG THÁI'
                                : log.action === 'archive'
                                ? 'LƯU TRỮ NGỪNG'
                                : log.action === 'unarchive'
                                ? 'KHÔI PHỤC LƯU TRỮ'
                                : 'CẬP NHẬT CƠ CẤU'}
                            </span>
                            <span className="text-xs font-black text-slate-800">
                              {log.programTitle}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{log.performedBy}</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{logDate}</span>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {log.details}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : !isSupervisor ? (
            /* TAB 1 FOR EMPLOYEE: ONLY DISPLAY SELECTED PROGRAM SCHEME DIRECTLY IN FULL WIDTH */
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto w-full">
              {currentProgram ? (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Program Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base sm:text-lg font-black text-slate-900">
                          {currentProgram.title}
                        </h4>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            currentProgram.isActive !== false
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {currentProgram.isActive !== false ? '● Đang Áp Dụng' : '○ Đang Tạm Dừng'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-mono">{currentProgram.time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Conditions */}
                  {currentProgram.conditions && currentProgram.conditions.length > 0 && (
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-extrabold uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Điều Kiện Tham Gia / Đạt Thưởng</span>
                      </h5>
                      <div className="space-y-2">
                        {currentProgram.conditions.map((cond, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 text-xs sm:text-sm text-slate-800 font-medium shadow-2xs"
                          >
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{cond}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Reward Tiers */}
                  {currentProgram.tiers && currentProgram.tiers.length > 0 && (
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-600" />
                        <span>Cơ Cấu Mức Thưởng Chi Tiết</span>
                      </h5>
                      <div className="space-y-2.5">
                        {currentProgram.tiers.map((tier, idx) => (
                          <div
                            key={idx}
                            className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-amber-50/60 via-white to-emerald-50/40 border border-amber-200 hover:border-amber-300 transition-all shadow-2xs space-y-2.5 overflow-hidden"
                          >
                            {/* Dòng 1: Điều kiện / Mức đạt */}
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-md bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 break-words leading-snug flex-1">
                                {tier.condition}
                              </span>
                            </div>

                            {/* Dòng 2: Phần thưởng xếp ở dòng phía dưới, không bị tràn khỏi ô */}
                            <div className="pl-8">
                              <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-black text-xs shadow-2xs max-w-full break-words">
                                <Gift className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider shrink-0">
                                  Mức Thưởng:
                                </span>
                                <span className="text-white break-words text-xs sm:text-sm font-black">
                                  {tier.reward}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 3: Details & Regulations */}
                  {currentProgram.details && currentProgram.details.length > 0 && (
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-extrabold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>Quy Định & Nội Dung Chi Tiết</span>
                      </h5>
                      <div className="space-y-2">
                        {currentProgram.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs sm:text-sm text-slate-700"
                          >
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="leading-relaxed font-medium">{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last updated timestamp */}
                  {currentProgram.updatedAt && (
                    <div className="pt-2 text-[10.5px] text-slate-400 font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Cập nhật gần nhất:{' '}
                        {new Date(currentProgram.updatedAt).toLocaleString('vi-VN')}
                        {currentProgram.updatedBy ? ` bởi ${currentProgram.updatedBy}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">Không tìm thấy thông tin chương trình.</div>
              )}
            </div>
          ) : (
            /* TAB 1 FOR SUPERVISOR: PROGRAMS LIST SIDEBAR & EDITING VIEW */
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-full">
              {/* Left Sidebar: Programs List */}
              <div className="md:col-span-4 bg-white border-r border-slate-200 p-3 sm:p-4 space-y-2 divide-y divide-slate-100 max-h-[360px] md:max-h-none overflow-y-auto">
                <div className="pb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                    Danh Sách Chương Trình ({activeAndPausedPrograms.length})
                  </span>
                </div>

                <div className="space-y-1.5 pt-2">
                  {activeAndPausedPrograms.map((prog, idx) => {
                    const isSelected = prog.id === selectedProgramId;
                    const isActive = isProgramActiveStrict(prog);

                    return (
                      <div
                        key={prog.id}
                        onClick={() => {
                          setSelectedProgramId(prog.id);
                          if (isEditing) {
                            setEditFormData(JSON.parse(JSON.stringify(prog)));
                          }
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-400 shadow-2xs ring-1 ring-emerald-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 truncate">
                              <h5
                                className={`text-xs font-extrabold truncate ${
                                  isSelected ? 'text-emerald-950' : 'text-slate-800'
                                }`}
                              >
                                {prog.shortTitle || prog.title}
                              </h5>
                              {prog.isCustom && (
                                <span className="text-[9px] font-black px-1 py-0.5 rounded bg-amber-400 text-slate-900 shrink-0">
                                  Động
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {prog.time}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isSupervisor && (
                            <button
                              type="button"
                              onClick={(e) => handleToggleActive(prog, e)}
                              className={`p-1 rounded-md transition-colors ${
                                isActive
                                  ? 'text-emerald-600 hover:bg-emerald-100'
                                  : 'text-slate-400 hover:bg-slate-100'
                              }`}
                              title={isActive ? 'Đang kích hoạt - Bấm để tạm dừng' : 'Đang tạm dừng - Bấm để kích hoạt'}
                            >
                              <Power className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                            </button>
                          )}
                          {isSupervisor && !isActive && (
                            <button
                              type="button"
                              onClick={(e) => handleArchiveToggle(prog, true, e)}
                              className="p-1 rounded-md text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                              title="Ngừng & Lưu trữ vĩnh viễn (không bao giờ tự bật lại)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {isActive ? 'Bật' : 'Tắt'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Collapsible Archived Programs Section */}
                {archivedPrograms.length > 0 && (
                  <div className="pt-3 mt-2 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowArchived((v) => !v)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/70 text-[10.5px] font-extrabold text-slate-600 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Archive className="w-3.5 h-3.5 text-slate-500" />
                        <span>Đã Ngừng & Lưu Trữ ({archivedPrograms.length})</span>
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                    </button>

                    {showArchived && (
                      <div className="space-y-1.5 pt-1">
                        {archivedPrograms.map((prog) => {
                          const isSelected = prog.id === selectedProgramId;
                          return (
                            <div
                              key={prog.id}
                              onClick={() => {
                                setSelectedProgramId(prog.id);
                                if (isEditing) {
                                  setEditFormData(JSON.parse(JSON.stringify(prog)));
                                }
                              }}
                              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none opacity-80 ${
                                isSelected
                                  ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-300'
                                  : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-500'
                              }`}
                            >
                              <div className="min-w-0">
                                <h5 className="text-[11px] font-bold truncate text-slate-600 line-through">
                                  {prog.shortTitle || prog.title}
                                </h5>
                                <span className="text-[9.5px] text-slate-400 block truncate">
                                  {prog.time}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSupervisor && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleArchiveToggle(prog, false, e)}
                                    className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    title="Khôi phục về danh sách (ở trạng thái Tắt)"
                                  >
                                    <ArchiveRestore className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                                  Lưu trữ
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Main Content: Program Detail / Edit View */}
              <div className="md:col-span-8 p-4 sm:p-6 space-y-5 overflow-y-auto">
                {currentProgram ? (
                  isEditing && editFormData && isSupervisor ? (
                    /* SUPERVISOR EDIT FORM */
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Chỉnh Sửa Cơ Cấu Chương Trình</span>
                          </span>
                          <h4 className="text-sm sm:text-base font-black text-slate-900">
                            {editFormData.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={handleSaveProgram}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu & Đồng Bộ'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Basic Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                            Tên Đầy Đủ Chương Trình
                          </label>
                          <input
                            type="text"
                            value={editFormData.title}
                            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                            Tên Viết Tắt (Thẻ Tab)
                          </label>
                          <input
                            type="text"
                            value={editFormData.shortTitle}
                            onChange={(e) => setEditFormData({ ...editFormData, shortTitle: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                            Thời Gian Áp Dụng
                          </label>
                          <input
                            type="text"
                            value={editFormData.time}
                            onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                            placeholder="VD: 21/07/2026 - 20/08/2026"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* Conditions Editor */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Điều Kiện Tham Gia / Đạt Thưởng</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const list = [...(editFormData.conditions || [])];
                              list.push('');
                              setEditFormData({ ...editFormData, conditions: list });
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm điều kiện</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {editFormData.conditions && editFormData.conditions.length > 0 ? (
                            editFormData.conditions.map((cond, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400 w-4 text-center">
                                  {idx + 1}.
                                </span>
                                <input
                                  type="text"
                                  value={cond}
                                  onChange={(e) => {
                                    const list = [...editFormData.conditions];
                                    list[idx] = e.target.value;
                                    setEditFormData({ ...editFormData, conditions: list });
                                  }}
                                  placeholder="Nhập điều kiện tham gia/đạt..."
                                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = editFormData.conditions.filter((_, i) => i !== idx);
                                    setEditFormData({ ...editFormData, conditions: list });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa điều kiện này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Chưa có điều kiện nào. Bấm "Thêm điều kiện" để tạo.</p>
                          )}
                        </div>
                      </div>

                      {/* Reward Tiers Editor */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-amber-600" />
                            <span>Cơ Cấu Mức Thưởng Theo Bậc</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const list = [...(editFormData.tiers || [])];
                              list.push({ condition: '', reward: '' });
                              setEditFormData({ ...editFormData, tiers: list });
                            }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm mức thưởng</span>
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {editFormData.tiers && editFormData.tiers.length > 0 ? (
                            editFormData.tiers.map((tier, idx) => (
                              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                {/* Dòng 1: Bậc số & Điều kiện đạt */}
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-md bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                    {idx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={tier.condition}
                                    onChange={(e) => {
                                      const list = [...editFormData.tiers];
                                      list[idx] = { ...list[idx], condition: e.target.value };
                                      setEditFormData({ ...editFormData, tiers: list });
                                    }}
                                    placeholder="Điều kiện đạt (VD: Mức 1: Bán ≥ 50 thùng)"
                                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const list = editFormData.tiers.filter((_, i) => i !== idx);
                                      setEditFormData({ ...editFormData, tiers: list });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title="Xóa mức thưởng này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Dòng 2: Mức thưởng ở dòng phía dưới */}
                                <div className="pl-8 flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide shrink-0">
                                    Mức Thưởng:
                                  </span>
                                  <input
                                    type="text"
                                    value={tier.reward}
                                    onChange={(e) => {
                                      const list = [...editFormData.tiers];
                                      list[idx] = { ...list[idx], reward: e.target.value };
                                      setEditFormData({ ...editFormData, tiers: list });
                                    }}
                                    placeholder="Mức thưởng (VD: Thưởng 5.000đ/thùng)"
                                    className="flex-1 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Chưa có mức thưởng. Bấm "Thêm mức thưởng" để tạo.</p>
                          )}
                        </div>
                      </div>

                      {/* Details Editor */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-slate-600" />
                            <span>Quy Định & Nội Dung Chi Tiết</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const list = [...(editFormData.details || [])];
                              list.push('');
                              setEditFormData({ ...editFormData, details: list });
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm quy định</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {editFormData.details && editFormData.details.length > 0 ? (
                            editFormData.details.map((detail, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400 w-4 text-center">
                                  {idx + 1}.
                                </span>
                                <input
                                  type="text"
                                  value={detail}
                                  onChange={(e) => {
                                    const list = [...(editFormData.details || [])];
                                    list[idx] = e.target.value;
                                    setEditFormData({ ...editFormData, details: list });
                                  }}
                                  placeholder="Nhập nội dung quy định chi tiết..."
                                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = (editFormData.details || []).filter((_, i) => i !== idx);
                                    setEditFormData({ ...editFormData, details: list });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa dòng này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Chưa có quy định bổ sung.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* READ-ONLY / SUPERVISOR OVERVIEW VIEW */
                    <div className="space-y-5 animate-in fade-in duration-150">
                      {/* Program Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base sm:text-lg font-black text-slate-900">
                              {currentProgram.title}
                            </h4>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                isProgramArchivedStrict(currentProgram)
                                  ? 'bg-slate-200 text-slate-700 border-slate-300'
                                  : isProgramActiveStrict(currentProgram)
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {isProgramArchivedStrict(currentProgram)
                                ? '⏹ Đã Ngừng & Lưu Trữ'
                                : isProgramActiveStrict(currentProgram)
                                ? '● Đang Áp Dụng'
                                : '○ Đang Tạm Dừng'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-mono">{currentProgram.time}</span>
                          </div>
                        </div>

                        {/* Supervisor Edit Buttons */}
                        {isSupervisor && (
                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                            {isProgramArchivedStrict(currentProgram) ? (
                              <button
                                type="button"
                                onClick={(e) => handleArchiveToggle(currentProgram, false, e)}
                                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                                title="Khôi phục chương trình về danh sách (trạng thái Tắt)"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                                <span>Khôi Phục Về Danh Sách</span>
                              </button>
                            ) : !isProgramActiveStrict(currentProgram) ? (
                              <button
                                type="button"
                                onClick={(e) => handleArchiveToggle(currentProgram, true, e)}
                                className="px-3 py-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-300 hover:border-amber-300 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                                title="Ngừng hẳn & ẩn vào kho lưu trữ"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Ngừng & Lưu Trữ</span>
                              </button>
                            ) : null}

                            {canCreateDynamic && onOpenDynamicBuilder && (
                              <button
                                type="button"
                                onClick={() => onOpenDynamicBuilder(currentProgram)}
                                className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                                title="Cấu hình cột hiển thị, dải ô Sheet và công thức"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Cấu Hình Cột & Dải Ô</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(currentProgram)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Chỉnh Sửa Cơ Cấu</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Section 1: Conditions */}
                      {currentProgram.conditions && currentProgram.conditions.length > 0 && (
                        <div className="space-y-2.5">
                          <h5 className="text-xs font-extrabold uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Điều Kiện Tham Gia / Đạt Thưởng</span>
                          </h5>
                          <div className="space-y-2">
                            {currentProgram.conditions.map((cond, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 text-xs sm:text-sm text-slate-800 font-medium shadow-2xs"
                              >
                                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{cond}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Reward Tiers */}
                      {currentProgram.tiers && currentProgram.tiers.length > 0 && (
                        <div className="space-y-2.5">
                          <h5 className="text-xs font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-amber-600" />
                            <span>Cơ Cấu Mức Thưởng Chi Tiết</span>
                          </h5>
                          <div className="space-y-2.5">
                            {currentProgram.tiers.map((tier, idx) => (
                              <div
                                key={idx}
                                className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-amber-50/60 via-white to-emerald-50/40 border border-amber-200 hover:border-amber-300 transition-all shadow-2xs space-y-2.5 overflow-hidden"
                              >
                                {/* Dòng 1: Điều kiện / Mức đạt */}
                                <div className="flex items-start gap-2.5">
                                  <span className="w-6 h-6 rounded-md bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs sm:text-sm font-bold text-slate-900 break-words leading-snug flex-1">
                                    {tier.condition}
                                  </span>
                                </div>

                                {/* Dòng 2: Phần thưởng xếp ở dòng phía dưới, không bị tràn khỏi ô */}
                                <div className="pl-8">
                                  <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-black text-xs shadow-2xs max-w-full break-words">
                                    <Gift className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                    <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider shrink-0">
                                      Mức Thưởng:
                                    </span>
                                    <span className="text-white break-words text-xs sm:text-sm font-black">
                                      {tier.reward}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Details & Regulations */}
                      {currentProgram.details && currentProgram.details.length > 0 && (
                        <div className="space-y-2.5">
                          <h5 className="text-xs font-extrabold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span>Quy Định & Nội Dung Chi Tiết</span>
                          </h5>
                          <div className="space-y-2">
                            {currentProgram.details.map((detail, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs sm:text-sm text-slate-700"
                              >
                                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="leading-relaxed font-medium">{detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Last updated timestamp */}
                      {currentProgram.updatedAt && (
                        <div className="pt-2 text-[10.5px] text-slate-400 font-mono flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            Cập nhật gần nhất:{' '}
                            {new Date(currentProgram.updatedAt).toLocaleString('vi-VN')}
                            {currentProgram.updatedBy ? ` bởi ${currentProgram.updatedBy}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="p-8 text-center text-slate-400">Không tìm thấy thông tin chương trình.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            {isSupervisor
              ? 'Chỉ tài khoản Giám Sát mới có quyền lưu cấu hình và khôi phục mặc định.'
              : 'Dữ liệu được đồng bộ từ Cơ Cấu Thi Đua do Giám Sát thiết lập.'}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
