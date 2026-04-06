// ============================================
// Model: Kết quả trả về từ API (chung cho tất cả endpoints)
// ============================================
// Backend KHTC quy ước trả về dữ liệu theo format thống nhất.
// FE dùng generic type để parse response.
//
// === FORMAT PHẢN HỒI API ===
// {
//   "trangThai": true,          ← Thành công hay thất bại
//   "maLoi": null,              ← Mã lỗi (nếu có)
//   "thongBao": "Thành công",   ← Thông báo hiển thị cho user
//   "duLieu": { ... },          ← Dữ liệu trả về (generic)
//   "tongSoBanGhi": 165         ← Tổng bản ghi (cho phân trang)
// }
// ============================================

/**
 * Kết quả trả về từ API — Generic wrapper
 * @template T - Kiểu dữ liệu bên trong (VD: ChiTieu[], DonVi...)
 *
 * Ví dụ sử dụng:
 *   this.http.get<KetQuaApi<ChiTieu[]>>('/api/danh-muc/chi-tieu')
 */
export interface KetQuaApi<T> {
    trangThai: boolean;                  // true = thành công
    maLoi: string | null;                // Mã lỗi (VD: 'DUPLICATE_CODE', 'NOT_FOUND')
    thongBao: string;                    // Thông báo (VD: 'Tạo chỉ tiêu thành công')
    duLieu: T;                           // Dữ liệu trả về
    tongSoBanGhi?: number;               // Tổng bản ghi (phân trang)
}

/**
 * Thông tin phân trang — gửi kèm request
 */
export interface PhanTrang {
    trang: number;                       // Trang hiện tại (1-indexed)
    soBanGhi: number;                    // Số bản ghi mỗi trang
    tongSoBanGhi?: number;               // Tổng (do BE trả về)
    tongSoTrang?: number;                // Tổng trang (tính từ tongSoBanGhi / soBanGhi)
}
