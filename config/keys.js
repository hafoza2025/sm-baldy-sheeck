// config/keys.js
// ملف المفاتيح والإعدادات الأساسية

const SUPABASE_CONFIG = {
    url: 'https://csosixpbzxcidwvitmbw.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3NpeHBienhjaWR3dml0bWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MTAwNTQsImV4cCI6MjA3NjE4NjA1NH0.pfPXnF8_idcqhgOO_OHCY5KTnzvyztJe-ngjariX-v4'
};

// إعدادات النظام
const SYSTEM_CONFIG = {
    restaurantName: 'مطعم الذواقة',
    currency: 'EGP',
    taxRate: 0.14, // 14% ضريبة
    deliveryFee: 20, // رسوم التوصيل الافتراضية
    tableCount: 20, // عدد الطاولات
    printEnabled: true,
    telegramBotToken: 'YOUR_TELEGRAM_BOT_TOKEN', // اختياري
    telegramChatId: 'YOUR_TELEGRAM_CHAT_ID' // اختياري
};

// تصدير المتغيرات
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_CONFIG, SYSTEM_CONFIG };
}
