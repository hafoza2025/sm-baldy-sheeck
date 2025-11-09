// js/staff.js
// وظائف صفحة الموظف (التابلت)
// 🆕 محسّن بميزة التعليقات + سرعة إرسال أفضل

const StaffTablet = {
    currentUser: null,
    menuItems: [],
    cart: [],
    selectedTable: null,

    // التهيئة
    async init() {
        this.currentUser = Auth.checkAuth(['staff']);
        if (!this.currentUser) return;

        document.getElementById('staffName').textContent = this.currentUser.full_name;

        await this.loadMenu();
        await this.loadTables();
        this.setupEventListeners();
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
        const container = document.getElementById('menuItems');
        container.innerHTML = items.map(item => `
      <div class="menu-item-card">
        <img src="${item.image_url || 'placeholder.jpg'}" alt="${item.name_ar}">
        <div class="info">
          <h3>${item.name_ar}</h3>
          <div class="price">${Utils.formatCurrency(item.price)}</div>
          <button class="add-btn" onclick="StaffTablet.addToCart(${item.id})">
            إضافة للطلب
          </button>
        </div>
      </div>
    `).join('');
    },

    displayCategories(items) {
        const categories = [...new Set(items.map(item => item.category))];
        const container = document.getElementById('categories');

        container.innerHTML = `
      <button class="category-btn active" onclick="StaffTablet.filterByCategory('all')">الكل</button>
      ${categories.map(cat => `
        <button class="category-btn" onclick="StaffTablet.filterByCategory('${cat}')">${cat}</button>
      `).join('')}
    `;
    },

    filterByCategory(category) {
        const filtered = category === 'all'
            ? this.menuItems
            : this.menuItems.filter(item => item.category === category);

        this.displayMenu(filtered);

        // تحديث التاب النشط
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    },

    // تحميل الطاولات
    async loadTables() {
        try {
            const { data, error } = await supabase
                .from('tables')
                .select('*')
                .eq('status', 'available')
                .order('table_number');

            if (error) throw error;

            const select = document.getElementById('tableSelect');
            select.innerHTML = `
        <option value="">-- اختر الطاولة --</option>
        ${data.map(table => `
          <option value="${table.table_number}">طاولة ${table.table_number}</option>
        `).join('')}
      `;

        } catch (error) {
            console.error('Error loading tables:', error);
        }
    },

    // إضافة للسلة
    addToCart(menuItemId) {
        const item = this.menuItems.find(m => m.id === menuItemId);
        if (!item) return;

        const existingItem = this.cart.find(i => i.id === menuItemId);

        if (existingItem) {
            existingItem.quantity++;
        } else {
            this.cart.push({
                id: menuItemId,
                name: item.name_ar,
                price: item.price,
                quantity: 1
            });
        }

        this.updateCartDisplay();
        Utils.showNotification(`تم إضافة ${item.name_ar}`, 'success');
    },

    // تحديث عرض السلة
    updateCartDisplay() {
        const badge = document.getElementById('cartBadge');
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';

        const container = document.getElementById('cartItemsList');
        container.innerHTML = this.cart.map((item, index) => `
      <div class="cart-item">
        <div class="item-info">
          <h4>${item.name}</h4>
          <div>${Utils.formatCurrency(item.price)}</div>
        </div>
        <div class="item-controls">
          <button class="qty-btn" onclick="StaffTablet.decreaseQuantity(${index})">-</button>
          <span class="qty-display">${item.quantity}</span>
          <button class="qty-btn" onclick="StaffTablet.increaseQuantity(${index})">+</button>
          <button class="item-remove" onclick="StaffTablet.removeFromCart(${index})">🗑️</button>
        </div>
      </div>
    `).join('');

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        document.getElementById('cartTotal').textContent = Utils.formatCurrency(total);
    },

    increaseQuantity(index) {
        this.cart[index].quantity++;
        this.updateCartDisplay();
    },

    decreaseQuantity(index) {
        if (this.cart[index].quantity > 1) {
            this.cart[index].quantity--;
            this.updateCartDisplay();
        }
    },

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.updateCartDisplay();
    },

    // فتح/إغلاق السلة
    toggleCart() {
        const cartModal = document.getElementById('cartModal');
        cartModal.classList.toggle('active');
    },

    // 🆕 إرسال الطلب (محسّن - سريع + مع تعليقات)
    async sendOrder() {
        const tableNumber = document.getElementById('tableSelect').value;
        const orderNotes = document.getElementById('orderNotesInput')?.value?.trim() || null; // 🆕 جلب التعليق

        if (!tableNumber) {
            Utils.showNotification('يرجى اختيار رقم الطاولة', 'error');
            return;
        }

        if (this.cart.length === 0) {
            Utils.showNotification('السلة فارغة', 'error');
            return;
        }

        // 🆕 عرض Loading على الزر
        const sendBtn = document.getElementById('sendOrderBtn');
        const originalText = sendBtn.textContent;
        sendBtn.disabled = true;
        sendBtn.textContent = '⏳ جاري الإرسال...';
        sendBtn.style.opacity = '0.6';

        try {
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = Utils.calculateTax(subtotal);
            const total = subtotal + tax;

            // إنشاء الطلب
            const orderData = {
                order_number: Utils.generateOrderNumber(),
                table_number: parseInt(tableNumber),
                order_type: 'dine_in',
                status: 'new',
                staff_id: this.currentUser.id,
                subtotal: subtotal,
                tax: tax,
                discount: 0,
                delivery_fee: 0,
                total: total,
                notes: orderNotes  // 🆕 إضافة التعليق
            };

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            if (orderError) throw orderError;

            // إضافة أصناف الطلب
            const orderItems = this.cart.map(item => ({
                order_id: order.id,
                menu_item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 🆕 تحديث الطاولة + خصم المخزون بشكل متوازي (أسرع!)
            await Promise.all([
                supabase
                    .from('tables')
                    .update({
                        status: 'occupied',
                        current_order_id: order.id
                    })
                    .eq('table_number', tableNumber),
                
                this.deductInventory(order.id)
            ]);

            Utils.showNotification('✅ تم إرسال الطلب بنجاح!', 'success');

            // إرسال إشعار (بدون انتظار - أسرع!)
            Utils.sendTelegramNotification(
                `📝 <b>طلب جديد من ${this.currentUser.full_name}</b>\n` +
                `رقم الطلب: #${order.order_number}\n` +
                `الطاولة: ${tableNumber}\n` +
                (orderNotes ? `💬 ملاحظات: ${orderNotes}\n` : '') + // 🆕 إضافة التعليق للإشعار
                `الإجمالي: ${Utils.formatCurrency(total)}`
            );

            // إعادة تعيين السلة + تنظيف حقل التعليق
            this.cart = [];
            document.getElementById('orderNotesInput').value = ''; // 🆕 تنظيف التعليق
            this.updateCartDisplay();
            this.toggleCart();
            this.loadTables();

        } catch (error) {
            console.error('Error sending order:', error);
            Utils.showNotification('❌ حدث خطأ أثناء إرسال الطلب', 'error');
        } finally {
            // 🆕 إعادة تفعيل الزر بعد الانتهاء
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
            sendBtn.style.opacity = '1';
        }
    },

    // خصم المخزون
    async deductInventory(orderId) {
        try {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('menu_item_id, quantity')
                .eq('order_id', orderId);

            for (const item of orderItems) {
                const { data: recipes } = await supabase
                    .from('recipes')
                    .select('ingredient_id, quantity_needed')
                    .eq('menu_item_id', item.menu_item_id);

                for (const recipe of recipes || []) {
                    const totalNeeded = recipe.quantity_needed * item.quantity;

                    // تحديث المخزون
                    const { data: ingredient } = await supabase
                        .from('ingredients')
                        .select('current_stock')
                        .eq('id', recipe.ingredient_id)
                        .single();

                    if (ingredient) {
                        const newStock = ingredient.current_stock - totalNeeded;

                        await supabase
                            .from('ingredients')
                            .update({ current_stock: newStock })
                            .eq('id', recipe.ingredient_id);

                        // تسجيل الحركة
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

    // البحث في المنيو
    searchMenu(query) {
        const filtered = this.menuItems.filter(item =>
            item.name_ar.includes(query) || item.name.includes(query)
        );
        this.displayMenu(filtered);
    },

    // إعداد مستمعي الأحداث
    setupEventListeners() {
        document.getElementById('cartFab').addEventListener('click', () => {
            this.toggleCart();
        });

        document.getElementById('sendOrderBtn').addEventListener('click', () => {
            this.sendOrder();
        });

        document.getElementById('searchBox').addEventListener('input', (e) => {
            this.searchMenu(e.target.value);
        });

        document.getElementById('closeCart').addEventListener('click', () => {
            this.toggleCart();
        });
    }
};

// تهيئة عند تحميل الصفحة
if (typeof window !== 'undefined') {
    window.StaffTablet = StaffTablet;
}




// ===============================
// Auto-Protection للدوال
// ===============================

// حماية دالة إرسال الطلب
if (typeof StaffTablet !== 'undefined' && StaffTablet.sendOrder) {
  const originalSendOrder = StaffTablet.sendOrder.bind(StaffTablet);
  StaffTablet.sendOrder = protectAsync(originalSendOrder, 'send-order', true);
}

// حماية دالة خصم المخزون
if (typeof StaffTablet !== 'undefined' && StaffTablet.deductInventory) {
  const originalDeductInventory = StaffTablet.deductInventory.bind(StaffTablet);
  StaffTablet.deductInventory = protectAsync(originalDeductInventory, 'deduct-inventory', false);
}

// حماية دالة تحميل الطاولات
if (typeof StaffTablet !== 'undefined' && StaffTablet.loadTables) {
  const originalLoadTables = StaffTablet.loadTables.bind(StaffTablet);
  StaffTablet.loadTables = protectAsync(originalLoadTables, 'load-tables', false);
}

console.log('✅ Staff functions protected (Enhanced with Comments + Speed)');
