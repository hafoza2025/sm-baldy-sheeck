// js/accounting.js
// نظام المحاسبة الكامل مع Excel الذكي

const AccountingSystem = {
    currentUser: null,
    employees: [],
    attendance: [],
    payroll: [],
    suppliers: [],
    invoices: [],
    expenses: [],
    contracts: [],
    salesData: [],
    currentFilter: {
        period: 'week',
        startDate: null,
        endDate: null
    },

    // ========================================
    // التهيئة
    // ========================================
    async init() {
        this.currentUser = Auth.checkAuth(['admin', 'owner']);
        if (!this.currentUser) return;

        document.getElementById('userName').textContent = this.currentUser.username;

        await this.loadAllData();
        this.setupEventListeners();
        this.updateDashboard();
    },

    async loadAllData() {
        try {
            Loading.show('جاري تحميل البيانات...', '');

            await Promise.all([
                this.loadEmployees(),
                this.loadAttendance(),
                this.loadPayroll(),
                this.loadSuppliers(),
                this.loadInvoices(),
                this.loadExpenses(),
                this.loadContracts(),
                this.loadSalesData()
            ]);

            Loading.hide();
        } catch (error) {
            console.error('Error loading data:', error);
            Loading.error('حدث خطأ في تحميل البيانات');
        }
    },

    // ========================================
    // تحميل البيانات
    // ========================================
    async loadEmployees() {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        this.employees = data || [];
        this.displayEmployees();
    },

    async loadAttendance() {
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                employee:employee_id(full_name, photo_url)
            `)
            .order('date', { ascending: false })
            .limit(100);

        if (error) throw error;
        this.attendance = data || [];
        this.displayAttendance();
    },

    async loadPayroll() {
        const { data, error } = await supabase
            .from('payroll')
            .select(`
                *,
                employee:employee_id(full_name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        this.payroll = data || [];
        this.displayPayroll();
    },

    async loadSuppliers() {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        this.suppliers = data || [];
        this.displaySuppliers();
    },

    async loadInvoices() {
        const { data, error } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                supplier:supplier_id(name)
            `)
            .order('invoice_date', { ascending: false });

        if (error) throw error;
        this.invoices = data || [];
        this.displayInvoices();
    },

    async loadExpenses() {
        const { data, error } = await supabase
            .from('general_expenses')
            .select(`
                *,
                supplier:supplier_id(name)
            `)
            .order('expense_date', { ascending: false });

        if (error) throw error;
        this.expenses = data || [];
        this.displayExpenses();
    },

    async loadContracts() {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .order('contract_date', { ascending: false });

        if (error) throw error;
        this.contracts = data || [];
        this.displayContracts();
    },

    async loadSalesData() {
        // جلب بيانات المبيعات من جدول orders
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id,
                total_amount,
                created_at,
                status
            `)
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

        if (error) throw error;
        this.salesData = data || [];
    },

    // ========================================
    // عرض البيانات
    // ========================================
    displayEmployees() {
        const tbody = document.querySelector('#employeesTable tbody');
        tbody.innerHTML = '';

        this.employees.forEach(emp => {
            const row = `
                <tr>
                    <td>
                        <img src="${emp.photo_url || 'assets/default-user.png'}" 
                             alt="${emp.full_name}" 
                             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    </td>
                    <td>${emp.full_name}</td>
                    <td>${emp.position || '-'}</td>
                    <td>${emp.department || '-'}</td>
                    <td>${emp.daily_salary} ج.م</td>
                    <td>${emp.monthly_salary || '-'} ج.م</td>
                    <td>
                        <span class="status-badge ${emp.status}">${this.getStatusText(emp.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.editEmployee(${emp.id})">تعديل</button>
                        <button class="btn btn-sm btn-danger" onclick="AccountingSystem.deleteEmployee(${emp.id})">حذف</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    displayAttendance() {
        const tbody = document.querySelector('#attendanceTable tbody');
        tbody.innerHTML = '';

        this.attendance.forEach(att => {
            const row = `
                <tr>
                    <td>${this.formatDate(att.date)}</td>
                    <td>${att.employee?.full_name || '-'}</td>
                    <td>${att.check_in_time || '-'}</td>
                    <td>${att.check_out_time || '-'}</td>
                    <td>
                        <span class="status-badge ${att.status}">${this.getAttendanceStatusText(att.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.editAttendance(${att.id})">تعديل</button>
                        <button class="btn btn-sm btn-danger" onclick="AccountingSystem.deleteAttendance(${att.id})">حذف</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    displayPayroll() {
        const tbody = document.querySelector('#payrollTable tbody');
        tbody.innerHTML = '';

        this.payroll.forEach(pay => {
            const row = `
                <tr>
                    <td>${pay.month}/${pay.year}</td>
                    <td>${pay.employee?.full_name || '-'}</td>
                    <td>${pay.days_worked}</td>
                    <td>${pay.base_salary} ج.م</td>
                    <td>${pay.deductions} ج.م</td>
                    <td>${pay.bonuses} ج.م</td>
                    <td><strong>${pay.net_salary} ج.م</strong></td>
                    <td>
                        <span class="status-badge ${pay.status}">${this.getStatusText(pay.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="AccountingSystem.approvePayroll(${pay.id})">اعتماد</button>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.printPayslip(${pay.id})">طباعة</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    displaySuppliers() {
        const tbody = document.querySelector('#suppliersTable tbody');
        tbody.innerHTML = '';

        this.suppliers.forEach(sup => {
            const row = `
                <tr>
                    <td>${sup.name}</td>
                    <td>${sup.company_name || '-'}</td>
                    <td>${sup.category || '-'}</td>
                    <td>${sup.phone || '-'}</td>
                    <td>${sup.current_balance} ج.م</td>
                    <td>
                        <span class="status-badge ${sup.status}">${this.getStatusText(sup.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.editSupplier(${sup.id})">تعديل</button>
                        <button class="btn btn-sm btn-danger" onclick="AccountingSystem.deleteSupplier(${sup.id})">حذف</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    displayInvoices() {
        const tbody = document.querySelector('#invoicesTable tbody');
        tbody.innerHTML = '';

        this.invoices.forEach(inv => {
            const row = `
                <tr>
                    <td>${inv.invoice_number}</td>
                    <td>${inv.supplier?.name || '-'}</td>
                    <td>${this.formatDate(inv.invoice_date)}</td>
                    <td>${inv.total_amount} ج.م</td>
                    <td>${inv.paid_amount} ج.م</td>
                    <td>${inv.remaining_amount} ج.م</td>
                    <td>
                        <span class="status-badge ${inv.status}">${this.getStatusText(inv.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="AccountingSystem.payInvoice(${inv.id})">دفع</button>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.viewInvoice(${inv.id})">عرض</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    displayExpenses() {
        const tbody = document.querySelector('#expensesTable tbody');
        tbody.innerHTML = '';

        this.expenses.forEach(exp => {
            const row = `
                <tr>
                    <td>${this.formatDate(exp.expense_date)}</td>
                    <td>${this.getExpenseTypeText(exp.expense_type)}</td>
                    <td>${exp.description || '-'}</td>
                    <td>${exp.amount} ج.م</td>
                    <td>${exp.payment_method || '-'}</td>
                    <td>
                        <span class="status-badge ${exp.status}">${this.getStatusText(exp.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="AccountingSystem.approveExpense(${exp.id})">اعتماد</button>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.editExpense(${exp.id})">تعديل</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    displayContracts() {
        const tbody = document.querySelector('#contractsTable tbody');
        tbody.innerHTML = '';

        this.contracts.forEach(con => {
            const row = `
                <tr>
                    <td>${con.contract_number}</td>
                    <td>${this.getContractTypeText(con.contract_type)}</td>
                    <td>${con.contract_title}</td>
                    <td>${con.party_name || '-'}</td>
                    <td>${con.amount || '-'} ج.م</td>
                    <td>
                        <span class="status-badge ${con.status}">${this.getStatusText(con.status)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="AccountingSystem.viewContract(${con.id})">عرض</button>
                        <button class="btn btn-sm btn-success" onclick="AccountingSystem.signContract(${con.id})">توقيع</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    },

    // ========================================
    // لوحة التحكم والإحصائيات
    // ========================================
    async updateDashboard() {
        const { startDate, endDate } = this.getFilterDates();

        // حساب المبيعات
        const filteredSales = this.salesData.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= startDate && saleDate <= endDate;
        });
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);

        // حساب المصروفات
        const filteredExpenses = this.expenses.filter(exp => {
            const expDate = new Date(exp.expense_date);
            return expDate >= startDate && expDate <= endDate && exp.status !== 'rejected';
        });
        const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        // حساب تكلفة الموظفين
        const filteredPayroll = this.payroll.filter(pay => {
            const payDate = new Date(pay.created_at);
            return payDate >= startDate && payDate <= endDate && pay.status === 'paid';
        });
        const employeesCost = filteredPayroll.reduce((sum, pay) => sum + parseFloat(pay.net_salary), 0);

        // حساب صافي الربح
        const netProfit = totalRevenue - totalExpenses - employeesCost;

        // عرض البيانات
        document.getElementById('totalRevenue').textContent = this.formatCurrency(totalRevenue);
        document.getElementById('totalExpenses').textContent = this.formatCurrency(totalExpenses + employeesCost);
        document.getElementById('netProfit').textContent = this.formatCurrency(netProfit);
        document.getElementById('employeesCost').textContent = this.formatCurrency(employeesCost);

        // تفصيل المصروفات
        this.displayExpensesBreakdown(filteredExpenses);
        
        // أعلى الموردين
        this.displayTopSuppliers();
    },

    displayExpensesBreakdown(expenses) {
        const breakdown = {};
        expenses.forEach(exp => {
            const type = exp.expense_type;
            if (!breakdown[type]) {
                breakdown[type] = 0;
            }
            breakdown[type] += parseFloat(exp.amount);
        });

        const container = document.getElementById('expensesBreakdown');
        container.innerHTML = '';

        Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([type, amount]) => {
                container.innerHTML += `
                    <div class="breakdown-item">
                        <span class="breakdown-item-name">${this.getExpenseTypeText(type)}</span>
                        <span class="breakdown-item-value">${this.formatCurrency(amount)}</span>
                    </div>
                `;
            });
    },

    displayTopSuppliers() {
        const supplierTotals = {};
        
        this.invoices.forEach(inv => {
            const supplierId = inv.supplier_id;
            if (!supplierTotals[supplierId]) {
                supplierTotals[supplierId] = {
                    name: inv.supplier?.name || 'غير معروف',
                    total: 0
                };
            }
            supplierTotals[supplierId].total += parseFloat(inv.total_amount);
        });

        const container = document.getElementById('topSuppliers');
        container.innerHTML = '';

        Object.values(supplierTotals)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .forEach(supplier => {
                container.innerHTML += `
                    <div class="breakdown-item">
                        <span class="breakdown-item-name">${supplier.name}</span>
                        <span class="breakdown-item-value">${this.formatCurrency(supplier.total)}</span>
                    </div>
                `;
            });
    },

    // ========================================
    // الفلترة حسب الفترة
    // ========================================
    applyFilter() {
        const period = document.getElementById('periodFilter').value;
        this.currentFilter.period = period;

        if (period === 'custom') {
            document.getElementById('customDateGroup').style.display = 'flex';
            this.currentFilter.startDate = document.getElementById('startDate').value;
            this.currentFilter.endDate = document.getElementById('endDate').value;
        } else {
            document.getElementById('customDateGroup').style.display = 'none';
        }

        this.updateDashboard();
    },

    getFilterDates() {
        const now = new Date();
        let startDate, endDate = now;

        switch (this.currentFilter.period) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'custom':
                startDate = new Date(this.currentFilter.startDate);
                endDate = new Date(this.currentFilter.endDate);
                break;
            default:
                startDate = new Date(now.setDate(now.getDate() - 7));
        }

        return { startDate, endDate };
    },

    // ========================================
    // Modals - سأكمل في الجزء التالي
    // ========================================
    
    showAddEmployeeModal() {
        // سيتم إكماله
    },

    // المزيد من الوظائف...
};
// ========================================
// تصدير Excel الذكي الشامل
// ========================================

async function exportAllToExcel() {
    Loading.show('جاري إنشاء التقرير الشامل...', '');

    try {
        const { startDate, endDate } = AccountingSystem.getFilterDates();
        const periodText = AccountingSystem.getPeriodText();

        // إنشاء Workbook
        const wb = XLSX.utils.book_new();

        // 1. ورقة الملخص المالي
        createFinancialSummarySheet(wb, startDate, endDate, periodText);

        // 2. ورقة المبيعات
        createSalesSheet(wb, startDate, endDate);

        // 3. ورقة المصروفات
        createExpensesSheet(wb, startDate, endDate);

        // 4. ورقة الموظفين
        createEmployeesSheet(wb);

        // 5. ورقة الحضور
        createAttendanceSheet(wb, startDate, endDate);

        // 6. ورقة الرواتب
        createPayrollSheet(wb, startDate, endDate);

        // 7. ورقة الموردين
        createSuppliersSheet(wb);

        // 8. ورقة فواتير الموردين
        createInvoicesSheet(wb, startDate, endDate);

        // 9. ورقة الأرباح والخسائر
        createProfitLossSheet(wb, startDate, endDate);

        // حفظ الملف
        const fileName = `تقرير_محاسبة_شامل_${periodText}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        Loading.success('تم تصدير التقرير بنجاح! ✅');
    } catch (error) {
        console.error('Error exporting Excel:', error);
        Loading.error('حدث خطأ في تصدير التقرير');
    }
}

// ========================================
// إنشاء ورقة الملخص المالي
// ========================================
function createFinancialSummarySheet(wb, startDate, endDate, periodText) {
    // حساب المبيعات
    const sales = AccountingSystem.salesData.filter(s => {
        const date = new Date(s.created_at);
        return date >= startDate && date <= endDate;
    });
    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
    const salesCount = sales.length;

    // حساب المصروفات
    const expenses = AccountingSystem.expenses.filter(e => {
        const date = new Date(e.expense_date);
        return date >= startDate && date <= endDate && e.status !== 'rejected';
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // حساب تكلفة الموظفين
    const payroll = AccountingSystem.payroll.filter(p => {
        const date = new Date(p.created_at);
        return date >= startDate && date <= endDate && p.status === 'paid';
    });
    const employeesCost = payroll.reduce((sum, p) => sum + parseFloat(p.net_salary), 0);

    // حساب صافي الربح
    const totalCosts = totalExpenses + employeesCost;
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    // إنشاء البيانات
    const data = [
        ['تقرير الملخص المالي الشامل'],
        ['مطعم الفرعون'],
        ['الفترة:', periodText],
        ['من:', startDate.toLocaleDateString('ar-EG')],
        ['إلى:', endDate.toLocaleDateString('ar-EG')],
        ['تاريخ الإنشاء:', new Date().toLocaleString('ar-EG')],
        [],
        ['البيان', 'القيمة', 'النسبة %'],
        [],
        ['المبيعات والإيرادات'],
        ['إجمالي المبيعات', totalRevenue, '100%'],
        ['عدد الطلبات', salesCount, ''],
        ['متوسط الطلب', salesCount > 0 ? (totalRevenue / salesCount).toFixed(2) : 0, ''],
        [],
        ['المصروفات'],
        ['المصروفات العامة', totalExpenses, ((totalExpenses / totalRevenue) * 100).toFixed(2) + '%'],
        ['تكلفة الموظفين', employeesCost, ((employeesCost / totalRevenue) * 100).toFixed(2) + '%'],
        ['إجمالي المصروفات', totalCosts, ((totalCosts / totalRevenue) * 100).toFixed(2) + '%'],
        [],
        ['صافي الربح'],
        ['صافي الربح', netProfit, profitMargin + '%'],
        [],
        ['تفصيل المصروفات حسب النوع'],
        ['النوع', 'المبلغ', 'النسبة من الإجمالي']
    ];

    // إضافة تفصيل المصروفات
    const expensesByType = {};
    expenses.forEach(e => {
        const type = e.expense_type;
        if (!expensesByType[type]) {
            expensesByType[type] = 0;
        }
        expensesByType[type] += parseFloat(e.amount);
    });

    Object.entries(expensesByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, amount]) => {
            data.push([
                AccountingSystem.getExpenseTypeText(type),
                amount,
                ((amount / totalExpenses) * 100).toFixed(2) + '%'
            ]);
        });

    // إنشاء الورقة
    const ws = XLSX.utils.aoa_to_sheet(data);

    // تنسيق العرض
    ws['!cols'] = [
        { wch: 30 },
        { wch: 20 },
        { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'الملخص المالي');
}

// ========================================
// إنشاء ورقة المبيعات
// ========================================
function createSalesSheet(wb, startDate, endDate) {
    const sales = AccountingSystem.salesData.filter(s => {
        const date = new Date(s.created_at);
        return date >= startDate && date <= endDate;
    });

    // تجميع المبيعات حسب اليوم
    const salesByDay = {};
    sales.forEach(sale => {
        const day = new Date(sale.created_at).toLocaleDateString('ar-EG');
        if (!salesByDay[day]) {
            salesByDay[day] = {
                count: 0,
                total: 0
            };
        }
        salesByDay[day].count++;
        salesByDay[day].total += parseFloat(sale.total_amount);
    });

    const data = [
        ['تقرير المبيعات اليومية'],
        [],
        ['التاريخ', 'عدد الطلبات', 'إجمالي المبيعات', 'متوسط الطلب']
    ];

    let totalOrders = 0;
    let totalAmount = 0;

    Object.entries(salesByDay)
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .forEach(([day, stats]) => {
            totalOrders += stats.count;
            totalAmount += stats.total;
            const avg = (stats.total / stats.count).toFixed(2);
            data.push([day, stats.count, stats.total, avg]);
        });

    // إضافة الإجمالي
    data.push([]);
    data.push(['الإجمالي', totalOrders, totalAmount, (totalAmount / totalOrders).toFixed(2)]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, ws, 'المبيعات');
}

// ========================================
// إنشاء ورقة المصروفات
// ========================================
function createExpensesSheet(wb, startDate, endDate) {
    const expenses = AccountingSystem.expenses.filter(e => {
        const date = new Date(e.expense_date);
        return date >= startDate && date <= endDate;
    });

    const data = [
        ['تقرير المصروفات التفصيلي'],
        [],
        ['التاريخ', 'النوع', 'الوصف', 'المبلغ', 'طريقة الدفع', 'الحالة', 'رقم الفاتورة']
    ];

    let total = 0;

    expenses.forEach(exp => {
        total += parseFloat(exp.amount);
        data.push([
            new Date(exp.expense_date).toLocaleDateString('ar-EG'),
            AccountingSystem.getExpenseTypeText(exp.expense_type),
            exp.description || '-',
            exp.amount,
            exp.payment_method || '-',
            AccountingSystem.getStatusText(exp.status),
            exp.invoice_number || '-'
        ]);
    });

    data.push([]);
    data.push(['', '', 'الإجمالي:', total, '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');
}

// ========================================
// إنشاء ورقة الموظفين
// ========================================
function createEmployeesSheet(wb) {
    const data = [
        ['بيانات الموظفين'],
        [],
        ['الاسم', 'الوظيفة', 'القسم', 'الراتب اليومي', 'الراتب الشهري', 'الحالة', 'تاريخ التعيين', 'الهاتف']
    ];

    AccountingSystem.employees.forEach(emp => {
        data.push([
            emp.full_name,
            emp.position || '-',
            emp.department || '-',
            emp.daily_salary,
            emp.monthly_salary || '-',
            AccountingSystem.getStatusText(emp.status),
            new Date(emp.hire_date).toLocaleDateString('ar-EG'),
            emp.phone || '-'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'الموظفين');
}

// ========================================
// إنشاء ورقة الحضور
// ========================================
function createAttendanceSheet(wb, startDate, endDate) {
    const attendance = AccountingSystem.attendance.filter(a => {
        const date = new Date(a.date);
        return date >= startDate && date <= endDate;
    });

    const data = [
        ['سجل الحضور والغياب'],
        [],
        ['التاريخ', 'الموظف', 'وقت الدخول', 'وقت الخروج', 'الحالة', 'ملاحظات']
    ];

    attendance.forEach(att => {
        data.push([
            new Date(att.date).toLocaleDateString('ar-EG'),
            att.employee?.full_name || '-',
            att.check_in_time || '-',
            att.check_out_time || '-',
            AccountingSystem.getAttendanceStatusText(att.status),
            att.notes || '-'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'الحضور والغياب');
}

// ========================================
// إنشاء ورقة الرواتب
// ========================================
function createPayrollSheet(wb, startDate, endDate) {
    const payroll = AccountingSystem.payroll.filter(p => {
        const date = new Date(p.created_at);
        return date >= startDate && date <= endDate;
    });

    const data = [
        ['كشف الرواتب'],
        [],
        ['الشهر/السنة', 'الموظف', 'أيام العمل', 'الأساسي', 'الخصومات', 'البونص', 'الصافي', 'الحالة']
    ];

    let totalPaid = 0;

    payroll.forEach(pay => {
        if (pay.status === 'paid') {
            totalPaid += parseFloat(pay.net_salary);
        }
        data.push([
            `${pay.month}/${pay.year}`,
            pay.employee?.full_name || '-',
            pay.days_worked,
            pay.base_salary,
            pay.deductions,
            pay.bonuses,
            pay.net_salary,
            AccountingSystem.getStatusText(pay.status)
        ]);
    });

    data.push([]);
    data.push(['', '', '', '', '', 'إجمالي المدفوع:', totalPaid, '']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'الرواتب');
}

// ========================================
// إنشاء ورقة الموردين
// ========================================
function createSuppliersSheet(wb) {
    const data = [
        ['بيانات الموردين'],
        [],
        ['الاسم', 'الشركة', 'الفئة', 'الهاتف', 'البريد', 'الرصيد الحالي', 'الحالة']
    ];

    AccountingSystem.suppliers.forEach(sup => {
        data.push([
            sup.name,
            sup.company_name || '-',
            sup.category || '-',
            sup.phone || '-',
            sup.email || '-',
            sup.current_balance,
            AccountingSystem.getStatusText(sup.status)
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 25 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'الموردين');
}

// ========================================
// إنشاء ورقة فواتير الموردين
// ========================================
function createInvoicesSheet(wb, startDate, endDate) {
    const invoices = AccountingSystem.invoices.filter(i => {
        const date = new Date(i.invoice_date);
        return date >= startDate && date <= endDate;
    });

    const data = [
        ['فواتير الموردين'],
        [],
        ['رقم الفاتورة', 'المورد', 'التاريخ', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة']
    ];

    let totalAmount = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    invoices.forEach(inv => {
        totalAmount += parseFloat(inv.total_amount);
        totalPaid += parseFloat(inv.paid_amount);
        totalRemaining += parseFloat(inv.remaining_amount);

        data.push([
            inv.invoice_number,
            inv.supplier?.name || '-',
            new Date(inv.invoice_date).toLocaleDateString('ar-EG'),
            inv.total_amount,
            inv.paid_amount,
            inv.remaining_amount,
            AccountingSystem.getStatusText(inv.status)
        ]);
    });

    data.push([]);
    data.push(['', 'الإجمالي:', '', totalAmount, totalPaid, totalRemaining, '']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'فواتير الموردين');
}

// ========================================
// إنشاء ورقة الأرباح والخسائر
// ========================================
function createProfitLossSheet(wb, startDate, endDate) {
    // حسابات مفصلة
    const sales = AccountingSystem.salesData.filter(s => {
        const date = new Date(s.created_at);
        return date >= startDate && date <= endDate;
    });
    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);

    const expenses = AccountingSystem.expenses.filter(e => {
        const date = new Date(e.expense_date);
        return date >= startDate && date <= endDate && e.status !== 'rejected';
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const payroll = AccountingSystem.payroll.filter(p => {
        const date = new Date(p.created_at);
        return date >= startDate && date <= endDate && p.status === 'paid';
    });
    const employeesCost = payroll.reduce((sum, p) => sum + parseFloat(p.net_salary), 0);

    const netProfit = totalRevenue - totalExpenses - employeesCost;

    const data = [
        ['قائمة الأرباح والخسائر'],
        ['من:', startDate.toLocaleDateString('ar-EG'), 'إلى:', endDate.toLocaleDateString('ar-EG')],
        [],
        ['البيان', 'المبلغ', 'النسبة %'],
        [],
        ['الإيرادات'],
        ['المبيعات', totalRevenue, '100.00%'],
        ['إجمالي الإيرادات', totalRevenue, '100.00%'],
        [],
        ['المصروفات'],
        ['المصروفات العامة', totalExpenses, ((totalExpenses / totalRevenue) * 100).toFixed(2) + '%'],
        ['تكلفة الموظفين', employeesCost, ((employeesCost / totalRevenue) * 100).toFixed(2) + '%'],
        ['إجمالي المصروفات', totalExpenses + employeesCost, (((totalExpenses + employeesCost) / totalRevenue) * 100).toFixed(2) + '%'],
        [],
        ['صافي الربح (الخسارة)', netProfit, ((netProfit / totalRevenue) * 100).toFixed(2) + '%']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, ws, 'الأرباح والخسائر');
}

// ========================================
// دوال مساعدة
// ========================================
AccountingSystem.getPeriodText = function() {
    switch (this.currentFilter.period) {
        case 'today': return 'اليوم';
        case 'week': return 'هذا_الأسبوع';
        case 'month': return 'هذا_الشهر';
        case 'custom': return 'فترة_مخصصة';
        default: return 'فترة';
    }
};

AccountingSystem.formatCurrency = function(amount) {
    return new Intl.NumberFormat('ar-EG', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount) + ' ج.م';
};

AccountingSystem.formatDate = function(dateString) {
    return new Date(dateString).toLocaleDateString('ar-EG');
};

AccountingSystem.getStatusText = function(status) {
    const statuses = {
        'active': 'نشط',
        'inactive': 'غير نشط',
        'pending': 'قيد الانتظار',
        'paid': 'مدفوع',
        'approved': 'معتمد',
        'rejected': 'مرفوض',
        'cancelled': 'ملغي',
        'partial': 'جزئي'
    };
    return statuses[status] || status;
};

AccountingSystem.getAttendanceStatusText = function(status) {
    const statuses = {
        'present': 'حاضر',
        'absent': 'غائب',
        'late': 'متأخر',
        'half_day': 'نصف يوم',
        'sick': 'مريض',
        'vacation': 'إجازة'
    };
    return statuses[status] || status;
};

AccountingSystem.getExpenseTypeText = function(type) {
    const types = {
        'electricity': 'كهرباء',
        'water': 'مياه',
        'internet': 'إنترنت',
        'gas': 'غاز',
        'rent': 'إيجار',
        'maintenance': 'صيانة',
        'cleaning': 'نظافة',
        'marketing': 'تسويق',
        'other': 'أخرى'
    };
    return types[type] || type;
};

AccountingSystem.getContractTypeText = function(type) {
    const types = {
        'salary': 'راتب',
        'expense': 'مصروف',
        'invoice': 'فاتورة',
        'supplier': 'مورد'
    };
    return types[type] || type;
};

AccountingSystem.setupEventListeners = function() {
    document.getElementById('periodFilter').addEventListener('change', () => {
        this.applyFilter();
    });
};
// ========================================
// نظام التوقيع الإلكتروني
// ========================================

const SignatureSystem = {
    signaturePad: null,
    canvas: null,
    currentSignatureType: null, // 'employee', 'owner'
    currentItemId: null,

    initSignaturePad(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.signaturePad = new SignaturePad(this.canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });

        // ضبط حجم Canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    },

    resizeCanvas() {
        if (!this.canvas) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        this.canvas.width = this.canvas.offsetWidth * ratio;
        this.canvas.height = this.canvas.offsetHeight * ratio;
        this.canvas.getContext('2d').scale(ratio, ratio);
        if (this.signaturePad) {
            this.signaturePad.clear();
        }
    },

    clearSignature() {
        if (this.signaturePad) {
            this.signaturePad.clear();
        }
    },

    getSignatureData() {
        if (!this.signaturePad) return null;
        if (this.signaturePad.isEmpty()) {
            Utils.showNotification('الرجاء التوقيع أولاً', 'warning');
            return null;
        }
        return this.signaturePad.toDataURL();
    },

    async saveSignature(type, itemId, tableName) {
        const signatureData = this.getSignatureData();
        if (!signatureData) return false;

        try {
            Loading.show('جاري حفظ التوقيع...', '');

            // حفظ في جدول signatures
            const { data: sigData, error: sigError } = await supabase
                .from('signatures')
                .insert({
                    user_id: AccountingSystem.currentUser.id,
                    signature_data: signatureData
                })
                .select()
                .single();

            if (sigError) throw sigError;

            // تحديث السجل المرتبط
            const updateField = type === 'owner' ? 'owner_signature_url' : 'signature_url';
            const { error: updateError } = await supabase
                .from(tableName)
                .update({ 
                    [updateField]: signatureData,
                    [`${type}_signature_date`]: new Date().toISOString()
                })
                .eq('id', itemId);

            if (updateError) throw updateError;

            Loading.success('تم حفظ التوقيع بنجاح ✅');
            return true;
        } catch (error) {
            console.error('Error saving signature:', error);
            Loading.error('حدث خطأ في حفظ التوقيع');
            return false;
        }
    }
};

// ========================================
// Modals - إضافة موظف
// ========================================

AccountingSystem.showAddEmployeeModal = function() {
    const modal = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 class="modal-title">➕ إضافة موظف جديد</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✖</button>
                </div>
                <div class="modal-body">
                    <form id="addEmployeeForm">
                        <div class="form-group">
                            <label>الاسم الكامل *</label>
                            <input type="text" class="form-control" name="full_name" required>
                        </div>
                        <div class="form-group">
                            <label>الرقم القومي</label>
                            <input type="text" class="form-control" name="national_id">
                        </div>
                        <div class="form-group">
                            <label>الهاتف</label>
                            <input type="tel" class="form-control" name="phone">
                        </div>
                        <div class="form-group">
                            <label>البريد الإلكتروني</label>
                            <input type="email" class="form-control" name="email">
                        </div>
                        <div class="form-group">
                            <label>الوظيفة *</label>
                            <select class="form-control" name="position" required>
                                <option value="">اختر الوظيفة</option>
                                <option value="شيف">شيف</option>
                                <option value="مساعد شيف">مساعد شيف</option>
                                <option value="جرسون">جرسون</option>
                                <option value="كاشير">كاشير</option>
                                <option value="عامل نظافة">عامل نظافة</option>
                                <option value="سائق">سائق</option>
                                <option value="مدير">مدير</option>
                                <option value="محاسب">محاسب</option>
                                <option value="أخرى">أخرى</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>القسم</label>
                            <select class="form-control" name="department">
                                <option value="">اختر القسم</option>
                                <option value="مطبخ">مطبخ</option>
                                <option value="خدمة العملاء">خدمة العملاء</option>
                                <option value="كاشير">كاشير</option>
                                <option value="التوصيل">التوصيل</option>
                                <option value="إدارة">إدارة</option>
                                <option value="نظافة">نظافة</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>تاريخ التعيين *</label>
                            <input type="date" class="form-control" name="hire_date" required value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>الراتب اليومي (ج.م) *</label>
                            <input type="number" class="form-control" name="daily_salary" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label>الراتب الشهري (ج.م)</label>
                            <input type="number" class="form-control" name="monthly_salary" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>العنوان</label>
                            <textarea class="form-control" name="address" rows="2"></textarea>
                        </div>
                        <div class="form-group">
                            <label>ملاحظات</label>
                            <textarea class="form-control" name="notes" rows="2"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button class="btn btn-primary" onclick="AccountingSystem.saveEmployee()">حفظ الموظف</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modal;
};

AccountingSystem.saveEmployee = async function() {
    const form = document.getElementById('addEmployeeForm');
    const formData = new FormData(form);
    
    const employee = {
        full_name: formData.get('full_name'),
        national_id: formData.get('national_id'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        position: formData.get('position'),
        department: formData.get('department'),
        hire_date: formData.get('hire_date'),
        daily_salary: parseFloat(formData.get('daily_salary')),
        monthly_salary: formData.get('monthly_salary') ? parseFloat(formData.get('monthly_salary')) : null,
        address: formData.get('address'),
        notes: formData.get('notes'),
        status: 'active'
    };

    try {
        Loading.show('جاري حفظ الموظف...', '');

        const { error } = await supabase
            .from('employees')
            .insert(employee);

        if (error) throw error;

        Loading.success('تم إضافة الموظف بنجاح ✅');
        document.querySelector('.modal-overlay').remove();
        await this.loadEmployees();
    } catch (error) {
        console.error('Error saving employee:', error);
        Loading.error('حدث خطأ في حفظ الموظف');
    }
};

// ========================================
// Modal - تسجيل حضور
// ========================================

AccountingSystem.showAttendanceModal = function() {
    const modal = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 class="modal-title">✅ تسجيل حضور وغياب</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✖</button>
                </div>
                <div class="modal-body">
                    <form id="addAttendanceForm">
                        <div class="form-group">
                            <label>الموظف *</label>
                            <select class="form-control" name="employee_id" required>
                                <option value="">اختر الموظف</option>
                                ${this.employees.filter(e => e.status === 'active').map(emp => 
                                    `<option value="${emp.id}">${emp.full_name} - ${emp.position}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>التاريخ *</label>
                            <input type="date" class="form-control" name="date" required value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>الحالة *</label>
                            <select class="form-control" name="status" required>
                                <option value="present">حاضر</option>
                                <option value="absent">غائب</option>
                                <option value="late">متأخر</option>
                                <option value="half_day">نصف يوم</option>
                                <option value="sick">مريض</option>
                                <option value="vacation">إجازة</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>وقت الدخول</label>
                            <input type="time" class="form-control" name="check_in_time">
                        </div>
                        <div class="form-group">
                            <label>وقت الخروج</label>
                            <input type="time" class="form-control" name="check_out_time">
                        </div>
                        <div class="form-group">
                            <label>ملاحظات</label>
                            <textarea class="form-control" name="notes" rows="2"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button class="btn btn-primary" onclick="AccountingSystem.saveAttendance()">حفظ السجل</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modal;
};

AccountingSystem.saveAttendance = async function() {
    const form = document.getElementById('addAttendanceForm');
    const formData = new FormData(form);
    
    const attendance = {
        employee_id: parseInt(formData.get('employee_id')),
        date: formData.get('date'),
        status: formData.get('status'),
        check_in_time: formData.get('check_in_time') || null,
        check_out_time: formData.get('check_out_time') || null,
        notes: formData.get('notes'),
        approved_by: this.currentUser.id
    };

    try {
        Loading.show('جاري حفظ السجل...', '');

        const { error } = await supabase
            .from('attendance')
            .insert(attendance);

        if (error) throw error;

        Loading.success('تم تسجيل الحضور بنجاح ✅');
        document.querySelector('.modal-overlay').remove();
        await this.loadAttendance();
    } catch (error) {
        console.error('Error saving attendance:', error);
        Loading.error('حدث خطأ في تسجيل الحضور');
    }
};

// ========================================
// Modal - إضافة مصروف
// ========================================

AccountingSystem.showAddExpenseModal = function() {
    const modal = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 class="modal-title">➕ إضافة مصروف عام</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✖</button>
                </div>
                <div class="modal-body">
                    <form id="addExpenseForm">
                        <div class="form-group">
                            <label>نوع المصروف *</label>
                            <select class="form-control" name="expense_type" required>
                                <option value="">اختر النوع</option>
                                <option value="electricity">⚡ كهرباء</option>
                                <option value="water">💧 مياه</option>
                                <option value="internet">🌐 إنترنت</option>
                                <option value="gas">🔥 غاز</option>
                                <option value="rent">🏢 إيجار</option>
                                <option value="maintenance">🔧 صيانة</option>
                                <option value="cleaning">🧹 نظافة</option>
                                <option value="marketing">📢 تسويق</option>
                                <option value="transportation">🚗 مواصلات</option>
                                <option value="supplies">📦 مستلزمات</option>
                                <option value="other">📋 أخرى</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>الوصف *</label>
                            <textarea class="form-control" name="description" rows="2" required></textarea>
                        </div>
                        <div class="form-group">
                            <label>المبلغ (ج.م) *</label>
                            <input type="number" class="form-control" name="amount" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label>التاريخ *</label>
                            <input type="date" class="form-control" name="expense_date" required value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>طريقة الدفع</label>
                            <select class="form-control" name="payment_method">
                                <option value="">اختر طريقة الدفع</option>
                                <option value="cash">نقدي</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="check">شيك</option>
                                <option value="credit_card">بطاقة ائتمان</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>رقم الفاتورة</label>
                            <input type="text" class="form-control" name="invoice_number">
                        </div>
                        <div class="form-group">
                            <label>المورد</label>
                            <select class="form-control" name="supplier_id">
                                <option value="">اختر المورد (اختياري)</option>
                                ${this.suppliers.map(sup => 
                                    `<option value="${sup.id}">${sup.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>ملاحظات</label>
                            <textarea class="form-control" name="notes" rows="2"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button class="btn btn-primary" onclick="AccountingSystem.saveExpense()">حفظ المصروف</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modal;
};

AccountingSystem.saveExpense = async function() {
    const form = document.getElementById('addExpenseForm');
    const formData = new FormData(form);
    
    const expense = {
        expense_type: formData.get('expense_type'),
        description: formData.get('description'),
        amount: parseFloat(formData.get('amount')),
        expense_date: formData.get('expense_date'),
        payment_method: formData.get('payment_method') || null,
        invoice_number: formData.get('invoice_number') || null,
        supplier_id: formData.get('supplier_id') ? parseInt(formData.get('supplier_id')) : null,
        notes: formData.get('notes'),
        status: 'pending'
    };

    try {
        Loading.show('جاري حفظ المصروف...', '');

        const { data, error } = await supabase
            .from('general_expenses')
            .insert(expense)
            .select()
            .single();

        if (error) throw error;

        // إنشاء عقد تلقائي
        await this.createExpenseContract(data);

        Loading.success('تم إضافة المصروف بنجاح ✅');
        document.querySelector('.modal-overlay').remove();
        await this.loadExpenses();
        await this.updateDashboard();
    } catch (error) {
        console.error('Error saving expense:', error);
        Loading.error('حدث خطأ في حفظ المصروف');
    }
};

// ========================================
// إنشاء عقد تلقائي للمصروف
// ========================================

AccountingSystem.createExpenseContract = async function(expense) {
    const contractNumber = `EXP-${Date.now()}`;
    const contract = {
        contract_type: 'expense',
        related_id: expense.id,
        contract_number: contractNumber,
        contract_date: expense.expense_date,
        contract_title: `عقد مصروف - ${this.getExpenseTypeText(expense.expense_type)}`,
        contract_content: `
عقد مصروف عام

رقم العقد: ${contractNumber}
التاريخ: ${new Date(expense.expense_date).toLocaleDateString('ar-EG')}

نوع المصروف: ${this.getExpenseTypeText(expense.expense_type)}
الوصف: ${expense.description}
المبلغ: ${expense.amount} جنيه مصري
طريقة الدفع: ${expense.payment_method || 'غير محدد'}

أقر أنا الموقع أدناه بأنني قد استلمت المبلغ المذكور أعلاه لغرض الصرف على ${this.getExpenseTypeText(expense.expense_type)}.

التوقيع: ___________________
التاريخ: ${new Date().toLocaleDateString('ar-EG')}
        `,
        amount: expense.amount,
        party_name: 'الموظف المسؤول',
        status: 'pending'
    };

    try {
        await supabase.from('contracts').insert(contract);
    } catch (error) {
        console.error('Error creating contract:', error);
    }
};

// ========================================
// Modal - عرض العقد والتوقيع
// ========================================

AccountingSystem.viewContract = async function(contractId) {
    const contract = this.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const modal = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal" onclick="event.stopPropagation()" style="max-width: 800px;">
                <div class="modal-header">
                    <h3 class="modal-title">📄 العقد رقم: ${contract.contract_number}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✖</button>
                </div>
                <div class="modal-body">
                    <div style="background: #f9fafb; padding: 2rem; border-radius: 8px; white-space: pre-wrap; font-family: monospace; line-height: 1.8;">
${contract.contract_content}
                    </div>
                    
                    ${!contract.party_signature_url ? `
                    <div style="margin-top: 2rem;">
                        <h4>توقيع الطرف المسؤول:</h4>
                        <div class="signature-container">
                            <canvas id="partySignatureCanvas" class="signature-canvas" width="500" height="200"></canvas>
                            <div class="signature-actions">
                                <button class="btn btn-sm btn-secondary" onclick="SignatureSystem.clearSignature()">مسح التوقيع</button>
                                <button class="btn btn-sm btn-primary" onclick="AccountingSystem.saveContractSignature(${contractId}, 'party')">حفظ توقيع الطرف</button>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div style="margin-top: 1rem;">
                        <strong>✅ تم توقيع الطرف المسؤول</strong>
                        <img src="${contract.party_signature_url}" style="max-width: 300px; border: 1px solid #ddd; display: block; margin-top: 0.5rem;">
                    </div>
                    `}

                    ${this.currentUser.role === 'owner' && !contract.owner_signature_url ? `
                    <div style="margin-top: 2rem;">
                        <h4>توقيع المالك (للاعتماد):</h4>
                        <div class="signature-container">
                            <canvas id="ownerSignatureCanvas" class="signature-canvas" width="500" height="200"></canvas>
                            <div class="signature-actions">
                                <button class="btn btn-sm btn-secondary" onclick="SignatureSystem.clearSignature()">مسح التوقيع</button>
                                <button class="btn btn-sm btn-success" onclick="AccountingSystem.saveContractSignature(${contractId}, 'owner')">اعتماد وتوقيع</button>
                            </div>
                        </div>
                    </div>
                    ` : contract.owner_signature_url ? `
                    <div style="margin-top: 1rem;">
                        <strong>✅ تم اعتماد العقد من المالك</strong>
                        <img src="${contract.owner_signature_url}" style="max-width: 300px; border: 1px solid #ddd; display: block; margin-top: 0.5rem;">
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button class="btn btn-info" onclick="AccountingSystem.printContract(${contractId})">🖨️ طباعة</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modal;

    // تهيئة signature pad
    setTimeout(() => {
        const canvasId = !contract.party_signature_url ? 'partySignatureCanvas' : 'ownerSignatureCanvas';
        if (document.getElementById(canvasId)) {
            SignatureSystem.initSignaturePad(canvasId);
        }
    }, 100);
};

AccountingSystem.saveContractSignature = async function(contractId, type) {
    const success = await SignatureSystem.saveSignature(type, contractId, 'contracts');
    if (success) {
        await this.loadContracts();
        document.querySelector('.modal-overlay').remove();
        Utils.showNotification('تم حفظ التوقيع بنجاح ✅', 'success');
    }
};

AccountingSystem.filterExpenses = function(type) {
    // تفعيل الزر
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // فلترة الجدول
    const tbody = document.querySelector('#expensesTable tbody');
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        if (type === 'all') {
            row.style.display = '';
        } else {
            const expenseType = row.cells[1].textContent;
            if (expenseType.includes(this.getExpenseTypeText(type))) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
};
