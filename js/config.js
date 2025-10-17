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



// ===============================
// Auto-Protection System
// ===============================

const Loading = {
  overlay: null,
  activeOperations: new Set(),
  
  init() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'loadingOverlay';
      this.overlay.className = 'loading-overlay';
      this.overlay.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <h3 class="loading-text">جاري المعالجة...</h3>
          <p class="loading-subtext">يرجى الانتظار</p>
        </div>
      `;
      document.body.appendChild(this.overlay);
    }
    return this.overlay;
  },
  
  show(message = 'جاري المعالجة...', subtext = 'يرجى الانتظار') {
    this.init();
    const textElement = this.overlay.querySelector('.loading-text');
    const subtextElement = this.overlay.querySelector('.loading-subtext');
    if (textElement) textElement.textContent = message;
    if (subtextElement) subtextElement.textContent = subtext;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  },
  
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  },
  
  success(message = 'تمت العملية بنجاح ✅') {
    this.show(message, '');
    setTimeout(() => this.hide(), 1500);
  },
  
  error(message = 'حدث خطأ ❌') {
    this.show(message, 'يرجى المحاولة مرة أخرى');
    setTimeout(() => this.hide(), 2000);
  },
  
  startOperation(operationId) {
    if (this.activeOperations.has(operationId)) {
      return false;
    }
    this.activeOperations.add(operationId);
    return true;
  },
  
  endOperation(operationId) {
    this.activeOperations.delete(operationId);
  },
  
  isOperationActive(operationId) {
    return this.activeOperations.has(operationId);
  }
};

// دالة للف الدوال تلقائياً
function protectAsync(fn, operationName = 'operation', showLoading = true) {
  return async function(...args) {
    const operationId = `${operationName}-${Date.now()}`;
    
    // منع التكرار
    if (Loading.isOperationActive(operationId)) {
      Utils.showNotification('جاري معالجة العملية، يرجى الانتظار...', 'warning');
      return;
    }
    
    if (!Loading.startOperation(operationId)) {
      return;
    }
    
    if (showLoading) {
      Loading.show();
    }
    
    try {
      const result = await fn.apply(this, args);
      if (showLoading) {
        Loading.success();
      }
      return result;
    } catch (error) {
      console.error(`Error in ${operationName}:`, error);
      if (showLoading) {
        Loading.error(error.message || 'حدث خطأ');
      }
      Utils.showNotification(error.message || 'حدث خطأ أثناء العملية', 'error');
      throw error;
    } finally {
      Loading.endOperation(operationId);
      if (showLoading) {
        setTimeout(() => Loading.hide(), 100);
      }
    }
  };
}

if (typeof window !== 'undefined') {
  window.Loading = Loading;
  window.protectAsync = protectAsync;
}
