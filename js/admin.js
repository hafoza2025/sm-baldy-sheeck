// js/admin.js
// وظائف لوحة تحكم المدير

const AdminDashboard = {
    currentUser: null,
    allOrders: [],
    filteredOrders: [],
    allDeliveries: [],
    allUsers: [],
    allInventory: [],

    // التهيئة
    async init() {
        this.currentUser = Auth.checkAuth(['admin']);
        if (!this.currentUser) return;

        document.getElementById('adminName').textContent = `مرحباً، ${this.currentUser.full_name}`;

        await this.loadAllData();
        this.setupRealtimeSubscriptions();
        this.setupEventListeners();
    },

    // تحميل جميع البيانات
    async loadAllData() {
        await Promise.all([
            this.loadStats(),
            this.loadCurrentOrders(),
            this.loadUsers(),
            this.loadOrders(),
            this.loadDeliveries(),
            this.loadInventory()
        ]);
    },

    // تحميل الإحصائيات
    async loadStats() {
        try {
            const today = new Date().toISOString().split('T')[0];

            // إجمالي المبيعات اليوم
            const { data: salesData } = await supabase
                .from('orders')
                .select('total')
                .eq('status', 'completed')
                .gte('created_at', today);

            const totalSales = salesData?.reduce((sum, order) => sum + order.total, 0) || 0;
            document.getElementById('totalSales').textContent = Utils.formatCurrency(totalSales);

            // الطلبات النشطة
            const { data: activeData } = await supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .in('status', ['new', 'preparing', 'ready']);

            document.getElementById('activeOrders').textContent = activeData?.length || 0;

            // طلبات الديليفري اليوم
            const { data: deliveryData } = await supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('order_type', 'delivery')
                .gte('created_at', today);

            document.getElementById('deliveryOrders').textContent = deliveryData?.length || 0;

            // عدد المستخدمين
            const { data: usersData } = await supabase
                .from('users')
                .select('id', { count: 'exact' });

            document.getElementById('totalUsers').textContent = usersData?.length || 0;

        } catch (error) {
            console.error('Error loading stats:', error);
            Utils.showNotification('خطأ في تحميل الإحصائيات', 'error');
        }
    },

    // تحميل الطلبات الحالية
    async loadCurrentOrders() {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
          *,
          staff:staff_id(full_name),
          deliveries(customer_name)
        `)
                .in('status', ['new', 'preparing', 'ready'])
                .order('created_at', { ascending: true });

            if (error) throw error;

            const tbody = document.getElementById('currentOrdersBody');
            tbody.innerHTML = data.map(order => `
        <tr>
          <td><strong>#${order.order_number}</strong></td>
          <td>${order.order_type === 'delivery' ? '🛵 ديليفري' : '🍽️ داخلي'}</td>
          <td>${order.order_type === 'delivery' ? order.deliveries[0]?.customer_name : `طاولة ${order.table_number}`}</td>
          <td>${this.getStatusBadge(order.status)}</td>
          <td><strong>${Utils.formatCurrency(order.total)}</strong></td>
          <td>${Utils.formatTime(order.created_at)}</td>
        </tr>
      `).join('');

        } catch (error) {
            console.error('Error loading current orders:', error);
        }
    },

    // تحميل المستخدمين
    async loadUsers() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.allUsers = data;
            this.displayUsers(data);

        } catch (error) {
            console.error('Error loading users:', error);
            Utils.showNotification('خطأ في تحميل المستخدمين', 'error');
        }
    },

    displayUsers(users) {
        const tbody = document.getElementById('usersBody');
        tbody.innerHTML = users.map(user => `
      <tr>
        <td>${user.full_name}</td>
        <td>${user.username}</td>
        <td>${this.getRoleName(user.role)}</td>
        <td>${user.phone || '-'}</td>
        <td>
          ${user.is_active
                ? '<span class="badge badge-active">نشط</span>'
                : '<span class="badge badge-inactive">غير نشط</span>'}
        </td>
        <td>
          <button onclick="AdminDashboard.toggleUserStatus(${user.id}, ${!user.is_active})" 
                  class="btn ${user.is_active ? 'btn-danger' : 'btn-success'}" 
                  style="padding: 5px 15px; font-size: 14px;">
            ${user.is_active ? '🔒 تعطيل' : '✅ تفعيل'}
          </button>
        </td>
      </tr>
    `).join('');
    },

    // تحميل الطلبات
    async loadOrders() {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
          *,
          staff:staff_id(full_name),
          deliveries(customer_name)
        `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            this.allOrders = data;
            this.filteredOrders = data;
            this.displayOrders(data);

        } catch (error) {
            console.error('Error loading orders:', error);
            Utils.showNotification('خطأ في تحميل الطلبات', 'error');
        }
    },

    displayOrders(orders) {
        const tbody = document.getElementById('ordersBody');
        tbody.innerHTML = orders.map(order => `
      <tr onclick="AdminDashboard.viewOrderDetails(${order.id})" style="cursor: pointer;">
        <td><strong>#${order.order_number}</strong></td>
        <td>${Utils.formatDate(order.created_at)}</td>
        <td>${order.order_type === 'delivery' ? '🛵 ديليفري' : '🍽️ داخلي'}</td>
        <td>${order.order_type === 'delivery' ? order.deliveries[0]?.customer_name || '-' : `طاولة ${order.table_number}`}</td>
        <td>${order.staff?.full_name || '-'}</td>
        <td><strong>${Utils.formatCurrency(order.total)}</strong></td>
        <td>${this.getStatusBadge(order.status)}</td>
      </tr>
    `).join('');
    },

    // تحميل الديليفري
    async loadDeliveries() {
        try {
            const { data, error } = await supabase
                .from('deliveries')
                .select(`
          *,
          order:order_id(order_number, total, created_at)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.allDeliveries = data;
            this.displayDeliveries(data);

        } catch (error) {
            console.error('Error loading deliveries:', error);
            Utils.showNotification('خطأ في تحميل الديليفري', 'error');
        }
    },

    displayDeliveries(deliveries) {
        const tbody = document.getElementById('deliveriesBody');
        tbody.innerHTML = deliveries.map(delivery => `
      <tr>
        <td><strong>#${delivery.order?.order_number}</strong></td>
        <td>${delivery.customer_name}</td>
        <td>${delivery.customer_phone}</td>
        <td>${delivery.customer_address}</td>
        <td>${delivery.delivery_person || '-'}</td>
        <td>${Utils.formatCurrency(delivery.delivery_fee)}</td>
        <td>${this.getDeliveryStatusBadge(delivery.delivery_status)}</td>
        <td>${Utils.formatDate(delivery.order?.created_at)}</td>
      </tr>
    `).join('');
    },

    // تحميل المخزون
    async loadInventory() {
        try {
            const { data, error } = await supabase
                .from('ingredients')
                .select('*')
                .order('name');

            if (error) throw error;

            this.allInventory = data;

            const tbody = document.getElementById('inventoryBody');
            tbody.innerHTML = data.map(item => {
                const isLow = item.current_stock <= item.min_stock;
                return `
          <tr style="${isLow ? 'background: #fff3cd;' : ''}">
            <td><strong>${item.name}</strong></td>
            <td style="font-weight: bold; ${isLow ? 'color: #856404;' : ''}">${item.current_stock}</td>
            <td>${item.unit}</td>
            <td>${item.min_stock}</td>
            <td>${Utils.formatCurrency(item.cost_per_unit)}</td>
            <td>
              ${isLow
                        ? '<span class="badge badge-warning">⚠️ منخفض</span>'
                        : '<span class="badge badge-success">✅ جيد</span>'}
            </td>
          </tr>
        `;
            }).join('');

        } catch (error) {
            console.error('Error loading inventory:', error);
            Utils.showNotification('خطأ في تحميل المخزون', 'error');
        }
    },

    // إعداد الاشتراكات اللحظية
    setupRealtimeSubscriptions() {
        Realtime.subscribeToOrders(() => {
            this.loadStats();
            this.loadCurrentOrders();
            this.loadOrders();
        });

        Realtime.subscribeToUsers(() => {
            this.loadUsers();
        });

        Realtime.subscribeToDeliveries(() => {
            this.loadDeliveries();
        });

        Realtime.subscribeToInventory(() => {
            this.loadInventory();
        });
    },

    // إعداد مستمعي الأحداث
    setupEventListeners() {
        // نموذج إضافة مستخدم
        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createUser();
        });
    },

    // إضافة مستخدم جديد
    async createUser() {
        const userData = {
            full_name: document.getElementById('fullName').value,
            username: document.getElementById('username').value,
            password_hash: document.getElementById('userPassword').value,
            role: document.getElementById('userRole').value,
            phone: document.getElementById('userPhone').value,
            email: document.getElementById('userEmail').value,
            is_active: true,
            created_by_admin_id: this.currentUser.id
        };

        try {
            const { data, error } = await supabase
                .from('users')
                .insert([userData]);

            if (error) throw error;

            Utils.showNotification('تم إضافة المستخدم بنجاح', 'success');
            this.closeUserModal();
            this.loadUsers();

        } catch (error) {
            console.error('Error creating user:', error);
            Utils.showNotification('حدث خطأ أثناء إضافة المستخدم', 'error');
        }
    },

    // تفعيل/تعطيل مستخدم
    async toggleUserStatus(userId, newStatus) {
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_active: newStatus })
                .eq('id', userId);

            if (error) throw error;

            Utils.showNotification(
                newStatus ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم',
                'success'
            );
            this.loadUsers();

        } catch (error) {
            console.error('Error toggling user status:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    // فتح نافذة المستخدم
    openUserModal() {
        document.getElementById('userModal').classList.add('active');
        document.getElementById('userForm').reset();
    },

    closeUserModal() {
        document.getElementById('userModal').classList.remove('active');
    },

    // تطبيق الفلاتر
    applyFilters() {
        let filtered = [...this.allOrders];

        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const orderType = document.getElementById('filterOrderType').value;
        const status = document.getElementById('filterStatus').value;

        if (dateFrom) {
            filtered = filtered.filter(o => o.created_at >= dateFrom);
        }

        if (dateTo) {
            filtered = filtered.filter(o => o.created_at <= dateTo + 'T23:59:59');
        }

        if (orderType) {
            filtered = filtered.filter(o => o.order_type === orderType);
        }

        if (status) {
            filtered = filtered.filter(o => o.status === status);
        }

        this.filteredOrders = filtered;
        this.displayOrders(filtered);
        Utils.showNotification(`تم العثور على ${filtered.length} طلب`, 'success');
    },

    // تصدير الطلبات
    exportOrders() {
        const exportData = this.filteredOrders.map(order => ({
            'رقم الطلب': order.order_number,
            'التاريخ': Utils.formatDate(order.created_at),
            'النوع': order.order_type === 'delivery' ? 'ديليفري' : 'داخلي',
            'الطاولة/العميل': order.order_type === 'delivery' ? order.deliveries[0]?.customer_name : `طاولة ${order.table_number}`,
            'الموظف': order.staff?.full_name || '-',
            'المجموع الفرعي': order.subtotal,
            'الضريبة': order.tax,
            'الخصم': order.discount,
            'رسوم التوصيل': order.delivery_fee || 0,
            'الإجمالي': order.total,
            'الحالة': this.getStatusText(order.status)
        }));

        Utils.exportToExcel(exportData, 'الطلبات');
        Utils.showNotification('تم تصدير البيانات بنجاح', 'success');
    },

    // تصدير الديليفري
    exportDeliveries() {
        const exportData = this.allDeliveries.map(delivery => ({
            'رقم الطلب': delivery.order?.order_number,
            'اسم العميل': delivery.customer_name,
            'الموبايل': delivery.customer_phone,
            'العنوان': delivery.customer_address,
            'المندوب': delivery.delivery_person || '-',
            'رسوم التوصيل': delivery.delivery_fee,
            'الإجمالي': delivery.order?.total,
            'الحالة': this.getDeliveryStatusText(delivery.delivery_status),
            'وقت الطلب': Utils.formatDate(delivery.order?.created_at),
            'وقت التوصيل': delivery.delivered_at ? Utils.formatDate(delivery.delivered_at) : '-'
        }));

        Utils.exportToExcel(exportData, 'الديليفري');
        Utils.showNotification('تم تصدير البيانات بنجاح', 'success');
    },

    // تصدير المخزون
    exportInventory() {
        const exportData = this.allInventory.map(item => ({
            'المكون': item.name,
            'الكمية الحالية': item.current_stock,
            'الوحدة': item.unit,
            'الحد الأدنى': item.min_stock,
            'التكلفة لكل وحدة': item.cost_per_unit,
            'القيمة الإجمالية': item.current_stock * item.cost_per_unit,
            'الحالة': item.current_stock <= item.min_stock ? 'منخفض' : 'جيد'
        }));

        Utils.exportToExcel(exportData, 'المخزون');
        Utils.showNotification('تم تصدير البيانات بنجاح', 'success');
    },

    // دوال مساعدة
    getRoleName(role) {
        const roles = {
            'admin': '👑 مدير',
            'cashier': '💰 كاشير',
            'staff': '👤 موظف',
            'kitchen': '👨‍🍳 مطبخ'
        };
        return roles[role] || role;
    },

    getStatusBadge(status) {
        const statuses = {
            'new': '<span class="badge badge-warning">جديد</span>',
            'preparing': '<span class="badge badge-info">قيد التحضير</span>',
            'ready': '<span class="badge badge-success">جاهز</span>',
            'completed': '<span class="badge badge-success">مكتمل</span>',
            'cancelled': '<span class="badge badge-danger">ملغي</span>'
        };
        return statuses[status] || status;
    },

    getStatusText(status) {
        const statuses = {
            'new': 'جديد',
            'preparing': 'قيد التحضير',
            'ready': 'جاهز',
            'completed': 'مكتمل',
            'cancelled': 'ملغي'
        };
        return statuses[status] || status;
    },

    getDeliveryStatusBadge(status) {
        const statuses = {
            'preparing': '<span class="badge badge-warning">قيد التحضير</span>',
            'ready': '<span class="badge badge-success">جاهز</span>',
            'on_way': '<span class="badge badge-info">في الطريق</span>',
            'delivered': '<span class="badge badge-success">تم التوصيل</span>'
        };
        return statuses[status] || status;
    },

    getDeliveryStatusText(status) {
        const statuses = {
            'preparing': 'قيد التحضير',
            'ready': 'جاهز',
            'on_way': 'في الطريق',
            'delivered': 'تم التوصيل'
        };
        return statuses[status] || status;
    },

    // عرض تفاصيل الطلب
    async viewOrderDetails(orderId) {
        try {
            const { data: order } = await supabase
                .from('orders')
                .select(`
          *,
          order_items(*, menu_item:menu_item_id(name, name_ar)),
          staff:staff_id(full_name),
          deliveries(*)
        `)
                .eq('id', orderId)
                .single();

            // يمكن إضافة مودال لعرض التفاصيل
            console.log('Order details:', order);
            Utils.showNotification('عرض تفاصيل الطلب', 'info');
        } catch (error) {
            console.error('Error viewing order:', error);
        }
    }
};

// تهيئة عند تحميل الصفحة
if (typeof window !== 'undefined') {
    window.AdminDashboard = AdminDashboard;
}
