import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Star, List, BarChart3, User } from 'lucide-react';
import { EmployeeTargetRow } from '../types';
import { sortAndFormatEmployeeNames } from '../utils/sheetParser';
import { EmployeeSelect } from './EmployeeSelect';

interface ChartsProps {
  employees: EmployeeTargetRow[];
  isEmployeeView: boolean;
  selectedEmployeeName?: string;
  onSelectEmployee?: (name: string) => void;
  profileName?: string;
  profileRole?: string;
  viewingEmpName?: string | null;
  setViewingEmpName?: (name: string | null) => void;
  activationListData?: any[];
}

const formatChartVND = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  return value.toLocaleString('vi-VN');
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white text-slate-700 p-3 rounded-lg shadow-xl border border-slate-200 text-xs font-sans">
        <p className="font-bold mb-1 text-slate-900">{label}</p>
        <p className="text-indigo-600">Chỉ tiêu (Target): <span className="font-mono font-bold">{formatChartVND(payload[0].value)}</span></p>
        <p className="text-emerald-600">Thực tế (Actual): <span className="font-mono font-bold">{formatChartVND(payload[1].value)}</span></p>
        <p className="text-amber-600 font-bold mt-1">
          Tỷ lệ đạt: {payload[0].value > 0 ? ((payload[1].value / payload[0].value) * 100).toFixed(1) : 0}%
        </p>
      </div>
    );
  }
  return null;
};

export default function Charts({ employees, isEmployeeView }: ChartsProps) {
  // Convert employee records into clean chart items
  const comparisonData = employees.map((emp) => ({
    name: emp.name.length > 14 ? emp.name.split(' ').pop() || emp.name : emp.name,
    target: emp.targetVal,
    actual: emp.actualVal,
  }));

  return (
    <div id="sales-comparison-card" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">So sánh Chỉ tiêu (Target) vs Thực tế (Actual)</h3>
          <p className="text-xs text-slate-600">
            {isEmployeeView
              ? 'Biểu đồ chỉ tiêu chi tiết theo cấu trúc phân bổ của nhân viên'
              : 'Biểu đồ doanh số toàn bộ nhân sự công ty'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-500 font-sans">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></div>
            <span>Target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
            <span>Actual</span>
          </div>
        </div>
      </div>

      {/* Recharts container box */}
      <div className="w-full h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={comparisonData}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#475569', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#475569', fontSize: 10 }}
              tickFormatter={(val) => {
                if (val >= 1_000_000_000) return `${val / 1_000_000_000}B`;
                if (val >= 1_000_000) return `${val / 1_000_000}M`;
                return val;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
            <Bar dataKey="target" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={24} />
            <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ActivationRates({ 
  employees, 
  isEmployeeView, 
  selectedEmployeeName, 
  onSelectEmployee,
  profileName, 
  profileRole,
  viewingEmpName,
  setViewingEmpName,
  activationListData = []
}: ChartsProps) {
  const cleanName = (str: any) => {
    if (!str) return '';
    return String(str)
      .normalize('NFD') // decomposes characters with accents
      .replace(/[\u0300-\u036f]/g, '') // removes accent marks
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const isEmployeeMatch = (recordName: string | null | undefined, filterName: string): boolean => {
    if (filterName === 'Tất cả') return true;
    const cleanFilter = filterName.trim().toLowerCase();
    const cleanRecord = (recordName || '').trim().toLowerCase();
    
    if (
      cleanFilter === 'n/a => chưa gán khbh' || 
      cleanFilter === 'n/a' || 
      cleanFilter === 'na' || 
      cleanFilter === '-' ||
      cleanFilter === 'chưa gán khbh'
    ) {
      return (
        cleanRecord === '' ||
        cleanRecord === 'n/a' ||
        cleanRecord === 'na' ||
        cleanRecord === 'nan' ||
        cleanRecord === '-' ||
        cleanRecord === 'chưa gán khbh' ||
        cleanRecord === 'n/a => chưa gán khbh'
      );
    }
    
    return cleanRecord === cleanFilter || 
           cleanRecord.normalize('NFC') === cleanFilter.normalize('NFC') ||
           cleanName(recordName) === cleanName(filterName);
  };

  // If RLS is locked on employee view, force the filter to that employee name
  const effectiveChartEmp = isEmployeeView ? (selectedEmployeeName || 'Tất cả') : (selectedEmployeeName || 'Tất cả');

  // Filter the list used exclusively for the gauges/charts computation
  const filteredEmployeesForChart = employees.filter((emp) => {
    return isEmployeeMatch(emp.name, effectiveChartEmp || 'Tất cả');
  });

  const availableEmpNames = sortAndFormatEmployeeNames(employees.map(e => e.name));

  const activationSummary = filteredEmployeesForChart.reduce(
    (acc, next) => {
      acc.t3TargetTotal += next.k3Target;
      acc.t3ActualTotal += next.k3Actual;
      acc.t4TargetTotal += next.k4Target;
      acc.t4ActualTotal += next.k4Actual;

      // HRC (Lựa Chọn 1): Chỉ áp dụng cho Nguyễn Đức Tuấn
      const isEmpTuan = cleanName(next.name).includes('tuan');
      if (isEmpTuan) {
        const hrcTarget = (next.khmhThangTarget !== undefined && next.khmhThangTarget !== null && Number(next.khmhThangTarget) > 0)
          ? Number(next.khmhThangTarget)
          : 110;
        const hrcActual = (next.khmhThangActual !== undefined && next.khmhThangActual !== null && Number(next.khmhThangActual) > 0)
          ? Number(next.khmhThangActual)
          : 85;

        acc.khmTargetTotal += hrcTarget;
        acc.khmActualTotal += hrcActual;
      }

      acc.khTargetTotal += next.khTarget || 0;
      acc.khActualTotal += next.khActual || 0;
      return acc;
    },
    { t3TargetTotal: 0, t3ActualTotal: 0, t4TargetTotal: 0, t4ActualTotal: 0, khmTargetTotal: 0, khmActualTotal: 0, khTargetTotal: 0, khActualTotal: 0 }
  );

  const getDisplayPercentage = (actual: number, target: number): number => {
    if (target <= 0) return 0;
    const rawPct = (actual / target) * 100;
    if (target - actual > 0) {
      // If there is any target remaining, max display percentage is 99%
      return Math.min(rawPct, 99);
    }
    return rawPct;
  };

  const t3Percentage = getDisplayPercentage(activationSummary.t3ActualTotal, activationSummary.t3TargetTotal);

  const t4Percentage = getDisplayPercentage(activationSummary.t4ActualTotal, activationSummary.t4TargetTotal);

  const khmPercentage = getDisplayPercentage(activationSummary.khmActualTotal, activationSummary.khmTargetTotal);

  const khPercentage = getDisplayPercentage(activationSummary.khActualTotal, activationSummary.khTargetTotal);

  const data3N = [
    { name: 'Kích hoạt đạt', value: activationSummary.t3ActualTotal },
    { name: 'Đang hoàn thiện', value: Math.max(0, activationSummary.t3TargetTotal - activationSummary.t3ActualTotal) },
  ];

  const data4N = [
    { name: 'Kích hoạt đạt', value: activationSummary.t4ActualTotal },
    { name: 'Đang hoàn thiện', value: Math.max(0, activationSummary.t4TargetTotal - activationSummary.t4ActualTotal) },
  ];

  const dataKHM = [
    { name: 'Thực hiện', value: activationSummary.khmActualTotal },
    { name: 'Cần thực hiện', value: Math.max(0, activationSummary.khmTargetTotal - activationSummary.khmActualTotal) },
  ];

  const dataKH = [
    { name: 'Đạt chuẩn', value: activationSummary.khActualTotal },
    { name: 'Chưa đạt', value: Math.max(0, activationSummary.khTargetTotal - activationSummary.khActualTotal) },
  ];

  const isTuan = (effectiveChartEmp && cleanName(effectiveChartEmp).includes('tuan')) ||
                 (profileName && cleanName(profileName).includes('tuan'));
  const showKHMHChart = !!isTuan || (effectiveChartEmp === 'Tất cả' && activationSummary.khmTargetTotal > 0);
  const showKHChart = activationSummary.khTargetTotal > 0;

  const metrics = [
    {
      id: '3n',
      title: '3 Ngành Hàng',
      actual: activationSummary.t3ActualTotal,
      target: activationSummary.t3TargetTotal,
      pct: t3Percentage,
      unit: '',
    },
    {
      id: '4n',
      title: '4 Ngành Hàng',
      actual: activationSummary.t4ActualTotal,
      target: activationSummary.t4TargetTotal,
      pct: t4Percentage,
      unit: '',
    },
    ...(showKHChart ? [{
      id: 'kh_chuan',
      title: 'KH Đạt Chuẩn',
      actual: activationSummary.khActualTotal,
      target: activationSummary.khTargetTotal,
      pct: khPercentage,
      unit: '',
    }] : []),
    ...(showKHMHChart ? [{
      id: 'hrc',
      title: 'KH HRC',
      actual: activationSummary.khmActualTotal,
      target: activationSummary.khmTargetTotal,
      pct: khmPercentage,
      unit: '',
    }] : []),
  ];

  const scrollToDetail = () => {
    const element = document.getElementById('employee-activation-detail-card') || 
                    document.getElementById('employee-activation-table-card');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.classList.add('ring-2', 'ring-emerald-500/50', 'transition-all');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-emerald-500/50');
      }, 1500);
    }
  };

  const isEmployeeRole = profileRole === 'Nhân viên' || profileRole === 'Saleman' || profileRole === 'employee';

  // Thống kê số lượng Khách Hàng từ Sheet Data Kích Hoạt
  const normalizeType = (str: any): string => {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  let truyenThongCount = 0;
  let horecaCount = 0;
  let coSoSanXuatCount = 0;
  let khacCount = 0;

  const filteredActivationRows = (activationListData || []).filter((row) => {
    const empName = row['A'] || row['Nhân Viên'] || row['nhanVien'];
    return isEmployeeMatch(empName, effectiveChartEmp);
  });

  filteredActivationRows.forEach((row) => {
    const hasRowData = row['A'] || row['Nhân Viên'] || row['nhanVien'] || row['Mã KH'] || row['Tên Khách Hàng'];
    if (!hasRowData) return;

    const rawType = row['Y'] !== undefined ? row['Y'] : (row['Phân loại khách hàng'] || row['Phân loại KH'] || '');
    const cleanRaw = String(rawType).trim();
    if (!cleanRaw || cleanRaw === '' || cleanRaw === '#N/A' || cleanRaw.toUpperCase() === '#N/A') {
      return;
    }
    const norm = normalizeType(rawType);

    if (norm === 'truyenthong' || norm.includes('truyenthong') || norm === 'pds' || norm.includes('pds')) {
      truyenThongCount++;
    } else if (norm === 'horeca' || norm === 'hrc' || norm.includes('horeca') || norm.includes('hrc')) {
      horecaCount++;
    } else if (norm === 'cososanxuat' || norm === 'cssx' || norm.includes('cososanxuat') || norm.includes('cssx')) {
      coSoSanXuatCount++;
    } else {
      khacCount++;
    }
  });

  const tongCount = truyenThongCount + horecaCount + coSoSanXuatCount + khacCount;

  return (
    <div id="activation-rates-card" className="w-full bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 md:p-6 shadow-xs mb-6">
      {/* Top Header Section: Title & Action Button on 1 Single Row on Mobile, EmployeeSelect on Desktop */}
      <div className="border-b border-slate-100 pb-3 mb-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-emerald-600 shrink-0" />
          <h3 className="text-sm sm:text-base md:text-xl font-extrabold uppercase tracking-wider text-emerald-900 truncate">
            TỔNG QUAN
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isEmployeeView && onSelectEmployee && (
            <div className="hidden md:block">
              <EmployeeSelect
                selectedEmployeeName={selectedEmployeeName || 'Tất cả'}
                onSelectEmployee={onSelectEmployee}
                availableEmployees={availableEmpNames}
                isEmployeeView={isEmployeeView}
              />
            </div>
          )}

          {!isEmployeeView && isEmployeeRole && (
            <button
              onClick={() => {
                if (setViewingEmpName) {
                  if (viewingEmpName) {
                    setViewingEmpName(null);
                  } else if (selectedEmployeeName) {
                    setViewingEmpName(selectedEmployeeName);
                  }
                }
              }}
              className={`min-h-[38px] sm:min-h-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs md:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                viewingEmpName
                  ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden">{viewingEmpName ? 'Quay Lại' : 'DS Chi Tiết'}</span>
              <span className="hidden sm:inline">{viewingEmpName ? 'Quay Lại' : 'Danh Sách Kích Hoạt Chi Tiết'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Thống kê phân loại khách hàng (2x2 + Tổng span 2 trên Mobile, 5 cột trên Tablet/Desktop) */}
      <div className="w-full bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 sm:p-4 md:p-5 mb-4 sm:mb-5">
        <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
          <span className="w-1.5 h-4 bg-emerald-600 rounded-sm inline-block"></span>
          <h4 className="text-xs sm:text-sm md:text-base font-extrabold uppercase text-slate-800 tracking-wider">
            Thống kê phân loại khách hàng
          </h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 md:gap-4 w-full">
          {/* Nút 1: PDS (Truyền Thống) */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 text-center flex flex-col justify-between min-w-0">
            <span className="text-xs sm:text-xs md:text-sm text-slate-600 font-bold block tracking-tight mb-1 sm:mb-2 truncate" title="PDS (Truyền Thống)">
              PDS
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 font-mono tabular-nums leading-none">
              {truyenThongCount}
            </span>
          </div>
          {/* Nút 2: HRC (Horeca) */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 text-center flex flex-col justify-between min-w-0">
            <span className="text-xs sm:text-xs md:text-sm text-slate-600 font-bold block tracking-tight mb-1 sm:mb-2 truncate" title="HRC (Horeca)">
              HRC
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 font-mono tabular-nums leading-none">
              {horecaCount}
            </span>
          </div>
          {/* Nút 3: CSSX */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 text-center flex flex-col justify-between min-w-0">
            <span className="text-xs sm:text-xs md:text-sm text-slate-600 font-bold block tracking-tight mb-1 sm:mb-2 truncate" title="CSSX (Cơ Sở Sản Xuất)">
              CSSX
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 font-mono tabular-nums leading-none">
              {coSoSanXuatCount}
            </span>
          </div>
          {/* Nút 4: Khác */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 text-center flex flex-col justify-between min-w-0">
            <span className="text-xs sm:text-xs md:text-sm text-slate-600 font-bold block tracking-tight mb-1 sm:mb-2 truncate" title="Khác">
              Khác
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 font-mono tabular-nums leading-none">
              {khacCount}
            </span>
          </div>
          {/* Nút 5: Tổng */}
          <div className="col-span-2 sm:col-span-1 bg-emerald-600 text-white p-3 sm:p-4 rounded-xl border border-emerald-600 text-center flex flex-row sm:flex-col items-center sm:items-stretch justify-between min-w-0 px-4 sm:px-4">
            <span className="text-xs sm:text-xs md:text-sm text-emerald-100 font-bold block tracking-tight sm:mb-2 truncate" title="Tổng">
              Tổng cộng
            </span>
            <span className="text-2xl sm:text-2xl md:text-3xl font-black font-mono tabular-nums leading-none text-white">
              {tongCount}
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE METRIC CARDS: Gọn, to rõ, không bị ép 4 cột trên màn hình điện thoại */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {metrics.map((m) => {
          const remaining = Math.max(0, m.target - m.actual);
          return (
            <div
              key={m.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-3 flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold uppercase tracking-tight text-slate-700 truncate">
                  {m.title}
                </span>
                <span
                  className={`text-xs font-extrabold font-mono tabular-nums shrink-0 ${
                    m.pct >= 100 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {m.pct.toFixed(0)}%
                </span>
              </div>

              <div className="text-lg font-black font-mono tabular-nums text-slate-900 leading-tight">
                {m.actual} <span className="text-slate-400 font-normal text-xs">/</span> {m.target}
              </div>

              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    m.pct >= 100 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, m.pct))}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                <span className="text-slate-500 font-semibold">Cần làm</span>
                <span
                  className={`font-black font-mono tabular-nums ${
                    remaining === 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {remaining}{m.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP & TABLET TABLE: Bảo toàn cấu trúc 1 hàng tiêu chí, 1 hàng tiến độ, 1 hàng cần làm */}
      <div className="hidden sm:block w-full bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-center border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {metrics.map((m) => (
                  <th
                    key={m.id}
                    className="py-3.5 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm md:text-base lg:text-lg font-black uppercase tracking-wider text-slate-800 border-r last:border-r-0 border-slate-200"
                  >
                    {m.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-white hover:bg-slate-50/50 transition-colors">
                {metrics.map((m) => (
                  <td
                    key={m.id}
                    className="py-4 sm:py-5 px-2 sm:px-4 border-r last:border-r-0 border-slate-200/60"
                  >
                    <div className="text-base sm:text-2xl md:text-3xl font-black font-mono tabular-nums text-slate-900 leading-tight">
                      {m.actual} <span className="text-slate-400 font-normal text-xs sm:text-base md:text-lg">/</span> {m.target}
                    </div>
                    <div className="mt-1.5 flex items-center justify-center gap-2">
                      <span
                        className={`text-xs md:text-sm font-extrabold font-mono tabular-nums ${
                          m.pct >= 100
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {m.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full max-w-[180px] md:max-w-[240px] mx-auto bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.pct >= 100 ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, m.pct))}%` }}
                      />
                    </div>
                  </td>
                ))}
              </tr>

              <tr className="bg-rose-50/25 hover:bg-rose-50/40 transition-colors">
                {metrics.map((m) => {
                  const remaining = Math.max(0, m.target - m.actual);
                  return (
                    <td
                      key={m.id}
                      className="py-3.5 sm:py-4 px-2 sm:px-4 border-r last:border-r-0 border-slate-200/60"
                    >
                      <div className="text-[11px] sm:text-xs md:text-sm text-rose-600 font-bold uppercase tracking-wider mb-1">
                        Cần thực hiện
                      </div>
                      <div
                        className={`text-base sm:text-2xl md:text-3xl font-black font-mono tabular-nums leading-tight ${
                          remaining === 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {remaining}{m.unit}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
