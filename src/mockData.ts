import { EmployeeTargetRow, SoBanRaw } from './types';

export const mockEmployees: EmployeeTargetRow[] = [
  {
    name: 'Lê Thị Hương',
    targetVal: 1200000000,
    actualVal: 1150000000,
    completionRate: 95.83,
    k3Target: 110,
    k3Actual: 114,
    k4Target: 66,
    k4Actual: 78,
    khTarget: 116,
    khActual: 121,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Tập trung đẩy mạnh nhóm hàng HPC trong tuần cuối để đạt tối đa thưởng.'
  },
  {
    name: 'Nguyễn Thành Thực',
    targetVal: 1100000000,
    actualVal: 1020000000,
    completionRate: 92.73,
    k3Target: 105,
    k3Actual: 108,
    k4Target: 62,
    k4Actual: 70,
    khTarget: 110,
    khActual: 115,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Đã hoàn thành xuất sắc chỉ tiêu kích hoạt 3 Ngành.'
  },
  {
    name: 'Bùi Mạnh Cường',
    targetVal: 1150000000,
    actualVal: 1120000000,
    completionRate: 97.39,
    k3Target: 100,
    k3Actual: 102,
    k4Target: 60,
    k4Actual: 65,
    khTarget: 105,
    khActual: 108,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Theo sát tiến độ hoạt động trưng bày tại điểm bán.'
  },
  {
    name: 'Nguyễn Sỹ Vũ',
    targetVal: 1500000000,
    actualVal: 950000000,
    completionRate: 63.33,
    k3Target: 95,
    k3Actual: 90,
    k4Target: 55,
    k4Actual: 50,
    khTarget: 100,
    khActual: 92,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Gặp khó khăn do thiếu nguồn hàng NDFC tại địa bàn phụ trách.'
  },
  {
    name: 'Dương Thị Thanh',
    targetVal: 1300000000,
    actualVal: 1410000000,
    completionRate: 108.46,
    k3Target: 120,
    k3Actual: 125,
    k4Target: 75,
    k4Actual: 82,
    khTarget: 125,
    khActual: 130,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Vượt chỉ tiêu doanh số và kích hoạt xuất sắc, dẫn đầu khu vực.'
  },
  {
    name: 'Vũ Anh Tùng',
    targetVal: 900000000,
    actualVal: 880000000,
    completionRate: 97.78,
    k3Target: 90,
    k3Actual: 88,
    k4Target: 50,
    k4Actual: 48,
    khTarget: 95,
    khActual: 90,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Đồng hành cùng khách hàng lớn để bao phủ kích hoạt 4 Ngành.'
  },
  {
    name: 'Nguyễn Thị Hưng Nguyên',
    targetVal: 850000000,
    actualVal: 810000000,
    completionRate: 95.29,
    k3Target: 85,
    k3Actual: 82,
    k4Target: 45,
    k4Actual: 42,
    khTarget: 90,
    khActual: 85,
    khmhThangTarget: 0,
    khmhThangActual: 0,
    ghiChu: 'Đẩy mạnh kích hoạt khách hàng đạt chuẩn.'
  },
  {
    name: 'Nguyễn Đức Tuấn',
    targetVal: 1000000000,
    actualVal: 980000000,
    completionRate: 98.0,
    k3Target: 95,
    k3Actual: 96,
    k4Target: 58,
    k4Actual: 60,
    khTarget: 102,
    khActual: 105,
    khmhThangTarget: 110,
    khmhThangActual: 85,
    ghiChu: 'Tập trung kích hoạt khách hàng HRC.'
  }
];

export const mockTransactions: SoBanRaw[] = [
  // Nguyễn Văn An
  { Ngay: '2026-06-01', NhanVien: 'Nguyễn Văn An', NganhHang: 'CLF', SanPham: 'Sữa tươi tiệt trùng Dutch Lady', SoLuong: 450, DoanhSo: 360000000, ChiTieu: 350000000, ThucHien: 360000000 },
  { Ngay: '2026-06-05', NhanVien: 'Nguyễn Văn An', NganhHang: 'VFM', SanPham: 'Bột mì Baker\'s Choice số 8', SoLuong: 300, DoanhSo: 270000000, ChiTieu: 260000000, ThucHien: 270000000 },
  { Ngay: '2026-06-08', NhanVien: 'Nguyễn Văn An', NganhHang: 'MCC', SanPham: 'Mayonnaise Cholimex chai lớn', SoLuong: 250, DoanhSo: 190000000, ChiTieu: 230000000, ThucHien: 190000000 },
  { Ngay: '2026-06-12', NhanVien: 'Nguyễn Văn An', NganhHang: 'NDFC', SanPham: 'Sữa bột Cô Gái Hà Lan dinh dưỡng', SoLuong: 200, DoanhSo: 210000000, ChiTieu: 210000000, ThucHien: 210000000 },
  { Ngay: '2026-06-16', NhanVien: 'Nguyễn Văn An', NganhHang: 'HPC', SanPham: 'Xà phòng rửa tay diệt khuẩn chuyên sâu', SoLuong: 180, DoanhSo: 120000000, ChiTieu: 150000000, ThucHien: 120000000 },

  // Trần Thị Bình
  { Ngay: '2026-06-02', NhanVien: 'Trần Thị Bình', NganhHang: 'CLF', SanPham: 'Phô mai Teatime lát mỏng', SoLuong: 380, DoanhSo: 310000000, ChiTieu: 300000000, ThucHien: 310000000 },
  { Ngay: '2026-06-06', NhanVien: 'Trần Thị Bình', NganhHang: 'VFM', SanPham: 'Men nở bánh mì ngọt Pháp', SoLuong: 280, DoanhSo: 220000000, ChiTieu: 260000000, ThucHien: 220000000 },
  { Ngay: '2026-06-10', NhanVien: 'Trần Thị Bình', NganhHang: 'MCC', SanPham: 'Xốt nêm hải sản thượng hạng', SoLuong: 400, DoanhSo: 280000000, ChiTieu: 250000000, ThucHien: 280000000 },
  { Ngay: '2026-06-14', NhanVien: 'Trần Thị Bình', NganhHang: 'HPC', SanPham: 'Nước rửa bát sinh học hữu cơ', SoLuong: 310, DoanhSo: 210000000, ChiTieu: 200000000, ThucHien: 210000000 },

  // Phạm Minh Cường
  { Ngay: '2026-06-03', NhanVien: 'Phạm Minh Cường', NganhHang: 'CLF', SanPham: 'Dutch Lady Milk hộp giấy', SoLuong: 500, DoanhSo: 410000000, ChiTieu: 400000000, ThucHien: 410000000 },
  { Ngay: '2026-06-07', NhanVien: 'Phạm Minh Cường', NganhHang: 'VFM', SanPham: 'Bột mì đa dụng thượng hạng', SoLuong: 320, DoanhSo: 240000000, ChiTieu: 250000000, ThucHien: 240000000 },
  { Ngay: '2026-06-11', NhanVien: 'Phạm Minh Cường', NganhHang: 'NDFC', SanPham: 'Sữa uống dinh dưỡng cao cấp', SoLuong: 250, DoanhSo: 300000000, ChiTieu: 350000000, ThucHien: 300000000 },

  // Trần Thị Hồng Nhung
  { Ngay: '2026-06-04', NhanVien: 'Trần Thị Hồng Nhung', NganhHang: 'CLF', SanPham: 'Sữa tươi tiệt trùng Dutch Lady', SoLuong: 600, DoanhSo: 490000000, ChiTieu: 450000000, ThucHien: 490000000 },
  { Ngay: '2026-06-09', NhanVien: 'Trần Thị Hồng Nhung', NganhHang: 'VFM', SanPham: 'Men nở bánh mì ngọt Pháp', SoLuong: 420, DoanhSo: 310000000, ChiTieu: 300000000, ThucHien: 310000000 },
  { Ngay: '2026-06-13', NhanVien: 'Trần Thị Hồng Nhung', NganhHang: 'MCC', SanPham: 'Mayonnaise Cholimex chai lớn', SoLuong: 350, DoanhSo: 290000000, ChiTieu: 250000000, ThucHien: 290000000 },
  { Ngay: '2026-06-15', NhanVien: 'Trần Thị Hồng Nhung', NganhHang: 'NDFC', SanPham: 'Dầu ô-liu ép lạnh', SoLuong: 180, DoanhSo: 170000000, ChiTieu: 200000000, ThucHien: 170000000 },
  { Ngay: '2026-06-17', NhanVien: 'Trần Thị Hồng Nhung', NganhHang: 'HPC', SanPham: 'Xà phòng rửa tay diệt khuẩn chuyên sâu', SoLuong: 210, DoanhSo: 150000000, ChiTieu: 150000000, ThucHien: 150000000 },

  // Lê Hoàng Long
  { Ngay: '2026-06-02', NhanVien: 'Lê Hoàng Long', NganhHang: 'CLF', SanPham: 'Dutch Lady Milk hộp giấy', SoLuong: 390, DoanhSo: 320000000, ChiTieu: 300000000, ThucHien: 320000000 },
  { Ngay: '2026-06-06', NhanVien: 'Lê Hoàng Long', NganhHang: 'MCC', SanPham: 'Xốt nêm hải sản thượng hạng', SoLuong: 290, DoanhSo: 210000000, ChiTieu: 220000000, ThucHien: 210000000 },
  { Ngay: '2026-06-12', NhanVien: 'Lê Hoàng Long', NganhHang: 'NDFC', SanPham: 'Sữa uống dinh dưỡng cao cấp', SoLuong: 280, DoanhSo: 350000000, ChiTieu: 300000000, ThucHien: 350000000 }
];

export const mockPermissions = [
  { email: 'lamhv.hoabinh@gmail.com', role: 'OM', password: '123123123', mappedEmployee: '' },
  { email: 'tungluu1992ab@gmail.com', role: 'Admin', password: 'khongcogi', mappedEmployee: '' },
  { email: 'lehuongpvlmedia@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Lê Thị Hương' },
  { email: 'embe1992a@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Nguyễn Thành Thực' },
  { email: 'buimanhcuonghb@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Bùi Mạnh Cường' },
  { email: 'nguyensyvu1989@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Nguyễn Sỹ Vũ' },
  { email: 'duongthanhhb03091992@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Dương Thị Thanh' },
  { email: 'vuanhtung290695@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Vũ Anh Tùng' },
  { email: 'nn1706918@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Nguyễn Thị Hưng Nguyên' },
  { email: 'duongquangtuyet@gmail.com', role: 'Nhân viên', password: '123123', mappedEmployee: 'Nguyễn Đức Tuấn' },
];

export const mockActivationListData = [
  // Nguyễn Văn An
  { "Mã KH": "KH101", "Tên Khách Hàng": "Tạp hóa Minh Tâm", "Địa Chỉ": "15 Đinh Tiên Hoàng, Quận 1", "Lịch VT": "T2", "Nhân Viên": "Nguyễn Văn An", "CLF": "TRUE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "12.500.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },
  { "Mã KH": "KH102", "Tên Khách Hàng": "Đại lý sữa Hùng Vương", "Địa Chỉ": "450 Hùng Vương, Quận 5", "Lịch VT": "T2", "Nhân Viên": "Nguyễn Văn An", "CLF": "TRUE", "VFM": "FALSE", "MCC": "FALSE", "NDFC": "TRUE", "HPC": "FALSE", "3 Ngành": "FALSE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "1.800.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Horeca", "Phân loại khách hàng": "Horeca", "AA": "TRUE", "KHKH HRC": "TRUE" },
  { "Mã KH": "KH103", "Tên Khách Hàng": "Cửa hàng Cô Đặc", "Địa Chỉ": "89 Nguyễn Đình Chiểu, Quận 3", "Lịch VT": "T3", "Nhân Viên": "Nguyễn Văn An", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "15.000.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Cơ Sở Sản Xuất", "Phân loại khách hàng": "Cơ Sở Sản Xuất" },
  { "Mã KH": "KH104", "Tên Khách Hàng": "Siêu thị mini An Bình", "Địa Chỉ": "104-106 Trần Hưng Đạo, Quận 1", "Lịch VT": "T4", "Nhân Viên": "Nguyễn Văn An", "CLF": "FALSE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "FALSE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "2.400.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Khác", "Phân loại khách hàng": "Khác" },
  { "Mã KH": "KH105", "Tên Khách Hàng": "Tạp hóa Thanh Xuân", "Địa Chỉ": "23 Lê Văn Sỹ, Phú Nhuận", "Lịch VT": "T5", "Nhân Viên": "Nguyễn Văn An", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "FALSE", "3 Ngành": "TRUE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "8.500.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },

  // Trần Thị Bình
  { "Mã KH": "KH201", "Tên Khách Hàng": "Đại lý gạo Phương Nam", "Địa Chỉ": "78 Trường Chinh, Tân Bình", "Lịch VT": "T2", "Nhân Viên": "Trần Thị Bình", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "22.000.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Cơ Sở Sản Xuất", "Phân loại khách hàng": "Cơ Sở Sản Xuất" },
  { "Mã KH": "KH202", "Tên Khách Hàng": "Tạp hóa Hoa Lan", "Địa Chỉ": "120 Phan Đăng Lưu, Phú Nhuận", "Lịch VT": "T3", "Nhân Viên": "Trần Thị Bình", "CLF": "FALSE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "FALSE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "1.500.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Horeca", "Phân loại khách hàng": "Horeca", "AA": "FALSE", "KHKH HRC": "FALSE" },
  { "Mã KH": "KH203", "Tên Khách Hàng": "Cửa hàng tiện lợi 24G", "Địa Chỉ": "332 Nguyễn Thị Minh Khai, Quận 3", "Lịch VT": "T4", "Nhân Viên": "Trần Thị Bình", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "17.400.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },
  { "Mã KH": "KH204", "Tên Khách Hàng": "Tạp hóa bà Tám", "Địa Chỉ": "54 Nguyễn Kiệm, Gò Vấp", "Lịch VT": "T5", "Nhân Viên": "Trần Thị Bình", "CLF": "TRUE", "VFM": "FALSE", "MCC": "FALSE", "NDFC": "TRUE", "HPC": "FALSE", "3 Ngành": "FALSE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "2.100.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Khác", "Phân loại khách hàng": "Khác" },

  // Lê Thị Hương
  { "Mã KH": "KH301", "Tên Khách Hàng": "Tạp Hóa Hương Sen", "Địa Chỉ": "92 Quang Trung, Hà Đông, Hà Nội", "Lịch VT": "T2", "Nhân Viên": "Lê Thị Hương", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "5.500.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },
  { "Mã KH": "KH302", "Tên Khách Hàng": "Đại lý sữa Hương Việt", "Địa Chỉ": "15 Trần Phú, Hà Đông, Hà Nội", "Lịch VT": "T3", "Nhân Viên": "Lê Thị Hương", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "19.900.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Cơ Sở Sản Xuất", "Phân loại khách hàng": "Cơ Sở Sản Xuất" },
  { "Mã KH": "KH303", "Tên Khách Hàng": "Cửa hàng thực phẩm Sạch", "Địa Chỉ": "23 Nguyễn Khuyến, Hà Đông", "Lịch VT": "T4", "Nhân Viên": "Lê Thị Hương", "CLF": "FALSE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "FALSE", "HPC": "FALSE", "3 Ngành": "FALSE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "800.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Horeca", "Phân loại khách hàng": "Horeca", "AA": "TRUE", "KHKH HRC": "TRUE" },

  // Nguyễn Thành Thực
  { "Mã KH": "KH401", "Tên Khách Hàng": "Đại lý bách hóa thực phẩm", "Địa Chỉ": "45 Giải Phóng, Hai Bà Trưng, Hà Nội", "Lịch VT": "T2", "Nhân Viên": "Nguyễn Thành Thực", "CLF": "TRUE", "VFM": "FALSE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "11.200.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },
  { "Mã KH": "KH402", "Tên Khách Hàng": "Tạp hóa Thực Thúy", "Địa Chỉ": "112 Minh Khai, Hai Bà Trưng, Hà Nội", "Lịch VT": "T3", "Nhân Viên": "Nguyễn Thành Thực", "CLF": "TRUE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "2.800.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Khác", "Phân loại khách hàng": "Khác" },

  // Bùi Mạnh Cường
  { "Mã KH": "KH501", "Tên Khách Hàng": "Tạp hóa Cường Phát", "Địa Chỉ": "80 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội", "Lịch VT": "T2", "Nhân Viên": "Bùi Mạnh Cường", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "34.000.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Horeca", "Phân loại khách hàng": "Horeca", "AA": "TRUE", "KHKH HRC": "TRUE" },
  { "Mã KH": "KH502", "Tên Khách Hàng": "Cửa hàng bách hóa tổng hợp", "Địa Chỉ": "19 Hàng Bài, Hoàn Kiếm, Hà Nội", "Lịch VT": "T4", "Nhân Viên": "Bùi Mạnh Cường", "CLF": "FALSE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "FALSE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "1.200.000", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },

  // Nguyễn Sỹ Vũ
  { "Mã KH": "KH601", "Tên Khách Hàng": "Tạp hóa Sỹ Vũ", "Địa Chỉ": "67 Đê La Thành, Đống Đa, Hà Nội", "Lịch VT": "T3", "Nhân Viên": "Nguyễn Sỹ Vũ", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "FALSE", "HPC": "FALSE", "3 Ngành": "TRUE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "14.500.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Cơ Sở Sản Xuất", "Phân loại khách hàng": "Cơ Sở Sản Xuất" },
  { "Mã KH": "KH602", "Tên Khách Hàng": "Đại lý nước ngọt Vũ Gia", "Địa Chỉ": "102 Chùa Bộc, Đống Đa, Hà Nội", "Lịch VT": "T5", "Nhân Viên": "Nguyễn Sỹ Vũ", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "16.500.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },

  // Dương Thị Thanh
  { "Mã KH": "KH701", "Tên Khách Hàng": "Cửa hàng Thanh Thanh", "Địa Chỉ": "18 Hồ Tùng Mậu, Cầu Giấy, Hà Nội", "Lịch VT": "T2", "Nhân Viên": "Dương Thị Thanh", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "9.900.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Horeca", "Phân loại khách hàng": "Horeca", "AA": "FALSE", "KHKH HRC": "FALSE" },

  // Vũ Anh Tùng
  { "Mã KH": "KH801", "Tên Khách Hàng": "Tạp hóa Anh Tùng", "Địa Chỉ": "86 Xuân Thủy, Cầu Giấy, Hà Nội", "Lịch VT": "T4", "Nhân Viên": "Vũ Anh Tùng", "CLF": "FALSE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "FALSE", "3 Ngành": "TRUE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "4.200.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },

  // Nguyễn Thị Hưng Nguyên
  { "Mã KH": "KH901", "Tên Khách Hàng": "Tạp hóa Nguyên Hồng", "Địa Chỉ": "129 Nguyễn Chí Thanh, Láng Hạ, Hà Nội", "Lịch VT": "T2", "Nhân Viên": "Nguyễn Thị Hưng Nguyên", "CLF": "TRUE", "VFM": "TRUE", "MCC": "TRUE", "NDFC": "TRUE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "TRUE", "Doanh Số Trung Bình 3 Tháng": "28.500.000", "Đạt Chuẩn Doanh Số": "Đạt", "Y": "Truyền Thống", "Phân loại khách hàng": "Truyền Thống" },

  // Nguyễn Đức Tuấn
  { "Mã KH": "KH011", "Tên Khách Hàng": "Đại lý bách hóa Tuấn Hoa", "Địa Chỉ": "234 Lạc Long Quân, Tây Hồ, Hà Nội", "Lịch VT": "T3", "Nhân Viên": "Nguyễn Đức Tuấn", "CLF": "TRUE", "VFM": "TRUE", "MCC": "FALSE", "NDFC": "FALSE", "HPC": "TRUE", "3 Ngành": "TRUE", "4 Ngành": "FALSE", "Doanh Số Trung Bình 3 Tháng": "2.200.050", "Đạt Chuẩn Doanh Số": "Chưa Đạt", "Y": "Khác", "Phân loại khách hàng": "Khác" }
];

export const mockTrungBayListData = [
  { "Tên Khách Hàng": "Tạp hóa Minh Tâm", "Tên CTTB": "Thuê Kệ", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "2.500.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Tạp hóa Minh Tâm", "Tên CTTB": "Nước Rửa Chén", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "1.000.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Đại lý sữa Hùng Vương", "Tên CTTB": "Thuê Kệ", "Mức": "Mức 2", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 1, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "4.200.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Đại lý sữa Hùng Vương", "Tên CTTB": "Nước Rửa Chén", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Không Đạt", "Số Bộ Ảnh": 0, "Đạt Ảnh": "Không Đạt", "DS / SL Đạt Được": "400.000", "Xét Đạt DS / SL": "Chưa Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Cửa hàng Cô Đặc", "Tên CTTB": "Giặt Xả", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 3, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "1.500.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T3" },
  { "Tên Khách Hàng": "Siêu thị mini An Bình", "Tên CTTB": "TRÀ VINATEA", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Không Đạt", "Số Bộ Ảnh": 0, "Đạt Ảnh": "Không Đạt", "DS / SL Đạt Được": "0", "Xét Đạt DS / SL": "Chưa Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T4" },
  { "Tên Khách Hàng": "Tạp hóa Minh Tâm", "Tên CTTB": "Trưng Bày Tự Nhiên", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "2.000.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Đại lý gạo Phương Nam", "Tên CTTB": "Trưng Bày Tự Nhiên", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 1, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "1.500.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Trần Thị Bình", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Tạp hóa Thanh Xuân", "Tên CTTB": "Gạo", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "5.000.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Nguyễn Văn An", "Lịch VT": "T5" },
  
  { "Tên Khách Hàng": "Đại lý gạo Phương Nam", "Tên CTTB": "Thuê Kệ", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 1, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "3.500.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Trần Thị Bình", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Đại lý gạo Phương Nam", "Tên CTTB": "Nam Dương", "Mức": "Mức A", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 1, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "1.200.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Trần Thị Bình", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Tạp hóa Hoa Lan", "Tên CTTB": "Nước Rửa Chén", "Mức": "Mức A", "Đạt Tiêu Chuẩn": "Không Đạt", "Số Bộ Ảnh": 1, "Đạt Ảnh": "Không Đạt", "DS / SL Đạt Được": "300.000", "Xét Đạt DS / SL": "Chưa Đạt", "Nhân Viên": "Trần Thị Bình", "Lịch VT": "T3" },
  { "Tên Khách Hàng": "Cửa hàng tiện lợi 24G", "Tên CTTB": "Giặt Xả", "Mức": "Mức B", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "8.500.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Trần Thị Bình", "Lịch VT": "T4" },
  { "Tên Khách Hàng": "Tạp hóa bà Tám", "Tên CTTB": "Mắm 584NT", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Không Đạt", "Số Bộ Ảnh": 0, "Đạt Ảnh": "Không Đạt", "DS / SL Đạt Được": "150.000", "Xét Đạt DS / SL": "Chưa Đạt", "Nhân Viên": "Trần Thị Bình", "Lịch VT": "T5" },
  
  { "Tên Khách Hàng": "Tạp hóa Cường Phát", "Tên CTTB": "Thuê Kệ", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "6.000.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Bùi Mạnh Cường", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Tạp hóa Cường Phát", "Tên CTTB": "Gạo", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Đạt", "Số Bộ Ảnh": 2, "Đạt Ảnh": "Đạt", "DS / SL Đạt Được": "2.200.000", "Xét Đạt DS / SL": "Đạt", "Nhân Viên": "Bùi Mạnh Cường", "Lịch VT": "T2" },

  // Nguyễn Thành Thực (TRÀ VINATEA)
  { "Tên Khách Hàng": "Đại lý bách hóa thực phẩm", "Tên CTTB": "TRÀ VINATEA", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Không Đạt", "Số Bộ Ảnh": 0, "Đạt Ảnh": "Không Đạt", "DS / SL Đạt Được": "0", "Xét Đạt DS / SL": "Chưa Đạt", "Nhân Viên": "Nguyễn Thành Thực", "Lịch VT": "T2" },
  { "Tên Khách Hàng": "Tạp hóa Thực Thúy", "Tên CTTB": "TRÀ VINATEA", "Mức": "Mức 1", "Đạt Tiêu Chuẩn": "Không Đạt", "Số Bộ Ảnh": 0, "Đạt Ảnh": "Không Đạt", "DS / SL Đạt Được": "0", "Xét Đạt DS / SL": "Chưa Đạt", "Nhân Viên": "Nguyễn Thành Thực", "Lịch VT": "T3" }
];

export const mockChamCongListData = [
  {
    "Nhân Viên": "Nguyễn Văn An",
    "Ngày 1": "Đi đúng giờ", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "Đi đúng giờ, Bỏ điểm: 3", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "Đi Muộn, Bỏ điểm: 1", "Ngày 9": "X", "Ngày 10": "P", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "X", "Ngày 17": "X", "Ngày 18": "Đi đúng giờ, Bỏ điểm: 2",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "Đi đúng giờ, Bỏ điểm: 3", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Trần Thị Bình",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "X", "Ngày 9": "X", "Ngày 10": "X", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "P", "Ngày 16": "M", "Ngày 17": "X", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "N/A", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Phạm Minh Cường",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "X", "Ngày 9": "X", "Ngày 10": "KP", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "X", "Ngày 17": "X", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "N/A", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Trần Thị Hồng Nhung",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "X", "Ngày 9": "X", "Ngày 10": "X", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "X", "Ngày 17": "X", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "N/A", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Lê Hoàng Long",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "X", "Ngày 9": "X", "Ngày 10": "X", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "X", "Ngày 17": "P", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "N/A", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Nguyễn Thị Hưng Nguyên",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "M", "Ngày 9": "X", "Ngày 10": "X", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "M", "Ngày 17": "X", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "N/A", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Lê Thị Hương",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "X", "Ngày 9": "X", "Ngày 10": "X", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "X", "Ngày 17": "X", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "N/A", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X - Bỏ điểm: 0",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X", "Ngày 30": "X", "Ngày 31": "X"
  },
  {
    "Nhân Viên": "Vũ Anh Tùng",
    "Ngày 1": "X", "Ngày 2": "X", "Ngày 3": "X", "Ngày 4": "X", "Ngày 5": "X", "Ngày 6": "X",
    "Ngày 7": "N/A", "Ngày 8": "X", "Ngày 9": "X", "Ngày 10": "X", "Ngày 11": "X", "Ngày 12": "X",
    "Ngày 13": "X", "Ngày 14": "N/A", "Ngày 15": "X", "Ngày 16": "X", "Ngày 17": "X", "Ngày 18": "X",
    "Ngày 19": "X", "Ngày 20": "X", "Ngày 21": "Đi Muộn", "Ngày 22": "X", "Ngày 23": "X", "Ngày 24": "X",
    "Ngày 25": "X", "Ngày 26": "X", "Ngày 27": "X", "Ngày 28": "N/A", "Ngày 29": "X - Bỏ điểm: -1", "Ngày 30": "X", "Ngày 31": "X - Bỏ điểm -4"
  }
];

