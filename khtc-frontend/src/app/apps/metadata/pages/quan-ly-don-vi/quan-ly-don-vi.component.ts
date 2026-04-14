import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DimEntity, DimEntityForm } from '../../../../config/models/don-vi.model';
import { DonViService } from '../../../service/don-vi.service';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './quan-ly-don-vi.component.html',
    styleUrl: './quan-ly-don-vi.component.scss',
})
export class QuanLyDonViComponent implements OnInit {

    private donViService = inject(DonViService);

    // === State ===
    danhSach = signal<DimEntity[]>([]);
    dangTai = signal(false);
    hienDialog = signal(false);
    dangSua = signal(false);
    dangLuu = signal(false);
    loiForm = signal<string | null>(null);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    tuKhoa = '';
    form: DimEntityForm = this.formMacDinh();
    /** entityCode của đơn vị đang sửa — dùng cho endpoint update/{entityCode} */
    maDangSua: string | null = null;
    private timerTimKiem: any;

    danhSachHienThi = computed(() => {
        const tk = this.tuKhoa.trim().toLowerCase();
        if (!tk) return this.danhSach();
        return this.danhSach().filter(dv =>
            dv.entityCode.toLowerCase().includes(tk) ||
            dv.entityName.toLowerCase().includes(tk) ||
            (dv.description ?? '').toLowerCase().includes(tk)
        );
    });

    // ============================================
    // LIFECYCLE
    // ============================================

    async ngOnInit(): Promise<void> {
        await this.taiDuLieu();
    }

    // ============================================
    // LOAD DỮ LIỆU
    // ============================================

    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        const kq = await this.donViService.layDanhSach();
        if (kq.ok) {
            this.danhSach.set(kq.data);
        } else {
            this.danhSach.set([]);
            this.hienThongBao(kq.message || 'Không tải được danh sách đơn vị', 'error');
        }
        this.dangTai.set(false);
    }

    onTimKiem(): void {
        clearTimeout(this.timerTimKiem);
        this.timerTimKiem = setTimeout(() => {}, 0);
    }

    // ============================================
    // THÊM / SỬA
    // ============================================

    moFormThemMoi(): void {
        this.form = this.formMacDinh();
        this.maDangSua = null;
        this.dangSua.set(false);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    moFormSua(dv: DimEntity): void {
        // parentId trong form dùng entityCode của đơn vị cha
        // BE get-all chỉ trả parentName (không trả parentId),
        // nên ta tra entityCode từ parentName để map dropdown cho đúng.
        const parentEntityCode = this.resolveParentCode(dv);

        this.form = {
            entityCode: dv.entityCode,
            entityName: dv.entityName,
            description: dv.description ?? '',
            parentId: parentEntityCode,
            isActive: dv.isActive,
        };
        this.maDangSua = dv.entityCode;
        this.dangSua.set(true);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    async luuDonVi(): Promise<void> {
        if (!this.form.entityCode.trim()) {
            this.loiForm.set('Vui lòng nhập mã đơn vị');
            return;
        }
        if (!this.form.entityName.trim()) {
            this.loiForm.set('Vui lòng nhập tên đơn vị');
            return;
        }

        this.dangLuu.set(true);
        this.loiForm.set(null);

        // parentId gửi lên là id (UUID) của đơn vị cha nếu có.
        // Trong dropdown ta đang lưu entityCode của cha → cần tra lại id UUID.
        const parentIdUuid = this.resolveParentIdUuid(this.form.parentId);

        const payload = {
            entityCode: this.form.entityCode.trim(),
            entityName: this.form.entityName.trim(),
            description: this.form.description.trim() || null,
            parentId: parentIdUuid,
            isActive: this.form.isActive,
        };

        try {
            if (this.dangSua() && this.maDangSua) {
                // BE (tạm thời) tìm theo entityCode, không phải id UUID
                const kq = await this.donViService.capNhat(this.maDangSua, payload);
                if (!kq.ok) {
                    this.loiForm.set(kq.message || 'Cập nhật thất bại');
                    this.dangLuu.set(false);
                    return;
                }
                this.hienThongBao('Cập nhật đơn vị thành công', 'success');
            } else {
                const kq = await this.donViService.taoMoi(payload);
                if (!kq.ok) {
                    this.loiForm.set(kq.message || 'Tạo mới thất bại');
                    this.dangLuu.set(false);
                    return;
                }
                this.hienThongBao('Tạo đơn vị thành công', 'success');
            }
            await this.taiDuLieu();
            this.dongDialog();
        } catch {
            this.loiForm.set('Đã xảy ra lỗi hệ thống');
        }

        this.dangLuu.set(false);
    }

    // ============================================
    // XÓA
    // ============================================

    async xacNhanXoa(dv: DimEntity): Promise<void> {
        if (!confirm(`Xóa đơn vị "${dv.entityName}" (${dv.entityCode})?`)) return;

        // BE (tạm thời) tìm theo entityCode, không phải id UUID
        const kq = await this.donViService.xoa(dv.entityCode);
        if (kq.ok) {
            this.hienThongBao('Xóa đơn vị thành công', 'success');
            await this.taiDuLieu();
        } else {
            this.hienThongBao(kq.message || 'Xóa thất bại', 'error');
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    dongDialog(): void {
        this.hienDialog.set(false);
        this.loiForm.set(null);
    }

    /** Hiển thị tên đơn vị cha trong bảng */
    tenDonViCha(dv: DimEntity): string {
        // Ưu tiên parentName BE trả về
        if (dv.parentName) return dv.parentName;
        if (!dv.parentId) return '—';
        // Fallback: tra trong danh sách theo id
        const cha = this.danhSach().find(x => x.id === dv.parentId || x.entityCode === dv.parentId);
        return cha ? `${cha.entityName}` : dv.parentId;
    }

    /**
     * Khi mở form sửa: lấy entityCode của đơn vị cha để điền vào dropdown.
     * BE get-all trả parentName (tên), không trả parentId (uuid).
     * Ta tra danh sách để tìm entityCode từ parentName.
     */
    private resolveParentCode(dv: DimEntity): string | null {
        // Nếu BE có trả parentId thì dùng luôn (là uuid hay entityCode tuỳ BE)
        // Nhưng theo response thực tế, parentId = null, parentName = tên cha
        if (dv.parentName) {
            const cha = this.danhSach().find(x => x.entityName === dv.parentName);
            return cha ? cha.entityCode : null;
        }
        if (dv.parentId) {
            // parentId có thể là uuid hoặc entityCode
            const chaBangId = this.danhSach().find(x => x.id === dv.parentId);
            return chaBangId ? chaBangId.entityCode : dv.parentId;
        }
        return null;
    }

    /**
     * Khi lưu: chuyển entityCode của đơn vị cha → UUID id để gửi lên BE.
     * BE create nhận parentId là UUID.
     */
    private resolveParentIdUuid(parentEntityCode: string | null): string | null {
        if (!parentEntityCode) return null;
        const cha = this.danhSach().find(x => x.entityCode === parentEntityCode);
        return cha ? cha.id : null;
    }

    private formMacDinh(): DimEntityForm {
        return {
            entityCode: '',
            entityName: '',
            description: '',
            parentId: null,
            isActive: true,
        };
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3500);
    }
}
