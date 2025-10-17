// js/inventory.js
// نظام إدارة المخزون والوصفات

const InventoryManager = {
  currentUser: null,
  allIngredients: [],
  allRecipes: [],
  allMenuItems: [],
  currentMenuItem: null,

  // التهيئة
  async init() {
    this.currentUser = Auth.checkAuth(['admin', 'kitchen']);
    if (!this.currentUser) return;

    document.getElementById('userName').textContent = `مرحباً، ${this.currentUser.full_name}`;
    
    await this.loadAllData();
    this.setupEventListeners();
    this.setupRealtimeSubscriptions();
  },

  // تحميل جميع البيانات
  async loadAllData() {
    await Promise.all([
      this.loadIngredients(),
      this.loadMenuItems(),
      this.updateStats()
    ]);
  },

  // تحميل المكونات
  async loadIngredients() {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      this.allIngredients = data;
      this.displayIngredients(data);
      
    } catch (error) {
      console.error('Error loading ingredients:', error);
      Utils.showNotification('خطأ في تحميل المكونات', 'error');
    }
  },

  // عرض المكونات
  displayIngredients(ingredients) {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;

    tbody.innerHTML = ingredients.map(item => {
      const totalValue = (item.current_stock * item.cost_per_unit).toFixed(2);
      const stockStatus = this.getStockStatus(item);
      
      return `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td style="font-weight: bold; ${stockStatus === 'critical' ? 'color: #f44336;' : stockStatus === 'low' ? 'color: #ff9800;' : ''}">${item.current_stock.toFixed(2)}</td>
          <td>${item.unit}</td>
          <td>${item.min_stock.toFixed(2)}</td>
          <td>${Utils.formatCurrency(item.cost_per_unit)}</td>
          <td><strong>${Utils.formatCurrency(totalValue)}</strong></td>
          <td>${this.getStockStatusBadge(stockStatus)}</td>
          <td>
            <button class="action-btn btn-update" onclick="InventoryManager.openUpdateStockModal(${item.id})">
              📦 تحديث
            </button>
            <button class="action-btn btn-edit" onclick="InventoryManager.editIngredient(${item.id})">
              ✏️ تعديل
            </button>
            <button class="action-btn btn-delete" onclick="InventoryManager.deleteIngredient(${item.id})">
              🗑️ حذف
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // تحديد حالة المخزون
  getStockStatus(ingredient) {
    if (ingredient.current_stock <= 0) return 'critical';
    if (ingredient.current_stock <= ingredient.min_stock) return 'low';
    return 'normal';
  },

  // عرض حالة المخزون
  getStockStatusBadge(status) {
    const badges = {
      'normal': '<span class="stock-status stock-normal">✅ عادي</span>',
      'low': '<span class="stock-status stock-low">⚠️ منخفض</span>',
      'critical': '<span class="stock-status stock-critical">🔴 حرج</span>'
    };
    return badges[status] || '';
  },

  // فلترة المكونات
  filterIngredients() {
    const search = document.getElementById('searchIngredient').value.toLowerCase();
    const status = document.getElementById('filterStockStatus').value;

    let filtered = this.allIngredients;

    if (search) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(search)
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter(item => 
        this.getStockStatus(item) === status
      );
    }

    this.displayIngredients(filtered);
  },

  // تحميل أصناف المنيو
  async loadMenuItems() {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('name_ar');
      
      if (error) throw error;
      
      this.allMenuItems = data;
      
      const select = document.getElementById('menuItemSelect');
      if (select) {
        select.innerHTML = `
          <option value="">-- اختر صنف من المنيو --</option>
          ${data.map(item => `
            <option value="${item.id}">${item.name_ar}</option>
          `).join('')}
        `;
      }
      
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  },

  // تحميل وصفة صنف
  async loadRecipesForItem() {
    const select = document.getElementById('menuItemSelect');
    const menuItemId = select.value;

    if (!menuItemId) {
      document.getElementById('recipeContent').innerHTML = `
        <div class="empty-state">
          <h3>اختر صنفاً من المنيو لعرض وصفته</h3>
        </div>
      `;
      return;
    }

    this.currentMenuItem = this.allMenuItems.find(item => item.id == menuItemId);

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredient:ingredient_id(*)
        `)
        .eq('menu_item_id', menuItemId);
      
      if (error) throw error;
      
      this.allRecipes = data;
      this.displayRecipes(data);
      
    } catch (error) {
      console.error('Error loading recipes:', error);
      Utils.showNotification('خطأ في تحميل الوصفة', 'error');
    }
  },

  // عرض الوصفات
  displayRecipes(recipes) {
    const container = document.getElementById('recipeContent');

    if (recipes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>لا توجد وصفة لهذا الصنف</h3>
          <button class="btn btn-primary" onclick="InventoryManager.openAddRecipeModal()">
            ➕ إضافة مكونات للوصفة
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="recipe-card">
        <div class="recipe-header">
          <h3>📋 وصفة: ${this.currentMenuItem.name_ar}</h3>
          <button class="btn btn-primary" onclick="InventoryManager.openAddRecipeModal()">
            ➕ إضافة مكون
          </button>
        </div>
        
        <div class="recipe-ingredients">
          ${recipes.map(recipe => {
            const ingredient = recipe.ingredient;
            const isLow = ingredient.current_stock < (recipe.quantity_needed * 5);
            
            return `
              <div class="ingredient-item">
                <div class="ingredient-info">
                  <div class="ingredient-name">${ingredient.name}</div>
                  <div class="ingredient-quantity">
                    الكمية المطلوبة: <strong>${recipe.quantity_needed} ${ingredient.unit}</strong>
                  </div>
                  <div class="ingredient-stock ${isLow ? 'stock-low' : ''}">
                    المخزون الحالي: ${ingredient.current_stock.toFixed(2)} ${ingredient.unit}
                    ${isLow ? ' ⚠️' : ' ✅'}
                  </div>
                </div>
                <div class="ingredient-actions">
                  <button class="action-btn btn-edit" onclick="InventoryManager.editRecipeItem(${recipe.id})">
                    ✏️
                  </button>
                  <button class="action-btn btn-delete" onclick="InventoryManager.deleteRecipeItem(${recipe.id})">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // تحديث الإحصائيات
  async updateStats() {
    try {
      // عدد المكونات
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('id, current_stock, min_stock, cost_per_unit');

      document.getElementById('totalIngredients').textContent = ingredients?.length || 0;

      // المكونات المنخفضة
      const lowStock = ingredients?.filter(i => i.current_stock <= i.min_stock).length || 0;
      document.getElementById('lowStockCount').textContent = lowStock;

      // قيمة المخزون
      const totalValue = ingredients?.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit), 0) || 0;
      document.getElementById('totalValue').textContent = Utils.formatCurrency(totalValue);

      // عدد الوصفات
      const { data: recipes } = await supabase
        .from('recipes')
        .select('menu_item_id');

      const uniqueMenuItems = [...new Set(recipes?.map(r => r.menu_item_id))].length;
      document.getElementById('totalRecipes').textContent = uniqueMenuItems;

    } catch (error) {
      console.error('Error updating stats:', error);
    }
  },

  // إضافة مكون جديد
  openAddIngredientModal() {
    document.getElementById('addIngredientModal').classList.add('active');
    document.getElementById('addIngredientForm').reset();
  },

  closeAddIngredientModal() {
    document.getElementById('addIngredientModal').classList.remove('active');
  },

  async saveIngredient(e) {
    e.preventDefault();

    const ingredientData = {
      name: document.getElementById('ingredientName').value,
      unit: document.getElementById('ingredientUnit').value,
      current_stock: parseFloat(document.getElementById('ingredientStock').value),
      min_stock: parseFloat(document.getElementById('ingredientMinStock').value),
      cost_per_unit: parseFloat(document.getElementById('ingredientCost').value),
      supplier: document.getElementById('ingredientSupplier').value || null
    };

    try {
      const { error } = await supabase
        .from('ingredients')
        .insert([ingredientData]);

      if (error) throw error;

      Utils.showNotification('تم إضافة المكون بنجاح ✅', 'success');
      this.closeAddIngredientModal();
      await this.loadAllData();

    } catch (error) {
      console.error('Error saving ingredient:', error);
      Utils.showNotification('حدث خطأ أثناء الحفظ', 'error');
    }
  },

  // تحديث المخزون
  openUpdateStockModal(ingredientId) {
    const ingredient = this.allIngredients.find(i => i.id === ingredientId);
    if (!ingredient) return;

    document.getElementById('updateIngredientId').value = ingredient.id;
    document.getElementById('updateIngredientName').value = ingredient.name;
    document.getElementById('updateCurrentStock').value = `${ingredient.current_stock} ${ingredient.unit}`;
    document.getElementById('updateQuantity').value = '';
    document.getElementById('updateNewStock').value = '';
    document.getElementById('updateNotes').value = '';

    document.getElementById('updateStockModal').classList.add('active');
  },

  closeUpdateStockModal() {
    document.getElementById('updateStockModal').classList.remove('active');
  },

  updateStockTypeChanged() {
    const type = document.getElementById('updateType').value;
    const label = document.getElementById('updateQuantityLabel');

    if (type === 'add') {
      label.textContent = 'الكمية المضافة *';
    } else if (type === 'deduct') {
      label.textContent = 'الكمية المخصومة *';
    } else {
      label.textContent = 'الكمية الجديدة *';
    }

    this.calculateNewStock();
  },

  calculateNewStock() {
    const ingredientId = document.getElementById('updateIngredientId').value;
    const ingredient = this.allIngredients.find(i => i.id == ingredientId);
    if (!ingredient) return;

    const type = document.getElementById('updateType').value;
    const quantity = parseFloat(document.getElementById('updateQuantity').value) || 0;
    let newStock = ingredient.current_stock;

    if (type === 'add') {
      newStock = ingredient.current_stock + quantity;
    } else if (type === 'deduct') {
      newStock = ingredient.current_stock - quantity;
    } else if (type === 'set') {
      newStock = quantity;
    }

    document.getElementById('updateNewStock').value = `${newStock.toFixed(2)} ${ingredient.unit}`;
  },

  async saveStockUpdate(e) {
    e.preventDefault();

    const ingredientId = document.getElementById('updateIngredientId').value;
    const type = document.getElementById('updateType').value;
    const quantity = parseFloat(document.getElementById('updateQuantity').value);
    const notes = document.getElementById('updateNotes').value;

    const ingredient = this.allIngredients.find(i => i.id == ingredientId);
    if (!ingredient) return;

    let newStock = ingredient.current_stock;
    if (type === 'add') {
      newStock = ingredient.current_stock + quantity;
    } else if (type === 'deduct') {
      newStock = ingredient.current_stock - quantity;
    } else if (type === 'set') {
      newStock = quantity;
    }

    try {
      const { error } = await supabase
        .from('ingredients')
        .update({ current_stock: newStock })
        .eq('id', ingredientId);

      if (error) throw error;

      // تسجيل الحركة
      await supabase
        .from('inventory_transactions')
        .insert([{
          ingredient_id: ingredientId,
          quantity_used: type === 'deduct' ? quantity : -quantity,
          transaction_type: type,
          notes: notes
        }]);

      Utils.showNotification('تم تحديث المخزون بنجاح ✅', 'success');
      this.closeUpdateStockModal();
      await this.loadAllData();

    } catch (error) {
      console.error('Error updating stock:', error);
      Utils.showNotification('حدث خطأ أثناء التحديث', 'error');
    }
  },

  // حذف مكون
  async deleteIngredient(ingredientId) {
    if (!confirm('هل أنت متأكد من حذف هذا المكون؟')) return;

    try {
      const { error } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', ingredientId);

      if (error) throw error;

      Utils.showNotification('تم حذف المكون بنجاح', 'success');
      await this.loadAllData();

    } catch (error) {
      console.error('Error deleting ingredient:', error);
      Utils.showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  },

  // إضافة وصفة
  openAddRecipeModal() {
    if (!this.currentMenuItem) {
      Utils.showNotification('يرجى اختيار صنف أولاً', 'error');
      return;
    }

    document.getElementById('recipeMenuItem').value = this.currentMenuItem.name_ar;
    
    const select = document.getElementById('recipeIngredient');
    select.innerHTML = `
      <option value="">-- اختر المكون --</option>
      ${this.allIngredients.map(ing => `
        <option value="${ing.id}" data-unit="${ing.unit}">${ing.name}</option>
      `).join('')}
    `;

    document.getElementById('addRecipeModal').classList.add('active');
  },

  closeAddRecipeModal() {
    document.getElementById('addRecipeModal').classList.remove('active');
  },

  async saveRecipe(e) {
    e.preventDefault();

    const ingredientId = document.getElementById('recipeIngredient').value;
    const quantity = parseFloat(document.getElementById('recipeQuantity').value);

    const recipeData = {
      menu_item_id: this.currentMenuItem.id,
      ingredient_id: ingredientId,
      quantity_needed: quantity
    };

    try {
      const { error } = await supabase
        .from('recipes')
        .insert([recipeData]);

      if (error) throw error;

      Utils.showNotification('تم إضافة المكون للوصفة ✅', 'success');
      this.closeAddRecipeModal();
      await this.loadRecipesForItem();

    } catch (error) {
      console.error('Error saving recipe:', error);
      Utils.showNotification('حدث خطأ أثناء الحفظ', 'error');
    }
  },

  // حذف مكون من الوصفة
  async deleteRecipeItem(recipeId) {
    if (!confirm('هل أنت متأكد من حذف هذا المكون من الوصفة؟')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;

      Utils.showNotification('تم حذف المكون من الوصفة', 'success');
      await this.loadRecipesForItem();

    } catch (error) {
      console.error('Error deleting recipe item:', error);
      Utils.showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  },

  // تحميل حركة المخزون
  async loadTransactions() {
    const dateFrom = document.getElementById('transactionDateFrom').value;
    const dateTo = document.getElementById('transactionDateTo').value;

    try {
      let query = supabase
        .from('inventory_transactions')
        .select(`
          *,
          ingredient:ingredient_id(name, unit),
          order:order_id(order_number)
        `)
        .order('transaction_date', { ascending: false })
        .limit(100);

      if (dateFrom) {
        query = query.gte('transaction_date', dateFrom);
      }

      if (dateTo) {
        query = query.lte('transaction_date', dateTo + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) throw error;

      this.displayTransactions(data);

    } catch (error) {
      console.error('Error loading transactions:', error);
      Utils.showNotification('خطأ في تحميل الحركات', 'error');
    }
  },

  displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsBody');

    tbody.innerHTML = transactions.map(t => `
      <tr>
        <td>${Utils.formatDate(t.transaction_date)}</td>
        <td>${t.ingredient?.name || '-'}</td>
        <td>${t.quantity_used.toFixed(2)} ${t.ingredient?.unit || ''}</td>
        <td>${t.order?.order_number ? `#${t.order.order_number}` : '-'}</td>
        <td>${this.getTransactionType(t.transaction_type)}</td>
      </tr>
    `).join('');
  },

  getTransactionType(type) {
    const types = {
      'deduct': '📉 خصم',
      'add': '📈 إضافة',
      'adjust': '⚙️ تعديل'
    };
    return types[type] || type;
  },

  // تصدير Excel
  exportInventory() {
    const data = this.allIngredients.map(item => ({
      'المكون': item.name,
      'الكمية الحالية': item.current_stock,
      'الوحدة': item.unit,
      'الحد الأدنى': item.min_stock,
      'التكلفة/الوحدة': item.cost_per_unit,
      'القيمة الإجمالية': item.current_stock * item.cost_per_unit,
      'الحالة': this.getStockStatus(item)
    }));

    Utils.exportToExcel(data, 'المخزون');
    Utils.showNotification('تم تصدير البيانات بنجاح', 'success');
  },

  exportRecipes() {
    if (!this.allRecipes.length) {
      Utils.showNotification('لا توجد وصفة لتصديرها', 'warning');
      return;
    }

    const data = this.allRecipes.map(recipe => ({
      'الصنف': this.currentMenuItem.name_ar,
      'المكون': recipe.ingredient.name,
      'الكمية المطلوبة': recipe.quantity_needed,
      'الوحدة': recipe.ingredient.unit,
      'المخزون الحالي': recipe.ingredient.current_stock
    }));

    Utils.exportToExcel(data, `وصفة_${this.currentMenuItem.name_ar}`);
    Utils.showNotification('تم تصدير الوصفة بنجاح', 'success');
  },

  // مستمعي الأحداث
  setupEventListeners() {
    // إضافة مكون
    document.getElementById('addIngredientForm').addEventListener('submit', (e) => {
      this.saveIngredient(e);
    });

    // تحديث المخزون
    document.getElementById('updateStockForm').addEventListener('submit', (e) => {
      this.saveStockUpdate(e);
    });

    document.getElementById('updateQuantity').addEventListener('input', () => {
      this.calculateNewStock();
    });

    document.getElementById('updateType').addEventListener('change', () => {
      this.updateStockTypeChanged();
    });

    // إضافة وصفة
    document.getElementById('addRecipeForm').addEventListener('submit', (e) => {
      this.saveRecipe(e);
    });

    document.getElementById('recipeIngredient').addEventListener('change', (e) => {
      const option = e.target.selectedOptions[0];
      const unit = option.getAttribute('data-unit');
      document.getElementById('recipeUnit').value = unit || '';
    });
  },

  // Realtime
  setupRealtimeSubscriptions() {
    Realtime.subscribeToInventory(() => {
      this.loadIngredients();
      this.updateStats();
    });
  }
};

// تهيئة عند تحميل الصفحة
if (typeof window !== 'undefined') {
  window.InventoryManager = InventoryManager;
}

// Auto-Protection للدوال
if (typeof protectAsync !== 'undefined') {
  if (InventoryManager.saveIngredient) {
    const original = InventoryManager.saveIngredient.bind(InventoryManager);
    InventoryManager.saveIngredient = protectAsync(original, 'save-ingredient', true);
  }

  if (InventoryManager.saveStockUpdate) {
    const original = InventoryManager.saveStockUpdate.bind(InventoryManager);
    InventoryManager.saveStockUpdate = protectAsync(original, 'update-stock', true);
  }

  if (InventoryManager.saveRecipe) {
    const original = InventoryManager.saveRecipe.bind(InventoryManager);
    InventoryManager.saveRecipe = protectAsync(original, 'save-recipe', true);
  }
}

console.log('✅ Inventory Manager loaded');
