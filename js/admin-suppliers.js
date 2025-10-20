// js/admin-suppliers.js
// نظام إدارة الموردين والمدفوعات

const SupplierManager = {
    suppliers: [],
    payments: [],
    currentTab: 'list',

    async init() {
        console.log('✅ Supplier Manager Initialized');
        await this.loadSuppliers();
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('#suppliers-section .tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        document.querySelectorAll('#suppliers-section .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const tabContent = document.getElementById(`supplier-${tabName}-tab`);
        if (tabContent) {
            tabContent.style.display = 'block';
            event.target.classList.add('active');
        }
        
        if (tabName === 'payments') {
            this.loadPayments();
        }
    },

    async loadSuppliers() {
        try {
            const { data, error } = await Database.supabase
                .from('suppliers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.suppliers = data || [];
            this.renderSuppliers();
            this.populateSupplierFilters();
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    },

    renderSuppliers() {
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;

        if (this.suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px;">لا يوجد موردين</td></tr>';
            return;
        }

        const categoryAr = {
            'food': '🥘 مواد غذائية',
            'drinks': '🥤 مشروبات',
            'cleaning': '🧹 مواد تنظيف',
            'equipment': '🔧 معدات'
        };

        tbody.innerHTML = this.suppliers.map(sup => `
            <tr>
                <td><strong>${sup.name}</strong></td>
                <td>${sup.phone || '-'}</td>
                <td>${categoryAr[sup.category] || sup.category}</td>
                <td><strong>${(sup.balance || 0).toFixed(2)} ج.م</strong></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="SupplierManager.editSupplier(${sup.id})" title="تعديل">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-success" onclick="SupplierManager.showPaymentModal(${sup.id})" title="دفعة">
                        💵
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="SupplierManager.deleteSupplier(${sup.id})" title="حذف">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    },

    filterSuppliers() {
        const searchValue = document.getElementById('supplierSearch')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('supplierCategoryFilter')?.value || '';

        const filtered = this.suppliers.filter(sup => {
            const matchSearch = sup.name.toLowerCase().includes(searchValue);
            const matchCategory = !categoryFilter || sup.category === categoryFilter;
            return matchSearch && matchCategory;
        });

        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;

        const categoryAr = {
            'food': '🥘 مواد غذائية',
            'drinks': '🥤 مشروبات',
            'cleaning': '🧹 مواد تنظيف',
            'equipment': '🔧 معدات'
        };

        tbody.innerHTML = filtered.map(sup => `
            <tr>
                <td><strong>${sup.name}</strong></td>
                <td>${sup.phone || '-'}</td>
                <td>${categoryAr[sup.category] || sup.category}</td>
                <td><strong>${(sup.balance || 0).toFixed(2)} ج.م</strong></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="SupplierManager.editSupplier(${sup.id})">✏️</button>
                    <button class="btn btn-sm btn-success" onclick="SupplierManager.showPaymentModal(${sup.id})">💵</button>
                    <button class="btn btn-sm btn-danger" onclick="SupplierManager.deleteSupplier(${sup.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    showAddModal() {
        document.getElementById('supplierModalTitle').textContent = 'إضافة مورد جديد';
        document.getElementById('supplierForm').reset();
        document.getElementById('supplierId').value = '';
        document.getElementById('supplierModal').style.display = 'block';
    },

    editSupplier(id) {
        const supplier = this.suppliers.find(s => s.id === id);
        if (!supplier) return;

        document.getElementById('supplierModalTitle').textContent = 'تعديل بيانات المورد';
        document.getElementById('supplierId').value = supplier.id;
        document.getElementById('supplierName').value = supplier.name;
        document.getElementById('supplierPhone').value = supplier.phone || '';
        document.getElementById('supplierEmail').value = supplier.email || '';
        document.getElementById('supplierCategory').value = supplier.category || 'food';
        document.getElementById('supplierAddress').value = supplier.address || '';
        document.getElementById('supplierNotes').value = supplier.notes || '';
        document.getElementById('supplierModal').style.display = 'block';
    },

    async saveSupplier(event) {
        event.preventDefault();

        const supplierData = {
            name: document.getElementById('supplierName').value,
            phone: document.getElementById('supplierPhone').value || null,
            email: document.getElementById('supplierEmail').value || null,
            category: document.getElementById('supplierCategory').value,
            address: document.getElementById('supplierAddress').value || null,
            notes: document.getElementById('supplierNotes').value || null
        };

        const supplierId = document.getElementById('supplierId').value;

        try {
            if (supplierId) {
                const { error } = await Database.supabase
                    .from('suppliers')
                    .update(supplierData)
                    .eq('id', supplierId);

                if (error) throw error;
                alert('✅ تم تحديث بيانات المورد بنجاح');
            } else {
                const { error } = await Database.supabase
                    .from('suppliers')
                    .insert([supplierData]);

                if (error) throw error;
                alert('✅ تم إضافة المورد بنجاح');
            }

            this.closeModal();
            await this.loadSuppliers();
        } catch (error) {
            console.error('Error saving supplier:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    async deleteSupplier(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;

        try {
            const { error } = await Database.supabase
                .from('suppliers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            alert('✅ تم حذف المورد بنجاح');
            await this.loadSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('❌ حدث خطأ في الحذف');
        }
    },

    closeModal() {
        document.getElementById('supplierModal').style.display = 'none';
    },

    // المدفوعات

    async loadPayments() {
        try {
            const { data, error } = await Database.supabase
                .from('supplier_payments')
                .select(`
                    *,
                    supplier:suppliers(name)
                `)
                .order('payment_date', { ascending: false })
                .limit(50);

            if (error) throw error;

            this.payments = data || [];
            this.renderPayments();
        } catch (error) {
            console.error('Error loading payments:', error);
        }
    },

    renderPayments() {
        const tbody = document.getElementById('supplierPaymentsTableBody');
        if (!tbody) return;

        if (this.payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">لا يوجد مدفوعات</td></tr>';
            return;
        }

        const methodAr = {
            'cash': '💵 نقدي',
            'card': '💳 بطاقة',
            'bank_transfer': '🏦 تحويل بنكي',
            'check': '📝 شيك'
        };

        tbody.innerHTML = this.payments.map(pay => `
            <tr>
                <td><strong>${pay.supplier?.name || '-'}</strong></td>
                <td>${new Date(pay.payment_date).toLocaleDateString('ar-EG')}</td>
                <td><strong>${pay.amount.toFixed(2)} ج.م</strong></td>
                <td>${methodAr[pay.payment_method] || pay.payment_method}</td>
                <td>${pay.invoice_number || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="SupplierManager.printPaymentReceipt(${pay.id})" title="طباعة">
                        🖨️
                    </button>
                </td>
            </tr>
        `).join('');
    },

    populateSupplierFilters() {
        const selects = ['paymentSupplierFilter', 'paymentSupplierId'];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">اختر المورد</option>' + 
                this.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            
            if (currentValue) select.value = currentValue;
        });
    },

    showPaymentModal(supplierId = null) {
        document.getElementById('supplierPaymentForm').reset();
        document.getElementById('paymentDate').valueAsDate = new Date();
        this.populateSupplierFilters();
        
        if (supplierId) {
            document.getElementById('paymentSupplierId').value = supplierId;
        }
        
        document.getElementById('supplierPaymentModal').style.display = 'block';
    },

    async savePayment(event) {
        event.preventDefault();

        const paymentData = {
            supplier_id: parseInt(document.getElementById('paymentSupplierId').value),
            payment_date: document.getElementById('paymentDate').value,
            amount: parseFloat(document.getElementById('paymentAmount').value),
            payment_method: document.getElementById('paymentMethod').value,
            invoice_number: document.getElementById('paymentInvoiceNumber').value || null,
            notes: document.getElementById('paymentNotes').value || null,
            paid_by: Auth.currentUser?.id || null
        };

        try {
            const { data, error } = await Database.supabase
                .from('supplier_payments')
                .insert([paymentData])
                .select()
                .single();

            if (error) throw error;

            alert('✅ تم إضافة الدفعة بنجاح');
            this.closePaymentModal();
            await this.loadPayments();
            await this.loadSuppliers();

            if (confirm('هل تريد طباعة إيصال؟')) {
                this.printPaymentReceipt(data.id);
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    async printPaymentReceipt(paymentId) {
        try {
            const { data, error } = await Database.supabase
                .from('supplier_payments')
                .select(`
                    *,
                    supplier:suppliers(name)
                `)
                .eq('id', paymentId)
                .single();

            if (error) throw error;

            ThermalPrinter.printSupplierPayment({
                id: data.id,
                supplier_name: data.supplier.name,
                amount: data.amount,
                payment_method: data.payment_method,
                invoice_number: data.invoice_number,
                notes: data.notes
            });
        } catch (error) {
            console.error('Error printing receipt:', error);
            alert('❌ حدث خطأ في الطباعة');
        }
    },

    closePaymentModal() {
        document.getElementById('supplierPaymentModal').style.display = 'none';
    }
};

window.SupplierManager = SupplierManager;
console.log('✅ Supplier Manager Loaded');
