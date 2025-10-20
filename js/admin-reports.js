// js/admin-reports.js
// نظام التقارير الشامل وتصدير Excel الذكي

const ReportManager = {
    reportData: {},

    async init() {
        console.log('✅ Report Manager Initialized');
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reportDateFrom').value = today;
        document.getElementById('reportDateTo').value = today;
    },

    toggleCustomDates() {
        const period = document.getElementById('reportPeriod').value;
        const dateFromInput = document.getElementById('reportDateFrom');
        const dateToInput = document.getElementById('reportDateTo');

        if (period === 'custom') {
            dateFromInput.style.display = 'inline-block';
            dateToInput.style.display = 'inline-block';
        } else {
            dateFromInput.style.display = 'none';
            dateToInput.style.display = 'none';
        }
    },

    getDateRange() {
        const period = document.getElementById('reportPeriod').value;
        const now = new Date();
        let dateFrom, dateTo;

        switch(period) {
            case 'today':
                dateFrom = dateTo = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                dateFrom = dateTo = new Date(yesterday.setHours(0, 0, 0, 0));
                break;
            case 'week':
                dateTo = new Date(now.setHours(0, 0, 0, 0));
                dateFrom = new Date(now);
                dateFrom.setDate(dateFrom.getDate() - 7);
                break;
            case 'month':
                dateTo = new Date(now.setHours(0, 0, 0, 0));
                dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'custom':
                dateFrom = new Date(document.getElementById('reportDateFrom').value);
                dateTo = new Date(document.getElementById('reportDateTo').value);
                break;
            default:
                dateFrom = dateTo = new Date(now.setHours(0, 0, 0, 0));
        }

        return {
            from: dateFrom.toISOString().split('T')[0],
            to: dateTo.toISOString().split('T')[0]
        };
    },

    async generateReport() {
        const reportType = document.getElementById('reportType').value;
        const dateRange = this.getDateRange();

        try {
            Loading.show('جاري إنشاء التقرير...');

            switch(reportType) {
                case 'sales':
                    await this.generateSalesReport(dateRange);
                    break;
                case 'expenses':
                    await this.generateExpensesReport(dateRange);
                    break;
                case 'employees':
                    await this.generateEmployeesReport(dateRange);
                    break;
                case 'inventory':
                    await this.generateInventoryReport();
                    break;
                case 'profit':
                    await this.generateProfitReport(dateRange);
                    break;
                case 'comprehensive':
                    await this.generateComprehensiveReport(dateRange);
                    break;
            }

            Loading.hide();
        } catch (error) {
            console.error('Error generating report:', error);
            Loading.error('حدث خطأ في إنشاء التقرير');
        }
    },

    async generateSalesReport(dateRange) {
        const { data: orders, error } = await Database.supabase
            .from('orders')
            .select(`
                *,
                order_items(quantity, price, menu_item:menu_items(name_ar))
            `)
            .gte('created_at', dateRange.from)
            .lte('created_at', dateRange.to + 'T23:59:59')
            .in('status', ['completed', 'delivered']);

        if (error) throw error;

        const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        const totalOrders = orders.length;

        this.reportData = {
            type: 'sales',
            dateRange,
            orders,
            totalSales,
            totalOrders,
            avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
        };

        this.updateReportStats();
        this.renderSalesDetails();
    },

    async generateExpensesReport(dateRange) {
        const [expenses, salaries, supplierPayments, bills] = await Promise.all([
            Database.supabase.from('general_expenses')
                .select('*')
                .gte('expense_date', dateRange.from)
                .lte('expense_date', dateRange.to),
            Database.supabase.from('employee_salaries')
                .select('*')
                .gte('payment_date', dateRange.from)
                .lte('payment_date', dateRange.to),
            Database.supabase.from('supplier_payments')
                .select('*')
                .gte('payment_date', dateRange.from)
                .lte('payment_date', dateRange.to),
            Database.supabase.from('utility_bills')
                .select('*')
                .gte('bill_date', dateRange.from)
                .lte('bill_date', dateRange.to)
                .eq('payment_status', 'paid')
        ]);

        const totalExpenses = 
            (expenses.data || []).reduce((s, e) => s + parseFloat(e.amount), 0) +
            (salaries.data || []).reduce((s, e) => s + parseFloat(e.amount), 0) +
            (supplierPayments.data || []).reduce((s, e) => s + parseFloat(e.amount), 0) +
            (bills.data || []).reduce((s, e) => s + parseFloat(e.amount), 0);

        this.reportData = {
            type: 'expenses',
            dateRange,
            expenses: expenses.data || [],
            salaries: salaries.data || [],
            supplierPayments: supplierPayments.data || [],
            bills: bills.data || [],
            totalExpenses
        };

        document.getElementById('reportTotalExpenses').textContent = totalExpenses.toFixed(2) + ' ج.م';
    },

    async generateProfitReport(dateRange) {
        await Promise.all([
            this.generateSalesReport(dateRange),
            this.generateExpensesReport(dateRange)
        ]);

        const totalSales = this.reportData.totalSales || 0;
        const totalExpenses = this.reportData.totalExpenses || 0;
        const netProfit = totalSales - totalExpenses;
        const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        document.getElementById('reportTotalSales').textContent = totalSales.toFixed(2) + ' ج.م';
        document.getElementById('reportTotalExpenses').textContent = totalExpenses.toFixed(2) + ' ج.م';
        document.getElementById('reportNetProfit').textContent = netProfit.toFixed(2) + ' ج.م';
        document.getElementById('reportProfitMargin').textContent = profitMargin.toFixed(2) + '%';

        // تلوين صافي الربح
        const profitEl = document.getElementById('reportNetProfit');
        if (profitEl) {
            profitEl.style.color = netProfit >= 0 ? '#27ae60' : '#e74c3c';
        }
    },

    async generateComprehensiveReport(dateRange) {
        await this.generateProfitReport(dateRange);
    },

    updateReportStats() {
        if (this.reportData.totalSales !== undefined) {
            document.getElementById('reportTotalSales').textContent = 
                this.reportData.totalSales.toFixed(2) + ' ج.م';
        }
    },

    renderSalesDetails() {
        const container = document.getElementById('reportDetailsContainer');
        if (!container || !this.reportData.orders) return;

        container.innerHTML = `
            <div class="section-header">
                <h3>تفاصيل المبيعات</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>رقم الطلب</th>
                            <th>التاريخ</th>
                            <th>النوع</th>
                            <th>الإجمالي</th>
                            <th>عدد الأصناف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.orders.map(order => `
                            <tr>
                                <td>#${order.id}</td>
                                <td>${new Date(order.created_at).toLocaleString('ar-EG')}</td>
                                <td>${order.order_type === 'dine_in' ? '🍽️ طاولة' : '🚚 توصيل'}</td>
                                <td><strong>${order.total_amount.toFixed(2)} ج.م</strong></td>
                                <td>${order.order_items?.length || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // تصدير Excel الذكي
    async exportToExcel() {
        try {
            Loading.show('جاري تصدير Excel...');

            const reportType = document.getElementById('reportType').value;
            const dateRange = this.getDateRange();

            await this.generateReport();

            let workbook;
            switch(reportType) {
                case 'sales':
                    workbook = await this.createSalesExcel();
                    break;
                case 'expenses':
                    workbook = await this.createExpensesExcel();
                    break;
                case 'employees':
                    workbook = await this.createEmployeesExcel();
                    break;
                case 'inventory':
                    workbook = await this.createInventoryExcel();
                    break;
                case 'profit':
                    workbook = await this.createProfitExcel();
                    break;
                case 'comprehensive':
                    workbook = await this.createComprehensiveExcel();
                    break;
            }

            if (workbook) {
                const fileName = `تقرير_${reportType}_${dateRange.from}_${dateRange.to}.xlsx`;
                XLSX.writeFile(workbook, fileName);
                Loading.hide();
                alert('✅ تم تصدير التقرير بنجاح!');
            }
        } catch (error) {
            console.error('Error exporting Excel:', error);
            Loading.error('حدث خطأ في التصدير');
        }
    },

    async createSalesExcel() {
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: ملخص المبيعات
        const summaryData = [
            ['تقرير المبيعات', ''],
            ['من تاريخ:', this.reportData.dateRange.from],
            ['إلى تاريخ:', this.reportData.dateRange.to],
            [''],
            ['إجمالي المبيعات', this.reportData.totalSales.toFixed(2) + ' ج.م'],
            ['عدد الطلبات', this.reportData.totalOrders],
            ['متوسط قيمة الطلب', this.reportData.avgOrderValue.toFixed(2) + ' ج.م'],
            [''],
            ['رقم الطلب', 'التاريخ', 'النوع', 'الإجمالي', 'الحالة']
        ];

        this.reportData.orders.forEach(order => {
            summaryData.push([
                order.id,
                new Date(order.created_at).toLocaleString('ar-EG'),
                order.order_type === 'dine_in' ? 'طاولة' : 'توصيل',
                parseFloat(order.total_amount),
                order.status
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        
        // تنسيق العرض
        ws['!cols'] = [
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'ملخص المبيعات');

        return wb;
    },

    async createExpensesExcel() {
        const wb = XLSX.utils.book_new();
        
        const totalExpenses = this.reportData.totalExpenses || 0;
        const summaryData = [
            ['تقرير المصروفات', ''],
            ['من تاريخ:', this.reportData.dateRange.from],
            ['إلى تاريخ:', this.reportData.dateRange.to],
            [''],
            ['إجمالي المصروفات', totalExpenses.toFixed(2) + ' ج.م'],
            [''],
            ['التفاصيل:', '']
        ];

        // المصروفات العامة
        if (this.reportData.expenses?.length > 0) {
            summaryData.push(['', 'المصروفات العامة']);
            summaryData.push(['التاريخ', 'الفئة', 'الوصف', 'المبلغ']);
            this.reportData.expenses.forEach(exp => {
                summaryData.push([
                    exp.expense_date,
                    exp.category,
                    exp.description,
                    parseFloat(exp.amount)
                ]);
            });
            summaryData.push(['']);
        }

        // الرواتب
        if (this.reportData.salaries?.length > 0) {
            summaryData.push(['', 'رواتب الموظفين']);
            summaryData.push(['التاريخ', 'الموظف', 'النوع', 'المبلغ']);
            this.reportData.salaries.forEach(sal => {
                summaryData.push([
                    sal.payment_date,
                    'موظف #' + sal.employee_id,
                    sal.payment_type,
                    parseFloat(sal.amount)
                ]);
            });
            summaryData.push(['']);
        }

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }];

        XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');

        return wb;
    },

    async createProfitExcel() {
        const wb = XLSX.utils.book_new();
        
        const totalSales = this.reportData.totalSales || 0;
        const totalExpenses = this.reportData.totalExpenses || 0;
        const netProfit = totalSales - totalExpenses;
        const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        const data = [
            ['تقرير الأرباح والخسائر', ''],
            ['من تاريخ:', this.reportData.dateRange.from],
            ['إلى تاريخ:', this.reportData.dateRange.to],
            [''],
            ['البند', 'المبلغ'],
            ['إجمالي المبيعات', totalSales.toFixed(2)],
            ['إجمالي المصروفات', totalExpenses.toFixed(2)],
            ['صافي الربح', netProfit.toFixed(2)],
            ['نسبة الربح', profitMargin.toFixed(2) + '%'],
            [''],
            ['الحالة', netProfit >= 0 ? 'ربح ✅' : 'خسارة ⚠️']
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, 'الأرباح والخسائر');

        return wb;
    },

    async createInventoryExcel() {
        const { data: inventory, error } = await Database.supabase
            .from('ingredients')
            .select('*')
            .order('name');

        if (error) throw error;

        const wb = XLSX.utils.book_new();
        
        const data = [
            ['تقرير المخزون', ''],
            ['تاريخ التقرير:', new Date().toLocaleDateString('ar-EG')],
            [''],
            ['المكون', 'الوحدة', 'الكمية الحالية', 'الحد الأدنى', 'التكلفة/وحدة', 'القيمة الإجمالية', 'الحالة']
        ];

        let totalValue = 0;

        (inventory || []).forEach(item => {
            const itemValue = item.current_stock * item.cost_per_unit;
            totalValue += itemValue;
            
            const status = item.current_stock <= item.min_stock ? 'ينفد ⚠️' : 'متوفر ✅';
            
            data.push([
                item.name,
                item.unit,
                item.current_stock,
                item.min_stock,
                item.cost_per_unit,
                itemValue.toFixed(2),
                status
            ]);
        });

        data.push(['']);
        data.push(['إجمالي قيمة المخزون:', totalValue.toFixed(2) + ' ج.م']);

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
            { wch: 25 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'المخزون');

        return wb;
    },

    async createEmployeesExcel() {
        const { data: employees, error } = await Database.supabase
            .from('employees')
            .select('*')
            .order('name');

        if (error) throw error;

        const wb = XLSX.utils.book_new();
        
        const data = [
            ['تقرير الموظفين', ''],
            ['تاريخ التقرير:', new Date().toLocaleDateString('ar-EG')],
            [''],
            ['الاسم', 'الوظيفة', 'الموبايل', 'الراتب اليومي', 'تاريخ التعيين', 'الحالة']
        ];

        (employees || []).forEach(emp => {
            data.push([
                emp.name,
                emp.job_title,
                emp.phone || '-',
                emp.daily_salary,
                emp.hire_date,
                emp.status === 'active' ? 'نشط' : 'غير نشط'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
            { wch: 25 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'الموظفين');

        return wb;
    },

    async createComprehensiveExcel() {
        const wb = XLSX.utils.book_new();
        
        // إضافة كل التقارير
        const salesWB = await this.createSalesExcel();
        const expensesWB = await this.createExpensesExcel();
        const profitWB = await this.createProfitExcel();
        const inventoryWB = await this.createInventoryExcel();
        const employeesWB = await this.createEmployeesExcel();

        // دمج كل الـ sheets
        salesWB.SheetNames.forEach(name => {
            XLSX.utils.book_append_sheet(wb, salesWB.Sheets[name], name);
        });
        expensesWB.SheetNames.forEach(name => {
            XLSX.utils.book_append_sheet(wb, expensesWB.Sheets[name], name);
        });
        profitWB.SheetNames.forEach(name => {
            XLSX.utils.book_append_sheet(wb, profitWB.Sheets[name], name);
        });
        inventoryWB.SheetNames.forEach(name => {
            XLSX.utils.book_append_sheet(wb, inventoryWB.Sheets[name], name);
        });
        employeesWB.SheetNames.forEach(name => {
            XLSX.utils.book_append_sheet(wb, employeesWB.Sheets[name], name);
        });

        return wb;
    }
};

window.ReportManager = ReportManager;
console.log('✅ Report Manager Loaded');
