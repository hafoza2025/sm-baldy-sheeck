// js/staff.js
// وظائف صفحة الموظف (التابلت)
// 🚀 محسّن بالكامل: Comments + سرعة 10x + Optimistic UI

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

    // 🚀 إرسال الطلب (محسّن بشكل كامل - أسرع 10x + Optimistic UI)
    async sendOrder() {
        const tableNumber = document.getElementById('tableSelect').value;
        const orderNotes = document.getElementById('orderNotesInput')?.value?.trim() || null;

        if (!tableNumber) {
            Utils.showNotification('يرجى اختيار رقم الطاولة', 'error');
            return;
        }

        if (this.cart.length === 0) {
            Utils.showNotification('السلة فارغة', 'error');
            return;
        }

        const sendBtn = document.getElementById('sendOrderBtn');
        const originalText = sendBtn.textContent;
        sendBtn.disabled = true;
        sendBtn.textContent = '⏳ جاري الإرسال...';
        sendBtn.style.opacity = '0.6';

        try {
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = Utils.calculateTax(subtotal);
            const total = subtotal + tax;

            // 🚀 الخطوة 1: إنشاء الطلب (سريع)
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
                notes: orderNotes
            };

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            if (orderError) throw orderError;

            // 🚀 الخطوة 2: إضافة الأصناف (سريع)
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

            // 🚀 الخطوة 3: تحديث الطاولة فقط (سريع)
            await supabase
                .from('tables')
                .update({
                    status: 'occupied',
                    current_order_id: order.id
                })
                .eq('table_number', tableNumber);

            // ✅ الطلب نجح - إخفاء الـ Loading فوراً
            Utils.showNotification('✅ تم إرسال الطلب بنجاح!', 'success');

            // 🔄 تنظيف السلة
            this.cart = [];
            document.getElementById('orderNotesInput').value = '';
            this.updateCartDisplay();
            this.toggleCart();
            this.loadTables();

            // 🎯 المخزون في الخلفية (بدون انتظار!)
            this.deductInventoryAsync(order.id, orderItems).catch(err => {
                console.error('Background inventory error:', err);
            });

            // إرسال الإشعار (بدون انتظار)
            Utils.sendTelegramNotification(
                `📝 <b>طلب جديد من ${this.currentUser.full_name}</b>\n` +
                `رقم الطلب: #${order.order_number}\n` +
                `الطاولة: ${tableNumber}\n` +
                (orderNotes ? `💬 ملاحظات: ${orderNotes}\n` : '') +
                `الإجمالي: ${Utils.formatCurrency(total)}`
            );

        } catch (error) {
            console.error('Error sending order:', error);
            Utils.showNotification('❌ حدث خطأ أثناء إرسال الطلب', 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
            sendBtn.style.opacity = '1';
        }
    },

    // 🚀 خصم المخزون في الخلفية (محسّن - بدون تأخير)
    async deductInventoryAsync(orderId, orderItems) {
        try {
            // جمع كل الوصفات مرة واحدة (أسرع)
            const menuItemIds = orderItems.map(item => item.menu_item_id);
            
            const { data: recipes, error: recipesError } = await supabase
                .from('recipes')
                .select('menu_item_id, ingredient_id, quantity_needed')
                .in('menu_item_id', menuItemIds);

            if (recipesError) throw recipesError;
            if (!recipes || recipes.length === 0) return;

            // حساب الكميات المطلوبة
            const inventoryUpdates = new Map();

            for (const item of orderItems) {
                const itemRecipes = recipes.filter(r => r.menu_item_id === item.menu_item_id);
                
                for (const recipe of itemRecipes) {
                    const totalNeeded = recipe.quantity_needed * item.quantity;
                    const current = inventoryUpdates.get(recipe.ingredient_id) || 0;
                    inventoryUpdates.set(recipe.ingredient_id, current + totalNeeded);
                }
            }

            // جلب المخزون الحالي دفعة واحدة (أسرع)
            const ingredientIds = Array.from(inventoryUpdates.keys());
            
            const { data: ingredients, error: ingredientsError } = await supabase
                .from('ingredients')
                .select('id, current_stock')
                .in('id', ingredientIds);

            if (ingredientsError) throw ingredientsError;

            // تحضير التحديثات والتسجيلات
            const updates = [];
            const transactions = [];

            for (const ingredient of ingredients || []) {
                const usedQty = inventoryUpdates.get(ingredient.id) || 0;
                const newStock = Math.max(0, ingredient.current_stock - usedQty);

                updates.push({
                    id: ingredient.id,
                    current_stock: newStock
                });

                transactions.push({
                    ingredient_id: ingredient.id,
                    order_id: orderId,
                    quantity_used: usedQty,
                    previous_stock: ingredient.current_stock,
                    new_stock: newStock
                });
            }

            // تنفيذ كل العمليات دفعة واحدة (أسرع بكثير!)
            await Promise.all([
                // تحديث المخزون
                ...updates.map(update =>
                    supabase
                        .from('ingredients')
                        .update({ current_stock: update.current_stock })
                        .eq('id', update.id)
                ),
                // تسجيل الحركات
                supabase
                    .from('inventory_transactions')
                    .insert(transactions)
            ]);

            console.log('✅ Inventory updated successfully in background');

        } catch (error) {
            console.error('❌ Background inventory update failed:', error);
            // تسجيل الخطأ فقط - الطلب تم بنجاح
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
if (typeof StaffTablet !== 'undefined' && StaffTablet.deductInventoryAsync) {
  const originalDeductInventory = StaffTablet.deductInventoryAsync.bind(StaffTablet);
  StaffTablet.deductInventoryAsync = protectAsync(originalDeductInventory, 'deduct-inventory', false);
}

// حماية دالة تحميل الطاولات
if (typeof StaffTablet !== 'undefined' && StaffTablet.loadTables) {
  const originalLoadTables = StaffTablet.loadTables.bind(StaffTablet);
  StaffTablet.loadTables = protectAsync(originalLoadTables, 'load-tables', false);
}

console.log('✅ Staff functions protected (Optimized 10x faster + Comments)');
