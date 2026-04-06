// ============================================
// Error Interceptor — Global error handling
// ============================================
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../apps/service/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const notification = inject(NotificationService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            let errorMessage = 'Đã xảy ra lỗi không xác định';

            switch (error.status) {
                case 0:
                    errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
                    break;
                case 401:
                    errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
                    router.navigate(['/login']);
                    break;
                case 403:
                    errorMessage = 'Bạn không có quyền thực hiện thao tác này.';
                    break;
                case 404:
                    errorMessage = 'Không tìm thấy tài nguyên yêu cầu.';
                    break;
                case 409:
                    errorMessage = 'Dữ liệu bị xung đột. Vui lòng tải lại trang.';
                    break;
                case 422:
                    errorMessage = error.error?.message || 'Dữ liệu không hợp lệ.';
                    break;
                case 500:
                    errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
                    break;
            }

            notification.showError(errorMessage);
            return throwError(() => error);
        })
    );
};
