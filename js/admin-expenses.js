// js/admin-expenses.js
// نظام إدارة المصروفات والفواتير

const ExpenseManager = {
    expenses: [],
    bills: [],
    currentTab: 'general',

    async init() {
        console.log('✅ Expense Manager Initialized');
        await this.loadExpenses();
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('#expenses-section .tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        document.querySelectorAll('#expenses-section .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const tabContent = document.getElementById(`expense-${tabName}-tab`);
        if (tabContent) {
            tabContent.style.display = 'block';
            event.target.classList.add('active');
        }
        
        if (tabName === 'bills') {
            this.loadBills();
        }
    },

    async loadExpenses() {
        try {
            const { data, error } = await Database.supabase
                .from('general_expenses')
                .select('*')
                .order('expense_date', { ascending: false })
                .limit(100);

            if (error) throw error;

            this.expenses = data || [];
            this.renderExpenses();
            await this.calculateExpenseStats();
        } catch (error) {
            console.error('Error loading expenses:', error);
        }
    },

    renderExpenses() {
        const tbody = document.getElementById('expensesTableBody');
        if (!tbody) return;

        if (this.expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">لا يوجد مصروفات</td></tr>';
            return;
        }

        const categoryAr = {
            'rent': '🏠 إيجار',
            'utilities': '💡 مرافق',
            'maintenance': '🔧 صيانة',
            'marketing': '📢 تسويق',
            'other': '📦 أخرى'
        };

        tbody.innerHTML = this.expenses.map(exp => `
            <tr>
                <td>${new Date(exp.expense_date).toLocaleDateString('ar-EG')}</td>
                <td>${categoryAr[exp.category] || exp.category}</td>
                <td>${exp.description}</td>
                <td><strong>${exp.amount.toFixed(2)} ج.م</strong></td>
                <td>${exp.paid_to || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="ExpenseManager.printExpenseReceipt(${exp.id})" title="طباعة">
                        🖨️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="ExpenseManager.deleteExpense(${exp.id})" title="حذف">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async calculateExpenseStats() {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const monthExpenses = this.expenses.filter(e => 
            new Date(e.expense_date) >= firstDayOfMonth
        );

        const total = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

        const totalEl = document.getElementById('totalExpensesMonth');
        if (totalEl) totalEl.textContent = total.toFixed(2) + ' ج.م';
    },

    filterExpenses() {
        const categoryFilter = document.getElementById('expenseCategoryFilter')?.value || '';
        const dateFrom = document.getElementById('expenseDateFrom')?.value;
        const dateTo = document.getElementById('expenseDateTo')?.value;

        let filtered = this.expenses.filter(exp => {
            const matchCategory = !categoryFilter || exp.category === categoryFilter;
            let matchDate = true;

            if (dateFrom) {
                matchDate = matchDate && new Date(exp.expense_date) >= new Date(dateFrom);
            }
            if (dateTo) {
                matchDate = matchDate && new Date(exp.expense_date) <= new Date(dateTo);
            }

            return matchCategory && matchDate;
        });

        const tbody = document.getElementById('expensesTableBody');
        if (!tbody) return;

        const categoryAr = {
            'rent': '🏠 إيجار',
            'utilities': '💡 مرافق',
            'maintenance': '🔧 صيانة',
            'marketing': '📢 تسويق',
            'other': '📦 أخرى'
        };

        tbody.innerHTML = filtered.map(exp => `
            <tr>
                <td>${new Date(exp.expense_date).toLocaleDateString('ar-EG')}</td>
                <td>${categoryAr[exp.category] || exp.category}</td>
                <td>${exp.description}</td>
                <td><strong>${exp.amount.toFixed(2)} ج.م</strong></td>
                <td>${exp.paid_to || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="ExpenseManager.printExpenseReceipt(${exp.id})">🖨️</button>
                    <button class="btn btn-sm btn-danger" onclick="ExpenseManager.deleteExpense(${exp.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    showAddExpenseModal() {
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').valueAsDate = new Date();
        document.getElementById('expenseModal').style.display = 'block';
    },

    async saveExpense(event) {
        event.preventDefault();

        const expenseData = {
            expense_date: document.getElementById('expenseDate').value,
            category: document.getElementById('expenseCategory').value,
            description: document.getElementById('expenseDescription').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            payment_method: document.getElementById('expensePaymentMethod').value,
            receipt_number: document.getElementById('expenseReceiptNumber').value || null,
            paid_to: document.getElementById('expensePaidTo').value || null,
            notes: document.getElementById('expenseNotes').value || null,
            approved_by: Auth.currentUser?.id || null
        };

        try {
            const { data, error } = await Database.supabase
                .from('general_expenses')
                .insert([expenseData])
                .select()
                .single();

            if (error) throw error;

            alert('✅ تم إضافة المصروف بنجاح');
            this.closeExpenseModal();
            await this.loadExpenses();

            if (confirm('هل تريد طباعة إيصال؟')) {
                this.printExpenseReceipt(data.id);
            }
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    async deleteExpense(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

        try {
            const { error } = await Database.supabase
                .from('general_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;

            alert('✅ تم حذف المصروف بنجاح');
            await this.loadExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('❌ حدث خطأ في الحذف');
        }
    },

    async printExpenseReceipt(expenseId) {
        try {
            const { data, error } = await Database.supabase
                .from('general_expenses')
                .select('*')
                .eq('id', expenseId)
                .single();

            if (error) throw error;

            ThermalPrinter.printGeneralExpense(data);
        } catch (error) {
            console.error('Error printing receipt:', error);
            alert('❌ حدث خطأ في الطباعة');
        }
    },

    closeExpenseModal() {
        document.getElementById('expenseModal').style.display = 'none';
    },

    // الفواتير

    async loadBills() {
        try {
            const { data, error } = await Database.supabase
                .from('utility_bills')
                .select('*')
                .order('bill_date', { ascending: false })
                .limit(50);

            if (error) throw error;

            this.bills = data || [];
            this.renderBills();
        } catch (error) {
            console.error('Error loading bills:', error);
        }
    },

    renderBills() {
        const tbody = document.getElementById('billsTableBody');
        if (!tbody) return;

        if (this.bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">لا يوجد فواتير</td></tr>';
            return;
        }

        const typeAr = {
            'electricity': '⚡ كهرباء',
            'water': '💧 مياه',
            'gas': '🔥 غاز',
            'internet': '🌐 إنترنت',
            'phone': '📞 تليفون'
        };

        tbody.innerHTML = this.bills.map(bill => `
            <tr>
                <td>${typeAr[bill.bill_type] || bill.bill_type}</td>
                <td>${bill.bill_month}</td>
                <td><strong>${bill.amount.toFixed(2)} ج.م</strong></td>
                <td>${bill.consumption || '-'}</td>
                <td>
                    <span class="badge ${bill.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">
                        ${bill.payment_status === 'paid' ? '✅ مدفوع' : '⏳ معلق'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="ExpenseManager.printBillReceipt(${bill.id})" title="طباعة">
                        🖨️
                    </button>
                    ${bill.payment_status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="ExpenseManager.markBillAsPaid(${bill.id})" title="تعليم كمدفوع">
                        ✅
                    </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },

    filterBills() {
        const typeFilter = document.getElementById('billTypeFilter')?.value || '';
        const statusFilter = document.getElementById('billStatusFilter')?.value || '';

        const filtered = this.bills.filter(bill => {
            const matchType = !typeFilter || bill.bill_type === typeFilter;
            const matchStatus = !statusFilter || bill.payment_status === statusFilter;
            return matchType && matchStatus;
        });

        const tbody = document.getElementById('billsTableBody');
        if (!tbody) return;

        const typeAr = {
            'electricity': '⚡ كهرباء',
            'water': '💧 مياه',
            'gas': '🔥 غاز',
            'internet': '🌐 إنترنت',
            'phone': '📞 تليفون'
        };

        tbody.innerHTML = filtered.map(bill => `
            <tr>
                <td>${typeAr[bill.bill_type] || bill.bill_type}</td>
                <td>${bill.bill_month}</td>
                <td><strong>${bill.amount.toFixed(2)} ج.م</strong></td>
                <td>${bill.consumption || '-'}</td>
                <td>
                    <span class="badge ${bill.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">
                        ${bill.payment_status === 'paid' ? '✅ مدفوع' : '⏳ معلق'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="ExpenseManager.printBillReceipt(${bill.id})">🖨️</button>
                    ${bill.payment_status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="ExpenseManager.markBillAsPaid(${bill.id})">✅</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },

    showAddBillModal() {
        document.getElementById('billForm').reset();
        document.getElementById('billDate').valueAsDate = new Date();
        
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('billMonth').value = yearMonth;
        
        document.getElementById('billModal').style.display = 'block';
    },

    calculateConsumption() {
        const previous = parseFloat(document.getElementById('billPreviousReading')?.value) || 0;
        const current = parseFloat(document.getElementById('billCurrentReading')?.value) || 0;
        const consumption = current - previous;
        
        const consumptionInput = document.getElementById('billConsumption');
        if (consumptionInput && consumption >= 0) {
            consumptionInput.value = consumption.toFixed(2);
        }
    },

    togglePaymentDate() {
        const status = document.getElementById('billPaymentStatus')?.value;
        const dateGroup = document.getElementById('billPaymentDateGroup');
        
        if (dateGroup) {
            dateGroup.style.display = status === 'paid' ? 'block' : 'none';
            
            if (status === 'paid' && !document.getElementById('billPaymentDate').value) {
                document.getElementById('billPaymentDate').valueAsDate = new Date();
            }
        }
    },

    async saveBill(event) {
        event.preventDefault();

        const billData = {
            bill_type: document.getElementById('billType').value,
            bill_month: document.getElementById('billMonth').value,
            bill_date: document.getElementById('billDate').value,
            previous_reading: parseFloat(document.getElementById('billPreviousReading').value) || null,
            current_reading: parseFloat(document.getElementById('billCurrentReading').value) || null,
            consumption: parseFloat(document.getElementById('billConsumption').value) || null,
            amount: parseFloat(document.getElementById('billAmount').value),
            invoice_number: document.getElementById('billInvoiceNumber').value || null,
            payment_status: document.getElementById('billPaymentStatus').value,
            payment_date: document.getElementById('billPaymentDate').value || null,
            notes: document.getElementById('billNotes').value || null
        };

        try {
            const { data, error } = await Database.supabase
                .from('utility_bills')
                .insert([billData])
                .select()
                .single();

            if (error) throw error;

            alert('✅ تم إضافة الفاتورة بنجاح');
            this.closeBillModal();
            await this.loadBills();

            if (confirm('هل تريد طباعة الفاتورة؟')) {
                this.printBillReceipt(data.id);
            }
        } catch (error) {
            console.error('Error saving bill:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    async markBillAsPaid(billId) {
        if (!confirm('هل تريد تعليم هذه الفاتورة كمدفوعة؟')) return;

        try {
            const { error } = await Database.supabase
                .from('utility_bills')
                .update({
                    payment_status: 'paid',
                    payment_date: new Date().toISOString().split('T')[0]
                })
                .eq('id', billId);

            if (error) throw error;

            alert('✅ تم تحديث حالة الفاتورة');
            await this.loadBills();
        } catch (error) {
            console.error('Error updating bill:', error);
            alert('❌ حدث خطأ');
        }
    },

    async printBillReceipt(billId) {
        try {
            const { data, error } = await Database.supabase
                .from('utility_bills')
                .select('*')
                .eq('id', billId)
                .single();

            if (error) throw error;

            ThermalPrinter.printUtilityBill(data);
        } catch (error) {
            console.error('Error printing bill:', error);
            alert('❌ حدث خطأ في الطباعة');
        }
    },

    closeBillModal() {
        document.getElementById('billModal').style.display = 'none';
    }
};

window.ExpenseManager = ExpenseManager;
console.log('✅ Expense Manager Loaded');
