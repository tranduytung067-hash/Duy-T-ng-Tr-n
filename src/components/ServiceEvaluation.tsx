import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  User, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  FileText, 
  PlusCircle, 
  Check, 
  X,
  AlertTriangle,
  ClipboardCheck
} from 'lucide-react';
import { EmployeeTargetRow } from '../types';
import { notify } from '../utils/notify';

export interface EvaluationItem {
  id: string;
  ngay: string; // YYYY-MM-DD
  nguoiDanhGia: string; // Dynamic based on account role/role name
  nhanVien: string; // Selecable employee name
  hangCanHetDate: boolean;
  trungBayKhongDat: boolean;
  khieuNaiBoDiemBan: boolean;
  capNhatThongTinSai: boolean;
  khongDamBaoWPP: boolean;
  tongLuotViengTham: number;
  soLuotKhongDat: number;
  tiLeKhongDat: number; // percentage
  trangThai: 'Đạt' | 'Không Đạt';
  ghiChu: string;
}

interface ServiceEvaluationProps {
  employees: EmployeeTargetRow[];
  currentUser: {
    role: string;
    email?: string;
  };
}

export default function ServiceEvaluation({ employees, currentUser }: ServiceEvaluationProps) {
  // Determine evaluator name by currentUser role:
  // Giám sát (Admin) = Trần Duy Tùng, OM = Hoàng Văn Lâm
  const defaultEvaluator = currentUser.role === 'Admin' ? 'Trần Duy Tùng' : 'Hoàng Văn Lâm';

  // Get today's local date (metadata shows 2026-06-20)
  const getTodayString = () => {
    const today = new Date();
    // Use target date 2026-06-20 for consistent starting point or real today
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [evaluations, setEvaluations] = useState<EvaluationItem[]>(() => {
    const saved = localStorage.getItem('gs_evaluations');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing evaluations', e);
      }
    }
    // Seed some initial demo data if empty so the UI doesn't look barren
    const initialSeed: EvaluationItem[] = [
      {
        id: 'eval-1',
        ngay: '2026-06-18',
        nguoiDanhGia: 'Trần Duy Tùng',
        nhanVien: employees[0]?.name || 'Trần Văn Hoàng',
        hangCanHetDate: true,
        trungBayKhongDat: false,
        khieuNaiBoDiemBan: false,
        capNhatThongTinSai: false,
        khongDamBaoWPP: false,
        tongLuotViengTham: 12,
        soLuotKhongDat: 1,
        tiLeKhongDat: 8,
        trangThai: 'Đạt',
        ghiChu: 'Hàng trưng bày đẹp nhưng phát hiện 1 vỏ dính bụi cận date cần thu hồi gấp.'
      },
      {
        id: 'eval-2',
        ngay: '2026-06-19',
        nguoiDanhGia: 'Hoàng Văn Lâm',
        nhanVien: employees[1]?.name || 'Nguyễn Thị Hương',
        hangCanHetDate: false,
        trungBayKhongDat: true,
        khieuNaiBoDiemBan: true,
        capNhatThongTinSai: false,
        khongDamBaoWPP: true,
        tongLuotViengTham: 10,
        soLuotKhongDat: 3,
        tiLeKhongDat: 30,
        trangThai: 'Không Đạt',
        ghiChu: 'Trưng bày thiếu kệ POSM, bỏ dở 2 điểm bán không báo lý do, không triển khai được chương trình WPP.'
      }
    ];
    return initialSeed;
  });

  // Save evaluations to localStorage
  useEffect(() => {
    localStorage.setItem('gs_evaluations', JSON.stringify(evaluations));
  }, [evaluations]);

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState(getTodayString());
  const [selectedEmp, setSelectedEmp] = useState('');
  const [hangCan, setHangCan] = useState(false);
  const [trungBay, setTrungBay] = useState(false);
  const [khieuNai, setKhieuNai] = useState(false);
  const [capNhat, setCapNhat] = useState(false);
  const [wpp, setWpp] = useState(false);
  const [visits, setVisits] = useState(10);
  const [failedVisits, setFailedVisits] = useState(0);
  const [notes, setNotes] = useState('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Trigger employee select default when window opens or employees loaded
  useEffect(() => {
    if (employees.length > 0 && !selectedEmp) {
      setSelectedEmp(employees[0].name);
    }
  }, [employees]);

  // Auto computations
  const calculatedRate = visits > 0 ? Math.round((failedVisits / visits) * 100) : 0;
  const calculatedStatus = calculatedRate > 10 ? 'Không Đạt' : 'Đạt';

  // Handle addition or edit save
  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    if (failedVisits > visits) {
      notify.error('Số lượt không đạt không thể lớn hơn Tổng số lượt viếng thăm!');
      return;
    }

    if (editingId) {
      // Edit
      const updated = evaluations.map(ev => {
        if (ev.id === editingId) {
          return {
            ...ev,
            ngay: date,
            nhanVien: selectedEmp,
            hangCanHetDate: hangCan,
            trungBayKhongDat: trungBay,
            khieuNaiBoDiemBan: khieuNai,
            capNhatThongTinSai: capNhat,
            khongDamBaoWPP: wpp,
            tongLuotViengTham: visits,
            soLuotKhongDat: failedVisits,
            tiLeKhongDat: calculatedRate,
            trangThai: calculatedStatus as 'Đạt' | 'Không Đạt',
            ghiChu: notes
          };
        }
        return ev;
      });
      setEvaluations(updated);
    } else {
      // Add new
      const newItem: EvaluationItem = {
        id: `eval-${Date.now()}`,
        ngay: date,
        nguoiDanhGia: defaultEvaluator,
        nhanVien: selectedEmp,
        hangCanHetDate: hangCan,
        trungBayKhongDat: trungBay,
        khieuNaiBoDiemBan: khieuNai,
        capNhatThongTinSai: capNhat,
        khongDamBaoWPP: wpp,
        tongLuotViengTham: visits,
        soLuotKhongDat: failedVisits,
        tiLeKhongDat: calculatedRate,
        trangThai: calculatedStatus as 'Đạt' | 'Không Đạt',
        ghiChu: notes
      };
      setEvaluations([newItem, ...evaluations]);
    }

    // Reset Form
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(getTodayString());
    if (employees.length > 0) {
      setSelectedEmp(employees[0].name);
    }
    setHangCan(false);
    setTrungBay(false);
    setKhieuNai(false);
    setCapNhat(false);
    setWpp(false);
    setVisits(10);
    setFailedVisits(0);
    setNotes('');
    setIsOpenForm(false);
  };

  const handleOpenEdit = (item: EvaluationItem) => {
    setEditingId(item.id);
    setDate(item.ngay);
    setSelectedEmp(item.nhanVien);
    setHangCan(item.hangCanHetDate);
    setTrungBay(item.trungBayKhongDat);
    setKhieuNai(item.khieuNaiBoDiemBan);
    setCapNhat(item.capNhatThongTinSai);
    setWpp(item.khongDamBaoWPP);
    setVisits(item.tongLuotViengTham);
    setFailedVisits(item.soLuotKhongDat);
    setNotes(item.ghiChu);
    setIsOpenForm(true);
  };

  const handleDelete = (id: string) => {
    setEvaluations(evaluations.filter(ev => ev.id !== id));
    setConfirmDeleteId(null);
    notify.success('Đã xóa bản đánh giá dịch vụ.');
  };

  // Filtered lists
  const filtered = evaluations.filter(ev => {
    const matchSearch = ev.nhanVien.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        ev.nguoiDanhGia.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        ev.ghiChu.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchSearch;
    return matchSearch && ev.trangThai === statusFilter;
  });

  return (
    <div id="service-evaluation-root" className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-emerald-800 uppercase tracking-wider">
              ĐÁNH GIÁ DỊCH VỤ BÁN HÀNG
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Phân hệ ghi nhận, giám sát và đánh giá chất lượng phục vụ thị trường của từng Nhân viên.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsOpenForm(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs border border-emerald-600 cursor-pointer select-none"
        >
          <PlusCircle className="w-4 h-4" />
          Thêm Đánh Giá Mới
        </button>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Form panel overlay / lateral card */}
        {isOpenForm && (
          <div className="lg:col-span-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative animate-fadeIn mb-2">
            <button
              type="button"
              onClick={resetForm}
              aria-label="Đóng"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h5 className="text-sm font-black text-emerald-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              {editingId ? 'CẬP NHẬT ĐÁNH GIÁ DỊCH VỤ' : 'TẠO ĐÁNH GIÁ DỊCH VỤ BÁN HÀNG'}
            </h5>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Ngày Đánh Giá</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Người Đánh Giá</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 font-bold text-xs select-none flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    {defaultEvaluator} <span className="text-[10px] text-slate-500 font-normal">({currentUser.role === 'Admin' ? 'Giám Sát Thị Trường' : 'OM'})</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Chọn Nhân Viên Đánh Giá</label>
                  <select
                    required
                    value={selectedEmp}
                    onChange={(e) => setSelectedEmp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs cursor-pointer font-bold"
                  >
                    {employees.map(emp => (
                      <option key={emp.name} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Evaluation criteria checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-[11px] text-emerald-700 font-black uppercase tracking-wider block">Tiêu Chí Vi Phạm / Cần Lưu Ý:</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                    <input
                      type="checkbox"
                      checked={hangCan}
                      onChange={(e) => setHangCan(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs leading-snug">
                      <p className="font-semibold text-slate-800">Hàng Cận / Hết Date</p>
                      <p className="text-[10px] text-slate-500">Phát hiện sản phẩm quá hạn hoặc cận ngày.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                    <input
                      type="checkbox"
                      checked={trungBay}
                      onChange={(e) => setTrungBay(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs leading-snug">
                      <p className="font-semibold text-slate-800">Trưng Bày Hàng Hóa không đạt yêu cầu</p>
                      <p className="text-[10px] text-slate-500">Kệ vỡ, thiếu tem giá, sai quy cách.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                    <input
                      type="checkbox"
                      checked={khieuNai}
                      onChange={(e) => setKhieuNai(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs leading-snug">
                      <p className="font-semibold text-slate-800">Giải quyết khiếu nại / Bỏ điểm bán</p>
                      <p className="text-[10px] text-slate-500">Trễ nải giải quyết phàn nàn, bỏ tuyến bỏ điểm.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200 md:col-span-2 lg:col-span-1">
                    <input
                      type="checkbox"
                      checked={capNhat}
                      onChange={(e) => setCapNhat(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs leading-snug">
                      <p className="font-semibold text-slate-800">Cập nhật thông tin và báo cáo theo yêu cầu</p>
                      <p className="text-[10px] text-slate-500">Số liệu cung cấp không trùng khớp, chậm trễ.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={wpp}
                      onChange={(e) => setWpp(e.target.checked)}
                      className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs leading-snug">
                      <p className="font-semibold text-slate-800">Vận hành CT Tích điểm</p>
                      <p className="text-[10px] text-slate-500">Không đủ KH tham gia hoặc triển khai không đạt chỉ tiêu.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sizing indicators & rate math */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Tổng Số Lượt Viếng Thăm</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={visits}
                    onChange={(e) => setVisits(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Số Lượt Vấn Đề (Không Đạt)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={failedVisits}
                    onChange={(e) => setFailedVisits(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs font-bold"
                  />
                </div>

                {/* Score calculated live badge */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase block tracking-wide">Tỉ Lệ Vấn Đề</span>
                    <span className="text-xl font-mono font-black text-emerald-600">{calculatedRate}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase block tracking-wide">Trạng Thái</span>
                    <span className={`px-2.5 py-1 rounded-full font-black uppercase text-[10px] tracking-wide inline-block mt-0.5 ${
                      calculatedStatus === 'Đạt' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                        : 'bg-rose-50 text-rose-700 border border-rose-300'
                    }`}>
                      {calculatedStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Ghi Chú Chi Tiết</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Điền chi tiết các vấn đề ghi nhận được, mã điểm bán vi phạm..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer"
                >
                  {editingId ? 'Cập Nhật' : 'Lưu Kết Quả'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter bar and evaluations history table lists */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search textbox input */}
            <div className="w-full md:max-w-md relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm theo nhân viên, người đánh giá, ghi chú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-slate-900 placeholder-slate-400 text-xs outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            {/* Filter statuses select options */}
            <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none ${
                  statusFilter === 'ALL' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('Đạt')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none flex items-center gap-1 ${
                  statusFilter === 'Đạt' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Đạt
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('Không Đạt')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none flex items-center gap-1 ${
                  statusFilter === 'Không Đạt' 
                    ? 'bg-rose-600 text-white' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" /> Không Đạt
              </button>
            </div>
          </div>

          {/* Table display */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto hidden md:block shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200 font-sans">
                  <th className="py-3.5 px-4 border border-slate-200 text-center">Ngày</th>
                  <th className="py-3.5 px-4 border border-slate-200 text-center">Người Đánh Giá</th>
                  <th className="py-3.5 px-4 border border-slate-200 text-center">Nhân Viên</th>
                  <th className="py-3.5 px-4 border border-slate-200 text-center">Vấn Đề Ghi Nhận (Vi Phạm)</th>
                  <th className="text-center py-3.5 px-4 border border-slate-200">Viếng Thăm</th>
                  <th className="text-center py-3.5 px-4 border border-slate-200">Tỉ Lệ %</th>
                  <th className="text-center py-3.5 px-4 border border-slate-200">Trạng Thái</th>
                  <th className="py-3.5 px-4 border border-slate-200 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 bg-white text-xs">
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors bg-white">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700 border border-slate-200 bg-white">
                        {item.ngay}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 border border-slate-200 bg-white">
                        {item.nguoiDanhGia}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 border border-slate-200 bg-white">
                        {item.nhanVien}
                      </td>
                      <td className="py-3 px-4 border border-slate-200 bg-white max-w-[280px]">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {item.hangCanHetDate && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200 uppercase font-black" title="Hàng Cận/Hết Date">
                                Hàng cận / Hết Date
                              </span>
                            )}
                            {item.trungBayKhongDat && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-700 border border-amber-200 uppercase font-black" title="Trưng Bày Hàng Hóa không đạt yêu cầu">
                                Trưng bày lỗi
                              </span>
                            )}
                            {item.khieuNaiBoDiemBan && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange-50 text-orange-700 border border-orange-200 uppercase font-black" title="Giải quyết khiếu nại / Bỏ điểm bán">
                                Lỗi khiếu nại/Bỏ điểm
                              </span>
                            )}
                            {item.capNhatThongTinSai && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase font-black" title="Cập nhật thông tin và báo cáo theo yêu cầu">
                                Lỗi báo cáo
                              </span>
                            )}
                            {item.khongDamBaoWPP && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-violet-50 text-violet-700 border border-violet-200 uppercase font-black" title="Vận hành CT Tích điểm">
                                Lỗi CT tích điểm
                              </span>
                            )}
                            {!item.hangCanHetDate && !item.trungBayKhongDat && !item.khieuNaiBoDiemBan && !item.capNhatThongTinSai && !item.khongDamBaoWPP && (
                              <span className="text-slate-400 text-[11px] italic">Đạt chuẩn dịch vụ</span>
                            )}
                          </div>
                          {item.ghiChu && (
                            <p className="text-[11px] text-slate-500 italic line-clamp-2 mt-1">{item.ghiChu}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 border border-slate-200 bg-white font-mono tabular-nums text-slate-700">
                        <span className="font-bold text-slate-900">{item.tongLuotViengTham - item.soLuotKhongDat}</span>
                        <span className="text-slate-400">/{item.tongLuotViengTham}</span>
                      </td>
                      <td className="text-center py-3 px-4 font-mono tabular-nums font-bold text-teal-700 border border-slate-200 bg-white">
                        {item.tiLeKhongDat}%
                      </td>
                      <td className="text-center py-3 px-4 border border-slate-200 bg-white">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.trangThai === 'Đạt' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                            : 'bg-rose-50 text-rose-700 border border-rose-300'
                        }`}>
                          {item.trangThai}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center border border-slate-200 bg-white">
                        {confirmDeleteId === item.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition-colors cursor-pointer"
                              title="Sửa bản đánh giá"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                              title="Xóa bản đánh giá"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                      Không có bản đánh giá nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards display for small screens */}
          <div className="md:hidden space-y-3">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono tabular-nums text-slate-500">{item.ngay}</span>
                        <span className="text-[10px] font-semibold text-slate-500">- Người ĐG: {item.nguoiDanhGia}</span>
                      </div>
                      <h4 className="text-slate-900 font-bold text-xs mt-1">
                        Nhân viên: <span className="text-emerald-700 font-extrabold">{item.nhanVien}</span>
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono tracking-wider ${
                      item.trangThai === 'Đạt' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {item.trangThai}
                    </span>
                  </div>

                   {/* Violations layout */}
                   <div className="flex flex-wrap gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                     {item.hangCanHetDate && (
                       <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200 font-semibold inline-block">Hàng cận / hết date</span>
                     )}
                     {item.trungBayKhongDat && (
                       <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-700 border border-amber-200 font-semibold inline-block">Trưng bày lỗi</span>
                     )}
                     {item.khieuNaiBoDiemBan && (
                       <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange-50 text-orange-700 border border-orange-200 font-semibold inline-block">Khiếu nại/bỏ điểm</span>
                     )}
                     {item.capNhatThongTinSai && (
                       <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold inline-block">Cập nhật sai/thiếu</span>
                     )}
                     {item.khongDamBaoWPP && (
                       <span className="px-1.5 py-0.5 rounded text-[9px] bg-violet-50 text-violet-700 border border-violet-200 font-semibold inline-block">Lỗi tích điểm</span>
                     )}
                     {!item.hangCanHetDate && !item.trungBayKhongDat && !item.khieuNaiBoDiemBan && !item.capNhatThongTinSai && !item.khongDamBaoWPP && (
                       <span className="text-slate-500 text-[10px] italic">Đạt chuẩn dịch vụ</span>
                     )}
                   </div>

                  {item.ghiChu && (
                    <p className="text-[11px] text-slate-600 italic bg-slate-50 border border-slate-200 p-2 rounded-lg leading-relaxed">
                      {item.ghiChu}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <div className="text-slate-600 font-semibold">
                      Tỉ lệ lỗi: <span className="text-teal-700 font-extrabold tabular-nums">{item.tiLeKhongDat}%</span> <span className="text-[10px] text-slate-500 tabular-nums">({item.soLuotKhongDat}/{item.tongLuotViengTham})</span>
                    </div>
                    
                    {confirmDeleteId === item.id ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold cursor-pointer"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold cursor-pointer"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 font-medium text-xs bg-white border border-slate-200 rounded-xl">
                Không tìm thấy bản đánh giá phù hợp.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
