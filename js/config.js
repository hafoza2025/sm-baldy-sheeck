// js/config.js
// ملف الإعدادات والدوال المشتركة

// تهيئة Supabase
const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
);

// دوال مساعدة عامة
const Utils = {
    // عرض الإشعارات
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // تنسيق العملة
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-EG', {
            style: 'currency',
            currency: SYSTEM_CONFIG.currency
        }).format(amount);
    },

    // تنسيق التاريخ
    formatDate(date) {
        return new Date(date).toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // تنسيق الوقت فقط
    formatTime(date) {
        return new Date(date).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // حساب الفرق الزمني بالدقائق
    getTimeDifference(date) {
        const now = new Date();
        const orderDate = new Date(date);
        const diff = Math.floor((now - orderDate) / 1000 / 60);
        return diff;
    },

    // توليد رقم طلب عشوائي
    generateOrderNumber() {
        return Math.floor(100000 + Math.random() * 900000);
    },

    // حساب الضريبة
    calculateTax(amount) {
        return amount * SYSTEM_CONFIG.taxRate;
    },

    // حساب الإجمالي
    calculateTotal(subtotal, discount = 0, deliveryFee = 0) {
        const tax = this.calculateTax(subtotal);
        return subtotal + tax - discount + deliveryFee;
    },

    // تصدير إلى Excel
    exportToExcel(data, filename) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    },

    // طباعة
    print(elementId) {
        const printContent = document.getElementById(elementId);
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>طباعة</title>');
        printWindow.document.write('<style>body{font-family:Arial;direction:rtl;}</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    },

    // إرسال إشعار Telegram (اختياري)
    async sendTelegramNotification(message) {
        if (!SYSTEM_CONFIG.telegramBotToken) return;

        try {
            await fetch(`https://api.telegram.org/bot${SYSTEM_CONFIG.telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: SYSTEM_CONFIG.telegramChatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
        } catch (error) {
            console.error('Telegram notification error:', error);
        }
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.Utils = Utils;
    window.supabase = supabase;
}
