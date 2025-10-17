// js/realtime.js
// إدارة الاتصالات اللحظية مع Supabase

const Realtime = {
    subscriptions: [],

    // الاشتراك في تغييرات الطلبات
    subscribeToOrders(callback) {
        const subscription = supabase
            .channel('orders-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Order change:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    },

    // الاشتراك في تغييرات المخزون
    subscribeToInventory(callback) {
        const subscription = supabase
            .channel('inventory-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'ingredients' },
                (payload) => {
                    console.log('Inventory change:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    },

    // الاشتراك في تغييرات الديليفري
    subscribeToDeliveries(callback) {
        const subscription = supabase
            .channel('deliveries-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'deliveries' },
                (payload) => {
                    console.log('Delivery change:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    },

    // الاشتراك في تغييرات المستخدمين
    subscribeToUsers(callback) {
        const subscription = supabase
            .channel('users-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                (payload) => {
                    console.log('User change:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    },

    // الاشتراك في تغييرات المنيو
    subscribeToMenu(callback) {
        const subscription = supabase
            .channel('menu-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'menu_items' },
                (payload) => {
                    console.log('Menu change:', payload);
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    },

    // إلغاء جميع الاشتراكات
    unsubscribeAll() {
        this.subscriptions.forEach(sub => {
            supabase.removeChannel(sub);
        });
        this.subscriptions = [];
    },

    // إلغاء اشتراك محدد
    unsubscribe(subscription) {
        supabase.removeChannel(subscription);
        this.subscriptions = this.subscriptions.filter(s => s !== subscription);
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.Realtime = Realtime;
}

// تنظيف الاشتراكات عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    Realtime.unsubscribeAll();
});
// Subscribe لأي جدول
Realtime.subscribeToTable = function(tableName, callback) {
  const subscription = supabase
    .channel(`${tableName}-channel`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        console.log(`${tableName} change:`, payload);
        callback(payload);
      }
    )
    .subscribe();
  
  this.subscriptions.push(subscription);
  return subscription;
};

