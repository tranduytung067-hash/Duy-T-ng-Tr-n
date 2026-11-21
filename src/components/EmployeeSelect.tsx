import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, ChevronDown, Check, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeSelectProps {
  selectedEmployeeName: string;
  onSelectEmployee: (name: string) => void;
  availableEmployees: string[];
  isEmployeeView: boolean;
  showAllOption?: boolean;
  className?: string;
  compact?: boolean;
  buttonHeightClass?: string;
  borderClass?: string;
}

export function EmployeeSelect({
  selectedEmployeeName,
  onSelectEmployee,
  availableEmployees,
  isEmployeeView,
  showAllOption = true,
  className = '',
  compact = false,
  buttonHeightClass = '',
  borderClass = ''
}: EmployeeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Ignore clicks inside portaled mobile bottom sheet
        const targetEl = event.target as HTMLElement | null;
        if (targetEl && targetEl.closest('[data-employee-sheet="true"]')) {
          return;
        }
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  if (isEmployeeView) {
    return null;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEmployees = normalizedQuery
    ? availableEmployees.filter((emp) => emp.toLowerCase().includes(normalizedQuery))
    : availableEmployees;

  return (
    <div className={`relative ${className ? className : 'inline-block'} text-left ${isOpen ? 'z-40' : 'z-10'}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          compact
            ? `w-full ${buttonHeightClass || 'min-h-[44px] sm:min-h-0 h-11 sm:h-9'} flex items-center justify-between gap-1 bg-white ${borderClass || 'border border-slate-300 hover:border-emerald-500'} rounded-xl px-2.5 py-1.5 shadow-2xs transition-all text-left cursor-pointer outline-none active:scale-[0.98] ${isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''}`
            : `w-full min-h-[44px] sm:min-h-0 flex items-center justify-between gap-2 bg-white ${borderClass || 'border border-emerald-500/80'} rounded-xl px-3.5 py-2 shadow-2xs hover:border-emerald-600 transition-all text-left cursor-pointer active:scale-[0.98] ${isOpen ? 'ring-2 ring-emerald-500/20' : ''}`
        }
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="truncate min-w-0">
            {!compact ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block leading-none mb-0.5">Nhân Viên</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate block leading-tight">{selectedEmployeeName}</span>
              </>
            ) : (
              <span className="text-xs font-semibold text-slate-800 truncate block leading-tight">
                {selectedEmployeeName === 'Tất cả' ? 'NV: Tất cả' : selectedEmployeeName}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="hidden md:flex absolute left-0 mt-1.5 min-w-[240px] max-w-xs bg-white border border-slate-200 rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.12)] p-2 z-50 flex-col gap-1 text-slate-800"
          >
            <div className="max-h-[300px] overflow-y-auto flex flex-col gap-0.5 scrollbar-thin">
              {showAllOption && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectEmployee('Tất cả');
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold text-left transition-colors cursor-pointer ${
                    selectedEmployeeName === 'Tất cả'
                      ? 'bg-emerald-50 text-emerald-700 font-extrabold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>Tất cả nhân viên</span>
                  {selectedEmployeeName === 'Tất cả' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              )}

              {availableEmployees.map((emp) => (
                <button
                  key={emp}
                  type="button"
                  onClick={() => {
                    onSelectEmployee(emp);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold text-left transition-colors cursor-pointer ${
                    selectedEmployeeName === emp
                      ? 'bg-emerald-50 text-emerald-700 font-extrabold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{emp}</span>
                  {selectedEmployeeName === emp && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              ))}

              {availableEmployees.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500 text-center italic">
                  Đang tải danh sách nhân viên...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile One-Handed Bottom Sheet Picker */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div data-employee-sheet="true" className="md:hidden fixed inset-0 z-[1050] flex flex-col justify-end">
          <div
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 bg-white rounded-t-3xl border-t border-slate-200 shadow-[0_-12px_40px_rgba(15,23,42,0.18)] max-h-[78dvh] flex flex-col pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          >
            {/* Drag Handle */}
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-1.5 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Chọn Nhân Viên</h3>
                <p className="text-[11px] text-slate-500">Chạm 1 lần để lọc dữ liệu</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-95"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input when list is long */}
            {availableEmployees.length > 5 && (
              <div className="px-4 pt-3 pb-1 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh tên nhân viên..."
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Options List (Bottom Thumb Friendly, >= 48px rows) */}
            <div className="p-4 overflow-y-auto space-y-1.5 flex-1">
              {showAllOption && !normalizedQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectEmployee('Tất cả');
                    setIsOpen(false);
                  }}
                  className={`w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${
                    selectedEmployeeName === 'Tất cả'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-50/80 text-slate-700 border border-slate-200/70 hover:bg-slate-100'
                  }`}
                >
                  <span>Tất cả nhân viên</span>
                  {selectedEmployeeName === 'Tất cả' && (
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              )}

              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployeeName === emp;
                return (
                  <button
                    key={emp}
                    type="button"
                    onClick={() => {
                      onSelectEmployee(emp);
                      setIsOpen(false);
                    }}
                    className={`w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-white text-slate-800 border border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{emp}</span>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredEmployees.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  Không tìm thấy nhân viên phù hợp.
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
