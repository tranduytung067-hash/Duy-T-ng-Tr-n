import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail, Key, Eye, EyeOff, AlertTriangle, RefreshCw, ArrowRight, ClipboardCheck, Smartphone, X, CheckCircle } from 'lucide-react';
import { extractSheetId, loadGoogleSheetData } from '../utils/sheetParser';
import { useDialogFocus } from '../utils/useDialogFocus';
import { UserPermission } from '../types';
import { mockPermissions } from '../mockData';
import { db, collection, getDocs, saveUserPermissionToFirestore } from '../firebase';

interface LoginScreenProps {
  onLoginSuccess: (
    user: UserPermission,
    sheetUrl: string,
    sheetId: string | null,
    fetchedData?: any,
    remember?: boolean
  ) => void;
  initialSheetUrl: string;
}

export default function LoginScreen({ onLoginSuccess, initialSheetUrl }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1E6-xeUlgBLqnir-hw6UgjPyBHgRr6R2sarAxaQ_vF8c/edit?gid=1104777360#gid=1104777360');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBgLoaded, setIsBgLoaded] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const installModalRef = useRef<HTMLDivElement>(null);
  useDialogFocus(showInstallModal, installModalRef, () => setShowInstallModal(false));
  const [installTab, setInstallTab] = useState<'android' | 'ios'>('android');
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = '/assets/login_bg.png';
    img.onload = () => setIsBgLoaded(true);
    img.onerror = () => setIsBgLoaded(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Tài khoản (Email) và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const targetEmail = email.trim().toLowerCase();
    const targetPassword = password.trim();

    try {
      const savedPerms = localStorage.getItem('gs_permissions');
      let localPerms: UserPermission[] = savedPerms ? JSON.parse(savedPerms) : [...mockPermissions];
      let finalPermissions: UserPermission[] = [...localPerms];
      let fetchedData: any = null;
      let resolvedId: string | null = null;

      // If a custom sheet URL is provided, try connecting and parsing it first to get live credentials!
      if (sheetUrl.trim()) {
        const sheetId = extractSheetId(sheetUrl);
        if (!sheetId) {
          throw new Error('Link Google Sheets không hợp lệ. Vui lòng kiểm tra lại URL.');
        }
        resolvedId = sheetId;
        
        // Dynamically parse custom sheet to get Phân Quyền + datasets
        const data = await loadGoogleSheetData(sheetId);
        
        if (data.permissions && data.permissions.length > 0) {
          // Merge sheet permissions with local permissions (preserving locked state & password/role modifications)
          const merged = data.permissions.map((sheetPerm: UserPermission) => {
            const localPerm = localPerms.find(p => p.email.toLowerCase().trim() === sheetPerm.email.toLowerCase().trim());
            if (localPerm) {
              return {
                ...sheetPerm,
                locked: localPerm.locked || false,
                password: localPerm.password !== undefined ? localPerm.password : sheetPerm.password,
                role: localPerm.role !== undefined ? localPerm.role : sheetPerm.role,
                vtbhCode: localPerm.vtbhCode !== undefined ? localPerm.vtbhCode : sheetPerm.vtbhCode,
                channel: localPerm.channel !== undefined ? localPerm.channel : sheetPerm.channel,
                hoVaTen: localPerm.hoVaTen !== undefined ? localPerm.hoVaTen : sheetPerm.hoVaTen,
                mappedEmployee: localPerm.mappedEmployee !== undefined ? localPerm.mappedEmployee : sheetPerm.mappedEmployee
              };
            }
            return sheetPerm;
          });

          // Add locally created custom accounts that are not present in the spreadsheet
          localPerms.forEach(localPerm => {
            const exists = data.permissions.some((p: UserPermission) => p.email.toLowerCase().trim() === localPerm.email.toLowerCase().trim());
            if (!exists) {
              merged.push(localPerm);
            }
          });

          finalPermissions = merged;
          data.permissions = merged; // Update fetchedData's permissions for flow consistency
        } else {
          // Fall back to localPerms but keep a warning or notice
          console.warn('Tab "Phân Quyền" không hoạt động hoặc không có bản ghi nào. Sử dụng danh sách tài khoản mẫu làm dự phòng.');
        }
        fetchedData = data;
      }

      // Fetch latest synchronized user permissions from Firestore (cloud database) so login is uniform across all devices
      try {
        const querySnapshot = await getDocs(collection(db, 'user_permissions'));
        if (!querySnapshot.empty) {
          const firestoreList: UserPermission[] = [];
          const EXCLUDED_EMAILS = [
            'om@fmcg.com',
            'saleman.an@fmcg.com',
            'saleman.binh@fmcg.com',
            'saleman.cuong@fmcg.com',
            'saleman.long@fmcg.com',
            'saleman.nhung@fmcg.com',
            'sup@fmcg.com'
          ];
          querySnapshot.forEach((docSnap) => {
            const fbData = docSnap.data();
            const docEmail = (fbData.email || docSnap.id).toLowerCase().trim();
            if (EXCLUDED_EMAILS.includes(docEmail)) {
              return;
            }
            firestoreList.push({
              email: fbData.email || docSnap.id,
              password: fbData.password || '',
              role: fbData.role || 'Nhân viên',
              mappedEmployee: fbData.mappedEmployee || undefined,
              hoVaTen: fbData.hoVaTen || undefined,
              vtbhCode: fbData.vtbhCode || undefined,
              channel: fbData.channel || undefined,
              locked: fbData.locked === true || (fbData as any).locked === 'true',
              avatarUrl: fbData.avatarUrl || undefined,
              soLuotTruyCap: Number(fbData.soLuotTruyCap) || 0,
              deleted: fbData.deleted === true || fbData.deleted === 'true' || (fbData as any).deleted === 'TRUE'
            });
          });

          // Merge Firestore permissions of any match, prioritizing Firestore's cloud-synced changes
          firestoreList.forEach((fsPerm) => {
            const matchIndex = finalPermissions.findIndex(p => p.email.toLowerCase().trim() === fsPerm.email.toLowerCase().trim());
            if (fsPerm.deleted) {
              // If account is deleted in Firestore, remove it from standard permissions
              if (matchIndex > -1) {
                finalPermissions.splice(matchIndex, 1);
              }
            } else {
              if (matchIndex > -1) {
                finalPermissions[matchIndex] = {
                  ...finalPermissions[matchIndex],
                  ...fsPerm
                };
              } else {
                finalPermissions.push(fsPerm);
              }
            }
          });
          
          // Also filter out any EXCLUDED_EMAILS from finalPermissions
          finalPermissions = finalPermissions.filter(p => !EXCLUDED_EMAILS.includes(p.email.toLowerCase().trim()));
          
          if (fetchedData) {
            fetchedData.permissions = finalPermissions;
          }
        }
      } catch (fError) {
        console.error('Failed to sync user permissions from Firestore during login:', fError);
      }

      // Ensure the developer account is ALWAYS present in the workspace permissions pool
      const hasDeveloper = finalPermissions.some((p) => {
        const e = p.email.toLowerCase().trim();
        return e.startsWith('tungluu1992ab@gmail');
      });
      if (!hasDeveloper) {
        finalPermissions.push({
          email: 'tungluu1992ab@gmail.com',
          role: 'Admin',
          password: 'khongcogi',
          mappedEmployee: ''
        });
      }

      // Ensure lamhv.hoabinh@gmail.com account is ALWAYS present and can log in with 123123123 as fallback
      const hasLamHV = finalPermissions.some((p) => {
        const e = p.email.toLowerCase().trim();
        return e === 'lamhv.hoabinh@gmail.com';
      });
      if (!hasLamHV) {
        finalPermissions.push({
          email: 'lamhv.hoabinh@gmail.com',
          role: 'OM',
          password: '123123123',
          mappedEmployee: ''
        });
      } else {
        const lamIdx = finalPermissions.findIndex(p => p.email.toLowerCase().trim() === 'lamhv.hoabinh@gmail.com');
        if (lamIdx !== -1) {
          finalPermissions[lamIdx].role = 'OM';
          // Only use '123123123' as fallback if current password is empty or not yet defined
          if (!finalPermissions[lamIdx].password) {
            finalPermissions[lamIdx].password = '123123123';
          }
        }
      }

      // Find user matching targetEmail with support for emails, usernames, parts, or full Vietnamese names
      const sanitize = (str: string) => {
        return str
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // strip diacritics / accents
          .replace(/đ/g, 'd')
          .replace(/\s+/g, '');
      };

      const foundUser = finalPermissions.find((p) => {
        const e = p.email.toLowerCase().trim();
        const mapEmp = p.mappedEmployee ? p.mappedEmployee.trim() : '';
        const mapEmpLower = mapEmp.toLowerCase();
        
        // Target is directly the email
        if (e === targetEmail) return true;
        
        // Target is email prefix (e.g. "huong.le" matches "huong.le@fmcg.com")
        const ePrefix = e.split('@')[0];
        if (ePrefix === targetEmail) return true;

        // Target matches mapped name with accents or without accents
        if (mapEmp && (mapEmpLower === targetEmail || sanitize(mapEmpLower) === sanitize(targetEmail))) {
          return true;
        }

        // Target with flexible domain suffix handling
        const eNoCom = e.endsWith('.com') ? e.slice(0, -4) : e;
        const targetNoCom = targetEmail.endsWith('.com') ? targetEmail.slice(0, -4) : targetEmail;
        if (eNoCom === targetNoCom) return true;

        return false;
      });

      if (!foundUser) {
        throw new Error('Tài khoản này không tồn tại trong hệ thống phân quyền của chúng tôi.');
      }

      const isLocked = !!foundUser.locked || 
                       (foundUser as any).locked === 'true' || 
                       (foundUser as any).locked === 'TRUE' || 
                       (typeof (foundUser as any).locked === 'string' && String((foundUser as any).locked).toLowerCase().trim() === 'true');

      if (isLocked) {
        throw new Error('Tài khoản này đã bị khóa. Vui lòng liên hệ Giám Sát Thị Trường để mở khóa.');
      }

      // If it is the admin account, guarantee role is Admin and accept "khongcogi"
      if (foundUser.email.toLowerCase().trim().startsWith('tungluu1992ab@gmail')) {
        foundUser.role = 'Admin';
        if (targetPassword === 'khongcogi') {
          foundUser.password = 'khongcogi';
        }
      }

      // Validate password
      const userPassword = foundUser.password ? String(foundUser.password).trim() : '123123';
      if (userPassword !== targetPassword) {
        throw new Error('Mật khẩu đăng nhập không chính xác. Vui lòng kiểm tra lại.');
      }

      // Increment access count & save to Firestore
      const currentAccess = Number(foundUser.soLuotTruyCap) || 0;
      foundUser.soLuotTruyCap = currentAccess + 1;
      await saveUserPermissionToFirestore(foundUser);

      // Successful Authentication!
      onLoginSuccess(foundUser, sheetUrl.trim(), resolvedId, fetchedData, rememberMe);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi bất ngờ xảy ra khi xác thực tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-[#0d9488] selection:text-white"
      style={{
        backgroundImage: isBgLoaded ? "url('/assets/login_bg.png')" : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Main Centered Container */}
      <div className="w-full max-w-md mx-auto relative z-10 py-6 flex flex-col justify-center items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full bg-white border border-slate-200 rounded-3xl shadow-xl p-6 md:p-8 relative"
        >
          {/* Brand emblem */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-200">
              <ClipboardCheck className="w-7 h-7 text-emerald-600" />
            </div>
          </div>

          {/* Card Header & Brand Branding */}
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-[#15803d] tracking-wide uppercase leading-tight">
              WILMAR MARKETING CLV
            </h1>
            
            <div className="h-[2px] w-16 bg-emerald-600/20 mx-auto my-3" />
            
            <div className="mt-2 bg-emerald-50 border border-emerald-200/80 px-3 py-2 rounded-xl">
              <p className="text-[#15803d] text-[10.5px] sm:text-[11px] font-extrabold tracking-wider leading-relaxed uppercase">
                KỶ LUẬT - TRÁCH NHIỆM - NHIỆT HUYẾT - HỢP TÁC
              </p>
            </div>
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              role="alert"
              className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-700">Đăng nhập thất bại:</span>
                <p className="text-slate-700 mt-1 leading-relaxed">{errorMsg}</p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleLogin} aria-busy={isLoading} className="space-y-4">
            {/* Email input */}
            <div>
              <label htmlFor="login-email" className="block text-[11px] font-bold text-slate-600 tracking-wider uppercase mb-1.5">
                TÀI KHOẢN (EMAIL)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4 text-[#0f766e]" />
                </span>
                <input
                  id="login-email" name="email" autoComplete="username" autoCapitalize="none"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="tennhanvien@fmcg.com"
                  className="app-control py-2.5 pl-10 pr-4 text-xs font-semibold rounded-xl"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-600 tracking-wider uppercase">
                  MẬT KHẨU
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                  <Key className="w-4 h-4 text-[#0f766e]" />
                </span>
                <input
                  id="login-password" name="password" autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="••••••••"
                  className="app-control py-2.5 pl-10 pr-10 text-xs font-semibold rounded-xl"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox option */}
            <div className="flex items-center justify-between mt-1 pt-1">
              <label 
                id="lbl-remember-me"
                className="flex items-center gap-2 cursor-pointer select-none group"
              >
                <input
                  type="checkbox"
                  id="chk-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-700 transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>
            </div>

            {/* Submit Action Button trigger */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-[#0f766e] hover:bg-[#0d5c56] text-white font-extrabold tracking-widest py-3 px-6 rounded-xl text-xs sm:text-sm uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  ĐANG XÁC THỰC...
                </>
              ) : (
                <>
                  ĐĂNG NHẬP
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* APK / PWA Mobile Installer Button */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-[#0f766e] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-emerald-200"
              >
                <Smartphone className="w-4 h-4 text-emerald-600" />
                HƯỚNG DẪN CÀI ĐẶT
              </button>
            </div>

            <div className="pt-2.5 text-center select-none">
              <p className="text-slate-500 text-[10px] tracking-wide leading-normal">
                Designed by Tran Duy Tung - MKT Sup - 0964 871 692
              </p>
            </div>
          </form>
        </motion.div>

        {/* Mobile App Installation APK / PWA Modal */}
        {showInstallModal && (
          <div
            className="app-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs animate-[fadeIn_0.18s_ease-out]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowInstallModal(false);
            }}
          >
            <div
              ref={installModalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Hướng dẫn cài đặt ứng dụng Wilmar CLV"
              tabIndex={-1}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] outline-none"
            >
              {/* Modal Header */}
              <div className="bg-[#0f766e] px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-emerald-200" />
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">Cài đặt Ứng dụng Wilmar CLV</h2>
                    <p className="text-[11px] text-emerald-100 font-medium">Hướng dẫn cài đặt trên Điện thoại di động</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Đóng hướng dẫn cài đặt"
                  onClick={() => setShowInstallModal(false)}
                  className="p-1.5 rounded-lg bg-emerald-800 text-emerald-100 hover:text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs leading-relaxed">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                  <h3 className="font-bold text-[#0f766e] text-sm flex items-center gap-1.5 mb-2">
                    <Smartphone className="w-4 h-4 text-[#0f766e]" />
                    Cài đặt dạng Web App (iOS / Android)
                  </h3>

                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl mb-4">
                    <button
                      type="button"
                      onClick={() => setInstallTab('android')}
                      className={`py-1.5 px-3 text-center text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                        installTab === 'android'
                          ? 'bg-white text-[#0f766e] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dành cho Android (Chrome)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallTab('ios')}
                      className={`py-1.5 px-3 text-center text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                        installTab === 'ios'
                          ? 'bg-white text-[#0f766e] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dành cho iPhone (Safari)
                    </button>
                  </div>

                  {installTab === 'android' ? (
                    <div className="space-y-2 text-[11px] font-medium text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200">
                      <p className="font-bold text-emerald-700">Cài đặt trong 4 bước:</p>
                      <ul className="list-disc list-inside space-y-1.5">
                        <li>Mở trình duyệt <span className="font-bold">Google Chrome</span> trên điện thoại.</li>
                        <li>Bấm vào biểu tượng <span className="font-bold text-[#0f766e]">3 chấm (Menu)</span> góc trên cùng bên phải.</li>
                        <li>Chọn <span className="font-bold text-emerald-700">&quot;Cài đặt ứng dụng&quot;</span> hoặc <span className="font-bold">&quot;Thêm vào Màn hình chính&quot;</span>.</li>
                        <li>Nhấn <span className="font-bold">Xác nhận</span> để tạo biểu tượng ngoài màn hình chính.</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[11px] font-medium text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200">
                      <p className="font-bold text-emerald-700">Cài đặt trên iPhone / iPad:</p>
                      <ul className="list-disc list-inside space-y-1.5">
                        <li>Mở trình duyệt <span className="font-bold">Safari</span> mặc định trên iPhone.</li>
                        <li>Ấn vào biểu tượng <span className="font-bold text-indigo-700">Chia sẻ (Share)</span> ở thanh dưới cùng.</li>
                        <li>Kéo xuống và chọn <span className="font-bold text-emerald-700">&quot;Thêm vào MH chính&quot;</span> (Add to Home Screen).</li>
                        <li>Nhấn <span className="font-bold">&quot;Thêm&quot; (Add)</span> ở góc trên phải để hoàn tất.</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-800 block">Hiển thị toàn màn hình</span>
                    <p className="text-slate-600 mt-0.5">
                      Ứng dụng tự động ẩn thanh địa chỉ trình duyệt, hỗ trợ thao tác kéo cuộn, xuất Excel và chia sẻ ảnh báo cáo thuận tiện.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end">
                <button
                  type="button"
                  aria-label="Đóng hướng dẫn cài đặt"
                  onClick={() => setShowInstallModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Đóng Hướng Dẫn
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
