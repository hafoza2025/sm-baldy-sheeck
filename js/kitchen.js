// js/kitchen.js
// وظائف شاشة المطبخ مع عرض Recipes وطباعتها - للطابعة الحرارية

const KitchenDisplay = {
  currentUser: null,
  orders: [],
  currentFilter: 'all',

  // التهيئة
  async init() {
    this.currentUser = Auth.checkAuth(['kitchen']);
    if (!this.currentUser) return;

    await this.loadOrders();
    this.setupRealtimeSubscriptions();
    this.setupEventListeners();
    this.startTimers();
  },

  // تحميل الطلبات مع Recipes
  async loadOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            menu_item:menu_item_id(name_ar, price, category)
          ),
          deliveries(customer_name, customer_address)
        `)
        .in('status', ['new', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      this.orders = data;

      // تحميل الـ recipes لكل صنف
      for (const order of this.orders) {
        for (const item of order.order_items) {
          item.recipe = await this.loadRecipeForItem(item.menu_item_id);
        }
      }

      this.displayOrders(this.orders);

    } catch (error) {
      console.error('Error loading orders:', error);
      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('خطأ في تحميل الطلبات', 'error');
      }
    }
  },

  // تحميل Recipe لصنف معين
  async loadRecipeForItem(menuItemId) {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredient:ingredient_id(
            id,
            name,
            unit,
            current_stock,
            cost_per_unit
          )
        `)
        .eq('menu_item_id', menuItemId);

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error loading recipe:', error);
      return [];
    }
  },

  // عرض الطلبات
  displayOrders(orders) {
    let filtered = orders;

    if (this.currentFilter !== 'all') {
      filtered = orders.filter(o => o.status === this.currentFilter);
    }

    const container = document.getElementById('ordersContainer');
    container.innerHTML = filtered.map(order => {
      const timeDiff = this.getTimeDifference(order.created_at);
      const isUrgent = timeDiff > 15;

      return `
        <div class="order-card ${order.order_type === 'delivery' ? 'delivery' : ''} ${isUrgent ? 'urgent' : ''}">
          <div class="order-header-info">
            <div>
              <div class="order-number">#${order.order_number}</div>
              <span class="order-type-badge ${order.order_type === 'delivery' ? 'delivery' : 'dine-in'}">
                ${order.order_type === 'delivery' ? '🛵 ديليفري' : '🍽️ طاولة ' + order.table_number}
              </span>
            </div>
            <div class="order-time">
              ⏱️ <span class="timer ${isUrgent ? 'urgent' : ''}" data-time="${order.created_at}">
                ${timeDiff} دقيقة
              </span>
            </div>
          </div>

          ${order.order_type === 'delivery' ? `
            <div style="background: #e3f2fd; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
              <strong>العميل:</strong> ${order.deliveries[0]?.customer_name}<br>
              <strong>العنوان:</strong> ${order.deliveries[0]?.customer_address}
            </div>
          ` : ''}

          <div class="order-items-list">
            ${order.order_items.map(item => `
              <div class="order-item-card">
                <div class="order-item-header">
                  <div class="item-name">
                    <span style="font-size: 18px; font-weight: bold;">${item.menu_item.name_ar}</span>
                    <span class="item-quantity">× ${item.quantity}</span>
                  </div>
                  
                  <!-- زر طباعة Recipe لصنف واحد -->
                  <button class="btn-print-recipe" onclick="KitchenDisplay.printRecipe(${item.id}, ${item.menu_item_id}, ${item.quantity}, '${item.menu_item.name_ar}')">
                    🖨️ طباعة Recipe
                  </button>
                </div>

                ${item.special_notes ? `
                  <div class="special-notes">
                    <strong>ملاحظة:</strong> ${item.special_notes}
                  </div>
                ` : ''}

                ${item.recipe && item.recipe.length > 0 ? `
                  <div class="recipe-section">
                    <div class="recipe-header">
                      📋 <strong>Recipe - المكونات المطلوبة:</strong>
                    </div>
                    <div class="recipe-ingredients">
                      ${item.recipe.map(r => {
                        const totalNeeded = (r.quantity_needed * item.quantity).toFixed(2);
                        const currentStock = r.ingredient?.current_stock || 0;
                        const isLowStock = currentStock < (totalNeeded * 2);

                        return `
                          <div class="ingredient-row ${isLowStock ? 'low-stock' : ''}">
                            <div class="ingredient-info">
                              <span class="ingredient-name">${r.ingredient?.name}</span>
                              <span class="ingredient-amount">
                                ${totalNeeded} ${r.ingredient?.unit}
                              </span>
                            </div>
                            <div class="ingredient-stock">
                              <span style="font-size: 11px; color: #666;">
                                المخزون: ${currentStock.toFixed(2)} ${r.ingredient?.unit}
                              </span>
                              ${isLowStock ? '<span class="stock-warning">⚠️</span>' : ''}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : `
                  <div style="background: #fff3cd; padding: 8px; border-radius: 5px; font-size: 12px; text-align: center; color: #856404;">
                    ⚠️ لا توجد وصفة محددة لهذا الصنف
                  </div>
                `}
              </div>
            `).join('')}
          </div>

          <!-- زر طباعة كل Recipes للطلب -->
          <button class="btn btn-warning" style="width: 100%; margin-bottom: 10px; padding: 12px; font-size: 15px; font-weight: bold;" onclick="KitchenDisplay.printAllRecipes(${order.id}, ${order.order_items.map(i => i.id).join(',')})">
            🖨️📋 طباعة كل Recipes للطلب
          </button>

          <div class="order-actions">
            ${order.status === 'new' ? `
              <button class="btn btn-info" onclick="KitchenDisplay.updateOrderStatus(${order.id}, 'preparing')">
                👨‍🍳 بدء التحضير
              </button>
            ` : ''}
            ${order.status === 'preparing' ? `
              <button class="btn btn-success" onclick="KitchenDisplay.updateOrderStatus(${order.id}, 'ready')">
                ✅ جاهز
              </button>
            ` : ''}
            ${order.status === 'ready' ? `
              <button class="btn btn-primary" onclick="KitchenDisplay.notifyWaiter(${order.id})">
                🔔 إشعار الموظف
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <h2>لا توجد طلبات</h2>
        </div>
      `;
    }
  },

  // ===================================
  // طباعة Recipe واحد - للطابعة الحرارية 🖨️
  // ===================================
  async printRecipe(orderItemId, menuItemId, quantity, itemName) {
    try {
      if (typeof Loading !== 'undefined' && Loading.show) {
        Loading.show('جاري تحميل Recipe...', 'يرجى الانتظار');
      }

      const { data: menuItem, error: menuError } = await supabase
        .from('menu_items')
        .select('name_ar, category')
        .eq('id', menuItemId)
        .single();

      if (menuError) {
        console.error('Menu Error:', menuError);
        throw menuError;
      }

      const { data: recipes, error: recipeError } = await supabase
        .from('recipes')
        .select(`
          quantity_needed,
          ingredient:ingredient_id (
            name,
            unit,
            current_stock
          )
        `)
        .eq('menu_item_id', menuItemId);

      if (recipeError) {
        console.error('Recipe Error:', recipeError);
        throw recipeError;
      }

      if (typeof Loading !== 'undefined' && Loading.hide) {
        Loading.hide();
      }

      this.generateRecipePrintPage(menuItem, recipes || [], quantity);

    } catch (error) {
      console.error('Error printing recipe:', error);
      
      if (typeof Loading !== 'undefined' && Loading.hide) {
        Loading.hide();
      }
      
      const errorMsg = error.message || 'حدث خطأ غير معروف';
      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('حدث خطأ في تحميل Recipe: ' + errorMsg, 'error');
      } else {
        alert('حدث خطأ في تحميل Recipe: ' + errorMsg);
      }
    }
  },

  // ===================================
  // طباعة كل Recipes للطلب دفعة واحدة 🖨️📋
  // ===================================
  async printAllRecipes(orderId, orderItemIds) {
    try {
      if (typeof Loading !== 'undefined' && Loading.show) {
        Loading.show('جاري تحميل جميع Recipes...', 'يرجى الانتظار');
      }

      // جلب الطلب مع جميع الأصناف
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          order_number,
          order_items(
            id,
            quantity,
            menu_item:menu_item_id(id, name_ar, category)
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const recipesToPrint = [];

      // جلب Recipes لكل صنف
      for (const item of order.order_items) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select(`
            quantity_needed,
            ingredient:ingredient_id (
              name,
              unit,
              current_stock
            )
          `)
          .eq('menu_item_id', item.menu_item.id);

        recipesToPrint.push({
          menuItem: item.menu_item,
          recipes: recipes || [],
          quantity: item.quantity
        });
      }

      if (typeof Loading !== 'undefined' && Loading.hide) {
        Loading.hide();
      }

      // طباعة كل الـ recipes
      this.generateAllRecipesPrintPage(recipesToPrint, order.order_number);

    } catch (error) {
      console.error('Error printing all recipes:', error);
      
      if (typeof Loading !== 'undefined' && Loading.hide) {
        Loading.hide();
      }
      
      const errorMsg = error.message || 'حدث خطأ غير معروف';
      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('حدث خطأ في طباعة Recipes: ' + errorMsg, 'error');
      } else {
        alert('حدث خطأ في طباعة Recipes: ' + errorMsg);
      }
    }
  },

  generateRecipePrintPage(menuItem, recipes, quantity) {
    const now = new Date();

    const formatDate = (date) => {
      const d = new Date(date);
      return d.toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    };

    const formatTime = (date) => {
      const d = new Date(date);
      return d.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    };

    const restaurantName = (typeof SYSTEM_CONFIG !== 'undefined' && SYSTEM_CONFIG.restaurantName) 
      ? SYSTEM_CONFIG.restaurantName 
      : 'مطعم الفرعون';

    const printHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>Recipe - ${menuItem.name_ar}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }

          body {
            font-family: 'Cairo', 'Arial', sans-serif;
            width: 80mm;
            padding: 5mm;
            background: white;
            color: #000;
            font-size: 11px;
            line-height: 1.4;
          }

          .receipt {
            width: 100%;
          }

          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }

          .header h1 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2mm;
          }

          .header .subtitle {
            font-size: 12px;
            font-weight: bold;
          }

          .item-info {
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
            margin-bottom: 3mm;
          }

          .item-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 2mm;
            text-align: center;
          }

          .info-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 10px;
          }

          .label {
            font-weight: bold;
          }

          .section-title {
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            margin: 3mm 0;
            padding: 2mm 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
          }

          .ingredient {
            border-bottom: 1px dotted #ccc;
            padding: 2mm 0;
            font-size: 10px;
          }

          .ingredient:last-child {
            border-bottom: none;
          }

          .ing-name {
            font-weight: bold;
            margin-bottom: 1mm;
          }

          .ing-details {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #333;
          }

          .stock-ok { color: #2E7D32; font-weight: bold; }
          .stock-low { color: #E65100; font-weight: bold; }
          .stock-critical { color: #C62828; font-weight: bold; }

          .no-recipe {
            text-align: center;
            padding: 5mm;
            border: 1px dashed #000;
            margin: 3mm 0;
            font-size: 11px;
          }

          .footer {
            border-top: 2px dashed #000;
            padding-top: 3mm;
            margin-top: 5mm;
            text-align: center;
            font-size: 9px;
          }

          @media print {
            body {
              width: 80mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>${restaurantName}</h1>
            <div class="subtitle">🍳 Recipe - الوصفة</div>
          </div>

          <div class="item-info">
            <div class="item-name">${menuItem.name_ar}</div>
            
            <div class="info-line">
              <span class="label">الفئة:</span>
              <span>${menuItem.category || 'غير محدد'}</span>
            </div>
            
            <div class="info-line">
              <span class="label">الكمية:</span>
              <span>× ${quantity}</span>
            </div>
            
            <div class="info-line">
              <span class="label">التاريخ:</span>
              <span>${formatDate(now)}</span>
            </div>
            
            <div class="info-line">
              <span class="label">الوقت:</span>
              <span>${formatTime(now)}</span>
            </div>
          </div>

          ${recipes && recipes.length > 0 ? `
            <div class="section-title">
              📋 المكونات المطلوبة
            </div>

            ${recipes.map(recipe => {
              const totalNeeded = recipe.quantity_needed * quantity;
              const stock = recipe.ingredient.current_stock;
              const stockStatus = stock > totalNeeded ? 'stock-ok' : stock > 0 ? 'stock-low' : 'stock-critical';
              
              return `
                <div class="ingredient">
                  <div class="ing-name">${recipe.ingredient.name}</div>
                  <div class="ing-details">
                    <span>الكمية: ${totalNeeded.toFixed(2)} ${recipe.ingredient.unit}</span>
                    <span class="${stockStatus}">المخزون: ${stock.toFixed(2)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          ` : `
            <div class="no-recipe">
              ⚠️ لا توجد وصفة محددة لهذا الصنف
            </div>
          `}

          <div class="footer">
            <div>تمت الطباعة من نظام المطعم</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    } else {
      alert('⚠️ لم نتمكن من فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.');
    }
  },

  generateAllRecipesPrintPage(recipesToPrint, orderNumber) {
    const now = new Date();

    const formatDate = (date) => {
      const d = new Date(date);
      return d.toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    };

    const formatTime = (date) => {
      const d = new Date(date);
      return d.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    };

    const restaurantName = (typeof SYSTEM_CONFIG !== 'undefined' && SYSTEM_CONFIG.restaurantName) 
      ? SYSTEM_CONFIG.restaurantName 
      : 'مطعم الفرعون';

    // إنشاء HTML لكل الـ recipes
    const allRecipesHTML = recipesToPrint.map((item, index) => `
      ${index > 0 ? '<div style="page-break-before: always; margin-top: 10mm;"></div>' : ''}
      
      <div class="receipt">
        <div class="header">
          <h1>${restaurantName}</h1>
          <div class="subtitle">🍳 Recipe - الوصفة</div>
          <div style="font-size: 10px; margin-top: 2mm;">طلب #${orderNumber} - (${index + 1}/${recipesToPrint.length})</div>
        </div>

        <div class="item-info">
          <div class="item-name">${item.menuItem.name_ar}</div>
          
          <div class="info-line">
            <span class="label">الفئة:</span>
            <span>${item.menuItem.category || 'غير محدد'}</span>
          </div>
          
          <div class="info-line">
            <span class="label">الكمية:</span>
            <span>× ${item.quantity}</span>
          </div>
          
          <div class="info-line">
            <span class="label">التاريخ:</span>
            <span>${formatDate(now)}</span>
          </div>
          
          <div class="info-line">
            <span class="label">الوقت:</span>
            <span>${formatTime(now)}</span>
          </div>
        </div>

        ${item.recipes && item.recipes.length > 0 ? `
          <div class="section-title">
            📋 المكونات المطلوبة
          </div>

          ${item.recipes.map(recipe => {
            const totalNeeded = recipe.quantity_needed * item.quantity;
            const stock = recipe.ingredient.current_stock;
            const stockStatus = stock > totalNeeded ? 'stock-ok' : stock > 0 ? 'stock-low' : 'stock-critical';
            
            return `
              <div class="ingredient">
                <div class="ing-name">${recipe.ingredient.name}</div>
                <div class="ing-details">
                  <span>الكمية: ${totalNeeded.toFixed(2)} ${recipe.ingredient.unit}</span>
                  <span class="${stockStatus}">المخزون: ${stock.toFixed(2)}</span>
                </div>
              </div>
            `;
          }).join('')}
        ` : `
          <div class="no-recipe">
            ⚠️ لا توجد وصفة محددة لهذا الصنف
          </div>
        `}

        <div class="footer">
          <div>تمت الطباعة من نظام المطعم</div>
        </div>
      </div>
    `).join('');

    const printHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>All Recipes - Order #${orderNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          @page {
            size: 80mm auto;
            margin: 0;
          }

          body {
            font-family: 'Cairo', 'Arial', sans-serif;
            width: 80mm;
            padding: 5mm;
            background: white;
            color: #000;
            font-size: 11px;
            line-height: 1.4;
          }

          .receipt {
            width: 100%;
            margin-bottom: 5mm;
          }

          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }

          .header h1 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2mm;
          }

          .header .subtitle {
            font-size: 12px;
            font-weight: bold;
          }

          .item-info {
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
            margin-bottom: 3mm;
          }

          .item-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 2mm;
            text-align: center;
          }

          .info-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 10px;
          }

          .label {
            font-weight: bold;
          }

          .section-title {
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            margin: 3mm 0;
            padding: 2mm 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
          }

          .ingredient {
            border-bottom: 1px dotted #ccc;
            padding: 2mm 0;
            font-size: 10px;
          }

          .ingredient:last-child {
            border-bottom: none;
          }

          .ing-name {
            font-weight: bold;
            margin-bottom: 1mm;
          }

          .ing-details {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #333;
          }

          .stock-ok { color: #2E7D32; font-weight: bold; }
          .stock-low { color: #E65100; font-weight: bold; }
          .stock-critical { color: #C62828; font-weight: bold; }

          .no-recipe {
            text-align: center;
            padding: 5mm;
            border: 1px dashed #000;
            margin: 3mm 0;
            font-size: 11px;
          }

          .footer {
            border-top: 2px dashed #000;
            padding-top: 3mm;
            margin-top: 5mm;
            text-align: center;
            font-size: 9px;
          }

          @media print {
            body {
              width: 80mm;
            }
          }
        </style>
      </head>
      <body>
        ${allRecipesHTML}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    } else {
      alert('⚠️ لم نتمكن من فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.');
    }
  },

  // دالة مساعدة للوقت
  getTimeDifference(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  },

  // تحديث حالة الطلب
  async updateOrderStatus(orderId, newStatus) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      if (newStatus === 'ready') {
        await supabase
          .from('deliveries')
          .update({ delivery_status: 'ready' })
          .eq('order_id', orderId);
      }

      const statusNames = {
        'preparing': 'قيد التحضير',
        'ready': 'جاهز',
        'completed': 'مكتمل'
      };

      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification(`تم تحديث الطلب إلى: ${statusNames[newStatus]}`, 'success');
      }

      if (newStatus === 'ready') {
        this.playNotificationSound();
      }

      await this.loadOrders();

    } catch (error) {
      console.error('Error updating order status:', error);
      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('حدث خطأ أثناء تحديث الحالة', 'error');
      }
    }
  },

  async notifyWaiter(orderId) {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, table_number')
        .eq('id', orderId)
        .single();

      if (typeof Utils !== 'undefined' && Utils.sendTelegramNotification) {
        Utils.sendTelegramNotification(
          `✅ <b>طلب جاهز!</b>\n` +
          `رقم الطلب: #${order.order_number}\n` +
          `الطاولة: ${order.table_number}`
        );
      }

      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('تم إرسال الإشعار', 'success');
      }

    } catch (error) {
      console.error('Error notifying waiter:', error);
    }
  },

  playNotificationSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZXR0LQKX05GxfIAUthM/z0YUzBx5uwO/jmV0dC0Cl9ORsXyAFLYTP89GFMw==');
      audio.play();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  },

  filterOrders(status) {
    this.currentFilter = status;

    document.querySelectorAll('.status-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    event.target.classList.add('active');

    this.displayOrders(this.orders);
  },

  startTimers() {
    setInterval(() => {
      document.querySelectorAll('.timer').forEach(timer => {
        const time = timer.getAttribute('data-time');
        const diff = this.getTimeDifference(time);
        timer.textContent = `${diff} دقيقة`;

        if (diff > 15) {
          timer.classList.add('urgent');
          timer.closest('.order-card').classList.add('urgent');
        }
      });
    }, 30000);
  },

  setupRealtimeSubscriptions() {
    if (typeof Realtime !== 'undefined' && Realtime.subscribeToOrders) {
      Realtime.subscribeToOrders((payload) => {
        if (payload.eventType === 'INSERT') {
          this.showNewOrderNotification();
          this.playNotificationSound();
        }
        this.loadOrders();
      });
    }
  },

  showNewOrderNotification() {
    const notification = document.createElement('div');
    notification.className = 'sound-notification';
    notification.innerHTML = `
      <h2 style="color: #ff6b6b; margin-bottom: 10px;">🔔</h2>
      <h3>طلب جديد!</h3>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  },

  setupEventListeners() {
    document.querySelectorAll('.status-tab').forEach(tab => {
      tab.addEventListener('click', function () {
        const status = this.getAttribute('data-status');
        KitchenDisplay.filterOrders(status);
      });
    });
  }
};

if (typeof window !== 'undefined') {
  window.KitchenDisplay = KitchenDisplay;
}

// Auto-Protection
if (typeof KitchenDisplay !== 'undefined' && KitchenDisplay.updateOrderStatus) {
  const originalUpdateStatus = KitchenDisplay.updateOrderStatus.bind(KitchenDisplay);
  KitchenDisplay.updateOrderStatus = async function(orderId, newStatus) {
    const operationId = `update-${orderId}-${newStatus}`;
    
    if (typeof Loading !== 'undefined' && Loading.isOperationActive && Loading.isOperationActive(operationId)) {
      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('جاري تحديث الطلب...', 'warning');
      }
      return;
    }

    if (typeof Loading !== 'undefined' && Loading.startOperation && !Loading.startOperation(operationId)) return;
    
    const statusNames = {
      'preparing': 'قيد التحضير',
      'ready': 'جاهز',
      'completed': 'مكتمل'
    };
    
    if (typeof Loading !== 'undefined' && Loading.show) {
      Loading.show(`جاري التحديث إلى: ${statusNames[newStatus]}`, '');
    }

    try {
      await originalUpdateStatus.call(this, orderId, newStatus);
      if (typeof Loading !== 'undefined' && Loading.success) {
        Loading.success(`تم التحديث إلى: ${statusNames[newStatus]} ✅`);
      }
    } catch (error) {
      if (typeof Loading !== 'undefined' && Loading.error) {
        Loading.error('حدث خطأ أثناء تحديث الحالة');
      }
      throw error;
    } finally {
      if (typeof Loading !== 'undefined' && Loading.endOperation) {
        Loading.endOperation(operationId);
      }
    }
  };
}

if (typeof KitchenDisplay !== 'undefined' && KitchenDisplay.loadOrders && typeof protectAsync !== 'undefined') {
  const originalLoadOrders = KitchenDisplay.loadOrders.bind(KitchenDisplay);
  KitchenDisplay.loadOrders = protectAsync(originalLoadOrders, 'load-orders', false);
}

if (typeof KitchenDisplay !== 'undefined' && KitchenDisplay.loadRecipeForItem && typeof protectAsync !== 'undefined') {
  const originalLoadRecipe = KitchenDisplay.loadRecipeForItem.bind(KitchenDisplay);
  KitchenDisplay.loadRecipeForItem = protectAsync(originalLoadRecipe, 'load-recipe', false);
}

console.log('✅ Kitchen Display with All Recipes Printing initialized');


