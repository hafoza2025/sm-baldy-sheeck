// js/cashier.js
// وظائف صفحة الكاشير مع التحكم الكامل في الفواتير

const CashierSystem = {
    currentUser: null,
    menuItems: [],
    openOrders: [],
    selectedOrder: null,
    itemToReplace: null,
    selectedOrderPaymentMethod: 'cash',  // ✅ طريقة الدفع للطلبات الموجودة
    newOrderCart: {
        type: 'delivery',
        items: [],
        customer_info: {},
        payment_method: 'cash'  // ✅ طريقة الدفع الافتراضية للطلب الجديد
    },

    currentEditCart: {
        items: []
    },
    // ======================================
// 🔒 دالة التحقق من صلاحية الأدمن
// ======================================
async verifyAdminAccess() {
    return new Promise(async (resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); display: flex;
            justify-content: center; align-items: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-width: 400px; width: 90%;">
                <h2 style="text-align: center; color: #667eea; margin-bottom: 20px; font-size: 22px;">🔒 تحقق من صلاحية الأدمن</h2>
                <p style="text-align: center; color: #666; margin-bottom: 20px; font-size: 14px;">يجب إدخال بيانات الأدمن للمتابعة</p>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">اسم المستخدم</label>
                    <input type="text" id="adminUsername" placeholder="أدخل اسم المستخدم" 
                        style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">كلمة المرور</label>
                    <input type="password" id="adminPassword" placeholder="أدخل كلمة المرور" autocomplete="off"
                        style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 15px; box-sizing: border-box;">
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button id="adminVerifyBtn" style="flex: 1; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">✅ تحقق</button>
                    <button id="adminCancelBtn" style="flex: 1; padding: 12px; background: #e53e3e; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">❌ إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const usernameInput = document.getElementById('adminUsername');
        const passwordInput = document.getElementById('adminPassword');
        const verifyBtn = document.getElementById('adminVerifyBtn');
        const cancelBtn = document.getElementById('adminCancelBtn');

        usernameInput.focus();
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') verifyBtn.click(); });

        verifyBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                Utils.showNotification('يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
                return;
            }

            try {
                // ✅ الحل: جلب كل البيانات من staff
                const { data: allStaff, error } = await supabase
                    .from('staff')
                    .select('*');

                if (error) {
                    console.error('Error:', error);
                    Utils.showNotification('❌ حدث خطأ في التحقق', 'error');
                    return;
                }

                // ✅ البحث عن المستخدم يدوياً
                const user = allStaff?.find(s => 
                    s.username && s.username.toLowerCase() === username.toLowerCase()
                );

                if (!user) {
                    Utils.showNotification('❌ اسم المستخدم غير موجود', 'error');
                    usernameInput.focus();
                    return;
                }

                if (user.password !== password) {
                    Utils.showNotification('❌ كلمة المرور غير صحيحة', 'error');
                    passwordInput.value = '';
                    passwordInput.focus();
                    return;
                }

                if (user.role && user.role.toLowerCase() !== 'admin') {
                    Utils.showNotification('❌ ليس لديك صلاحية أدمن', 'error');
                    return;
                }

                Utils.showNotification('✅ تم التحقق بنجاح', 'success');
                document.body.removeChild(modal);
                resolve(true);

            } catch (error) {
                console.error('Unexpected Error:', error);
                Utils.showNotification('❌ حدث خطأ غير متوقع', 'error');
                resolve(false);
            }
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
},




    // التهيئة
    async init() {
        this.currentUser = Auth.checkAuth(['cashier']);
        if (!this.currentUser) return;

        document.getElementById('cashierName').textContent = this.currentUser.full_name;

        await this.loadMenu();
        await this.loadOpenOrders();
        this.setupEventListeners();
        this.setupRealtimeSubscriptions();
        this.updatePaymentButtons();  // ✅ أضف هذا السطر هنا

    },

    // تحميل المنيو
    async loadMenu() {
        try {
            const { data, error } = await supabase
                .from('menu_items')
                .select('*')
                .eq('is_available', true)
                .order('category', { ascending: true });

            if (error) throw error;

            this.menuItems = data;
            this.displayMenu(data);
            this.displayCategories(data);

        } catch (error) {
            console.error('Error loading menu:', error);
            Utils.showNotification('خطأ في تحميل المنيو', 'error');
        }
    },

    displayMenu(items) {
        const container = document.getElementById('menuGrid');
        if (!container) return;

        container.innerHTML = items.map(item => `
            <div class="menu-item" onclick="CashierSystem.addItemToCart(${item.id})">
                <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.name_ar}">
                <h4>${item.name_ar}</h4>
                <div class="price">${Utils.formatCurrency(item.price)}</div>
            </div>
        `).join('');
    },

    displayCategories(items) {
        const categories = [...new Set(items.map(item => item.category))];
        const container = document.getElementById('categoryTabs');
        if (!container) return;

        container.innerHTML = `
            <button class="category-tab active" onclick="CashierSystem.filterByCategory('all')">الكل</button>
            ${categories.map(cat => `
                <button class="category-tab" onclick="CashierSystem.filterByCategory('${cat}')">${cat}</button>
            `).join('')}
        `;
    },

    filterByCategory(category) {
        const filtered = category === 'all'
            ? this.menuItems
            : this.menuItems.filter(item => item.category === category);

        this.displayMenu(filtered);

        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
    },

    // تحميل الفواتير المفتوحة
    async loadOpenOrders() {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items(
                        *,
                        menu_item:menu_item_id(name_ar, price)
                    ),
                    staff:staff_id(full_name),
                    deliveries(*)
                `)
                .in('status', ['new', 'preparing', 'ready'])
                .order('created_at', { ascending: true });

            if (error) throw error;

            this.openOrders = data;
            this.displayOpenOrders(data);

        } catch (error) {
            console.error('Error loading orders:', error);
            Utils.showNotification('خطأ في تحميل الطلبات', 'error');
        }
    },

    // عرض الفواتير المفتوحة
   displayOpenOrders(orders) {
    const container = document.getElementById('openOrdersList');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <h3>لا توجد فواتير مفتوحة</h3>
                <p>انتظر طلبات جديدة من الموظفين</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const itemsCount = order.order_items?.length || 0;
        const isSelected = this.selectedOrder?.id === order.id;
        
        // ✅ حماية البيانات
        const deliveryInfo = (order.deliveries && order.deliveries.length > 0) ? order.deliveries[0] : null;

        return `
            <div class="order-card ${isSelected ? 'selected' : ''}" 
                 style="cursor: pointer; margin-bottom: 15px; padding: 15px; border: 2px solid ${isSelected ? '#667eea' : '#e0e0e0'}; border-radius: 10px; background: ${isSelected ? '#f0f4ff' : 'white'};">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <h3 style="margin: 0; font-size: 20px;">
                            ${order.order_type === 'delivery' ? '🛵' : '🍽️'} 
                            ${order.order_type === 'delivery'
                                ? (deliveryInfo ? deliveryInfo.customer_name : 'عميل')
                                : `طاولة ${order.table_number}`}
                        </h3>
                        <small style="color: #666;">الطلب #${order.order_number}</small>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 20px; font-weight: bold; color: #667eea;">
                            ${Utils.formatCurrency(order.total)}
                        </div>
                        <small style="color: #666;">${itemsCount} صنف</small>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; font-size: 12px; color: #666; margin-bottom: 10px;">
                    <span>⏰ ${Utils.formatTime(order.created_at)}</span>
                    <span>👤 ${order.staff?.full_name || 'كاشير'}</span>
                    <span class="badge ${this.getStatusClass(order.status)}">
                        ${this.getStatusText(order.status)}
                    </span>
                </div>

                <div style="background: #f9f9f9; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <strong style="font-size: 13px;">الأصناف:</strong>
                    <div style="margin-top: 5px;">
                        ${order.order_items.slice(0, 3).map(item => `
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0;">
                                <span>${item.menu_item?.name_ar} × ${item.quantity}</span>
                                <span>${Utils.formatCurrency(item.total_price)}</span>
                            </div>
                        `).join('')}
                        ${order.order_items.length > 3 ? `<small style="color: #666;">و ${order.order_items.length - 3} أصناف أخرى...</small>` : ''}
                    </div>
                </div>

                <div style="padding: 10px; background: #f5f5f5; border-radius: 8px; margin-bottom: 10px;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 5px; text-align: center;">💳 طريقة الدفع</div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                        ${['cash', 'visa', 'wallet', 'instapay'].map(m => {
                            const icons = { cash: '💵', visa: '💳', wallet: '📱', instapay: '⚡' };
                            const labels = { cash: 'كاش', visa: 'فيزا', wallet: 'محفظة', instapay: 'انستا' };
                            const active = (order.payment_method || 'cash') === m;
                            return `<button class="mini-payment-btn" data-order-id="${order.id}" data-method="${m}" 
                                style="padding: 8px 5px; font-size: 11px; border: 2px solid ${active ? '#667eea' : '#e0e0e0'}; 
                                border-radius: 6px; background: ${active ? '#f0f4ff' : 'white'}; cursor: pointer; text-align: center; transition: all 0.3s;">
                                ${icons[m]}<br>${labels[m]}
                            </button>`;
                        }).join('')}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
                    <button onclick="event.stopPropagation(); CashierSystem.selectOrderForEdit(${order.id})" 
                            class="btn btn-info" 
                            style="padding: 8px; font-size: 12px;">
                        ➕ إضافة
                    </button>
                    
                    <button onclick="event.stopPropagation(); CashierSystem.selectOrderForFullEdit(${order.id})" 
                            class="btn btn-warning" 
                            style="padding: 8px; font-size: 12px;">
                        ✏️ تعديل
                    </button>
                    
                    <button onclick="event.stopPropagation(); CashierSystem.closeAndPrintOrder(${order.id})" 
                            class="btn btn-success" 
                            style="padding: 8px; font-size: 12px;">
                        ✅ إغلاق
                    </button>
                </div>
            </div>
        `;
    }).join('');
},



    getStatusClass(status) {
        const classes = {
            'new': 'badge-warning',
            'preparing': 'badge-info',
            'ready': 'badge-success'
        };
        return classes[status] || '';
    },

    getStatusText(status) {
        const texts = {
            'new': 'جديد',
            'preparing': 'قيد التحضير',
            'ready': 'جاهز'
        };
        return texts[status] || status;
    },

    // ==================== إضافة أصناف فقط ====================
    
    selectOrderForEdit(orderId) {
        const order = this.openOrders.find(o => o.id === orderId);
        if (!order) return;

        this.selectedOrder = order;
        this.selectedOrderPaymentMethod = order.payment_method || 'cash';  // ✅ تحميل طريقة الدفع الحالية
        this.currentEditCart.items = [];

        this.displayOpenOrders(this.openOrders);
        this.displayEditSection();

        Utils.showNotification(
            order.order_type === 'delivery'
                ? `تم اختيار طلب ${order.deliveries[0]?.customer_name}`
                : `تم اختيار فاتورة طاولة ${order.table_number}`,
            'success'
        );

        document.getElementById('editSection').style.display = 'block';
        document.getElementById('newOrderSection').style.display = 'none';
    },

    displayEditSection() {
        const container = document.getElementById('editOrderItems');
        if (!container || !this.selectedOrder) return;

        const orderInfo = `
            <div style="background: #667eea; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 5px 0;">
                    ${this.selectedOrder.order_type === 'delivery'
                        ? `🛵 ${this.selectedOrder.deliveries[0]?.customer_name}`
                        : `🍽️ طاولة ${this.selectedOrder.table_number}`}
                </h3>
                <small>الطلب #${this.selectedOrder.order_number}</small>
            </div>
        `;

        const existingItems = `
            <div style="background: #f9f9f9; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <strong style="color: #666;">الأصناف الموجودة:</strong>
                ${this.selectedOrder.order_items.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px;">
                        <span>${item.menu_item?.name_ar} × ${item.quantity}</span>
                        <span>${Utils.formatCurrency(item.total_price)}</span>
                    </div>
                `).join('')}
                <div style="border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px; font-weight: bold;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>المجموع الحالي:</span>
                        <span style="color: #667eea;">${Utils.formatCurrency(this.selectedOrder.total)}</span>
                    </div>
                </div>
            </div>
        `;

        const newItems = this.currentEditCart.items.length > 0 ? `
            <div style="background: #fff3cd; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                <strong style="color: #856404;">أصناف جديدة:</strong>
                ${this.currentEditCart.items.map((item, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0;">
                        <div style="flex: 1;">
                            <div style="font-size: 14px;">${item.name}</div>
                            <small style="color: #666;">${Utils.formatCurrency(item.unit_price)}</small>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <button onclick="CashierSystem.decreaseEditQuantity(${index})" class="qty-btn">-</button>
                            <span style="width: 30px; text-align: center; font-weight: bold;">${item.quantity}</span>
                            <button onclick="CashierSystem.increaseEditQuantity(${index})" class="qty-btn">+</button>
                            <button onclick="CashierSystem.removeEditItem(${index})" class="item-remove">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const newItemsTotal = this.currentEditCart.items.reduce((sum, item) => sum + item.total_price, 0);
        const newTax = Utils.calculateTax(newItemsTotal);
        const newTotal = this.selectedOrder.total + newItemsTotal + newTax;

        const summary = this.currentEditCart.items.length > 0 ? `
            <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #667eea;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>المجموع السابق:</span>
                    <span>${Utils.formatCurrency(this.selectedOrder.total)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #856404;">
                    <span>الأصناف الجديدة:</span>
                    <span>${Utils.formatCurrency(newItemsTotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #856404;">
                    <span>ضريبة الأصناف الجديدة:</span>
                    <span>${Utils.formatCurrency(newTax)}</span>
                </div>
                <div style="border-top: 2px solid #667eea; padding-top: 10px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #667eea;">
                        <span>الإجمالي الجديد:</span>
                        <span>${Utils.formatCurrency(newTotal)}</span>
                    </div>
                </div>
            </div>
        ` : '';

        container.innerHTML = orderInfo + existingItems + newItems + summary;
    },

    // ==================== التحكم الكامل في الفاتورة ====================

  async selectOrderForFullEdit(orderId) {
    // ✅ التحقق من صلاحية الأدمن أولاً
    const hasAccess = await this.verifyAdminAccess();
    
    if (!hasAccess) {
        Utils.showNotification('❌ لم يتم التحقق من الصلاحية', 'error');
        return;
    }

    const order = this.openOrders.find(o => o.id === orderId);
    if (!order) return;


        this.selectedOrder = order;
        this.currentEditCart.items = [];

        this.displayOpenOrders(this.openOrders);
        this.displayFullEditSection();

        const orderType = order.order_type === 'delivery'
            ? `طلب ${order.deliveries[0]?.customer_name}`
            : `فاتورة طاولة ${order.table_number}`;

        Utils.showNotification(`تم اختيار ${orderType} للتعديل الكامل`, 'success');

        document.getElementById('editSection').style.display = 'block';
        document.getElementById('newOrderSection').style.display = 'none';
    },

    displayFullEditSection() {
        const container = document.getElementById('editOrderItems');
        if (!container || !this.selectedOrder) return;

        const orderInfo = `
            <div style="background: #667eea; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0 0 8px 0; font-size: 22px;">
                            ${this.selectedOrder.order_type === 'delivery'
                                ? `🛵 ${this.selectedOrder.deliveries[0]?.customer_name}`
                                : `🍽️ طاولة ${this.selectedOrder.table_number}`}
                        </h3>
                        <div style="font-size: 14px; opacity: 0.9;">
                            الطلب #${this.selectedOrder.order_number} • 
                            ${Utils.formatTime(this.selectedOrder.created_at)}
                        </div>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 28px; font-weight: bold;" id="currentOrderTotal">
                            ${Utils.formatCurrency(this.selectedOrder.total)}
                        </div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${this.selectedOrder.order_items?.length || 0} صنف
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingItems = `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #e0e0e0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="margin: 0; color: #333;">📋 الأصناف الموجودة</h4>
                    <button class="btn btn-danger btn-sm" onclick="CashierSystem.clearAllOrderItems()" style="font-size: 12px;">
                        🗑️ حذف الكل
                    </button>
                </div>
                ${this.selectedOrder.order_items.map(item => `
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-right: 3px solid #667eea;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 15px; margin-bottom: 5px; color: #333;">
                                    ${item.menu_item?.name_ar}
                                </div>
                                <div style="font-size: 13px; color: #666;">
                                    ${Utils.formatCurrency(item.unit_price)} × ${item.quantity} = 
                                    <strong style="color: #667eea;">${Utils.formatCurrency(item.total_price)}</strong>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div style="display: flex; gap: 5px; align-items: center; background: white; padding: 5px 10px; border-radius: 6px;">
                                    <button class="qty-btn" onclick="CashierSystem.decreaseItemQuantity(${item.id})" style="width: 28px; height: 28px; font-size: 14px;">-</button>
                                    <span style="min-width: 30px; text-align: center; font-weight: bold; font-size: 14px;">${item.quantity}</span>
                                    <button class="qty-btn" onclick="CashierSystem.increaseItemQuantity(${item.id})" style="width: 28px; height: 28px; font-size: 14px;">+</button>
                                </div>
                                
                                <button class="btn btn-info btn-sm" onclick="CashierSystem.openReplaceItemModal(${item.id})" 
                                        style="padding: 8px 12px; font-size: 12px;" title="استبدال">
                                    🔄
                                </button>
                                
                                <button class="btn btn-danger btn-sm" onclick="CashierSystem.deleteOrderItem(${item.id})" 
                                        style="padding: 8px 12px; font-size: 12px;" title="حذف">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const newItems = this.currentEditCart.items.length > 0 ? `
            <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #ff9800;">
                <h4 style="margin: 0 0 15px 0; color: #856404;">➕ أصناف جديدة</h4>
                ${this.currentEditCart.items.map((item, index) => `
                    <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 14px;">${item.name}</div>
                            <div style="font-size: 12px; color: #666;">${Utils.formatCurrency(item.unit_price)} × ${item.quantity}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <button class="qty-btn" onclick="CashierSystem.decreaseNewItemQuantity(${index})">-</button>
                            <span style="width: 30px; text-align: center; font-weight: bold;">${item.quantity}</span>
                            <button class="qty-btn" onclick="CashierSystem.increaseNewItemQuantity(${index})">+</button>
                            <button class="item-remove" onclick="CashierSystem.removeNewItem(${index})">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const actions = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20px;">
                <button class="btn btn-primary" onclick="CashierSystem.addItemToCart" style="width: 100%;">
                    ➕ إضافة صنف
                </button>
                <button class="btn btn-success" onclick="CashierSystem.saveAllChanges()" style="width: 100%;">
                    💾 حفظ التعديلات
                </button>
                <button class="btn btn-danger" onclick="CashierSystem.cancelFullOrder()" style="width: 100%;">
                    ❌ إلغاء الفاتورة
                </button>
                <button class="btn btn-secondary" onclick="CashierSystem.cancelEdit()" style="width: 100%;">
                    🔙 إلغاء التعديل
                </button>
            </div>
        `;

        container.innerHTML = orderInfo + existingItems + newItems + actions;
    },

    // سأكمل في الرد التالي بسبب الطول...
    // زيادة/تقليل كمية صنف موجود
    async increaseItemQuantity(itemId) {
        if (!confirm('هل تريد زيادة الكمية؟\nسيتم إشعار المطبخ بالتعديل')) return;

        try {
            const item = this.selectedOrder.order_items.find(i => i.id === itemId);
            if (!item) return;

            const newQuantity = item.quantity + 1;
            const newTotalPrice = newQuantity * item.unit_price;

            const { error } = await supabase
                .from('order_items')
                .update({
                    quantity: newQuantity,
                    total_price: newTotalPrice
                })
                .eq('id', itemId);

            if (error) throw error;

            await this.deductInventoryForNewItem(item.menu_item_id, 1);
            await this.recalculateOrderTotal();
            await this.notifyKitchenOfChange('تم زيادة كمية صنف');

            Utils.showNotification('تم زيادة الكمية ✅', 'success');

        } catch (error) {
            console.error('Error increasing quantity:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    async decreaseItemQuantity(itemId) {
        const item = this.selectedOrder.order_items.find(i => i.id === itemId);
        if (!item) return;

        if (item.quantity <= 1) {
            Utils.showNotification('لا يمكن تقليل الكمية أكثر. استخدم زر الحذف', 'warning');
            return;
        }

        if (!confirm('هل تريد تقليل الكمية؟\nسيتم إشعار المطبخ بالتعديل')) return;

        try {
            const newQuantity = item.quantity - 1;
            const newTotalPrice = newQuantity * item.unit_price;

            const { error } = await supabase
                .from('order_items')
                .update({
                    quantity: newQuantity,
                    total_price: newTotalPrice
                })
                .eq('id', itemId);

            if (error) throw error;

            await this.returnInventoryForQuantity(item.menu_item_id, 1);
            await this.recalculateOrderTotal();
            await this.notifyKitchenOfChange('تم تقليل كمية صنف');

            Utils.showNotification('تم تقليل الكمية ✅', 'success');

        } catch (error) {
            console.error('Error decreasing quantity:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    async deleteOrderItem(itemId) {
        const item = this.selectedOrder.order_items.find(i => i.id === itemId);
        if (!item) return;

        if (!confirm(`هل تريد حذف "${item.menu_item?.name_ar}"؟\n⚠️ سيتم إشعار المطبخ فوراً`)) return;

        try {
            const { error } = await supabase
                .from('order_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;

            await this.returnInventoryForItem(item);
            await this.recalculateOrderTotal();
            await this.notifyKitchenOfChange(`تم حذف: ${item.menu_item?.name_ar}`);

            Utils.showNotification('تم حذف الصنف ✅', 'success');

        } catch (error) {
            console.error('Error deleting item:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    async clearAllOrderItems() {
        if (!confirm('⚠️ هل تريد حذف جميع الأصناف؟\nسيتم إشعار المطبخ فوراً')) return;

        try {
            for (const item of this.selectedOrder.order_items) {
                await this.returnInventoryForItem(item);
            }

            const { error } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', this.selectedOrder.id);

            if (error) throw error;

            await this.recalculateOrderTotal();
            await this.notifyKitchenOfChange('⚠️ تم حذف جميع الأصناف');

            Utils.showNotification('تم حذف جميع الأصناف ✅', 'success');

        } catch (error) {
            console.error('Error clearing items:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    async cancelFullOrder() {
        if (!this.selectedOrder) return;

        const confirmMsg = `⚠️ هل تريد إلغاء الفاتورة بالكامل؟\n\nالطلب: #${this.selectedOrder.order_number}\nالإجمالي: ${Utils.formatCurrency(this.selectedOrder.total)}\n\n⚠️ لا يمكن التراجع عن هذا`;

        if (!confirm(confirmMsg)) return;

        try {
            for (const item of this.selectedOrder.order_items) {
                await this.returnInventoryForItem(item);
            }

            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', this.selectedOrder.id);

            if (error) throw error;

            if (this.selectedOrder.order_type === 'dine_in' && this.selectedOrder.table_number) {
                await supabase
                    .from('tables')
                    .update({
                        status: 'available',
                        current_order_id: null
                    })
                    .eq('table_number', this.selectedOrder.table_number);
            }

            await this.notifyKitchenOfChange(`❌ تم إلغاء الطلب #${this.selectedOrder.order_number}`);

            Utils.showNotification('تم إلغاء الفاتورة بالكامل', 'success');

            this.selectedOrder = null;
            await this.loadOpenOrders();
            document.getElementById('editSection').style.display = 'none';
            document.getElementById('newOrderSection').style.display = 'block';

        } catch (error) {
            console.error('Error canceling order:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    openReplaceItemModal(itemId) {
        const item = this.selectedOrder.order_items.find(i => i.id === itemId);
        if (!item) return;

        this.itemToReplace = item;

        const modal = document.createElement('div');
        modal.id = 'replaceItemModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2>🔄 استبدال الصنف</h2>
                    <span class="close-modal" onclick="CashierSystem.closeReplaceModal()">×</span>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">الصنف الحالي:</h4>
                    <div style="font-weight: 600; font-size: 16px;">${item.menu_item?.name_ar}</div>
                    <div style="color: #666; font-size: 14px;">
                        ${Utils.formatCurrency(item.unit_price)} × ${item.quantity} = ${Utils.formatCurrency(item.total_price)}
                    </div>
                </div>

                <h4 style="margin-bottom: 15px;">اختر الصنف البديل:</h4>
                
                <div style="max-height: 400px; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
                        ${this.menuItems.map(menuItem => `
                            <div onclick="CashierSystem.confirmReplace(${menuItem.id})" 
                                 style="cursor: pointer; padding: 15px; background: #f9f9f9; border-radius: 8px; text-align: center; transition: all 0.3s; border: 2px solid transparent;">
                                <img src="${menuItem.image_url || 'https://via.placeholder.com/100'}" 
                                     style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
                                <div style="font-weight: 600; font-size: 14px; margin-bottom: 5px;">${menuItem.name_ar}</div>
                                <div style="color: #667eea; font-weight: bold;">${Utils.formatCurrency(menuItem.price)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    closeReplaceModal() {
        const modal = document.getElementById('replaceItemModal');
        if (modal) modal.remove();
        this.itemToReplace = null;
    },

    async confirmReplace(newMenuItemId) {
        if (!this.itemToReplace) return;

        const newMenuItem = this.menuItems.find(m => m.id === newMenuItemId);
        if (!newMenuItem) return;

        if (!confirm(`استبدال "${this.itemToReplace.menu_item?.name_ar}" بـ "${newMenuItem.name_ar}"?\n⚠️ سيتم إشعار المطبخ`)) return;

        try {
            await this.returnInventoryForItem(this.itemToReplace);

            const newTotalPrice = newMenuItem.price * this.itemToReplace.quantity;

            const { error } = await supabase
                .from('order_items')
                .update({
                    menu_item_id: newMenuItemId,
                    unit_price: newMenuItem.price,
                    total_price: newTotalPrice
                })
                .eq('id', this.itemToReplace.id);

            if (error) throw error;

            await this.deductInventoryForNewItem(newMenuItemId, this.itemToReplace.quantity);
            await this.recalculateOrderTotal();
            await this.notifyKitchenOfChange(`🔄 استبدال: ${this.itemToReplace.menu_item?.name_ar} → ${newMenuItem.name_ar}`);

            Utils.showNotification('تم الاستبدال بنجاح ✅', 'success');
            this.closeReplaceModal();

        } catch (error) {
            console.error('Error replacing item:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    async recalculateOrderTotal() {
        try {
            const { data: items, error } = await supabase
                .from('order_items')
                .select('total_price')
                .eq('order_id', this.selectedOrder.id);

            if (error) throw error;

            const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
            const tax = Utils.calculateTax(subtotal);
            const total = subtotal + tax + (this.selectedOrder.delivery_fee || 0) - (this.selectedOrder.discount || 0);

            await supabase
                .from('orders')
                .update({
                    subtotal: subtotal,
                    tax: tax,
                    total: total
                })
                .eq('id', this.selectedOrder.id);

            await this.loadOpenOrders();
            this.selectedOrder = this.openOrders.find(o => o.id === this.selectedOrder.id);
            this.displayFullEditSection();

        } catch (error) {
            console.error('Error recalculating total:', error);
        }
    },

    async returnInventoryForItem(item) {
        try {
            const { data: recipes } = await supabase
                .from('recipes')
                .select('ingredient_id, quantity_needed')
                .eq('menu_item_id', item.menu_item_id);

            for (const recipe of recipes || []) {
                const totalUsed = recipe.quantity_needed * item.quantity;

                const { data: ingredient } = await supabase
                    .from('ingredients')
                    .select('current_stock')
                    .eq('id', recipe.ingredient_id)
                    .single();

                if (ingredient) {
                    const newStock = ingredient.current_stock + totalUsed;

                    await supabase
                        .from('ingredients')
                        .update({ current_stock: newStock })
                        .eq('id', recipe.ingredient_id);

                    await supabase
                        .from('inventory_transactions')
                        .insert([{
                            ingredient_id: recipe.ingredient_id,
                            order_id: this.selectedOrder.id,
                            quantity_used: -totalUsed,
                            transaction_type: 'return',
                            notes: `إرجاع من حذف ${item.menu_item?.name_ar}`
                        }]);
                }
            }
        } catch (error) {
            console.error('Error returning inventory:', error);
        }
    },

    async returnInventoryForQuantity(menuItemId, quantity) {
        try {
            const { data: recipes } = await supabase
                .from('recipes')
                .select('ingredient_id, quantity_needed')
                .eq('menu_item_id', menuItemId);

            for (const recipe of recipes || []) {
                const totalToReturn = recipe.quantity_needed * quantity;

                const { data: ingredient } = await supabase
                    .from('ingredients')
                    .select('current_stock')
                    .eq('id', recipe.ingredient_id)
                    .single();

                if (ingredient) {
                    await supabase
                        .from('ingredients')
                        .update({ current_stock: ingredient.current_stock + totalToReturn })
                        .eq('id', recipe.ingredient_id);
                }
            }
        } catch (error) {
            console.error('Error returning inventory:', error);
        }
    },

    async deductInventoryForNewItem(menuItemId, quantity) {
        try {
            const { data: recipes } = await supabase
                .from('recipes')
                .select('ingredient_id, quantity_needed')
                .eq('menu_item_id', menuItemId);

            for (const recipe of recipes || []) {
                const totalNeeded = recipe.quantity_needed * quantity;

                const { data: ingredient } = await supabase
                    .from('ingredients')
                    .select('current_stock')
                    .eq('id', recipe.ingredient_id)
                    .single();

                if (ingredient) {
                    const newStock = Math.max(0, ingredient.current_stock - totalNeeded);

                    await supabase
                        .from('ingredients')
                        .update({ current_stock: newStock })
                        .eq('id', recipe.ingredient_id);

                    await supabase
                        .from('inventory_transactions')
                        .insert([{
                            ingredient_id: recipe.ingredient_id,
                            order_id: this.selectedOrder.id,
                            quantity_used: totalNeeded,
                            transaction_type: 'deduct'
                        }]);
                }
            }
        } catch (error) {
            console.error('Error deducting inventory:', error);
        }
    },

    async notifyKitchenOfChange(changeDescription) {
        try {
            await supabase
                .from('orders')
                .update({
                    special_notes: `🔔 ${changeDescription} - ${Utils.formatTime(new Date())}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.selectedOrder.id);

            Utils.sendTelegramNotification(
                `🔔 <b>تعديل على طلب!</b>\n` +
                `الطلب: #${this.selectedOrder.order_number}\n` +
                `التعديل: ${changeDescription}\n` +
                `بواسطة: ${this.currentUser.full_name}`
            );

        } catch (error) {
            console.error('Error notifying kitchen:', error);
        }
    },

    async saveAllChanges() {
        if (!this.selectedOrder) return;

        if (this.currentEditCart.items.length > 0) {
            await this.saveEditedOrder();
        }

        Utils.showNotification('تم حفظ جميع التعديلات ✅', 'success');

        this.selectedOrder = null;
        this.currentEditCart.items = [];
        await this.loadOpenOrders();
        document.getElementById('editSection').style.display = 'none';
        document.getElementById('newOrderSection').style.display = 'block';
    },

    // ==================== باقي الدوال ====================

    addItemToCart(menuItemId) {
        const item = this.menuItems.find(m => m.id === menuItemId);
        if (!item) return;

        if (this.selectedOrder) {
            const existingItem = this.currentEditCart.items.find(i => i.menu_item_id === menuItemId);

            if (existingItem) {
                existingItem.quantity++;
                existingItem.total_price = existingItem.quantity * existingItem.unit_price;
            } else {
                this.currentEditCart.items.push({
                    menu_item_id: menuItemId,
                    name: item.name_ar,
                    quantity: 1,
                    unit_price: item.price,
                    total_price: item.price
                });
            }

            this.displayEditSection();
        } else {
            const existingItem = this.newOrderCart.items.find(i => i.menu_item_id === menuItemId);

            if (existingItem) {
                existingItem.quantity++;
                existingItem.total_price = existingItem.quantity * existingItem.unit_price;
            } else {
                this.newOrderCart.items.push({
                    menu_item_id: menuItemId,
                    name: item.name_ar,
                    quantity: 1,
                    unit_price: item.price,
                    total_price: item.price
                });
            }

            this.updateNewOrderDisplay();
        }

        Utils.showNotification(`تم إضافة ${item.name_ar}`, 'success');
    },

    increaseEditQuantity(index) {
        this.currentEditCart.items[index].quantity++;
        this.currentEditCart.items[index].total_price =
            this.currentEditCart.items[index].quantity * this.currentEditCart.items[index].unit_price;
        this.displayEditSection();
    },

    decreaseEditQuantity(index) {
        if (this.currentEditCart.items[index].quantity > 1) {
            this.currentEditCart.items[index].quantity--;
            this.currentEditCart.items[index].total_price =
                this.currentEditCart.items[index].quantity * this.currentEditCart.items[index].unit_price;
            this.displayEditSection();
        }
    },

    removeEditItem(index) {
        this.currentEditCart.items.splice(index, 1);
        this.displayEditSection();
    },

    increaseNewItemQuantity(index) {
        this.currentEditCart.items[index].quantity++;
        this.currentEditCart.items[index].total_price =
            this.currentEditCart.items[index].quantity * this.currentEditCart.items[index].unit_price;
        this.displayFullEditSection();
    },

    decreaseNewItemQuantity(index) {
        if (this.currentEditCart.items[index].quantity > 1) {
            this.currentEditCart.items[index].quantity--;
            this.currentEditCart.items[index].total_price =
                this.currentEditCart.items[index].quantity * this.currentEditCart.items[index].unit_price;
            this.displayFullEditSection();
        }
    },

    removeNewItem(index) {
        this.currentEditCart.items.splice(index, 1);
        this.displayFullEditSection();
    },

    async saveEditedOrder() {
        if (!this.selectedOrder || this.currentEditCart.items.length === 0) {
            Utils.showNotification('لا توجد تعديلات لحفظها', 'error');
            return;
        }

        try {
            const orderItems = this.currentEditCart.items.map(item => ({
                order_id: this.selectedOrder.id,
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            const newItemsTotal = this.currentEditCart.items.reduce((sum, item) => sum + item.total_price, 0);
            const newTax = Utils.calculateTax(newItemsTotal);
            const newSubtotal = this.selectedOrder.subtotal + newItemsTotal;
            const newTotalTax = this.selectedOrder.tax + newTax;
            const newTotal = newSubtotal + newTotalTax + (this.selectedOrder.delivery_fee || 0) - (this.selectedOrder.discount || 0);

            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    subtotal: newSubtotal,
                    tax: newTotalTax,
                    total: newTotal
                })
                .eq('id', this.selectedOrder.id);

            if (updateError) throw updateError;

            await this.deductInventory(this.selectedOrder.id, this.currentEditCart.items);

            Utils.showNotification('تم حفظ التعديلات بنجاح', 'success');

            this.currentEditCart.items = [];
            this.selectedOrder = null;
            await this.loadOpenOrders();
            document.getElementById('editSection').style.display = 'none';
            document.getElementById('newOrderSection').style.display = 'block';

        } catch (error) {
            console.error('Error saving edits:', error);
            Utils.showNotification('حدث خطأ أثناء الحفظ', 'error');
        }
    },

    cancelEdit() {
        this.currentEditCart.items = [];
        this.selectedOrder = null;
        this.displayOpenOrders(this.openOrders);
        document.getElementById('editSection').style.display = 'none';
        document.getElementById('newOrderSection').style.display = 'block';
    },

    updateNewOrderDisplay() {
        const container = document.getElementById('orderItems');
        if (!container) return;

        container.innerHTML = this.newOrderCart.items.map((item, index) => `
            <div class="order-item">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <div>${Utils.formatCurrency(item.unit_price)}</div>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="CashierSystem.decreaseNewQuantity(${index})">-</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="CashierSystem.increaseNewQuantity(${index})">+</button>
                    <button class="item-remove" onclick="CashierSystem.removeNewItem(${index})">🗑️</button>
                </div>
            </div>
        `).join('');

        this.calculateNewOrderTotal();
    },

    increaseNewQuantity(index) {
        this.newOrderCart.items[index].quantity++;
        this.newOrderCart.items[index].total_price =
            this.newOrderCart.items[index].quantity * this.newOrderCart.items[index].unit_price;
        this.updateNewOrderDisplay();
    },

    decreaseNewQuantity(index) {
        if (this.newOrderCart.items[index].quantity > 1) {
            this.newOrderCart.items[index].quantity--;
            this.newOrderCart.items[index].total_price =
                this.newOrderCart.items[index].quantity * this.newOrderCart.items[index].unit_price;
            this.updateNewOrderDisplay();
        }
    },

    calculateNewOrderTotal() {
        const subtotal = this.newOrderCart.items.reduce((sum, item) => sum + item.total_price, 0);
        const tax = Utils.calculateTax(subtotal);
        const deliveryFee = SYSTEM_CONFIG.deliveryFee;
        const total = subtotal + tax + deliveryFee;

        document.getElementById('subtotalAmount').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('taxAmount').textContent = Utils.formatCurrency(tax);
        document.getElementById('deliveryAmount').textContent = Utils.formatCurrency(deliveryFee);
        document.getElementById('totalAmount').textContent = Utils.formatCurrency(total);
    },

async sendNewOrder() {
    if (this.newOrderCart.items.length === 0) {
        Utils.showNotification('السلة فارغة', 'error');
        return;
    }

    const customerName = document.getElementById('customerName')?.value;
    const customerPhone = document.getElementById('customerPhone')?.value;
    const customerAddress = document.getElementById('customerAddress')?.value;

    if (!customerName || !customerPhone || !customerAddress) {
        Utils.showNotification('يرجى إدخال بيانات العميل كاملة', 'error');
        return;
    }

    try {
        console.log('🚀 إرسال طلب جديد...');
        console.log('📦 السلة:', this.newOrderCart.items);
        
        // ✅ حساب المجموع بشكل آمن
        const subtotal = this.newOrderCart.items.reduce((sum, item) => {
            const price = parseFloat(item.totalprice || item.total_price || 0);
            console.log('Item:', item.name, 'Price:', price);
            return sum + price;
        }, 0);
        
        const tax = 0; // ✅ لا ضريبة في التوصيل
        const deliveryFee = parseFloat(SYSTEM_CONFIG.deliveryFee) || 0;
        const total = subtotal + deliveryFee;

        console.log('💰 الحسابات:', { subtotal, tax, deliveryFee, total });

        // ✅ تأكد إن الأرقام صحيحة
        if (isNaN(subtotal) || subtotal === 0) {
            Utils.showNotification('خطأ في حساب المجموع', 'error');
            return;
        }

        const orderData = {
            order_number: Utils.generateOrderNumber(),
            order_type: 'delivery',
            status: 'new',
            staff_id: this.currentUser.id,
            payment_method: this.newOrderCart.paymentmethod || 'cash',
            subtotal: subtotal,
            tax: tax,
            discount: 0,
            delivery_fee: deliveryFee,
            total: total
        };

        console.log('📦 بيانات الطلب:', orderData);

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([orderData])
            .select()
            .single();

        if (orderError) {
            console.error('❌ خطأ في إنشاء الطلب:', orderError);
            throw orderError;
        }

        console.log('✅ تم إنشاء الطلب:', order);

        const orderItems = this.newOrderCart.items.map(item => ({
            order_id: order.id,
            menu_item_id: item.menuitemid || item.menu_item_id,
            quantity: parseInt(item.quantity),
            unit_price: parseFloat(item.unitprice || item.unit_price),
            total_price: parseFloat(item.totalprice || item.total_price)
        }));

        console.log('🍽️ الأصناف:', orderItems);

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            console.error('❌ خطأ في إضافة الأصناف:', itemsError);
            throw itemsError;
        }

        console.log('✅ تمت إضافة الأصناف');

        const deliveryData = {
            order_id: order.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            delivery_fee: deliveryFee,
            delivery_status: 'preparing'
        };
        console.log('🚚 Delivery Data:', deliveryData);  // ✅ للتشخيص

        console.log('🚚 بيانات التوصيل:', deliveryData);

        const { error: deliveryError } = await supabase
            .from('deliveries')
            .insert([deliveryData]);

        if (deliveryError) {
            console.error('❌ خطأ في بيانات التوصيل:', deliveryError);
            throw deliveryError;
        }

        console.log('✅ تمت إضافة بيانات التوصيل');

        // خصم المخزون
        await this.deductInventory(order.id, this.newOrderCart.items);

        Utils.showNotification('✅ تم إرسال الطلب بنجاح', 'success');

        // تنظيف النموذج
        this.newOrderCart.items = [];
        this.updateNewOrderDisplay();
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerAddress').value = '';

        await this.loadOpenOrders();

    } catch (error) {
        console.error('❌ خطأ في إرسال الطلب:', error);
        Utils.showNotification('❌ حدث خطأ: ' + error.message, 'error');
    }
},



    async closeAndPrintOrder(orderId) {
    try {
        // ✅ جيب البيانات الكاملة
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items(*, menu_item:menu_item_id(name_ar, price)),
                staff:staff_id(full_name),
                deliveries(*)
            `)
            .eq('id', orderId)
            .single();

        if (error) throw error;

        console.log('📦 Order Data:', order);
        console.log('🚚 Deliveries:', order.deliveries);

        // طباعة الفاتورة
        this.printReceipt(order);

        // تحديث الحالة
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId);

        if (updateError) throw updateError;

        await this.loadOpenOrders();
        Utils.showNotification('✅ تم إغلاق الطلب', 'success');

    } catch (error) {
        console.error('Error:', error);
        Utils.showNotification('❌ حدث خطأ', 'error');
    }
},


    // عرض نافذة اختيار طريقة الدفع
 showPaymentMethodDialog(order) {
    return new Promise((resolve) => {
        // إنشاء النافذة المنبثقة
        const modalHTML = `
            <div id="paymentModal" style="
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.7); 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                z-index: 9999;
            ">
                <div style="
                    background: white; 
                    border-radius: 15px; 
                    padding: 30px; 
                    width: 90%; 
                    max-width: 500px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 10px 0; text-align: center; color: #667eea;">💳 اختر طريقة الدفع</h3>
                    <p style="text-align: center; color: #666; margin-bottom: 20px;">الإجمالي: ${Utils.formatCurrency(order.total)}</p>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <button class="modal-payment-btn" data-method="cash" style="
                            padding: 20px; 
                            border: 2px solid #e0e0e0; 
                            border-radius: 10px; 
                            background: white; 
                            cursor: pointer;
                            transition: all 0.3s;
                            text-align: center;
                        ">
                            <div style="font-size: 32px; margin-bottom: 5px;">💵</div>
                            <div style="font-weight: bold;">كاش</div>
                        </button>
                        <button class="modal-payment-btn" data-method="visa" style="
                            padding: 20px; 
                            border: 2px solid #e0e0e0; 
                            border-radius: 10px; 
                            background: white; 
                            cursor: pointer;
                            transition: all 0.3s;
                            text-align: center;
                        ">
                            <div style="font-size: 32px; margin-bottom: 5px;">💳</div>
                            <div style="font-weight: bold;">فيزا</div>
                        </button>
                        <button class="modal-payment-btn" data-method="wallet" style="
                            padding: 20px; 
                            border: 2px solid #e0e0e0; 
                            border-radius: 10px; 
                            background: white; 
                            cursor: pointer;
                            transition: all 0.3s;
                            text-align: center;
                        ">
                            <div style="font-size: 32px; margin-bottom: 5px;">📱</div>
                            <div style="font-weight: bold;">محفظة</div>
                        </button>
                        <button class="modal-payment-btn" data-method="instapay" style="
                            padding: 20px; 
                            border: 2px solid #e0e0e0; 
                            border-radius: 10px; 
                            background: white; 
                            cursor: pointer;
                            transition: all 0.3s;
                            text-align: center;
                        ">
                            <div style="font-size: 32px; margin-bottom: 5px;">⚡</div>
                            <div style="font-weight: bold;">انستاباي</div>
                        </button>
                    </div>
                    
                    <button id="cancelPaymentModal" style="
                        width: 100%; 
                        padding: 15px; 
                        background: #f44336; 
                        color: white; 
                        border: none; 
                        border-radius: 8px; 
                        cursor: pointer; 
                        font-size: 16px;
                        font-weight: bold;
                    ">❌ إلغاء</button>
                </div>
            </div>
        `;

        // إضافة النافذة للصفحة
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('paymentModal');

        // عند النقر على طريقة دفع
        document.querySelectorAll('.modal-payment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const method = btn.getAttribute('data-method');
                modal.remove();
                resolve(method);
            });

            // تأثير hover
            btn.addEventListener('mouseenter', function() {
                this.style.borderColor = '#667eea';
                this.style.background = '#f0f4ff';
                this.style.transform = 'scale(1.05)';
            });
            btn.addEventListener('mouseleave', function() {
                this.style.borderColor = '#e0e0e0';
                this.style.background = 'white';
                this.style.transform = 'scale(1)';
            });
        });

        // عند الإلغاء
        document.getElementById('cancelPaymentModal').addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // إغلاق عند النقر خارج النافذة
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });
    });
},

printReceipt(order) {
    console.log('📦 Order Data:', order);
    console.log('🚚 Delivery Info:', order.deliveries);
    if (order.deliveries && order.deliveries[0]) {
        console.log('📍 Address:', order.deliveries[0].delivery_address || order.deliveries[0].customer_address);
        console.log('📞 Phone:', order.deliveries[0].customer_phone);
        console.log('👤 Name:', order.deliveries[0].customer_name);
    }
    
    const deliveryInfo = (order.order_type === 'delivery' && order.deliveries && order.deliveries.length > 0) 
        ? order.deliveries[0] 
        : null;
    
    const receiptHTML = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>فاتورة #${order.order_number}</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body { 
                    font-family: Arial, 'Tahoma', sans-serif;
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
                .header h2 {
                    font-size: 18px;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                .header p {
                    font-size: 12px;
                    margin: 3px 0;
                }
                .payment-box {
                    background: #000;
                    color: #fff;
                    padding: 8px;
                    margin: 10px 0;
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                    border: 2px solid #000;
                }
                .info {
                    font-size: 11px;
                    margin-bottom: 10px;
                    font-weight: bold;
                    line-height: 1.6;
                }
                .info div {
                    margin: 3px 0;
                    word-wrap: break-word;
                }
                hr {
                    border: none;
                    border-top: 2px solid #000;
                    margin: 8px 0;
                }
                .items-header {
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    font-size: 12px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 5px;
                    margin-bottom: 5px;
                }
                .item { 
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-size: 12px;
                    font-weight: bold;
                }
                .item span:first-child {
                    flex: 1;
                    padding-left: 8px;
                }
                .summary-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 6px 0;
                    font-size: 13px;
                    font-weight: bold;
                }
                .total { 
                    font-size: 16px;
                    font-weight: bold;
                    border-top: 3px double #000;
                    border-bottom: 3px double #000;
                    padding: 10px 0;
                    margin: 10px 0;
                    background: #f0f0f0;
                }
                .footer {
                    text-align: center;
                    margin-top: 15px;
                    font-size: 13px;
                    font-weight: bold;
                    border-top: 2px solid #000;
                    padding-top: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>مطعم بلدي شيك</h2>
                <p>فاتورة: ${order.order_number}</p>
                <p>${Utils.formatDate(order.created_at)}</p>
            </div>

            <div class="payment-box">
                💳 ${this.getPaymentMethodName(order.payment_method || this.selectedOrderPaymentMethod || this.newOrderCart.payment_method)}
            </div>

            <div class="info">
                ${order.order_type === 'delivery' && deliveryInfo ? `
                    <div>📦 العميل: ${deliveryInfo.customer_name || 'غير محدد'}</div>
                    ${deliveryInfo.customer_phone ? `<div>📞 ${deliveryInfo.customer_phone}</div>` : ''}
                    ${(deliveryInfo.delivery_address || deliveryInfo.customer_address) ? 
                        `<div>📍 ${deliveryInfo.delivery_address || deliveryInfo.customer_address}</div>` : 
                        '<div>📍 لا يوجد عنوان</div>'}
                ` : order.order_type === 'delivery' ? `
                    <div>📦 توصيل (لا توجد بيانات)</div>
                ` : `
                    <div>🍽️ طاولة: ${order.table_number}</div>
                `}
            </div>

            <hr>

            <div class="items-header">
                <span>الصنف</span>
                <span>السعر</span>
            </div>

            ${order.order_items.map(item => `
                <div class="item">
                    <span>${item.menu_item?.name_ar} × ${item.quantity}</span>
                    <span>${Utils.formatCurrency(item.total_price)}</span>
                </div>
            `).join('')}

            <hr>

            <div class="summary-item">
                <span>المجموع:</span>
                <span>${Utils.formatCurrency(order.subtotal)}</span>
            </div>
            
            ${order.order_type !== 'delivery' ? `
                <div class="summary-item">
                    <span>الضريبة (14%):</span>
                    <span>${Utils.formatCurrency(order.tax)}</span>
                </div>
            ` : ''}
            
            ${order.delivery_fee > 0 ? `
                <div class="summary-item">
                    <span>التوصيل:</span>
                    <span>${Utils.formatCurrency(order.delivery_fee)}</span>
                </div>
            ` : ''}

            <div class="summary-item total">
                <span>الإجمالي:</span>
                <span>${Utils.formatCurrency(order.total)}</span>
            </div>

            <div class="footer">
                <p>شكراً لزيارتكم بلدي شيك</p>
                <p>نتمنى لكم يوماً سعيداً</p>
                <p>بلدي شيك بلدي علي اصلة</p>
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=300');
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            setTimeout(() => printWindow.close(), 500);
        }, 250);
    };
},






    async deductInventory(orderId, items) {
        try {
            for (const item of items) {
                const { data: recipes } = await supabase
                    .from('recipes')
                    .select('ingredient_id, quantity_needed')
                    .eq('menu_item_id', item.menu_item_id);

                for (const recipe of recipes || []) {
                    const totalNeeded = recipe.quantity_needed * item.quantity;

                    const { data: ingredient } = await supabase
                        .from('ingredients')
                        .select('current_stock')
                        .eq('id', recipe.ingredient_id)
                        .single();

                    if (ingredient) {
                        await supabase
                            .from('ingredients')
                            .update({ current_stock: Math.max(0, ingredient.current_stock - totalNeeded) })
                            .eq('id', recipe.ingredient_id);

                        await supabase
                            .from('inventory_transactions')
                            .insert([{
                                ingredient_id: recipe.ingredient_id,
                                order_id: orderId,
                                quantity_used: totalNeeded
                            }]);
                    }
                }
            }
        } catch (error) {
            console.error('Error deducting inventory:', error);
        }
    },
// ==================== طرق الدفع ====================

// اختيار طريقة دفع للطلب الجديد (Delivery)
selectPaymentMethodForNew(method) {
    console.log('💳 طريقة الدفع للطلب الجديد:', method);
    
    this.newOrderCart.payment_method = method;
    
    // تحديث UI
    document.querySelectorAll('.payment-method-btn.new-payment').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedBtn = document.querySelector(`.new-payment[data-method="${method}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    this.showPaymentMethodNotification(method);
},

// اختيار طريقة دفع للطلب الموجود (Dine-in)
selectPaymentMethodForExisting(method) {
    console.log('💳 طريقة الدفع للطلب الموجود:', method);
    
    this.selectedOrderPaymentMethod = method;
    
    // تحديث UI
    document.querySelectorAll('.payment-method-btn.existing-payment').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedBtn = document.querySelector(`.existing-payment[data-method="${method}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    this.showPaymentMethodNotification(method);
},

// عرض إشعار اختيار طريقة الدفع
showPaymentMethodNotification(method) {
    const methodNames = {
        'cash': '💵 نقدي',
        'visa': '💳 فيزا',
        'wallet': '📱 محفظة',
        'instapay': '⚡ انستاباي'
    };
    
    Utils.showNotification(`تم اختيار: ${methodNames[method]}`, 'success');
},

// اسم طريقة الدفع
getPaymentMethodName(method) {
    const methodNames = {
        'cash': '💵 نقدي',
        'visa': '💳 فيزا',
        'wallet': '📱 محفظة',
        'instapay': '⚡ انستاباي'
    };
    return methodNames[method] || method;
},

    setupEventListeners() {
        const sendBtn = document.getElementById('sendOrderBtn');
        const clearBtn = document.getElementById('clearOrderBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');

        if (sendBtn) sendBtn.addEventListener('click', () => this.sendNewOrder());
        if (clearBtn) clearBtn.addEventListener('click', () => {
            this.newOrderCart.items = [];
            this.newOrderCart.payment_method = 'cash';  // ✅ إعادة تعيين
            this.updateNewOrderDisplay();
        });
        if (saveEditBtn) saveEditBtn.addEventListener('click', () => this.saveEditedOrder());
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this.cancelEdit());
    },

updatePaymentButtons() {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.mini-payment-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const orderId = parseInt(btn.getAttribute('data-order-id'));
        const method = btn.getAttribute('data-method');

        console.log('🔄 Updating payment for order:', orderId, 'to:', method);

        try {
            // ✅ 1. التحديث في Database
            const { data, error } = await supabase
                .from('orders')
                .update({ payment_method: method })
                .eq('id', orderId)
                .select();

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }

            console.log('✅ Database updated:', data);

            // ✅ 2. التحديث في الذاكرة
            const order = this.openOrders.find(o => o.id === orderId);
            if (order) {
                order.payment_method = method;
                console.log('✅ Memory updated');
            }

            // ✅ 3. إعادة عرض الفواتير فوراً
            this.displayOpenOrders(this.openOrders);

            const labels = { 
                'cash': '💵 كاش', 
                'visa': '💳 فيزا', 
                'wallet': '📱 محفظة', 
                'instapay': '⚡ انستاباي' 
            };
            Utils.showNotification(`✅ تم التحديث إلى: ${labels[method]}`, 'success');

        } catch (error) {
            console.error('❌ Error updating payment:', error);
            Utils.showNotification('❌ حدث خطأ في التحديث', 'error');
        }
    });
},

// باقي الدوال...
    setupRealtimeSubscriptions() {
        Realtime.subscribeToOrders((payload) => {
            console.log('Order change detected:', payload);

            if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                this.loadOpenOrders();

                if (this.selectedOrder && payload.new?.id === this.selectedOrder.id) {
                    this.loadOpenOrders().then(() => {
                        this.selectedOrder = this.openOrders.find(o => o.id === this.selectedOrder.id);
                        if (this.selectedOrder) {
                            this.displayFullEditSection();
                        }
                    });
                }
            } else if (payload.eventType === 'INSERT') {
                this.loadOpenOrders();
                Utils.showNotification('🔔 طلب جديد!', 'success');
            }
        });

        Realtime.subscribeToTable('order_items', (payload) => {
            if (this.selectedOrder) {
                this.loadOpenOrders().then(() => {
                    this.selectedOrder = this.openOrders.find(o => o.id === this.selectedOrder.id);
                    if (this.selectedOrder) {
                        this.displayFullEditSection();
                    }
                });
            }
        });
    }
};

if (typeof window !== 'undefined') {
    window.CashierSystem = CashierSystem;
}

// ==================== Auto-Protection ====================

if (typeof protectAsync !== 'undefined') {
    if (CashierSystem.sendNewOrder) {
        const original = CashierSystem.sendNewOrder.bind(CashierSystem);
        CashierSystem.sendNewOrder = protectAsync(original, 'send-new-order', true);
    }

    if (CashierSystem.saveEditedOrder) {
        const original = CashierSystem.saveEditedOrder.bind(CashierSystem);
        CashierSystem.saveEditedOrder = protectAsync(original, 'save-edited-order', true);
    }

    if (CashierSystem.closeAndPrintOrder) {
        const original = CashierSystem.closeAndPrintOrder.bind(CashierSystem);
        CashierSystem.closeAndPrintOrder = protectAsync(original, 'close-order', true);
    }

    if (CashierSystem.increaseItemQuantity) {
        const original = CashierSystem.increaseItemQuantity.bind(CashierSystem);
        CashierSystem.increaseItemQuantity = protectAsync(original, 'increase-quantity', true);
    }

    if (CashierSystem.decreaseItemQuantity) {
        const original = CashierSystem.decreaseItemQuantity.bind(CashierSystem);
        CashierSystem.decreaseItemQuantity = protectAsync(original, 'decrease-quantity', true);
    }

    if (CashierSystem.deleteOrderItem) {
        const original = CashierSystem.deleteOrderItem.bind(CashierSystem);
        CashierSystem.deleteOrderItem = protectAsync(original, 'delete-item', true);
    }

    if (CashierSystem.confirmReplace) {
        const original = CashierSystem.confirmReplace.bind(CashierSystem);
        CashierSystem.confirmReplace = protectAsync(original, 'replace-item', true);
    }
}




console.log('✅ Cashier System loaded with full control');


































