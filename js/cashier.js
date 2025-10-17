// js/cashier.js
// وظائف صفحة الكاشير مع إدارة الفواتير المفتوحة

const CashierSystem = {
    currentUser: null,
    menuItems: [],
    openOrders: [], // الفواتير المفتوحة من Staff
    selectedOrder: null, // الفاتورة المختارة
    newOrderCart: { // عربة طلب جديد (ديليفري)
        type: 'delivery',
        items: [],
        customer_info: {}
    },
    currentEditCart: { // عربة التعديل على فاتورة موجودة
        items: []
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
          <p>انتظر طلبات من الموظفين</p>
        </div>
      `;
            return;
        }

        container.innerHTML = orders.map(order => {
            const itemsCount = order.order_items?.length || 0;
            const isSelected = this.selectedOrder?.id === order.id;

            return `
        <div class="order-card ${isSelected ? 'selected' : ''}" 
             style="cursor: pointer; margin-bottom: 15px; padding: 15px; border: 2px solid ${isSelected ? '#667eea' : '#e0e0e0'}; border-radius: 10px; background: ${isSelected ? '#f0f4ff' : 'white'};">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 20px;">
                ${order.order_type === 'delivery' ? '🛵' : '🍽️'} 
                ${order.order_type === 'delivery'
                    ? order.deliveries[0]?.customer_name
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

          <div style="display: flex; gap: 5px;">
            <button onclick="event.stopPropagation(); CashierSystem.selectOrderForEdit(${order.id})" 
                    class="btn btn-info" 
                    style="flex: 1; padding: 8px; font-size: 13px;">
              ➕ إضافة أصناف
            </button>
            <button onclick="event.stopPropagation(); CashierSystem.closeAndPrintOrder(${order.id})" 
                    class="btn btn-success" 
                    style="flex: 1; padding: 8px; font-size: 13px;">
              ✅ إغلاق وطباعة
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

    // اختيار فاتورة للتعديل
    selectOrderForEdit(orderId) {
        const order = this.openOrders.find(o => o.id === orderId);
        if (!order) return;

        this.selectedOrder = order;
        this.currentEditCart.items = [];

        this.displayOpenOrders(this.openOrders);
        this.displayEditSection();

        Utils.showNotification(
            order.order_type === 'delivery'
                ? `تم اختيار طلب ${order.deliveries[0]?.customer_name}`
                : `تم اختيار فاتورة طاولة ${order.table_number}`,
            'success'
        );

        // إظهار قسم التعديل وإخفاء قسم الطلب الجديد
        document.getElementById('editSection').style.display = 'block';
        document.getElementById('newOrderSection').style.display = 'none';
    },

    // عرض قسم التعديل
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

    // إضافة صنف للعربة
    addItemToCart(menuItemId) {
        const item = this.menuItems.find(m => m.id === menuItemId);
        if (!item) return;

        // إذا كان هناك فاتورة محددة للتعديل
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
            // طلب ديليفري جديد
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

    // دوال التحكم في كميات التعديل
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

    // حفظ التعديلات على الفاتورة
    async saveEditedOrder() {
        if (!this.selectedOrder || this.currentEditCart.items.length === 0) {
            Utils.showNotification('لا توجد تعديلات لحفظها', 'error');
            return;
        }

        try {
            // إضافة الأصناف الجديدة
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

            // تحديث الإجمالي
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

            // خصم المخزون
            await this.deductInventory(this.selectedOrder.id, this.currentEditCart.items);

            Utils.showNotification('تم حفظ التعديلات بنجاح', 'success');

            // إعادة التعيين
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

    // إلغاء التعديل
    cancelEdit() {
        this.currentEditCart.items = [];
        this.selectedOrder = null;
        this.displayOpenOrders(this.openOrders);
        document.getElementById('editSection').style.display = 'none';
        document.getElementById('newOrderSection').style.display = 'block';
    },

    // عرض الطلب الجديد (ديليفري)
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

    removeNewItem(index) {
        this.newOrderCart.items.splice(index, 1);
        this.updateNewOrderDisplay();
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

    // إرسال طلب ديليفري جديد
    async sendNewOrder() {
        if (this.newOrderCart.items.length === 0) {
            Utils.showNotification('الطلب فارغ', 'error');
            return;
        }

        const customerName = document.getElementById('customerName').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const customerAddress = document.getElementById('customerAddress').value;

        if (!customerName || !customerPhone || !customerAddress) {
            Utils.showNotification('يرجى إدخال بيانات العميل كاملة', 'error');
            return;
        }

        try {
            const subtotal = this.newOrderCart.items.reduce((sum, item) => sum + item.total_price, 0);
            const tax = Utils.calculateTax(subtotal);
            const deliveryFee = SYSTEM_CONFIG.deliveryFee;
            const total = subtotal + tax + deliveryFee;

            // إنشاء الطلب
            const orderData = {
                order_number: Utils.generateOrderNumber(),
                order_type: 'delivery',
                status: 'new',
                cashier_id: this.currentUser.id,
                subtotal: subtotal,
                tax: tax,
                discount: 0,
                delivery_fee: deliveryFee,
                total: total
            };

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            if (orderError) throw orderError;

            // إضافة الأصناف
            const orderItems = this.newOrderCart.items.map(item => ({
                order_id: order.id,
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // إضافة بيانات الديليفري
            const deliveryData = {
                order_id: order.id,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: customerAddress,
                delivery_fee: deliveryFee,
                delivery_status: 'preparing'
            };

            const { error: deliveryError } = await supabase
                .from('deliveries')
                .insert([deliveryData]);

            if (deliveryError) throw deliveryError;

            // خصم المخزون
            await this.deductInventory(order.id, this.newOrderCart.items);

            Utils.showNotification('تم إرسال الطلب بنجاح', 'success');

            // إعادة تعيين
            this.newOrderCart.items = [];
            this.updateNewOrderDisplay();
            document.getElementById('customerName').value = '';
            document.getElementById('customerPhone').value = '';
            document.getElementById('customerAddress').value = '';
            await this.loadOpenOrders();

        } catch (error) {
            console.error('Error sending order:', error);
            Utils.showNotification('حدث خطأ أثناء إرسال الطلب', 'error');
        }
    },

    // إغلاق الفاتورة وطباعتها
    async closeAndPrintOrder(orderId) {
        const order = this.openOrders.find(o => o.id === orderId);
        if (!order) return;

        const confirmMsg = `هل تأكد من إغلاق الفاتورة؟\nالإجمالي: ${Utils.formatCurrency(order.total)}\n(العميل دفع)`;

        if (!confirm(confirmMsg)) return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw error;

            // تحديث الديليفري
            if (order.order_type === 'delivery') {
                await supabase
                    .from('deliveries')
                    .update({
                        delivery_status: 'delivered',
                        delivered_at: new Date().toISOString()
                    })
                    .eq('order_id', orderId);
            }

            // تحرير الطاولة
            if (order.order_type === 'dine_in' && order.table_number) {
                await supabase
                    .from('tables')
                    .update({
                        status: 'available',
                        current_order_id: null
                    })
                    .eq('table_number', order.table_number);
            }

            Utils.showNotification('تم إغلاق الفاتورة بنجاح', 'success');
            this.printReceipt(order);
            await this.loadOpenOrders();

        } catch (error) {
            console.error('Error closing order:', error);
            Utils.showNotification('حدث خطأ', 'error');
        }
    },

    // طباعة الإيصال
    printReceipt(order) {
        const receiptHTML = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة #${order.order_number}</title>
        <style>
          body { font-family: Arial; width: 300px; margin: 20px auto; }
          .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${SYSTEM_CONFIG.restaurantName}</h2>
          <p>فاتورة: ${order.order_number}</p>
          <p>${Utils.formatDate(order.created_at)}</p>
        </div>
        ${order.order_type === 'delivery'
                ? `<p>العميل: ${order.deliveries[0]?.customer_name}</p>`
                : `<p>طاولة: ${order.table_number}</p>`
            }
        <hr>
        ${order.order_items.map(item => `
          <div class="item">
            <span>${item.menu_item?.name_ar} × ${item.quantity}</span>
            <span>${Utils.formatCurrency(item.total_price)}</span>
          </div>
        `).join('')}
        <hr>
        <div class="item"><span>المجموع:</span><span>${Utils.formatCurrency(order.subtotal)}</span></div>
        <div class="item"><span>الضريبة:</span><span>${Utils.formatCurrency(order.tax)}</span></div>
        ${order.delivery_fee > 0 ? `<div class="item"><span>التوصيل:</span><span>${Utils.formatCurrency(order.delivery_fee)}</span></div>` : ''}
        <div class="item total">
          <span>الإجمالي:</span>
          <span>${Utils.formatCurrency(order.total)}</span>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <p><strong>شكراً لزيارتكم</strong></p>
        </div>
      </body>
      </html>
    `;

        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write(receiptHTML);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    },

    // خصم المخزون
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

    setupEventListeners() {
        const sendBtn = document.getElementById('sendOrderBtn');
        const clearBtn = document.getElementById('clearOrderBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');

        if (sendBtn) sendBtn.addEventListener('click', () => this.sendNewOrder());
        if (clearBtn) clearBtn.addEventListener('click', () => {
            this.newOrderCart.items = [];
            this.updateNewOrderDisplay();
        });
        if (saveEditBtn) saveEditBtn.addEventListener('click', () => this.saveEditedOrder());
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this.cancelEdit());
    },

    setupRealtimeSubscriptions() {
        Realtime.subscribeToOrders(() => this.loadOpenOrders());
    }
};

if (typeof window !== 'undefined') {
    window.CashierSystem = CashierSystem;
}
// ===============================
// Auto-Protection للدوال
// ===============================

// حماية إرسال طلب جديد
if (typeof CashierSystem !== 'undefined' && CashierSystem.sendNewOrder) {
  const originalSendNewOrder = CashierSystem.sendNewOrder.bind(CashierSystem);
  CashierSystem.sendNewOrder = protectAsync(originalSendNewOrder, 'send-new-order', true);
}

// حماية حفظ التعديلات
if (typeof CashierSystem !== 'undefined' && CashierSystem.saveEditedOrder) {
  const originalSaveEditedOrder = CashierSystem.saveEditedOrder.bind(CashierSystem);
  CashierSystem.saveEditedOrder = protectAsync(originalSaveEditedOrder, 'save-edited-order', true);
}

// حماية إغلاق الفاتورة
if (typeof CashierSystem !== 'undefined' && CashierSystem.closeAndPrintOrder) {
  const originalCloseAndPrint = CashierSystem.closeAndPrintOrder.bind(CashierSystem);
  CashierSystem.closeAndPrintOrder = async function(orderId) {
    const operationId = `close-order-${orderId}`;
    
    if (Loading.isOperationActive(operationId)) {
      Utils.showNotification('جاري إغلاق فاتورة أخرى...', 'warning');
      return;
    }

    const order = this.openOrders.find(o => o.id === orderId);
    if (!order) return;

    const confirmMsg = `هل تأكد من إغلاق الفاتورة؟\nالإجمالي: ${Utils.formatCurrency(order.total)}\n(العميل دفع)`;
    if (!confirm(confirmMsg)) return;

    if (!Loading.startOperation(operationId)) return;
    
    Loading.show('جاري إغلاق الفاتورة...', `طلب #${order.order_number}`);

    try {
      await originalCloseAndPrint.call(this, orderId);
      Loading.success('تم إغلاق الفاتورة بنجاح ✅');
    } catch (error) {
      Loading.error('حدث خطأ أثناء إغلاق الفاتورة');
      throw error;
    } finally {
      Loading.endOperation(operationId);
    }
  };
}

// حماية إضافة أصناف للفاتورة
if (typeof CashierSystem !== 'undefined' && CashierSystem.addItemsToOrder) {
  const originalAddItems = CashierSystem.addItemsToOrder.bind(CashierSystem);
  CashierSystem.addItemsToOrder = protectAsync(originalAddItems, 'add-items', true);
}

// حماية خصم المخزون
if (typeof CashierSystem !== 'undefined' && CashierSystem.deductInventory) {
  const originalDeductInventory = CashierSystem.deductInventory.bind(CashierSystem);
  CashierSystem.deductInventory = protectAsync(originalDeductInventory, 'deduct-inventory', false);
}

// حماية تحميل الطلبات المفتوحة
if (typeof CashierSystem !== 'undefined' && CashierSystem.loadOpenOrders) {
  const originalLoadOpenOrders = CashierSystem.loadOpenOrders.bind(CashierSystem);
  CashierSystem.loadOpenOrders = protectAsync(originalLoadOpenOrders, 'load-open-orders', false);
}

console.log('✅ Cashier functions protected');

