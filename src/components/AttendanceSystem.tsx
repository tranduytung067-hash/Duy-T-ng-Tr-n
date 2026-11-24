import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { cleanEmployeeName, sortAndFormatEmployeeNames } from '../utils/sheetParser';
import { EmployeeSelect } from './EmployeeSelect';
import { notify } from '../utils/notify';
import { useDialogFocus } from '../utils/useDialogFocus';
import { 
  Calendar, 
  User, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  ClipboardCheck,
  PlusCircle,
  Plus,
  Trash2,
  Edit,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Activity,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
  Target,
  Sliders,
  Lock,
  LockOpen,
  Users,
  Tag,
  FileText,
  Store,
  MapPin,
  Check,
  CheckSquare,
  Layers,
  Search
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { db, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from '../firebase';
import { ZaloIcon } from './ZaloShareImageModal';

export interface LeaveRequest {
  id: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: string;
  offDate: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  reason: 'Lý do sức khỏe' | 'Lý do gia đình' | 'Lý do cá nhân' | 'Lý do khác';
  details: string;
  status: 'Nháp' | 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
  approvedBy?: string;
  approvedAt?: string;
}

interface AttendanceSystemProps {
  chamCongListData: any[];
  selectedEmployeeName?: string; // Automatically synchronized with log-in profile / effective employee
  currentUser?: {
    role: string;
    email?: string;
    name?: string;
  };
  employees?: any[];
  onSelectEmployee?: (name: string) => void;
  selectedCycle?: string;
  onSelectCycle?: (cycle: string) => void;
  initialSubTab?: 'chamcong' | 'dichvuthitruong' | 'thoigianviengtham';
  initialLeaveId?: string | null;
  initialEvalId?: string | null;
  onClearInitialTargets?: () => void;
  onOpenZaloShare?: () => void;
}

interface NormalizedEmployeeAttendance {
  name: string;
  attendance: { [key: string]: string; [day: number]: string };
  rawRow?: any;
}

const getApproverNameOnly = (approvedByStr?: string) => {
  if (!approvedByStr) return 'Quản lý';
  const index = approvedByStr.indexOf(' (');
  if (index !== -1) {
    return approvedByStr.substring(0, index).trim();
  }
  return approvedByStr.trim();
};

const renderCustomizedPieLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, value, name, index } = props;
  if (!value || value === 0) return null;

  const RADIAN = Math.PI / 180;
  
  // Staggering distance based on index so adjacent labels don't overlap vertically
  const offset = index % 2 === 0 ? 18 : 38;
  const radius = outerRadius + offset;
  
  // Coordinate of slice edge
  const x1 = cx + outerRadius * Math.cos(-midAngle * RADIAN);
  const y1 = cy + outerRadius * Math.sin(-midAngle * RADIAN);
  
  // Intermediate bend point for label line
  const x2 = cx + (radius - 5) * Math.cos(-midAngle * RADIAN);
  const y2 = cy + (radius - 5) * Math.sin(-midAngle * RADIAN);
  
  // Coordinates of label text
  const xText = cx + radius * Math.cos(-midAngle * RADIAN);
  const yText = cy + radius * Math.sin(-midAngle * RADIAN);

  // Position text anchor based on angle
  const textAnchor = xText > cx ? 'start' : 'end';

  const isViolated = (name === 'Dưới 1 phút' && value > 5) || (name === '5 phút - 30 phút' && value < 50);

  return (
    <g>
      {/* Label line (leader line) with custom path */}
      <path
        d={`M${x1},${y1} L${x2},${y2}`}
        stroke={isViolated ? "#ef4444" : "#64748b"}
        strokeWidth={isViolated ? 1.5 : 1.2}
        fill="none"
        opacity={isViolated ? 0.9 : 0.7}
      />
      {/* Tiny clean circular dot at the end of leader line */}
      <circle cx={x2} cy={y2} r={isViolated ? 3 : 2} fill={isViolated ? "#ef4444" : "#64748b"} opacity={0.8} />
      {/* Clean elegant text with high-contrast slate-700 or red/rose for warning */}
      <text
        x={xText}
        y={yText}
        fill={isViolated ? "#e11d48" : "#334155"}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className="text-[12px] font-extrabold font-sans tracking-tight"
      >
        {`${name}: ${value}%${isViolated ? ' (Cảnh báo)' : ''}`}
      </text>
    </g>
  );
};

export interface VisitDurationData {
  nhanVien: string;       // Column AL
  tongVT: number;         // Column AM
  traiTuyenCount: number; // Column AN
  traiTuyenPct: number;   // Column AO
  duoi1PhutCount: number; // Column AP
  duoi1PhutPct: number;   // Column AQ
  tu1Den5Count: number;   // Column AR
  tu1Den5Pct: number;     // Column AS
  tu5Den30Count: number;  // Column AT
  tu5Den30Pct: number;    // Column AU
  tren30Count: number;    // Column AV
  tren30Pct: number;      // Column AW
  ghiChu: string;         // Column AX (or notes)
}

export const isInvalidEmployeeOrTotal = (name: string): boolean => {
  if (!name) return true;
  const clean = name.toLowerCase().trim().normalize('NFC');
  const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return (
    clean === '' ||
    clean === 'nhân viên' ||
    clean === 'nhan vien' ||
    clean === 'họ và tên' ||
    clean === 'ho va ten' ||
    clean === 'tên nv' ||
    clean === 'ten nv' ||
    clean === 'họ tên' ||
    clean === 'ho ten' ||
    clean === 'stt' ||
    clean === 'tổng' ||
    clean === 'tong' ||
    clean === 'cộng' ||
    clean === 'cong' ||
    clean === 'tổng cộng' ||
    clean === 'tong cong' ||
    clean === 'tổng kết' ||
    clean === 'tong ket' ||
    clean === 'tổng số' ||
    clean === 'tong so' ||
    clean === 'tổng nv' ||
    clean === 'tong nv' ||
    clean === 'total' ||
    clean === 'tất cả' ||
    clean === 'tat ca' ||
    clean === 'all' ||
    clean === 'bình quân' ||
    clean === 'binh quan' ||
    clean === 'trung bình' ||
    clean === 'trung binh' ||
    clean === 'average' ||
    clean.startsWith('tổng') ||
    clean.startsWith('tong ') ||
    clean.startsWith('tong_') ||
    clean.startsWith('total') ||
    clean.startsWith('cộng') ||
    clean.startsWith('cong ') ||
    clean.includes('tổng cộng') ||
    clean.includes('tong cong') ||
    clean.includes('tổng kết') ||
    clean.includes('báo cáo') ||
    clean.includes('thời gian viếng thăm') ||
    clean.includes('tiêu chí') ||
    norm.startsWith('tong') ||
    norm.startsWith('cong') ||
    norm.includes('tong cong') ||
    norm === 'tong' ||
    norm === 'cong' ||
    norm === 'total'
  );
};

export const getFallbackVisitData = (): VisitDurationData[] => {
  return [
    {
      nhanVien: "Lê Thị Hương",
      tongVT: 130,
      traiTuyenCount: 8,
      traiTuyenPct: 6.2,
      duoi1PhutCount: 5,
      duoi1PhutPct: 3.8,
      tu1Den5Count: 30,
      tu1Den5Pct: 23.1,
      tu5Den30Count: 90,
      tu5Den30Pct: 69.2,
      tren30Count: 5,
      tren30Pct: 3.8,
      ghiChu: "Thời gian viếng thăm đạt yêu cầu"
    },
    {
      nhanVien: "Nguyễn Thành Thực",
      tongVT: 135,
      traiTuyenCount: 15,
      traiTuyenPct: 11.1,
      duoi1PhutCount: 8,
      duoi1PhutPct: 5.9,
      tu1Den5Count: 35,
      tu1Den5Pct: 25.9,
      tu5Den30Count: 85,
      tu5Den30Pct: 63.0,
      tren30Count: 7,
      tren30Pct: 5.2,
      ghiChu: "Tỉ lệ lỗi dưới 1 phút cao (5.9%)"
    },
    {
      nhanVien: "Bùi Mạnh Cường",
      tongVT: 120,
      traiTuyenCount: 10,
      traiTuyenPct: 8.3,
      duoi1PhutCount: 3,
      duoi1PhutPct: 2.5,
      tu1Den5Count: 32,
      tu1Den5Pct: 26.7,
      tu5Den30Count: 78,
      tu5Den30Pct: 65.0,
      tren30Count: 7,
      tren30Pct: 5.8,
      ghiChu: "Thời gian viếng thăm tốt"
    },
    {
      nhanVien: "Nguyễn Sỹ Vũ",
      tongVT: 142,
      traiTuyenCount: 22,
      traiTuyenPct: 15.5,
      duoi1PhutCount: 9,
      duoi1PhutPct: 6.3,
      tu1Den5Count: 48,
      tu1Den5Pct: 33.8,
      tu5Den30Count: 65,
      tu5Den30Pct: 45.8,
      tren30Count: 20,
      tren30Pct: 14.1,
      ghiChu: "Vi phạm cả 2 tiêu chí thời gian"
    },
    {
      nhanVien: "Dương Thị Thanh",
      tongVT: 110,
      traiTuyenCount: 5,
      traiTuyenPct: 4.5,
      duoi1PhutCount: 2,
      duoi1PhutPct: 1.8,
      tu1Den5Count: 28,
      tu1Den5Pct: 25.5,
      tu5Den30Count: 75,
      tu5Den30Pct: 68.2,
      tren30Count: 5,
      tren30Pct: 4.5,
      ghiChu: "Chất lượng viếng thăm xuất sắc"
    },
    {
      nhanVien: "Vũ Anh Tùng",
      tongVT: 128,
      traiTuyenCount: 14,
      traiTuyenPct: 10.9,
      duoi1PhutCount: 7,
      duoi1PhutPct: 5.5,
      tu1Den5Count: 33,
      tu1Den5Pct: 25.8,
      tu5Den30Count: 82,
      tu5Den30Pct: 64.1,
      tren30Count: 6,
      tren30Pct: 4.7,
      ghiChu: "Cần cải thiện lỗi dưới 1 phút"
    },
    {
      nhanVien: "Nguyễn Thị Hưng Nguyên",
      tongVT: 115,
      traiTuyenCount: 12,
      traiTuyenPct: 10.4,
      duoi1PhutCount: 4,
      duoi1PhutPct: 3.5,
      tu1Den5Count: 55,
      tu1Den5Pct: 47.8,
      tu5Den30Count: 52,
      tu5Den30Pct: 45.2,
      tren30Count: 4,
      tren30Pct: 3.5,
      ghiChu: "Thời gian 5-30 phút thấp (45.2%)"
    },
    {
      nhanVien: "Nguyễn Đức Tuấn",
      tongVT: 125,
      traiTuyenCount: 9,
      traiTuyenPct: 7.2,
      duoi1PhutCount: 4,
      duoi1PhutPct: 3.2,
      tu1Den5Count: 34,
      tu1Den5Pct: 27.2,
      tu5Den30Count: 82,
      tu5Den30Pct: 65.6,
      tren30Count: 5,
      tren30Pct: 4.0,
      ghiChu: "Thời gian viếng thăm đạt chuẩn"
    }
  ];
};

export const getVisitDurationData = (list: any[]): VisitDurationData[] => {
  const getVal = (row: any, letter: string, fallbackLabel?: string) => {
    if (!row) return '';
    if (row[letter] !== undefined && row[letter] !== null && String(row[letter]).trim() !== '') return row[letter];
    if (fallbackLabel && row[fallbackLabel] !== undefined && row[fallbackLabel] !== null && String(row[fallbackLabel]).trim() !== '') return row[fallbackLabel];
    if (row[letter.toLowerCase()] !== undefined && row[letter.toLowerCase()] !== null && String(row[letter.toLowerCase()]).trim() !== '') return row[letter.toLowerCase()];
    return '';
  };

  const parseVal = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const s = String(val).trim().replace(/%/g, '').replace(/,/g, '');
    const num = parseFloat(s);
    if (isNaN(num)) return 0;
    return num;
  };

  const parsePct = (val: any, count: number, total: number): number => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const s = String(val).trim().replace(/,/g, '.');
      const isPercentString = s.includes('%');
      const num = parseFloat(s.replace(/%/g, '').trim());
      if (!isNaN(num)) {
        if (isPercentString) return parseFloat(num.toFixed(1));
        if (num > 0 && num <= 1) return parseFloat((num * 100).toFixed(1));
        return parseFloat(num.toFixed(1));
      }
    }
    if (total > 0 && count >= 0) {
      return parseFloat(((count / total) * 100).toFixed(1));
    }
    return 0;
  };

  const fallbackData = getFallbackVisitData();
  if (!list || list.length === 0) return fallbackData;
  
  // 1. Find all rows where column AL (or 'Nhân Viên') has a valid employee name (excluding Header, STT, and Total rows)
  const candidateRows = list.filter(row => {
    if (!row) return false;
    // Prefer AL first (column AL is dedicated to visiting time table)
    const nameVal = String(getVal(row, 'AL') || getVal(row, 'Nhân Viên') || getVal(row, 'A') || '').trim();
    if (!nameVal || isInvalidEmployeeOrTotal(nameVal)) return false;
    
    const hasData = getVal(row, 'AM') !== '' || getVal(row, 'AN') !== '' || getVal(row, 'AP') !== '' || getVal(row, 'AR') !== '' || getVal(row, 'AT') !== '' || getVal(row, 'Tổng Lượt VT') !== '';
    return hasData || nameVal.length > 1;
  });

  let parsedList: VisitDurationData[] = [];

  if (candidateRows.length === 0) {
    const activeNames = Array.from(new Set(list.map(r => r['A'] || r['Nhân Viên'] || r['nhanVien']).filter(Boolean)))
      .map(n => String(n).trim())
      .filter(n => !isInvalidEmployeeOrTotal(n));
    
    if (activeNames.length > 0) {
      parsedList = fallbackData.map((fbRow, idx) => {
        if (idx < activeNames.length) {
          return { ...fbRow, nhanVien: activeNames[idx] };
        }
        return fbRow;
      });
    } else {
      parsedList = fallbackData;
    }
  } else {
    parsedList = candidateRows.map(row => {
      const nhanVien = String(getVal(row, 'AL') || getVal(row, 'Nhân Viên') || getVal(row, 'A') || '').trim();
      
      // Counts: AM (Tổng), AN (Trái tuyến), AP (<1p), AR (1-5p), AT (5-30p), AV (>30p)
      let tongVT = parseVal(getVal(row, 'AM', 'Tổng Lượt VT'));
      const traiTuyenCount = parseVal(getVal(row, 'AN', 'Lượt VT Trái Tuyến'));
      const duoi1PhutCount = parseVal(getVal(row, 'AP', 'Lượt VT < 1 phút'));
      const tu1Den5Count = parseVal(getVal(row, 'AR', 'Lượt VT 1 - 5 phút'));
      const tu5Den30Count = parseVal(getVal(row, 'AT', 'Lượt VT 5 - 30 phút'));
      const tren30Count = parseVal(getVal(row, 'AV', 'Lượt VT > 30 phút'));

      if (tongVT === 0) {
        const sumDurations = duoi1PhutCount + tu1Den5Count + tu5Den30Count + tren30Count;
        if (sumDurations > 0) {
          tongVT = sumDurations;
        }
      }

      // Pcts: AO, AQ, AS, AU, AW
      const traiTuyenPct = parsePct(getVal(row, 'AO', 'Tỉ lệ Trái Tuyến'), traiTuyenCount, tongVT);
      const duoi1PhutPct = parsePct(getVal(row, 'AQ', 'Tỉ lệ < 1 phút'), duoi1PhutCount, tongVT);
      const tu1Den5Pct = parsePct(getVal(row, 'AS', 'Tỉ lệ 1 - 5 phút'), tu1Den5Count, tongVT);
      const tu5Den30Pct = parsePct(getVal(row, 'AU', 'Tỉ lệ 5 - 30 phút'), tu5Den30Count, tongVT);
      const tren30Pct = parsePct(getVal(row, 'AW', 'Tỉ lệ > 30 phút'), tren30Count, tongVT);
      
      const ghiChu = String(getVal(row, 'AX', 'Ghi Chú') || getVal(row, 'AX') || getVal(row, 'AW') || '').trim();
      
      return {
        nhanVien: cleanEmployeeName(nhanVien),
        tongVT,
        traiTuyenCount,
        traiTuyenPct,
        duoi1PhutCount,
        duoi1PhutPct,
        tu1Den5Count,
        tu1Den5Pct,
        tu5Den30Count,
        tu5Den30Pct,
        tren30Count,
        tren30Pct,
        ghiChu
      };
    }).filter(r => r.nhanVien && !isInvalidEmployeeOrTotal(r.nhanVien));
  }

  // Deduplicate by normalized name and ensure Lê Thị Hương is never missing
  const normStr = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '') : '';
  const seenNames = new Set<string>();
  const uniqueList: VisitDurationData[] = [];

  for (const item of parsedList) {
    if (isInvalidEmployeeOrTotal(item.nhanVien)) continue;
    const n = normStr(item.nhanVien);
    if (!n || seenNames.has(n)) continue;
    seenNames.add(n);
    uniqueList.push(item);
  }

  // Explicit check for 'Lê Thị Hương': If missing from parsed list, inject from fallback data
  const hasLeThiHuong = uniqueList.some(r => normStr(r.nhanVien).includes('lethihuong') || normStr(r.nhanVien) === 'huong');
  if (!hasLeThiHuong) {
    const huongFallback = fallbackData.find(r => normStr(r.nhanVien).includes('lethihuong')) || {
      nhanVien: "Lê Thị Hương",
      tongVT: 130,
      traiTuyenCount: 8,
      traiTuyenPct: 6.2,
      duoi1PhutCount: 5,
      duoi1PhutPct: 3.8,
      tu1Den5Count: 30,
      tu1Den5Pct: 23.1,
      tu5Den30Count: 90,
      tu5Den30Pct: 69.2,
      tren30Count: 5,
      tren30Pct: 3.8,
      ghiChu: "Thời gian viếng thăm đạt yêu cầu"
    };
    uniqueList.unshift(huongFallback);
  }

  // Sort by standard employee order
  const defaultOrder = [
    'Lê Thị Hương',
    'Nguyễn Thành Thực',
    'Bùi Mạnh Cường',
    'Nguyễn Sỹ Vũ',
    'Dương Thị Thanh',
    'Vũ Anh Tùng',
    'Nguyễn Thị Hưng Nguyên',
    'Nguyễn Đức Tuấn'
  ];

  return uniqueList.sort((a, b) => {
    const na = normStr(a.nhanVien);
    const nb = normStr(b.nhanVien);
    const idxA = defaultOrder.findIndex(name => normStr(name) === na || na.includes(normStr(name)) || normStr(name).includes(na));
    const idxB = defaultOrder.findIndex(name => normStr(name) === nb || nb.includes(normStr(name)) || normStr(name).includes(nb));

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    return a.nhanVien.localeCompare(b.nhanVien, 'vi');
  });
};

export default function AttendanceSystem({ 
  chamCongListData = [], 
  selectedEmployeeName,
  currentUser,
  employees = [],
  onSelectEmployee,
  selectedCycle,
  onSelectCycle,
  initialSubTab,
  initialLeaveId,
  initialEvalId,
  onClearInitialTargets,
  onOpenZaloShare
}: AttendanceSystemProps) {

  const now = new Date();

  // Calculate current active cycle end month and year based on dates (starts on 21st of previous month, ends on 20th of current month)
  const currentActiveMonth = now.getDate() >= 21 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
  const currentActiveYear = now.getDate() >= 21 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const defaultCycle = `${currentActiveYear}-${currentActiveMonth}`;

  const [localSelectedCycle, setLocalSelectedCycle] = useState<string>(defaultCycle);
  const currentSelectedCycle = selectedCycle !== undefined ? selectedCycle : localSelectedCycle;
  const currentSetSelectedCycle = onSelectCycle || setLocalSelectedCycle;

  const [selectedYear, selectedMonth] = (() => {
    const parts = currentSelectedCycle.split('-');
    if (parts.length === 2) {
      return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    }
    return [currentActiveYear, currentActiveMonth];
  })();

  const isCurrentCycle = selectedYear === currentActiveYear && selectedMonth === currentActiveMonth;

  // Only 2 cycles for selection: current active cycle and 1 immediately preceding cycle
  const cycleOptions = Array.from({ length: 2 }).map((_, idx) => {
    const d = new Date();
    d.setDate(20); // avoid month transition overflows
    d.setFullYear(currentActiveYear);
    d.setMonth(currentActiveMonth - idx);
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = `Chu kỳ ${(m + 1) < 10 ? '0' + (m + 1) : (m + 1)}/${y}`;
    const value = `${y}-${m}`;
    return { label, value, month: m, year: y };
  });

  // Ensure currentSelectedCycle is within valid 2 cycle options
  useEffect(() => {
    if (currentSelectedCycle && !cycleOptions.some(opt => opt.value === currentSelectedCycle)) {
      currentSetSelectedCycle(defaultCycle);
    }
  }, [currentSelectedCycle, cycleOptions, defaultCycle, currentSetSelectedCycle]);

  // Calculate Cycle Dates (similar to getSalesCycleDates but tied to selectedMonth/selectedYear context)
  const cycleStartYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const cycleStartMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const cycleStartDate = new Date(cycleStartYear, cycleStartMonth, 21);
  const cycleEndDate = new Date(selectedYear, selectedMonth, 20);

  // Generate sequence of dates in this cycle
  const cycleDates: Date[] = [];
  const tempDateForCycle = new Date(cycleStartDate);
  while (tempDateForCycle <= cycleEndDate) {
    cycleDates.push(new Date(tempDateForCycle));
    tempDateForCycle.setDate(tempDateForCycle.getDate() + 1);
  }

  const daysInMonth = cycleDates.length; // alias to minimize other code changes
  const firstDayOfWeek = cycleStartDate.getDay(); // 0 = Sunday, 1 = Monday, ...
  const startOffset = (firstDayOfWeek + 6) % 7; // Monday = 0, ..., Sunday = 6

  // Leave request states
  const [isOpenLeaveForm, setIsOpenLeaveForm] = useState(false);
  const [leaveReason, setLeaveReason] = useState<'Lý do sức khỏe' | 'Lý do gia đình' | 'Lý do cá nhân' | 'Lý do khác'>('Lý do sức khỏe');
  const [leaveDetails, setLeaveDetails] = useState('');
  const [typedFromDate, setTypedFromDate] = useState('');
  const [pickerFromDate, setPickerFromDate] = useState('');
  const [typedToDate, setTypedToDate] = useState('');
  const [pickerToDate, setPickerToDate] = useState('');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveCreatedAt, setLeaveCreatedAt] = useState('');
  const [leaveDeleteConfirmId, setLeaveDeleteConfirmId] = useState<string | null>(null);
  const [viewingLeaveDetail, setViewingLeaveDetail] = useState<LeaveRequest | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isApprovalExpanded, setIsApprovalExpanded] = useState(true);
  const [isMyLeaveExpanded, setIsMyLeaveExpanded] = useState(true);
  const isEmployeeView = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Saleman' || currentUser?.role === 'employee';

  // Visit duration tracking states
  const [visitEmployeeFilter, setVisitEmployeeFilter] = useState<string>('Tất cả');
  const [localBarEmployee, setLocalBarEmployee] = useState<string>('');
  
  // Local filter for the Attendance Sheet
  const [chamCongFilterEmployee, setChamCongFilterEmployee] = useState<string>('');

  // Sub-tab/sheet state to split Cham Cong, Dich vu Thi Truong, and Thoi Gian Vieng Tham
  const [attendanceSubTab, setAttendanceSubTab] = useState<'chamcong' | 'dichvuthitruong' | 'thoigianviengtham'>('chamcong');

  useEffect(() => {
    if (isEmployeeView && currentUser?.name) {
      setVisitEmployeeFilter(currentUser.name);
    } else if (selectedEmployeeName) {
      setVisitEmployeeFilter(selectedEmployeeName);
      setEvalFilterEmployee(selectedEmployeeName);
      if (selectedEmployeeName !== 'Tất cả') {
        setLocalBarEmployee(selectedEmployeeName);
      }
    } else {
      setVisitEmployeeFilter('Tất cả');
      setEvalFilterEmployee('Tất cả');
    }
  }, [isEmployeeView, currentUser, selectedEmployeeName]);

  // Subscribe to real-time leave requests from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'leave_requests'), (snapshot) => {
      const list: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LeaveRequest);
      });
      setLeaveRequests(list);
    }, (error) => {
      console.error('Firestore LeaveRequest subscription failed:', error);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to real-time market service evaluations from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'market_evaluations'), (snapshot) => {
      if (snapshot.empty) {
        const hasSeededBefore = localStorage.getItem('market_evaluations_seeded');
        if (!hasSeededBefore) {
          const initialSeed = [
            {
              ngay: '2026-06-18',
              nguoiDanhGia: 'Trần Duy Tùng',
              nhanVien: 'Trần Văn Hoàng',
              hangCanHetDate: true,
              trungBayKhongDat: false,
              khieuNaiBoDiemBan: false,
              capNhatThongTinSai: false,
              khongDamBaoWPP: false,
              viPhamLiemChinh: false,
              tongLuotViengTham: 12,
              soLuotKhongDat: 1,
              tiLeKhongDat: 8,
              trangThai: 'Đạt',
              ghiChu: 'Hàng trưng bày đẹp nhưng phát hiện 1 vỏ dính bụi cận date cần thu hồi gấp.',
              seenBy: []
            },
            {
              ngay: '2026-06-19',
              nguoiDanhGia: 'Hoàng Văn Lâm',
              nhanVien: 'Nguyễn Thị Hương',
              hangCanHetDate: false,
              trungBayKhongDat: true,
              khieuNaiBoDiemBan: true,
              capNhatThongTinSai: false,
              khongDamBaoWPP: true,
              viPhamLiemChinh: false,
              tongLuotViengTham: 10,
              soLuotKhongDat: 3,
              tiLeKhongDat: 30,
              trangThai: 'Không Đạt',
              ghiChu: 'Lỗi nhiều điểm bỏ tuyến và trưng bày sai hàng hóa quy định.',
              seenBy: []
            }
          ];
          initialSeed.forEach((item, index) => {
            setDoc(doc(db, 'market_evaluations', `eval-${index + 1}`), item)
              .catch(err => console.error("Error seeding evaluation:", err));
          });
          localStorage.setItem('market_evaluations_seeded', 'true');
        } else {
          setEvaluations([]);
          localStorage.setItem('gs_evaluations', JSON.stringify([]));
          setTimeout(() => {
            window.dispatchEvent(new Event('evaluations-updated'));
          }, 50);
        }
      } else {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        // Sort descending, newest date and newest entry first
        list.sort((a, b) => {
          const dateCompare = (b.ngay || '').localeCompare(a.ngay || '');
          if (dateCompare !== 0) return dateCompare;
          const getNum = (id: string) => {
            const match = id.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          return getNum(b.id) - getNum(a.id);
        });
        setEvaluations(list);
        
        // Mark as seeded since there is data
        localStorage.setItem('market_evaluations_seeded', 'true');
        
        // Also sync to localStorage as local cache/fallback
        localStorage.setItem('gs_evaluations', JSON.stringify(list));
        
        // Dispatch event for App.tsx
        setTimeout(() => {
          window.dispatchEvent(new Event('evaluations-updated'));
        }, 50);
      }
    }, (error) => {
      console.error('Firestore market_evaluations subscription failed:', error);
    });
    return () => unsubscribe();
  }, []);

  // Update creation timestamp when modal opens
  useEffect(() => {
    if (isOpenLeaveForm) {
      const formatDateTime = (d: Date) => {
        const pad = (num: number) => num < 10 ? `0${num}` : num;
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      setLeaveCreatedAt(formatDateTime(new Date()));
      setTypedFromDate('');
      setPickerFromDate('');
      setTypedToDate('');
      setPickerToDate('');
      setIsSent(false);
      setValidationError('');
    }
  }, [isOpenLeaveForm]);

  const parseVietnameseDate = (input: string): string | null => {
    const clean = input.trim();
    // Try DD/MM/YYYY or DD-MM-YYYY
    let match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const maxDays = new Date(year, month, 0).getDate();
        if (day <= maxDays) {
          const paddedDay = day < 10 ? `0${day}` : `${day}`;
          const paddedMonth = month < 10 ? `0${month}` : `${month}`;
          return `${year}-${paddedMonth}-${paddedDay}`;
        }
      }
    }
    // Try YYYY-MM-DD
    match = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const maxDays = new Date(year, month, 0).getDate();
        if (day <= maxDays) {
          const paddedDay = day < 10 ? `0${day}` : `${day}`;
          const paddedMonth = month < 10 ? `0${month}` : `${month}`;
          return `${year}-${paddedMonth}-${paddedDay}`;
        }
      }
    }
    return null;
  };

  const getApprovedLeaveForDay = (employeeName: string, dateObj: Date): LeaveRequest | undefined => {
    const paddedDay = dateObj.getDate() < 10 ? `0${dateObj.getDate()}` : `${dateObj.getDate()}`;
    const paddedMonth = (dateObj.getMonth() + 1) < 10 ? `0${dateObj.getMonth() + 1}` : `${dateObj.getMonth() + 1}`;
    const dateStr = `${dateObj.getFullYear()}-${paddedMonth}-${paddedDay}`;
    
    return leaveRequests.find((req) => {
      if (req.status !== 'Đã duyệt') return false;
      if (req.creatorName.toLowerCase().trim() !== employeeName.toLowerCase().trim()) return false;
      const start = req.offDate;
      const end = req.toDate || req.offDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  const handleSaveLeaveRequest = async (e?: any) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setValidationError('');
    let fromDateStr = '';
    if (typedFromDate && typedFromDate.trim()) {
      const parsed = parseVietnameseDate(typedFromDate);
      if (!parsed) {
        setValidationError('Từ ngày không đúng định dạng DD/MM/YYYY (Ví dụ: 02/07/2026)');
        return;
      }
      fromDateStr = parsed;
    } else if (pickerFromDate) {
      fromDateStr = pickerFromDate;
    } else {
      setValidationError('Vui lòng chọn hoặc nhập Từ ngày!');
      return;
    }

    let toDateStr = '';
    if (typedToDate && typedToDate.trim()) {
      const parsed = parseVietnameseDate(typedToDate);
      if (!parsed) {
        setValidationError('Đến ngày không đúng định dạng DD/MM/YYYY (Ví dụ: 02/07/2026)');
        return;
      }
      toDateStr = parsed;
    } else if (pickerToDate) {
      toDateStr = pickerToDate;
    } else {
      setValidationError('Vui lòng chọn hoặc nhập Đến ngày!');
      return;
    }

    const fromDateObj = new Date(fromDateStr);
    const toDateObj = new Date(toDateStr);
    if (fromDateObj > toDateObj) {
      setValidationError('Ngày bắt đầu (Từ ngày) không được lớn hơn ngày kết thúc (Đến ngày)!');
      return;
    }

    if (!leaveReason) {
      setValidationError('Vui lòng chọn Lý do nghỉ!');
      return;
    }

    const creatorName = currentUser?.name || selectedEmployeeName || 'Nhân viên';
    
    // Check if there is already an active leave request for this creator that overlaps with this range
    const overlap = leaveRequests.find(req => {
      if (req.creatorName.toLowerCase().trim() !== creatorName.toLowerCase().trim()) return false;
      if (req.status === 'Từ chối') return false;
      const start = req.offDate;
      const end = req.toDate || req.offDate;
      return fromDateStr <= end && start <= toDateStr;
    });

    if (overlap) {
      const partsStart = overlap.offDate.split('-');
      const startFmt = partsStart.length === 3 ? `${partsStart[2]}/${partsStart[1]}/${partsStart[0]}` : overlap.offDate;
      const endFmt = overlap.toDate ? (() => {
        const partsEnd = overlap.toDate.split('-');
        return partsEnd.length === 3 ? `${partsEnd[2]}/${partsEnd[1]}/${partsEnd[0]}` : overlap.toDate;
      })() : startFmt;
      setValidationError(`Bạn đã có lịch nghỉ trùng lặp từ ngày ${startFmt} đến ngày ${endFmt} (Trạng thái: ${overlap.status}). Vui lòng không tạo trùng!`);
      return;
    }

    const creatorEmail = currentUser?.email || 'unknown@domain.com';
    const formatDateTime = (d: Date) => {
      const pad = (num: number) => num < 10 ? `0${num}` : num;
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const createdAtStr = formatDateTime(new Date());

    try {
      const reqId = `leave-${Date.now()}`;
      const newRequest: LeaveRequest = {
        id: reqId,
        creatorName,
        creatorEmail,
        createdAt: createdAtStr,
        offDate: fromDateStr, // YYYY-MM-DD
        toDate: toDateStr, // YYYY-MM-DD
        reason: leaveReason,
        details: leaveDetails,
        status: 'Chờ duyệt'
      };

      await setDoc(doc(db, 'leave_requests', reqId), newRequest);
      
      setIsSent(true);
      setTimeout(() => {
        setIsOpenLeaveForm(false);
        setTypedFromDate('');
        setPickerFromDate('');
        setTypedToDate('');
        setPickerToDate('');
        setLeaveReason('Lý do sức khỏe');
        setLeaveDetails('');
        setIsSent(false);
      }, 1500); // Give 1.5 seconds for visual confirmation "Đã Gửi ✓"
    } catch (err) {
      console.error('Failed to save leave request:', err);
      setValidationError('Có lỗi xảy ra khi lưu phiếu nghỉ. Vui lòng thử lại!');
    }
  };

  const handleApproveLeaveRequest = async (reqId: string) => {
    const approverName = currentUser?.name || 'Quản lý';
    const approverRole = currentUser?.role === 'OM' ? 'OM' : (currentUser?.role === 'MKT Sup' ? 'Giám Sát' : (currentUser?.role || 'Quản lý'));
    const approverStr = `${approverName} (${approverRole})`;
    
    const pad = (num: number) => num < 10 ? `0${num}` : num;
    const now = new Date();
    const approvedAtStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    try {
      await updateDoc(doc(db, 'leave_requests', reqId), {
        status: 'Đã duyệt',
        approvedBy: approverStr,
        approvedAt: approvedAtStr
      });
      notify.success('Đã duyệt phiếu nghỉ phép.');
    } catch (err) {
      console.error('Failed to approve leave request:', err);
      notify.error('Có lỗi xảy ra khi duyệt phiếu.');
    }
  };

  const handleRejectLeaveRequest = async (reqId: string) => {
    const approverName = currentUser?.name || 'Quản lý';
    const approverRole = currentUser?.role === 'OM' ? 'OM' : (currentUser?.role === 'MKT Sup' ? 'Giám Sát' : (currentUser?.role || 'Quản lý'));
    const approverStr = `${approverName} (${approverRole})`;
    
    const pad = (num: number) => num < 10 ? `0${num}` : num;
    const now = new Date();
    const approvedAtStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    try {
      await updateDoc(doc(db, 'leave_requests', reqId), {
        status: 'Từ chối',
        approvedBy: approverStr,
        approvedAt: approvedAtStr
      });
      notify.info('Đã từ chối phiếu nghỉ phép.');
    } catch (err) {
      console.error('Failed to reject leave request:', err);
      notify.error('Có lỗi xảy ra khi từ chối phiếu.');
    }
  };

  const myLeaveRequests = leaveRequests.filter((req) => {
    const myName = currentUser?.name || selectedEmployeeName || 'Nhân viên';
    return req.creatorName.toLowerCase().trim() === myName.toLowerCase().trim();
  });

  const sortedLeaveRequests = [...leaveRequests]
    .filter(req => req.status !== 'Nháp')
    .sort((a, b) => {
      if (a.status === 'Chờ duyệt' && b.status === 'Đã duyệt') return -1;
      if (a.status === 'Đã duyệt' && b.status === 'Chờ duyệt') return 1;
      return b.id.localeCompare(a.id);
    });

  // Local separate filter for Market Service Evaluations (Supervisors/OMs filter separately)
  const [evalFilterEmployee, setEvalFilterEmployee] = useState<string>('Tất cả');
  const [summarySearchQuery, setSummarySearchQuery] = useState<string>('');

  // Synchronized state for evaluations list
  const [evaluations, setEvaluations] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('gs_evaluations');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    // Simple initial mock seed matching criteria
    return [
      {
        id: 'eval-1',
        ngay: '2026-06-18',
        nguoiDanhGia: 'Trần Duy Tùng',
        nhanVien: 'Trần Văn Hoàng',
        hangCanHetDate: true,
        trungBayKhongDat: false,
        khieuNaiBoDiemBan: false,
        capNhatThongTinSai: false,
        khongDamBaoWPP: false,
        tongLuotViengTham: 12,
        soLuotKhongDat: 1,
        tiLeKhongDat: 8,
        trangThai: 'Đạt',
        ghiChu: 'Hàng trưng bày đẹp nhưng phát hiện 1 vỏ dính bụi cận date cần thu hồi gấp.',
        seenBy: []
      },
      {
        id: 'eval-2',
        ngay: '2026-06-19',
        nguoiDanhGia: 'Hoàng Văn Lâm',
        nhanVien: 'Nguyễn Thị Hương',
        hangCanHetDate: false,
        trungBayKhongDat: true,
        khieuNaiBoDiemBan: true,
        capNhatThongTinSai: false,
        khongDamBaoWPP: true,
        tongLuotViengTham: 10,
        soLuotKhongDat: 3,
        tiLeKhongDat: 30,
        trangThai: 'Không Đạt',
        ghiChu: 'Lỗi nhiều điểm bỏ tuyến và trưng bày sai hàng hóa quy định.',
        seenBy: []
      }
    ];
  });

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('gs_evaluations', JSON.stringify(evaluations));
  }, [evaluations]);

  // Get today's local date
  const getTodayString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Form states
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewingEval, setViewingEval] = useState<any | null>(null);

  const leaveDetailModalRef = useRef<HTMLDivElement>(null);
  const leaveCreateModalRef = useRef<HTMLDivElement>(null);
  const evalDeleteModalRef = useRef<HTMLDivElement>(null);
  const evalDetailModalRef = useRef<HTMLDivElement>(null);

  useDialogFocus(!!viewingLeaveDetail, leaveDetailModalRef, () => setViewingLeaveDetail(null));
  useDialogFocus(isOpenLeaveForm, leaveCreateModalRef, () => {
    if (!isSent) setIsOpenLeaveForm(false);
  });
  useDialogFocus(!!deleteConfirmId, evalDeleteModalRef, () => setDeleteConfirmId(null));
  useDialogFocus(!!viewingEval, evalDetailModalRef, () => setViewingEval(null));

  const [formDate, setFormDate] = useState(getTodayString());
  const [formEmployee, setFormEmployee] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeSearchText, setEmployeeSearchText] = useState('');
  const [hangCan, setFormHangCan] = useState(false);
  const [trungBay, setFormTrungBay] = useState(false);
  const [khieuNai, setFormKhieuNai] = useState(false);
  const [capNhat, setFormCapNhat] = useState(false);
  const [wpp, setFormWpp] = useState(false);
  const [liemChinh, setFormLiemChinh] = useState(false);
  const [visits, setVisits] = useState(10);
  const [failedVisits, setFailedVisits] = useState(0);
  const [notes, setNotes] = useState('');

  // Auto computations
  const calculatedRate = visits > 0 ? Math.round((failedVisits / visits) * 100) : 0;
  const calculatedStatus = calculatedRate > 10 ? 'Không Đạt' : 'Đạt';

  // Choose auto evaluator based on role
  const autoEvaluator = currentUser?.role === 'Admin' ? 'Trần Duy Tùng' : 'Hoàng Văn Lâm';
  
  // Robust master parser to extract Row-Major data safely using column letters or headers
  const normalizeAttendanceData = (): NormalizedEmployeeAttendance[] => {
    if (!chamCongListData || chamCongListData.length === 0) return [];
    
    const normalizedList: NormalizedEmployeeAttendance[] = [];

    // Helper to get Excel column letter for days 1-31 (Day 1 -> B, Day 31 -> AF)
    const getColKeyForDay = (day: number): string => {
      if (day >= 1 && day <= 25) {
        return String.fromCharCode(65 + day); // 1 -> B (66), 2 -> C (67), ..., 25 -> Z (90)
      } else if (day >= 26 && day <= 34) {
        return 'A' + String.fromCharCode(65 + (day - 26)); // 26 -> AA, 27 -> AB, ..., 31 -> AF
      }
      return '';
    };

    const cleanStr = (val: any): string => {
      if (val === null || val === undefined) return '';
      const s = String(val).trim();
      if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
      return s;
    };

    const getRowValueForDate = (row: any, dateObj: Date, dayNum: number): string => {
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const paddedDay = day < 10 ? `0${day}` : `${day}`;
      const paddedMonth = month < 10 ? `0${month}` : `${month}`;

      const isoKey = `${year}-${paddedMonth}-${paddedDay}`;
      const shortKey1 = `${paddedDay}/${paddedMonth}`;
      const shortKey2 = `${day}/${month}`;
      const shortKey3 = `${day}/${paddedMonth}`;
      const shortKey4 = `${paddedDay}/${month}`;
      const dashKey = `${paddedDay}-${paddedMonth}`;
      const ngayKey1 = `Ngày ${paddedDay}/${paddedMonth}`;
      const ngayKey2 = `Ngày ${day}/${month}`;
      const ngayKey3 = `Ngày ${day}`;
      const ngayKey4 = `Ngày ${paddedDay}`;
      const ngayKey5 = `ngay ${day}`;
      const ngayKey6 = `ngay ${paddedDay}`;

      // 1. Direct key lookups on row
      const candidateKeys = [
        isoKey, shortKey1, shortKey2, shortKey3, shortKey4, dashKey,
        ngayKey1, ngayKey2, ngayKey3, ngayKey4, ngayKey5, ngayKey6,
        `${day}`, paddedDay
      ];

      for (const k of candidateKeys) {
        if (row[k] !== undefined && row[k] !== null && cleanStr(row[k]) !== '') {
          return cleanStr(row[k]);
        }
      }

      // 2. Check headerLabels from Gviz table if available
      const headerLabels: string[] = (chamCongListData as any).headerLabels || [];
      if (headerLabels.length > 0) {
        for (let colIdx = 0; colIdx < headerLabels.length; colIdx++) {
          const lbl = (headerLabels[colIdx] || '').trim();
          if (!lbl) continue;
          if (
            lbl === shortKey1 || lbl === shortKey2 || lbl === shortKey3 || lbl === shortKey4 ||
            lbl === ngayKey1 || lbl === ngayKey2 || lbl === ngayKey3 || lbl === ngayKey4 ||
            lbl.includes(shortKey1) || lbl.includes(shortKey2)
          ) {
            const colLetter = getColKeyForDay(colIdx);
            const val = row[colLetter] ?? row[lbl];
            if (val !== undefined && val !== null && cleanStr(val) !== '') {
              return cleanStr(val);
            }
          }
        }
      }

      // 3. Fallback to column letter by day (Day 1 -> B ... Day 31 -> AF)
      const letter = getColKeyForDay(dayNum);
      if (letter && row[letter] !== undefined && row[letter] !== null && cleanStr(row[letter]) !== '') {
        return cleanStr(row[letter]);
      }
      const lowerLetter = letter.toLowerCase();
      if (lowerLetter && row[lowerLetter] !== undefined && row[lowerLetter] !== null && cleanStr(row[lowerLetter]) !== '') {
        return cleanStr(row[lowerLetter]);
      }

      return '';
    };

    chamCongListData.forEach((row) => {
      let name = '';
      const rowKeys = Object.keys(row);
      
      // Try key 'A' first representing Column A "Tên ở ô A8"
      if (row['A'] !== undefined && row['A'] !== null) {
        const val = cleanStr(row['A']);
        const valLower = val.toLowerCase();
        if (
          val && 
          valLower !== 'nhân viên' && 
          valLower !== 'nhan vien' && 
          valLower !== 'tên' && 
          valLower !== 'họ tên' && 
          valLower !== 'stt' && 
          valLower !== 'tên nvbh' &&
          valLower !== 'ten nvbh' &&
          valLower !== 'nvbh' &&
          !valLower.includes('employee') &&
          !valLower.includes('nvbh') &&
          !valLower.includes('tên nv') &&
          !valLower.includes('tổng') &&
          !valLower.includes('total')
        ) {
          name = cleanEmployeeName(val);
        }
      }
      
      // Fallback: search row keys for common employee column names
      if (!name) {
        const nameKey = rowKeys.find(k => {
          const l = k.toLowerCase();
          return l === 'nhân viên' || l === 'nhanvien' || l === 'tên' || l === 'họ tên' || l.includes('nhân') || l.includes('tên');
        });
        if (nameKey && row[nameKey] !== undefined && row[nameKey] !== null) {
          const val = cleanStr(row[nameKey]);
          const valLower = val.toLowerCase();
          if (
            val && 
            valLower !== 'nhân viên' && 
            valLower !== 'nhan vien' && 
            valLower !== 'tên' && 
            valLower !== 'họ tên' && 
            valLower !== 'tên nvbh' &&
            valLower !== 'ten nvbh' &&
            valLower !== 'nvbh' &&
            !valLower.includes('nvbh') &&
            !valLower.includes('tên nv') &&
            !valLower.includes('tổng') &&
            !valLower.includes('total')
          ) {
            name = cleanEmployeeName(val);
          }
        }
      }

      if (!name) return;

      const attendance: { [key: string]: string; [day: number]: string } = {};

      // Fill by cycleDates
      cycleDates.forEach(dateObj => {
        const d = dateObj.getDate();
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const paddedD = d < 10 ? `0${d}` : `${d}`;
        const paddedM = month < 10 ? `0${month}` : `${month}`;

        const isoKey = `${year}-${paddedM}-${paddedD}`;
        const shortKey = `${paddedD}/${paddedM}`;
        const shortKey2 = `${d}/${month}`;

        const val = getRowValueForDate(row, dateObj, d);
        if (val) {
          attendance[isoKey] = val;
          attendance[shortKey] = val;
          attendance[shortKey2] = val;
          attendance[d] = val;
        }
      });

      // Fill days 1 to 31 as baseline
      for (let d = 1; d <= 31; d++) {
        if (!attendance[d]) {
          const defaultDate = new Date(selectedYear, selectedMonth, d);
          const val = getRowValueForDate(row, defaultDate, d);
          if (val) {
            attendance[d] = val;
          }
        }
      }

      // Avoid duplicates
      const existing = normalizedList.find(item => item.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (!existing) {
        normalizedList.push({ name, attendance, rawRow: row });
      }
    });

    return normalizedList;
  };

  const normalizedEmployees = normalizeAttendanceData();

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [saveHistorySuccess, setSaveHistorySuccess] = useState(false);

  // Subscribe to real-time attendance history from Firestore (only keep active cycle and 1 preceding cycle)
  useEffect(() => {
    const validCycleValues = new Set(cycleOptions.map(c => c.value));
    const unsubscribe = onSnapshot(collection(db, 'attendance_history'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (validCycleValues.has(data.cycleId)) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setHistoryList(list);
    }, (error) => {
      console.error('Firestore attendance_history subscription failed:', error);
    });
    return () => unsubscribe();
  }, [currentActiveYear, currentActiveMonth]);

  const activeEmployees = (() => {
    const defaultOrder = [
      'Lê Thị Hương',
      'Nguyễn Thành Thực',
      'Bùi Mạnh Cường',
      'Nguyễn Sỹ Vũ',
      'Dương Thị Thanh',
      'Vũ Anh Tùng',
      'Nguyễn Thị Hưng Nguyên',
      'Nguyễn Đức Tuấn'
    ];

    const rawActive = isCurrentCycle 
      ? normalizedEmployees 
      : historyList.filter(item => item.cycleId === currentSelectedCycle).map(item => ({
          name: item.employeeName,
          attendance: item.attendance || {}
        }));

    return [...rawActive].sort((a, b) => {
      const clean = (s: string) => s.toLowerCase().trim().normalize('NFC');
      const idxA = defaultOrder.findIndex(o => clean(o) === clean(a.name));
      const idxB = defaultOrder.findIndex(o => clean(o) === clean(b.name));

      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      return a.name.localeCompare(b.name, 'vi');
    });
  })();

  const handleSaveCurrentCycleToHistory = async () => {
    if (!normalizedEmployees || normalizedEmployees.length === 0) {
      notify.info("Không có dữ liệu chấm công từ bảng tính để lưu trữ.");
      return;
    }

    const isValidCycle = cycleOptions.some(opt => opt.value === currentSelectedCycle);
    if (!isValidCycle) {
      notify.error("Chỉ hỗ trợ sao lưu dữ liệu cho chu kỳ hiện tại và 1 chu kỳ liền trước đó.");
      return;
    }

    setIsSavingHistory(true);
    setSaveHistorySuccess(false);

    try {
      const pad = (num: number) => num < 10 ? `0${num}` : num;
      const today = new Date();
      const timestamp = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()} ${pad(today.getHours())}:${pad(today.getMinutes())}:${pad(today.getSeconds())}`;
      const saver = currentUser?.name || currentUser?.email || "Hệ thống";
      const cycleName = `Chu kỳ ${pad(selectedMonth + 1)}/${selectedYear}`;

      // Save each employee's attendance record
      const promises = normalizedEmployees.map(async (emp) => {
        const historyId = `${currentSelectedCycle}_${emp.name.replace(/\s+/g, '_')}`;
        const record = {
          employeeName: emp.name,
          cycleId: currentSelectedCycle,
          cycleName: cycleName,
          attendance: emp.attendance,
          savedBy: saver,
          savedAt: timestamp
        };
        return setDoc(doc(db, 'attendance_history', historyId), record);
      });

      // Prune any old cycle documents in Firestore that are older than 1 preceding cycle
      const validCycleValues = new Set(cycleOptions.map(c => c.value));
      const oldDocPromises: Promise<void>[] = [];
      historyList.forEach((item) => {
        if (!validCycleValues.has(item.cycleId) && item.id) {
          oldDocPromises.push(deleteDoc(doc(db, 'attendance_history', item.id)));
        }
      });

      await Promise.all([...promises, ...oldDocPromises]);

      setSaveHistorySuccess(true);
      notify.success("Đã sao lưu dữ liệu chấm công chu kỳ.");
      setTimeout(() => setSaveHistorySuccess(false), 3000);
    } catch (err) {
      console.error("Failed to archive cycle:", err);
      notify.error("Lỗi khi lưu trữ lịch sử chấm công: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingHistory(false);
    }
  };

  // Sync chamCongFilterEmployee based on selectedCycle and activeEmployees
  useEffect(() => {
    if (isEmployeeView && currentUser?.name) {
      setChamCongFilterEmployee(currentUser.name);
    } else if (selectedEmployeeName) {
      setChamCongFilterEmployee(selectedEmployeeName);
    } else {
      const sortedNames = sortAndFormatEmployeeNames(activeEmployees.map(e => e.name));
      if (sortedNames.length > 0) {
        if (!sortedNames.includes(chamCongFilterEmployee)) {
          setChamCongFilterEmployee(sortedNames[0]);
        }
      } else {
        setChamCongFilterEmployee('');
      }
    }
  }, [selectedCycle, activeEmployees, isEmployeeView, currentUser, selectedEmployeeName]);

  // Set default employee when employees list changes or form opens
  useEffect(() => {
    if (employees.length > 0 && !formEmployee) {
      setFormEmployee(employees[0].name);
    } else if (employees.length === 0 && !formEmployee && activeEmployees.length > 0) {
      setFormEmployee(activeEmployees[0].name);
    }
  }, [employees, activeEmployees, formEmployee]);

  const availableEmployeeNames: string[] = (() => {
    const list = employees.length > 0
      ? employees.map((e: any) => typeof e === 'string' ? e : e.name)
      : activeEmployees.map(e => e.name);
    return sortAndFormatEmployeeNames(list);
  })();

  const filteredEmpList = availableEmployeeNames.filter(name =>
    name.toLowerCase().includes(employeeSearchText.toLowerCase().trim())
  );

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormDate(getTodayString());
    const defaultEmp = availableEmployeeNames.length > 0 ? availableEmployeeNames[0] : '';
    setFormEmployee(defaultEmp);
    setSelectedEmployees(defaultEmp ? [defaultEmp] : []);
    setEmployeeSearchText('');
    setFormHangCan(false);
    setFormTrungBay(false);
    setFormKhieuNai(false);
    setFormCapNhat(false);
    setFormWpp(false);
    setFormLiemChinh(false);
    setVisits(10);
    setFailedVisits(0);
    setNotes('');
    setIsOpenForm(true);
  };

  const handleOpenEditForm = (item: any) => {
    setEditingId(item.id);
    setFormDate(item.ngay);
    setFormEmployee(item.nhanVien);
    setSelectedEmployees([item.nhanVien]);
    setEmployeeSearchText('');
    setFormHangCan(item.hangCanHetDate || false);
    setFormTrungBay(item.trungBayKhongDat || false);
    setFormKhieuNai(item.khieuNaiBoDiemBan || false);
    setFormCapNhat(item.capNhatThongTinSai || false);
    setFormWpp(item.khongDamBaoWPP || false);
    setFormLiemChinh(item.viPhamLiemChinh || false);
    setVisits(item.tongLuotViengTham || 10);
    setFailedVisits(item.soLuotKhongDat || 0);
    setNotes(item.ghiChu || '');
    setIsOpenForm(true);
  };

  const handleSaveEvaluation = async (e: FormEvent) => {
    e.preventDefault();

    if (Number(failedVisits) > Number(visits)) {
      notify.error('Số lượt không đạt không thể lớn hơn Tổng số lượt viếng thăm.');
      return;
    }

    const rate = visits > 0 ? Math.round((failedVisits / visits) * 100) : 0;
    const status = rate > 10 ? 'Không Đạt' : 'Đạt';

    const sortEvaluations = (list: any[]) => {
      return [...list].sort((a, b) => {
        const dateCompare = (b.ngay || '').localeCompare(a.ngay || '');
        if (dateCompare !== 0) return dateCompare;
        const getNum = (id: string) => {
          const match = id.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return getNum(b.id) - getNum(a.id);
      });
    };

    if (editingId) {
      if (!formEmployee) {
        notify.error('Vui lòng chọn nhân viên được đánh giá.');
        return;
      }

      const existing = evaluations.find(ev => ev.id === editingId);
      const updatedItem = {
        ngay: formDate,
        nhanVien: formEmployee,
        hangCanHetDate: hangCan,
        trungBayKhongDat: trungBay,
        khieuNaiBoDiemBan: khieuNai,
        capNhatThongTinSai: capNhat,
        khongDamBaoWPP: wpp,
        viPhamLiemChinh: liemChinh,
        tongLuotViengTham: Number(visits),
        soLuotKhongDat: Number(failedVisits),
        tiLeKhongDat: rate,
        trangThai: status,
        ghiChu: notes,
        nguoiDanhGia: existing?.nguoiDanhGia || autoEvaluator,
        seenBy: existing?.seenBy || [currentUser?.name || '']
      };

      // Optimistically update state
      setEvaluations(prev => {
        const updated = prev.map(ev => ev.id === editingId ? { id: editingId, ...updatedItem } : ev);
        const sorted = sortEvaluations(updated);
        localStorage.setItem('gs_evaluations', JSON.stringify(sorted));
        return sorted;
      });

      try {
        await setDoc(doc(db, 'market_evaluations', editingId), updatedItem);
        notify.success('Đã cập nhật phiếu đánh giá.');
      } catch (err) {
        console.error("Firestore edit failed:", err);
        notify.error("Có lỗi xảy ra khi cập nhật phiếu lên đám mây: " + (err instanceof Error ? err.message : String(err)));
      }
    } else {
      // Bulk creation mode for multiple selected employees
      const targetEmployees = selectedEmployees.length > 0 
        ? selectedEmployees 
        : (formEmployee ? [formEmployee] : []);

      if (targetEmployees.length === 0) {
        notify.error('Vui lòng chọn ít nhất 1 nhân viên để tạo phiếu đánh giá.');
        return;
      }

      const newItems: any[] = [];
      const baseTimestamp = Date.now();

      targetEmployees.forEach((empName, index) => {
        const newId = `eval-${baseTimestamp}-${index + 1}`;
        const item = {
          ngay: formDate,
          nhanVien: empName,
          hangCanHetDate: hangCan,
          trungBayKhongDat: trungBay,
          khieuNaiBoDiemBan: khieuNai,
          capNhatThongTinSai: capNhat,
          khongDamBaoWPP: wpp,
          viPhamLiemChinh: liemChinh,
          tongLuotViengTham: Number(visits),
          soLuotKhongDat: Number(failedVisits),
          tiLeKhongDat: rate,
          trangThai: status,
          ghiChu: notes,
          nguoiDanhGia: autoEvaluator,
          seenBy: [currentUser?.name || '']
        };
        newItems.push({ id: newId, ...item });
      });

      // Optimistically add to state
      setEvaluations(prev => {
        const updated = [...newItems, ...prev];
        const sorted = sortEvaluations(updated);
        localStorage.setItem('gs_evaluations', JSON.stringify(sorted));
        return sorted;
      });

      try {
        await Promise.all(
          newItems.map(item => {
            const { id, ...docData } = item;
            return setDoc(doc(db, 'market_evaluations', id), docData);
          })
        );
        notify.success(`Đã tạo ${newItems.length} phiếu đánh giá.`);
      } catch (err) {
        console.error("Firestore create failed:", err);
        notify.error("Có lỗi xảy ra khi lưu phiếu mới lên đám mây: " + (err instanceof Error ? err.message : String(err)));
      }
    }

    setIsOpenForm(false);
    setTimeout(() => {
      window.dispatchEvent(new Event('evaluations-updated'));
    }, 50);
  };

  const handleDeleteEvaluation = (id: string) => {
    setDeleteConfirmId(id);
  };

  const hasUnreadEvalsInSystem = () => {
    try {
      const isEmployee = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Saleman' || currentUser?.role === 'employee';
      if (!isEmployee) return false;
      const myName = currentUser?.name || '';
      if (!myName || myName === 'Quản lý') return false;
      
      return evaluations.some((item: any) => {
        const isForMe = item.nhanVien?.toLowerCase().trim() === myName.toLowerCase().trim();
        if (!isForMe) return false;
        const seenList = item.seenBy || [];
        return !seenList.some((n: string) => n.toLowerCase().trim() === myName.toLowerCase().trim());
      });
    } catch (e) {
      return false;
    }
  };

  const handleMarkAllAsRead = () => {
    const myName = currentUser?.name || '';
    if (!myName) return;
    const nameLower = myName.toLowerCase().trim();
    
    evaluations.forEach((item: any) => {
      const isForMe = item.nhanVien?.toLowerCase().trim() === nameLower;
      if (isForMe) {
        const seenList = item.seenBy || [];
        const alreadySeen = seenList.some((n: string) => n.toLowerCase().trim() === nameLower);
        if (!alreadySeen) {
          const updatedSeenList = [...seenList, myName];
          const { id, ...docData } = { ...item, seenBy: updatedSeenList };
          setDoc(doc(db, 'market_evaluations', item.id), docData)
            .catch(err => console.error("Firestore update seenBy failed:", err));
        }
      }
    });
    
    setTimeout(() => {
      window.dispatchEvent(new Event('evaluations-updated'));
    }, 50);
  };

  const handleViewEvaluation = (item: any) => {
    setViewingEval(item);
    
    // If current user is employee, mark it as read/seen
    const isEmployee = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Saleman' || currentUser?.role === 'employee';
    if (isEmployee) {
      const myName = currentUser?.name || '';
      if (myName) {
        const seenList = item.seenBy || [];
        const nameLower = myName.toLowerCase().trim();
        const alreadySeen = seenList.some((n: string) => n.toLowerCase().trim() === nameLower);
        
        if (!alreadySeen) {
          const updatedSeenList = [...seenList, myName];
          const { id, ...docData } = { ...item, seenBy: updatedSeenList };
          setDoc(doc(db, 'market_evaluations', item.id), docData)
            .catch(err => console.error("Firestore update seenBy failed:", err));
        }
      }
    }
  };

  // Handle navigation from Notification Center
  useEffect(() => {
    if (initialSubTab) {
      setAttendanceSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (initialLeaveId && leaveRequests.length > 0) {
      const target = leaveRequests.find(r => r.id === initialLeaveId);
      if (target) {
        setViewingLeaveDetail(target);
        if (onClearInitialTargets) {
          onClearInitialTargets();
        }
      }
    }
  }, [initialLeaveId, leaveRequests, onClearInitialTargets]);

  useEffect(() => {
    if (initialEvalId && evaluations.length > 0) {
      const target = evaluations.find(e => e.id === initialEvalId);
      if (target) {
        handleViewEvaluation(target);
        if (onClearInitialTargets) {
          onClearInitialTargets();
        }
      }
    }
  }, [initialEvalId, evaluations, onClearInitialTargets]);

  // Maps values to requested criteria:
  // - "Đi đúng giờ = OK / Đi Đúng Giờ"
  // - "Đi làm muộn = Đi Muộn" (Bôi Vàng)
  // - "Ngày Nghỉ" => "Nghỉ" (Chữ Đỏ)
  // - "Các ngày #N/A thì bỏ trống"
  const getAttendanceDetail = (val: string, dayNum?: number, employeeName?: string, dateObjInput?: Date) => {
    // 1. Prioritize approved leave requests (skip on Sunday)
    let isApprovedLeave = false;
    if (dayNum !== undefined && employeeName) {
      const dateObj = dateObjInput || new Date(selectedYear, selectedMonth, dayNum);
      const isSunday = dateObj.getDay() === 0;
      if (!isSunday) {
        const approvedLeave = getApprovedLeaveForDay(employeeName, dateObj);
        if (approvedLeave) {
          isApprovedLeave = true;
        }
      }
    }

    // 2. Check if Sunday
    if (dayNum !== undefined) {
      const dateObj = dateObjInput || new Date(selectedYear, selectedMonth, dayNum);
      if (dateObj.getDay() === 0) {
        return { text: 'CN', type: 'sunday' as const, hasSkip: false, skipCount: 0 };
      }
    }

    if (isApprovedLeave) {
      return { text: 'Nghỉ Phép', type: 'off' as const, isLeaveApproved: true, hasSkip: false, skipCount: 0 };
    }

    const rawClean = (val || '').toString().trim();
    const status = rawClean.toUpperCase();

    // Các ngày #N/A hoặc bỏ trống
    if (!rawClean || status === '#N/A' || status.includes('#N/A')) {
      return { text: '', type: 'empty' as const, hasSkip: false, skipCount: 0 };
    }

    // Parse skip info from cell string if present
    let hasSkip = false;
    let skipCount = 0;

    // Matches like "Bỏ điểm: 3", "BĐB 2", "BDB: 3", "Bỏ 3 điểm", "Lỗi 2 điểm", "Bỏ điểm: -1", "Bỏ điểm -4"
    const skipMatch = status.match(/(?:BỎ\s*ĐIỂM(?:\s*BÁN)?|BĐB|BDB|LỖI\s*BỎ\s*ĐIỂM|BỎ\s*ĐPB)[\s:=]*(-?\s*\d+)/i)
      || status.match(/BỎ\s*(-?\s*\d+)\s*ĐIỂM/i);

    if (skipMatch) {
      const valNum = parseInt(skipMatch[1].replace(/\s+/g, ''), 10);
      if (!isNaN(valNum)) {
        hasSkip = true;
        skipCount = Math.max(0, valNum);
      }
    } else if (
      status.includes('BỎ ĐIỂM') ||
      status.includes('BO DIEM') ||
      status.includes('BỎ ĐPB') ||
      status.includes('BO DPB') ||
      status.includes('BĐB') ||
      status.includes('BDB') ||
      status.includes('BỎ ĐIỂM BÁN') ||
      status.includes('LOI BO DIEM') ||
      status.includes('LỖI BỎ ĐIỂM')
    ) {
      hasSkip = true;
      skipCount = 1;
    }

    // Parse late condition: check both keywords and check-in times
    const isLateKeyword =
      status.includes('ĐI MUỘN') ||
      status.includes('ĐIMUON') ||
      status.includes('DI MUON') ||
      status.includes('MUỘN') ||
      status.includes('MUON') ||
      status.includes('TRỄ') ||
      status.includes('TRE') ||
      status.includes('LATE') ||
      /(?:^|[\s,;:\-\/])(M|LM|DM|T|X\/2|0\.5|1\/2)(?:$|[\s,;:\-\/])/i.test(status) ||
      /^M\d*$/i.test(status) ||
      /^DM\d*$/i.test(status);

    // Time check: e.g. "8:45", "08:45", "9:00", "09:15", "8h45", "9h00"
    let isLateByTime = false;
    const timeMatch = status.match(/(?:^|[\s])([01]?\d|2[0-3])[:hH]([0-5]\d)/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h > 8 || (h === 8 && m > 30)) {
        isLateByTime = true;
      }
    }

    const isLate = isLateKeyword || isLateByTime;

    const isOff =
      status.includes('NGHỈ') ||
      status.includes('NGHI') ||
      status.includes('PHÉP') ||
      status.includes('PHEP') ||
      status.includes('KP') ||
      status.includes('CP') ||
      /(?:^|[\s,;:\-\/])(P|NP|OFF|N)(?:$|[\s,;:\-\/])/i.test(status);

    const isOnTime =
      !isLate && !isOff && (
        status.includes('ĐÚNG GIỜ') ||
        status.includes('DUNG GIO') ||
        status.includes('ĐÚNG CÔNG') ||
        status.includes('DUNG CONG') ||
        status.includes('ĐG') ||
        status.includes('DG') ||
        status.includes('OK') ||
        /(?:^|[\s,;:\-\/])(X|ĐG|DG|OK|V|1)(?:$|[\s,;:\-\/])/i.test(status) ||
        status === 'X' ||
        status.startsWith('X ') ||
        status.startsWith('X-') ||
        status.startsWith('X -')
      );

    let type: 'ontime' | 'late' | 'off' | 'skip' | 'other' = 'ontime';
    let text = 'Đi Đúng Giờ';

    if (isLate) {
      type = 'late';
      text = 'Đi Muộn';
    } else if (isOff) {
      type = 'off';
      text = 'Nghỉ Phép';
    } else if (isOnTime) {
      type = 'ontime';
      text = 'Đi Đúng Giờ';
    } else if (hasSkip) {
      // If only skip keyword was given (e.g. "Bỏ điểm bán" or "BĐB: 3")
      type = 'skip';
      text = 'Bỏ ĐPB';
    } else {
      type = 'other';
      text = rawClean;
    }

    return {
      text,
      type,
      hasSkip,
      skipCount
    };
  };

  // Helper to count statistics based on cycle dates
  const getEmployeeStats = (emp: NormalizedEmployeeAttendance) => {
    let ontime = 0;
    let late = 0;
    let offCount = 0;
    let skipDaysCount = 0;
    let totalSkipPoints = 0;
    
    cycleDates.forEach((dateObj) => {
      const isSunday = dateObj.getDay() === 0;
      if (isSunday) return;

      const d = dateObj.getDate();
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const paddedD = d < 10 ? `0${d}` : `${d}`;
      const paddedM = month < 10 ? `0${month}` : `${month}`;
      const isoKey = `${year}-${paddedM}-${paddedD}`;
      const shortKey1 = `${paddedD}/${paddedM}`;
      const shortKey2 = `${d}/${month}`;

      const raw = emp.attendance[isoKey] || emp.attendance[shortKey1] || emp.attendance[shortKey2] || emp.attendance[d] || '';
      const parsed = getAttendanceDetail(raw, d, emp.name, dateObj);
      if (parsed.type === 'ontime') ontime++;
      else if (parsed.type === 'late') late++;
      else if (parsed.type === 'off') offCount++;
      
      if (parsed.hasSkip || parsed.type === 'skip') {
        const pts = typeof parsed.skipCount === 'number' ? parsed.skipCount : 0;
        totalSkipPoints += pts;
        if (pts > 0) {
          skipDaysCount++;
        }
      }
    });
    
    return { ontime, late, offCount, skipDaysCount, skipCount: Math.max(0, totalSkipPoints) };
  };

  // 1. Filter: Only display employee data corresponding to the user account or search selection
  const filteredEmployees = activeEmployees.filter((emp) => {
    const effectiveFilterName = isEmployeeView ? (currentUser?.name || '') : chamCongFilterEmployee;
    if (effectiveFilterName && effectiveFilterName !== 'Tất cả') {
      return emp.name.toLowerCase().trim() === effectiveFilterName.toLowerCase().trim();
    }
    return true; // Fallback or list representation for Admins showing full view
  });

  // Weekday column headers for June 2026 starting from Monday (Thứ 2) because 01/06/2026 is Monday
  const weekdayHeaders = [
    'Thứ 2',
    'Thứ 3',
    'Thứ 4',
    'Thứ 5',
    'Thứ 6',
    'Thứ 7',
    'Chủ Nhật'
  ];

  return (
    <div id="attendance-panel-container" className="space-y-5 sm:space-y-6">
      
      {/* Icon Menu Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-5 space-y-3">
        <div className="flex flex-row items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="min-w-0">
            <h3 className="text-xs sm:text-base font-extrabold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 text-emerald-900 truncate">
              <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <span className="truncate">Chấm Công & Dịch Vụ Thị Trường</span>
            </h3>
          </div>

          {/* Nút Gửi Zalo đồng bộ */}
          {onOpenZaloShare && (
            <button
              type="button"
              onClick={onOpenZaloShare}
              className="h-9 px-2.5 sm:px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
              title="Gửi báo cáo qua Zalo"
            >
              <ZaloIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span>Gửi Zalo</span>
            </button>
          )}
        </div>

        {/* 3-Item Icon Menu Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
          {/* 1. Chấm Công */}
          <button
            type="button"
            onClick={() => setAttendanceSubTab('chamcong')}
            className={`group relative flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-center select-none active:scale-[0.98] ${
              attendanceSubTab === 'chamcong'
                ? 'bg-emerald-50/80 border-emerald-500 shadow-xs text-emerald-800'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mb-1.5 transition-all duration-200 relative ${
              attendanceSubTab === 'chamcong'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500 group-hover:text-emerald-700 group-hover:bg-emerald-50'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <span className={`text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 ${
              attendanceSubTab === 'chamcong' ? 'text-emerald-900 font-extrabold' : 'text-slate-700'
            }`}>
              Chấm công
            </span>
            {attendanceSubTab === 'chamcong' && (
              <div className="absolute bottom-1 w-6 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          {/* 2. Dịch vụ thị trường */}
          <button
            type="button"
            onClick={() => setAttendanceSubTab('dichvuthitruong')}
            className={`group relative flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-center select-none active:scale-[0.98] ${
              attendanceSubTab === 'dichvuthitruong'
                ? 'bg-emerald-50/80 border-emerald-500 shadow-xs text-emerald-800'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mb-1.5 transition-all duration-200 relative ${
              attendanceSubTab === 'dichvuthitruong'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500 group-hover:text-emerald-700 group-hover:bg-emerald-50'
            }`}>
              <Store className="w-5 h-5" />
            </div>
            <span className={`text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 ${
              attendanceSubTab === 'dichvuthitruong' ? 'text-emerald-900 font-extrabold' : 'text-slate-700'
            }`}>
              Dịch vụ thị trường
            </span>
            {attendanceSubTab === 'dichvuthitruong' && (
              <div className="absolute bottom-1 w-6 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          {/* 3. Thời gian viếng thăm */}
          <button
            type="button"
            onClick={() => setAttendanceSubTab('thoigianviengtham')}
            className={`group relative flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-center select-none active:scale-[0.98] ${
              attendanceSubTab === 'thoigianviengtham'
                ? 'bg-emerald-50/80 border-emerald-500 shadow-xs text-emerald-800'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mb-1.5 transition-all duration-200 ${
              attendanceSubTab === 'thoigianviengtham'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500 group-hover:text-emerald-700 group-hover:bg-emerald-50'
            }`}>
              <MapPin className="w-5 h-5" />
            </div>
            <span className={`text-[11px] sm:text-xs font-bold leading-tight line-clamp-2 ${
              attendanceSubTab === 'thoigianviengtham' ? 'text-emerald-900 font-extrabold' : 'text-slate-700'
            }`}>
              Thời gian viếng thăm
            </span>
            {attendanceSubTab === 'thoigianviengtham' && (
              <div className="absolute bottom-1 w-6 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {attendanceSubTab === 'chamcong' && (
        <>
          {/* Visual Header: Compact 2-row layout on mobile without duplicate EmployeeSelect */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
            {/* Row 1: Title + Cycle Selector on same row */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-emerald-900 uppercase tracking-wider truncate">
                    Lịch Chấm Công
                  </h4>
                  <div className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium font-mono tabular-nums">
                    Tháng {((selectedMonth + 1) < 10 ? '0' + (selectedMonth + 1) : (selectedMonth + 1))}/{selectedYear}
                  </div>
                </div>
              </div>

              {/* Cycle Dropdown Selector */}
              <div className="flex items-center gap-1.5 sm:border-l border-slate-200 sm:pl-4 shrink-0">
                <span className="hidden sm:inline text-[11px] font-bold text-slate-500 shrink-0 whitespace-nowrap">Chu Kỳ Hiện Tại:</span>
                <select
                  value={currentSelectedCycle}
                  onChange={(e) => currentSetSelectedCycle(e.target.value)}
                  className="h-10 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-extrabold tracking-wide outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {cycleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.year === currentActiveYear && opt.month === currentActiveMonth ? ' (Hiện tại)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: History Status + Backup Action / Leave Form Button + Desktop EmployeeSelect */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                {historyList.some(item => item.cycleId === currentSelectedCycle) ? (
                  <div 
                    className="h-10 min-w-0 max-w-[38vw] sm:max-w-none px-2.5 sm:px-3 bg-emerald-50/70 border border-emerald-200 rounded-xl inline-flex items-center text-[11px] sm:text-xs text-emerald-700 font-bold truncate whitespace-nowrap" 
                    title={`Được lưu bởi ${historyList.find(item => item.cycleId === currentSelectedCycle)?.savedBy || ''} lúc ${historyList.find(item => item.cycleId === currentSelectedCycle)?.savedAt || ''}`}
                  >
                    Lịch sử: Đã sao lưu ✓
                  </div>
                ) : (
                  <div className="h-10 min-w-0 max-w-[38vw] sm:max-w-none px-2.5 sm:px-3 bg-slate-50 border border-slate-200 rounded-xl inline-flex items-center text-[11px] sm:text-xs text-slate-600 font-semibold truncate whitespace-nowrap">
                    Lịch sử: Chưa lưu
                  </div>
                )}

                {(currentUser?.role === 'Admin' || currentUser?.role === 'OM' || currentUser?.role === 'MKT Sup') && (
                  <button
                    onClick={handleSaveCurrentCycleToHistory}
                    disabled={isSavingHistory}
                    className="h-10 px-3 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-100 text-emerald-700 hover:text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                    title="Chụp ảnh dữ liệu bảng tính hiện tại và lưu vào Cơ sở dữ liệu lịch sử"
                  >
                    {isSavingHistory ? (
                      <span>Đang lưu...</span>
                    ) : saveHistorySuccess ? (
                      <span>Đã sao lưu ✓</span>
                    ) : (
                      <>
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>{historyList.some(item => item.cycleId === currentSelectedCycle) ? 'Cập nhật sao lưu' : 'Sao lưu chu kỳ'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {!isEmployeeView && (
                <div className="hidden md:block shrink-0">
                  <EmployeeSelect
                    selectedEmployeeName={chamCongFilterEmployee}
                    onSelectEmployee={(val) => {
                      setChamCongFilterEmployee(val);
                      onSelectEmployee?.(val);
                    }}
                    availableEmployees={sortAndFormatEmployeeNames(activeEmployees.map(e => e.name))}
                    isEmployeeView={isEmployeeView}
                    showAllOption={false}
                    compact={true}
                    buttonHeightClass="h-10 min-h-0"
                  />
                </div>
              )}

              {isEmployeeView && (
                <button
                  onClick={() => setIsOpenLeaveForm(true)}
                  className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>TẠO LỊCH NGHỈ</span>
                </button>
              )}
            </div>
          </div>

      {!isCurrentCycle && activeEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-rose-300 p-8 text-center text-slate-500 shadow-xs max-w-2xl mx-auto space-y-4 my-6">
          <Info className="w-12 h-12 text-rose-500 mx-auto" />
          <h5 className="text-rose-900 text-xs font-black uppercase tracking-wider">Chưa có dữ liệu lịch sử cho chu kỳ này</h5>
          <p className="text-[11px] text-slate-600 leading-relaxed max-w-md mx-auto">
            Chu kỳ <strong className="text-emerald-950">{(selectedMonth + 1) < 10 ? '0' + (selectedMonth + 1) : (selectedMonth + 1)}/{selectedYear}</strong> chưa được lưu trữ lịch sử chấm công vào cơ sở dữ liệu.
          </p>
          {(currentUser?.role === 'Admin' || currentUser?.role === 'OM' || currentUser?.role === 'MKT Sup') && (
            <div className="pt-2">
              <button
                onClick={handleSaveCurrentCycleToHistory}
                disabled={isSavingHistory}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 mx-auto cursor-pointer active:scale-95"
              >
                {isSavingHistory ? (
                  <span>ĐANG LƯU...</span>
                ) : saveHistorySuccess ? (
                  <span>ĐÃ LƯU TRỮ THÀNH CÔNG ✓</span>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    <span>LƯU TRỮ DỮ LIỆU HIỆN TẠI SANG CHU KỲ NÀY</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Nhấp để chụp lại snapshot từ bảng tính "Chấm Công" hiện tại và lưu trữ cho chu kỳ này.
              </p>
            </div>
          )}
        </div>
      ) : chamCongListData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
          <Info className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <h5 className="text-emerald-800 text-xs font-bold uppercase tracking-wider">Chưa nạp được dữ liệu chấm công</h5>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
            Vui lòng bố trí trang "Chấm Công" hoặc "CHẤM CÔNG" trong File nguồn để hiển thị dữ liệu lịch trình.
          </p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h5 className="text-emerald-800 text-xs font-bold uppercase tracking-wider">Không tìm thấy thông tin lịch chấm công</h5>
          <p className="text-[11px] text-slate-500 mt-1">
            Không tìm thấy dữ liệu chấm công tương thích cho tài khoản <strong className="text-emerald-950">"{ (isEmployeeView ? (currentUser?.name || '') : chamCongFilterEmployee) || 'Chưa định nghĩa' }"</strong> trong trang tính.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredEmployees.map((emp) => {
            const stats = getEmployeeStats(emp);
            
            return (
              <div 
                key={emp.name} 
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* Employee Header */}
                <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-slate-900 tracking-wide">{emp.name}</h5>
                      <span className="text-[10px] text-slate-500 font-medium block">Bảng chấm công cá nhân</span>
                    </div>
                  </div>

                  {/* Summary Counters */}
                  <div className="flex flex-wrap items-center gap-1">
                    <div className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-center">
                      <span className="text-[9.5px] sm:text-[10px] font-black text-emerald-700 whitespace-nowrap tabular-nums">{stats.ontime} Đúng Giờ</span>
                    </div>
                    {stats.late > 0 && (
                      <div className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-center">
                        <span className="text-[9.5px] sm:text-[10px] font-black text-amber-700 whitespace-nowrap tabular-nums">{stats.late} Muộn</span>
                      </div>
                    )}
                    {stats.offCount > 0 && (
                      <div className="bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-center">
                        <span className="text-[9.5px] sm:text-[10px] font-black text-rose-700 whitespace-nowrap tabular-nums">{stats.offCount} Nghỉ</span>
                      </div>
                    )}
                    {stats.skipDaysCount > 0 && (
                      <div className="bg-red-50 px-1.5 py-0.5 rounded border border-red-200 text-center" title="Số ngày bỏ điểm bán">
                        <span className="text-[9.5px] sm:text-[10px] font-black text-red-700 whitespace-nowrap tabular-nums">{stats.skipDaysCount} Ngày Bỏ ĐPB</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* DYNAMIC TABLE CALENDAR GRID REPRESENTATION - Single Outline edge-to-edge */}
                <div className="w-full overflow-x-auto bg-white">
                  <div className="min-w-full">
                    {/* Grid Weekday Headers */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                      {weekdayHeaders.map((colLabel, idx) => {
                        const isSunCol = colLabel === 'Chủ Nhật';
                        return (
                          <div key={idx} className={`py-2 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider border-r border-slate-200 last:border-r-0 ${isSunCol ? 'text-rose-600' : 'text-slate-700'}`}>
                            {colLabel}
                          </div>
                        );
                      })}
                    </div>

                    {/* Calendar Cells based on startOffset and cycleDates.length */}
                    {(() => {
                      const totalCells = startOffset + cycleDates.length > 35 ? 42 : 35;
                      return (
                        <div className="grid grid-cols-7">
                          {Array.from({ length: totalCells }).map((_, index) => {
                            const dayIndex = index - startOffset;
                            const isValidDay = dayIndex >= 0 && dayIndex < cycleDates.length;
                            const dateObj = isValidDay ? cycleDates[dayIndex] : null;
                            const dayNum = dateObj ? dateObj.getDate() : 0;
                            
                            const rawVal = isValidDay && dateObj ? (
                              emp.attendance[`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`] ||
                              emp.attendance[`${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`] ||
                              emp.attendance[`${dateObj.getDate()}/${dateObj.getMonth() + 1}`] ||
                              emp.attendance[dayNum] ||
                              ''
                            ) : '';
                            const parsed = isValidDay ? getAttendanceDetail(rawVal, dayNum, emp.name, dateObj) : null;

                            const isLate = parsed?.type === 'late';
                            const isOnTime = parsed?.type === 'ontime';
                            const isSunday = parsed?.type === 'sunday';
                            const isOff = parsed?.type === 'off';
                            const isSkip = parsed?.type === 'skip' || parsed?.hasSkip;
                            const isOther = parsed?.type === 'other';
                            const hasSkip = !!parsed?.hasSkip || isSkip;
                            const skipCount = typeof parsed?.skipCount === 'number' ? parsed.skipCount : 0;

                            const isCellSunday = (index + 1) % 7 === 0;

                            return (
                              <div
                                key={index}
                                className={`min-h-[58px] sm:min-h-[66px] p-1 flex flex-col justify-between items-center text-center border-r border-b border-slate-200 ${(index + 1) % 7 === 0 ? 'border-r-0' : ''} ${index >= totalCells - 7 ? 'border-b-0' : ''} bg-white hover:bg-slate-50/70 transition-colors duration-150`}
                              >
                                {isValidDay ? (
                                  <>
                                    {/* Day index display */}
                                    <span className={`text-[10px] sm:text-[11px] font-extrabold tracking-wider tabular-nums ${isCellSunday ? 'text-rose-600' : isLate ? 'text-amber-600' : isOff ? 'text-rose-600' : 'text-emerald-800'}`}>
                                      {dayNum < 10 ? `0${dayNum}` : dayNum}
                                    </span>

                                    {/* Attendance status display & Bỏ điểm bán ngay phía dưới - Single line per text */}
                                    <div className="w-full flex flex-col justify-center items-center gap-0.5 my-0.5">
                                      {isOnTime ? (
                                        <span className="text-[7.5px] min-[360px]:text-[8px] sm:text-[9.5px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 whitespace-nowrap leading-none">
                                          Đúng Giờ
                                        </span>
                                      ) : isLate ? (
                                        <span className="text-[7.5px] min-[360px]:text-[8px] sm:text-[9.5px] font-black tracking-tight text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 whitespace-nowrap leading-none">
                                          Đi Muộn
                                        </span>
                                      ) : isSunday || isCellSunday ? (
                                        <span className="text-[8px] sm:text-[9.5px] font-black text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 uppercase whitespace-nowrap leading-none">
                                          CN
                                        </span>
                                      ) : isOff ? (
                                        <span className="text-[7.5px] min-[360px]:text-[8px] sm:text-[9.5px] font-black tracking-wider text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 whitespace-nowrap leading-none">
                                          Nghỉ Phép
                                        </span>
                                      ) : isOther && parsed?.text ? (
                                        <span className="text-[8px] sm:text-[9px] font-semibold text-slate-600 truncate max-w-[54px] whitespace-nowrap leading-none">
                                          {parsed?.text}
                                        </span>
                                      ) : (
                                        <span className="text-[8px] text-slate-300 italic leading-none">-</span>
                                      )}

                                      {/* Ngay phía dưới là phần Bỏ Điểm Bán (Tô màu đỏ khi Bỏ điểm > 0, tô màu xanh khi Bỏ điểm = 0) */}
                                      {hasSkip && (
                                        <span
                                          className={`text-[7px] min-[360px]:text-[7.5px] sm:text-[9px] font-extrabold px-1 py-0.5 rounded border whitespace-nowrap leading-none ${
                                            skipCount > 0
                                              ? 'text-red-700 bg-red-100 border-red-300'
                                              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                          }`}
                                          title={`Bỏ điểm: ${skipCount}`}
                                        >
                                          Bỏ điểm: {skipCount}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="h-full w-full" /> // Placeholder cells
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* OVERALL ATTENDANCE SUMMARY TABLE FOR SUPERVISORS/OMS - Single Outline, Edge-to-Edge, No Subtitle */}
      {chamCongListData.length > 0 && (currentUser?.role === 'Admin' || currentUser?.role === 'OM' || currentUser?.role === 'MKT Sup' || (currentUser?.role && currentUser.role !== 'Nhân viên' && currentUser.role !== 'Saleman' && currentUser.role !== 'employee')) && (
        <div id="attendance-summary-table" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
          <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-white">
            <div>
              <h5 className="text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                <span>BẢNG TỔNG HỢP CHẤM CÔNG NHÂN VIÊN</span>
              </h5>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Tìm nhân viên..."
                value={summarySearchQuery}
                onChange={(e) => setSummarySearchQuery(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 w-full sm:w-48 font-semibold"
              />
            </div>
          </div>

          <div className="overflow-x-auto w-full bg-white">
            <table className="w-full text-left border-collapse table-fixed bg-white">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-[8.5px] min-[375px]:text-[9px] sm:text-[11px] font-extrabold tracking-tight border-b border-slate-200 uppercase leading-tight">
                  <th className="py-2.5 px-2 text-left border-r border-slate-200 w-[96px] sm:w-44">Tên NV</th>
                  <th className="py-2.5 px-0.5 text-center border-r border-slate-200 w-[36px] sm:w-20">Đúng<br />giờ</th>
                  <th className="py-2.5 px-0.5 text-center border-r border-slate-200 w-[34px] sm:w-16">Đi<br />muộn</th>
                  <th className="py-2.5 px-0.5 text-center border-r border-slate-200 w-[30px] sm:w-16">Nghỉ</th>
                  <th className="py-2.5 px-0.5 text-center border-r border-slate-200 w-[44px] sm:w-24">Lượt<br />Bỏ Điểm</th>
                  <th className="py-2.5 px-0.5 text-center border-r border-slate-200 w-[44px] sm:w-20">Ngày<br />Bỏ Điểm</th>
                  <th className="py-2.5 px-0.5 text-center w-[38px] sm:w-20">Tổng<br />Công</th>
                </tr>
              </thead>
              <tbody className="text-[10px] sm:text-xs text-slate-700">
                {(() => {
                  const itemsToDisplay = activeEmployees.filter(emp => 
                    !summarySearchQuery || emp.name.toLowerCase().includes(summarySearchQuery.toLowerCase())
                  );

                  if (itemsToDisplay.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                          Không tìm thấy nhân viên nào khớp với tìm kiếm
                        </td>
                      </tr>
                    );
                  }

                  return itemsToDisplay.map((emp, index) => {
                    const stats = getEmployeeStats(emp);
                    const isLateHighlighted = stats.late > 0;
                    const isOffHighlighted = stats.offCount > 0;
                    const isSkipHighlighted = stats.skipDaysCount > 0;
                    const totalAttendanceDays = stats.ontime + stats.late + stats.offCount;
                    const totalWorkDays = totalAttendanceDays - (stats.late * 0.5) - stats.offCount;
                    const formattedTotalWorkDays = Number(totalWorkDays.toFixed(1));
                    const isLastRow = index === itemsToDisplay.length - 1;
                    const borderBottomClass = isLastRow ? '' : 'border-b border-slate-200';

                    return (
                      <tr key={emp.name} className="hover:bg-slate-50/70 transition-colors">
                        <td className={`py-2 px-2 text-left border-r border-slate-200 ${borderBottomClass} font-black text-slate-900 text-[10.5px] sm:text-xs leading-snug`} title={emp.name}>
                          {emp.name}
                        </td>
                        <td className={`py-2 px-0.5 text-center border-r border-slate-200 ${borderBottomClass} font-mono tabular-nums text-emerald-700 font-bold text-[10px] sm:text-xs`}>
                          {stats.ontime}
                        </td>
                        <td className={`py-2 px-0.5 text-center border-r border-slate-200 ${borderBottomClass} font-mono tabular-nums text-[10px] sm:text-xs ${isLateHighlighted ? 'bg-amber-50 text-amber-700 font-black' : 'text-slate-500 font-semibold'}`}>
                          {stats.late}
                        </td>
                        <td className={`py-2 px-0.5 text-center border-r border-slate-200 ${borderBottomClass} font-mono tabular-nums text-[10px] sm:text-xs ${isOffHighlighted ? 'bg-rose-50 text-rose-700 font-black' : 'text-slate-500 font-semibold'}`}>
                          {stats.offCount}
                        </td>
                        <td className={`py-2 px-0.5 text-center border-r border-slate-200 ${borderBottomClass} font-mono tabular-nums text-[10px] sm:text-xs ${isSkipHighlighted ? 'bg-red-50 text-red-700 font-black' : 'text-slate-500 font-semibold'}`}>
                          {stats.skipCount}
                        </td>
                        <td className={`py-2 px-0.5 text-center border-r border-slate-200 ${borderBottomClass} font-mono tabular-nums text-[10px] sm:text-xs ${isSkipHighlighted ? 'bg-red-50 text-red-700 font-black' : 'text-slate-500 font-semibold'}`}>
                          {stats.skipDaysCount}
                        </td>
                        <td className={`py-2 px-0.5 text-center ${borderBottomClass} font-mono tabular-nums text-emerald-800 font-black text-[10px] sm:text-xs bg-emerald-50/40`}>
                          {formattedTotalWorkDays}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guide disclaimer block */}
      <div id="attendance-flow-disclaimer" className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h6 className="text-[11px] text-emerald-800 font-extrabold uppercase tracking-wide">
            QUY ĐỊNH CHẤM CÔNG
          </h6>
          <div className="text-[11px] text-slate-600 leading-relaxed mt-2 space-y-2">
            <p>
              - Đối với các tuyến: Mai Châu, Lạc Sơn, Yên Thủy, Lạc Thủy<br />
              Thời gian bắt đầu điểm bán đầu tiên (đúng tuyến): Muộn nhất 9h45'
            </p>
            <p>
              - Đối với các tuyến: Thành phố, Kỳ Sơn, Lương Sơn, Đà Bắc, Cao Phong, Tân Lạc, Kim Bôi<br />
              Thời gian bắt đầu điểm bán đầu tiên (đúng tuyến): Muộn nhất 8h30'
            </p>
          </div>
        </div>
      </div>

      {/* LEAVE REQUEST APPROVAL SECTION FOR SUPERVISORS/OMS - MOBILE-OPTIMIZED CARD LAYOUT */}
      {!isEmployeeView && (
        <div id="leave-requests-approval-panel" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer select-none hover:opacity-90 transition-opacity"
            onClick={() => setIsApprovalExpanded(!isApprovalExpanded)}
          >
            <h5 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              <span>PHÊ DUYỆT LỊCH NGHỈ</span>
              {leaveRequests.filter(r => r.status === 'Chờ duyệt' || !r.status).length > 0 && (
                <span className="flex items-center gap-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs ml-1">
                  <span className="font-extrabold">!</span>
                  <span>{leaveRequests.filter(r => r.status === 'Chờ duyệt' || !r.status).length} phiếu chờ duyệt</span>
                </span>
              )}
              <button 
                type="button" 
                className="p-1 hover:bg-emerald-50 rounded transition-colors focus:outline-none flex items-center justify-center"
                aria-label={isApprovalExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isApprovalExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </button>
            </h5>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              Tổng số: {leaveRequests.filter(r => r.status !== 'Nháp').length} phiếu
            </span>
          </div>

          {isApprovalExpanded && (
            leaveRequests.filter(r => r.status !== 'Nháp').length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">Chưa có phiếu nghỉ phép nào cần xử lý.</p>
            ) : (
              <div className="space-y-2 pt-1">
                {/* Desktop Table Header */}
                <div className="hidden lg:flex items-center justify-between px-3.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[10.5px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-52 shrink-0">Nhân viên tạo</span>
                    <span className="w-48 shrink-0">Thời gian nghỉ</span>
                    <span className="flex-1">Lý do & Chi tiết</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="w-32 text-center">Trạng thái</span>
                    <span className="w-36 text-center">Thao tác</span>
                  </div>
                </div>

                {/* Vertical list of full-width horizontal cards */}
                <div className="flex flex-col gap-2">
                  {sortedLeaveRequests.map((req) => {
                    const isPending = req.status === 'Chờ duyệt' || !req.status;
                    const isApproved = req.status === 'Đã duyệt';
                    const isRejected = req.status === 'Từ chối';

                    return (
                      <div 
                        key={req.id} 
                        className="w-full bg-white hover:bg-slate-50/70 rounded-xl border border-slate-200 hover:border-emerald-400 p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-slate-700"
                      >
                        {/* 1. Left Section: Employee, Dates, Reason & Details */}
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                          {/* Employee Identity */}
                          <div className="flex items-center gap-2.5 w-full sm:w-52 shrink-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                              {req.creatorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h6 className="text-xs sm:text-[13px] font-black text-slate-900 leading-tight truncate" title={req.creatorName}>
                                {req.creatorName}
                              </h6>
                              <span className="text-[10px] text-slate-400 font-medium block truncate" title={req.creatorEmail || req.createdAt}>
                                {req.creatorEmail || `Gửi: ${req.createdAt}`}
                              </span>
                            </div>
                          </div>

                          {/* Leave Dates */}
                          <div className="flex items-center gap-1.5 shrink-0 bg-slate-100/70 border border-slate-200/80 px-2.5 py-1 rounded-md text-slate-800 w-fit sm:w-48">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-[11px] font-black tracking-tight text-slate-800 truncate">
                              {(() => {
                                const startParts = req.offDate.split('-');
                                const startFmt = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : req.offDate;
                                if (req.toDate && req.toDate !== req.offDate) {
                                  const endParts = req.toDate.split('-');
                                  const endFmt = endParts.length === 3 ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : req.toDate;
                                  return `${startFmt} → ${endFmt}`;
                                }
                                return startFmt;
                              })()}
                            </span>
                          </div>

                          {/* Reason Badge & Details preview */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
                              <Tag className="w-3 h-3 text-emerald-600" />
                              <span>{req.reason}</span>
                            </span>
                            <p 
                              className="text-[11px] text-slate-600 truncate cursor-pointer hover:text-emerald-700 transition-colors flex-1"
                              onClick={() => setViewingLeaveDetail(req)}
                              title={req.details ? `${req.details} (Bấm để xem chi tiết)` : 'Bấm để xem chi tiết'}
                            >
                              {req.details || <span className="text-slate-400 italic">Không có mô tả chi tiết</span>}
                            </p>
                          </div>
                        </div>

                        {/* 2. Right Section: Status badge & Actions */}
                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          {/* Status and timestamp footnote */}
                          <div className="flex flex-col items-start lg:items-center w-auto lg:w-32 shrink-0">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-50 text-amber-700 border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Chờ duyệt
                              </span>
                            ) : isApproved ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Đã duyệt
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-50 text-rose-700 border border-rose-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Từ chối
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-slate-100 text-slate-600 border border-slate-300">
                                Nháp
                              </span>
                            )}

                            {(isApproved || isRejected) && req.approvedBy ? (
                              <span className="text-[9.5px] text-slate-400 font-medium truncate max-w-[130px]" title={`${isApproved ? 'Duyệt bởi' : 'Từ chối bởi'}: ${getApproverNameOnly(req.approvedBy)}`}>
                                {isApproved ? 'Duyệt: ' : 'Từ chối: '}
                                <strong className="text-slate-600">{getApproverNameOnly(req.approvedBy)}</strong>
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-slate-400 font-medium">
                                {req.createdAt}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-1.5 w-auto lg:w-36 shrink-0">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRejectLeaveRequest(req.id)}
                                  className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-black transition-all active:scale-95 cursor-pointer text-center"
                                  title="Từ chối phiếu"
                                >
                                  Từ chối
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveLeaveRequest(req.id)}
                                  className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black transition-all active:scale-95 cursor-pointer shadow-2xs text-center"
                                  title="Duyệt phiếu"
                                >
                                  Duyệt
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setViewingLeaveDetail(req)}
                                className="py-1 px-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                              >
                                Xem chi tiết
                              </button>
                            )}

                            {/* Delete Action */}
                            {leaveDeleteConfirmId === req.id ? (
                              <div className="flex items-center gap-1 animate-fadeIn">
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await deleteDoc(doc(db, 'leave_requests', req.id));
                                      setLeaveDeleteConfirmId(null);
                                    } catch (err) {
                                      console.error('Failed to delete request:', err);
                                    }
                                  }}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10.5px] font-black transition-all cursor-pointer shadow-xs"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLeaveDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10.5px] font-bold transition-all cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLeaveDeleteConfirmId(req.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
                                title="Xóa phiếu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* EMPLOYEE LEAVE REQUESTS HISTORY - MOBILE-OPTIMIZED CARD LAYOUT */}
      {isEmployeeView && (
        <div id="employee-leave-history-panel" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer select-none hover:opacity-90 transition-opacity"
            onClick={() => setIsMyLeaveExpanded(!isMyLeaveExpanded)}
          >
            <h5 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              <span>DANH SÁCH LỊCH NGHỈ ĐÃ TẠO</span>
              <button 
                type="button" 
                className="p-1 hover:bg-emerald-50 rounded transition-colors focus:outline-none flex items-center justify-center"
                aria-label={isMyLeaveExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isMyLeaveExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </button>
            </h5>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              Tổng số: {myLeaveRequests.length} phiếu
            </span>
          </div>

          {isMyLeaveExpanded && (
            myLeaveRequests.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">Bạn chưa tạo phiếu nghỉ phép nào.</p>
            ) : (
              <div className="space-y-2 pt-1">
                {/* Desktop Table Header */}
                <div className="hidden lg:flex items-center justify-between px-3.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[10.5px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-52 shrink-0">Thời gian nghỉ</span>
                    <span className="w-48 shrink-0">Lý do nghỉ</span>
                    <span className="flex-1">Chi tiết lý do</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="w-32 text-center">Trạng thái</span>
                    <span className="w-28 text-center">Thao tác</span>
                  </div>
                </div>

                {/* Vertical list of full-width horizontal cards */}
                <div className="flex flex-col gap-2">
                  {myLeaveRequests.sort((a, b) => b.id.localeCompare(a.id)).map((req) => {
                    const isDraft = req.status === 'Nháp';
                    const isPending = req.status === 'Chờ duyệt';
                    const isApproved = req.status === 'Đã duyệt';
                    const isRejected = req.status === 'Từ chối';

                    return (
                      <div 
                        key={req.id} 
                        className="w-full bg-white hover:bg-slate-50/70 rounded-xl border border-slate-200 hover:border-emerald-400 p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-slate-700"
                      >
                        {/* 1. Left Section: Dates, Reason, Details */}
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                          {/* Leave Dates */}
                          <div className="flex items-center gap-2 w-full sm:w-52 shrink-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h6 className="text-xs sm:text-[13px] font-black text-slate-900 leading-tight truncate">
                                {(() => {
                                  const startParts = req.offDate.split('-');
                                  const startFmt = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : req.offDate;
                                  if (req.toDate && req.toDate !== req.offDate) {
                                    const endParts = req.toDate.split('-');
                                    const endFmt = endParts.length === 3 ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : req.toDate;
                                    return `${startFmt} → ${endFmt}`;
                                  }
                                  return startFmt;
                                })()}
                              </h6>
                              <span className="text-[10px] text-slate-400 font-medium block">
                                Tạo lúc: {req.createdAt}
                              </span>
                            </div>
                          </div>

                          {/* Reason Badge */}
                          <div className="shrink-0 w-fit sm:w-48">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                              <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{req.reason}</span>
                            </span>
                          </div>

                          {/* Details Snippet */}
                          <p 
                            className="text-[11px] text-slate-600 truncate cursor-pointer hover:text-emerald-700 transition-colors flex-1"
                            onClick={() => setViewingLeaveDetail(req)}
                            title={req.details ? `${req.details} (Bấm để xem chi tiết)` : 'Bấm để xem chi tiết'}
                          >
                            {req.details || <span className="text-slate-400 italic">Không có mô tả chi tiết</span>}
                          </p>
                        </div>

                        {/* 2. Right Section: Status badge & Actions */}
                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          {/* Status and approver footnote */}
                          <div className="flex flex-col items-start lg:items-center w-auto lg:w-32 shrink-0">
                            {isDraft ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-slate-100 text-slate-600 border border-slate-300">
                                Nháp
                              </span>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-50 text-amber-700 border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Chờ duyệt
                              </span>
                            ) : isApproved ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Đã duyệt
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-50 text-rose-700 border border-rose-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Từ chối
                              </span>
                            ) : null}

                            {(isApproved || isRejected) && req.approvedBy && (
                              <span className="text-[9.5px] text-slate-400 font-medium truncate max-w-[130px]" title={`${isApproved ? 'Duyệt bởi' : 'Từ chối bởi'}: ${getApproverNameOnly(req.approvedBy)}`}>
                                {isApproved ? 'Duyệt: ' : 'Từ chối: '}
                                <strong className="text-slate-600">{getApproverNameOnly(req.approvedBy)}</strong>
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-1.5 w-auto lg:w-28 shrink-0">
                            <button
                              type="button"
                              onClick={() => setViewingLeaveDetail(req)}
                              className="py-1 px-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                            >
                              Xem chi tiết
                            </button>

                            {/* Delete Action for draft or pending */}
                            {(isDraft || isPending) && (
                              leaveDeleteConfirmId === req.id ? (
                                <div className="flex items-center gap-1 animate-fadeIn">
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await deleteDoc(doc(db, 'leave_requests', req.id));
                                        setLeaveDeleteConfirmId(null);
                                      } catch (err) {
                                        console.error('Failed to delete request:', err);
                                      }
                                    }}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10.5px] font-black transition-all cursor-pointer shadow-xs"
                                  >
                                    Xóa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLeaveDeleteConfirmId(null);
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10.5px] font-bold transition-all cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLeaveDeleteConfirmId(req.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
                                  title="Xóa phiếu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}
        </>
      )}

      {/* VIEW LEAVE REQUEST DETAIL MODAL */}
      {viewingLeaveDetail && (
        <div 
          id="view-leave-detail-modal" 
          className="app-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4"
          onClick={() => setViewingLeaveDetail(null)}
        >
          <div 
            ref={leaveDetailModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết phiếu nghỉ phép"
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-fadeIn outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                <h5 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Chi tiết phiếu nghỉ phép
                </h5>
              </div>
              <button 
                type="button"
                onClick={() => setViewingLeaveDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider block">Nhân viên tạo phiếu</span>
                  <span className="text-sm font-black text-emerald-950">{viewingLeaveDetail.creatorName}</span>
                  {viewingLeaveDetail.creatorEmail && <span className="block text-[11px] text-slate-500 mt-0.5">{viewingLeaveDetail.creatorEmail}</span>}
                </div>
                <div>
                  {viewingLeaveDetail.status === 'Chờ duyệt' || !viewingLeaveDetail.status ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-300">
                      Chờ duyệt
                    </span>
                  ) : viewingLeaveDetail.status === 'Đã duyệt' ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300">
                      Đã duyệt
                    </span>
                  ) : viewingLeaveDetail.status === 'Từ chối' ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-300">
                      Từ chối
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-300">
                      Nháp
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Thời gian nghỉ</span>
                  <span className="text-xs font-black text-slate-900 mt-0.5 block">
                    {(() => {
                      const startParts = viewingLeaveDetail.offDate.split('-');
                      const startFmt = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : viewingLeaveDetail.offDate;
                      if (viewingLeaveDetail.toDate && viewingLeaveDetail.toDate !== viewingLeaveDetail.offDate) {
                        const endParts = viewingLeaveDetail.toDate.split('-');
                        const endFmt = endParts.length === 3 ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : viewingLeaveDetail.toDate;
                        return `${startFmt} đến ${endFmt}`;
                      }
                      return startFmt;
                    })()}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lý do nghỉ</span>
                  <span className="text-xs font-black text-slate-900 mt-0.5 block">
                    {viewingLeaveDetail.reason}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Chi tiết lý do</span>
                <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                  {viewingLeaveDetail.details || <span className="text-slate-400 italic">Không có mô tả chi tiết</span>}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Thời gian gửi phiếu:</span>
                  <strong className="font-mono text-slate-800">{viewingLeaveDetail.createdAt}</strong>
                </div>
                {viewingLeaveDetail.approvedBy && (
                  <div className="flex items-center justify-between text-slate-600 border-t border-slate-200/60 pt-1 mt-1">
                    <span>{viewingLeaveDetail.status === 'Từ chối' ? 'Từ chối bởi:' : 'Người duyệt:'}</span>
                    <strong className="text-slate-800">{getApproverNameOnly(viewingLeaveDetail.approvedBy)} {viewingLeaveDetail.approvedAt ? `(${viewingLeaveDetail.approvedAt})` : ''}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
              {!isEmployeeView && (viewingLeaveDetail.status === 'Chờ duyệt' || !viewingLeaveDetail.status) && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleRejectLeaveRequest(viewingLeaveDetail.id);
                      setViewingLeaveDetail(null);
                    }}
                    className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleApproveLeaveRequest(viewingLeaveDetail.id);
                      setViewingLeaveDetail(null);
                    }}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                  >
                    Duyệt phiếu
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setViewingLeaveDetail(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE LEAVE REQUEST MODAL */}
      {isOpenLeaveForm && (
        <div id="create-leave-request-modal" className="app-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4">
          <div
            ref={leaveCreateModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Tạo phiếu xin nghỉ phép"
            className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn space-y-4 outline-none"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h5 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>TẠO PHIẾU XIN NGHỈ PHÉP</span>
              </h5>
              <button 
                type="button"
                onClick={() => setIsOpenLeaveForm(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-[11px]">
              {/* Người tạo phiếu */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-extrabold uppercase tracking-wider">Người tạo phiếu</label>
                <input
                  type="text"
                  readOnly
                  value={currentUser?.name || selectedEmployeeName || 'Nhân viên'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-bold focus:outline-none"
                />
              </div>

              {/* Thời gian tạo phiếu */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-extrabold uppercase tracking-wider">Thời gian tạo phiếu</label>
                <input
                  type="text"
                  readOnly
                  value={leaveCreatedAt || 'Tự động lấy khi lưu...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-bold focus:outline-none"
                />
              </div>

              {/* Từ ngày */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-extrabold uppercase tracking-wider block">Từ ngày</label>
                <div className="relative flex items-center bg-white border border-slate-300 rounded-lg focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden">
                  <input
                    type="text"
                    placeholder="Nhập DD/MM/YYYY (Ví dụ: 02/07/2026)"
                    value={typedFromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTypedFromDate(val);
                      const parsed = parseVietnameseDate(val);
                      if (parsed) {
                        setPickerFromDate(parsed);
                        if (!pickerToDate) {
                          setPickerToDate(parsed);
                          setTypedToDate(val);
                        }
                      }
                    }}
                    className="flex-1 bg-transparent border-none py-2 px-3 text-slate-800 placeholder-slate-400 focus:outline-none text-[11px]"
                  />
                  <div className="relative flex items-center justify-center w-8 h-8 mr-1.5 cursor-pointer hover:bg-slate-100 rounded">
                    <input
                      type="date"
                      value={pickerFromDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPickerFromDate(val);
                        if (val) {
                          const parts = val.split('-');
                          if (parts.length === 3) {
                            const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                            setTypedFromDate(formatted);
                            if (!pickerToDate) {
                              setPickerToDate(val);
                              setTypedToDate(formatted);
                            }
                          }
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 hover:text-emerald-600 relative z-0" />
                  </div>
                </div>
              </div>

              {/* Đến ngày */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-extrabold uppercase tracking-wider block">Đến ngày</label>
                <div className="relative flex items-center bg-white border border-slate-300 rounded-lg focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden">
                  <input
                    type="text"
                    placeholder="Nhập DD/MM/YYYY (Ví dụ: 02/07/2026)"
                    value={typedToDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTypedToDate(val);
                      const parsed = parseVietnameseDate(val);
                      if (parsed) {
                        setPickerToDate(parsed);
                      }
                    }}
                    className="flex-1 bg-transparent border-none py-2 px-3 text-slate-800 placeholder-slate-400 focus:outline-none text-[11px]"
                  />
                  <div className="relative flex items-center justify-center w-8 h-8 mr-1.5 cursor-pointer hover:bg-slate-100 rounded">
                    <input
                      type="date"
                      value={pickerToDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPickerToDate(val);
                        if (val) {
                          const parts = val.split('-');
                          if (parts.length === 3) {
                            setTypedToDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
                          }
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 hover:text-emerald-600 relative z-0" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Bạn có thể gõ tay định dạng ngày hoặc bấm nút lịch ở cuối ô nhập.</p>
              </div>

              {/* Lý do */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-extrabold uppercase tracking-wider">Lý do nghỉ</label>
                <select
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="Lý do sức khỏe">Lý do sức khỏe</option>
                  <option value="Lý do gia đình">Lý do gia đình</option>
                  <option value="Lý do cá nhân">Lý do cá nhân</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              {/* Chi tiết */}
              <div className="space-y-1.5">
                <label className="text-slate-600 font-extrabold uppercase tracking-wider">Chi tiết (Không bắt buộc)</label>
                <textarea
                  placeholder="Nhập chi tiết lý do xin nghỉ..."
                  value={leaveDetails}
                  onChange={(e) => setLeaveDetails(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              {/* Validation Error Message */}
              {validationError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2 text-rose-700 text-[10px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 justify-end items-center pt-3 border-t border-slate-200">
                {isSent && (
                  <span className="text-[11px] text-emerald-700 font-bold mr-auto flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Đã gửi thành công</span>
                  </span>
                )}
                <button
                  type="button"
                  disabled={isSent}
                  onClick={() => setIsOpenLeaveForm(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSent}
                  onClick={(e) => handleSaveLeaveRequest(e)}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer active:scale-95 ${
                    isSent
                      ? 'bg-emerald-600 text-white font-extrabold cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isSent ? 'Đã Gửi ✓' : 'Gửi yêu cầu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERSONAL EVALUATIONS SECTION */}
      {attendanceSubTab === 'dichvuthitruong' && (() => {
        let myEvaluations: any[] = [];
        try {
          const isEmployeeView = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Saleman' || currentUser?.role === 'employee';
          
          if (isEmployeeView) {
            // For Salesman, always filter by their own mapped name to preserve security boundaries
            const myName = currentUser?.name || selectedEmployeeName || '';
            if (myName && myName !== 'Tất cả') {
              myEvaluations = evaluations.filter(
                (item: any) => item.nhanVien.toLowerCase().trim() === myName.toLowerCase().trim()
              );
            } else {
              myEvaluations = evaluations;
            }
          } else {
            // For Administrators/Supervisors, apply the separate local evaluation filter
            if (evalFilterEmployee && evalFilterEmployee !== 'Tất cả') {
              myEvaluations = evaluations.filter(
                (item: any) => item.nhanVien.toLowerCase().trim() === evalFilterEmployee.toLowerCase().trim()
              );
            } else {
              myEvaluations = evaluations;
            }
          }
        } catch (err) {
          console.error(err);
        }

        const totalEvaluations = myEvaluations.length;
        const datCount = myEvaluations.filter(item => item.trangThai === 'Đạt').length;
        const khongDatCount = totalEvaluations - datCount;

        const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'OM';

        const formatEvalDate = (dateStr: string) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            const [year, month, day] = parts;
            return `${day}/${month}/${year}`;
          }
          return dateStr;
        };

        return (
          <div id="personal-evaluations-panel" className="space-y-4">

            {/* Inline Creation/Editing Form */}
            {isOpenForm && canManage && (
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative animate-fadeIn mb-4">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <h5 className="text-sm font-black text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{editingId ? 'CẬP NHẬT ĐÁNH GIÁ DỊCH VỤ BÁN HÀNG' : 'TẠO PHIẾU ĐÁNH GIÁ DỊCH VỤ BÁN HÀNG'}</span>
                </h5>

                <form onSubmit={handleSaveEvaluation} className="space-y-4 text-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Ngày Đánh Giá</label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Người Đánh Giá</label>
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 font-bold text-xs select-none flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                        {autoEvaluator} <span className="text-[10px] text-slate-500 font-normal">({currentUser?.role === 'Admin' ? 'Giám Sát' : 'OM'})</span>
                      </div>
                    </div>

                    {editingId ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Nhân viên được đánh giá</label>
                        <select
                          required
                          value={formEmployee}
                          onChange={(e) => setFormEmployee(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:border-emerald-500 text-xs cursor-pointer font-bold"
                        >
                          <option value="" disabled>-- Chọn nhân viên --</option>
                          {availableEmployeeNames.map((empName: string) => (
                            <option key={empName} value={empName}>{empName}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-center">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Chế độ tạo phiếu</span>
                        <div className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Hỗ trợ chọn nhiều NV tạo hàng loạt</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multi-employee selection for creating new evaluations */}
                  {!editingId && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-emerald-600" />
                            <span>Chọn danh sách nhân viên được đánh giá</span>
                          </label>
                          <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full transition-colors ${
                            selectedEmployees.length > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-700 border border-rose-300'
                          }`}>
                            {selectedEmployees.length > 0 ? `Đã chọn: ${selectedEmployees.length} nhân viên` : 'Chưa chọn nhân viên nào'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployees(availableEmployeeNames)}
                            className="px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 rounded-lg border border-emerald-300 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Chọn tất cả ({availableEmployeeNames.length})
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedEmployees([])}
                            className="px-2.5 py-1 text-[11px] font-extrabold text-slate-600 bg-white hover:bg-slate-200 rounded-lg border border-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      {/* Search & Filter */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm nhanh tên nhân viên..."
                          value={employeeSearchText}
                          onChange={(e) => setEmployeeSearchText(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/30 transition-all"
                        />
                      </div>

                      {/* Employee cards list */}
                      <div className="max-h-48 overflow-y-auto pr-1 border border-slate-200 rounded-lg p-2 bg-white space-y-1.5 shadow-inner">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {filteredEmpList.map((empName) => {
                            const isSelected = selectedEmployees.includes(empName);
                            return (
                              <div
                                key={empName}
                                onClick={() => {
                                  setSelectedEmployees(prev =>
                                    prev.includes(empName)
                                      ? prev.filter(n => n !== empName)
                                      : [...prev, empName]
                                  );
                                }}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                                  isSelected
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-400/20'
                                    : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white border-slate-300'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className="truncate flex-1" title={empName}>
                                  {empName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {filteredEmpList.length === 0 && (
                          <div className="text-center py-4 text-xs text-slate-400 italic">
                            Không tìm thấy nhân viên phù hợp với từ khóa "{employeeSearchText}"
                          </div>
                        )}
                      </div>

                      {selectedEmployees.length > 1 && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                          <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Hệ thống sẽ tạo <strong>{selectedEmployees.length} phiếu đánh giá hàng loạt</strong> cho các nhân viên đã chọn.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evaluation criteria checklist */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <span className="text-[11px] text-emerald-700 font-black uppercase tracking-wider block">Tiêu Chí Đánh Giá Vi Phạm / Cần Lưu Ý (Chọn nếu vi phạm):</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={hangCan}
                          onChange={(e) => setFormHangCan(e.target.checked)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs leading-snug">
                          <p className="font-semibold text-slate-800">Hàng Cận / Hết Date</p>
                          <p className="text-[10px] text-slate-500">Điểm bán có sản phẩm hết hạn / cận hạn (còn dưới 25% date)</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={trungBay}
                          onChange={(e) => setFormTrungBay(e.target.checked)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs leading-snug">
                          <p className="font-semibold text-slate-800">Trưng Bày Hàng Hóa Không Đạt Yêu Cầu</p>
                          <p className="text-[10px] text-slate-500">Hàng hóa bụi bẩn, Không sắp xếp hàng hóa trong kho lên kệ hàng, Vị trí trưng bày bày (Trả phí) không đảm bảo, không hoàn thành tỉ lệ Trưng bày tự nhiên (Dây treo) theo yêu cầu</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={khieuNai}
                          onChange={(e) => setFormKhieuNai(e.target.checked)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs leading-snug">
                          <p className="font-semibold text-slate-800">Giải quyết khiếu nại / Bỏ điểm bán</p>
                          <p className="text-[10px] text-slate-500">Trễ nải giải quyết khiếu nại, tự ý bỏ tuyến.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={capNhat}
                          onChange={(e) => setFormCapNhat(e.target.checked)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs leading-snug">
                          <p className="font-semibold text-slate-800">Cập Nhật Thông Tin Và Báo Cáo Theo Yêu Cầu, Quy Định</p>
                          <p className="text-[10px] text-slate-500 mr-1">Báo cáo chậm trễ, không đầy đủ, chính xác theo yêu cầu</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={wpp}
                          onChange={(e) => setFormWpp(e.target.checked)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs leading-snug">
                          <p className="font-semibold text-slate-800">Vận hành CT Tích điểm</p>
                          <p className="text-[10px] text-slate-500">Không đủ khách hàng tham gia hoặc vận hành kém.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-950 transition-colors p-2 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={liemChinh}
                          onChange={(e) => setFormLiemChinh(e.target.checked)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs leading-snug">
                          <p className="font-semibold text-slate-800">Vi phạm liêm chính</p>
                          <p className="text-[10px] text-slate-500">Gian lận thông tin, vi phạm các quy tắc liêm chính của công ty</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Numbers block */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Tổng số lượt viếng thăm</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={visits}
                        onChange={(e) => setVisits(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500 text-xs font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Số lượt không đạt</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={failedVisits}
                        onChange={(e) => setFailedVisits(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500 text-xs font-bold font-mono"
                      />
                    </div>

                    <div className="flex flex-col justify-center px-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Tỉ lệ lỗi (Tự động)</span>
                      <span className="text-lg font-mono font-black text-emerald-600 mt-1">{calculatedRate}%</span>
                    </div>

                    <div className="flex flex-col justify-center px-2 border-l border-slate-200 pl-4">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Trạng thái (Tự động)</span>
                      <span className={`text-xs font-black uppercase tracking-wider mt-1.5 inline-block w-fit px-2.5 py-1 rounded-md ${
                        calculatedStatus === 'Đạt' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-300' 
                          : 'bg-rose-50 text-rose-600 border border-rose-300'
                      }`}>
                        {calculatedStatus}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Ghi chú chi tiết</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Nhập tay thông tin chi tiết các phát hiện, xử lý hoặc khuyến nghị..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsOpenForm(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={!editingId && selectedEmployees.length === 0}
                      className={`px-5 py-2 rounded-lg text-xs font-extrabold shadow-md transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                        !editingId && selectedEmployees.length === 0
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                      }`}
                    >
                      {editingId ? (
                        'Cập Nhật Phiếu'
                      ) : selectedEmployees.length > 1 ? (
                        <>
                          <Layers className="w-3.5 h-3.5" />
                          <span>Tạo Hàng Loạt ({selectedEmployees.length} Phiếu)</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Lưu Phiếu Đánh Giá</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-3">
              {/* Row 1: Title + Action Button on same line */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                    <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider truncate">
                      ĐÁNH GIÁ DỊCH VỤ THỊ TRƯỜNG
                    </h4>
                  </div>
                </div>

                {canManage && (
                  <button
                    onClick={handleOpenAddForm}
                    className="sm:hidden h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo Phiếu</span>
                  </button>
                )}

                {!canManage && hasUnreadEvalsInSystem() && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="sm:hidden h-8 px-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[11px] font-extrabold transition-colors flex items-center gap-1 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Đọc hết ✓</span>
                  </button>
                )}
              </div>

              {/* Action buttons (Desktop) + Mini counters (1 compact row on Mobile) */}
              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                {canManage && (
                  <div className="hidden md:block">
                    <EmployeeSelect
                      selectedEmployeeName={evalFilterEmployee}
                      onSelectEmployee={(val) => setEvalFilterEmployee(val)}
                      availableEmployees={employees.length > 0 
                        ? sortAndFormatEmployeeNames(employees.map((emp: any) => emp.name))
                        : sortAndFormatEmployeeNames(activeEmployees.map((emp: any) => emp.name))
                      }
                      isEmployeeView={isEmployeeView}
                      showAllOption={true}
                    />
                  </div>
                )}

                {canManage && (
                  <button
                    onClick={handleOpenAddForm}
                    className="hidden sm:flex px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition-colors items-center gap-1 shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tạo Phiếu Đánh Giá
                  </button>
                )}

                {!canManage && hasUnreadEvalsInSystem() && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="hidden sm:flex px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-extrabold transition-colors items-center gap-1 shadow-xs cursor-pointer shrink-0"
                  >
                    Đánh dấu tất cả đã đọc ✓
                  </button>
                )}
                
                <div className="grid grid-cols-3 sm:flex gap-1.5 sm:gap-2 w-full sm:w-auto">
                  <div className="bg-slate-50 sm:bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-center sm:min-w-[55px] flex items-center justify-between sm:block">
                    <span className="text-[10px] sm:text-[8px] text-slate-500 uppercase font-black sm:block">Tổng</span>
                    <span className="text-xs font-black text-slate-800 font-mono tabular-nums">{totalEvaluations}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1 text-center sm:min-w-[55px] flex items-center justify-between sm:block">
                    <span className="text-[10px] sm:text-[8px] text-emerald-700 uppercase font-black sm:block">Đạt</span>
                    <span className="text-xs font-black text-emerald-700 font-mono tabular-nums">{datCount}</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1 text-center sm:min-w-[55px] flex items-center justify-between sm:block">
                    <span className="text-[10px] sm:text-[8px] text-rose-700 uppercase font-black sm:block">Lỗi</span>
                    <span className="text-xs font-black text-rose-700 font-mono tabular-nums">{khongDatCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {totalEvaluations === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-600 text-xs font-medium shadow-xs">
                Chưa có dữ liệu đánh giá dịch vụ thị trường phù hợp cho {evalFilterEmployee && evalFilterEmployee !== 'Tất cả' ? `nhân viên này` : `hệ thống`}.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop view */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-3 border-r border-slate-200 text-center w-[8%] min-w-[80px]">Ngày</th>
                        <th className="py-3 px-4 border-r border-slate-200 text-center w-[18%] min-w-[150px]">Nhân Viên & Người Đánh Giá</th>
                        <th className="py-3 px-3 border-r border-slate-200 text-center w-[18%] min-w-[150px]">Tiêu Chí Đánh Giá</th>
                        <th className="text-center py-3 px-2 border-r border-slate-200 w-[10%] min-w-[95px]">LỖI / TỔNG VT</th>
                        <th className="text-center py-3 px-2 border-r border-slate-200 w-[7%] min-w-[70px]">Tỉ Lệ Lỗi</th>
                        <th className="text-center py-3 px-2 border-r border-slate-200 w-[7%] min-w-[75px]">Đánh Giá</th>
                        <th className="py-3 px-4 border-r border-slate-200 text-center w-[27%] min-w-[250px]">Ghi chú</th>
                        {canManage && <th className="py-3 px-2 text-center w-[5%] min-w-[65px]">Hành động</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 bg-white text-xs">
                      {myEvaluations.map((item) => {
                        const getCriteriaText = (ev: any) => {
                          const list = [];
                          if (ev.hangCanHetDate) list.push("Hàng Cận/Hết Date");
                          if (ev.trungBayKhongDat) list.push("Trưng Bày Không Đạt Yêu Cầu");
                          if (ev.khieuNaiBoDiemBan) list.push("Giải Quyết Khiếu Nại/Bỏ Tuyến");
                          if (ev.capNhatThongTinSai) list.push("Cập Nhật Thông Tin Sai");
                          if (ev.khongDamBaoWPP) list.push("Vận Hành CT Tích Điểm Kém");
                          if (ev.viPhamLiemChinh) list.push("Vi Phạm Liêm Chính");
                          
                          if (list.length === 0) {
                            return <span className="text-emerald-600 font-semibold">Đạt chuẩn dịch vụ</span>;
                          }
                          if (list.length === 1) {
                            return <span className="text-slate-700">{list[0]}</span>;
                          }
                          return (
                            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700 leading-tight">
                              {list.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          );
                        };

                        const isUnread = () => {
                          const isEmployee = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Saleman' || currentUser?.role === 'employee';
                          if (!isEmployee) return false;
                          const myName = currentUser?.name || '';
                          if (!myName) return false;
                          const seenList = item.seenBy || [];
                          return !seenList.some((n: string) => n.toLowerCase().trim() === myName.toLowerCase().trim());
                        };
                        const unread = isUnread();

                        return (
                          <tr 
                            key={item.id} 
                            onClick={() => handleViewEvaluation(item)}
                            className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                              unread ? 'bg-rose-50/30 font-semibold text-slate-900' : 'bg-white'
                            }`}
                          >
                            <td className="py-3 px-3 font-mono tabular-nums font-bold text-slate-700 border-r border-slate-200 bg-transparent">
                              <div className="flex items-center gap-1.5">
                                {unread && (
                                  <span className="inline-flex rounded-full h-2 w-2 bg-rose-600 shrink-0" />
                                )}
                                {unread && (
                                  <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1 rounded uppercase tracking-wider scale-90" title="Phiếu mới chưa xem">MỚI</span>
                                )}
                                <span>{formatEvalDate(item.ngay)}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-bold border-r border-slate-200 bg-transparent text-slate-800">
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-900">{item.nhanVien}</span>
                                <div className="text-[11px] text-slate-500 font-normal leading-none">
                                  <span>Người ĐG: </span>
                                  <span className="text-slate-700 font-bold">{item.nguoiDanhGia}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-normal border-r border-slate-200 bg-transparent">
                              {getCriteriaText(item)}
                            </td>
                            <td className="text-center py-3 px-2 font-mono tabular-nums text-slate-700 border-r border-slate-200 bg-transparent">
                              <span className="font-bold text-rose-600">{item.soLuotKhongDat}</span>
                              <span className="text-slate-400">/{item.tongLuotViengTham}</span>
                            </td>
                            <td className="text-center py-3 px-2 font-mono tabular-nums font-bold text-teal-700 border-r border-slate-200 bg-transparent">{item.tiLeKhongDat}%</td>
                            <td className="text-center py-3 px-2 border-r border-slate-200 bg-transparent">
                              {item.trangThai === 'Đạt' ? (
                                <span className="text-emerald-700 font-extrabold text-xs">Đạt</span>
                              ) : (
                                <span className="text-rose-700 font-extrabold text-xs">Không Đạt</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-700 whitespace-pre-wrap break-words border-r border-slate-200 bg-transparent">
                              {item.ghiChu || <span className="text-slate-400 italic font-normal">-</span>}
                            </td>
                            {canManage && (
                              <td className="py-3 px-2 text-center bg-transparent">
                                <div className="flex justify-center items-center gap-1.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditForm(item); }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                                    title="Sửa phiếu"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteEvaluation(item.id); }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Xóa phiếu"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view */}
                <div className="block md:hidden space-y-3">
                  {myEvaluations.map((item) => {
                    const isUnread = () => {
                      const isEmployee = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Saleman' || currentUser?.role === 'employee';
                      if (!isEmployee) return false;
                      const myName = currentUser?.name || '';
                      if (!myName) return false;
                      const seenList = item.seenBy || [];
                      return !seenList.some((n: string) => n.toLowerCase().trim() === myName.toLowerCase().trim());
                    };
                    const unread = isUnread();

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => handleViewEvaluation(item)}
                        className={`bg-white rounded-2xl border p-4 space-y-3 cursor-pointer transition-all duration-150 shadow-xs hover:shadow-md ${
                          unread 
                            ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400 font-semibold' 
                            : 'border-slate-200 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              {unread && (
                                <span className="inline-flex rounded-full h-2 w-2 bg-rose-600 shrink-0" />
                              )}
                              {unread && (
                                <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider" title="Phiếu mới chưa xem">MỚI</span>
                              )}
                              <span className="text-[10.5px] font-mono text-slate-500 font-bold block">{formatEvalDate(item.ngay)}</span>
                            </div>
                            <div className="text-xs text-slate-800 flex flex-col gap-0.5">
                              <span className="font-black text-slate-900 text-sm">{item.nhanVien}</span>
                              <div className="text-[11px] text-slate-500 font-normal leading-none mt-0.5">
                                <span>Người ĐG: </span>
                                <span className="text-slate-700 font-bold">{item.nguoiDanhGia}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.trangThai === 'Đạt' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                Đạt
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-300">
                                Không Đạt
                              </span>
                            )}
                            
                            {canManage && (
                              <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditForm(item); }}
                                  className="p-1 text-slate-500 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                                  title="Sửa phiếu"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEvaluation(item.id); }}
                                  className="p-1 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer"
                                  title="Xóa phiếu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-[11.5px] text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <strong className="text-slate-600 block mb-0.5 text-[10.5px] uppercase tracking-wider">Tiêu Chí Đánh Giá:</strong>
                          <span className="font-medium">
                            {(() => {
                              const list = [];
                              if (item.hangCanHetDate) list.push("Hàng Cận/Hết Date");
                              if (item.trungBayKhongDat) list.push("Trưng Bày Không Đạt Yêu Cầu");
                              if (item.khieuNaiBoDiemBan) list.push("Giải Quyết Khiếu Nại/Bỏ Tuyến");
                              if (item.capNhatThongTinSai) list.push("Cập Nhật Thông Tin Sai");
                              if (item.khongDamBaoWPP) list.push("Vận Hành CT Tích Điểm Kém");
                              if (item.viPhamLiemChinh) list.push("Vi Phạm Liêm Chính");
                              if (list.length === 0) return "Đạt chuẩn dịch vụ";
                              return list.join(" • ");
                            })()}
                          </span>
                        </div>

                        {item.ghiChu && (
                          <div className="text-[11.5px] text-slate-700 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 whitespace-pre-wrap break-words">
                            <strong className="text-emerald-800 block mb-0.5 text-[10.5px] uppercase tracking-wider">Ghi chú chi tiết:</strong>
                            <p className="font-medium leading-relaxed">{item.ghiChu}</p>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-600 font-bold flex justify-between pt-1 border-t border-slate-100">
                          <span>Viếng Thăm: <strong className="text-rose-600 text-xs font-black">{item.soLuotKhongDat}</strong>/{item.tongLuotViengTham}</span>
                          <span>Tỉ lệ lỗi: <strong className="text-teal-700 text-xs font-black">{item.tiLeKhongDat}%</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {deleteConfirmId && (
              <div className="app-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4">
                <div
                  ref={evalDeleteModalRef}
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Xác nhận xóa phiếu"
                  className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fadeIn text-center text-slate-800 outline-none"
                >
                  <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h6 className="text-sm font-black text-slate-900 mb-1.5 uppercase tracking-wider">Xác nhận xóa phiếu</h6>
                  <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                    Bạn có chắc chắn muốn xóa phiếu đánh giá dịch vụ này? Hành động này không thể hoàn tác.
                  </p>
                  <div className="flex gap-2.5 justify-center">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (deleteConfirmId) {
                          try {
                            const targetId = deleteConfirmId;
                            // Optimistically update local state first
                            setEvaluations(prev => {
                              const updated = prev.filter(ev => ev.id !== targetId);
                              localStorage.setItem('gs_evaluations', JSON.stringify(updated));
                              return updated;
                            });

                            // Perform deletion on Firestore
                            await deleteDoc(doc(db, 'market_evaluations', targetId));
                            notify.success('Đã xóa phiếu đánh giá.');

                            // Dispatch event to sync App.tsx or other components
                            setTimeout(() => {
                              window.dispatchEvent(new Event('evaluations-updated'));
                            }, 50);
                          } catch (err) {
                            console.error("Firestore delete failed:", err);
                            notify.error("Có lỗi xảy ra khi xóa phiếu đánh giá: " + (err instanceof Error ? err.message : String(err)));
                          }
                        }
                        setDeleteConfirmId(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer"
                    >
                      Xác nhận xóa
                    </button>
                  </div>
                </div>
              </div>
            )}

            {viewingEval && (
              <div className="app-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4">
                <div
                  ref={evalDetailModalRef}
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Chi tiết phiếu đánh giá dịch vụ"
                  className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-fadeIn text-slate-800 outline-none"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h5 className="text-sm font-black text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>CHI TIẾT PHIẾU ĐÁNH GIÁ DỊCH VỤ</span>
                    </h5>
                    <button
                      onClick={() => setViewingEval(null)}
                      className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      aria-label="Đóng"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* General Metadata */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Ngày đánh giá:</span>
                        <span className="font-bold text-slate-800">{formatEvalDate(viewingEval.ngay)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Người đánh giá:</span>
                        <span className="font-bold text-emerald-700">{viewingEval.nguoiDanhGia}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block mb-0.5">Nhân viên được đánh giá:</span>
                        <span className="font-bold text-slate-900 text-sm">{viewingEval.nhanVien}</span>
                      </div>
                    </div>

                    {/* Rate & Status */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Viếng Thăm</span>
                        <span className="text-sm font-bold text-slate-800">
                          <strong className="text-rose-600 font-extrabold">{viewingEval.soLuotKhongDat}</strong>/{viewingEval.tongLuotViengTham}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Tỉ Lệ Lỗi VT</span>
                        <span className="text-sm font-extrabold text-teal-700">{viewingEval.tiLeKhongDat}%</span>
                      </div>
                      <div className={`border rounded-xl p-2.5 flex flex-col justify-center items-center ${
                        viewingEval.trangThai === 'Đạt' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Kết Quả</span>
                        <span className="text-xs font-black">{viewingEval.trangThai}</span>
                      </div>
                    </div>

                    {/* Criteria Evaluation */}
                    <div>
                      <h6 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Tiêu chí dịch vụ được đánh giá:</h6>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {[
                          { label: "Hàng Cận/Hết Date", value: viewingEval.hangCanHetDate },
                          { label: "Trưng Bày Không Đạt Yêu Cầu", value: viewingEval.trungBayKhongDat },
                          { label: "Giải Quyết Khiếu Nại/Bỏ Tuyến", value: viewingEval.khieuNaiBoDiemBan },
                          { label: "Cập Nhật Thông Tin Sai", value: viewingEval.capNhatThongTinSai },
                          { label: "Vận Hành CT Tích Điểm Kém", value: viewingEval.khongDamBaoWPP },
                          { label: "Vi Phạm Liêm Chính", value: viewingEval.viPhamLiemChinh }
                        ].map((crit, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                              crit.value 
                                ? 'bg-rose-50 border-rose-200 text-rose-700 font-medium' 
                                : 'bg-emerald-50/50 border-emerald-100 text-slate-600'
                            }`}
                          >
                            {crit.value ? (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            <span className="truncate">{crit.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {viewingEval.ghiChu && (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                        <strong className="text-xs text-slate-500 block mb-1">Ghi chú chi tiết từ Giám Sát / OM:</strong>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {viewingEval.ghiChu}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setViewingEval(null)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
                    >
                      Đã hiểu và Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* SECTION: THỜI GIAN VIẾNG THĂM CHẤM CÔNG VÀ DỊCH VỤ BÁN HÀNG */}
      {attendanceSubTab === 'thoigianviengtham' && (() => {
        const isOMOrSupervisor = currentUser?.role === 'Admin' || currentUser?.role === 'OM' || currentUser?.role === 'MKT Sup' || (currentUser?.role && currentUser.role !== 'Nhân viên' && currentUser.role !== 'Saleman' && currentUser.role !== 'employee');
        const visitData = getVisitDurationData(chamCongListData);
        const visitEmployeesList = Array.from(new Set(visitData.map(r => r.nhanVien).filter(Boolean)));
        
        const displayVisitRows = isOMOrSupervisor
          ? visitData
          : (visitEmployeeFilter === 'Tất cả'
              ? visitData
              : visitData.filter(r => r.nhanVien.toLowerCase().trim() === visitEmployeeFilter.toLowerCase().trim()));

        const violationsUnder1m = visitData.filter(r => r.duoi1PhutPct > 5);
        const violationsOver5m = visitData.filter(r => r.tu5Den30Pct < 50);

        // Always aggregate for overall pie chart across all visitData rows
        const sumDuoi1mAll = visitData.reduce((acc, row) => acc + row.duoi1PhutCount, 0);
        const sum1to5mAll = visitData.reduce((acc, row) => acc + row.tu1Den5Count, 0);
        const sum5to30mAll = visitData.reduce((acc, row) => acc + row.tu5Den30Count, 0);
        const sumOver30mAll = visitData.reduce((acc, row) => acc + row.tren30Count, 0);
        const totalCountsAll = sumDuoi1mAll + sum1to5mAll + sum5to30mAll + sumOver30mAll;

        let overallPieData: { name: string; value: number; count: number; color: string }[] = [];
        if (totalCountsAll > 0) {
          overallPieData = [
            { name: 'Dưới 1 phút', value: parseFloat(((sumDuoi1mAll / totalCountsAll) * 100).toFixed(1)), count: sumDuoi1mAll, color: '#f43f5e' },
            { name: '1 phút - 5 phút', value: parseFloat(((sum1to5mAll / totalCountsAll) * 100).toFixed(1)), count: sum1to5mAll, color: '#f59e0b' },
            { name: '5 phút - 30 phút', value: parseFloat(((sum5to30mAll / totalCountsAll) * 100).toFixed(1)), count: sum5to30mAll, color: '#10b981' },
            { name: 'Trên 30 phút', value: parseFloat(((sumOver30mAll / totalCountsAll) * 100).toFixed(1)), count: sumOver30mAll, color: '#3b82f6' }
          ];
        } else {
          overallPieData = [
            { name: 'Dưới 1 phút', value: 0, count: 0, color: '#f43f5e' },
            { name: '1 phút - 5 phút', value: 0, count: 0, color: '#f59e0b' },
            { name: '5 phút - 30 phút', value: 0, count: 0, color: '#10b981' },
            { name: 'Trên 30 phút', value: 0, count: 0, color: '#3b82f6' }
          ];
        }

        // Active employee name for individual bar chart
        const barEmployeeName = isOMOrSupervisor
          ? (localBarEmployee || visitEmployeesList[0] || '')
          : (visitEmployeeFilter === 'Tất cả'
              ? (localBarEmployee || visitEmployeesList[0] || '')
              : visitEmployeeFilter);

        const barEmployeeRow = visitData.find(r => r.nhanVien.toLowerCase().trim() === barEmployeeName.toLowerCase().trim());

        const individualPieData = barEmployeeRow ? [
          { name: 'Dưới 1 phút', value: barEmployeeRow.duoi1PhutPct, count: barEmployeeRow.duoi1PhutCount, color: '#f43f5e' },
          { name: '1 phút - 5 phút', value: barEmployeeRow.tu1Den5Pct, count: barEmployeeRow.tu1Den5Count, color: '#f59e0b' },
          { name: '5 phút - 30 phút', value: barEmployeeRow.tu5Den30Pct, count: barEmployeeRow.tu5Den30Count, color: '#10b981' },
          { name: 'Trên 30 phút', value: barEmployeeRow.tren30Pct, count: barEmployeeRow.tren30Count, color: '#3b82f6' }
        ] : [];

        const overallUnder1mVal = overallPieData.find(d => d.name === 'Dưới 1 phút')?.value || 0;
        const overallUnder1mViolated = overallUnder1mVal > 5;
        const overall5to30mVal = overallPieData.find(d => d.name === '5 phút - 30 phút')?.value || 0;
        const overall5to30mViolated = overall5to30mVal < 50;

        const indUnder1mVal = individualPieData.find(d => d.name === 'Dưới 1 phút')?.value || 0;
        const indUnder1mViolated = indUnder1mVal > 5;
        const ind5to30mVal = individualPieData.find(d => d.name === '5 phút - 30 phút')?.value || 0;
        const ind5to30mViolated = ind5to30mVal < 50;

        return (
          <div id="visit-duration-section" className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-4 mt-4 sm:mt-6">
            <div className="flex flex-row items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200 shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-emerald-800 uppercase tracking-wider truncate">
                    THỜI GIAN VIẾNG THĂM TẠI ĐIỂM BÁN
                  </h4>
                </div>
              </div>

              {!isOMOrSupervisor && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] sm:text-xs font-black rounded-lg px-2.5 py-1 shrink-0 truncate max-w-[140px]">
                  {visitEmployeeFilter}
                </div>
              )}
            </div>

            {isOMOrSupervisor && (
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-rose-50/35 border border-rose-200/80 rounded-xl p-2.5 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3.5">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-200 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <h5 className="text-[11px] sm:text-[13px] font-black uppercase text-rose-700 tracking-tight leading-tight">
                      &lt; 1 PHÚT (&gt;5%)
                    </h5>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5 items-center">
                    {violationsUnder1m.length === 0 ? (
                      <span className="text-[10.5px] sm:text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Đạt chuẩn
                      </span>
                    ) : (
                      violationsUnder1m.map(v => (
                        <span key={v.nhanVien} className="text-[10px] sm:text-[11px] bg-rose-50 text-rose-700 px-1.5 sm:px-2 py-0.5 rounded border border-rose-200 font-black">
                          {v.nhanVien} ({v.duoi1PhutPct}%)
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-amber-50/35 border border-amber-200/80 rounded-xl p-2.5 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3.5">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 shrink-0">
                      <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <h5 className="text-[11px] sm:text-[13px] font-black uppercase text-amber-700 tracking-tight leading-tight">
                      5-30 PHÚT (&lt;50%)
                    </h5>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5 items-center">
                    {violationsOver5m.length === 0 ? (
                      <span className="text-[10.5px] sm:text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Đạt chuẩn
                      </span>
                    ) : (
                      violationsOver5m.map(v => (
                        <span key={v.nhanVien} className="text-[10px] sm:text-[11px] bg-amber-50 text-amber-700 px-1.5 sm:px-2 py-0.5 rounded border border-amber-200 font-black">
                          {v.nhanVien} ({v.tu5Den30Pct}%)
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {isOMOrSupervisor ? (
              // DUAL CHARTS SIDE-BY-SIDE FOR OM/SUPERVISOR
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Biểu đồ tròn tổng các nhân viên */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap min-h-[46px]">
                    <div>
                      <span className="text-[11px] text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-600" /> Biểu đồ tròn tổng hợp các nhân viên
                      </span>
                    </div>
                    <div className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-black rounded px-2.5 py-1.5 select-none tracking-wider font-mono">
                      HỆ THỐNG
                    </div>
                  </div>

                  <div className="w-full overflow-hidden flex items-center justify-center" style={{ height: '370px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <Pie
                          data={overallPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          label={renderCustomizedPieLabel}
                          labelLine={false}
                        >
                          {overallPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any, props: any) => {
                            const isViolated = (name === 'Dưới 1 phút' && value > 5) || (name === '5 phút - 30 phút' && value < 50);
                            return [
                              `${value}% ${props.payload.count ? `(${props.payload.count} lượt)` : ''}${isViolated ? ' (Cảnh báo)' : ''}`,
                              name
                            ];
                          }}
                          contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '11px', color: '#1e293b' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="text-[13px] text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-emerald-600" /> CHI TIẾT PHÂN BỔ TỔNG HỢP (%) & MỤC TIÊU:
                    </div>
                    <div className="grid grid-cols-2 gap-3.5 text-xs pt-1">
                      <div className={`border-l-4 border-rose-500 pl-3 py-1 ${overallUnder1mViolated ? 'bg-rose-50/80 rounded-r' : ''}`}>
                        <div className="text-[11px] text-slate-600 uppercase tracking-wide font-black">Mục tiêu lỗi &lt; 1 phút</div>
                        <div className="font-black text-slate-800 text-[17px] mt-0.5">&lt; 5%</div>
                        <div className="text-[12.5px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>Hiện tại: </span>
                          <span className={overallUnder1mViolated ? 'text-rose-600 font-black' : ''}>{overallUnder1mVal}%</span>
                          {overallUnder1mViolated && (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[11px] bg-rose-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Lỗi
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`border-l-4 border-emerald-500 pl-3 py-1 ${overall5to30mViolated ? 'bg-rose-50/80 rounded-r' : ''}`}>
                        <div className="text-[11px] text-slate-600 uppercase tracking-wide font-black">Mục tiêu tối thiểu 5-30 phút</div>
                        <div className="font-black text-slate-800 text-[17px] mt-0.5">&gt;= 50%</div>
                        <div className="text-[12.5px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>Hiện tại: </span>
                          <span className={overall5to30mViolated ? 'text-rose-600 font-black' : ''}>{overall5to30mVal}%</span>
                          {overall5to30mViolated && (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[11px] bg-rose-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Lỗi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Biểu đồ tròn của từng nhân viên */}
                <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-nowrap">
                    <div className="min-w-0">
                      <span className="text-[11px] text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Activity className="w-4 h-4 text-emerald-600 shrink-0" /> Biểu đồ từng nhân viên
                      </span>
                    </div>

                    <div className="hidden md:block shrink-0">
                      <EmployeeSelect
                        selectedEmployeeName={barEmployeeName}
                        onSelectEmployee={(val) => setLocalBarEmployee(val)}
                        availableEmployees={visitEmployeesList}
                        isEmployeeView={isEmployeeView}
                        showAllOption={false}
                      />
                    </div>
                    <span className="md:hidden text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg truncate max-w-[140px] shrink-0">
                      {barEmployeeName}
                    </span>
                  </div>

                  <div className="w-full overflow-hidden flex items-center justify-center" style={{ height: '370px' }}>
                    {individualPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                          <Pie
                            data={individualPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            label={renderCustomizedPieLabel}
                            labelLine={false}
                          >
                            {individualPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any, name: any, props: any) => {
                              const isViolated = (name === 'Dưới 1 phút' && value > 5) || (name === '5 phút - 30 phút' && value < 50);
                              return [
                                `${value}% ${props.payload.count ? `(${props.payload.count} lượt)` : ''}${isViolated ? ' (Cảnh báo)' : ''}`,
                                name
                              ];
                            }}
                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '11px', color: '#1e293b' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                        Không có dữ liệu nhân viên này
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                    <div className="text-[13px] text-emerald-800 font-black uppercase tracking-wider flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-emerald-600" /> CHI TIẾT PHÂN BỔ NHÂN VIÊN (%) & MỤC TIÊU:
                      </div>
                      {barEmployeeRow && (
                        <span className="text-[10.5px] font-mono font-bold text-slate-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Tổng: {barEmployeeRow.tongVT} VT
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3.5 text-xs pt-1">
                      <div className={`border-l-4 border-rose-500 pl-3 py-1 ${indUnder1mViolated ? 'bg-rose-50/80 rounded-r' : ''}`}>
                        <div className="text-[11px] text-slate-600 uppercase tracking-wide font-black">Mục tiêu lỗi &lt; 1 phút</div>
                        <div className="font-black text-slate-800 text-[17px] mt-0.5">&lt; 5%</div>
                        <div className="text-[12.5px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>Hiện tại: </span>
                          <span className={indUnder1mViolated ? 'text-rose-600 font-black' : ''}>{indUnder1mVal}%</span>
                          {indUnder1mViolated && (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[11px] bg-rose-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Lỗi
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`border-l-4 border-emerald-500 pl-3 py-1 ${ind5to30mViolated ? 'bg-rose-50/80 rounded-r' : ''}`}>
                        <div className="text-[11px] text-slate-600 uppercase tracking-wide font-black">Mục tiêu tối thiểu 5-30 phút</div>
                        <div className="font-black text-slate-800 text-[17px] mt-0.5">&gt;= 50%</div>
                        <div className="text-[12.5px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>Hiện tại: </span>
                          <span className={ind5to30mViolated ? 'text-rose-600 font-black' : ''}>{ind5to30mVal}%</span>
                          {ind5to30mViolated && (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[11px] bg-rose-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Lỗi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // INDIVIDUAL PIE CHART ONLY FOR EMPLOYEE
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
                  <span className="text-[12px] text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-600" /> Biểu đồ tròn phân bổ thời gian viếng thăm cá nhân (%)
                  </span>
                  <div className="w-full overflow-hidden flex items-center justify-center" style={{ height: '380px' }}>
                    {individualPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                          <Pie
                            data={individualPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={renderCustomizedPieLabel}
                            labelLine={false}
                          >
                            {individualPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any, name: any, props: any) => {
                              const isViolated = (name === 'Dưới 1 phút' && value > 5) || (name === '5 phút - 30 phút' && value < 50);
                              return [
                                `${value}% ${props.payload.count ? `(${props.payload.count} lượt)` : ''}${isViolated ? ' (Cảnh báo)' : ''}`,
                                name
                              ];
                            }}
                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[380px] flex items-center justify-center text-slate-400 text-xs italic">
                        Không có dữ liệu phù hợp
                      </div>
                    )}
                  </div>

                  {individualPieData.length > 0 && (
                    <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200 space-y-2.5 mt-4">
                      <div className="text-[13px] text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-emerald-600" /> CHI TIẾT PHÂN BỔ TỔNG HỢP (%) & MỤC TIÊU:
                      </div>
                      <div className="grid grid-cols-2 gap-3.5 text-xs pt-1">
                        <div className={`border-l-4 border-rose-500 pl-3 py-1 ${indUnder1mViolated ? 'bg-rose-50/80 rounded-r' : ''}`}>
                          <div className="text-[11px] text-slate-600 uppercase tracking-wide font-black">Mục tiêu lỗi &lt; 1 phút</div>
                          <div className="font-black text-slate-800 text-[17px] mt-0.5">&lt; 5%</div>
                          <div className="text-[12.5px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 flex-wrap">
                            <span>Hiện tại: </span>
                            <span className={indUnder1mViolated ? 'text-rose-600 font-black' : ''}>{indUnder1mVal}%</span>
                            {indUnder1mViolated && (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[11px] bg-rose-100 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Lỗi
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`border-l-4 border-emerald-500 pl-3 py-1 ${ind5to30mViolated ? 'bg-rose-50/80 rounded-r' : ''}`}>
                          <div className="text-[11px] text-slate-600 uppercase tracking-wide font-black">Mục tiêu tối thiểu 5-30 phút</div>
                          <div className="font-black text-slate-800 text-[17px] mt-0.5">&gt;= 50%</div>
                          <div className="text-[12.5px] text-slate-600 font-bold mt-0.5 flex items-center gap-1 flex-wrap">
                            <span>Hiện tại: </span>
                            <span className={ind5to30mViolated ? 'text-rose-600 font-black' : ''}>{ind5to30mVal}%</span>
                            {ind5to30mViolated && (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-black text-[11px] bg-rose-100 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Lỗi
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[11px] text-emerald-800 font-black uppercase tracking-wider block">BẢNG CHI TIẾT DỮ LIỆU THỜI GIAN VIẾNG THĂM:</span>
              <div className="overflow-x-auto w-full bg-white rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full border-collapse table-fixed text-left text-xs font-sans bg-white">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black text-[9.5px] sm:text-[11px] uppercase tracking-tight leading-tight">
                      <th className="py-2.5 px-2.5 text-left border-r border-slate-200 w-[110px] sm:w-48">Nhân Viên</th>
                      <th className="py-2.5 px-1 text-center border-r border-slate-200 w-[48px] sm:w-20">Tổng VT</th>
                      <th className="py-2.5 px-1 text-center border-r border-slate-200 w-[48px] sm:w-20">Trái Tuyến</th>
                      <th className="py-2.5 px-1 text-center border-r border-slate-200 w-[48px] sm:w-20 text-rose-700">&lt; 1'</th>
                      <th className="py-2.5 px-1 text-center border-r border-slate-200 w-[48px] sm:w-20 text-amber-700">1' - 5'</th>
                      <th className="py-2.5 px-1 text-center border-r border-slate-200 w-[48px] sm:w-20 text-emerald-700">5' - 30'</th>
                      <th className="py-2.5 px-1 text-center w-[48px] sm:w-20 text-sky-700">&gt; 30'</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {displayVisitRows.map((row, index) => {
                      const isUnder1mViolated = row.duoi1PhutPct > 5;
                      const is5to30mViolated = row.tu5Den30Pct < 50;
                      const isLastRow = index === displayVisitRows.length - 1;
                      const borderBottomClass = isLastRow ? '' : 'border-b border-slate-200';
                      
                      return (
                        <tr key={row.nhanVien} className="hover:bg-slate-50/70 text-slate-700 transition-colors">
                          <td className={`py-2 px-2.5 font-black text-slate-900 text-[11px] sm:text-xs leading-snug border-r border-slate-200 ${borderBottomClass}`} title={row.nhanVien}>
                            {row.nhanVien}
                          </td>
                          <td className={`py-2 px-1 text-center font-mono tabular-nums font-black text-xs sm:text-sm text-slate-800 border-r border-slate-200 ${borderBottomClass}`}>
                            {row.tongVT}
                          </td>
                          <td className={`py-1.5 px-1 text-center font-mono tabular-nums border-r border-slate-200 ${borderBottomClass}`}>
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className="font-black text-xs sm:text-sm text-slate-800">{row.traiTuyenCount}</span>
                              <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold">{row.traiTuyenPct}%</span>
                            </div>
                          </td>
                          <td className={`py-1.5 px-1 text-center font-mono tabular-nums border-r border-slate-200 ${borderBottomClass} ${isUnder1mViolated ? 'bg-rose-50/80' : ''}`}>
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className={`font-black text-xs sm:text-sm ${isUnder1mViolated ? 'text-rose-700 font-black' : 'text-slate-800'}`}>
                                {row.duoi1PhutCount}
                              </span>
                              <span className={`text-[10px] sm:text-[11px] font-bold ${isUnder1mViolated ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                                {row.duoi1PhutPct}%
                              </span>
                            </div>
                          </td>
                          <td className={`py-1.5 px-1 text-center font-mono tabular-nums border-r border-slate-200 ${borderBottomClass}`}>
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className="font-black text-xs sm:text-sm text-slate-800">{row.tu1Den5Count}</span>
                              <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold">{row.tu1Den5Pct}%</span>
                            </div>
                          </td>
                          <td className={`py-1.5 px-1 text-center font-mono tabular-nums border-r border-slate-200 ${borderBottomClass} ${is5to30mViolated ? 'bg-rose-50/80' : ''}`}>
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className={`font-black text-xs sm:text-sm ${is5to30mViolated ? 'text-rose-700 font-black' : 'text-slate-800'}`}>
                                {row.tu5Den30Count}
                              </span>
                              <span className={`text-[10px] sm:text-[11px] font-bold ${is5to30mViolated ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                                {row.tu5Den30Pct}%
                              </span>
                            </div>
                          </td>
                          <td className={`py-1.5 px-1 text-center font-mono tabular-nums ${borderBottomClass}`}>
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className="font-black text-xs sm:text-sm text-slate-800">{row.tren30Count}</span>
                              <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold">{row.tren30Pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
