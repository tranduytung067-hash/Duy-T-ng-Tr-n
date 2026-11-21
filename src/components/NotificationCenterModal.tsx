import React, { useState, useRef } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Clock, 
  CheckCircle2, 
  ClipboardCheck, 
  ChevronRight, 
  Filter, 
  Calendar,
  AlertCircle,
  Sparkles,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDialogFocus } from '../utils/useDialogFocus';

export interface AppNotification {
  id: string;
  rawId: string;
  type: 'leave_pending_approval' | 'leave_approved' | 'market_evaluation';
  title: string;
  shortContent: string;
  time: string;
  timestamp: number;
  isRead: boolean;
  statusText?: string;
  statusColor?: 'amber' | 'emerald' | 'rose' | 'sky';
  employeeName?: string;
  extraInfo?: {
    leaveRequestId?: string;
    evalId?: string;
    approverName?: string;
    subTab?: 'chamcong' | 'dichvuthitruong';
  };
}

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onNotificationClick: (notif: AppNotification) => void;
  onMarkAllAsRead: () => void;
  onMarkSingleAsRead: (id: string, rawId: string, type: string) => void;
  userRole: string;
  userName: string;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onMarkAllAsRead,
  onMarkSingleAsRead,
  userRole,
  userName,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(item => {
    if (filterType === 'unread') return !item.isRead;
    return true;
  });

  const getNotificationIcon = (type: string, statusColor?: string) => {
    switch (type) {
      case 'leave_pending_approval':
        return (
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/25 flex items-center justify-center shrink-0 shadow-2xs">
            <Clock className="w-5 h-5" />
          </div>
        );
      case 'leave_approved':
        return (
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case 'market_evaluation':
        return (
          <div className={`w-11 h-11 rounded-2xl ${
            statusColor === 'emerald' 
              ? 'bg-teal-500/10 text-teal-600 border border-teal-500/25' 
              : 'bg-rose-500/10 text-rose-600 border border-rose-500/25'
          } flex items-center justify-center shrink-0 shadow-2xs`}>
            <ClipboardCheck className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Bell className="w-5 h-5" />
          </div>
        );
    }
  };

  const getStatusBadge = (text?: string, color?: string) => {
    if (!text) return null;
    switch (color) {
      case 'amber':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {text}
          </span>
        );
      case 'emerald':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            {text}
          </span>
        );
      case 'rose':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            {text}
          </span>
        );
      case 'sky':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs">
            {text}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {text}
          </span>
        );
    }
  };

  return (
    <div 
      id="notification-center-backdrop"
      className="app-modal-overlay fixed inset-0 z-[1000] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn"
      onClick={onClose}
    >
      {/* Mobile Top Drag/Grip Indicator */}
      <div className="w-12 h-1.5 bg-white/40 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Trung tâm thông báo"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="bg-white rounded-t-[32px] sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl h-[92dvh] sm:h-auto sm:max-h-[88vh] flex flex-col overflow-hidden text-slate-800 relative outline-none"
        onClick={(e) => e.stopPropagation()}
        id="notification-center-modal"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white relative shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-white truncate">
                  <span>Trung Tâm Thông Báo</span>
                  {unreadCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-xs font-black border border-white/30 shadow-xs shrink-0">
                      {unreadCount} mới
                    </span>
                  )}
                </h3>
                <p className="text-xs text-emerald-200/90 font-medium truncate mt-0.5">
                  {userRole === 'Admin' || userRole === 'OM' 
                    ? `Dành cho Quản lý • ${userName}` 
                    : `Dành cho Nhân viên • ${userName}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Filter & Mark all as read bar */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/15 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'bg-white/10 hover:bg-white/15 text-white/90'
                }`}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('unread')}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === 'unread'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'bg-white/10 hover:bg-white/15 text-white/90'
                }`}
              >
                <span>Chưa đọc</span>
                {unreadCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    filterType === 'unread' ? 'bg-rose-500 text-white' : 'bg-rose-500/80 text-white'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer border border-emerald-700/60 active:scale-95 shadow-2xs"
                title="Đánh dấu tất cả thông báo là đã đọc"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Đã đọc tất cả</span>
              </button>
            )}
          </div>
        </div>

        {/* Notification List Body - Tall, spacious & clearly viewable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 pb-6">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-bold text-slate-700">
                  {filterType === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {userRole === 'Admin' || userRole === 'OM'
                    ? 'Tất cả các phiếu nghỉ phép từ nhân viên đã được xử lý đầy đủ.'
                    : 'Các thông báo duyệt nghỉ phép và phiếu đánh giá dịch vụ thị trường sẽ xuất hiện đầy đủ tại đây.'}
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  onClick={() => onNotificationClick(notif)}
                  className={`group relative p-4 rounded-2xl transition-all duration-150 cursor-pointer select-none active:scale-[0.99] border ${
                    !notif.isRead
                      ? 'bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white border-emerald-300 shadow-sm hover:border-emerald-500 hover:shadow-md'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {getNotificationIcon(notif.type, notif.statusColor)}

                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Top row: Title + Status + Unread Dot */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm sm:text-base leading-snug break-words ${
                            !notif.isRead ? 'font-black text-slate-950' : 'font-bold text-slate-800'
                          }`}>
                            {notif.title}
                          </h4>
                          {!notif.isRead && (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shrink-0" title="Chưa đọc" />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                          {getStatusBadge(notif.statusText, notif.statusColor)}
                        </div>
                      </div>

                      {/* Details block: Full content without line truncation so user sees everything */}
                      <div className={`p-3 rounded-xl border text-xs sm:text-sm leading-relaxed break-words whitespace-pre-line ${
                        !notif.isRead 
                          ? 'bg-white/90 border-emerald-200 text-slate-800 font-medium' 
                          : 'bg-slate-50/80 border-slate-200/80 text-slate-600'
                      }`}>
                        {notif.shortContent}
                      </div>

                      {/* Context row: Employee Name badge (if any) & Time & Navigation action */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100/90 text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                          {notif.employeeName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11.5px] border border-slate-200/70">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>{notif.employeeName}</span>
                            </span>
                          )}

                          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{notif.time}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-emerald-700 font-black group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all">
                          <span>Mở xem chi tiết</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-600 font-medium pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0">
          Chạm vào thông báo để chuyển ngay đến phiếu chi tiết và xử lý
        </div>
      </motion.div>
    </div>
  );
};
