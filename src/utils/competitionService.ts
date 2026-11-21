import { 
  db, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  onSnapshot, 
  collection, 
  getDocFromServer,
  getDocsFromServer,
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { CompetitionProgramConfig, CompetitionProgramLog } from '../types';

export const CACHED_COMPETITION_PROGRAMS_KEY = 'cached_competition_programs';

export function isProgramArchivedStrict(p: any): boolean {
  if (!p) return false;
  return p.isArchived === true || p.isArchived === 'true';
}

export function isProgramActiveStrict(p: any): boolean {
  if (!p) return false;
  if (isProgramArchivedStrict(p)) return false;
  if (p.isActive === false || p.isActive === 'false' || p.isActive === 0) return false;
  if (p.status === 'inactive' || p.status === 'disabled' || p.status === 'off' || p.status === 'archived') return false;
  return p.isActive === true;
}

export const DEFAULT_COMPETITION_PROGRAMS: CompetitionProgramConfig[] = [
  {
    id: 'bot_ngot',
    title: 'Thi đua Bột Ngọt',
    shortTitle: 'Bột Ngọt',
    range: 'A2:E11',
    time: '21/07/2026 - 20/08/2026',
    isActive: true,
    conditions: [
      'Chỉ tiêu phát sinh đơn hàng: Tối thiểu 30 Đơn hàng Bột Ngọt hoặc Hạt Nêm'
    ],
    tiers: [
      { condition: 'Mức 1: Số thùng Bột Ngọt ≥ 50', reward: 'Thưởng thêm 5.000đ / thùng' },
      { condition: 'Mức 2: Số thùng Bột Ngọt ≥ 100', reward: 'Thưởng thêm 10.000đ / thùng' },
      { condition: 'Mức 3: Số thùng Bột Ngọt ≥ 150', reward: 'Thưởng thêm 15.000đ / thùng' }
    ],
    details: [
      'Trong chu kỳ thi đua, nhân viên bán hàng đạt được các mốc sau sẽ được thưởng thêm trực tiếp trên mỗi đầu thùng.',
      'Sản phẩm tính thưởng bao gồm các quy cách Bột Ngọt tiêu chuẩn theo thông báo kinh doanh.'
    ]
  },
  {
    id: 'mcc',
    title: 'Thi đua MCC',
    shortTitle: 'MCC',
    range: 'G2:N11',
    time: 'Từ 21/07/2026 - 20/09/2026 (Lũy kế 3 Chu kỳ)',
    isActive: true,
    conditions: [
      'Trong kỳ triển khai, mỗi NVBH cần bán tối thiểu 15 thùng Bột Nếp và Bột Gạo',
      'Hoàn thành chỉ tiêu lũy kế trong chu kỳ thi đua ≥ 100%'
    ],
    tiers: [
      { condition: 'Sản lượng bán ≥ 6.5 tấn đến dưới 10 tấn', reward: 'Thưởng 3.500.000đ / đội bán hàng' },
      { condition: 'Sản lượng bán ≥ 10 tấn đến dưới 14 tấn', reward: 'Thưởng 4.500.000đ / đội bán hàng' }
    ],
    details: [
      'Áp dụng cho toàn bộ Đội ngũ Bán hàng (NVBH, OM).',
      'Chỉ tiêu sản lượng tính chung cho cả Đội Bán Hàng theo hạn mức phân bổ.'
    ]
  },
  {
    id: 'gao',
    title: 'Thi Đua Gạo',
    shortTitle: 'Gạo',
    range: 'P2:U11',
    time: '21/07/2026 - 20/08/2026',
    isActive: true,
    conditions: [
      'Hoàn thành tối thiểu 100% chỉ tiêu ngành hàng Gạo trong chu kỳ triển khai'
    ],
    tiers: [
      { condition: 'Mức 1: Hoàn thành từ 100% đến < 110%', reward: 'Thưởng 300.000đ / NVBH, OM' },
      { condition: 'Mức 2: Hoàn thành từ 110% đến < 120%', reward: 'Thưởng 500.000đ / NVBH, OM' },
      { condition: 'Mức 3: Hoàn thành từ 120% trở lên', reward: 'Thưởng 700.000đ / NVBH, OM' }
    ],
    details: [
      'Xét thưởng theo tỷ lệ % hoàn thành chỉ tiêu doanh số/sản lượng thực tế được phê duyệt.'
    ]
  },
  {
    id: 'nrc_cao_cap',
    title: 'Thi đua NRC Cao Cấp',
    shortTitle: 'NRC Cao Cấp',
    range: 'W2:AC11',
    time: 'Từ 21/07 - 20/08',
    isActive: true,
    conditions: [
      'Điều kiện 1: Sản lượng NRC Lô Hội đạt tối thiểu 5 thùng',
      'Điều kiện 2: Tổng sản lượng NRC Lô Hội & Bưởi Tây đạt tối thiểu 20 thùng'
    ],
    tiers: [
      { condition: 'Đạt đủ điều kiện trên', reward: 'Thưởng thêm 30.000đ / thùng' }
    ],
    details: [
      'Áp dụng thưởng thêm trên tất cả các thùng NRC Lô Hội & Bưởi Tây phát sinh hợp lệ.'
    ]
  },
  {
    id: 'giat_xa',
    title: 'Thi đua Giặt Xả',
    shortTitle: 'Giặt Xả',
    range: 'AE2:AO11',
    time: '21/07 - 20/08',
    isActive: true,
    conditions: [
      'Nước xả vải đạt tối thiểu 6 thùng',
      'Tổng sản lượng các sản phẩm áp dụng đạt tối thiểu 70 thùng'
    ],
    tiers: [
      { condition: 'Nước xả vải', reward: '35.000đ / thùng' },
      { condition: 'Nước giặt 3kg / 2.5kg', reward: '20.000đ / thùng' },
      { condition: 'Nước giặt 3.2kg / 3.4kg / 9kg', reward: '10.000đ / thùng' },
      { condition: 'Bột giặt QR', reward: '25.000đ / thùng' },
      { condition: 'Viên giặt', reward: '100.000đ / thùng' }
    ],
    details: [
      'Mức chi trả tính theo từng thùng thực tế bán ra đối với các SKU đạt chuẩn thi đua.'
    ]
  },
  {
    id: 'nrc_que',
    title: 'Thi đua NRC Quế',
    shortTitle: 'NRC Quế',
    range: 'AR2:AV11',
    time: '21/07 - 20/08',
    isActive: true,
    conditions: [
      'Kích hoạt tối thiểu 20 khách hàng mua hàng (Đơn vị tính kích hoạt: 0,5 thùng)'
    ],
    tiers: [
      { condition: 'Đạt đủ điều kiện trên', reward: 'Thưởng thêm 20.000đ / thùng' }
    ],
    details: [
      'Điểm bán được ghi nhận hợp lệ khi lấy từ 0.5 thùng trở lên.'
    ]
  },
  {
    id: 'tong_san_luong_hpc',
    title: 'Thi đua Tổng Sản Lượng HPC',
    shortTitle: 'Tổng SL HPC',
    range: 'AX2:BC11',
    time: '21/07 - 20/08',
    isActive: true,
    conditions: [
      'Đạt tối thiểu từ 101% tổng chỉ tiêu của NPP'
    ],
    tiers: [
      { condition: 'Đạt từ 101% trở lên', reward: 'Thưởng 500.000đ / NVBH, OM' },
      { condition: 'Đạt từ 105% trở lên', reward: 'Thưởng 1.000.000đ / NVBH, OM' }
    ],
    details: [
      'Căn cứ trên số liệu sản lượng tổng HPC của Nhà Phân Phối đạt ngưỡng quy định.'
    ]
  },
  {
    id: 'bot_mi_meizan',
    title: 'Thi đua Tổng Sản Lượng Bột Mì',
    shortTitle: 'Tổng SL Bột Mì',
    range: 'BE2:BI11',
    time: 'Từ 01/07 - 30/08',
    isActive: true,
    conditions: [
      'NVBH hoàn thành chỉ tiêu tổng sản lượng Bột Mì theo phân bổ của NPP'
    ],
    tiers: [
      { condition: 'Khách hàng đạt kích hoạt (≥ 20 KH)', reward: 'Thưởng 10.000đ / Cửa hàng đạt kích hoạt' }
    ],
    details: [
      'Khách hàng nằm trong danh sách điểm bán trọng điểm được phê duyệt bởi Giám sát thị trường.'
    ]
  },
  {
    id: 'prog_1790484173459_a09i',
    title: 'Thi đua Hạt Nêm Meizan',
    shortTitle: 'Hạt Nêm Meizan',
    range: 'BR2:BX11',
    sheetTab: 'Tổng hợp thi đua',
    time: 'Từ 21/09 - 20/11',
    isActive: true,
    isCustom: true,
    intro: 'Chương Trình Thi Đua Tổng Sản Lượng Hạt Nêm Meizan',
    conditions: [
      'Hoàn thành tối thiểu 100% chỉ tiêu được giao trong chu kỳ thi đua'
    ],
    tiers: [
      { condition: 'Hoàn thành từ 100% đến < 105%', reward: 'Thưởng thêm 4.000đ / thùng' },
      { condition: 'Hoàn thành từ 105% đến < 110%', reward: 'Thưởng thêm 6.000đ / thùng' },
      { condition: 'Hoàn thành từ 110% trở lên', reward: 'Thưởng thêm 8.000đ / thùng' }
    ],
    details: [],
    columns: [
      { id: 'col_1790484005564_0', label: 'Tên\nNhân Viên', colLetter: 'BR', role: 'employee_name', format: 'text', isVisible: true },
      { id: 'col_1790484005564_1', label: 'Chỉ\nTiêu', colLetter: 'BS', role: 'target', format: 'number', isVisible: true },
      { id: 'col_1790484005564_2', label: 'Thực\nHiện', colLetter: 'BT', role: 'actual', format: 'number', isVisible: true },
      { id: 'col_1790484005564_3', label: '% Hoàn\nThành', colLetter: 'BU', role: 'percentage', format: 'percentage', isVisible: true },
      { id: 'col_1790484015103_9cs6', label: 'Số\nThùng', colLetter: 'BV', role: 'general', format: 'number', isVisible: true },
      { id: 'col_1790484005564_4', label: 'Xét\nThưởng', colLetter: 'BW', role: 'evaluation', format: 'text', isVisible: true },
      { id: 'col_1790484005564_5', label: 'Tiền\nThưởng', colLetter: 'BX', role: 'bonus', format: 'currency', isVisible: true }
    ]
  },
  {
    id: 'prog_1790487414931_ny62',
    title: 'Thi đua Mở Mới Horeca',
    shortTitle: 'Mở Mới Horeca',
    range: 'BZ2:CG11',
    sheetTab: 'Tổng hợp thi đua',
    time: 'Từ 01/08 - 21/12',
    isActive: true,
    isCustom: true,
    intro: 'Chương trình thi đua mở mới khách hàng Horeca (HRC)',
    conditions: [
      'Mở mới khách hàng HRC trong chu kỳ'
    ],
    tiers: [
      { condition: 'Thưởng mở mới KH HRC trong chu kỳ & KH chưa mua hàng trong 3 tháng trước đó', reward: 'Tối đa 6% doanh thu (Tính theo tỉ lệ hoàn thành mở mới trong chu kỳ) * 3%' },
      { condition: 'Thưởng mua lại (Áp dụng với các KH mở mới trong các chu kỳ trước)', reward: '1% doanh thu' }
    ],
    details: [],
    columns: [
      { id: 'col_1790486309803_0', label: 'Tên Nhân Viên', colLetter: 'BZ', role: 'employee_name', format: 'text', isVisible: true },
      { id: 'col_1790486309803_1', label: 'Chỉ Tiêu', colLetter: 'CA', role: 'target', format: 'number', isVisible: true },
      { id: 'col_1790486309803_2', label: 'Thực Hiện', colLetter: 'CB', role: 'actual', format: 'number', isVisible: true },
      { id: 'col_1790486309803_3', label: 'Doanh Số', colLetter: 'CC', role: 'general', format: 'currency', isVisible: true },
      { id: 'col_1790486309803_4', label: 'Tỉ Lệ Thưởng', colLetter: 'CD', role: 'percentage', format: 'percentage', isVisible: true },
      { id: 'col_1790486309803_5', label: 'Tiền Thưởng Mở Mới', colLetter: 'CE', role: 'general', format: 'currency', isVisible: true },
      { id: 'col_1790486512563_84ya', label: 'Thưởng Mua Lại', colLetter: 'CF', role: 'general', format: 'currency', isVisible: true },
      { id: 'col_1790486549883_9c9r', label: 'Tổng Thưởng', colLetter: 'CG', role: 'bonus', format: 'currency', isVisible: true }
    ]
  }
];

const DEFAULT_ORDER_MAP = new Map(DEFAULT_COMPETITION_PROGRAMS.map((p, idx) => [p.id, idx]));

function normalizeProgramDoc(id: string, data: any): CompetitionProgramConfig {
  const isArchived = isProgramArchivedStrict(data);
  const explicitInactive =
    isArchived ||
    data?.isActive === false ||
    data?.isActive === 'false' ||
    data?.isActive === 0 ||
    data?.status === 'inactive' ||
    data?.status === 'disabled' ||
    data?.status === 'off' ||
    data?.status === 'archived';
  const isActive = !explicitInactive && (data?.isActive === true || data?.isActive === 'true');

  return {
    id,
    title: data?.title || id,
    shortTitle: data?.shortTitle || data?.title || id,
    range: data?.range || '',
    sheetTab: data?.sheetTab || 'Tổng hợp thi đua',
    time: data?.time || 'Đang cập nhật',
    isActive,
    isArchived,
    isCustom: data?.isCustom === true || !DEFAULT_COMPETITION_PROGRAMS.some((p) => p.id === id),
    intro: data?.intro || '',
    conditions: Array.isArray(data?.conditions) ? data.conditions : [],
    tiers: Array.isArray(data?.tiers) ? data.tiers : [],
    details: Array.isArray(data?.details) ? data.details : [],
    columns: Array.isArray(data?.columns) ? data.columns : undefined,
    updatedBy: data?.updatedBy || '',
    updatedAt: data?.updatedAt || '',
    statusUpdatedBy: data?.statusUpdatedBy || data?.updatedBy || '',
    statusUpdatedAt: data?.statusUpdatedAt || data?.updatedAt || ''
  };
}

function sortProgramsList(list: CompetitionProgramConfig[]): CompetitionProgramConfig[] {
  return [...list].sort((a, b) => {
    const orderA = DEFAULT_ORDER_MAP.has(a.id) ? DEFAULT_ORDER_MAP.get(a.id)! : 999;
    const orderB = DEFAULT_ORDER_MAP.has(b.id) ? DEFAULT_ORDER_MAP.get(b.id)! : 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.updatedAt || '').localeCompare(b.updatedAt || '');
  });
}

export function getCachedCompetitionPrograms(): CompetitionProgramConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached =
      localStorage.getItem(CACHED_COMPETITION_PROGRAMS_KEY) ||
      localStorage.getItem('custom_competition_programs');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortProgramsList(parsed.map((item) => normalizeProgramDoc(item.id, item)));
      }
    }
  } catch (err) {
    console.warn('Cannot read cached_competition_programs:', err);
  }
  return [];
}

function saveCachedCompetitionPrograms(programs: CompetitionProgramConfig[]) {
  if (typeof window === 'undefined' || !Array.isArray(programs) || programs.length === 0) return;
  try {
    localStorage.setItem(CACHED_COMPETITION_PROGRAMS_KEY, JSON.stringify(programs));
  } catch (err) {
    console.warn('Cannot persist cached_competition_programs:', err);
  }
}

// =====================================================================
// SINGLETON REAL-TIME STORE (Single Firestore listener + Cache protection)
// =====================================================================
let sharedPrograms: CompetitionProgramConfig[] = getCachedCompetitionPrograms();
const subscribers = new Set<(programs: CompetitionProgramConfig[]) => void>();
let activeFirestoreUnsub: (() => void) | null = null;
let onlineHandlerAttached = false;
let storageHandlerAttached = false;
let isSeedingInProgress = false;
let hasAttemptedServerSeed = false;

export function getLocalCompetitionProgramsSnapshot(): CompetitionProgramConfig[] {
  if (sharedPrograms.length > 0) return sharedPrograms;
  const cached = getCachedCompetitionPrograms();
  if (cached.length > 0) {
    sharedPrograms = cached;
    return sharedPrograms;
  }
  return [];
}

function notifyAllSubscribers(programs: CompetitionProgramConfig[], persistToCache: boolean = true) {
  const sorted = sortProgramsList(programs);
  sharedPrograms = sorted;
  if (persistToCache && sorted.length > 0) {
    saveCachedCompetitionPrograms(sorted);
  }
  subscribers.forEach((cb) => {
    try {
      cb(sorted);
    } catch (err) {
      console.warn('Competition subscriber callback error:', err);
    }
  });
}

function reconcileWithCacheIfFromCache(
  incomingList: CompetitionProgramConfig[],
  isFromCache: boolean
): CompetitionProgramConfig[] {
  if (!isFromCache) {
    return sortProgramsList(incomingList);
  }
  const cachedList = sharedPrograms.length > 0 ? sharedPrograms : getCachedCompetitionPrograms();
  if (cachedList.length === 0) {
    return sortProgramsList(incomingList);
  }
  const cachedMap = new Map(cachedList.map((p) => [p.id, p]));
  const reconciled = incomingList.map((inc) => {
    const cached = cachedMap.get(inc.id);
    if (!cached) return inc;
    const incStatusTime = new Date(inc.statusUpdatedAt || inc.updatedAt || 0).getTime() || 0;
    const cachedStatusTime = new Date(cached.statusUpdatedAt || cached.updatedAt || 0).getTime() || 0;
    if (cachedStatusTime > incStatusTime) {
      return {
        ...inc,
        isActive: cached.isActive === true && cached.isArchived !== true,
        isArchived: cached.isArchived === true,
        statusUpdatedAt: cached.statusUpdatedAt,
        statusUpdatedBy: cached.statusUpdatedBy
      };
    }
    return inc;
  });
  return sortProgramsList(reconciled);
}

// Helper: Seed initial default programs ONLY when server explicitly confirms collection & meta are empty
export async function seedDefaultProgramsIfEmpty() {
  if (isSeedingInProgress || hasAttemptedServerSeed) return;
  isSeedingInProgress = true;
  try {
    // 1. Check sentinel doc on server to ensure we never re-seed an already initialized workspace
    const metaRef = doc(db, 'app_settings', 'competition_programs_meta');
    const metaSnap = await getDocFromServer(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized === true) {
      hasAttemptedServerSeed = true;
      return;
    }

    // 2. Verify collection is truly empty on the authoritative server (never rely on offline cache)
    const serverSnap = await getDocsFromServer(collection(db, 'competition_programs'));
    hasAttemptedServerSeed = true;

    if (serverSnap.empty) {
      console.log('Server competition_programs empty. Seeding defaults once...');
      const now = new Date().toISOString();
      for (const prog of DEFAULT_COMPETITION_PROGRAMS) {
        await setDoc(doc(db, 'competition_programs', prog.id), {
          ...prog,
          isActive: prog.isActive === true,
          isArchived: false,
          updatedBy: 'Hệ Thống',
          updatedAt: now,
          statusUpdatedBy: 'Hệ Thống',
          statusUpdatedAt: now
        });
      }
      await setDoc(
        metaRef,
        {
          initialized: true,
          initializedAt: now,
          initializedBy: 'Hệ Thống'
        },
        { merge: true }
      );
    } else {
      // Collection already has documents on server -> mark initialized so future checks never seed
      await setDoc(
        metaRef,
        {
          initialized: true,
          initializedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch (err) {
    // Network/offline/permission issue: NEVER write defaults when server reachability cannot be verified
    console.warn('Bỏ qua kiểm tra seed mặc định do chưa kết nối được máy chủ Firestore:', err);
  } finally {
    isSeedingInProgress = false;
  }
}

// Fetch authoritative competition programs directly from Firestore server (bypassing stale cache)
export async function syncCompetitionProgramsFromServer(): Promise<CompetitionProgramConfig[] | null> {
  try {
    const serverSnap = await getDocsFromServer(collection(db, 'competition_programs'));
    if (!serverSnap.empty) {
      const list: CompetitionProgramConfig[] = [];
      serverSnap.forEach((d) => {
        list.push(normalizeProgramDoc(d.id, d.data()));
      });
      notifyAllSubscribers(list, true);
      return sharedPrograms;
    }
    return null;
  } catch (err) {
    console.warn('Không thể đồng bộ trực tiếp từ server competition_programs:', err);
    return null;
  }
}

const handleOnlineSync = () => {
  syncCompetitionProgramsFromServer();
};

const handleStorageSync = (e: StorageEvent) => {
  if (e.key === CACHED_COMPETITION_PROGRAMS_KEY && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = sortProgramsList(parsed.map((item) => normalizeProgramDoc(item.id, item)));
        sharedPrograms = normalized;
        subscribers.forEach((cb) => {
          try {
            cb(normalized);
          } catch {}
        });
      }
    } catch {}
  }
};

function ensureSharedFirestoreListener() {
  if (activeFirestoreUnsub) return;
  const path = 'competition_programs';

  if (typeof window !== 'undefined') {
    if (!onlineHandlerAttached) {
      window.addEventListener('online', handleOnlineSync);
      onlineHandlerAttached = true;
    }
    if (!storageHandlerAttached) {
      window.addEventListener('storage', handleStorageSync);
      storageHandlerAttached = true;
    }
  }

  activeFirestoreUnsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (!snapshot.empty) {
        const list: CompetitionProgramConfig[] = [];
        snapshot.forEach((d) => {
          list.push(normalizeProgramDoc(d.id, d.data()));
        });
        const reconciled = reconcileWithCacheIfFromCache(list, snapshot.metadata.fromCache);
        notifyAllSubscribers(reconciled, !snapshot.metadata.fromCache || sharedPrograms.length === 0);
      } else {
        // IMPORTANT: On empty snapshot (transient offline cache miss or freshly wiped DB):
        // 1. NEVER overwrite localStorage or emit DEFAULT_COMPETITION_PROGRAMS if local cache exists.
        const existingCache = sharedPrograms.length > 0 ? sharedPrograms : getCachedCompetitionPrograms();
        if (existingCache.length > 0) {
          sharedPrograms = existingCache;
          subscribers.forEach((cb) => {
            try {
              cb(existingCache);
            } catch {}
          });
        }
        // 2. Only check/seed via authoritative getDocsFromServer (which safely aborts if offline)
        if (!snapshot.metadata.fromCache) {
          seedDefaultProgramsIfEmpty();
        } else {
          // Verify with server when possible rather than trusting empty local snapshot
          syncCompetitionProgramsFromServer().then((serverRes) => {
            if (!serverRes) {
              seedDefaultProgramsIfEmpty();
            }
          });
        }
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      // CRITICAL FIX: On Firestore error / offline / quota limit:
      // NEVER emit DEFAULT_COMPETITION_PROGRAMS and NEVER overwrite localStorage!
      // Preserve existing state or cached snapshot safely.
      const existingCache = sharedPrograms.length > 0 ? sharedPrograms : getCachedCompetitionPrograms();
      if (existingCache.length > 0) {
        subscribers.forEach((cb) => {
          try {
            cb(existingCache);
          } catch {}
        });
      }
    }
  );
}

// Subscribe to shared real-time competition programs store
export function subscribeCompetitionPrograms(callback: (programs: CompetitionProgramConfig[]) => void) {
  subscribers.add(callback);

  const initial = getLocalCompetitionProgramsSnapshot();
  if (initial.length > 0) {
    callback(initial);
  }

  ensureSharedFirestoreListener();

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && activeFirestoreUnsub) {
      activeFirestoreUnsub();
      activeFirestoreUnsub = null;
      if (typeof window !== 'undefined') {
        if (onlineHandlerAttached) {
          window.removeEventListener('online', handleOnlineSync);
          onlineHandlerAttached = false;
        }
        if (storageHandlerAttached) {
          window.removeEventListener('storage', handleStorageSync);
          storageHandlerAttached = false;
        }
      }
    }
  };
}

// Log an audit trail entry
export async function logCompetitionAudit(entry: Omit<CompetitionProgramLog, 'id' | 'timestamp'>) {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    await setDoc(doc(db, 'competition_program_logs', logId), {
      id: logId,
      ...entry,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Failed to record competition audit log:', err);
  }
}

// Save or Update a competition program config (handles both legacy and dynamic programs)
export async function saveCompetitionProgram(
  program: CompetitionProgramConfig,
  performerName: string,
  changeSummary?: string,
  isNew: boolean = false
) {
  const path = `competition_programs/${program.id}`;
  const now = new Date().toISOString();
  const isArchived = program.isArchived === true;
  const isActive = isArchived ? false : program.isActive === true;

  const payload: CompetitionProgramConfig = {
    ...program,
    isActive,
    isArchived,
    updatedBy: performerName,
    updatedAt: now,
    statusUpdatedBy: performerName,
    statusUpdatedAt: now
  };

  // Optimistic update across shared store + localStorage
  const currentList = getLocalCompetitionProgramsSnapshot();
  const exists = currentList.some((p) => p.id === payload.id);
  const optimisticNext = exists
    ? currentList.map((p) => (p.id === payload.id ? payload : p))
    : [...currentList, payload];
  notifyAllSubscribers(optimisticNext, true);

  try {
    await setDoc(doc(db, 'competition_programs', program.id), payload, { merge: true });

    await logCompetitionAudit({
      programId: program.id,
      programTitle: program.title,
      action: isNew ? 'create' : 'update',
      performedBy: performerName,
      details: changeSummary || `${isNew ? 'Tạo mới' : 'Cập nhật'} cấu hình chương trình: ${program.title} (${program.time})`
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Delete a dynamic competition program
export async function deleteCompetitionProgram(
  programId: string,
  programTitle: string,
  performerName: string
) {
  const path = `competition_programs/${programId}`;
  try {
    await deleteDoc(doc(db, 'competition_programs', programId));

    const currentList = getLocalCompetitionProgramsSnapshot();
    const nextList = currentList.filter((p) => p.id !== programId);
    if (nextList.length > 0) {
      notifyAllSubscribers(nextList, true);
    }

    await logCompetitionAudit({
      programId,
      programTitle,
      action: 'delete',
      performedBy: performerName,
      details: `Xóa chương trình thi đua động: ${programTitle}`
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Toggle program active state
export async function toggleCompetitionProgramActive(
  programId: string,
  programTitle: string,
  newActiveState: boolean,
  performerName: string
) {
  const path = `competition_programs/${programId}`;
  const now = new Date().toISOString();
  const nextActive = Boolean(newActiveState);
  const patch: Record<string, any> = {
    isActive: nextActive,
    ...(nextActive ? { isArchived: false } : {}),
    updatedBy: performerName,
    updatedAt: now,
    statusUpdatedBy: performerName,
    statusUpdatedAt: now
  };

  // Immediate local propagation to all modules & localStorage
  const currentList = getLocalCompetitionProgramsSnapshot();
  if (currentList.length > 0) {
    const optimisticNext = currentList.map((p) =>
      p.id === programId
        ? {
            ...p,
            isActive: nextActive,
            isArchived: nextActive ? false : p.isArchived === true,
            updatedBy: performerName,
            updatedAt: now,
            statusUpdatedBy: performerName,
            statusUpdatedAt: now
          }
        : p
    );
    notifyAllSubscribers(optimisticNext, true);
  }

  try {
    const docRef = doc(db, 'competition_programs', programId);
    try {
      await updateDoc(docRef, patch);
    } catch (updateErr: any) {
      // If document doesn't exist yet on Firestore (e.g. legacy default), create it with base metadata
      const baseProg =
        DEFAULT_COMPETITION_PROGRAMS.find((d) => d.id === programId) ||
        currentList.find((c) => c.id === programId);
      await setDoc(
        docRef,
        {
          ...(baseProg || { id: programId, title: programTitle, shortTitle: programTitle, time: 'Đang cập nhật', conditions: [], tiers: [] }),
          ...patch
        },
        { merge: true }
      );
    }

    await logCompetitionAudit({
      programId,
      programTitle,
      action: 'toggle_status',
      performedBy: performerName,
      details: `${nextActive ? 'Kích hoạt' : 'Tạm dừng áp dụng'} chương trình thi đua: ${programTitle}`
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Archive or unarchive a competition program permanently (prevents accidental re-activation)
export async function archiveCompetitionProgram(
  programId: string,
  programTitle: string,
  shouldArchive: boolean,
  performerName: string
) {
  const path = `competition_programs/${programId}`;
  const now = new Date().toISOString();
  const patch = {
    isArchived: Boolean(shouldArchive),
    isActive: false, // Always force OFF when archiving or unarchiving until supervisor explicitly turns ON
    updatedBy: performerName,
    updatedAt: now,
    statusUpdatedBy: performerName,
    statusUpdatedAt: now
  };

  const currentList = getLocalCompetitionProgramsSnapshot();
  if (currentList.length > 0) {
    const optimisticNext = currentList.map((p) =>
      p.id === programId ? { ...p, ...patch } : p
    );
    notifyAllSubscribers(optimisticNext, true);
  }

  try {
    const docRef = doc(db, 'competition_programs', programId);
    try {
      await updateDoc(docRef, patch);
    } catch {
      const baseProg =
        DEFAULT_COMPETITION_PROGRAMS.find((d) => d.id === programId) ||
        currentList.find((c) => c.id === programId);
      await setDoc(
        docRef,
        {
          ...(baseProg || { id: programId, title: programTitle, shortTitle: programTitle, time: 'Đang cập nhật', conditions: [], tiers: [] }),
          ...patch
        },
        { merge: true }
      );
    }

    await logCompetitionAudit({
      programId,
      programTitle,
      action: shouldArchive ? 'archive' : 'unarchive',
      performedBy: performerName,
      details: shouldArchive
        ? `Ngừng & Lưu trữ vĩnh viễn chương trình: ${programTitle}`
        : `Khôi phục chương trình khỏi kho lưu trữ (ở trạng thái Tắt): ${programTitle}`
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Reset scheme text/tiers to initial defaults while PRESERVING stopped/archived program statuses
export async function resetAllProgramsToDefaults(performerName: string) {
  try {
    const now = new Date().toISOString();
    // Read latest statuses from server if possible, else local snapshot
    const currentSnapshot =
      (await syncCompetitionProgramsFromServer()) || getLocalCompetitionProgramsSnapshot();
    const existingMap = new Map(currentSnapshot.map((p) => [p.id, p]));

    const updatedDefaults: CompetitionProgramConfig[] = [];
    for (const prog of DEFAULT_COMPETITION_PROGRAMS) {
      const existing = existingMap.get(prog.id);
      const preservedArchived = existing ? existing.isArchived === true : false;
      // Preserve explicit disabled/archived state so stopped programs NEVER auto-enable on reset
      const preservedActive = existing
        ? (preservedArchived ? false : existing.isActive === true)
        : prog.isActive === true;

      const mergedDoc: CompetitionProgramConfig = {
        ...prog,
        isActive: preservedActive,
        isArchived: preservedArchived,
        updatedBy: performerName,
        updatedAt: now,
        statusUpdatedBy: existing?.statusUpdatedBy || performerName,
        statusUpdatedAt: existing?.statusUpdatedAt || now
      };
      updatedDefaults.push(mergedDoc);
      await setDoc(doc(db, 'competition_programs', prog.id), mergedDoc, { merge: true });
    }

    // Preserve any custom programs beyond defaults
    const extraCustom = currentSnapshot.filter(
      (p) => !DEFAULT_COMPETITION_PROGRAMS.some((d) => d.id === p.id)
    );
    notifyAllSubscribers([...updatedDefaults, ...extraCustom], true);

    await logCompetitionAudit({
      programId: 'all',
      programTitle: 'Tất cả chương trình',
      action: 'reset_defaults',
      performedBy: performerName,
      details: 'Khôi phục nội dung cơ cấu thi đua về mặc định (giữ nguyên trạng thái Tắt / Lưu trữ hiện có)'
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'competition_programs/all');
  }
}

// Subscribe to audit logs for supervisors
export function subscribeCompetitionLogs(callback: (logs: CompetitionProgramLog[]) => void, maxCount = 50) {
  const path = 'competition_program_logs';
  return onSnapshot(collection(db, path), (snapshot) => {
    if (!snapshot.empty) {
      const logs: CompetitionProgramLog[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as CompetitionProgramLog;
        logs.push({
          id: d.id,
          programId: data.programId || '',
          programTitle: data.programTitle || '',
          action: data.action || 'update',
          performedBy: data.performedBy || 'Giám sát',
          timestamp: data.timestamp || new Date().toISOString(),
          details: data.details || ''
        });
      });
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(logs.slice(0, maxCount));
    } else {
      callback([]);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, path);
    callback([]);
  });
}
