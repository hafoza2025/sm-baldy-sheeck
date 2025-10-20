// ========================================
// نظام إدارة الموظفين والمصروفات
// hr-management.js
// ========================================

// ===================================
// إدارة الموظفين
// ===================================

async function loadEmployees() {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('employeesBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">لا توجد موظفين</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(emp => `
            <tr>
                <td>${emp.name}</td>
                <td>${emp.position}</td>
                <td>${emp.phone || '-'}</td>
                <td>${emp.daily_salary.toFixed(2)} جنيه</td>
                <td>${new Date(emp.hire_date).toLocaleDateString('ar-EG')}</td>
                <td>
                    <span class="badge ${emp.status === 'active' ? 'badge-success' : 'badge-danger'}">
                        ${emp.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="editEmployee(${emp.id})">تعديل</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${emp.id})">حذف</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('خطأ في تحميل الموظفين:', error);
        alert('حدث خطأ في تحميل قائمة الموظفين');
    }
}

async function saveEmployee(event) {
    event.preventDefault();

    const employeeData = {
        name: document.getElementById('employeeName').value,
        position: document.getElementById('employeePosition').value,
        phone: document.getElementById('employeePhone').value,
        daily_salary: parseFloat(document.getElementById('employeeSalary').value),
        hire_date: document.getElementById('employeeHireDate').value,
        notes: document.getElementById('employeeNotes').value,
        status: 'active'
    };

    try {
        const { error } = await supabase
            .from('employees')
            .insert([employeeData]);

        if (error) throw error;

        alert('✅ تم إضافة الموظف بنجاح!');
        closeModal('addEmployeeModal');
        loadEmployees();

    } catch (error) {
        console.error('خطأ في حفظ الموظف:', error);
        alert('حدث خطأ في حفظ بيانات الموظف');
    }
}

async function deleteEmployee(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;

    try {
        const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ تم حذف الموظف بنجاح!');
        loadEmployees();

    } catch (error) {
        console.error('خطأ في حذف الموظف:', error);
        alert('حدث خطأ في حذف الموظف');
    }
}

// ===================================
// إدارة الحضور
// ===================================

async function loadAttendance() {
    const dateInput = document.getElementById('attendance-date-picker');
    const selectedDate = dateInput.value || new Date().toISOString().split('T')[0];
    
    document.getElementById('attendance-date-display').textContent = new Date(selectedDate).toLocaleDateString('ar-EG');

    try {
        // تحميل جميع الموظفين
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('status', 'active');

        if (empError) throw empError;

        // تحميل الحضور لهذا اليوم
        const { data: attendance, error: attError } = await supabase
            .from('employee_attendance')
            .select('*')
            .eq('date', selectedDate);

        if (attError) throw attError;

        const attendanceMap = {};
        attendance.forEach(att => {
            attendanceMap[att.employee_id] = att.status;
        });

        const listDiv = document.getElementById('attendance-list');
        listDiv.innerHTML = employees.map(emp => `
            <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${emp.name}</strong>
                    <span style="color: #666; margin-right: 10px;">${emp.position}</span>
                    <span style="color: #999; font-size: 14px;">الراتب: ${emp.daily_salary} جنيه/يوم</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <label style="cursor: pointer;">
                        <input type="radio" name="attendance-${emp.id}" value="present" ${attendanceMap[emp.id] === 'present' ? 'checked' : ''}>
                        ✅ حاضر
                    </label>
                    <label style="cursor: pointer;">
                        <input type="radio" name="attendance-${emp.id}" value="absent" ${attendanceMap[emp.id] === 'absent' ? 'checked' : ''}>
                        ❌ غائب
                    </label>
                    <label style="cursor: pointer;">
                        <input type="radio" name="attendance-${emp.id}" value="half_day" ${attendanceMap[emp.id] === 'half_day' ? 'checked' : ''}>
                        ⏰ نصف يوم
                    </label>
                    <label style="cursor: pointer;">
                        <input type="radio" name="attendance-${emp.id}" value="sick" ${attendanceMap[emp.id] === 'sick' ? 'checked' : ''}>
                        🤒 مريض
                    </label>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('خطأ في تحميل الحضور:', error);
        alert('حدث خطأ في تحميل بيانات الحضور');
    }
}

async function saveAttendance() {
    const dateInput = document.getElementById('attendance-date-picker');
    const selectedDate = dateInput.value || new Date().toISOString().split('T')[0];

    try {
        const { data: employees } = await supabase
            .from('employees')
            .select('id, daily_salary')
            .eq('status', 'active');

        const attendanceRecords = [];

        employees.forEach(emp => {
            const radioButtons = document.getElementsByName(`attendance-${emp.id}`);
            let selectedStatus = 'absent';
            
            radioButtons.forEach(radio => {
                if (radio.checked) {
                    selectedStatus = radio.value;
                }
            });

            let salaryPaid = 0;
            if (selectedStatus === 'present') salaryPaid = emp.daily_salary;
            else if (selectedStatus === 'half_day') salaryPaid = emp.daily_salary / 2;

            attendanceRecords.push({
                employee_id: emp.id,
                date: selectedDate,
                status: selectedStatus,
                salary_paid: salaryPaid
            });
        });

        // حذف السجلات القديمة لهذا اليوم
        await supabase
            .from('employee_attendance')
            .delete()
            .eq('date', selectedDate);

        // إضافة السجلات الجديدة
        const { error } = await supabase
            .from('employee_attendance')
            .insert(attendanceRecords);

        if (error) throw error;

        alert('✅ تم حفظ الحضور بنجاح!');

    } catch (error) {
        console.error('خطأ في حفظ الحضور:', error);
        alert('حدث خطأ في حفظ بيانات الحضور');
    }
}

async function loadSalaryReport() {
    const fromDate = document.getElementById('salary-from').value;
    const toDate = document.getElementById('salary-to').value;

    if (!fromDate || !toDate) {
        alert('يرجى اختيار الفترة الزمنية');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('employee_attendance')
            .select(`
                *,
                employees (name, position, daily_salary)
            `)
            .gte('date', fromDate)
            .lte('date', toDate);

        if (error) throw error;

        // تجميع البيانات حسب الموظف
        const salaryMap = {};
        
        data.forEach(record => {
            const empId = record.employee_id;
            if (!salaryMap[empId]) {
                salaryMap[empId] = {
                    name: record.employees.name,
                    position: record.employees.position,
                    dailySalary: record.employees.daily_salary,
                    presentDays: 0,
                    absentDays: 0,
                    halfDays: 0,
                    totalPaid: 0
                };
            }

            if (record.status === 'present') salaryMap[empId].presentDays++;
            else if (record.status === 'absent') salaryMap[empId].absentDays++;
            else if (record.status === 'half_day') salaryMap[empId].halfDays++;

            salaryMap[empId].totalPaid += parseFloat(record.salary_paid || 0);
        });

        const reportDiv = document.getElementById('salary-report');
        const employees = Object.values(salaryMap);
        const grandTotal = employees.reduce((sum, emp) => sum + emp.totalPaid, 0);

        reportDiv.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f0f0f0;">
                        <th style="padding: 12px; border: 1px solid #ddd;">الموظف</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">الوظيفة</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">أيام الحضور</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">أيام الغياب</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">نصف يوم</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">الراتب اليومي</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">الإجمالي المدفوع</th>
                    </tr>
                </thead>
                <tbody>
                    ${employees.map(emp => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">${emp.name}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${emp.position}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.presentDays}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.absentDays}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.halfDays}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.dailySalary.toFixed(2)} جنيه</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${emp.totalPaid.toFixed(2)} جنيه</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #667eea; color: white;">
                        <td colspan="6" style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: bold;">الإجمالي الكلي</td>
                        <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 18px;">${grandTotal.toFixed(2)} جنيه</td>
                    </tr>
                </tfoot>
            </table>
        `;

    } catch (error) {
        console.error('خطأ في تحميل تقرير الرواتب:', error);
        alert('حدث خطأ في تحميل التقرير');
    }
}

// ===================================
// إدارة الموردين
// ===================================

async function loadSuppliers() {
    try {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('suppliersBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">لا يوجد موردين</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(sup => `
            <tr>
                <td>${sup.name}</td>
                <td>${sup.phone || '-'}</td>
                <td>${sup.category || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${sup.id})">حذف</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('خطأ في تحميل الموردين:', error);
    }
}

async function saveSupplier(event) {
    event.preventDefault();

    const supplierData = {
        name: document.getElementById('supplierName').value,
        phone: document.getElementById('supplierPhone').value,
        category: document.getElementById('supplierCategory').value,
        address: document.getElementById('supplierAddress').value
    };

    try {
        const { error } = await supabase
            .from('suppliers')
            .insert([supplierData]);

        if (error) throw error;

        alert('✅ تم إضافة المورد بنجاح!');
        closeModal('addSupplierModal');
        loadSuppliers();

    } catch (error) {
        console.error('خطأ في حفظ المورد:', error);
        alert('حدث خطأ في حفظ بيانات المورد');
    }
}

async function deleteSupplier(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;

    try {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ تم حذف المورد بنجاح!');
        loadSuppliers();

    } catch (error) {
        console.error('خطأ في حذف المورد:', error);
        alert('حدث خطأ في حذف المورد');
    }
}

// ===================================
// إدارة الفواتير
// ===================================

async function loadSuppliersForInvoice() {
    try {
        const { data, error } = await supabase
            .from('suppliers')
            .select('id, name')
            .order('name');

        if (error) throw error;

        const select = document.getElementById('invoiceSupplier');
        select.innerHTML = '<option value="">اختر المورد</option>' + 
            data.map(sup => `<option value="${sup.id}">${sup.name}</option>`).join('');

    } catch (error) {
        console.error('خطأ في تحميل الموردين:', error);
    }
}

async function loadInvoices() {
    try {
        const { data, error } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                suppliers (name)
            `)
            .order('invoice_date', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('invoicesBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">لا توجد فواتير</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(inv => {
            const remaining = inv.amount - inv.paid_amount;
            return `
                <tr>
                    <td>${inv.invoice_number || '-'}</td>
                    <td>${inv.suppliers?.name || 'غير محدد'}</td>
                    <td>${new Date(inv.invoice_date).toLocaleDateString('ar-EG')}</td>
                    <td>${inv.amount.toFixed(2)} جنيه</td>
                    <td>${inv.paid_amount.toFixed(2)} جنيه</td>
                    <td style="color: ${remaining > 0 ? '#f44336' : '#4caf50'};">${remaining.toFixed(2)} جنيه</td>
                    <td>
                        <span class="badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'partial' ? 'badge-warning' : 'badge-danger'}">
                            ${inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partial' ? 'جزئي' : 'معلقة'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="printInvoice(${inv.id})">طباعة</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${inv.id})">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('خطأ في تحميل الفواتير:', error);
    }
}

async function saveInvoice(event) {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('invoiceAmount').value);
    const paidAmount = parseFloat(document.getElementById('invoicePaid').value || 0);
    
    let status = 'pending';
    if (paidAmount >= amount) status = 'paid';
    else if (paidAmount > 0) status = 'partial';

    const invoiceData = {
        supplier_id: parseInt(document.getElementById('invoiceSupplier').value),
        invoice_number: document.getElementById('invoiceNumber').value,
        invoice_date: document.getElementById('invoiceDate').value,
        amount: amount,
        paid_amount: paidAmount,
        status: status,
        description: document.getElementById('invoiceDescription').value
    };

    try {
        const { data, error } = await supabase
            .from('supplier_invoices')
            .insert([invoiceData])
            .select();

        if (error) throw error;

        alert('✅ تم إضافة الفاتورة بنجاح!');
        closeModal('addInvoiceModal');
        loadInvoices();
        
        // طباعة الفاتورة
        if (data && data[0]) {
            printInvoice(data[0].id);
        }

    } catch (error) {
        console.error('خطأ في حفظ الفاتورة:', error);
        alert('حدث خطأ في حفظ الفاتورة');
    }
}

async function deleteInvoice(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;

    try {
        const { error } = await supabase
            .from('supplier_invoices')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ تم حذف الفاتورة بنجاح!');
        loadInvoices();

    } catch (error) {
        console.error('خطأ في حذف الفاتورة:', error);
    }
}

async function printInvoice(id) {
    try {
        const { data, error } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                suppliers (name, phone, address)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>فاتورة مورد #${data.invoice_number || id}</title>
                <style>
                    body { font-family: Arial; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                    .total { font-size: 18px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧾 فاتورة مورد</h1>
                    <p>رقم الفاتورة: ${data.invoice_number || id}</p>
                    <p>التاريخ: ${new Date(data.invoice_date).toLocaleDateString('ar-EG')}</p>
                </div>
                
                <div><strong>المورد:</strong> ${data.suppliers?.name || 'غير محدد'}</div>
                <div><strong>الهاتف:</strong> ${data.suppliers?.phone || '-'}</div>
                <div><strong>العنوان:</strong> ${data.suppliers?.address || '-'}</div>
                
                <table>
                    <tr>
                        <th>البيان</th>
                        <th>المبلغ</th>
                    </tr>
                    <tr>
                        <td>${data.description || 'فاتورة مشتريات'}</td>
                        <td>${data.amount.toFixed(2)} جنيه</td>
                    </tr>
                    <tr>
                        <td><strong>المدفوع</strong></td>
                        <td><strong>${data.paid_amount.toFixed(2)} جنيه</strong></td>
                    </tr>
                    <tr>
                        <td class="total">المتبقي</td>
                        <td class="total" style="color: ${data.amount - data.paid_amount > 0 ? '#f44336' : '#4caf50'};">
                            ${(data.amount - data.paid_amount).toFixed(2)} جنيه
                        </td>
                    </tr>
                </table>
                
                <div style="margin-top: 40px; text-align: center;">
                    <p>شكراً لتعاملكم معنا</p>
                </div>
                
                <script>
                    window.print();
                    window.onafterprint = function() { window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();

    } catch (error) {
        console.error('خطأ في طباعة الفاتورة:', error);
        alert('حدث خطأ في طباعة الفاتورة');
    }
}

// ===================================
// إدارة المصروفات العامة
// ===================================

async function loadGeneralExpenses() {
    try {
        const { data, error } = await supabase
            .from('general_expenses')
            .select('*')
            .order('expense_date', { ascending: false })
            .limit(100);

        if (error) throw error;

        const tbody = document.getElementById('expensesBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">لا توجد مصروفات</td></tr>';
            return;
        }

        const expenseTypeNames = {
            'electricity': '⚡ كهرباء',
            'water': '💧 مياه',
            'internet': '🌐 إنترنت',
            'gas': '🔥 غاز',
            'rent': '🏠 إيجار',
            'maintenance': '🔧 صيانة',
            'other': '📌 أخرى'
        };

        tbody.innerHTML = data.map(exp => `
            <tr>
                <td>${expenseTypeNames[exp.expense_type] || exp.expense_type}</td>
                <td>${new Date(exp.expense_date).toLocaleDateString('ar-EG')}</td>
                <td style="font-weight: bold;">${exp.amount.toFixed(2)} جنيه</td>
                <td>${exp.paid_to || '-'}</td>
                <td>${exp.description || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="printExpense(${exp.id})">طباعة</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteExpense(${exp.id})">حذف</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('خطأ في تحميل المصروفات:', error);
    }
}

async function saveExpense(event) {
    event.preventDefault();

    const expenseData = {
        expense_type: document.getElementById('expenseType').value,
        expense_date: document.getElementById('expenseDate').value,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        paid_to: document.getElementById('expensePaidTo').value,
        description: document.getElementById('expenseDescription').value
    };

    try {
        const { data, error } = await supabase
            .from('general_expenses')
            .insert([expenseData])
            .select();

        if (error) throw error;

        alert('✅ تم إضافة المصروف بنجاح!');
        closeModal('addExpenseModal');
        loadGeneralExpenses();
        
        // طباعة إيصال
        if (data && data[0]) {
            printExpense(data[0].id);
        }

    } catch (error) {
        console.error('خطأ في حفظ المصروف:', error);
        alert('حدث خطأ في حفظ المصروف');
    }
}

async function deleteExpense(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
        const { error } = await supabase
            .from('general_expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ تم حذف المصروف بنجاح!');
        loadGeneralExpenses();

    } catch (error) {
        console.error('خطأ في حذف المصروف:', error);
    }
}

async function printExpense(id) {
    try {
        const { data, error } = await supabase
            .from('general_expenses')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const expenseTypeNames = {
            'electricity': '⚡ كهرباء',
            'water': '💧 مياه',
            'internet': '🌐 إنترنت',
            'gas': '🔥 غاز',
            'rent': '🏠 إيجار',
            'maintenance': '🔧 صيانة',
            'other': '📌 أخرى'
        };

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>إيصال مصروف #${id}</title>
                <style>
                    body { font-family: Arial; padding: 20px; max-width: 400px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #333; padding-bottom: 10px; }
                    .row { display: flex; justify-content: space-between; margin: 10px 0; }
                    .total { font-size: 20px; font-weight: bold; margin-top: 20px; padding-top: 10px; border-top: 2px solid #333; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>🧾 إيصال صرف</h2>
                    <p>رقم: ${id}</p>
                    <p>${new Date(data.expense_date).toLocaleDateString('ar-EG')}</p>
                </div>
                
                <div class="row">
                    <strong>نوع المصروف:</strong>
                    <span>${expenseTypeNames[data.expense_type]}</span>
                </div>
                
                <div class="row">
                    <strong>المدفوع إلى:</strong>
                    <span>${data.paid_to || '-'}</span>
                </div>
                
                <div class="row">
                    <strong>الوصف:</strong>
                    <span>${data.description || '-'}</span>
                </div>
                
                <div class="total">
                    <div class="row">
                        <strong>المبلغ:</strong>
                        <span>${data.amount.toFixed(2)} جنيه</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #666;">
                    <p>التوقيع: __________________</p>
                    <p>شكراً لكم</p>
                </div>
                
                <script>
                    window.print();
                    window.onafterprint = function() { window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();

    } catch (error) {
        console.error('خطأ في طباعة الإيصال:', error);
    }
}

console.log('✅ HR Management System loaded');
// ===================================
// تصدير التقارير إلى Excel (ذكي مع حسابات)
// ===================================

async function exportSalesExcel() {
    const fromDate = document.getElementById('sales-export-from').value;
    const toDate = document.getElementById('sales-export-to').value;

    if (!fromDate || !toDate) {
        alert('يرجى اختيار الفترة الزمنية');
        return;
    }

    try {
        // تحميل الطلبات
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    quantity,
                    price,
                    menu_items (name_ar)
                )
            `)
            .gte('created_at', fromDate)
            .lte('created_at', toDate + 'T23:59:59')
            .eq('status', 'completed');

        if (error) throw error;

        // تحضير البيانات
        const salesData = [];
        let totalRevenue = 0;
        let totalCost = 0;

        orders.forEach(order => {
            order.order_items.forEach(item => {
                const itemTotal = item.quantity * item.price;
                totalRevenue += itemTotal;
                
                salesData.push({
                    'رقم الطلب': order.id,
                    'التاريخ': new Date(order.created_at).toLocaleDateString('ar-EG'),
                    'الوقت': new Date(order.created_at).toLocaleTimeString('ar-EG'),
                    'الصنف': item.menu_items.name_ar,
                    'الكمية': item.quantity,
                    'السعر': item.price.toFixed(2),
                    'الإجمالي': itemTotal.toFixed(2),
                    'النوع': order.order_type === 'dine_in' ? 'داخلي' : 'توصيل',
                    'الحالة': 'مكتمل'
                });
            });
        });

        // حساب التكاليف (تقديري)
        totalCost = totalRevenue * 0.35; // نسبة التكلفة 35%
        const netProfit = totalRevenue - totalCost;

        // إضافة صف الملخص
        salesData.push({});
        salesData.push({
            'رقم الطلب': '',
            'التاريخ': '',
            'الوقت': '',
            'الصنف': 'الملخص المالي',
            'الكمية': '',
            'السعر': '',
            'الإجمالي': '',
            'النوع': '',
            'الحالة': ''
        });
        salesData.push({
            'رقم الطلب': '',
            'التاريخ': '',
            'الوقت': '',
            'الصنف': 'إجمالي المبيعات',
            'الكمية': '',
            'السعر': '',
            'الإجمالي': totalRevenue.toFixed(2) + ' جنيه',
            'النوع': '',
            'الحالة': ''
        });
        salesData.push({
            'رقم الطلب': '',
            'التاريخ': '',
            'الوقت': '',
            'الصنف': 'التكاليف (تقديري)',
            'الكمية': '',
            'السعر': '',
            'الإجمالي': totalCost.toFixed(2) + ' جنيه',
            'النوع': '',
            'الحالة': ''
        });
        salesData.push({
            'رقم الطلب': '',
            'التاريخ': '',
            'الوقت': '',
            'الصنف': 'صافي الربح',
            'الكمية': '',
            'السعر': '',
            'الإجمالي': netProfit.toFixed(2) + ' جنيه',
            'النوع': '',
            'الحالة': ''
        });

        // إنشاء ملف Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(salesData);

        // تنسيق العرض
        ws['!cols'] = [
            { wch: 10 }, // رقم الطلب
            { wch: 12 }, // التاريخ
            { wch: 10 }, // الوقت
            { wch: 25 }, // الصنف
            { wch: 8 },  // الكمية
            { wch: 10 }, // السعر
            { wch: 12 }, // الإجمالي
            { wch: 10 }, // النوع
            { wch: 10 }  // الحالة
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'تقرير المبيعات');
        XLSX.writeFile(wb, `تقرير_المبيعات_${fromDate}_${toDate}.xlsx`);

        alert('✅ تم تصدير التقرير بنجاح!');

    } catch (error) {
        console.error('خطأ في تصدير المبيعات:', error);
        alert('حدث خطأ في تصدير التقرير');
    }
}

async function exportSalariesExcel() {
    const fromDate = document.getElementById('salary-export-from').value;
    const toDate = document.getElementById('salary-export-to').value;

    if (!fromDate || !toDate) {
        alert('يرجى اختيار الفترة الزمنية');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('employee_attendance')
            .select(`
                *,
                employees (name, position, daily_salary)
            `)
            .gte('date', fromDate)
            .lte('date', toDate);

        if (error) throw error;

        // تجميع البيانات حسب الموظف
        const salaryMap = {};
        
        data.forEach(record => {
            const empId = record.employee_id;
            if (!salaryMap[empId]) {
                salaryMap[empId] = {
                    'اسم الموظف': record.employees.name,
                    'الوظيفة': record.employees.position,
                    'الراتب اليومي': record.employees.daily_salary,
                    'أيام الحضور': 0,
                    'أيام الغياب': 0,
                    'نصف يوم': 0,
                    'إجمالي المستحق': 0
                };
            }

            if (record.status === 'present') salaryMap[empId]['أيام الحضور']++;
            else if (record.status === 'absent') salaryMap[empId]['أيام الغياب']++;
            else if (record.status === 'half_day') salaryMap[empId]['نصف يوم']++;

            salaryMap[empId]['إجمالي المستحق'] += parseFloat(record.salary_paid || 0);
        });

        const salaryData = Object.values(salaryMap);
        const totalSalaries = salaryData.reduce((sum, emp) => sum + emp['إجمالي المستحق'], 0);

        // إضافة صف الإجمالي
        salaryData.push({});
        salaryData.push({
            'اسم الموظف': 'الإجمالي الكلي',
            'الوظيفة': '',
            'الراتب اليومي': '',
            'أيام الحضور': '',
            'أيام الغياب': '',
            'نصف يوم': '',
            'إجمالي المستحق': totalSalaries.toFixed(2) + ' جنيه'
        });

        // إنشاء Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(salaryData);

        ws['!cols'] = [
            { wch: 20 }, // اسم الموظف
            { wch: 15 }, // الوظيفة
            { wch: 12 }, // الراتب اليومي
            { wch: 12 }, // أيام الحضور
            { wch: 12 }, // أيام الغياب
            { wch: 10 }, // نصف يوم
            { wch: 15 }  // إجمالي المستحق
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'تقرير الرواتب');
        XLSX.writeFile(wb, `تقرير_الرواتب_${fromDate}_${toDate}.xlsx`);

        alert('✅ تم تصدير التقرير بنجاح!');

    } catch (error) {
        console.error('خطأ في تصدير الرواتب:', error);
        alert('حدث خطأ في تصدير التقرير');
    }
}

async function exportExpensesExcel() {
    const fromDate = document.getElementById('expense-export-from').value;
    const toDate = document.getElementById('expense-export-to').value;

    if (!fromDate || !toDate) {
        alert('يرجى اختيار الفترة الزمنية');
        return;
    }

    try {
        // تحميل المصروفات العامة
        const { data: expenses, error: expError } = await supabase
            .from('general_expenses')
            .select('*')
            .gte('expense_date', fromDate)
            .lte('expense_date', toDate);

        if (expError) throw expError;

        // تحميل فواتير الموردين
        const { data: invoices, error: invError } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                suppliers (name)
            `)
            .gte('invoice_date', fromDate)
            .lte('invoice_date', toDate);

        if (invError) throw invError;

        const expenseTypeNames = {
            'electricity': '⚡ كهرباء',
            'water': '💧 مياه',
            'internet': '🌐 إنترنت',
            'gas': '🔥 غاز',
            'rent': '🏠 إيجار',
            'maintenance': '🔧 صيانة',
            'other': '📌 أخرى'
        };

        // دمج البيانات
        const allExpenses = [];
        let totalGeneral = 0;
        let totalInvoices = 0;

        expenses.forEach(exp => {
            totalGeneral += exp.amount;
            allExpenses.push({
                'النوع': 'مصروف عام',
                'التصنيف': expenseTypeNames[exp.expense_type] || exp.expense_type,
                'التاريخ': new Date(exp.expense_date).toLocaleDateString('ar-EG'),
                'المبلغ': exp.amount.toFixed(2),
                'المدفوع إلى': exp.paid_to || '-',
                'الوصف': exp.description || '-'
            });
        });

        invoices.forEach(inv => {
            totalInvoices += inv.amount;
            allExpenses.push({
                'النوع': 'فاتورة مورد',
                'التصنيف': inv.suppliers?.name || 'غير محدد',
                'التاريخ': new Date(inv.invoice_date).toLocaleDateString('ar-EG'),
                'المبلغ': inv.amount.toFixed(2),
                'المدفوع إلى': inv.suppliers?.name || '-',
                'الوصف': inv.description || '-'
            });
        });

        const totalExpenses = totalGeneral + totalInvoices;

        // إضافة الملخص
        allExpenses.push({});
        allExpenses.push({
            'النوع': 'الملخص',
            'التصنيف': '',
            'التاريخ': '',
            'المبلغ': '',
            'المدفوع إلى': '',
            'الوصف': ''
        });
        allExpenses.push({
            'النوع': 'المصروفات العامة',
            'التصنيف': '',
            'التاريخ': '',
            'المبلغ': totalGeneral.toFixed(2) + ' جنيه',
            'المدفوع إلى': '',
            'الوصف': ''
        });
        allExpenses.push({
            'النوع': 'فواتير الموردين',
            'التصنيف': '',
            'التاريخ': '',
            'المبلغ': totalInvoices.toFixed(2) + ' جنيه',
            'المدفوع إلى': '',
            'الوصف': ''
        });
        allExpenses.push({
            'النوع': 'الإجمالي الكلي',
            'التصنيف': '',
            'التاريخ': '',
            'المبلغ': totalExpenses.toFixed(2) + ' جنيه',
            'المدفوع إلى': '',
            'الوصف': ''
        });

        // إنشاء Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(allExpenses);

        ws['!cols'] = [
            { wch: 15 }, // النوع
            { wch: 20 }, // التصنيف
            { wch: 12 }, // التاريخ
            { wch: 12 }, // المبلغ
            { wch: 20 }, // المدفوع إلى
            { wch: 30 }  // الوصف
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'تقرير المصروفات');
        XLSX.writeFile(wb, `تقرير_المصروفات_${fromDate}_${toDate}.xlsx`);

        alert('✅ تم تصدير التقرير بنجاح!');

    } catch (error) {
        console.error('خطأ في تصدير المصروفات:', error);
        alert('حدث خطأ في تصدير التقرير');
    }
}

async function exportFullFinancialReport() {
    const fromDate = document.getElementById('full-export-from').value;
    const toDate = document.getElementById('full-export-to').value;

    if (!fromDate || !toDate) {
        alert('يرجى اختيار الفترة الزمنية');
        return;
    }

    try {
        // 1. المبيعات
        const { data: orders } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .gte('created_at', fromDate)
            .lte('created_at', toDate + 'T23:59:59')
            .eq('status', 'completed');

        let totalRevenue = 0;
        orders.forEach(order => {
            order.order_items.forEach(item => {
                totalRevenue += item.quantity * item.price;
            });
        });

        // 2. الرواتب
        const { data: salaries } = await supabase
            .from('employee_attendance')
            .select('salary_paid')
            .gte('date', fromDate)
            .lte('date', toDate);

        const totalSalaries = salaries.reduce((sum, s) => sum + parseFloat(s.salary_paid || 0), 0);

        // 3. المصروفات
        const { data: expenses } = await supabase
            .from('general_expenses')
            .select('amount')
            .gte('expense_date', fromDate)
            .lte('expense_date', toDate);

        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        // 4. فواتير الموردين
        const { data: invoices } = await supabase
            .from('supplier_invoices')
            .select('amount')
            .gte('invoice_date', fromDate)
            .lte('invoice_date', toDate);

        const totalInvoices = invoices.reduce((sum, i) => sum + i.amount, 0);

        // الحسابات النهائية
        const totalCosts = totalSalaries + totalExpenses + totalInvoices;
        const netProfit = totalRevenue - totalCosts;
        const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

        // إنشاء التقرير الشامل
        const financialData = [
            { 'البيان': 'الفترة من', 'القيمة': fromDate },
            { 'البيان': 'الفترة إلى', 'القيمة': toDate },
            {},
            { 'البيان': '📊 الإيرادات', 'القيمة': '' },
            { 'البيان': 'إجمالي المبيعات', 'القيمة': totalRevenue.toFixed(2) + ' جنيه' },
            {},
            { 'البيان': '💰 المصروفات', 'القيمة': '' },
            { 'البيان': 'رواتب الموظفين', 'القيمة': totalSalaries.toFixed(2) + ' جنيه' },
            { 'البيان': 'المصروفات العامة', 'القيمة': totalExpenses.toFixed(2) + ' جنيه' },
            { 'البيان': 'فواتير الموردين', 'القيمة': totalInvoices.toFixed(2) + ' جنيه' },
            { 'البيان': 'إجمالي المصروفات', 'القيمة': totalCosts.toFixed(2) + ' جنيه' },
            {},
            { 'البيان': '💵 النتيجة النهائية', 'القيمة': '' },
            { 'البيان': 'صافي الربح', 'القيمة': netProfit.toFixed(2) + ' جنيه' },
            { 'البيان': 'هامش الربح', 'القيمة': profitMargin + '%' },
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(financialData);

        ws['!cols'] = [
            { wch: 25 }, // البيان
            { wch: 20 }  // القيمة
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'التقرير المالي الشامل');
        XLSX.writeFile(wb, `التقرير_المالي_الشامل_${fromDate}_${toDate}.xlsx`);

        alert(`✅ تم تصدير التقرير الشامل بنجاح!\n\n📊 ملخص:\n• المبيعات: ${totalRevenue.toFixed(2)} جنيه\n• المصروفات: ${totalCosts.toFixed(2)} جنيه\n• صافي الربح: ${netProfit.toFixed(2)} جنيه\n• هامش الربح: ${profitMargin}%`);

    } catch (error) {
        console.error('خطأ في تصدير التقرير الشامل:', error);
        alert('حدث خطأ في تصدير التقرير الشامل');
    }
}

console.log('✅ Excel Export System loaded');


