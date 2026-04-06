// ============================================
// Service: Mock API â€” Giáº£ láº­p Backend cho phÃ¡t triá»ƒn FE
// ============================================
// Service nÃ y giáº£ láº­p toÃ n bá»™ API backend Ä‘á»ƒ FE dev Ä‘á»™c láº­p.
// Khi backend sáºµn sÃ ng, chá»‰ cáº§n thay MockApiService báº±ng ApiService tháº­t.
//
// === CÃCH DÃ™NG ===
// 1. Import MockApiService thay vÃ¬ ApiService trong component/service
// 2. Gá»i cÃ¡c method giá»‘ng há»‡t API tháº­t (cÃ¹ng input/output)
// 3. Response tráº£ vá» sau 300-800ms (simulate network delay)
//
// === CÃCH CHUYá»‚N SANG API THáº¬T ===
// Thay Ä‘á»•i trong providers: { provide: ApiService, useClass: RealApiService }
// Hoáº·c dÃ¹ng environment flag: environment.useMockApi
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

    // === Cache dá»¯ liá»‡u mock (load tá»« JSON) ===
    private danhSachChiTieu: ChiTieu[] = [];
    private danhSachDonVi: DonVi[] = [];
    private danhSachPhienBan: PhienBan[] = [];  
    private danhSachBieuMau: FormTemplate[] = [];
    private cauHinhCot: Record<string, ColumnDefinition[]> = {};
    private danhSachHoSo: HoSoNop[] = [];
    private danhSachUsers: UserAdmin[] = [];
    private danhSachRoles: RoleAdmin[] = [];
    private danhSachMenus: MenuItem[] = [];
    private nextId = 100; // ID tiáº¿p theo cho báº£n ghi má»›i

    constructor() {
        this.khoiTaoDuLieu();
    }

    // ============================================
    // CHá»ˆTIÃŠU (ACCOUNT) â€” CRUD
    // ============================================

    /**
     * Láº¥y danh sÃ¡ch chá»‰ tiÃªu (cÃ³ phÃ¢n trang + lá»c)
     *
     * INPUT: ChiTieuBoLoc { tuKhoa?, loaiLuuTru?, trangThai?, trang, soBanGhi }
     * OUTPUT: KetQuaApi<ChiTieu[]> { duLieu: ChiTieu[], tongSoBanGhi: number }
     */
    async layDanhSachChiTieu(boLoc: ChiTieuBoLoc = {}): Promise<KetQuaApi<ChiTieu[]>> {
        await this.giaLapDelay();

        let ketQua = [...this.danhSachChiTieu];

        // Lá»c theo tá»« khÃ³a (tÃ¬m trong mÃ£ vÃ  tÃªn)
        if (boLoc.tuKhoa) {
            const tuKhoa = boLoc.tuKhoa.toLowerCase();
            ketQua = ketQua.filter(ct =>
                ct.maChiTieu.toLowerCase().includes(tuKhoa) ||
                ct.tenChiTieu.toLowerCase().includes(tuKhoa)
            );
        }

        // Lá»c theo loáº¡i lÆ°u trá»¯
        if (boLoc.loaiLuuTru) {
            ketQua = ketQua.filter(ct => ct.loaiLuuTru === boLoc.loaiLuuTru);
        }

        // Lá»c theo tráº¡ng thÃ¡i
        if (boLoc.trangThai !== undefined) {
            ketQua = ketQua.filter(ct => ct.trangThai === boLoc.trangThai);
        }

        const tongSoBanGhi = ketQua.length;

        // PhÃ¢n trang
        const trang = boLoc.trang || 1;
        const soBanGhi = boLoc.soBanGhi || 25;
        const batDau = (trang - 1) * soBanGhi;
        ketQua = ketQua.slice(batDau, batDau + soBanGhi);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `TÃ¬m tháº¥y ${tongSoBanGhi} chá»‰ tiÃªu`,
            duLieu: ketQua,
            tongSoBanGhi,
        };
    }

    /**
     * Láº¥y cÃ¢y chá»‰ tiÃªu (hierarchical)
     *
     * INPUT: khÃ´ng cÃ³
     * OUTPUT: KetQuaApi<ChiTieuNode[]> â€” cÃ¢y chá»‰ tiÃªu Ä‘Ã£ lá»“ng children
     */
    async layCayChiTieu(): Promise<KetQuaApi<ChiTieuNode[]>> {
        await this.giaLapDelay();

        const cayChiTieu = this.xayDungCay(this.danhSachChiTieu);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Láº¥y cÃ¢y chá»‰ tiÃªu thÃ nh cÃ´ng',
            duLieu: cayChiTieu,
        };
    }

    /**
     * Láº¥y chi tiáº¿t 1 chá»‰ tiÃªu theo ID
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
                thongBao: `KhÃ´ng tÃ¬m tháº¥y chá»‰ tiÃªu cÃ³ ID = ${id}`,
                duLieu: null,
            };
        }

        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Láº¥y chi tiáº¿t thÃ nh cÃ´ng',
            duLieu: { ...chiTieu },
        };
    }

    /**
     * Táº¡o má»›i chá»‰ tiÃªu
     *
     * INPUT: ChiTieuTaoMoi { maChiTieu, tenChiTieu, maChiTieuCha?, loaiLuuTru, ... }
     * OUTPUT: KetQuaApi<ChiTieu> â€” chá»‰ tiÃªu vá»«a táº¡o (cÃ³ id, ngayTao)
     */
    async taoChiTieu(dto: ChiTieuTaoMoi): Promise<KetQuaApi<ChiTieu>> {
        await this.giaLapDelay();

        // Kiá»ƒm tra mÃ£ trÃ¹ng
        const daTonTai = this.danhSachChiTieu.some(ct => ct.maChiTieu === dto.maChiTieu);
        if (daTonTai) {
            return {
                trangThai: false,
                maLoi: 'DUPLICATE_CODE',
                thongBao: `MÃ£ chá»‰ tiÃªu "${dto.maChiTieu}" Ä‘Ã£ tá»“n táº¡i`,
                duLieu: null as any,
            };
        }

        // TÃ­nh cáº¥p Ä‘á»™ tá»« cha
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
            thongBao: `Táº¡o chá»‰ tiÃªu "${dto.tenChiTieu}" thÃ nh cÃ´ng`,
            duLieu: chiTieuMoi,
        };
    }

    /**
     * Cáº­p nháº­t chá»‰ tiÃªu
     *
     * INPUT: ChiTieuCapNhat { id, tenChiTieu?, loaiLuuTru?, ... }
     * OUTPUT: KetQuaApi<ChiTieu> â€” chá»‰ tiÃªu sau khi cáº­p nháº­t
     */
    async capNhatChiTieu(dto: ChiTieuCapNhat): Promise<KetQuaApi<ChiTieu>> {
        await this.giaLapDelay();

        const index = this.danhSachChiTieu.findIndex(ct => ct.id === dto.id);
        if (index === -1) {
            return {
                trangThai: false,
                maLoi: 'NOT_FOUND',
                thongBao: `KhÃ´ng tÃ¬m tháº¥y chá»‰ tiÃªu ID = ${dto.id}`,
                duLieu: null as any,
            };
        }

        // Merge dá»¯ liá»‡u cÅ© + má»›i
        this.danhSachChiTieu[index] = {
            ...this.danhSachChiTieu[index],
            ...dto,
            ngayCapNhat: new Date().toISOString(),
        };

        return {
            trangThai: true,
            maLoi: null,
            thongBao: 'Cáº­p nháº­t chá»‰ tiÃªu thÃ nh cÃ´ng',
            duLieu: { ...this.danhSachChiTieu[index] },
        };
    }

    /**
     * XÃ³a chá»‰ tiÃªu
     *
     * INPUT: id (number)
     * OUTPUT: KetQuaApi<null>
     */
    async xoaChiTieu(id: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();

        // Kiá»ƒm tra cÃ³ con khÃ´ng
        const chiTieu = this.danhSachChiTieu.find(ct => ct.id === id);
        if (!chiTieu) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null };
        }

        const coCon = this.danhSachChiTieu.some(ct => ct.maChiTieuCha === chiTieu.maChiTieu);
        if (coCon) {
            return {
                trangThai: false,
                maLoi: 'HAS_CHILDREN',
                thongBao: `KhÃ´ng thá»ƒ xÃ³a "${chiTieu.tenChiTieu}" vÃ¬ cÃ²n chá»‰ tiÃªu con`,
                duLieu: null,
            };
        }

        this.danhSachChiTieu = this.danhSachChiTieu.filter(ct => ct.id !== id);

        return {
            trangThai: true,
            maLoi: null,
            thongBao: `ÄÃ£ xÃ³a chá»‰ tiÃªu "${chiTieu.tenChiTieu}"`,
            duLieu: null,
        };
    }

    // ============================================
    // HÃ€M TIá»†N ÃCH (PRIVATE)
    // ============================================

    /**
     * XÃ¢y dá»±ng cÃ¢y tá»« danh sÃ¡ch pháº³ng
     * Thuáº­t toÃ¡n: Duyá»‡t qua danh sÃ¡ch, gom con vÃ o cha
     */
    private xayDungCay(danhSach: ChiTieu[]): ChiTieuNode[] {
        const bangChiTieu = new Map<string, ChiTieuNode>();
        const cayGoc: ChiTieuNode[] = [];

        // BÆ°á»›c 1: Táº¡o map mÃ£ -> node
        for (const ct of danhSach) {
            bangChiTieu.set(ct.maChiTieu, { ...ct, children: [], expanded: true });
        }

        // BÆ°á»›c 2: Gáº¯n con vÃ o cha
        for (const ct of danhSach) {
            const node = bangChiTieu.get(ct.maChiTieu)!;
            if (ct.maChiTieuCha && bangChiTieu.has(ct.maChiTieuCha)) {
                bangChiTieu.get(ct.maChiTieuCha)!.children!.push(node);
            } else {
                cayGoc.push(node);
            }
        }

        // BÆ°á»›c 3: Sáº¯p xáº¿p theo thuTu
        const sapXep = (nodes: ChiTieuNode[]) => {
            nodes.sort((a, b) => a.thuTu - b.thuTu);
            nodes.forEach(n => { if (n.children?.length) sapXep(n.children); });
        };
        sapXep(cayGoc);

        return cayGoc;
    }

    /**
     * Giáº£ láº­p network delay (300-800ms)
     * GiÃºp FE test loading state, spinner, skeleton...
     */
    private giaLapDelay(): Promise<void> {
        const ms = 300 + Math.random() * 500;
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Khá»Ÿi táº¡o dá»¯ liá»‡u mock tá»« JSON files
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

            // Táº¡o mock há»“ sÆ¡ workflow tá»« dá»¯ liá»‡u Ä‘Æ¡n vá»‹ + biá»ƒu máº«u
            this.khoiTaoHoSo();
            
            // Táº¡o mock users vÃ  roles cho system admin
            this.khoiTaoAdmin();
        } catch (err) {
            console.warn('[MockApi] KhÃ´ng load Ä‘Æ°á»£c mock data, dÃ¹ng máº£ng rá»—ng');
        }
    }

    /** Táº¡o dá»¯ liá»‡u mock há»“ sÆ¡ workflow */
    private khoiTaoHoSo(): void {
        const trangThais: TrangThaiHoSo[] = ['da_duyet', 'cho_duyet', 'nhap', 'tu_choi', 'tra_lai', 'da_duyet', 'cho_duyet', 'da_duyet'];
        const nguoiTaos = ['Nguyá»…n VÄƒn A', 'Tráº§n Thá»‹ B', 'LÃª VÄƒn C', 'Pháº¡m Thá»‹ D', 'HoÃ ng VÄƒn E'];
        const nguoiDuyets = ['GiÃ¡m Ä‘á»‘c ToÃ n', 'PGÄ Káº¿ hoáº¡ch HÆ°Æ¡ng', 'TrÆ°á»Ÿng phÃ²ng KHTC Minh'];

        let id = 1;
        const dvs = this.danhSachDonVi.slice(0, 6);
        const bms = this.danhSachBieuMau;
        for (let i = 0; i < dvs.length; i++) {
            for (let j = 0; j < Math.min(bms.length, 2); j++) {
                const tt = trangThais[(i * 2 + j) % trangThais.length];
                const hoSo: HoSoNop = {
                    id: id,
                    maHoSo: `KHTC.2026.${String(id).padStart(3, '0')}`,
                    tieuDe: `${bms[j].formName} â€” ${dvs[i].tenDonVi}`,
                    maDonVi: dvs[i].maDonVi,
                    tenDonVi: dvs[i].tenDonVi,
                    maPhienBan: 'PLAN_2026_V1',
                    maBieuMau: bms[j].formId,
                    trangThai: tt,
                    nguoiTao: nguoiTaos[i % nguoiTaos.length],
                    ngayTao: new Date(2026, 2, 15 - id).toISOString(),
                    nguoiDuyet: tt === 'da_duyet' || tt === 'tu_choi' ? nguoiDuyets[j % nguoiDuyets.length] : undefined,
                    ngayDuyet: tt === 'da_duyet' || tt === 'tu_choi' ? new Date(2026, 2, 16 - id).toISOString() : undefined,
                };
                this.danhSachHoSo.push(hoSo);
                id++;
            }
        }
    }

    /** Táº¡o dá»¯ liá»‡u mock users vÃ  roles */
    private khoiTaoAdmin(): void {
        // Khá»Ÿi táº¡o menu system
        this.danhSachMenus = [
            { menuId: 1, menuName: 'Dashboard', parentId: null, url: '/dashboard', formId: null, icon: 'pi-home', sortOrder: 1 },
            { menuId: 2, menuName: 'Dá»¯ liá»‡u Ä‘áº§u vÃ o', parentId: null, url: '/data-entry', formId: null, icon: 'pi-table', sortOrder: 2 },
            { menuId: 3, menuName: 'Metadata', parentId: null, url: '/metadata', formId: null, icon: 'pi-cog', sortOrder: 3 },
            { menuId: 4, menuName: 'Form Designer', parentId: null, url: '/form-designer', formId: null, icon: 'pi-pencil', sortOrder: 4 },
            { menuId: 5, menuName: 'Analytics', parentId: null, url: '/analytics', formId: null, icon: 'pi-chart-bar', sortOrder: 5 },
            { menuId: 6, menuName: 'Workflow', parentId: null, url: '/workflow', formId: null, icon: 'pi-send', sortOrder: 6 },
            { menuId: 7, menuName: 'System Admin', parentId: null, url: '/system-admin', formId: null, icon: 'pi-users', sortOrder: 7 },
        ];

        // Khá»Ÿi táº¡o roles vá»›i permissions
        this.danhSachRoles = [
            {
                roleId: 1, roleName: 'Super Admin', description: 'ToÃ n quyá»n há»‡ thá»‘ng',
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
                roleId: 2, roleName: 'GiÃ¡m Ä‘á»‘c', description: 'PhÃª duyá»‡t bÃ¡o cÃ¡o, xem thá»‘ng kÃª',
                permissions: [
                    { roleId: 2, menuId: 1, canRead: true, canWrite: false, canApprove: true },
                    { roleId: 2, menuId: 2, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 2, menuId: 5, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 2, menuId: 6, canRead: true, canWrite: false, canApprove: true },
                ],
                userCount: 2, createdDate: new Date('2026-01-15'), createdBy: 'admin', isSystemRole: false
            },
            {
                roleId: 3, roleName: 'Káº¿ toÃ¡n trÆ°á»Ÿng', description: 'Quáº£n lÃ½ dá»¯ liá»‡u káº¿ toÃ¡n, bÃ¡o cÃ¡o',
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
                roleId: 4, roleName: 'NhÃ¢n viÃªn', description: 'Nháº­p liá»‡u, xem bÃ¡o cÃ¡o cÆ¡ báº£n',
                permissions: [
                    { roleId: 4, menuId: 1, canRead: true, canWrite: false, canApprove: false },
                    { roleId: 4, menuId: 2, canRead: true, canWrite: true, canApprove: false },
                    { roleId: 4, menuId: 6, canRead: true, canWrite: true, canApprove: false },
                ],
                userCount: 8, createdDate: new Date('2026-02-01'), createdBy: 'admin', isSystemRole: false
            }
        ];

        // Khá»Ÿi táº¡o users
        this.danhSachUsers = [
            {
                userId: 1, username: 'admin', fullName: 'Administrator', email: 'admin@evn.com',
                entityCode: 'EVN', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 1, roleName: 'Super Admin' }],
                createdDate: new Date('2026-01-01'), createdBy: 'System', 
                lastLoginDate: new Date('2026-03-11'),
                notes: 'TÃ i khoáº£n quáº£n trá»‹ há»‡ thá»‘ng'
            },
            {
                userId: 2, username: 'giamdoc', fullName: 'Nguyá»…n VÄƒn ToÃ n', email: 'toan.gd@evn.com', phoneNumber: '024-3826-1234',
                entityCode: 'EVN', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 2, roleName: 'GiÃ¡m Ä‘á»‘c' }],
                createdDate: new Date('2026-01-15'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-10'),
                notes: 'GiÃ¡m Ä‘á»‘c EVN'
            },
            {
                userId: 3, username: 'pgd.kehoach', fullName: 'Tráº§n Thá»‹ HÆ°Æ¡ng', email: 'huong.pgd@evn.com', phoneNumber: '024-3826-1235',
                entityCode: 'EVN', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 2, roleName: 'GiÃ¡m Ä‘á»‘c' }],
                createdDate: new Date('2026-01-16'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-09'),
                notes: 'PhÃ³ GiÃ¡m Ä‘á»‘c phá»¥ trÃ¡ch Káº¿ hoáº¡ch'
            },
            {
                userId: 4, username: 'truong.khtc', fullName: 'LÃª VÄƒn Minh', email: 'minh.tp@evn.com', phoneNumber: '024-3826-1236',
                entityCode: 'EVN_D01', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 3, roleName: 'Káº¿ toÃ¡n trÆ°á»Ÿng' }],
                createdDate: new Date('2026-01-20'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-11'),
                notes: 'TrÆ°á»Ÿng phÃ²ng KHTC'
            },
            {
                userId: 5, username: 'nv.ketoan1', fullName: 'Pháº¡m Thá»‹ Lan', email: 'lan.pham@evn.com', 
                entityCode: 'EVN_D01', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 4, roleName: 'NhÃ¢n viÃªn' }],
                createdDate: new Date('2026-02-01'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-08')
            },
            {
                userId: 6, username: 'nv.ketoan2', fullName: 'HoÃ ng VÄƒn Nam', email: 'nam.hoang@evn.com',
                entityCode: 'EVN_D02', isActive: true, isLocked: false, failedLoginCount: 0,
                roles: [{ roleId: 4, roleName: 'NhÃ¢n viÃªn' }],
                createdDate: new Date('2026-02-15'), createdBy: 'admin',
                lastLoginDate: new Date('2026-03-07')
            },
            {
                userId: 7, username: 'test.user', fullName: 'Test User', email: 'test@evn.com',
                entityCode: 'EVN_D03', isActive: false, isLocked: true, failedLoginCount: 5,
                roles: [{ roleId: 4, roleName: 'NhÃ¢n viÃªn' }],
                createdDate: new Date('2026-02-20'), createdBy: 'admin',
                lastLoginDate: null,
                notes: 'TÃ i khoáº£n test - Ä‘Ã£ khÃ³a do nháº­p sai máº­t kháº©u'
            }
        ];
    }

    // ============================================
    // ÄÆ N Vá»Š (ENTITY) â€” CRUD
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

        return { trangThai: true, maLoi: null, thongBao: `TÃ¬m tháº¥y ${kq.length} Ä‘Æ¡n vá»‹`, duLieu: kq };
    }

    async taoDonVi(dto: DonViTaoMoi): Promise<KetQuaApi<DonVi>> {
        await this.giaLapDelay();
        if (this.danhSachDonVi.some(d => d.maDonVi === dto.maDonVi)) {
            return { trangThai: false, maLoi: 'DUPLICATE_CODE', thongBao: `MÃ£ "${dto.maDonVi}" Ä‘Ã£ tá»“n táº¡i`, duLieu: null as any };
        }
        const donViMoi: DonVi = {
            id: this.nextId++, trangThai: true,
            ngayTao: new Date().toISOString(), ngayCapNhat: new Date().toISOString(),
            ...dto,
        };
        this.danhSachDonVi.push(donViMoi);
        return { trangThai: true, maLoi: null, thongBao: `Táº¡o Ä‘Æ¡n vá»‹ "${dto.tenDonVi}" thÃ nh cÃ´ng`, duLieu: donViMoi };
    }

    async capNhatDonVi(id: number, dto: Partial<DonViTaoMoi>): Promise<KetQuaApi<DonVi>> {
        await this.giaLapDelay();
        const idx = this.danhSachDonVi.findIndex(d => d.id === id);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n vá»‹', duLieu: null as any };
        }
        this.danhSachDonVi[idx] = { ...this.danhSachDonVi[idx], ...dto, ngayCapNhat: new Date().toISOString() };
        return { trangThai: true, maLoi: null, thongBao: 'Cáº­p nháº­t Ä‘Æ¡n vá»‹ thÃ nh cÃ´ng', duLieu: { ...this.danhSachDonVi[idx] } };
    }

    async xoaDonVi(id: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const dv = this.danhSachDonVi.find(d => d.id === id);
        if (!dv) return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null };

        const coCon = this.danhSachDonVi.some(d => d.maDonViCha === dv.maDonVi);
        if (coCon) {
            return { trangThai: false, maLoi: 'HAS_CHILDREN', thongBao: `KhÃ´ng thá»ƒ xÃ³a "${dv.tenVietTat}" vÃ¬ cÃ²n Ä‘Æ¡n vá»‹ con`, duLieu: null };
        }
        this.danhSachDonVi = this.danhSachDonVi.filter(d => d.id !== id);
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ xÃ³a "${dv.tenVietTat}"`, duLieu: null };
    }

    // ============================================
    // PHIÃŠN Báº¢N (VERSION) â€” CRUD
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

        return { trangThai: true, maLoi: null, thongBao: `TÃ¬m tháº¥y ${kq.length} phiÃªn báº£n`, duLieu: kq };
    }

    async taoPhienBan(dto: PhienBanTaoMoi): Promise<KetQuaApi<PhienBan>> {
        await this.giaLapDelay();
        if (this.danhSachPhienBan.some(d => d.maPhienBan === dto.maPhienBan)) {
            return { trangThai: false, maLoi: 'DUPLICATE_CODE', thongBao: `MÃ£ "${dto.maPhienBan}" Ä‘Ã£ tá»“n táº¡i`, duLieu: null as any };
        }
        const phienBanMoi: PhienBan = {
            id: this.nextId++, trangThai: true, laPhienBanMacDinh: false,
            ngayTao: new Date().toISOString(), ngayCapNhat: new Date().toISOString(),
            ...dto,
        };
        this.danhSachPhienBan.push(phienBanMoi);
        return { trangThai: true, maLoi: null, thongBao: `Táº¡o phiÃªn báº£n "${dto.tenPhienBan}" thÃ nh cÃ´ng`, duLieu: phienBanMoi };
    }

    async capNhatPhienBan(id: number, dto: Partial<PhienBanTaoMoi>): Promise<KetQuaApi<PhienBan>> {
        await this.giaLapDelay();
        const idx = this.danhSachPhienBan.findIndex(d => d.id === id);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y phiÃªn báº£n', duLieu: null as any };
        }
        this.danhSachPhienBan[idx] = { ...this.danhSachPhienBan[idx], ...dto, ngayCapNhat: new Date().toISOString() };
        return { trangThai: true, maLoi: null, thongBao: 'Cáº­p nháº­t phiÃªn báº£n thÃ nh cÃ´ng', duLieu: { ...this.danhSachPhienBan[idx] } };
    }

    async khoaMoPhienBan(id: number): Promise<KetQuaApi<PhienBan>> {
        await this.giaLapDelay();
        const idx = this.danhSachPhienBan.findIndex(d => d.id === id);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null as any };
        }
        this.danhSachPhienBan[idx].trangThai = !this.danhSachPhienBan[idx].trangThai;
        const label = this.danhSachPhienBan[idx].trangThai ? 'ÄÃ£ má»Ÿ khÃ³a' : 'ÄÃ£ khÃ³a';
        return { trangThai: true, maLoi: null, thongBao: `${label} "${this.danhSachPhienBan[idx].tenPhienBan}"`, duLieu: { ...this.danhSachPhienBan[idx] } };
    }

    async xoaPhienBan(id: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const pb = this.danhSachPhienBan.find(d => d.id === id);
        if (!pb) return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null };
        this.danhSachPhienBan = this.danhSachPhienBan.filter(d => d.id !== id);
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ xÃ³a "${pb.tenPhienBan}"`, duLieu: null };
    }

    // ============================================
    // BIá»‚U MáºªU (FORM TEMPLATE) â€” CRUD
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

        return { trangThai: true, maLoi: null, thongBao: `TÃ¬m tháº¥y ${kq.length} biá»ƒu máº«u`, duLieu: kq };
    }

    async layBieuMauTheoId(formId: string): Promise<KetQuaApi<FormTemplate | null>> {
        await this.giaLapDelay();
        const bm = this.danhSachBieuMau.find(b => b.formId === formId);
        if (!bm) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: `KhÃ´ng tÃ¬m tháº¥y biá»ƒu máº«u "${formId}"`, duLieu: null };
        }
        return { trangThai: true, maLoi: null, thongBao: 'OK', duLieu: { ...bm } };
    }

    async taoBieuMau(dto: FormTemplateTaoMoi): Promise<KetQuaApi<FormTemplate>> {
        await this.giaLapDelay();
        if (this.danhSachBieuMau.some(b => b.formId === dto.formId)) {
            return { trangThai: false, maLoi: 'DUPLICATE_CODE', thongBao: `MÃ£ "${dto.formId}" Ä‘Ã£ tá»“n táº¡i`, duLieu: null as any };
        }
        const bieuMauMoi: FormTemplate = {
            ...dto,
            ngayTao: new Date().toISOString(),
            ngayCapNhat: new Date().toISOString(),
        };
        this.danhSachBieuMau.push(bieuMauMoi);
        return { trangThai: true, maLoi: null, thongBao: `Táº¡o biá»ƒu máº«u "${dto.formName}" thÃ nh cÃ´ng`, duLieu: bieuMauMoi };
    }

    async capNhatBieuMau(formId: string, dto: Partial<FormTemplateTaoMoi>): Promise<KetQuaApi<FormTemplate>> {
        await this.giaLapDelay();
        const idx = this.danhSachBieuMau.findIndex(b => b.formId === formId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y biá»ƒu máº«u', duLieu: null as any };
        }
        this.danhSachBieuMau[idx] = { ...this.danhSachBieuMau[idx], ...dto, ngayCapNhat: new Date().toISOString() };
        return { trangThai: true, maLoi: null, thongBao: 'Cáº­p nháº­t biá»ƒu máº«u thÃ nh cÃ´ng', duLieu: { ...this.danhSachBieuMau[idx] } };
    }

    async xoaBieuMau(formId: string): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const bm = this.danhSachBieuMau.find(b => b.formId === formId);
        if (!bm) return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null };
        this.danhSachBieuMau = this.danhSachBieuMau.filter(b => b.formId !== formId);
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ xÃ³a "${bm.formName}"`, duLieu: null };
    }

    async layCauHinhCot(formId: string): Promise<KetQuaApi<ColumnDefinition[]>> {
        await this.giaLapDelay();
        const cols = this.cauHinhCot[formId] || [];
        return { trangThai: true, maLoi: null, thongBao: `${cols.length} cá»™t`, duLieu: cols };
    }

    // ============================================
    // TEMPLATE LAYOUT STORE (Form Designer â†’ Save/Load)
    // ============================================
    // In-memory map: formId â†’ full ExportedTemplate JSON (mock DB)

    private templateLayoutStore = new Map<string, any>();

    async luuTemplateLayout(data: any): Promise<KetQuaApi<any>> {
        await this.giaLapDelay();
        const formId = data?.formId;
        if (!formId) {
            return { trangThai: false, maLoi: 'MISSING_FORM_ID', thongBao: 'formId is required', duLieu: null };
        }
        this.templateLayoutStore.set(formId, JSON.parse(JSON.stringify(data)));
        console.log(`[MockApi] ðŸ’¾ ÄÃ£ lÆ°u template layout "${formId}" vÃ o memory store`);
        return {
            trangThai: true,
            maLoi: null,
            thongBao: `ÄÃ£ lÆ°u biá»ƒu máº«u "${data.formName || formId}" thÃ nh cÃ´ng`,
            duLieu: data,
        };
    }

    async layTemplateLayout(formId: string): Promise<KetQuaApi<any>> {
        await this.giaLapDelay();
        const stored = this.templateLayoutStore.get(formId);
        if (!stored) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: `KhÃ´ng tÃ¬m tháº¥y layout cho "${formId}"`, duLieu: null };
        }
        console.log(`[MockApi] ðŸ“¥ Load template layout "${formId}" tá»« memory store`);
        return { trangThai: true, maLoi: null, thongBao: 'OK', duLieu: JSON.parse(JSON.stringify(stored)) };
    }

    // ============================================
    // DANH Má»¤C MÃƒ CHá»ˆ TIÃŠU (INDICATOR CODES)
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
            thongBao: 'Láº¥y danh má»¥c mÃ£ chá»‰ tiÃªu thÃ nh cÃ´ng',
            duLieu: this.danhMucMaChiTieuCache,
        };
    }

    // ============================================
    // DASHBOARD â€” Thá»‘ng kÃª tá»•ng há»£p
    // ============================================

    async layThongKeDashboard(): Promise<KetQuaApi<ThongKeDashboard>> {
        await this.giaLapDelay();

        const hoSos = this.danhSachHoSo;
        const daDuyet = hoSos.filter(h => h.trangThai === 'da_duyet').length;
        const choDuyet = hoSos.filter(h => h.trangThai === 'cho_duyet').length;
        const tuChoi = hoSos.filter(h => h.trangThai === 'tu_choi').length;

        // Tiáº¿n Ä‘á»™ theo Ä‘Æ¡n vá»‹
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
    // WORKFLOW â€” Há»“ sÆ¡ & PhÃª duyá»‡t
    // ============================================

    async layDanhSachHoSo(boLoc: { tuKhoa?: string; trangThai?: TrangThaiHoSo; maDonVi?: string } = {}): Promise<KetQuaApi<HoSoNop[]>> {
        await this.giaLapDelay();
        let kq = [...this.danhSachHoSo];

        if (boLoc.tuKhoa) {
            const tk = boLoc.tuKhoa.toLowerCase();
            kq = kq.filter(h =>
                h.maHoSo.toLowerCase().includes(tk) ||
                h.tieuDe.toLowerCase().includes(tk) ||
                h.tenDonVi.toLowerCase().includes(tk)
            );
        }
        if (boLoc.trangThai) {
            kq = kq.filter(h => h.trangThai === boLoc.trangThai);
        }
        if (boLoc.maDonVi) {
            kq = kq.filter(h => h.maDonVi === boLoc.maDonVi);
        }

        return { trangThai: true, maLoi: null, thongBao: `${kq.length} há»“ sÆ¡`, duLieu: kq };
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
        return { trangThai: true, maLoi: null, thongBao: `${items.length} há»“ sÆ¡ chá» duyá»‡t`, duLieu: items };
    }

    async xuLyPheDuyet(dto: PheDuyetDto): Promise<KetQuaApi<HoSoNop>> {
        await this.giaLapDelay();
        const idx = this.danhSachHoSo.findIndex(h => h.id === dto.hoSoId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡', duLieu: null as any };
        }

        const mapTrangThai: Record<string, TrangThaiHoSo> = {
            duyet: 'da_duyet',
            tu_choi: 'tu_choi',
            tra_lai: 'tra_lai',
        };
        this.danhSachHoSo[idx].trangThai = mapTrangThai[dto.hanhDong] || 'cho_duyet';
        this.danhSachHoSo[idx].nguoiDuyet = 'GiÃ¡m Ä‘á»‘c ToÃ n';
        this.danhSachHoSo[idx].ngayDuyet = new Date().toISOString();
        if (dto.ghiChu) this.danhSachHoSo[idx].ghiChu = dto.ghiChu;

        const labels: Record<string, string> = { duyet: 'ÄÃ£ duyá»‡t', tu_choi: 'ÄÃ£ tá»« chá»‘i', tra_lai: 'ÄÃ£ tráº£ láº¡i' };
        return {
            trangThai: true, maLoi: null,
            thongBao: `${labels[dto.hanhDong]} há»“ sÆ¡ "${this.danhSachHoSo[idx].maHoSo}"`,
            duLieu: { ...this.danhSachHoSo[idx] },
        };
    }

    async nopHoSo(hoSoId: number): Promise<KetQuaApi<HoSoNop>> {
        await this.giaLapDelay();
        const idx = this.danhSachHoSo.findIndex(h => h.id === hoSoId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null as any };
        }
        this.danhSachHoSo[idx].trangThai = 'cho_duyet';
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ ná»™p "${this.danhSachHoSo[idx].maHoSo}"`, duLieu: { ...this.danhSachHoSo[idx] } };
    }

    async rutHoSo(hoSoId: number): Promise<KetQuaApi<HoSoNop>> {
        await this.giaLapDelay();
        const idx = this.danhSachHoSo.findIndex(h => h.id === hoSoId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y', duLieu: null as any };
        }
        this.danhSachHoSo[idx].trangThai = 'nhap';
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ rÃºt "${this.danhSachHoSo[idx].maHoSo}"`, duLieu: { ...this.danhSachHoSo[idx] } };
    }

    // ============================================
    // SYSTEM ADMIN â€” USER MANAGEMENT
    // ============================================

    /** Láº¥y danh sÃ¡ch users vá»›i filter */
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
            thongBao: `TÃ¬m tháº¥y ${ketQua.length} ngÆ°á»i dÃ¹ng`,
            duLieu: ketQua,
            tongSoBanGhi: ketQua.length
        };
    }

    /** Láº¥y chi tiáº¿t user */
    async layChiTietUser(userId: number): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();
        const user = this.danhSachUsers.find(u => u.userId === userId);
        if (!user) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng', duLieu: null as any };
        }
        return { trangThai: true, maLoi: null, thongBao: 'ThÃ nh cÃ´ng', duLieu: user };
    }

    /** Táº¡o user má»›i */
    async taoUser(dto: UserCreateDto): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();

        // Kiá»ƒm tra username trÃ¹ng
        if (this.danhSachUsers.find(u => u.username === dto.username)) {
            return { trangThai: false, maLoi: 'DUPLICATE', thongBao: 'Username Ä‘Ã£ tá»“n táº¡i', duLieu: null as any };
        }

        // Láº¥y role names
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
            createdBy: 'admin', // TODO: láº¥y tá»« session
            lastLoginDate: null,
            notes: dto.notes
        };

        this.danhSachUsers.push(newUser);

        // Cáº­p nháº­t userCount trong roles
        dto.roleIds.forEach(roleId => {
            const role = this.danhSachRoles.find(r => r.roleId === roleId);
            if (role) role.userCount++;
        });

        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ táº¡o ngÆ°á»i dÃ¹ng "${dto.username}"`, duLieu: newUser };
    }

    /** Cáº­p nháº­t user */
    async capNhatUser(dto: UserUpdateDto): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === dto.userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng', duLieu: null as any };
        }

        const user = this.danhSachUsers[idx];
        const oldRoleIds = user.roles.map(r => r.roleId);

        // Cáº­p nháº­t thÃ´ng tin
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

        // Cáº­p nháº­t userCount trong roles
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

        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ cáº­p nháº­t "${user.username}"`, duLieu: this.danhSachUsers[idx] };
    }

    /** XÃ³a user */
    async xoaUser(userId: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng', duLieu: null };
        }

        const user = this.danhSachUsers[idx];
        
        // Cáº­p nháº­t userCount trong roles
        user.roles.forEach(role => {
            const r = this.danhSachRoles.find(r => r.roleId === role.roleId);
            if (r && r.userCount > 0) r.userCount--;
        });

        this.danhSachUsers.splice(idx, 1);
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ xÃ³a "${user.username}"`, duLieu: null };
    }

    /** Reset máº­t kháº©u */
    async resetPassword(dto: PasswordResetDto): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === dto.userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng', duLieu: null };
        }

        // Reset password (trong thá»±c táº¿ sáº½ hash password)
        this.danhSachUsers[idx].failedLoginCount = 0;
        this.danhSachUsers[idx].isLocked = false;

        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ reset máº­t kháº©u cho "${this.danhSachUsers[idx].username}"`, duLieu: null };
    }

    /** KhÃ³a/má»Ÿ khÃ³a user */
    async toggleLockUser(userId: number): Promise<KetQuaApi<UserAdmin>> {
        await this.giaLapDelay();
        const idx = this.danhSachUsers.findIndex(u => u.userId === userId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng', duLieu: null as any };
        }

        this.danhSachUsers[idx].isLocked = !this.danhSachUsers[idx].isLocked;
        if (this.danhSachUsers[idx].isLocked) {
            this.danhSachUsers[idx].failedLoginCount = 5; // Simulate locked due to failed attempts
        } else {
            this.danhSachUsers[idx].failedLoginCount = 0;
        }

        const action = this.danhSachUsers[idx].isLocked ? 'khÃ³a' : 'má»Ÿ khÃ³a';
        return { 
            trangThai: true, 
            maLoi: null, 
            thongBao: `ÄÃ£ ${action} "${this.danhSachUsers[idx].username}"`, 
            duLieu: this.danhSachUsers[idx] 
        };
    }

    // ============================================
    // SYSTEM ADMIN â€” ROLE MANAGEMENT
    // ============================================

    /** Láº¥y danh sÃ¡ch roles vá»›i filter */
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
            thongBao: `TÃ¬m tháº¥y ${ketQua.length} vai trÃ²`,
            duLieu: ketQua,
            tongSoBanGhi: ketQua.length
        };
    }

    /** Láº¥y chi tiáº¿t role */
    async layChiTietRole(roleId: number): Promise<KetQuaApi<RoleAdmin>> {
        await this.giaLapDelay();
        const role = this.danhSachRoles.find(r => r.roleId === roleId);
        if (!role) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y vai trÃ²', duLieu: null as any };
        }
        return { trangThai: true, maLoi: null, thongBao: 'ThÃ nh cÃ´ng', duLieu: role };
    }

    /** Táº¡o role má»›i */
    async taoRole(dto: RoleCreateDto): Promise<KetQuaApi<RoleAdmin>> {
        await this.giaLapDelay();

        // Kiá»ƒm tra role name trÃ¹ng
        if (this.danhSachRoles.find(r => r.roleName === dto.roleName)) {
            return { trangThai: false, maLoi: 'DUPLICATE', thongBao: 'TÃªn vai trÃ² Ä‘Ã£ tá»“n táº¡i', duLieu: null as any };
        }

        const newRole: RoleAdmin = {
            roleId: this.nextId++,
            roleName: dto.roleName,
            description: dto.description,
            permissions: dto.permissions.map(p => ({ ...p, roleId: this.nextId - 1 })),
            userCount: 0,
            createdDate: new Date(),
            createdBy: 'admin', // TODO: láº¥y tá»« session
            isSystemRole: false
        };

        this.danhSachRoles.push(newRole);
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ táº¡o vai trÃ² "${dto.roleName}"`, duLieu: newRole };
    }

    /** Cáº­p nháº­t role */
    async capNhatRole(dto: RoleUpdateDto): Promise<KetQuaApi<RoleAdmin>> {
        await this.giaLapDelay();
        const idx = this.danhSachRoles.findIndex(r => r.roleId === dto.roleId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y vai trÃ²', duLieu: null as any };
        }

        const role = this.danhSachRoles[idx];
        if (role.isSystemRole) {
            return { trangThai: false, maLoi: 'SYSTEM_ROLE', thongBao: 'KhÃ´ng thá»ƒ sá»­a vai trÃ² há»‡ thá»‘ng', duLieu: null as any };
        }

        this.danhSachRoles[idx] = {
            ...role,
            roleName: dto.roleName,
            description: dto.description,
            permissions: dto.permissions.map(p => ({ ...p, roleId: dto.roleId }))
        };

        // Cáº­p nháº­t role name trong users
        this.danhSachUsers.forEach(user => {
            const userRole = user.roles.find(r => r.roleId === dto.roleId);
            if (userRole) {
                userRole.roleName = dto.roleName;
            }
        });

        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ cáº­p nháº­t vai trÃ² "${dto.roleName}"`, duLieu: this.danhSachRoles[idx] };
    }

    /** XÃ³a role */
    async xoaRole(roleId: number): Promise<KetQuaApi<null>> {
        await this.giaLapDelay();
        const idx = this.danhSachRoles.findIndex(r => r.roleId === roleId);
        if (idx === -1) {
            return { trangThai: false, maLoi: 'NOT_FOUND', thongBao: 'KhÃ´ng tÃ¬m tháº¥y vai trÃ²', duLieu: null };
        }

        const role = this.danhSachRoles[idx];
        if (role.isSystemRole) {
            return { trangThai: false, maLoi: 'SYSTEM_ROLE', thongBao: 'KhÃ´ng thá»ƒ xÃ³a vai trÃ² há»‡ thá»‘ng', duLieu: null };
        }

        if (role.userCount > 0) {
            return { trangThai: false, maLoi: 'ROLE_IN_USE', thongBao: `Vai trÃ² Ä‘ang Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ${role.userCount} ngÆ°á»i dÃ¹ng`, duLieu: null };
        }

        this.danhSachRoles.splice(idx, 1);
        return { trangThai: true, maLoi: null, thongBao: `ÄÃ£ xÃ³a vai trÃ² "${role.roleName}"`, duLieu: null };
    }

    /** Láº¥y danh sÃ¡ch menus cho phÃ¢n quyá»n */
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
