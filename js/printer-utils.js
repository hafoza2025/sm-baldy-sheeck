// js/printer-utils.js
// نظام الطباعة الحرارية الشامل

const ThermalPrinter = {
    restaurantName: 'مطعم الفرعون',
    restaurantPhone: '01234567890',
    restaurantAddress: 'القاهرة، مصر',

    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('ar-EG', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });
    },

    formatTime(date) {
        const d = new Date(date);
        return d.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount) + ' ج.م';
    },

    getCommonStyles() {
        return `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: 80mm auto; margin: 0; }
            body {
                font-family: 'Cairo', 'Arial', sans-serif;
                width: 80mm;
                padding: 5mm;
                background: white;
                color: #000;
                font-size: 11px;
                line-height: 1.4;
            }
            .header {
                text-align: center;
                border-bottom: 2px dashed #000;
                padding-bottom: 5mm;
                margin-bottom: 5mm;
            }
            .header h1 {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 2mm;
            }
            .header .subtitle {
                font-size: 12px;
                font-weight: bold;
                margin: 2mm 0;
            }
            .info-section {
                border-bottom: 1px dashed #000;
                padding-bottom: 3mm;
                margin-bottom: 3mm;
            }
            .info-line {
                display: flex;
                justify-content: space-between;
                margin-bottom: 1mm;
                font-size: 10px;
            }
            .label { font-weight: bold; }
            .amount-box {
                text-align: center;
                border: 2px solid #000;
                padding: 3mm;
                margin: 3mm 0;
                font-size: 14px;
                font-weight: bold;
            }
            .footer {
                border-top: 2px dashed #000;
                padding-top: 3mm;
                margin-top: 5mm;
                text-align: center;
                font-size: 9px;
            }
            .signature {
                margin-top: 5mm;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
            }
            @media print { body { width: 80mm; } }
        `;
    },

    // طباعة إيصال راتب موظف
    printSalaryReceipt(data) {
        const now = new Date();
        const paymentTypeAr = {
            'daily': 'يومي',
            'weekly': 'أسبوعي',
            'monthly': 'شهري',
            'advance': 'سلفة',
            'bonus': 'مكافأة',
            'deduction': 'خصم'
        };
        
        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إيصال راتب</title>
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    <div class="header">
        <h1>${this.restaurantName}</h1>
        <div class="subtitle">💰 إيصال صرف راتب</div>
        <div style="font-size: 9px; margin-top: 2mm;">${this.restaurantPhone}</div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">رقم الإيصال:</span>
            <span>#${data.id}</span>
        </div>
        <div class="info-line">
            <span class="label">التاريخ:</span>
            <span>${this.formatDate(now)} - ${this.formatTime(now)}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">اسم الموظف:</span>
            <span>${data.employee_name}</span>
        </div>
        <div class="info-line">
            <span class="label">الوظيفة:</span>
            <span>${data.job_title || '-'}</span>
        </div>
        <div class="info-line">
            <span class="label">نوع الدفع:</span>
            <span>${paymentTypeAr[data.payment_type] || data.payment_type}</span>
        </div>
        ${data.days_count ? `
        <div class="info-line">
            <span class="label">عدد الأيام:</span>
            <span>${data.days_count} يوم</span>
        </div>
        ` : ''}
    </div>

    <div class="amount-box">
        المبلغ المدفوع: ${this.formatCurrency(data.amount)}
    </div>

    ${data.notes ? `
    <div style="background: #f0f0f0; padding: 2mm; font-size: 9px; margin: 2mm 0;">
        <strong>ملاحظات:</strong> ${data.notes}
    </div>
    ` : ''}

    <div class="signature">
        <div>توقيع المستلم<br>_____________</div>
        <div>توقيع المحاسب<br>_____________</div>
    </div>

    <div class="footer">
        <div>شكراً لك</div>
        <div style="margin-top: 1mm;">${this.restaurantAddress}</div>
    </div>

    <script>
        window.onload = () => setTimeout(() => window.print(), 300);
    </script>
</body>
</html>`;

        this.openPrintWindow(html);
    },

    // طباعة إيصال دفع لمورد
    printSupplierPayment(data) {
        const now = new Date();
        const paymentMethodAr = {
            'cash': 'نقدي',
            'card': 'بطاقة',
            'bank_transfer': 'تحويل بنكي',
            'check': 'شيك'
        };
        
        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إيصال دفع لمورد</title>
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    <div class="header">
        <h1>${this.restaurantName}</h1>
        <div class="subtitle">📦 إيصال دفع لمورد</div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">رقم الإيصال:</span>
            <span>#${data.id}</span>
        </div>
        <div class="info-line">
            <span class="label">التاريخ:</span>
            <span>${this.formatDate(now)}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">اسم المورد:</span>
            <span>${data.supplier_name}</span>
        </div>
        <div class="info-line">
            <span class="label">طريقة الدفع:</span>
            <span>${paymentMethodAr[data.payment_method] || data.payment_method}</span>
        </div>
        ${data.invoice_number ? `
        <div class="info-line">
            <span class="label">رقم الفاتورة:</span>
            <span>${data.invoice_number}</span>
        </div>
        ` : ''}
    </div>

    <div class="amount-box">
        المبلغ المدفوع: ${this.formatCurrency(data.amount)}
    </div>

    ${data.notes ? `
    <div style="background: #f0f0f0; padding: 2mm; font-size: 9px; margin: 2mm 0;">
        <strong>ملاحظات:</strong> ${data.notes}
    </div>
    ` : ''}

    <div class="footer">
        <div>توقيع المستلم: __________________</div>
        <div style="margin-top: 2mm;">${this.restaurantAddress}</div>
    </div>

    <script>
        window.onload = () => setTimeout(() => window.print(), 300);
    </script>
</body>
</html>`;

        this.openPrintWindow(html);
    },

    // طباعة إيصال مصروف عام
    printGeneralExpense(data) {
        const categoryAr = {
            'rent': 'إيجار',
            'utilities': 'مرافق',
            'maintenance': 'صيانة',
            'marketing': 'تسويق',
            'other': 'أخرى'
        };
        
        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إيصال مصروف</title>
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    <div class="header">
        <h1>${this.restaurantName}</h1>
        <div class="subtitle">💸 إيصال مصروف عام</div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">رقم الإيصال:</span>
            <span>#${data.id}</span>
        </div>
        <div class="info-line">
            <span class="label">التاريخ:</span>
            <span>${this.formatDate(data.expense_date)}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">الفئة:</span>
            <span>${categoryAr[data.category] || data.category}</span>
        </div>
        <div class="info-line">
            <span class="label">الوصف:</span>
            <span>${data.description}</span>
        </div>
        ${data.paid_to ? `
        <div class="info-line">
            <span class="label">مدفوع لـ:</span>
            <span>${data.paid_to}</span>
        </div>
        ` : ''}
    </div>

    <div class="amount-box">
        المبلغ المدفوع: ${this.formatCurrency(data.amount)}
    </div>

    <div class="footer">
        <div>توقيع المستلم: __________________</div>
        <div style="margin-top: 2mm;">${this.restaurantAddress}</div>
    </div>

    <script>
        window.onload = () => setTimeout(() => window.print(), 300);
    </script>
</body>
</html>`;

        this.openPrintWindow(html);
    },

    // طباعة فاتورة خدمات
    printUtilityBill(data) {
        const billTypeAr = {
            'electricity': 'كهرباء ⚡',
            'water': 'مياه 💧',
            'gas': 'غاز 🔥',
            'internet': 'إنترنت 🌐',
            'phone': 'تليفون 📞'
        };
        
        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>فاتورة خدمات</title>
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    <div class="header">
        <h1>${this.restaurantName}</h1>
        <div class="subtitle">🧾 فاتورة ${billTypeAr[data.bill_type] || data.bill_type}</div>
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">رقم الفاتورة:</span>
            <span>${data.invoice_number || '#' + data.id}</span>
        </div>
        <div class="info-line">
            <span class="label">الشهر:</span>
            <span>${data.bill_month}</span>
        </div>
        <div class="info-line">
            <span class="label">تاريخ الفاتورة:</span>
            <span>${this.formatDate(data.bill_date)}</span>
        </div>
    </div>

    ${data.consumption ? `
    <div class="info-section">
        <div class="info-line">
            <span class="label">القراءة السابقة:</span>
            <span>${data.previous_reading}</span>
        </div>
        <div class="info-line">
            <span class="label">القراءة الحالية:</span>
            <span>${data.current_reading}</span>
        </div>
        <div class="info-line">
            <span class="label">الاستهلاك:</span>
            <span>${data.consumption}</span>
        </div>
    </div>
    ` : ''}

    <div class="amount-box">
        المبلغ المستحق: ${this.formatCurrency(data.amount)}
    </div>

    <div class="info-section">
        <div class="info-line">
            <span class="label">حالة الدفع:</span>
            <span>${data.payment_status === 'paid' ? '✅ مدفوع' : '⏳ معلق'}</span>
        </div>
        ${data.payment_date ? `
        <div class="info-line">
            <span class="label">تاريخ الدفع:</span>
            <span>${this.formatDate(data.payment_date)}</span>
        </div>
        ` : ''}
    </div>

    <div class="footer">
        <div>${this.restaurantAddress}</div>
    </div>

    <script>
        window.onload = () => setTimeout(() => window.print(), 300);
    </script>
</body>
</html>`;

        this.openPrintWindow(html);
    },

    openPrintWindow(html) {
        const printWindow = window.open('', '_blank', 'width=300,height=600');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            alert('⚠️ لم نتمكن من فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.');
        }
    }
};

window.ThermalPrinter = ThermalPrinter;
console.log('✅ Thermal Printer System Loaded');
