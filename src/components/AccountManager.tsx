import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit, 
  Eye, 
  EyeOff, 
  Shield, 
  Mail, 
  Lock, 
  Unlock, 
  UserCheck, 
  X, 
  Check, 
  AlertCircle,
  Copy,
  Phone,
  MessageSquare
} from 'lucide-react';
import { UserPermission, EmployeeTargetRow } from '../types';
import { saveUserPermissionToFirestore, deleteUserPermissionFromFirestore } from '../firebase';
import { notify } from '../utils/notify';

interface AccountManagerProps {
  permissions: UserPermission[];
  setPermissions: React.Dispatch<React.SetStateAction<UserPermission[]>>;
  employees: EmployeeTargetRow[];
  currentUserEmail?: string;
}

export default function AccountManager({ 
  permissions, 
  setPermissions, 
  employees,
  currentUserEmail
}: AccountManagerProps) {
  // Account List & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => {
      setCopiedEmail(null);
    }, 1500);
  };

  // Form states (Thêm & Cập nhật)
  const [isAdding, setIsAdding] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  // Form fields state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('Nhân viên');
  const [formHoVaTen, setFormHoVaTen] = useState('');
  const [formVtbhCode, setFormVtbhCode] = useState('');
  const [formChannel, setFormChannel] = useState('');
  const [formMappedEmployee, setFormMappedEmployee] = useState('');
  const [formZaloPhone, setFormZaloPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);

  // Password visibility utility toggle
  const toggleVisibility = (email: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  // Open Add panel
  const handleOpenAdd = () => {
    setFormEmail('');
    setFormPassword('');
    setFormRole('Nhân viên');
    setFormHoVaTen('');
    setFormVtbhCode('');
    setFormChannel('');
    setFormMappedEmployee('');
    setFormZaloPhone('');
    setFormError('');
    setEditingEmail(null);
    setIsAdding(true);
  };

  // Open Edit panel
  const handleOpenEdit = (account: UserPermission) => {
    setFormEmail(account.email);
    setFormPassword(account.password || '');
    setFormRole(account.role);
    setFormHoVaTen(account.hoVaTen || '');
    setFormVtbhCode(account.vtbhCode || '');
    setFormChannel(account.channel || '');
    setFormMappedEmployee(account.mappedEmployee || '');
    setFormZaloPhone(account.zaloPhone || account.phoneNumber || '');
    setFormError('');
    setIsAdding(false);
    setEditingEmail(account.email);
  };

  // Delete account action
  const handleDelete = (email: string) => {
    const updated = permissions.filter(p => p.email.toLowerCase().trim() !== email.toLowerCase().trim());
    setPermissions(updated);
    localStorage.setItem('gs_permissions', JSON.stringify(updated));
    deleteUserPermissionFromFirestore(email);
    setConfirmDeleteEmail(null);
    notify.success(`Đã xóa tài khoản ${email}`);
  };

  // Toggle Lock/Unlock account
  const handleToggleLock = (email: string) => {
    const updated = permissions.map(p => {
      if (p.email.toLowerCase().trim() === email.toLowerCase().trim()) {
        const u = {
          ...p,
          locked: !p.locked
        };
        saveUserPermissionToFirestore(u);
        return u;
      }
      return p;
    });
    setPermissions(updated);
    localStorage.setItem('gs_permissions', JSON.stringify(updated));
  };

  // Submit handler (Add or Save)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const emailTrimmed = formEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setFormError('Email đăng nhập không được trống.');
      return;
    }
    if (!formPassword.trim()) {
      setFormError('Mật khẩu không được trống.');
      return;
    }

    // Fully qualify email with @fmcg.com format if missing
    const finalEmail = emailTrimmed.includes('@') ? emailTrimmed : `${emailTrimmed}@fmcg.com`;

    let updatedList = [...permissions];

    if (editingEmail === null) {
      // Create new account mode
      const exists = permissions.some(p => p.email.toLowerCase().trim() === finalEmail);
      if (exists) {
        setFormError('Email tài khoản này đã tồn tại trong hệ thống.');
        return;
      }

      const newAccount: UserPermission = {
        email: finalEmail,
        password: formPassword.trim(),
        role: formRole,
        mappedEmployee: formMappedEmployee || undefined,
        hoVaTen: formHoVaTen.trim() || undefined,
        vtbhCode: formVtbhCode.trim().toUpperCase() || undefined,
        channel: formChannel.trim() || undefined,
        zaloPhone: formZaloPhone.trim() || undefined,
        phoneNumber: formZaloPhone.trim() || undefined,
        locked: false,
        soLuotTruyCap: 0
      };

      updatedList.push(newAccount);
      saveUserPermissionToFirestore(newAccount);
    } else {
      // Edit account mode
      let editedAccount: UserPermission | null = null;
      updatedList = permissions.map(p => {
        if (p.email.toLowerCase().trim() === editingEmail.toLowerCase().trim()) {
          editedAccount = {
            ...p,
            password: formPassword.trim(),
            role: formRole,
            mappedEmployee: formMappedEmployee || undefined,
            hoVaTen: formHoVaTen.trim() || undefined,
            vtbhCode: formVtbhCode.trim().toUpperCase() || undefined,
            channel: formChannel.trim() || undefined,
            zaloPhone: formZaloPhone.trim() || undefined,
            phoneNumber: formZaloPhone.trim() || undefined
          };
          return editedAccount;
        }
        return p;
      });
      if (editedAccount) {
        saveUserPermissionToFirestore(editedAccount);
      }
    }

    setPermissions(updatedList);
    localStorage.setItem('gs_permissions', JSON.stringify(updatedList));

    // Reset layout
    setIsAdding(false);
    setEditingEmail(null);
  };

  // Filter accounts based on query
  const filteredAccounts = permissions.filter(p => 
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.hoVaTen && p.hoVaTen.toLowerCase().includes(searchTerm.toLowerCase())) || 
    p.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-surface p-5 space-y-5 text-left">
      
      {/* Title block */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <h3 className="text-base font-extrabold uppercase tracking-wide flex items-center gap-2 text-slate-900">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Quản Lý Tài Khoản Nhân Viên</span>
          </h3>
          <p className="text-xs text-slate-600 font-medium">
            Điều chỉnh, cập nhật mật khẩu, thêm mới và phân cấp quyền Admin, Điều Hành (OM) hay Nhân viên bán hàng.
          </p>
        </div>
        
        <div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            THÊM TÀI KHOẢN MỚI
          </button>
        </div>
      </div>

      {/* Statistics overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <span className="text-[10.5px] text-slate-600 block uppercase font-bold tracking-wide">Tổng Tài Khoản</span>
          <span className="text-2xl font-mono font-extrabold text-slate-900 tabular-nums">{permissions.length}</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <span className="text-[10.5px] text-slate-600 block uppercase font-bold tracking-wide">Giám Sát Thị Trường</span>
          <span className="text-2xl font-mono font-extrabold text-indigo-700 tabular-nums">
            {permissions.filter(p => p.role === 'Admin').length}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <span className="text-[10.5px] text-slate-600 block uppercase font-bold tracking-wide">Điều hành (OM)</span>
          <span className="text-2xl font-mono font-extrabold text-amber-700 tabular-nums">
            {permissions.filter(p => p.role === 'OM').length}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <span className="text-[10.5px] text-slate-600 block uppercase font-bold tracking-wide">Nhân viên</span>
          <span className="text-2xl font-mono font-extrabold text-emerald-700 tabular-nums">
            {permissions.filter(p => p.role !== 'Admin' && p.role !== 'OM').length}
          </span>
        </div>
      </div>

      {/* Edit & Add inline panels */}
      {(isAdding || editingEmail !== null) && (
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-5 space-y-4 relative">
          <button
            type="button"
            onClick={() => { setIsAdding(false); setEditingEmail(null); }}
            aria-label="Đóng biểu mẫu"
            className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            {editingEmail !== null ? `Cập Nhật Tài Khoản: ${editingEmail}` : 'Thêm Mới Tài Khoản Hệ Thống'}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Email field */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                Email / Tên Đăng Nhập
              </label>
              <input
                type="text"
                disabled={editingEmail !== null}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="VD: lamhv.hoabinh hoặc abc@gmail.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            {/* Password field */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                Mật Khẩu
              </label>
              <input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mật khẩu tài khoản"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 font-mono"
              />
            </div>

            {/* Role selection */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Phân quyền truy cập
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 cursor-pointer font-bold"
              >
                <option value="Nhân viên">Nhân viên / Salesman</option>
                <option value="OM">Điều Hành (OM)</option>
                <option value="Admin">Giám Sát Thị Trường</option>
              </select>
            </div>

            {/* Full Name field */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide">
                Họ và Tên đầy đủ
              </label>
              <input
                type="text"
                value={formHoVaTen}
                onChange={(e) => setFormHoVaTen(e.target.value)}
                placeholder="Họ tên nhân viên"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>

            {/* VTBH Code */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide">
                {(formRole === 'Admin' || formRole === 'OM' || formRole === 'MKT Sup') ? 'Mã NV' : 'Mã VTBH'}
              </label>
              <input
                type="text"
                value={formVtbhCode}
                onChange={(e) => setFormVtbhCode(e.target.value)}
                placeholder={(formRole === 'Admin' || formRole === 'OM' || formRole === 'MKT Sup') ? "VD: NV0123" : "VD: VTBH340"}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 font-mono"
              />
            </div>

            {/* Sales Channel */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide">
                Kênh bán hàng
              </label>
              <input
                type="text"
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value)}
                placeholder="VD: GT, MT"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>

            {/* SĐT Zalo */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Số điện thoại Zalo
              </label>
              <input
                type="text"
                value={formZaloPhone}
                onChange={(e) => setFormZaloPhone(e.target.value)}
                placeholder="VD: 0912345678"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 font-mono"
              />
            </div>

            {/* Link Salesman */}
            <div className="space-y-1 md:col-span-3">
              <label className="text-[10px] text-slate-600 uppercase font-bold tracking-wide flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Salesman Liên Kết (Mặc định lọc kết quả)
              </label>
              <select
                value={formMappedEmployee}
                onChange={(e) => setFormMappedEmployee(e.target.value)}
                className="app-control text-xs cursor-pointer font-medium"
              >
                <option value="">Không liên kết (Tự lọc hoặc Admin)</option>
                {employees.map((emp) => (
                  <option key={emp.name} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>

            {formError && (
              <div className="md:col-span-3 flex items-center gap-2 text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="md:col-span-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingEmail(null); }}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {editingEmail === null ? 'Xác nhận tạo mới' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo email, họ tên, vai trò quản lý..."
            className="app-control py-2.5 px-4 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Account tabular list display (Desktop view) */}
      <div className="hidden md:block app-table-wrap">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-center font-bold tracking-wider uppercase border-b border-slate-200">
              <th className="py-3 px-4 text-center border-r border-slate-200">Tài khoản &amp; Email</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Họ và Tên</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Vai trò</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Mật khẩu</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Mã VTBH / Mã NV</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Kênh</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">SĐT Zalo</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Liên kết nhân viên</th>
              <th className="py-3 px-4 text-center border-r border-slate-200">Lượt Truy Cập</th>
              <th className="py-3 px-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((account) => {
                const isPasswordRevealed = !!revealedPasswords[account.email];
                const isCurrent = currentUserEmail && account.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
                const isConfirming = confirmDeleteEmail === account.email;
                return (
                  <tr key={account.email} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold uppercase text-[10px] shrink-0 ${
                          isCurrent ? 'text-emerald-700 border-emerald-400 bg-emerald-50' : 'text-slate-700 border-slate-200 bg-slate-50'
                        }`}>
                          {account.email.split('@')[0].substring(0, 2)}
                        </div>
                        <span className="truncate max-w-[120px] lg:max-w-[160px] flex items-center gap-1.5">
                          {isCurrent && (
                            <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500 shrink-0" title="Đang truy cập" />
                          )}
                          {account.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(account.email)}
                          className="p-1 rounded bg-white border border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center shrink-0"
                          title="Sao chép Email"
                          aria-label={`Sao chép ${account.email}`}
                        >
                          {copiedEmail === account.email ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        {account.locked && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded inline-flex items-center gap-0.5 leading-none shrink-0 uppercase">
                            <Lock className="w-2.5 h-2.5 shrink-0" /> Khóa
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium border-r border-slate-200 text-slate-800">
                      {account.hoVaTen || <span className="text-slate-400">—</span>}
                    </td>

                    <td className="py-3 px-4 text-center border-r border-slate-200">
                      {account.role === 'Admin' ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px] uppercase">
                          Giám Sát Thị Trường
                        </span>
                      ) : account.role === 'OM' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] uppercase">
                          Điều Hành (OM)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase">
                          Nhân Viên
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-center border-r border-slate-200">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-slate-800">
                          {isPasswordRevealed ? account.password : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(account.email)}
                          className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={isPasswordRevealed ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                          aria-label={isPasswordRevealed ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                        >
                          {isPasswordRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-center border-r border-slate-200">
                      {account.vtbhCode || <span className="text-slate-400">—</span>}
                    </td>

                    <td className="py-3 px-4 text-center border-r border-slate-200">
                      {account.channel || <span className="text-slate-400">—</span>}
                    </td>

                    <td className="py-3 px-4 font-mono text-center border-r border-slate-200">
                      {account.zaloPhone || account.phoneNumber ? (
                        <a
                          href="https://chat.zalo.me"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sky-700 font-bold bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 transition-colors tabular-nums"
                          title="Mở Zalo Chat Web"
                        >
                          <Phone className="w-3 h-3 text-sky-600" />
                          <span>{account.zaloPhone || account.phoneNumber}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center text-slate-700 border-r border-slate-200">
                      {account.mappedEmployee ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10.5px]">
                          {account.mappedEmployee}
                        </span>
                      ) : (
                        <span className="text-slate-400">Tất cả</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 border-r border-slate-200 tabular-nums">
                      {account.soLuotTruyCap || 0}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isConfirming ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(account.email)}
                            className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Xác nhận
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEmail(null)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {account.role !== 'Admin' && (
                            <button
                              type="button"
                              onClick={() => handleToggleLock(account.email)}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors border flex items-center gap-1 ${
                                account.locked
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                              title={account.locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                            >
                              {account.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              {account.locked ? 'Mở Khóa' : 'Khóa'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(account)}
                            className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer text-[10px] font-bold transition-colors flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEmail(account.email)}
                            className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer text-[10px] font-bold transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-500 font-medium bg-slate-50/50">
                  Không tìm thấy tài khoản nào khớp với bộ lọc kiếm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card-based view */}
      <div className="block md:hidden space-y-3">
        {filteredAccounts.length > 0 ? (
          filteredAccounts.map((account) => {
            const isPasswordRevealed = !!revealedPasswords[account.email];
            const isCurrent = currentUserEmail && account.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
            const isConfirming = confirmDeleteEmail === account.email;
            return (
              <div 
                key={account.email} 
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold uppercase text-xs shrink-0 ${
                      isCurrent ? 'text-emerald-700 border-emerald-400 bg-emerald-50' : 'text-slate-700 border-slate-200 bg-slate-50'
                    }`}>
                      {account.email.split('@')[0].substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-slate-900 font-bold leading-tight truncate max-w-[140px] flex items-center gap-1.5">
                          {isCurrent && (
                            <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500 shrink-0" title="Đang truy cập" />
                          )}
                          {account.email}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(account.email)}
                          className="p-1 rounded bg-white border border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center shrink-0"
                          title="Sao chép Email"
                          aria-label={`Sao chép ${account.email}`}
                        >
                          {copiedEmail === account.email ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {account.hoVaTen || 'Chưa cung cấp tên'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {account.locked && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold uppercase flex items-center gap-0.5 leading-none">
                        <Lock className="w-2.5 h-2.5" /> Bị Khóa
                      </span>
                    )}
                    {account.role === 'Admin' ? (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9.5px] font-bold uppercase">
                        Giám Sát Thị Trường
                      </span>
                    ) : account.role === 'OM' ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9.5px] font-bold uppercase">
                        OM
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] font-bold uppercase">
                        Nhân viên
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold mb-0.5 font-sans">Mật khẩu</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-800 text-[11px] font-bold">
                        {isPasswordRevealed ? account.password : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(account.email)}
                        className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        aria-label={isPasswordRevealed ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                      >
                        {isPasswordRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold mb-0.5 font-sans">Mã VTBH / Mã NV</span>
                    <span className="text-slate-800 font-bold text-[11px]">
                      {account.vtbhCode || '—'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold mb-0.5 font-sans">Kênh</span>
                    <span className="text-slate-800 font-bold text-[11px]">
                      {account.channel || '—'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold mb-0.5 font-sans">Liên kết</span>
                    <span className="text-emerald-700 font-bold text-[11px] truncate block max-w-full font-sans">
                      {account.mappedEmployee || 'Tất cả'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 col-span-2 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold font-sans">Số Lượt Truy Cập</span>
                    <span className="text-slate-900 font-bold text-xs tabular-nums">
                      {account.soLuotTruyCap || 0}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
                  {isConfirming ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(account.email)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEmail(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      {account.role !== 'Admin' && (
                        <button
                          type="button"
                          onClick={() => handleToggleLock(account.email)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                            account.locked
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {account.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {account.locked ? 'Mở Khóa' : 'Khóa'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(account)}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 hover:bg-amber-100 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEmail(account.email)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 hover:bg-rose-100 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-500 font-medium text-xs bg-slate-50 border border-slate-200 rounded-xl">
            Không tìm thấy tài khoản nào khớp với bộ lọc kiếm.
          </div>
        )}
      </div>

    </div>
  );
}
