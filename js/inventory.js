// js/recipes-advanced.js
// نظام Recipe Management المتقدم - متزامن 100%

const RecipeManager = {
  currentUser: null,
  allMenuItems: [],
  allIngredients: [],
  allRecipes: [],
  selectedMenuItem: null,
  currentRecipe: [],
  currentFilter: 'all',

  // التهيئة
  async init() {
    // حماية الوصول - Admin فقط
    this.currentUser = Auth.checkRecipeAccess();
    if (!this.currentUser) return;

    document.getElementById('adminName').textContent = `مرحباً، ${this.currentUser.full_name}`;
    
    await this.loadAllData();
    this.setupEventListeners();
    this.setupRealtimeSubscriptions();
    this.updateDashboardStats();
  },

  // تحميل جميع البيانات
  async loadAllData() {
    Loading.show('جاري تحميل البيانات...', 'يرجى الانتظار');
    
    try {
      await Promise.all([
        this.loadMenuItems(),
        this.loadIngredients(),
        this.loadAllRecipes()
      ]);
      
      Loading.hide();
    } catch (error) {
      Loading.error('حدث خطأ في تحميل البيانات');
      console.error('Error loading data:', error);
    }
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
      this.displayMenuItems();
      
    } catch (error) {
      console.error('Error loading menu items:', error);
      throw error;
    }
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
      this.displayInventoryPanel();
      
    } catch (error) {
      console.error('Error loading ingredients:', error);
      throw error;
    }
  },

  // تحميل جميع الوصفات
  async loadAllRecipes() {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredient:ingredient_id(*),
          menu_item:menu_item_id(*)
        `);
      
      if (error) throw error;
      
      this.allRecipes = data;
      
    } catch (error) {
      console.error('Error loading recipes:', error);
      throw error;
    }
  },

  // عرض أصناف المنيو
  displayMenuItems() {
    const container = document.getElementById('menuItemsList');
    let filtered = this.allMenuItems;

    // تطبيق الفلتر
    if (this.currentFilter === 'has-recipe') {
      filtered = filtered.filter(item => 
        this.allRecipes.some(r => r.menu_item_id === item.id)
      );
    } else if (this.currentFilter === 'no-recipe') {
      filtered = filtered.filter(item => 
        !this.allRecipes.some(r => r.menu_item_id === item.id)
      );
    }

    // البحث
    const searchTerm = document.getElementById('searchMenuItem')?.value?.toLowerCase() || '';
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name_ar.toLowerCase().includes(searchTerm) ||
        item.name.toLowerCase().includes(searchTerm)
      );
    }

    container.innerHTML = filtered.map(item => {
      const hasRecipe = this.allRecipes.some(r => r.menu_item_id === item.id);
      const isSelected = this.selectedMenuItem?.id === item.id;
      
      return `
        <div class="menu-item-card ${hasRecipe ? 'has-recipe' : 'no-recipe'} ${isSelected ? 'selected' : ''}" 
             onclick="RecipeManager.selectMenuItem(${item.id})">
          <div class="menu-item-name">${item.name_ar}</div>
          <div class="menu-item-meta">
            <span class="menu-item-badge">${Utils.formatCurrency(item.price)}</span>
            <span class="menu-item-badge">${item.category}</span>
            ${hasRecipe ? '<span class="menu-item-badge" style="background: #d4edda; color: #155724;">✓ Recipe</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // تحديث عدادات الفلاتر
    document.getElementById('filterCountAll').textContent = this.allMenuItems.length;
    document.getElementById('filterCountHas').textContent = 
      this.allMenuItems.filter(item => this.allRecipes.some(r => r.menu_item_id === item.id)).length;
    document.getElementById('filterCountNo').textContent = 
      this.allMenuItems.filter(item => !this.allRecipes.some(r => r.menu_item_id === item.id)).length;
  },

  // تعيين الفلتر
  setFilter(filter) {
    this.currentFilter = filter;
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    this.displayMenuItems();
  },

  // فلترة البحث
  filterMenuItems() {
    this.displayMenuItems();
  },

  // اختيار صنف
  async selectMenuItem(itemId) {
    this.selectedMenuItem = this.allMenuItems.find(item => item.id === itemId);
    if (!this.selectedMenuItem) return;

    // تحديث العرض
    this.displayMenuItems();
    
    // إخفاء placeholder وإظهار المحتوى
    document.getElementById('editorPlaceholder').style.display = 'none';
    document.getElementById('editorContent').style.display = 'block';

    // تحميل Recipe الخاص بالصنف
    await this.loadRecipeForItem(itemId);
    
    // عرض معلومات الصنف
    this.displayItemInfo();
    
    // عرض Recipe
    this.displayRecipe();
    
    // حساب التكاليف
    this.calculateCosts();
    
    // معاينة المطبخ
    this.updateKitchenPreview();
  },

  // تحميل Recipe لصنف معين
  async loadRecipeForItem(itemId) {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredient:ingredient_id(*)
        `)
        .eq('menu_item_id', itemId);
      
      if (error) throw error;
      
      this.currentRecipe = data || [];
      
    } catch (error) {
      console.error('Error loading recipe:', error);
      Utils.showNotification('خطأ في تحميل الوصفة', 'error');
    }
  },

  // عرض معلومات الصنف
  displayItemInfo() {
    const item = this.selectedMenuItem;
    
    document.getElementById('recipeItemImage').src = item.image_url || 'https://via.placeholder.com/100';
    document.getElementById('recipeItemName').textContent = item.name_ar;
    document.getElementById('recipeItemPrice').textContent = Utils.formatCurrency(item.price);
    document.getElementById('recipeItemCategory').textContent = item.category;
    
    const statusBadge = document.getElementById('recipeStatus');
    if (this.currentRecipe.length > 0) {
      statusBadge.innerHTML = `✅ Recipe كاملة (${this.currentRecipe.length} مكونات)`;
      statusBadge.style.background = 'rgba(76, 175, 80, 0.2)';
      statusBadge.style.color = '#155724';
    } else {
      statusBadge.innerHTML = '⚠️ لا توجد وصفة';
      statusBadge.style.background = 'rgba(255, 152, 0, 0.2)';
      statusBadge.style.color = '#856404';
    }
  },

  // عرض Recipe
  displayRecipe() {
    if (this.currentRecipe.length === 0) {
      document.getElementById('emptyRecipeState').style.display = 'block';
      document.getElementById('ingredientsTable').style.display = 'none';
      return;
    }

    document.getElementById('emptyRecipeState').style.display = 'none';
    document.getElementById('ingredientsTable').style.display = 'block';

    const tbody = document.getElementById('ingredientsBody');
    
    tbody.innerHTML = this.currentRecipe.map(recipe => {
      const ingredient = recipe.ingredient;
      const cost = (recipe.quantity_needed * ingredient.cost_per_unit).toFixed(2);
      const stockStatus = this.getStockStatus(ingredient, recipe.quantity_needed);
      
      return `
        <tr>
          <td class="ingredient-name-cell">${ingredient.name}</td>
          <td><strong>${recipe.quantity_needed.toFixed(3)} ${ingredient.unit}</strong></td>
          <td>${ingredient.current_stock.toFixed(2)} ${ingredient.unit}</td>
          <td><strong>${Utils.formatCurrency(cost)}</strong></td>
          <td>${this.getStockBadge(stockStatus)}</td>
          <td>
            <button class="action-btn btn-edit" onclick="RecipeManager.openEditIngredientModal(${recipe.id})">
              ✏️
            </button>
            <button class="action-btn btn-delete" onclick="RecipeManager.deleteIngredient(${recipe.id})">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // حالة المخزون
  getStockStatus(ingredient, quantityNeeded) {
    const availableServings = ingredient.current_stock / quantityNeeded;
    
    if (availableServings >= 20) return 'ok';
    if (availableServings >= 5) return 'low';
    return 'critical';
  },

  getStockBadge(status) {
    const badges = {
      'ok': '<span class="stock-badge stock-ok">✅ متوفر</span>',
      'low': '<span class="stock-badge stock-low">⚠️ منخفض</span>',
      'critical': '<span class="stock-badge stock-critical">🔴 حرج</span>'
    };
    return badges[status];
  },

  // حساب التكاليف
  calculateCosts() {
    if (this.currentRecipe.length === 0) {
      document.getElementById('costIngredients').textContent = '0.00 جنيه';
      document.getElementById('suggestedPrice').textContent = '0.00 جنيه';
      document.getElementById('currentPrice').textContent = '0.00 جنيه';
      document.getElementById('totalCost').textContent = '0.00 جنيه';
      return;
    }

    const totalCost = this.currentRecipe.reduce((sum, recipe) => {
      return sum + (recipe.quantity_needed * recipe.ingredient.cost_per_unit);
    }, 0);

    const profitMargin = parseFloat(document.getElementById('profitMargin')?.value || 200);
    const suggestedPrice = totalCost * (1 + profitMargin / 100);

    document.getElementById('costIngredients').textContent = Utils.formatCurrency(totalCost);
    document.getElementById('suggestedPrice').textContent = Utils.formatCurrency(suggestedPrice);
    document.getElementById('currentPrice').textContent = Utils.formatCurrency(this.selectedMenuItem.price);
    document.getElementById('totalCost').textContent = Utils.formatCurrency(totalCost);
  },

  // فتح modal إضافة مكون
  openAddIngredientModal() {
    if (!this.selectedMenuItem) {
      Utils.showNotification('يرجى اختيار صنف أولاً', 'error');
      return;
    }

    // ملء قائمة المكونات
    const select = document.getElementById('ingredientSelect');
    select.innerHTML = `
      <option value="">-- اختر المكون --</option>
      ${this.allIngredients.map(ing => `
        <option value="${ing.id}" 
                data-unit="${ing.unit}" 
                data-stock="${ing.current_stock}"
                data-cost="${ing.cost_per_unit}">
          ${ing.name}
        </option>
      `).join('')}
    `;

    document.getElementById('ingredientDetails').style.display = 'none';
    document.getElementById('addIngredientForm').reset();
    document.getElementById('addIngredientModal').classList.add('active');
  },

  closeAddIngredientModal() {
    document.getElementById('addIngredientModal').classList.remove('active');
  },

  // عند اختيار مكون
  ingredientSelected() {
    const select = document.getElementById('ingredientSelect');
    const option = select.selectedOptions[0];
    
    if (!option || !option.value) {
      document.getElementById('ingredientDetails').style.display = 'none';
      return;
    }

    const unit = option.getAttribute('data-unit');
    const stock = parseFloat(option.getAttribute('data-stock'));
    const cost = parseFloat(option.getAttribute('data-cost'));
    
    document.getElementById('detailUnit').textContent = unit;
    document.getElementById('detailStock').textContent = `${stock.toFixed(2)} ${unit}`;
    document.getElementById('detailCost').textContent = Utils.formatCurrency(cost);
    
    const status = stock > 20 ? '✅ متوفر' : stock > 5 ? '⚠️ منخفض' : '🔴 حرج';
    document.getElementById('detailStatus').textContent = status;
    
    document.getElementById('quantityUnit').textContent = unit;
    document.getElementById('ingredientDetails').style.display = 'block';
  },

  // حساب تكلفة المكون
  calculateIngredientCost() {
    const select = document.getElementById('ingredientSelect');
    const option = select.selectedOptions[0];
    
    if (!option || !option.value) return;

    const quantity = parseFloat(document.getElementById('ingredientQuantity').value) || 0;
    const cost = parseFloat(option.getAttribute('data-cost'));
    const stock = parseFloat(option.getAttribute('data-stock'));
    
    const totalCost = quantity * cost;
    const servings = Math.floor(stock / quantity);
    
    document.getElementById('previewCost').textContent = Utils.formatCurrency(totalCost);
    document.getElementById('previewServings').textContent = `${servings} قطعة`;
  },

  // حفظ مكون جديد
  async saveNewIngredient(e) {
    e.preventDefault();

    const ingredientId = document.getElementById('ingredientSelect').value;
    const quantity = parseFloat(document.getElementById('ingredientQuantity').value);

    if (!ingredientId || !quantity) {
      Utils.showNotification('يرجى ملء جميع الحقول', 'error');
      return;
    }

    // التحقق من عدم التكرار
    const exists = this.currentRecipe.some(r => r.ingredient_id == ingredientId);
    if (exists) {
      Utils.showNotification('هذا المكون موجود بالفعل في الوصفة', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('recipes')
        .insert([{
          menu_item_id: this.selectedMenuItem.id,
          ingredient_id: ingredientId,
          quantity_needed: quantity
        }]);

      if (error) throw error;

      Utils.showNotification('تم إضافة المكون للوصفة ✅', 'success');
      this.closeAddIngredientModal();
      
      // إعادة تحميل
      await this.loadRecipeForItem(this.selectedMenuItem.id);
      this.displayRecipe();
      this.calculateCosts();
      this.updateKitchenPreview();
      this.updateDashboardStats();

    } catch (error) {
      console.error('Error saving ingredient:', error);
      Utils.showNotification('حدث خطأ أثناء الحفظ', 'error');
    }
  },

  // فتح modal تعديل
  openEditIngredientModal(recipeId) {
    const recipe = this.currentRecipe.find(r => r.id === recipeId);
    if (!recipe) return;

    document.getElementById('editRecipeId').value = recipe.id;
    document.getElementById('editIngredientName').value = recipe.ingredient.name;
    document.getElementById('editIngredientQuantity').value = recipe.quantity_needed;
    document.getElementById('editQuantityUnit').textContent = recipe.ingredient.unit;

    document.getElementById('editIngredientModal').classList.add('active');
  },

  closeEditIngredientModal() {
    document.getElementById('editIngredientModal').classList.remove('active');
  },

  // حفظ التعديل
  async saveEditIngredient(e) {
    e.preventDefault();

    const recipeId = document.getElementById('editRecipeId').value;
    const quantity = parseFloat(document.getElementById('editIngredientQuantity').value);

    try {
      const { error } = await supabase
        .from('recipes')
        .update({ quantity_needed: quantity })
        .eq('id', recipeId);

      if (error) throw error;

      Utils.showNotification('تم تحديث المكون ✅', 'success');
      this.closeEditIngredientModal();
      
      await this.loadRecipeForItem(this.selectedMenuItem.id);
      this.displayRecipe();
      this.calculateCosts();
      this.updateKitchenPreview();

    } catch (error) {
      console.error('Error updating ingredient:', error);
      Utils.showNotification('حدث خطأ أثناء التحديث', 'error');
    }
  },

  // حذف مكون
  async deleteIngredient(recipeId) {
    if (!confirm('هل أنت متأكد من حذف هذا المكون من الوصفة؟')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;

      Utils.showNotification('تم حذف المكون من الوصفة', 'success');
      
      await this.loadRecipeForItem(this.selectedMenuItem.id);
      this.displayRecipe();
      this.calculateCosts();
      this.updateKitchenPreview();
      this.updateDashboardStats();

    } catch (error) {
      console.error('Error deleting ingredient:', error);
      Utils.showNotification('حدث خطأ أثناء الحذف', 'error');
    }
  },

  // مسح Recipe كامل
  async clearAllRecipe() {
    if (!this.selectedMenuItem) return;
    
    if (!confirm(`هل أنت متأكد من حذف جميع مكونات وصفة "${this.selectedMenuItem.name_ar}"؟`)) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('menu_item_id', this.selectedMenuItem.id);

      if (error) throw error;

      Utils.showNotification('تم مسح الوصفة بالكامل', 'success');
      
      this.currentRecipe = [];
      this.displayRecipe();
      this.calculateCosts();
      this.updateDashboardStats();

    } catch (error) {
      console.error('Error clearing recipe:', error);
      Utils.showNotification('حدث خطأ', 'error');
    }
  },

  // معاينة المطبخ
  updateKitchenPreview() {
    const preview = document.getElementById('kitchenPreview');
    
    if (this.currentRecipe.length === 0) {
      preview.innerHTML = '<p style="color: #999;">لا توجد مكونات لعرضها</p>';
      return;
    }

    preview.innerHTML = `
      <div style="background: white; padding: 15px; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0;">${this.selectedMenuItem.name_ar}</h4>
        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
          <strong style="font-size: 13px; color: #495057;">المكونات المطلوبة:</strong>
          ${this.currentRecipe.map(recipe => {
            const ingredient = recipe.ingredient;
            const isLow = ingredient.current_stock < (recipe.quantity_needed * 5);
            
            return `
              <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 8px; background: white; border-radius: 4px; border-right: 3px solid ${isLow ? '#dc3545' : '#28a745'};">
                <span style="font-size: 13px;">${ingredient.name}</span>
                <span style="font-weight: 600; font-size: 13px;">${recipe.quantity_needed.toFixed(2)} ${ingredient.unit}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // عرض panel المخزون
  displayInventoryPanel() {
    const list = document.getElementById('inventoryList');
    
    // تصنيف المكونات
    const available = this.allIngredients.filter(i => i.current_stock > i.min_stock);
    const low = this.allIngredients.filter(i => i.current_stock <= i.min_stock && i.current_stock > 0);
    const critical = this.allIngredients.filter(i => i.current_stock <= 0);

    document.getElementById('quickStatsAvailable').textContent = available.length;
    document.getElementById('quickStatsLow').textContent = low.length;
    document.getElementById('quickStatsCritical').textContent = critical.length;

    // عرض القائمة
    const allItems = [...critical, ...low, ...available.slice(0, 10)];
    
    list.innerHTML = allItems.map(ing => {
      let status = 'normal';
      if (ing.current_stock <= 0) status = 'critical';
      else if (ing.current_stock <= ing.min_stock) status = 'low';
      
      return `
        <div class="inventory-item ${status}">
          <div class="inventory-item-name">${ing.name}</div>
          <div class="inventory-item-stock">
            ${ing.current_stock.toFixed(2)} ${ing.unit}
            ${status === 'critical' ? ' 🔴' : status === 'low' ? ' ⚠️' : ' ✅'}
          </div>
        </div>
      `;
    }).join('');
  },

  // تحديث إحصائيات Dashboard
  async updateDashboardStats() {
    // أصناف لها recipes
    const itemsWithRecipes = [...new Set(this.allRecipes.map(r => r.menu_item_id))].length;
    document.getElementById('statsRecipedItems').textContent = itemsWithRecipes;
    document.getElementById('statsTotalItems').textContent = this.allMenuItems.length;

    // recipes كاملة (لها 3 مكونات على الأقل)
    const completeRecipes = this.allMenuItems.filter(item => {
      const recipeCount = this.allRecipes.filter(r => r.menu_item_id === item.id).length;
      return recipeCount >= 3;
    }).length;
    document.getElementById('statsCompleteRecipes').textContent = completeRecipes;

    // مكونات منخفضة
    const lowStock = this.allIngredients.filter(i => i.current_stock <= i.min_stock).length;
    document.getElementById('statsLowStock').textContent = lowStock;

    // إجمالي المكونات
    document.getElementById('statsTotalIngredients').textContent = this.allIngredients.length;
  },

  // تصدير Recipe الحالية
  exportCurrentRecipe() {
    if (!this.selectedMenuItem || this.currentRecipe.length === 0) {
      Utils.showNotification('لا توجد وصفة لتصديرها', 'warning');
      return;
    }

    const data = this.currentRecipe.map(recipe => ({
      'الصنف': this.selectedMenuItem.name_ar,
      'المكون': recipe.ingredient.name,
      'الكمية المطلوبة': recipe.quantity_needed,
      'الوحدة': recipe.ingredient.unit,
      'التكلفة': (recipe.quantity_needed * recipe.ingredient.cost_per_unit).toFixed(2),
      'المخزون الحالي': recipe.ingredient.current_stock
    }));

    Utils.exportToExcel(data, `Recipe_${this.selectedMenuItem.name_ar}`);
    Utils.showNotification('تم تصدير الوصفة بنجاح', 'success');
  },

  // تحديث المخزون
  async refreshInventory() {
    await this.loadIngredients();
    this.displayInventoryPanel();
    Utils.showNotification('تم تحديث المخزون', 'success');
  },

  // مستمعي الأحداث
  setupEventListeners() {
    // إضافة مكون
    document.getElementById('addIngredientForm').addEventListener('submit', (e) => {
      this.saveNewIngredient(e);
    });

    document.getElementById('ingredientQuantity').addEventListener('input', () => {
      this.calculateIngredientCost();
    });

    // تعديل مكون
    document.getElementById('editIngredientForm').addEventListener('submit', (e) => {
      this.saveEditIngredient(e);
    });
  },

  // Realtime subscriptions
  setupRealtimeSubscriptions() {
    // تحديثات الوصفات
    Realtime.subscribeToTable('recipes', () => {
      this.loadAllRecipes().then(() => {
        if (this.selectedMenuItem) {
          this.loadRecipeForItem(this.selectedMenuItem.id);
          this.displayRecipe();
          this.calculateCosts();
        }
        this.displayMenuItems();
        this.updateDashboardStats();
      });
    });

    // تحديثات المخزون
    Realtime.subscribeToInventory(() => {
      this.loadIngredients().then(() => {
        this.displayInventoryPanel();
        if (this.selectedMenuItem) {
          this.displayRecipe();
        }
      });
    });

    // تحديثات المنيو
    Realtime.subscribeToTable('menu_items', () => {
      this.loadMenuItems();
    });
  }
};

// Auto-Protection
if (typeof protectAsync !== 'undefined') {
  if (RecipeManager.saveNewIngredient) {
    const original = RecipeManager.saveNewIngredient.bind(RecipeManager);
    RecipeManager.saveNewIngredient = protectAsync(original, 'save-ingredient', true);
  }

  if (RecipeManager.saveEditIngredient) {
    const original = RecipeManager.saveEditIngredient.bind(RecipeManager);
    RecipeManager.saveEditIngredient = protectAsync(original, 'edit-ingredient', true);
  }

  if (RecipeManager.deleteIngredient) {
    const original = RecipeManager.deleteIngredient.bind(RecipeManager);
    RecipeManager.deleteIngredient = protectAsync(original, 'delete-ingredient', true);
  }
}

// تهيئة
if (typeof window !== 'undefined') {
  window.RecipeManager = RecipeManager;
}

console.log('✅ Advanced Recipe Manager loaded');
