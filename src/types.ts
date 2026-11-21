export type UserRole = 'manager' | 'employee' | 'MKT Sup' | 'OM' | 'Saleman' | 'Admin' | 'Nhân viên';

export interface UserProfile {
  name: string;
  role: UserRole;
  email?: string;
  mappedEmployeeName?: string;
}

export interface UserPermission {
  email: string;
  password?: string;
  role: string;
  mappedEmployee?: string; // Optional employee name mapping
  hoVaTen?: string;        // Column A: Họ và Tên
  vtbhCode?: string;       // Column E: Mã VTBH
  channel?: string;        // Column F: Kênh
  tenThuongGoi?: string;   // Column G: Tên Thường Gọi
  locked?: boolean;        // Lock status
  avatarUrl?: string;      // Unified user avatar image url or base64 string
  deleted?: boolean;       // Account soft-deleted indicator
  soLuotTruyCap?: number;  // Number of access times
  zaloPhone?: string;      // Zalo phone number or account identifier
  phoneNumber?: string;    // Direct phone number
}

export interface EmployeeTargetRow {
  name: string;
  targetVal: number;
  actualVal: number;
  completionRate: number;
  k3Target: number;
  k3Actual: number;
  k4Target: number;
  k4Actual: number;
  khTarget?: number;
  khActual?: number;
  khmhThangTarget?: number;
  khmhThangActual?: number;
  ghiChu: string;
  rawRow?: any;
}

export interface SoBanRaw {
  Ngay: string;
  NhanVien: string;
  NganhHang: string;
  SanPham: string;
  SoLuong: number;
  DoanhSo: number;
  ChiTieu?: number;
  ThucHien?: number;
  rawRow?: any;
}

export interface GrowthRow {
  nhomSanPham: string;
  sanLuong2025: number;
  sanLuong2026: number;
  tangGiamSanLuong: number;
  tiLeTangTruongSanLuong: number;
  doanhSo2025: number;
  doanhSo2026: number;
  tangGiamDoanhSo: number;
  tiLeTangTruongDoanhSo: number;
  _physicalRowIndex?: number;
  cungKyNamNgoai?: number;
  rawRow?: any;
}

export interface AnnualBonusColumnHeader {
  colLetter: string;
  colIndex: number;
  title: string;
}

export interface AnnualBonusCell {
  colLetter: string;
  colIndex: number;
  headerTitle: string;
  rawValue: any;
  displayValue: string;
  numericValue: number;
}

export interface AnnualBonusGroup {
  groupName: string;
  startColLetter: string;
  target: number;
  actual: number;
  completionRate: number;
  groupPoints: number;
}

export interface AnnualBonusEmployeeRow {
  employeeName: string;
  _physicalRowIndex?: number;
  cells?: { [colLetter: string]: AnnualBonusCell };
  groups: AnnualBonusGroup[];
  totalPoints: number;
  rawRow?: any;
}

export interface SheetDataState {
  employees: EmployeeTargetRow[];
  transactions: SoBanRaw[];
  permissions?: UserPermission[];
  lastUpdated: string;
  growthData?: GrowthRow[];
  annualBonusData?: AnnualBonusEmployeeRow[];
  sectorData?: {
    [employeeName: string]: {
      [sector: string]: {
        target: number;
        actual: number;
      };
    };
  };
  cttbData?: {
    [employeeName: string]: {
      [program: string]: {
        khDat: number;
        khThamGia: number;
        khKhongBoAnh: number;
        target?: number;
        actual?: number;
      };
    };
  };
  activationListData?: any[];
  trungBayListData?: any[];
  clfDetailedRows?: any[];
  mccDetailedRows?: any[];
  ndfcDetailedRows?: any[];
  chamCongListData?: any[];
  inventoryData?: InventoryItem[];
  thiDuaData?: ThiDuaBlock[];
  tuNhienRecords?: TuNhienRecord[];
  meizanRecords?: MeizanRecord[];
}

export interface MeizanRecord {
  rowNum: number;
  employeeName: string;
  khThamGia: number;
  khDat: number;
  rate: number;
  khKhongBoAnh: number;
}

export interface TuNhienRecord {
  rowNum: number;
  employeeName: string;
  khThamGia: number;
  khDat: number;
  khKhongBoAnh: number;
  rate: number;
}

export interface ThiDuaBlock {
  programId?: string;  // Unique identifier for matching custom/dynamic programs
  isCustom?: boolean;   // Flag whether this block is a dynamic/custom program
  programName: string; // e.g., "Thi đua Bột Ngọt"
  startCol: string;    // e.g., "A"
  endCol: string;      // e.g., "E"
  range: string;       // e.g., "A2:E11"
  headers: string[];   // Header labels from row 2
  rows: Record<string, string>[]; // Data rows from rows 3..11
  summaryRow?: Record<string, string>; // Totals row data from sheet row 10
}

export interface CompetitionSchemeTier {
  condition: string;
  reward: string;
}

export type CompetitionColumnRole =
  | 'employee_name'    // Tên nhân viên
  | 'target'           // Chỉ tiêu
  | 'actual'           // Thực hiện
  | 'percentage'       // Tỷ lệ % hoàn thành
  | 'evaluation'       // Xét thưởng / Tiêu chí đạt
  | 'bonus'            // Tiền thưởng
  | 'general';         // Dữ liệu chung / số lượng / text

export type CompetitionColumnFormat =
  | 'text'
  | 'number'
  | 'currency'
  | 'percentage';

export interface DynamicColumnConfig {
  id: string;
  label: string;
  colLetter: string;
  role: CompetitionColumnRole;
  format?: CompetitionColumnFormat;
  description?: string;
  isVisible?: boolean;
}

export interface CompetitionProgramConfig {
  id: string;
  title: string;
  shortTitle: string;
  range?: string;
  sheetTab?: string;
  time: string;
  isActive?: boolean;
  isArchived?: boolean;
  isCustom?: boolean;
  intro?: string;
  conditions: string[];
  tiers: CompetitionSchemeTier[];
  details?: string[];
  columns?: DynamicColumnConfig[];
  updatedBy?: string;
  updatedAt?: string;
  statusUpdatedBy?: string;
  statusUpdatedAt?: string;
}

export interface CompetitionProgramLog {
  id: string;
  programId: string;
  programTitle: string;
  action: 'create' | 'update' | 'delete' | 'toggle_status' | 'archive' | 'unarchive' | 'reset_defaults';
  performedBy: string;
  timestamp: string;
  details: string;
}

export interface InventoryItem {
  maCDS: string;
  tenSanPham: string;
  tonThung: number;
  tonLe: number;
  donGiaThung?: number;
  donGiaLe?: number;
  ctkm1?: string;
  ctkm2?: string;
  ctkm3?: string;
  colA?: string;
  colB?: string;
  colC?: string;
  colD?: string;
  colI?: string;
  colJ?: string;
  colL?: string;
  colM?: string;
  colN?: string;
  colO?: string;
  colP?: string;
  rawRow?: any;
}

export type GiftSurveyStatus = 'Đồng ý mua hàng' | 'Chưa đồng ý mua hàng';

export interface CustomerSurveyRecord {
  id: string;
  customerCode: string;
  customerName: string;
  customerEmployee?: string;
  surveyor: string;
  giftStatus: GiftSurveyStatus | string;
  giftName?: string;
  giftQty?: number;
  customerFeedback?: string;
  combinedOpinion: string;
  imageUrl?: string;
  sheetSynced: boolean;
  submittedAt: string;
  source?: 'firestore' | 'sheet';
}

export interface SurveyConfig {
  appsScriptUrl: string;
  driveFolderName?: string;
  updatedBy?: string;
  updatedAt?: string;
}

