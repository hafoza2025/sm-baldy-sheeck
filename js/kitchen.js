// js/kitchen.js
// وظائف شاشة المطبخ مع عرض Recipes وطباعتها - نسخة بسيطة بدون ماليات

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
                  
                  <!-- زر طباعة Recipe -->
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
  // طباعة Recipe - نسخة بسيطة بدون ماليات 🖨️
  // ===================================
  async printRecipe(orderItemId, menuItemId, quantity, itemName) {
    try {
      // إظهار Loading
      if (typeof Loading !== 'undefined' && Loading.show) {
        Loading.show('جاري تحميل Recipe...', 'يرجى الانتظار');
      }

      // جلب معلومات الصنف
      const { data: menuItem, error: menuError } = await supabase
        .from('menu_items')
        .select('name_ar, category')
        .eq('id', menuItemId)
        .single();

      if (menuError) {
        console.error('Menu Error:', menuError);
        throw menuError;
      }

      // جلب Recipe (المكونات المطلوبة)
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

      // إخفاء Loading
      if (typeof Loading !== 'undefined' && Loading.hide) {
        Loading.hide();
      }

      // إنشاء صفحة الطباعة (يطبع حتى لو لا توجد recipe)
      this.generateRecipePrintPage(menuItem, recipes || [], quantity);

    } catch (error) {
      console.error('Error printing recipe:', error);
      
      // إخفاء Loading في حالة الخطأ
      if (typeof Loading !== 'undefined' && Loading.hide) {
        Loading.hide();
      }
      
      // إظهار رسالة خطأ
      const errorMsg = error.message || 'حدث خطأ غير معروف';
      if (typeof Utils !== 'undefined' && Utils.showNotification) {
        Utils.showNotification('حدث خطأ في تحميل Recipe: ' + errorMsg, 'error');
      } else {
        alert('حدث خطأ في تحميل Recipe: ' + errorMsg);
      }
    }
  },

  generateRecipePrintPage(menuItem, recipes, quantity) {
    const now = new Date();

    // دوال مساعدة للتنسيق
    const formatDate = (date) => {
      const d = new Date(date);
      return d.toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const formatTime = (date) => {
      const d = new Date(date);
      return d.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    };

    // اسم المطعم
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

          body {
            font-family: 'Cairo', Arial, sans-serif;
            padding: 20mm;
            background: #FAF3E0;
            color: #333;
          }

          .recipe-container {
            background: white;
            border: 4px solid #D4B896;
            padding: 20mm;
            max-width: 210mm;
            margin: 0 auto;
            position: relative;
          }

          .recipe-container::before {
            content: '';
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            border-top: 4px solid #D4AF37;
            border-right: 4px solid #D4AF37;
          }

          .recipe-container::after {
            content: '';
            position: absolute;
            bottom: 10px;
            left: 10px;
            width: 40px;
            height: 40px;
            border-bottom: 4px solid #D4AF37;
            border-left: 4px solid #D4AF37;
          }

          .recipe-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #D4B896;
          }

          .recipe-header h1 {
            font-size: 32px;
            color: #D4AF37;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }

          .recipe-header .subtitle {
            font-size: 18px;
            color: #8B7355;
            font-weight: bold;
          }

          .item-info {
            background: #F5E6D3;
            padding: 15px;
            border: 2px solid #D4B896;
            margin-bottom: 25px;
          }

          .item-info h2 {
            font-size: 28px;
            color: #8B7355;
            margin-bottom: 10px;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #D4B896;
          }

          .info-row:last-child {
            border-bottom: none;
          }

          .info-label {
            font-weight: bold;
            color: #8B7355;
          }

          .info-value {
            color: #333;
            font-weight: bold;
          }

          .ingredients-section {
            margin-bottom: 25px;
          }

          .ingredients-section h3 {
            font-size: 22px;
            color: #8B7355;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #D4B896;
          }

          .ingredients-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #D4B896;
          }

          .ingredients-table thead {
            background: #E8D7C1;
          }

          .ingredients-table th,
          .ingredients-table td {
            padding: 12px;
            text-align: right;
            border: 1px solid #D4B896;
          }

          .ingredients-table th {
            font-weight: bold;
            color: #8B7355;
            text-transform: uppercase;
            font-size: 14px;
          }

          .ingredients-table tbody tr:nth-child(even) {
            background: #FAF3E0;
          }

          .stock-ok {
            color: #2E7D32;
            font-weight: bold;
          }

          .stock-low {
            color: #E65100;
            font-weight: bold;
          }

          .stock-critical {
            color: #C62828;
            font-weight: bold;
          }

          .no-recipe-notice {
            background: #FFF3CD;
            padding: 20px;
            border: 3px solid #F57C00;
            border-radius: 8px;
            text-align: center;
            color: #856404;
            font-size: 16px;
            font-weight: bold;
          }

          .recipe-footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #D4B896;
            text-align: center;
            font-size: 12px;
            color: #8B7355;
          }

          @media print {
            body {
              padding: 0;
              background: white;
            }

            .recipe-container {
              border: none;
              box-shadow: none;
            }

            @page {
              margin: 15mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="recipe-container">
          <div class="recipe-header">
            <h1>🍳 Recipe - الوصفة</h1>
            <div class="subtitle">مطبخ المعبد المقدس</div>
          </div>

          <div class="item-info">
            <h2>${menuItem.name_ar}</h2>
            <div class="info-row">
              <span class="info-label">الفئة:</span>
              <span class="info-value">${menuItem.category || 'غير محدد'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">الكمية المطلوبة:</span>
              <span class="info-value">× ${quantity}</span>
            </div>
            <div class="info-row">
              <span class="info-label">التاريخ والوقت:</span>
              <span class="info-value">${formatDate(now)} - ${formatTime(now)}</span>
            </div>
          </div>

          ${recipes && recipes.length > 0 ? `
            <div class="ingredients-section">
              <h3>📋 المكونات المطلوبة</h3>
              <table class="ingredients-table">
                <thead>
                  <tr>
                    <th>المكون</th>
                    <th>الكمية لوحدة واحدة</th>
                    <th>الكمية الإجمالية</th>
                    <th>الوحدة</th>
                    <th>المخزون الحالي</th>
                  </tr>
                </thead>
                <tbody>
                  ${recipes.map(recipe => {
                    const totalNeeded = recipe.quantity_needed * quantity;
                    const stock = recipe.ingredient.current_stock;
                    const stockStatus = stock > totalNeeded ? 'stock-ok' : stock > 0 ? 'stock-low' : 'stock-critical';
                    
                    return `
                      <tr>
                        <td><strong>${recipe.ingredient.name}</strong></td>
                        <td>${recipe.quantity_needed.toFixed(2)}</td>
                        <td><strong>${totalNeeded.toFixed(2)}</strong></td>
                        <td>${recipe.ingredient.unit}</td>
                        <td class="${stockStatus}">${stock.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="no-recipe-notice">
              ⚠️ لا توجد وصفة محددة لهذا الصنف
            </div>
          `}

          <div class="recipe-footer">
            <p>تمت الطباعة من نظام إدارة المطعم - ${restaurantName}</p>
          </div>
        </div>

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

    // فتح نافذة جديدة للطباعة
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    
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

// ===============================
// Auto-Protection للدوال
// ===============================

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

console.log('✅ Kitchen Display with Simple Recipe Printing initialized');
