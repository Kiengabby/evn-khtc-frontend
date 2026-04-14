// ============================================
// Cấu hình Loại biểu mẫu và Kỳ báo cáo
// ============================================
// Mã loại form và mã kỳ báo cáo khớp với danh mục BE:
//   Loại: MONTH | QUATER | YEAR
//   Kỳ:   01..12 (tháng) | Q1..Q4 (quý) | 00 (năm)
// ============================================

export interface FormTypeConfig {
    /** Mã loại biểu mẫu gửi lên BE: MONTH | QUATER | YEAR */
    code: string;
    /** Tên hiển thị */
    label: string;
    /** Mô tả ngắn */
    description: string;
    /** Icon PrimeIcons */
    icon: string;
    /** Danh sách kỳ báo cáo tương ứng */
    periods: ReportPeriodItem[];
}

export interface ReportPeriodItem {
    /** Mã kỳ gửi lên BE (khớp danh mục: 01-12, Q1-Q4, 00) */
    value: string;
    /** Nhãn hiển thị */
    label: string;
    /** Nhóm hiển thị (tuỳ chọn) */
    group?: string;
}

// ============================================
// Định nghĩa các loại biểu mẫu
// Mã loại: MONTH | QUATER | YEAR  (khớp danh mục BE)
// ============================================
export const FORM_TYPE_CONFIG: FormTypeConfig[] = [
    {
        code: 'MONTH',
        label: 'Tháng',
        description: 'Báo cáo theo từng tháng trong năm (12 kỳ)',
        icon: 'pi-calendar',
        periods: [
            { value: '01', label: 'Tháng 01', group: 'Quý 1' },
            { value: '02', label: 'Tháng 02', group: 'Quý 1' },
            { value: '03', label: 'Tháng 03', group: 'Quý 1' },
            { value: '04', label: 'Tháng 04', group: 'Quý 2' },
            { value: '05', label: 'Tháng 05', group: 'Quý 2' },
            { value: '06', label: 'Tháng 06', group: 'Quý 2' },
            { value: '07', label: 'Tháng 07', group: 'Quý 3' },
            { value: '08', label: 'Tháng 08', group: 'Quý 3' },
            { value: '09', label: 'Tháng 09', group: 'Quý 3' },
            { value: '10', label: 'Tháng 10', group: 'Quý 4' },
            { value: '11', label: 'Tháng 11', group: 'Quý 4' },
            { value: '12', label: 'Tháng 12', group: 'Quý 4' },
        ],
    },
    {
        code: 'QUATER',
        label: 'Quý',
        description: 'Báo cáo theo từng quý trong năm (4 kỳ)',
        icon: 'pi-chart-bar',
        periods: [
            { value: 'Q1', label: 'Quý 1' },
            { value: 'Q2', label: 'Quý 2' },
            { value: 'Q3', label: 'Quý 3' },
            { value: 'Q4', label: 'Quý 4' },
        ],
    },
    {
        code: 'YEAR',
        label: 'Năm',
        description: 'Báo cáo tổng kết cả năm (1 kỳ)',
        icon: 'pi-calendar-times',
        periods: [
            { value: '00', label: 'Năm' },
        ],
    },
];

/** Lấy config theo mã loại biểu mẫu */
export function getFormTypeConfig(code: string): FormTypeConfig | undefined {
    return FORM_TYPE_CONFIG.find(ft => ft.code === code);
}

/** Lấy danh sách kỳ theo mã loại biểu mẫu */
export function getPeriodsForFormType(code: string): ReportPeriodItem[] {
    return getFormTypeConfig(code)?.periods ?? [];
}
