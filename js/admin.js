// js/admin.js
// لوحة تحكم المدير مع إحصائيات لحظية كاملة

const AdminDashboard = {
    currentUser: null,
    allOrders: [],
    filteredOrders: [],
    allDeliveries: [],
    allUsers: [],
    allInventory: [],
    currentTimeFilter: 'today',

    // التهيئة
    async init() {
        this.currentUser = Auth.checkAuth(['admin']);
        if (!this.currentUser) return;

        document.getElementById('adminName').textContent = `مرحباً، ${this.currentUser.full_name}`;

        await this.loadAllData();
        this.setupRealtimeSubscriptions();
        this.setupEventListeners();
        
        // تحديث تلقائي كل 30 ثانية
        setInterval(() => this.updateLiveStats(), 30000);
    },

    // تحميل جميع البيانات
    async loadAllData() {
        Loading.show('جاري تحميل البيانات...', 'يرجى الانتظار');
        
        try {
            await Promise.all([
                this.loadLiveStats(),
                this.loadCurrentOrders(),
                this.loadUsers(),
                this.loadOrders(),
                this.loadDeliveries(),
                this.loadInventory()
            ]);
            
            Loading.hide();
        } catch (error) {
            console.error('Error loading data:', error);
            Loading.error('حدث خطأ في تحميل البيانات');
        }
    },

    // تحميل الإحصائيات اللحظية
    async loadLiveStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            // إيرادات اليوم
            const { data: todaySales } = await supabase
                .from('orders')
                .select('total')
                .eq('status', 'completed')
                .gte('created_at', today);

            const todayRevenue = todaySales?.reduce((sum, o) => sum + o.total, 0) || 0;

            // إيرادات الأمس للمقارنة
            const { data: yesterdaySales } = await supabase
                .from('orders')
                .select('total')
                .eq('status', 'completed')
                .gte('created_at', yesterday)
                .lt('created_at', today);

            const yesterdayRevenue = yesterdaySales?.reduce((sum, o) => sum + o.total, 0) || 0;
            const revenueChange = yesterdayRevenue > 0 
                ? (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1)
                : 0;

            document.getElementById('todayRevenue').textContent = Utils.formatCurrency(todayRevenue);
            document.getElementById('revenueChange').textContent = `${revenueChange > 0 ? '+' : ''}${revenueChange}%`;

            // طلبات اليوم
            const { data: todayOrders } = await supabase
                .from('orders')
                .select('id, total')
                .gte('created_at', today);

            const todayOrdersCount = todayOrders?.length || 0;
            const avgOrderValue = todayOrdersCount > 0 
                ? (todayRevenue / todayOrdersCount).toFixed(2)
                : 0;

            document.getElementById('todayOrdersCount').textContent = todayOrdersCount;
            document.getElementById('avgOrderValue').textContent = Utils.formatCurrency(avgOrderValue);

            // طلبات نشطة
            const { data: activeOrders } = await supabase
                .from('orders')
                .select('id, status')
                .in('status', ['new', 'preparing', 'ready']);

            const activeCount = activeOrders?.length || 0;
            const newCount = activeOrders?.filter(o => o.status === 'new').length || 0;
            const preparingCount = activeOrders?.filter(o => o.status === 'preparing').length || 0;

            document.getElementById('activeOrders').textContent = activeCount;
            document.getElementById('newOrders').textContent = newCount;
            document.getElementById('preparingOrders').textContent = preparingCount;

            // حساب الربح
            await this.calculateProfit(today);

            // تحميل تفاصيل إضافية
            await this.loadOrdersBreakdown(today);
            await this.loadInventoryStats();
            await this.loadTablesStatus();
            await this.loadDeliveryStatus(today);
            await this.loadTopSellingItems(today);

        } catch (error) {
            console.error('Error loading live stats:', error);
        }
    },

    // حساب الربح
    async calculateProfit(date) {
        try {
            // إجمالي المبيعات
            const { data: orders } = await supabase
                .from('orders')
                .select('total, order_items(quantity, menu_item_id)')
                .eq('status', 'completed')
                .gte('created_at', date);

            const totalSales = orders?.reduce((sum, o) => sum + o.total, 0) || 0;
            document.getElementById('totalSales').textContent = Utils.formatCurrency(totalSales);

            // حساب تكلفة المكونات
            let totalIngredientsCost = 0;

            for (const order of orders || []) {
                for (const item of order.order_items || []) {
                    // جلب recipe للصنف
                    const { data: recipes } = await supabase
                        .from('recipes')
                        .select('quantity_needed, ingredient:ingredient_id(cost_per_unit)')
                        .eq('menu_item_id', item.menu_item_id);

                    for (const recipe of recipes || []) {
                        const itemCost = recipe.quantity_needed * recipe.ingredient.cost_per_unit * item.quantity;
                        totalIngredientsCost += itemCost;
                    }
                }
            }

            document.getElementById('ingredientsCost').textContent = Utils.formatCurrency(totalIngredientsCost);

            // صافي الربح
            const netProfit = totalSales - totalIngredientsCost;
            document.getElementById('netProfit').textContent = Utils.formatCurrency(netProfit);
            document.getElementById('todayProfit').textContent = Utils.formatCurrency(netProfit);

            // هامش الربح
            const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : 0;
            document.getElementById('profitMargin').textContent = `${profitMargin}%`;

            // الخسائر (طلبات ملغاة)
            const { data: cancelledOrders } = await supabase
                .from('orders')
                .select('total')
                .eq('status', 'cancelled')
                .gte('created_at', date);

            const totalLosses = cancelledOrders?.reduce((sum, o) => sum + o.total, 0) || 0;
            document.getElementById('totalLosses').textContent = Utils.formatCurrency(totalLosses);

        } catch (error) {
            console.error('Error calculating profit:', error);
        }
    },

    // تفصيل الطلبات
    async loadOrdersBreakdown(date) {
        try {
            const { data: orders } = await supabase
                .from('orders')
                .select('status, order_type')
                .gte('created_at', date);

            const completed = orders?.filter(o => o.status === 'completed').length || 0;
            const preparing = orders?.filter(o => o.status === 'preparing').length || 0;
            const newOrders = orders?.filter(o => o.status === 'new').length || 0;
            const cancelled = orders?.filter(o => o.status === 'cancelled').length || 0;
            const dineIn = orders?.filter(o => o.order_type === 'dine_in').length || 0;
            const delivery = orders?.filter(o => o.order_type === 'delivery').length || 0;

            document.getElementById('completedOrders').textContent = completed;
            document.getElementById('preparingOrdersStat').textContent = preparing;
            document.getElementById('newOrdersStat').textContent = newOrders;
            document.getElementById('cancelledOrders').textContent = cancelled;
            document.getElementById('dineInOrders').textContent = dineIn;
            document.getElementById('deliveryOrders').textContent = delivery;

        } catch (error) {
            console.error('Error loading orders breakdown:', error);
        }
    },

    // إحصائيات المخزون
    async loadInventoryStats() {
        try {
            const { data: ingredients } = await supabase
                .from('ingredients')
                .select('*');

            const available = ingredients?.filter(i => i.current_stock > i.min_stock).length || 0;
            const low = ingredients?.filter(i => i.current_stock <= i.min_stock && i.current_stock > 0).length || 0;
            const critical = ingredients?.filter(i => i.current_stock <= 0).length || 0;

            document.getElementById('stockAvailable').textContent = available;
            document.getElementById('stockLow').textContent = low;
            document.getElementById('stockCritical').textContent = critical;

            // قيمة المخزون
            const inventoryValue = ingredients?.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit), 0) || 0;
            document.getElementById('inventoryValue').textContent = Utils.formatCurrency(inventoryValue);

            // عرض المكونات الحرجة
            const criticalItems = ingredients?.filter(i => i.current_stock <= 0).slice(0, 5) || [];
            const criticalList = document.getElementById('criticalItemsList');
            
            if (criticalItems.length > 0) {
                criticalList.innerHTML = `
                    <div style="background: #ffebee; padding: 10px; border-radius: 6px; margin-top: 10px;">
                        <div style="font-weight: bold; color: #721c24; margin-bottom: 8px;">⚠️ مكونات حرجة:</div>
                        ${criticalItems.map(item => `
                            <div style="font-size: 13px; color: #721c24; padding: 4px 0;">
                                • ${item.name} (${item.current_stock} ${item.unit})
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                criticalList.innerHTML = '';
            }

        } catch (error) {
            console.error('Error loading inventory stats:', error);
        }
    },

    // حالة الطاولات
    async loadTablesStatus() {
        try {
            const { data: tables } = await supabase
                .from('tables')
                .select('status');

            const available = tables?.filter(t => t.status === 'available').length || 0;
            const occupied = tables?.filter(t => t.status === 'occupied').length || 0;
            const reserved = tables?.filter(t => t.status === 'reserved').length || 0;
            const total = tables?.length || 1;

            document.getElementById('tablesAvailable').textContent = available;
            document.getElementById('tablesOccupied').textContent = occupied;
            document.getElementById('tablesReserved').textContent = reserved;

            // نسبة الإشغال
            const occupancyRate = ((occupied / total) * 100).toFixed(0);
            document.getElementById('occupancyRate').textContent = `${occupancyRate}%`;
            document.getElementById('occupancyBar').style.width = `${occupancyRate}%`;

        } catch (error) {
            console.error('Error loading tables status:', error);
        }
    },

    // حالة التوصيل
    async loadDeliveryStatus(date) {
        try {
            const { data: deliveries } = await supabase
                .from('deliveries')
                .select('delivery_status, created_at, delivered_at')
                .gte('created_at', date);

            const preparing = deliveries?.filter(d => d.delivery_status === 'preparing').length || 0;
            const ready = deliveries?.filter(d => d.delivery_status === 'ready').length || 0;
            const onWay = deliveries?.filter(d => d.delivery_status === 'on_way').length || 0;
            const delivered = deliveries?.filter(d => d.delivery_status === 'delivered').length || 0;

            document.getElementById('deliveryPreparing').textContent = preparing;
            document.getElementById('deliveryReady').textContent = ready;
            document.getElementById('deliveryOnWay').textContent = onWay;
            document.getElementById('deliveryDelivered').textContent = delivered;

            // متوسط وقت التوصيل
            const deliveredToday = deliveries?.filter(d => d.delivery_status === 'delivered' && d.delivered_at) || [];
            if (deliveredToday.length > 0) {
                const avgTime = deliveredToday.reduce((sum, d) => {
                    const time = (new Date(d.delivered_at) - new Date(d.created_at)) / 60000;
                    return sum + time;
                }, 0) / deliveredToday.length;

                document.getElementById('avgDeliveryTime').textContent = `${Math.round(avgTime)} دقيقة`;
            } else {
                document.getElementById('avgDeliveryTime').textContent = '0 دقيقة';
            }

        } catch (error) {
            console.error('Error loading delivery status:', error);
        }
    },

    // أكثر الأصناف مبيعاً
    async loadTopSellingItems(date) {
        try {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('menu_item_id, quantity, menu_item:menu_item_id(name_ar)')
                .gte('created_at', date);

            // تجميع حسب الصنف
            const itemsMap = {};
            for (const item of orderItems || []) {
                if (!itemsMap[item.menu_item_id]) {
                    itemsMap[item.menu_item_id] = {
                        name: item.menu_item?.name_ar,
                        quantity: 0
                    };
                }
                itemsMap[item.menu_item_id].quantity += item.quantity;
            }

            // ترتيب حسب الكمية
            const topItems = Object.values(itemsMap)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);

            const container = document.getElementById('topSellingItems');
            if (topItems.length > 0) {
                container.innerHTML = topItems.map((item, index) => `
                    <div style="display: flex; justify-content: space-between; padding: 10px; background: ${index === 0 ? '#fff3e0' : '#f9f9f9'}; border-radius: 6px; border-right: 3px solid ${index === 0 ? '#ff9800' : '#e0e0e0'};">
                        <span style="font-weight: ${index === 0 ? 'bold' : 'normal'};">
                            ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•'} ${item.name}
                        </span>
                        <span style="font-weight: bold; color: #667eea;">${item.quantity}</span>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">لا توجد بيانات</div>';
            }

        } catch (error) {
            console.error('Error loading top selling items:', error);
        }
    },

    // تحديث الإحصائيات تلقائياً
    async updateLiveStats() {
        await this.loadLiveStats();
    },

    // تغيير فلتر الوقت
    async setTimeFilter(filter) {
        this.currentTimeFilter = filter;
        
        document.querySelectorAll('.time-btn, .tab-btn').forEach(btn => {
            if (btn.textContent.includes('اليوم') || btn.textContent.includes('الأسبوع') || btn.textContent.includes('الشهر')) {
                btn.classList.remove('active');
            }
        });
        event.target.classList.add('active');

        let startDate;
        const today = new Date();

        if (filter === 'today') {
            startDate = today.toISOString().split('T')[0];
        } else if (filter === 'week') {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            startDate = weekAgo.toISOString().split('T')[0];
        } else if (filter === 'month') {
            const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            startDate = monthAgo.toISOString().split('T')[0];
        }

        await this.calculateProfit(startDate);
        await this.loadOrdersBreakdown(startDate);
        await this.loadTopSellingItems(startDate);
    },

    // سأكمل باقي الدوال في الرد التالي...
    // التبديل بين التبويبات
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (!btn.classList.contains('time-btn')) {
                btn.classList.remove('active');
            }
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        event.target.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
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
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.displayCurrentOrders(data);

        } catch (error) {
            console.error('Error loading current orders:', error);
        }
    },

    displayCurrentOrders(orders) {
        const tbody = document.getElementById('currentOrdersBody');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">لا توجد طلبات حالية</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>#${order.order_number}</strong></td>
                <td>${order.order_type === 'dine_in' ? '🍽️ داخلي' : '🛵 توصيل'}</td>
                <td>${order.order_type === 'dine_in' ? `طاولة ${order.table_number}` : order.deliveries[0]?.customer_name || '-'}</td>
                <td><span class="badge ${this.getStatusClass(order.status)}">${this.getStatusText(order.status)}</span></td>
                <td><strong>${Utils.formatCurrency(order.total)}</strong></td>
                <td>${Utils.formatTime(order.created_at)}</td>
            </tr>
        `).join('');
    },

    // تحميل جميع الطلبات
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
        }
    },

   displayOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    if (!tbody) return;

    tbody.innerHTML = orders.map(order => {
        // ✅ تحديد أيقونة طريقة الدفع
        const paymentIcons = {
            'cash': '💵 كاش',
            'visa': '💳 فيزا',
            'wallet': '📱 محفظة',
            'instapay': '⚡ انستاباي'
        };
        const paymentMethod = paymentIcons[order.payment_method] || '💵 كاش';

        return `
            <tr>
                <td><strong>#${order.order_number}</strong></td>
                <td>${Utils.formatDate(order.created_at)}</td>
                <td>${order.order_type === 'dine_in' ? '🍽️ داخلي' : '🛵 توصيل'}</td>
                <td>${order.order_type === 'dine_in' ? `طاولة ${order.table_number}` : order.deliveries[0]?.customer_name || '-'}</td>
                <td>${order.staff?.full_name || 'كاشير'}</td>
                <td><strong>${Utils.formatCurrency(order.total)}</strong></td>
                <td style="text-align: center; font-size: 13px;">${paymentMethod}</td>
                <td><span class="badge ${this.getStatusClass(order.status)}">${this.getStatusText(order.status)}</span></td>
            </tr>
        `;
    }).join('');
},

filterOrders() {
    const dateFrom = document.getElementById('orderDateFrom').value;
    const dateTo = document.getElementById('orderDateTo').value;
    const type = document.getElementById('orderTypeFilter').value;
    const status = document.getElementById('orderStatusFilter').value;

    let filtered = this.allOrders;

    if (dateFrom) {
        filtered = filtered.filter(order => order.created_at >= dateFrom);
    }
    if (dateTo) {
        filtered = filtered.filter(order => order.created_at <= dateTo + 'T23:59:59');
    }
    if (type) {
        filtered = filtered.filter(order => order.order_type === type);
    }
    if (status) {
        filtered = filtered.filter(order => order.status === status);
    }

    this.filteredOrders = filtered;
    this.displayOrders(filtered);
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
        }
    },

    displayUsers(users) {
        const tbody = document.getElementById('usersBody');
        if (!tbody) return;

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.full_name}</strong></td>
                <td>${user.username}</td>
                <td><span class="badge badge-info">${this.getRoleText(user.role)}</span></td>
                <td>${user.phone || '-'}</td>
                <td><span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">${user.is_active ? 'نشط' : 'معطل'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="AdminDashboard.editUser(${user.id})">✏️ تعديل</button>
                    <button class="btn btn-sm btn-danger" onclick="AdminDashboard.deleteUser(${user.id})">🗑️ حذف</button>
                </td>
            </tr>
        `).join('');
    },

    getRoleText(role) {
        const roles = {
            'admin': 'مدير',
            'cashier': 'كاشير',
            'staff': 'موظف',
            'kitchen': 'مطبخ'
        };
        return roles[role] || role;
    },

    // تحميل التوصيل
    async loadDeliveries() {
        try {
            const { data, error } = await supabase
                .from('deliveries')
                .select(`
                    *,
                    order:order_id(order_number)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            this.allDeliveries = data;
            this.displayDeliveries(data);

        } catch (error) {
            console.error('Error loading deliveries:', error);
        }
    },

    displayDeliveries(deliveries) {
        const tbody = document.getElementById('deliveriesBody');
        if (!tbody) return;

        tbody.innerHTML = deliveries.map(delivery => `
            <tr>
                <td><strong>#${delivery.order?.order_number}</strong></td>
                <td>${delivery.customer_name}</td>
                <td>${delivery.customer_phone}</td>
                <td>${delivery.customer_address}</td>
                <td>${delivery.driver_name || '-'}</td>
                <td>${Utils.formatCurrency(delivery.delivery_fee)}</td>
                <td><span class="badge ${this.getDeliveryStatusClass(delivery.delivery_status)}">${this.getDeliveryStatusText(delivery.delivery_status)}</span></td>
                <td>${Utils.formatTime(delivery.created_at)}</td>
            </tr>
        `).join('');
    },

    getDeliveryStatusClass(status) {
        const classes = {
            'preparing': 'badge-warning',
            'ready': 'badge-info',
            'on_way': 'badge-info',
            'delivered': 'badge-success'
        };
        return classes[status] || '';
    },

    getDeliveryStatusText(status) {
        const texts = {
            'preparing': 'قيد التحضير',
            'ready': 'جاهز',
            'on_way': 'في الطريق',
            'delivered': 'تم التوصيل'
        };
        return texts[status] || status;
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
            this.displayInventory(data);

        } catch (error) {
            console.error('Error loading inventory:', error);
        }
    },

    displayInventory(inventory) {
        const tbody = document.getElementById('inventoryBody');
        if (!tbody) return;

        tbody.innerHTML = inventory.map(item => {
            const status = this.getInventoryStatus(item);
            return `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td style="font-weight: bold; ${status === 'critical' ? 'color: #f44336;' : status === 'low' ? 'color: #ff9800;' : ''}">${item.current_stock.toFixed(2)}</td>
                    <td>${item.unit}</td>
                    <td>${item.min_stock.toFixed(2)}</td>
                    <td>${Utils.formatCurrency(item.cost_per_unit)}</td>
                    <td>${this.getInventoryStatusBadge(status)}</td>
                </tr>
            `;
        }).join('');
    },

    getInventoryStatus(item) {
        if (item.current_stock <= 0) return 'critical';
        if (item.current_stock <= item.min_stock) return 'low';
        return 'ok';
    },

    getInventoryStatusBadge(status) {
        const badges = {
            'ok': '<span class="badge badge-success">✅ متوفر</span>',
            'low': '<span class="badge badge-warning">⚠️ منخفض</span>',
            'critical': '<span class="badge badge-danger">🔴 حرج</span>'
        };
        return badges[status];
    },

    getStatusClass(status) {
        const classes = {
            'new': 'badge-warning',
            'preparing': 'badge-info',
            'ready': 'badge-success',
            'completed': 'badge-success',
            'cancelled': 'badge-danger'
        };
        return classes[status] || '';
    },

    getStatusText(status) {
        const texts = {
            'new': 'جديد',
            'preparing': 'قيد التحضير',
            'ready': 'جاهز',
            'completed': 'مكتمل',
            'cancelled': 'ملغي'
        };
        return texts[status] || status;
    },

    // إضافة مستخدم
    openAddUserModal() {
        document.getElementById('addUserModal').classList.add('active');
        document.getElementById('addUserForm').reset();
    },

    closeAddUserModal() {
        document.getElementById('addUserModal').classList.remove('active');
    },

    async saveUser(e) {
        e.preventDefault();

        const userData = {
            full_name: document.getElementById('userFullName').value,
            username: document.getElementById('userUsername').value,
            password: document.getElementById('userPassword').value,
            role: document.getElementById('userRole').value,
            phone: document.getElementById('userPhone').value || null,
            is_active: true
        };

        try {
            const { error } = await supabase
                .from('users')
                .insert([userData]);

            if (error) throw error;

            Utils.showNotification('تم إضافة المستخدم بنجاح', 'success');
            this.closeAddUserModal();
            await this.loadUsers();

        } catch (error) {
            console.error('Error saving user:', error);
            Utils.showNotification('حدث خطأ أثناء الحفظ', 'error');
        }
    },

    async deleteUser(userId) {
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            Utils.showNotification('تم حذف المستخدم', 'success');
            await this.loadUsers();

        } catch (error) {
            console.error('Error deleting user:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    // تصدير Excel
exportOrders() {
    const paymentLabels = {
        'cash': 'كاش',
        'visa': 'فيزا',
        'wallet': 'محفظة',
        'instapay': 'انستاباي'
    };

    const data = this.filteredOrders.map(order => ({
        'رقم الطلب': order.order_number,
        'التاريخ': Utils.formatDate(order.created_at),
        'النوع': order.order_type === 'dine_in' ? 'داخلي' : 'توصيل',
        'الطاولة/العميل': order.order_type === 'dine_in' ? `طاولة ${order.table_number}` : order.deliveries[0]?.customer_name || '-',
        'الموظف': order.staff?.full_name || 'كاشير',
        'الإجمالي': order.total,
        'طريقة الدفع': paymentLabels[order.payment_method] || 'كاش',  // ✅ أضف هذا السطر
        'الحالة': this.getStatusText(order.status)
    }));

    Utils.exportToExcel(data, 'الطلبات');
    Utils.showNotification('تم تصدير البيانات', 'success');
},

exportInventory() {
    const data = this.allInventory.map(item => ({
        'المكون': item.name,
        'الكمية الحالية': item.current_stock,
        'الوحدة': item.unit,
        'الحد الأدنى': item.min_stock,
        'التكلفة/الوحدة': item.cost_per_unit,
        'القيمة الإجمالية': (item.current_stock * item.cost_per_unit).toFixed(2),
        'الحالة': this.getInventoryStatus(item)
    }));

    Utils.exportToExcel(data, 'المخزون');
    Utils.showNotification('تم تصدير البيانات', 'success');
},
    // مستمعي الأحداث
    setupEventListeners() {
        const addUserForm = document.getElementById('addUserForm');
        if (addUserForm) {
            addUserForm.addEventListener('submit', (e) => this.saveUser(e));
        }
    },

    // Realtime subscriptions
    setupRealtimeSubscriptions() {
        Realtime.subscribeToOrders(() => {
            this.loadCurrentOrders();
            this.loadOrders();
            this.updateLiveStats();
        });

        Realtime.subscribeToInventory(() => {
            this.loadInventory();
            this.loadInventoryStats();
        });

        Realtime.subscribeToTable('deliveries', () => {
            this.loadDeliveries();
            this.loadDeliveryStatus(new Date().toISOString().split('T')[0]);
        });

        Realtime.subscribeToTable('tables', () => {
            this.loadTablesStatus();
        });
    }
};

if (typeof window !== 'undefined') {
    window.AdminDashboard = AdminDashboard;
}

console.log('✅ Admin Dashboard loaded with live stats');



// ========================================
// ✅ كود الطباعة المُحسّن - يعمل بدون مشاكل
// ========================================

(function() {
    console.log('🖨️ جاري تفعيل ميزة الطباعة...');

    // ✅ دالة الطباعة
    window.printOrderReceipt = function(orderData) {
        console.log('📦 طباعة فاتورة:', orderData);
        
        try {
            const deliveryInfo = (orderData.order_type === 'delivery' && orderData.deliveries && orderData.deliveries.length > 0) 
                ? orderData.deliveries[0] 
                : null;
            
            const paymentMethods = {
                'cash': 'كاش',
                'visa': 'فيزا',
                'card': 'بطاقة',
                'wallet': 'محفظة',
                'instapay': 'انستاباي'
            };
            
            const paymentMethod = paymentMethods[orderData.payment_method] || 'كاش';
            
            const receiptHTML = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>فاتورة #${orderData.order_number}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: Arial, Tahoma, sans-serif;
                            width: 72mm;
                            font-size: 13px;
                            font-weight: bold;
                            line-height: 1.5;
                            padding: 5mm;
                            margin: 0 auto;
                            color: #000;
                        }
                        .header { 
                            text-align: center;
                            border-bottom: 2px solid #000;
                            padding-bottom: 10px;
                            margin-bottom: 10px;
                        }
                        .header h2 { font-size: 18px; margin-bottom: 5px; }
                        .header p { font-size: 12px; margin: 3px 0; }
                        .payment-box {
                            background: #000;
                            color: #fff;
                            padding: 8px;
                            margin: 10px 0;
                            text-align: center;
                            font-weight: bold;
                        }
                        .info { font-size: 11px; margin-bottom: 10px; line-height: 1.6; }
                        .info div { margin: 3px 0; word-wrap: break-word; }
                        hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
                        .item { 
                            display: flex;
                            justify-content: space-between;
                            margin: 5px 0;
                            font-size: 12px;
                        }
                        .total { 
                            font-size: 16px;
                            border-top: 3px double #000;
                            padding: 10px 0;
                            margin: 10px 0;
                            display: flex;
                            justify-content: space-between;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 15px;
                            border-top: 2px solid #000;
                            padding-top: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>مطعم بلدي شيك</h2>
                        <p>فاتورة: ${orderData.order_number}</p>
                        <p>${new Date(orderData.created_at).toLocaleString('ar-EG')}</p>
                    </div>

                    <div class="payment-box">💳 ${paymentMethod}</div>

                    <div class="info">
                        ${orderData.order_type === 'delivery' && deliveryInfo ? `
                            <div>📦 العميل: ${deliveryInfo.customer_name || 'غير محدد'}</div>
                            ${deliveryInfo.customer_phone ? `<div>📞 ${deliveryInfo.customer_phone}</div>` : ''}
                            ${deliveryInfo.customer_address ? `<div>📍 ${deliveryInfo.customer_address}</div>` : ''}
                        ` : orderData.order_type === 'dine_in' ? `
                            <div>🍽️ طاولة: ${orderData.table_number || 'غير محدد'}</div>
                        ` : ''}
                    </div>

                    <hr>

                    ${orderData.order_items.map(item => `
                        <div class="item">
                            <span>${item.menu_item?.name_ar || 'صنف'} × ${item.quantity}</span>
                            <span>${(item.total_price || 0).toFixed(2)} ج.م</span>
                        </div>
                    `).join('')}

                    <hr>

                    <div class="item">
                        <span>المجموع:</span>
                        <span>${(orderData.subtotal || 0).toFixed(2)} ج.م</span>
                    </div>
                    
                    ${orderData.tax > 0 ? `
                        <div class="item">
                            <span>الضريبة (14%):</span>
                            <span>${(orderData.tax || 0).toFixed(2)} ج.م</span>
                        </div>
                    ` : ''}
                    
                    ${orderData.delivery_fee > 0 ? `
                        <div class="item">
                            <span>التوصيل:</span>
                            <span>${(orderData.delivery_fee || 0).toFixed(2)} ج.م</span>
                        </div>
                    ` : ''}

                    <div class="total">
                        <span>الإجمالي:</span>
                        <span>${(orderData.total || 0).toFixed(2)} ج.م</span>
                    </div>

                    <div class="footer">
                        <p>شكراً لزيارتكم بلدي شيك</p>
                        <p>نتمنى لكم يوماً سعيداً</p>
                    </div>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank', 'height=600,width=300');
            if (!printWindow) {
                alert('⚠️ يرجى السماح بالنوافذ المنبثقة للطباعة');
                return;
            }
            
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
            
            printWindow.onload = function() {
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    setTimeout(() => printWindow.close(), 500);
                }, 250);
            };
            
        } catch (error) {
            console.error('❌ خطأ في الطباعة:', error);
            alert('حدث خطأ في الطباعة: ' + error.message);
        }
    };

    // ✅ تعديل displayOrders
    const originalDisplay = AdminDashboard.displayOrders;
    AdminDashboard.displayOrders = function(orders) {
        const tbody = document.getElementById('ordersBody');
        if (!tbody) return;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #999;">لا توجد طلبات</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map((order, index) => {
            const paymentIcons = {
                'cash': '💵 كاش',
                'visa': '💳 فيزا',
                'wallet': '📱 محفظة',
                'instapay': '⚡ انستاباي'
            };
            const paymentMethod = paymentIcons[order.payment_method] || '💵 كاش';

            // حفظ البيانات في attribute
            const orderDataStr = btoa(encodeURIComponent(JSON.stringify(order)));

            return `
                <tr>
                    <td><strong>#${order.order_number}</strong></td>
                    <td>${new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>${order.order_type === 'dine_in' ? '🍽️ داخلي' : '🛵 توصيل'}</td>
                    <td>${order.order_type === 'dine_in' ? `طاولة ${order.table_number}` : order.deliveries?.[0]?.customer_name || '-'}</td>
                    <td>${order.staff?.full_name || 'كاشير'}</td>
                    <td><strong>${(order.total || 0).toFixed(2)} ج.م</strong></td>
                    <td style="text-align: center;">${paymentMethod}</td>
                    <td><span class="badge ${this.getStatusClass(order.status)}">${this.getStatusText(order.status)}</span></td>
                    <td style="text-align: center;">
                        ${order.status === 'completed' ? `
                            <button 
                                data-order="${orderDataStr}" 
                                onclick="printOrderReceipt(JSON.parse(decodeURIComponent(atob(this.getAttribute('data-order')))))"
                                style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: bold;"
                                title="طباعة">
                                🖨️
                            </button>
                        ` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    };

    console.log('✅ تم تفعيل ميزة الطباعة بنجاح!');
})();





