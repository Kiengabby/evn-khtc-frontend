/**
 * FormattedNumericEditor - Custom Handsontable Editor
 * 
 * Tính năng:
 * - Chỉ cho phép nhập số, dấu âm (-), dấu thập phân (.)
 * - Tự động format số với dấu phân cách hàng nghìn khi đang nhập
 * - Hỗ trợ paste số từ clipboard
 */

import Handsontable from 'handsontable';

// Get the TextEditor class from Handsontable
const TextEditor = Handsontable.editors.TextEditor;

export class FormattedNumericEditor extends TextEditor {
  /**
   * Tạo input element
   */
  override createElements(): void {
    super.createElements();
    
    // Add CSS class for styling
    if (this.TEXTAREA) {
      (this.TEXTAREA as HTMLTextAreaElement).classList.add('formatted-numeric-input');
      (this.TEXTAREA as HTMLTextAreaElement).style.textAlign = 'right';
      (this.TEXTAREA as any).inputMode = 'decimal'; // Mobile keyboard hint
    }
  }

  /**
   * Chuẩn bị editor khi mở
   */
  override prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: any, cellProperties: Handsontable.CellProperties): void {
    super.prepare(row, col, prop, td, originalValue, cellProperties);
    
    // Bind event handlers
    this.bindInputEvents();
  }

  /**
   * Bind các event handlers cho input
   */
  private bindInputEvents(): void {
    if (!this.TEXTAREA) return;
    
    const textarea = this.TEXTAREA as HTMLTextAreaElement;

    // Remove existing listeners to prevent duplicates
    textarea.removeEventListener('keydown', this.handleKeyDown);
    textarea.removeEventListener('input', this.handleInput);
    textarea.removeEventListener('paste', this.handlePaste);

    // Add listeners
    textarea.addEventListener('keydown', this.handleKeyDown.bind(this));
    textarea.addEventListener('input', this.handleInput.bind(this));
    textarea.addEventListener('paste', this.handlePaste.bind(this));
  }

  /**
   * Xử lý phím nhấn - chặn các ký tự không hợp lệ
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key;
    const input = event.target as HTMLTextAreaElement;
    const value = input.value;
    const selectionStart = input.selectionStart ?? 0;

    // Cho phép các phím điều hướng và control
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'F2'
    ];

    if (allowedKeys.includes(key)) {
      return;
    }

    // Cho phép Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
    if (event.ctrlKey || event.metaKey) {
      if (['a', 'c', 'v', 'x', 'z', 'A', 'C', 'V', 'X', 'Z'].includes(key)) {
        return;
      }
    }

    // Cho phép số 0-9
    if (/^[0-9]$/.test(key)) {
      return;
    }

    // Cho phép dấu âm (-) chỉ ở đầu
    if (key === '-') {
      // Chỉ cho phép nếu cursor ở đầu và chưa có dấu âm
      const cleanValue = value.replace(/[,.\s]/g, '');
      if (selectionStart === 0 && !cleanValue.includes('-')) {
        return;
      }
      event.preventDefault();
      return;
    }

    // Cho phép dấu thập phân (.) chỉ một lần
    if (key === '.' || key === ',') {
      const cleanValue = value.replace(/[,\s]/g, '');
      if (!cleanValue.includes('.')) {
        // Chèn dấu chấm thay vì dấu phẩy
        if (key === ',') {
          event.preventDefault();
          const newValue = value.slice(0, selectionStart) + '.' + value.slice(input.selectionEnd ?? selectionStart);
          input.value = newValue;
          input.setSelectionRange(selectionStart + 1, selectionStart + 1);
        }
        return;
      }
      event.preventDefault();
      return;
    }

    // Chặn tất cả các ký tự khác
    event.preventDefault();
  };

  /**
   * Xử lý sự kiện input - format số khi đang nhập
   */
  private handleInput = (event: Event): void => {
    const input = event.target as HTMLTextAreaElement;
    const cursorPosition = input.selectionStart ?? 0;
    const oldValue = input.value;

    // Lưu vị trí cursor tương đối (số ký tự số trước cursor)
    const charsBeforeCursor = oldValue.slice(0, cursorPosition).replace(/[^0-9.-]/g, '').length;

    // Format giá trị
    const formatted = this.formatInputValue(oldValue);
    
    if (formatted !== oldValue) {
      input.value = formatted;
      
      // Tính lại vị trí cursor
      const newCursorPosition = this.calculateNewCursorPosition(formatted, charsBeforeCursor);
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  };

  /**
   * Xử lý paste - chỉ paste số hợp lệ
   */
  private handlePaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    const input = event.target as HTMLTextAreaElement;
    
    // Làm sạch text paste: loại bỏ các ký tự không phải số, dấu âm, dấu thập phân
    let cleanedText = pastedText.replace(/[^0-9.,\-]/g, '');
    
    // Thay dấu phẩy thập phân thành dấu chấm (cho format VN)
    cleanedText = cleanedText.replace(/,/g, '.');
    
    // Chỉ giữ lại một dấu thập phân
    const parts = cleanedText.split('.');
    if (parts.length > 2) {
      cleanedText = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Chỉ giữ dấu âm ở đầu
    if (cleanedText.indexOf('-') > 0) {
      cleanedText = cleanedText.replace(/-/g, '');
    }

    // Insert at cursor position
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    const currentValue = input.value;
    
    const newValue = currentValue.slice(0, selectionStart) + cleanedText + currentValue.slice(selectionEnd);
    input.value = this.formatInputValue(newValue);
    
    // Đặt cursor sau text vừa paste
    const newCursorPos = selectionStart + cleanedText.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger input event để update formatting
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /**
   * Format giá trị input với dấu phân cách hàng nghìn
   */
  private formatInputValue(value: string): string {
    if (!value || value === '-') return value;

    // Loại bỏ tất cả các ký tự không phải số, dấu âm, dấu thập phân
    let cleanValue = value.replace(/[^0-9.\-]/g, '');
    
    // Xử lý dấu âm
    const isNegative = cleanValue.startsWith('-');
    cleanValue = cleanValue.replace(/-/g, '');

    // Tách phần nguyên và phần thập phân
    const parts = cleanValue.split('.');
    let integerPart = parts[0] || '';
    const decimalPart = parts.length > 1 ? parts[1] : null;

    // Loại bỏ leading zeros (trừ khi chỉ có 0)
    if (integerPart.length > 1) {
      integerPart = integerPart.replace(/^0+/, '') || '0';
    }

    // Format phần nguyên với dấu phân cách hàng nghìn
    const formattedInteger = this.addThousandSeparator(integerPart);

    // Ghép lại
    let result = isNegative ? '-' + formattedInteger : formattedInteger;
    
    if (decimalPart !== null) {
      result += '.' + decimalPart;
    }

    return result;
  }

  /**
   * Thêm dấu phân cách hàng nghìn
   */
  private addThousandSeparator(value: string): string {
    if (!value) return '';
    
    // Sử dụng regex để thêm dấu phẩy
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Tính vị trí cursor mới sau khi format
   */
  private calculateNewCursorPosition(formattedValue: string, charsBeforeCursor: number): number {
    let count = 0;
    let position = 0;
    
    for (let i = 0; i < formattedValue.length; i++) {
      if (/[0-9.\-]/.test(formattedValue[i])) {
        count++;
      }
      position++;
      if (count >= charsBeforeCursor) {
        break;
      }
    }
    
    return position;
  }

  /**
   * Lấy giá trị khi đóng editor - trả về số thuần (không có format)
   */
  override getValue(): any {
    const value = (this.TEXTAREA as HTMLTextAreaElement)?.value || '';
    
    if (!value || value === '-') {
      return null;
    }

    // Loại bỏ dấu phân cách hàng nghìn
    const cleanValue = value.replace(/,/g, '');
    const numericValue = parseFloat(cleanValue);
    
    return isNaN(numericValue) ? null : numericValue;
  }

  /**
   * Set giá trị khi mở editor
   */
  override setValue(newValue: any): void {
    if (newValue === null || newValue === undefined || newValue === '') {
      super.setValue('');
      return;
    }

    // Format số cho hiển thị trong editor
    const numValue = typeof newValue === 'number' ? newValue : parseFloat(String(newValue));
    
    if (isNaN(numValue)) {
      super.setValue('');
      return;
    }

    // Format với dấu phân cách hàng nghìn
    const formatted = this.formatInputValue(String(newValue));
    super.setValue(formatted);
  }
}

// Register editor with Handsontable
Handsontable.editors.registerEditor('formattedNumeric', FormattedNumericEditor);

export default FormattedNumericEditor;
