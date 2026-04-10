// ============================================
// Service: Mock API � Giả lập Backend cho phát triỒn FE
// ============================================
// Service này giả lập toàn b�" API backend �Ồ FE dev ��"c lập.
// Khi backend sẵn sàng, ch�0 cần thay MockApiService bằng ApiService thật.
//
// === CÁCH D�"NG ===
// 1. Import MockApiService thay vì ApiService trong component/service
// 2. Gọi các method gi�ng h�!t API thật (cùng input/output)
// 3. Response trả về sau 300-800ms (simulate network delay)
//
// === CÁCH CHUY�N SANG API THẬT ===
// Thay ��"i trong providers: { provide: ApiService, useClass: RealApiService }
// Hoặc dùng environment flag: environment.useMockApi
// ============================================

import { Injectable } from '@angular/core';
import { ChiTieu, ChiTieuNode, ChiTieuTaoMoi, ChiTieuCapNhat, ChiTieuBoLoc } from '../../../config/models/chi-tieu.model';
import { DonVi, DonViTaoMoi } from '../../../config/models/don-vi.model';
import { PhienBan, PhienBanTaoMoi } from '../../../config/models/phien-ban.model';
import { FormTemplate, FormTemplateTaoMoi, ColumnDefinition } from '../../../config/models/form-template.model';
import { HoSoNop, TrangThaiHoSo, PheDuyetItem, PheDuyetDto, ThongKeDashboard, TienDoEntity } from '../../../config/models/workflow.model';
import { UserAdmin, RoleAdmin, UserCreateDto, UserUpdateDto, PasswordResetDto, RoleCreateDto, RoleUpdateDto, UserFilterDto, RoleFilterDto } from '../../../config/models/admin.model';
import { User, UserRole, MenuItem } from '../../../config/models/user.model';
import { KetQuaApi, PhanTrang } from '../../../config/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class MockApiService {

    // === Cache dữ li�!u mock (load từ JSON) ===
    private danhSachChiTieu: ChiTieu[] = [];
    private danhSachDonVi: DonVi[] = [];
    private danhSachPhienBan: PhienBan[] = [];  
    private danhSachBieuMau: FormTemplate[] = [];
    private cauHinhCot: Record<string, ColumnDefinition[]> = {};
    private danhSachHoSo: HoSoNop[] = [];
    private danhSachUsers: UserAdmin[] = [];
    private danhSachRoles: RoleAdmin[] = [];
    private danhSachMenus: MenuItem[] = [];
    private nextId = 100; // ID tiếp theo cho bản ghi m�:i

    constructor() {
        this.khoiTaoDuLieu();
    }

    // ============================================
    // CH��TI�`U (ACCOUNT) � CRUD
    // ============================================

    /**
     * Lấy danh sách ch�0 tiêu (có phân trang + lọc)
     *
     * INPUT: ChiTieuBoLoc { tuKhoa?, loaiLuuTru?, trangThai?, trang, soBanGhi }
     * OUTPUT: KetQuaApi<ChiTieu[]> { duLieu: ChiTieu[], tongSoBanGhi: number }
     */
    async layDanhSachChiTieu(boLoc: ChiTieuBoLoc = {}): Promise<KetQuaApi<ChiTieu[]>> {
        await this.giaLapDelay();

        let ketQua = [...this.danhSachChiTieu];

        // Lọc theo từ khóa (tìm trong mã và tên)
        if (boLoc.tuKhoa) {
            const tuKhoa = boLoc.tuKhoa.toLowerCase();
            ketQua = ketQua.filter(ct =>
                ct.maChiTieu.toLowerCase().includes(tuKhoa) ||
                ct.tenChiTieu.toLowerCase().includes(tuKhoa)
            );
        }

        // Lọc theo loại lưu trữ
        if (boLoc.loaiLuuTru) {
            ketQua = ketQua.filter(ct => ct.loaiLuuTru === boLoc.loaiLuuTru);
        }

        // Lọc theo trạng thái
        if (boLoc.trangThai !== undefined) {
            ketQua = ketQua.filter(ct => ct.trangThai === boLoc.trangThai);
        }

        const tongSoBanGhi = ketQua.length;

        // Phân trang
        const trang = boLoc.trang || 1;
        const soBanGhi = boLoc.soBanGhi || 25;
        const batDau = (trang - 1) * soBanGhi;
        ketQua = ketQua.slice(batDau, batDau + soBanGhi);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `Tìm thấy ${tongSoBanGhi} ch�0 tiêu`,
            duLieu: ketQua,
            tongSoBanGhi,
        };
    }

    /**
     * Lấy cây ch�0 tiêu (hierarchical)
     *
     * INPUT: không có
     * OUTPUT: KetQuaApi<ChiTieuNode[]> � cây ch�0 tiêu �ã l�ng children
     */
    async layCayChiTieu(): Promise<KetQuaApi<ChiTieuNode[]>> {
        await this.giaLapDelay();

        const cayChiTieu = this.xayDungCay(this.danhSachChiTieu);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Lấy cây ch�0 tiêu thành công',
            duLieu: cayChiTieu,
        };
    }

    /**
     * Lấy chi tiết 1 ch�0 tiêu theo ID
     *
     * INPUT: id (number)
     * OUTPUT: KetQuaApi<ChiTieu>
     */
    async layChiTieuTheoId(id: number): Promise<KetQuaApi<ChiTieu | null>> {
        await this.giaLapDelay();

        const chiTieu = this.danhSachChiTieu.find(ct => ct.id === id);

        if (!chiTieu) {
            return {
                trangThai: false,
                maLoi: 'NOT_FOUND',
                thongBao: `Không tìm thấy ch�0 tiêu có ID = ${id}`,
                duLieu: null,
            };
        }

        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Lấy chi tiết thành công',
            duLieu: { ...chiTieu },
        };
    }

    /**
     * Tạo m�:i ch�0 tiêu
     *
     * INPUT: ChiTieuTaoMoi { maChiTieu, tenChiTieu, maChiTieuCha?, loaiLuuTru, ... }
     * OUTPUT: KetQuaApi<ChiTieu> � ch�0 tiêu vừa tạo (có id, ngayTao)
     */
    async taoChiTieu(dto: ChiTieuTaoMoi): Promise<KetQuaApi<ChiTieu>> {
        await this.giaLapDelay();

        // KiỒm tra mã trùng
        const daTonTai = this.danhSachChiTieu.some(ct => ct.maChiTieu === dto.maChiTieu);
        if (daTonTai) {
            return {
                trangThai: false,
                maLoi: 'DUPLICATE_CODE',
                thongBao: `Mã ch�0 tiêu "${dto.maChiTieu}" �ã t�n tại`,
                duLieu: null as any,
            };
        }

        // Tính cấp ��" từ cha
        let capDo = 1;
        if (dto.maChiTieuCha) {
            const cha = this.danhSachChiTieu.find(ct => ct.maChiTieu === dto.maChiTieuCha);
            if (cha) capDo = cha.capDo + 1;
        }

        const chiTieuMoi: ChiTieu = {
            id: this.nextId++,
            maChiTieu: dto.maChiTieu,
            tenChiTieu: dto.tenChiTieu,
            capDo,
            maChiTieuCha: dto.maChiTieuCha,
            loaiLuuTru: dto.loaiLuuTru,
            phuongThucTongHop: dto.phuongThucTongHop,
            donViTinh: dto.donViTinh,
            congThuc: dto.congThuc || null,
            thuTu: dto.thuTu || this.danhSachChiTieu.length + 1,
            trangThai: true,
            ghiChu: dto.ghiChu || '',
            ngayTao: new Date().toISOString(),
            ngayCapNhat: new Date().toISOString(),
            nguoiTao: 'admin',
        };

        this.danhSachChiTieu.push(chiTieuMoi);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `Tạo ch�0 tiêu "${dto.tenChiTieu}" thành công`,
            duLieu: chiTieuMoi,
        };
    }

    /**
     * Cập nhật ch�0 tiêu
     *
     * INPUT: ChiTieuCapNhat { id, tenChiTieu?, loaiLuuTru?, ... }
     * OUTPUT: KetQuaApi<ChiTieu> � ch�0 tiêu sau khi cập nhật
     */
    async capNhatChiTieu(dto: ChiTieuCapNhat): Promise<KetQuaApi<ChiTieu>> {
        await this.giaLapDelay();

        const index = this.danhSachChiTieu.findIndex(ct => ct.id === dto.id);
        if (index === -1) {
            return {
                trangThai: false,
                maLoi: 'NOT_FOUND',
                thongBao: `Không tìm thấy ch�0 tiêu ID = ${dto.id}`,
                duLieu: null as any,
            };
        }

        // Merge dữ li�!u cũ + m�:i
        this.danhSachChiTieu[index] = {
            ...this.danhSachChiTieu[index],
            ...dto,
            ngayCapNhat: new Date().toISOString(),
        };

        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Cập nhật ch�0 tiêu thành công',
            duLieu: { ...this.danhSachChiTieu[index] },
        };
    }

    /**
     * Xóa ch�0 tiêu
     *
     * INPUT: id (number)
     * OUTPUT: KetQuaApi<null>
     */
    async xoaChiTieu(id: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();

        // KiỒm tra có con không
        const chiTieu = this.danhSachChiTieu.find(ct => ct.id === id);
        if (!chiTieu) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null };
        }

        const coCon = this.danhSachChiTieu.some(ct => ct.maChiTieuCha === chiTieu.maChiTieu);
        if (coCon) {
            return {
                trangThai: false,
                maLoi: 'HAS_CHILDREN',
                thongBao: `Không thỒ xóa "${chiTieu.tenChiTieu}" vì còn ch�0 tiêu con`,
                duLieu: null,
            };
        }

        this.danhSachChiTieu = this.danhSachChiTieu.filter(ct => ct.id !== id);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `Đã xóa ch�0 tiêu "${chiTieu.tenChiTieu}"`,
            duLieu: null,
        };
    }

    // ============================================
    // HìM TI� N ÍCH (PRIVATE)
    // ============================================

    /**
     * Xây dựng cây từ danh sách phẳng
     * Thuật toán: Duy�!t qua danh sách, gom con vào cha
     */
    private xayDungCay(danhSach: ChiTieu[]): ChiTieuNode[] {
        const bangChiTieu = new Map<string, ChiTieuNode>();
        const cayGoc: ChiTieuNode[] = [];

        // Bư�:c 1: Tạo map mã -> node
        for (const ct of danhSach) {
            bangChiTieu.set(ct.maChiTieu, { ...ct, children: [], expanded: true });
        }

        // Bư�:c 2: Gắn con vào cha
        for (const ct of danhSach) {
            const node = bangChiTieu.get(ct.maChiTieu)!;
            if (ct.maChiTieuCha && bangChiTieu.has(ct.maChiTieuCha)) {
                bangChiTieu.get(ct.maChiTieuCha)!.children!.push(node);
            } else {
                cayGoc.push(node);
            }
        }

        // Bư�:c 3: Sắp xếp theo thuTu
        const sapXep = (nodes: ChiTieuNode[]) => {
            nodes.sort((a, b) => a.thuTu - b.thuTu);
            nodes.forEach(n => { if (n.children?.length) sapXep(n.children); });
        };
        sapXep(cayGoc);

        return cayGoc;
    }

    /**
     * Giả lập network delay (300-800ms)
     * Giúp FE test loading state, spinner, skeleton...
     */
    private giaLapDelay(): Promise<void> {
        const ms = 300 + Math.random() * 500;
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Kh�xi tạo dữ li�!u mock từ JSON files
     */
    private async khoiTaoDuLieu(): Promise<void> {
        try {
            const [resCT, resDV, resPB, resBM] = await Promise.all([
                fetch('assets/mock-data/danh-muc-chi-tieu.json'),
                fetch('assets/mock-data/danh-muc-don-vi.json'),
                fetch('assets/mock-data/danh-muc-phien-ban.json'),
                fetch('assets/mock-data/form-templates.json'),
            ]);
            this.danhSachChiTieu = await resCT.json();
            this.danhSachDonVi = await resDV.json();
            this.danhSachPhienBan = await resPB.json();

            const bmData = await resBM.json();
            this.danhSachBieuMau = (bmData.formTemplates || []).map((t: any) => ({
                formId: t.formID,
                formName: t.formName,
                orgList: t.orgList || [],
                isDynamicRow: t.layoutConfig?.allowDynamicRows ?? false,
                layoutConfig: t.layoutConfig || {},
                ngayTao: new Date().toISOString(),
                ngayCapNhat: new Date().toISOString(),
            }));
            this.cauHinhCot = bmData.columnDefinitions || {};

            // Tạo mock h� sơ workflow từ dữ li�!u �ơn v�9 + biỒu mẫu
            this.khoiTaoHoSo();
            
            // Tạo mock users và roles cho system admin
            this.khoiTaoAdmin();
        } catch (err) {
            console.warn('[MockApi] Không load �ược mock data, dùng mảng r�ng');
        }
    }

    /** Tạo dữ li�!u mock h� sơ workflow */
    private khoiTaoHoSo(): void {
        const trangThais: TrangThaiHoSo[] = ['da_duyet', 'cho_duyet', 'nhap', 'tu_choi', 'tra_lai', 'da_duyet', 'cho_duyet', 'da_duyet'];
        const nguoiTaos = ['Nguy�&n VĒn A', 'Trần Th�9 B', 'Lê VĒn C', 'Phạm Th�9 D', 'Hoàng VĒn E'];
        const nguoiDuyets = ['Giám ��c Toàn', 'PGĐ Kế hoạch Hương', 'Trư�xng phòng KHTC Minh'];

        let id = 1;
        const dvs = this.danhSachDonVi.slice(0, 6);
        const bms = this.danhSachBieuMau;
        for (let i = 0; i < dvs.length; i++) {
            for (let j = 0; j < Math.min(bms.length, 2); j++) {
                const tt = trangThais[(i * 2 + j) % trangThais.length];
                const hoSo: HoSoNop = {
                    id: id,
                    maHoSo: `KHTC.2026.${String(id).padStart(3, '0')}`,
                    tieuDe: `${bms[j].formName} - ${dvs[i].tenDonVi}`,
                    maDonVi: dvs[i].maDonVi,
                    tenDonVi: dvs[i].tenDonVi,
                    entityCode: dvs[i].maDonVi,
                    entityName: dvs[i].tenDonVi,
                    formCode: bms[j].formId,
                    formName: bms[j].formName,
                    period: undefined,
                    year: 2026,
                    maPhienBan: 'PLAN_2026_V1',
                    maBieuMau: bms[j].formId,
                    trangThai: tt,
                    nguoiTao: nguoiTaos[i % nguoiTaos.length],
                    ngayTao: new Date(2026, 2, 15 - id).toISOString(),
                    updatedAt: new Date(2026, 2, 15 - id).toISOString(),
                    nguoiDuyet: tt === 'da_duyet' || tt === 'tu_choi' ? nguoiDuyets[j % nguoiDuyets.length] : undefined,
                    ngayDuyet: tt === 'da_duyet' || tt === 'tu_choi' ? new Date(2026, 2, 16 - id).toISOString() : undefined,
                };
                this.danhSachHoSo.push(hoSo);
                id++;
            }
        }
    }

    /** Tạo dữ li�!u mock users và roles */
    private khoiTaoAdmin(): void {
        // Kh�xi tạo menu system
        this.danhSachMenus = [
            { menuId: 1, menuName: 'Dashboard', parentId: null, url: '/dashboard', formId: null, icon: 'pi-home', sortOrder: 1 },
            { menuId: 2, menuName: 'Dữ li�!u �ầu vào', parentId: null, url: '/data-entry', formId: null, icon: 'pi-table', sortOrder: 2 },
            { menuId: 3, menuName: 'Metadata', parentId: null, url: '/metadata', formId: null, icon: 'pi-cog', sortOrder: 3 },
            { menuId: 4, menuName: 'Form Designer', parentId: null, url: '/form-designer', formId: null, icon: 'pi-pencil', sortOrder: 4 },
            { menuId: 5, menuName: 'Analytics', parentId: null, url: '/analytics', formId: null, icon: 'pi-chart-bar', sortOrder: 5 },
            { menuId: 6, menuName: 'Workflow', parentId: null, url: '/workflow', formId: null, icon: 'pi-send', sortOrder: 6 },
            { menuId: 7, menuName: 'System Admin', parentId: null, url: '/system-admin', formId: null, icon: 'pi-users', sortOrder: 7 },
        ];

        // Kh�xi tạo roles v�:i permissions
        this.danhSachRoles = [
            {
                roleId: 1, roleName: 'Super Admin', description: 'Toàn quyền h�! th�ng',
                permissions: [
                    { roleId: 1, menuId: 1, canRead: true, canWrite: true, canApprove: true },
                    { roleId: 1, menuId: 2, canRead: true, canWrite: true, canApprove: true },
                    { roleId: 1, menuId: 3, canRead: true, canWrite: true, canApprove: true },
                    { roleId: 1, menuId: 4, canRead: true, canWrite: true, canApprove: true },
                    { roleId: 1, menuId: 5, canRead: true, canWrite: true, canApprove: true },
                    { roleId: 1, menuId: 6, canRead: true, canWrite: true, canApprove: true },
                    { roleId: 1, menuId: 7, canRead: true, canWrite: true, canApprove: true },
                ],
                userCount: 1, createdDate: new Date('2026-01-01'), createdBy: 'System', isSystemRole: true
            },
            {
                roleId: 2, roleName: 'Giám ��c', description: 'Phê duy�!t báo cáo, xem th�ng kê',
                permissions: [
                    { roleId: 2, menuId: 1, canRead: true, canWrite: false, canApprove: true },
                    { roleId: 2, menuId: 2, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 2, menuId: 5, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 2, menuId: 6, canRead: true, canWrite: false, canApprove: true },
                ],
                userCount: 2, createdDate: new Date('2026-01-15'), createdBy: 'admin', isSystemRole: false
            },
            {
                roleId: 3, roleName: 'Kế toán trư�xng', description: 'Quản lý dữ li�!u kế toán, báo cáo',
                permissions: [
                    { roleId: 3, menuId: 1, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 3, menuId: 2, canRead: true, canWrite: true, canApprove: false },
                    { roleId: 3, menuId: 3, canRead: true, canWrite: true, canApprove: false },
                    { roleId: 3, menuId: 5, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 3, menuId: 6, canRead: true, canWrite: true, canApprove: false },
                ],
                userCount: 3, createdDate: new Date('2026-01-20'), createdBy: 'admin', isSystemRole: false
            },
            {
                roleId: 4, roleName: 'Nhân viên', description: 'Nhập li�!u, xem báo cáo cơ bản',
                permissions: [
                    { roleId: 4, menuId: 1, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 4, menuId: 2, canRead: true, canWrite: true, canApprove: false },
                    { roleId: 4, menuId: 6, canRead: true, canWrite: true, canApprove: false },
                ],
                userCount: 8, createdDate: new Date('2026-02-01'), createdBy: 'admin', isSystemRole: false
            }
        ];

        // Kh�xi tạo users
        this.danhSachUsers = [
            {
                userId: 1, username: 'admin', fullName: 'Administrator', email: 'admin@evn.com',
                entityCode: 'EVN', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 1, roleName: 'Super Admin' }],
                createdDate: new Date('2026-01-01'), createdBy: 'System', 
                lastLoginDate: new Date('2026-03-11'),
                notes: 'Tài khoản quản tr�9 h�! th�ng'
            },
            {
                userId: 2, username: 'giamdoc', fullName: 'Nguy�&n VĒn Toàn', email: 'toan.gd@evn.com', phoneNumber: '024-3826-1234',
                entityCode: 'EVN', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 2, roleName: 'Giám ��c' }],
                createdDate: new Date('2026-01-15'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-10'),
                notes: 'Giám ��c EVN'
            },
            {
                userId: 3, username: 'pgd.kehoach', fullName: 'Trần Th�9 Hương', email: 'huong.pgd@evn.com', phoneNumber: '024-3826-1235',
                entityCode: 'EVN', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 2, roleName: 'Giám ��c' }],
                createdDate: new Date('2026-01-16'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-09'),
                notes: 'Phó Giám ��c phụ trách Kế hoạch'
            },
            {
                userId: 4, username: 'truong.khtc', fullName: 'Lê VĒn Minh', email: 'minh.tp@evn.com', phoneNumber: '024-3826-1236',
                entityCode: 'EVN_D01', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 3, roleName: 'Kế toán trư�xng' }],
                createdDate: new Date('2026-01-20'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-11'),
                notes: 'Trư�xng phòng KHTC'
            },
            {
                userId: 5, username: 'nv.ketoan1', fullName: 'Phạm Th�9 Lan', email: 'lan.pham@evn.com', 
                entityCode: 'EVN_D01', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 4, roleName: 'Nhân viên' }],
                createdDate: new Date('2026-02-01'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-08')
            },
            {
                userId: 6, username: 'nv.ketoan2', fullName: 'Hoàng VĒn Nam', email: 'nam.hoang@evn.com',
                entityCode: 'EVN_D02', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 4, roleName: 'Nhân viên' }],
                createdDate: new Date('2026-02-15'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-07')
            },
            {
                userId: 7, username: 'test.user', fullName: 'Test User', email: 'test@evn.com',
                entityCode: 'EVN_D03', isActive: false, isLocked: true, failedLoginCount: 5,
                roles: [{ roleId: 4, roleName: 'Nhân viên' }],
                createdDate: new Date('2026-02-20'), createdBy: 'admin',
                lastLoginDate: null,
                notes: 'Tài khoản test - �ã khóa do nhập sai mật khẩu'
            }
        ];
    }

    // ============================================
    // ĐƠN V�` (ENTITY) � CRUD
    // ============================================

    async layDanhSachDonVi(boLoc: { tuKhoa?: string; capDonVi?: string } = {}): Promise<KetQuaApi<DonVi[]>> {
        await this.giaLapDelay();
        let kq = [...this.danhSachDonVi];

        if (boLoc.tuKhoa) {
            const tk = boLoc.tuKhoa.toLowerCase();
            kq = kq.filter(dv =>
                dv.maDonVi.toLowerCase().includes(tk) ||
                dv.tenDonVi.toLowerCase().includes(tk) ||
                dv.tenVietTat.toLowerCase().includes(tk)
            );
        }
        if (boLoc.capDonVi) {
            kq = kq.filter(dv => dv.capDonVi === boLoc.capDonVi);
        }

        return { trangThai: true, maLoi: null, thongBao: `Tìm thấy ${kq.length} �ơn v�9`, duLieu: kq };
    }

    async taoDonVi(dto: DonViTaoMoi): Promise<KetQuaApi<DonVi>> {
        await this.giaLapDelay();
        if (this.danhSachDonVi.some(d => d.maDonVi === dto.maDonVi)) {
            return { trangThai: false, maLoi: 'DUPLICATE_CODE', thongBao: `Mã "${dto.maDonVi}" �ã t�n tại`, duLieu: null as any };
        }
        const donViMoi: DonVi = {
            id: this.nextId++, trangThai: true,
            ngayTao: new Date().toISOString(), ngayCapNhat: new Date().toISOString(),
            ...dto,
        };
        this.danhSachDonVi.push(donViMoi);
        return { trangThai: true, maLoi: null, thongBao: `Tạo �ơn v�9 "${dto.tenDonVi}" thành công`, duLieu: donViMoi };
    }

    async capNhatDonVi(id: number, dto: Partial<DonViTaoMoi>): Promise<KetQuaApi<DonVi>> {
        await this.giaLapDelay();
        const idx = this.danhSachDonVi.findIndex(d => d.id === id);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy �ơn v�9', duLieu: null as any };
        }
        this.danhSachDonVi[idx] = { ...this.danhSachDonVi[idx], ...dto, ngayCapNhat: new Date().toISOString() };
        return { trangThai: true, maLoi: null, thongBao: 'Cập nhật �ơn v�9 thành công', duLieu: { ...this.danhSachDonVi[idx] } };
    }

    async xoaDonVi(id: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const dv = this.danhSachDonVi.find(d => d.id === id);
        if (!dv) return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null };

        const coCon = this.danhSachDonVi.some(d => d.maDonViCha === dv.maDonVi);
        if (coCon) {
            return { trangThai: false, maLoi: 'HAS_CHILDREN', thongBao: `Không thỒ xóa "${dv.tenVietTat}" vì còn �ơn v�9 con`, duLieu: null };
        }
        this.danhSachDonVi = this.danhSachDonVi.filter(d => d.id !== id);
        return { trangThai: true, maLoi: null, thongBao: `Đã xóa "${dv.tenVietTat}"`, duLieu: null };
    }

    // ============================================
    // PHI�`N BẢN (VERSION) � CRUD
    // ============================================

    async layDanhSachPhienBan(boLoc: { tuKhoa?: string; loaiPhienBan?: string } = {}): Promise<KetQuaApi<PhienBan[]>> {
        await this.giaLapDelay();
        let kq = [...this.danhSachPhienBan];

        if (boLoc.tuKhoa) {
            const tk = boLoc.tuKhoa.toLowerCase();
            kq = kq.filter(pb => pb.maPhienBan.toLowerCase().includes(tk) || pb.tenPhienBan.toLowerCase().includes(tk));
        }
        if (boLoc.loaiPhienBan) {
            kq = kq.filter(pb => pb.loaiPhienBan === boLoc.loaiPhienBan);
        }

        return { trangThai: true, maLoi: null, thongBao: `Tìm thấy ${kq.length} phiên bản`, duLieu: kq };
    }

    async taoPhienBan(dto: PhienBanTaoMoi): Promise<KetQuaApi<PhienBan>> {
        await this.giaLapDelay();
        if (this.danhSachPhienBan.some(d => d.maPhienBan === dto.maPhienBan)) {
            return { trangThai: false, maLoi: 'DUPLICATE_CODE', thongBao: `Mã "${dto.maPhienBan}" �ã t�n tại`, duLieu: null as any };
        }
        const phienBanMoi: PhienBan = {
            id: this.nextId++, trangThai: true, laPhienBanMacDinh: false,
            ngayTao: new Date().toISOString(), ngayCapNhat: new Date().toISOString(),
            ...dto,
        };
        this.danhSachPhienBan.push(phienBanMoi);
        return { trangThai: true, maLoi: null, thongBao: `Tạo phiên bản "${dto.tenPhienBan}" thành công`, duLieu: phienBanMoi };
    }

    async capNhatPhienBan(id: number, dto: Partial<PhienBanTaoMoi>): Promise<KetQuaApi<PhienBan>> {
        await this.giaLapDelay();
        const idx = this.danhSachPhienBan.findIndex(d => d.id === id);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy phiên bản', duLieu: null as any };
        }
        this.danhSachPhienBan[idx] = { ...this.danhSachPhienBan[idx], ...dto, ngayCapNhat: new Date().toISOString() };
        return { trangThai: true, maLoi: null, thongBao: 'Cập nhật phiên bản thành công', duLieu: { ...this.danhSachPhienBan[idx] } };
    }

    async khoaMoPhienBan(id: number): Promise<KetQuaApi<PhienBan>> {
        await this.giaLapDelay();
        const idx = this.danhSachPhienBan.findIndex(d => d.id === id);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null as any };
        }
        this.danhSachPhienBan[idx].trangThai = !this.danhSachPhienBan[idx].trangThai;
        const label = this.danhSachPhienBan[idx].trangThai ? 'Đã m�x khóa' : 'Đã khóa';
        return { trangThai: true, maLoi: null, thongBao: `${label} "${this.danhSachPhienBan[idx].tenPhienBan}"`, duLieu: { ...this.danhSachPhienBan[idx] } };
    }

    async xoaPhienBan(id: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const pb = this.danhSachPhienBan.find(d => d.id === id);
        if (!pb) return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null };
        this.danhSachPhienBan = this.danhSachPhienBan.filter(d => d.id !== id);
        return { trangThai: true, maLoi: null, thongBao: `Đã xóa "${pb.tenPhienBan}"`, duLieu: null };
    }

    // ============================================
    // BI�U MẪU (FORM TEMPLATE) � CRUD
    // ============================================

    async layDanhSachBieuMau(boLoc: { tuKhoa?: string } = {}): Promise<KetQuaApi<FormTemplate[]>> {
        await this.giaLapDelay();
        let kq = [...this.danhSachBieuMau];

        if (boLoc.tuKhoa) {
            const tk = boLoc.tuKhoa.toLowerCase();
            kq = kq.filter(bm =>
                bm.formId.toLowerCase().includes(tk) ||
                bm.formName.toLowerCase().includes(tk)
            );
        }

        return { trangThai: true, maLoi: null, thongBao: `Tìm thấy ${kq.length} biỒu mẫu`, duLieu: kq };
    }

    async layBieuMauTheoId(formId: string): Promise<KetQuaApi<FormTemplate | null>> {
        await this.giaLapDelay();
        const bm = this.danhSachBieuMau.find(b => b.formId === formId);
        if (!bm) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: `Không tìm thấy biỒu mẫu "${formId}"`, duLieu: null };
        }
        return { trangThai: true, maLoi: null, thongBao: 'OK', duLieu: { ...bm } };
    }

    async taoBieuMau(dto: FormTemplateTaoMoi): Promise<KetQuaApi<FormTemplate>> {
        await this.giaLapDelay();
        if (this.danhSachBieuMau.some(b => b.formId === dto.formId)) {
            return { trangThai: false, maLoi: 'DUPLICATE_CODE', thongBao: `Mã "${dto.formId}" �ã t�n tại`, duLieu: null as any };
        }
        const bieuMauMoi: FormTemplate = {
            ...dto,
            ngayTao: new Date().toISOString(),
            ngayCapNhat: new Date().toISOString(),
        };
        this.danhSachBieuMau.push(bieuMauMoi);
        return { trangThai: true, maLoi: null, thongBao: `Tạo biỒu mẫu "${dto.formName}" thành công`, duLieu: bieuMauMoi };
    }

    async capNhatBieuMau(formId: string, dto: Partial<FormTemplateTaoMoi>): Promise<KetQuaApi<FormTemplate>> {
        await this.giaLapDelay();
        const idx = this.danhSachBieuMau.findIndex(b => b.formId === formId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy biỒu mẫu', duLieu: null as any };
        }
        this.danhSachBieuMau[idx] = { ...this.danhSachBieuMau[idx], ...dto, ngayCapNhat: new Date().toISOString() };
        return { trangThai: true, maLoi: null, thongBao: 'Cập nhật biỒu mẫu thành công', duLieu: { ...this.danhSachBieuMau[idx] } };
    }

    async xoaBieuMau(formId: string): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const bm = this.danhSachBieuMau.find(b => b.formId === formId);
        if (!bm) return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null };
        this.danhSachBieuMau = this.danhSachBieuMau.filter(b => b.formId !== formId);
        return { trangThai: true, maLoi: null, thongBao: `Đã xóa "${bm.formName}"`, duLieu: null };
    }

    async layCauHinhCot(formId: string): Promise<KetQuaApi<ColumnDefinition[]>> {
        await this.giaLapDelay();
        const cols = this.cauHinhCot[formId] || [];
        return { trangThai: true, maLoi: null, thongBao: `${cols.length} c�"t`, duLieu: cols };
    }

    // ============================================
    // TEMPLATE LAYOUT STORE (Form Designer �  Save/Load)
    // ============================================
    // In-memory map: formId �  full ExportedTemplate JSON (mock DB)

    private templateLayoutStore = new Map<string, any>();

    async luuTemplateLayout(data: any): Promise<KetQuaApi<any>> {
        await this.giaLapDelay();
        const formId = data?.formId;
        if (!formId) {
            return { trangThai: false, maLoi: 'MISSING_FORM_ID', thongBao: 'formId is required', duLieu: null };
        }
        this.templateLayoutStore.set(formId, JSON.parse(JSON.stringify(data)));
        console.log(`[MockApi] �x� Đã lưu template layout "${formId}" vào memory store`);
        return {
            trangThai: true,
            maLoi: null,
            thongBao: `Đã lưu biỒu mẫu "${data.formName || formId}" thành công`,
            duLieu: data,
        };
    }

    async layTemplateLayout(formId: string): Promise<KetQuaApi<any>> {
        await this.giaLapDelay();
        const stored = this.templateLayoutStore.get(formId);
        if (!stored) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: `Không tìm thấy layout cho "${formId}"`, duLieu: null };
        }
        console.log(`[MockApi] �x� Load template layout "${formId}" từ memory store`);
        return { trangThai: true, maLoi: null, thongBao: 'OK', duLieu: JSON.parse(JSON.stringify(stored)) };
    }

    // ============================================
    // DANH MỤC MÒ CH�� TI�`U (INDICATOR CODES)
    // ============================================

    private danhMucMaChiTieuCache: any = null;

    async layDanhMucMaChiTieu(): Promise<KetQuaApi<any>> {
        await this.giaLapDelay();
        if (!this.danhMucMaChiTieuCache) {
            try {
                const res = await fetch('assets/mock-data/danh-muc-ma-chi-tieu.json');
                this.danhMucMaChiTieuCache = await res.json();
            } catch {
                this.danhMucMaChiTieuCache = { columnIndicators: [], rowIndicators: [] };
            }
        }
        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Lấy danh mục mã ch�0 tiêu thành công',
            duLieu: this.danhMucMaChiTieuCache,
        };
    }

    // ============================================
    // DASHBOARD � Th�ng kê t�"ng hợp
    // ============================================

    async layThongKeDashboard(): Promise<KetQuaApi<ThongKeDashboard>> {
        await this.giaLapDelay();

        const hoSos = this.danhSachHoSo;
        const daDuyet = hoSos.filter(h => h.trangThai === 'da_duyet').length;
        const choDuyet = hoSos.filter(h => h.trangThai === 'cho_duyet').length;
        const tuChoi = hoSos.filter(h => h.trangThai === 'tu_choi').length;

        // Tiến ��" theo �ơn v�9
        const tongBM = this.danhSachBieuMau.length || 1;
        const tienDo: TienDoEntity[] = this.danhSachDonVi.slice(0, 8).map(dv => {
            const hoSoDV = hoSos.filter(h => h.maDonVi === dv.maDonVi);
            return {
                maDonVi: dv.maDonVi,
                tenDonVi: dv.tenDonVi,
                tongBieuMau: tongBM,
                daNop: hoSoDV.filter(h => h.trangThai !== 'nhap').length,
                daDuyet: hoSoDV.filter(h => h.trangThai === 'da_duyet').length,
            };
        });

        const thongKe: ThongKeDashboard = {
            doanhThu: 125430,
            chiPhi: 98750,
            loiNhuan: 26680,
            tyLeDuyet: hoSos.length > 0 ? Math.round((daDuyet / hoSos.length) * 100) : 0,
            tongHoSo: hoSos.length,
            hoSoChoDuyet: choDuyet,
            hoSoDaDuyet: daDuyet,
            hoSoTuChoi: tuChoi,
            hoSoGanDay: hoSos.slice(0, 5),
            tienDoTheoEntity: tienDo,
        };

        return { trangThai: true, maLoi: null, thongBao: 'OK', duLieu: thongKe };
    }

    // ============================================
    // WORKFLOW � H� sơ & Phê duy�!t
    // ============================================

    async layDanhSachHoSo(boLoc: { tuKhoa?: string; trangThai?: TrangThaiHoSo; maDonVi?: string } = {}): Promise<KetQuaApi<HoSoNop[]>> {
        await this.giaLapDelay();
        let kq = [...this.danhSachHoSo];

        if (boLoc.tuKhoa) {
            const tk = boLoc.tuKhoa.toLowerCase();
            kq = kq.filter(h =>
                h.maHoSo.toLowerCase().includes(tk) ||
                h.tieuDe.toLowerCase().includes(tk) ||
                (h.tenDonVi?.toLowerCase().includes(tk) ?? false) ||
                (h.entityName?.toLowerCase().includes(tk) ?? false) ||
                (h.formName?.toLowerCase().includes(tk) ?? false)
            );
        }
        if (boLoc.trangThai) {
            kq = kq.filter(h => h.trangThai === boLoc.trangThai);
        }
        if (boLoc.maDonVi) {
            kq = kq.filter(h => h.maDonVi === boLoc.maDonVi);
        }

        return { trangThai: true, maLoi: null, thongBao: `${kq.length} h� sơ`, duLieu: kq };
    }

    async layHopThuPheDuyet(): Promise<KetQuaApi<PheDuyetItem[]>> {
        await this.giaLapDelay();
        const choDuyet = this.danhSachHoSo.filter(h => h.trangThai === 'cho_duyet');
        const mucDos: Array<'cao' | 'trung_binh' | 'thap'> = ['cao', 'trung_binh', 'thap'];
        const items: PheDuyetItem[] = choDuyet.map((h, i) => ({
            id: h.id,
            hoSo: h,
            ngayNhan: h.ngayTao,
            mucDoUuTien: mucDos[i % 3],
        }));
        return { trangThai: true, maLoi: null, thongBao: `${items.length} h� sơ chờ duy�!t`, duLieu: items };
    }

    async xuLyPheDuyet(dto: PheDuyetDto): Promise<KetQuaApi<HoSoNop>> {
        await this.giaLapDelay();
        const idx = this.danhSachHoSo.findIndex(h => h.id === dto.hoSoId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy h� sơ', duLieu: null as any };
        }

        const mapTrangThai: Record<string, TrangThaiHoSo> = {
            duyet: 'da_duyet',
            tu_choi: 'tu_choi',
            tra_lai: 'tra_lai',
        };
        this.danhSachHoSo[idx].trangThai = mapTrangThai[dto.hanhDong] || 'cho_duyet';
        this.danhSachHoSo[idx].nguoiDuyet = 'Giám ��c Toàn';
        this.danhSachHoSo[idx].ngayDuyet = new Date().toISOString();
        if (dto.ghiChu) this.danhSachHoSo[idx].ghiChu = dto.ghiChu;

        const labels: Record<string, string> = { duyet: 'Đã duy�!t', tu_choi: 'Đã từ ch�i', tra_lai: 'Đã trả lại' };
        return {
            trangThai: true, maLoi: null,
            thongBao: `${labels[dto.hanhDong]} h� sơ "${this.danhSachHoSo[idx].maHoSo}"`,
            duLieu: { ...this.danhSachHoSo[idx] },
        };
    }

    async nopHoSo(hoSoId: number): Promise<KetQuaApi<HoSoNop>> {
        await this.giaLapDelay();
        const idx = this.danhSachHoSo.findIndex(h => h.id === hoSoId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null as any };
        }
        this.danhSachHoSo[idx].trangThai = 'cho_duyet';
        return { trangThai: true, maLoi: null, thongBao: `Đã n�"p "${this.danhSachHoSo[idx].maHoSo}"`, duLieu: { ...this.danhSachHoSo[idx] } };
    }

    async rutHoSo(hoSoId: number): Promise<KetQuaApi<HoSoNop>> {
        await this.giaLapDelay();
        const idx = this.danhSachHoSo.findIndex(h => h.id === hoSoId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy', duLieu: null as any };
        }
        this.danhSachHoSo[idx].trangThai = 'nhap';
        return { trangThai: true, maLoi: null, thongBao: `Đã rút "${this.danhSachHoSo[idx].maHoSo}"`, duLieu: { ...this.danhSachHoSo[idx] } };
    }

    // ============================================
    // SYSTEM ADMIN � USER MANAGEMENT
    // ============================================

    /** Lấy danh sách users v�:i filter */
    async layDanhSachUsers(filter: UserFilterDto = {}): Promise<KetQuaApi<UserAdmin[]>> {
        await this.giaLapDelay();
        let ketQua = [...this.danhSachUsers];

        if (filter.keyword) {
            const kw = filter.keyword.toLowerCase();
            ketQua = ketQua.filter(u => 
                u.username.toLowerCase().includes(kw) ||
                u.fullName.toLowerCase().includes(kw) ||
                u.email?.toLowerCase().includes(kw)
            );
        }

        if (filter.entityCode) {
            ketQua = ketQua.filter(u => u.entityCode === filter.entityCode);
        }

        if (filter.roleId) {
            ketQua = ketQua.filter(u => u.roles.some(r => r.roleId === filter.roleId));
        }

        if (filter.isActive !== undefined) {
            ketQua = ketQua.filter(u => u.isActive === filter.isActive);
        }

        if (filter.isLocked !== undefined) {
            ketQua = ketQua.filter(u => u.isLocked === filter.isLocked);
        }

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `Tìm thấy ${ketQua.length} người dùng`,
            duLieu: ketQua,
            tongSoBanGhi: ketQua.length
        };
    }

    /** Lấy chi tiết user */
    async layChiTietUser(userId: number): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();
        const user = this.danhSachUsers.find(u => u.userId === userId);
        if (!user) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy người dùng', duLieu: null as any };
        }
        return { trangThai: true, maLoi: null, thongBao: 'Thành công', duLieu: user };
    }

    /** Tạo user m�:i */
    async taoUser(dto: UserCreateDto): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();

        // KiỒm tra username trùng
        if (this.danhSachUsers.find(u => u.username === dto.username)) {
            return { trangThai: false, maLoi: 'DUPLICATE', thongBao: 'Username �ã t�n tại', duLieu: null as any };
        }

        // Lấy role names
        const roleNames = this.danhSachRoles.filter(r => dto.roleIds.includes(r.roleId)).map(r => ({ roleId: r.roleId, roleName: r.roleName }));

        const newUser: UserAdmin = {
            userId: this.nextId++,
            username: dto.username,
            fullName: dto.fullName,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            entityCode: dto.entityCode,
            isActive: dto.isActive,
            isLocked: false,
            failedLoginCount: 0,
            roles: roleNames,
            createdDate: new Date(),
            createdBy: 'admin', // TODO: lấy từ session
            lastLoginDate: null,
            notes: dto.notes
        };

        this.danhSachUsers.push(newUser);

        // Cập nhật userCount trong roles
        dto.roleIds.forEach(roleId => {
            const role = this.danhSachRoles.find(r => r.roleId === roleId);
            if (role) role.userCount++;
        });

        return { trangThai: true, maLoi: null, thongBao: `Đã tạo người dùng "${dto.username}"`, duLieu: newUser };
    }

    /** Cập nhật user */
    async capNhatUser(dto: UserUpdateDto): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === dto.userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy người dùng', duLieu: null as any };
        }

        const user = this.danhSachUsers[idx];
        const oldRoleIds = user.roles.map(r => r.roleId);

        // Cập nhật thông tin
        const roleNames = this.danhSachRoles.filter(r => dto.roleIds.includes(r.roleId)).map(r => ({ roleId: r.roleId, roleName: r.roleName }));
        
        this.danhSachUsers[idx] = {
            ...user,
            fullName: dto.fullName,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            entityCode: dto.entityCode,
            isActive: dto.isActive,
            isLocked: dto.isLocked,
            roles: roleNames,
            notes: dto.notes
        };

        // Cập nhật userCount trong roles
        oldRoleIds.forEach(roleId => {
            if (!dto.roleIds.includes(roleId)) {
                const role = this.danhSachRoles.find(r => r.roleId === roleId);
                if (role && role.userCount > 0) role.userCount--;
            }
        });
        dto.roleIds.forEach(roleId => {
            if (!oldRoleIds.includes(roleId)) {
                const role = this.danhSachRoles.find(r => r.roleId === roleId);
                if (role) role.userCount++;
            }
        });

        return { trangThai: true, maLoi: null, thongBao: `Đã cập nhật "${user.username}"`, duLieu: this.danhSachUsers[idx] };
    }

    /** Xóa user */
    async xoaUser(userId: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy người dùng', duLieu: null };
        }

        const user = this.danhSachUsers[idx];
        
        // Cập nhật userCount trong roles
        user.roles.forEach(role => {
            const r = this.danhSachRoles.find(r => r.roleId === role.roleId);
            if (r && r.userCount > 0) r.userCount--;
        });

        this.danhSachUsers.splice(idx, 1);
        return { trangThai: true, maLoi: null, thongBao: `Đã xóa "${user.username}"`, duLieu: null };
    }

    /** Reset mật khẩu */
    async resetPassword(dto: PasswordResetDto): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === dto.userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy người dùng', duLieu: null };
        }

        // Reset password (trong thực tế sẽ hash password)
        this.danhSachUsers[idx].failedLoginCount = 0;
        this.danhSachUsers[idx].isLocked = false;

        return { trangThai: true, maLoi: null, thongBao: `Đã reset mật khẩu cho "${this.danhSachUsers[idx].username}"`, duLieu: null };
    }

    /** Khóa/m�x khóa user */
    async toggleLockUser(userId: number): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy người dùng', duLieu: null as any };
        }

        this.danhSachUsers[idx].isLocked = !this.danhSachUsers[idx].isLocked;
        if (this.danhSachUsers[idx].isLocked) {
            this.danhSachUsers[idx].failedLoginCount = 5; // Simulate locked due to failed attempts
        } else {
            this.danhSachUsers[idx].failedLoginCount = 0;
        }

        const action = this.danhSachUsers[idx].isLocked ? 'khóa' : 'm�x khóa';
        return { 
            trangThai: true, 
            maLoi: null, 
            thongBao: `Đã ${action} "${this.danhSachUsers[idx].username}"`, 
            duLieu: this.danhSachUsers[idx] 
        };
    }

    // ============================================
    // SYSTEM ADMIN � ROLE MANAGEMENT
    // ============================================

    /** Lấy danh sách roles v�:i filter */
    async layDanhSachRoles(filter: RoleFilterDto = {}): Promise<KetQuaApi<RoleAdmin[]>> {
        await this.giaLapDelay();
        let ketQua = [...this.danhSachRoles];

        if (filter.keyword) {
            const kw = filter.keyword.toLowerCase();
            ketQua = ketQua.filter(r => 
                r.roleName.toLowerCase().includes(kw) ||
                r.description?.toLowerCase().includes(kw)
            );
        }

        if (!filter.includeSystemRoles) {
            ketQua = ketQua.filter(r => !r.isSystemRole);
        }

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `Tìm thấy ${ketQua.length} vai trò`,
            duLieu: ketQua,
            tongSoBanGhi: ketQua.length
        };
    }

    /** Lấy chi tiết role */
    async layChiTietRole(roleId: number): Promise<KetQuaApi<RoleAdmin>> {
        await this.giaLapDelay();
        const role = this.danhSachRoles.find(r => r.roleId === roleId);
        if (!role) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy vai trò', duLieu: null as any };
        }
        return { trangThai: true, maLoi: null, thongBao: 'Thành công', duLieu: role };
    }

    /** Tạo role m�:i */
    async taoRole(dto: RoleCreateDto): Promise<KetQuaApi<RoleAdmin>> {
        await this.giaLapDelay();

        // KiỒm tra role name trùng
        if (this.danhSachRoles.find(r => r.roleName === dto.roleName)) {
            return { trangThai: false, maLoi: 'DUPLICATE', thongBao: 'Tên vai trò �ã t�n tại', duLieu: null as any };
        }

        const newRole: RoleAdmin = {
            roleId: this.nextId++,
            roleName: dto.roleName,
            description: dto.description,
            permissions: dto.permissions.map(p => ({ ...p, roleId: this.nextId - 1 })),
            userCount: 0,
            createdDate: new Date(),
            createdBy: 'admin', // TODO: lấy từ session
            isSystemRole: false
        };

        this.danhSachRoles.push(newRole);
        return { trangThai: true, maLoi: null, thongBao: `Đã tạo vai trò "${dto.roleName}"`, duLieu: newRole };
    }

    /** Cập nhật role */
    async capNhatRole(dto: RoleUpdateDto): Promise<KetQuaApi<RoleAdmin>> {
        await this.giaLapDelay();
        const idx = this.danhSachRoles.findIndex(r => r.roleId === dto.roleId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy vai trò', duLieu: null as any };
        }

        const role = this.danhSachRoles[idx];
        if (role.isSystemRole) {
            return { trangThai: false, maLoi: 'SYSTEM_ROLE', thongBao: 'Không thỒ sửa vai trò h�! th�ng', duLieu: null as any };
        }

        this.danhSachRoles[idx] = {
            ...role,
            roleName: dto.roleName,
            description: dto.description,
            permissions: dto.permissions.map(p => ({ ...p, roleId: dto.roleId }))
        };

        // Cập nhật role name trong users
        this.danhSachUsers.forEach(user => {
            const userRole = user.roles.find(r => r.roleId === dto.roleId);
            if (userRole) {
                userRole.roleName = dto.roleName;
            }
        });

        return { trangThai: true, maLoi: null, thongBao: `Đã cập nhật vai trò "${dto.roleName}"`, duLieu: this.danhSachRoles[idx] };
    }

    /** Xóa role */
    async xoaRole(roleId: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const idx = this.danhSachRoles.findIndex(r => r.roleId === roleId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'Không tìm thấy vai trò', duLieu: null };
        }

        const role = this.danhSachRoles[idx];
        if (role.isSystemRole) {
            return { trangThai: false, maLoi: 'SYSTEM_ROLE', thongBao: 'Không thỒ xóa vai trò h�! th�ng', duLieu: null };
        }

        if (role.userCount > 0) {
            return { trangThai: false, maLoi: 'ROLE_IN_USE', thongBao: `Vai trò �ang �ược sử dụng b�xi ${role.userCount} người dùng`, duLieu: null };
        }

        this.danhSachRoles.splice(idx, 1);
        return { trangThai: true, maLoi: null, thongBao: `Đã xóa vai trò "${role.roleName}"`, duLieu: null };
    }

    /** Lấy danh sách menus cho phân quyền */
    async layDanhSachMenus(): Promise<KetQuaApi<MenuItem[]>> {
        await this.giaLapDelay();
        return {
            trangThai: true,
            maLoi: null,
            thongBao: `${this.danhSachMenus.length} menu`,
            duLieu: this.danhSachMenus
        };
    }
}
