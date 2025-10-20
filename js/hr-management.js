// ========================================
// نظام إدارة الموظفين والمصروفات والموردين
// hr-management.js - النسخة المحدّثة
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
    
    const displayElement = document.getElementById('attendance-date-display');
    if (displayElement) {
        displayElement.textContent = new Date(selectedDate).toLocaleDateString('ar-EG');
    }

    try {
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('status', 'active');

        if (empError) throw empError;

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
        if (!listDiv) return;

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

        await supabase
            .from('employee_attendance')
            .delete()
            .eq('date', selectedDate);

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
// إدارة الموردين (محدّث)
// ===================================

async function loadSuppliers() {
    try {
        const { data: suppliers, error: supError } = await supabase
            .from('suppliers')
            .select('*')
            .order('created_at', { ascending: false });

        if (supError) throw supError;

        const { data: invoices, error: invError } = await supabase
            .from('supplier_invoices')
            .select('supplier_id, amount, paid_amount');

        if (invError) throw invError;

        const supplierStats = {};
        suppliers.forEach(sup => {
            supplierStats[sup.id] = {
                ...sup,
                totalInvoices: 0,
                totalPaid: 0,
                remaining: 0
            };
        });

        invoices.forEach(inv => {
            if (supplierStats[inv.supplier_id]) {
                supplierStats[inv.supplier_id].totalInvoices += parseFloat(inv.amount);
                supplierStats[inv.supplier_id].totalPaid += parseFloat(inv.paid_amount);
            }
        });

        Object.values(supplierStats).forEach(sup => {
            sup.remaining = sup.totalInvoices - sup.totalPaid;
        });

        const tbody = document.getElementById('suppliersBody');
        if (!tbody) return;

        if (suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">لا يوجد موردين</td></tr>';
            return;
        }

        tbody.innerHTML = Object.values(supplierStats).map(sup => `
            <tr>
                <td><strong>${sup.name}</strong></td>
                <td>${sup.phone || '-'}</td>
                <td>${sup.category || '-'}</td>
                <td>${sup.totalInvoices.toFixed(2)} جنيه</td>
                <td style="color: #4caf50;">${sup.totalPaid.toFixed(2)} جنيه</td>
                <td style="color: ${sup.remaining > 0 ? '#f44336' : '#4caf50'}; font-weight: bold;">
                    ${sup.remaining.toFixed(2)} جنيه
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewSupplierDetails(${sup.id})">التفاصيل</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${sup.id})">حذف</button>
                </td>
            </tr>
        `).join('');

        const filterSelect = document.getElementById('filterSupplier');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">جميع الموردين</option>' +
                suppliers.map(sup => `<option value="${sup.id}">${sup.name}</option>`).join('');
        }

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

async function viewSupplierDetails(supplierId) {
    try {
        const { data: supplier, error: supError } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', supplierId)
            .single();

        if (supError) throw supError;

        const { data: invoices, error: invError } = await supabase
            .from('supplier_invoices')
            .select('*')
            .eq('supplier_id', supplierId)
            .order('invoice_date', { ascending: false });

        if (invError) throw invError;

        const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount), 0);
        const remaining = totalAmount - totalPaid;

        alert(`📊 تفاصيل المورد: ${supplier.name}\n\n` +
              `إجمالي الفواتير: ${totalAmount.toFixed(2)} جنيه\n` +
              `المدفوع: ${totalPaid.toFixed(2)} جنيه\n` +
              `المتبقي: ${remaining.toFixed(2)} جنيه\n` +
              `عدد الفواتير: ${invoices.length}`);

    } catch (error) {
        console.error('خطأ في عرض التفاصيل:', error);
    }
}

// ===================================
// إدارة الفواتير (محدّث مع حسابات ذكية)
// ===================================

async function loadInvoices() {
    try {
        let query = supabase
            .from('supplier_invoices')
            .select(`
                *,
                suppliers (name, phone)
            `)
            .order('invoice_date', { ascending: false });

        const filterSupplier = document.getElementById('filterSupplier');
        if (filterSupplier && filterSupplier.value) {
            query = query.eq('supplier_id', filterSupplier.value);
        }

        const filterStatus = document.getElementById('filterInvoiceStatus');
        if (filterStatus && filterStatus.value) {
            query = query.eq('status', filterStatus.value);
        }

        const { data, error } = await query;
        if (error) throw error;

        const tbody = document.getElementById('invoicesBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">لا توجد فواتير</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(inv => {
            const remaining = inv.amount - inv.paid_amount;
            const statusBadge = {
                'paid': '<span class="badge badge-success">✅ مدفوعة</span>',
                'partial': '<span class="badge badge-warning">⏳ جزئي</span>',
                'pending': '<span class="badge badge-danger">⏰ معلقة</span>'
            };

            return `
                <tr>
                    <td><strong>#${inv.invoice_number || inv.id}</strong></td>
                    <td>${inv.suppliers?.name || 'غير محدد'}</td>
                    <td>${new Date(inv.invoice_date).toLocaleDateString('ar-EG')}</td>
                    <td style="font-weight: bold;">${inv.amount.toFixed(2)} جنيه</td>
                    <td style="color: #4caf50;">${inv.paid_amount.toFixed(2)} جنيه</td>
                    <td style="color: ${remaining > 0 ? '#f44336' : '#4caf50'}; font-weight: bold;">
                        ${remaining.toFixed(2)} جنيه
                    </td>
                    <td>${statusBadge[inv.status]}</td>
                    <td>
                        ${remaining > 0 ? `<button class="btn btn-sm btn-success" onclick="openPaymentModal(${inv.id})">💰 دفع</button>` : ''}
                        <button class="btn btn-sm btn-info" onclick="viewInvoiceDetails(${inv.id})">عرض</button>
                        <button class="btn btn-sm" onclick="printInvoice(${inv.id})">🖨️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${inv.id})">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('خطأ في تحميل الفواتير:', error);
    }
}

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
// نظام الدفعات الذكي
// ===================================

async function openPaymentModal(invoiceId) {
    try {
        const { data: invoice, error } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                suppliers (name, phone)
            `)
            .eq('id', invoiceId)
            .single();

        if (error) throw error;

        const remaining = invoice.amount - invoice.paid_amount;

        document.getElementById('paymentInvoiceDetails').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div>
                    <strong>المورد:</strong> ${invoice.suppliers.name}
                </div>
                <div>
                    <strong>رقم الفاتورة:</strong> #${invoice.invoice_number || invoice.id}
                </div>
                <div>
                    <strong>المبلغ الكلي:</strong> ${invoice.amount.toFixed(2)} جنيه
                </div>
                <div>
                    <strong>المدفوع:</strong> <span style="color: #4caf50;">${invoice.paid_amount.toFixed(2)} جنيه</span>
                </div>
                <div style="grid-column: 1 / -1;">
                    <strong>المتبقي:</strong> <span style="color: #f44336; font-size: 20px; font-weight: bold;">${remaining.toFixed(2)} جنيه</span>
                </div>
            </div>
        `;

        document.getElementById('paymentInvoiceId').value = invoice.id;
        document.getElementById('paymentSupplierId').value = invoice.supplier_id;
        document.getElementById('paymentAmount').value = remaining.toFixed(2);
        document.getElementById('paymentAmount').max = remaining.toFixed(2);
        document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('remainingAmount').textContent = `المتبقي: ${remaining.toFixed(2)} جنيه`;

        document.getElementById('addPaymentModal').style.display = 'flex';

    } catch (error) {
        console.error('خطأ في فتح نافذة الدفع:', error);
        alert('حدث خطأ في تحميل بيانات الفاتورة');
    }
}

async function savePayment(event) {
    event.preventDefault();

    const paymentData = {
        invoice_id: parseInt(document.getElementById('paymentInvoiceId').value),
        supplier_id: parseInt(document.getElementById('paymentSupplierId').value),
        payment_amount: parseFloat(document.getElementById('paymentAmount').value),
        payment_date: document.getElementById('paymentDate').value,
        payment_method: document.getElementById('paymentMethod').value,
        receipt_number: document.getElementById('paymentReceiptNumber').value,
        notes: document.getElementById('paymentNotes').value
    };

    try {
        const { data, error } = await supabase
            .from('supplier_payments')
            .insert([paymentData])
            .select();

        if (error) throw error;

        alert('✅ تم تسجيل الدفعة بنجاح!');
        closeModal('addPaymentModal');
        loadInvoices();
        loadPayments();
        loadSuppliersBalance();

        if (data && data[0]) {
            printPaymentReceipt(data[0].id);
        }

    } catch (error) {
        console.error('خطأ في حفظ الدفعة:', error);
        alert('حدث خطأ في تسجيل الدفعة');
    }
}

async function loadPayments() {
    const fromDate = document.getElementById('paymentsFromDate').value;
    const toDate = document.getElementById('paymentsToDate').value;

    if (!fromDate || !toDate) {
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        document.getElementById('paymentsFromDate').value = monthAgo.toISOString().split('T')[0];
        document.getElementById('paymentsToDate').value = today.toISOString().split('T')[0];
        return;
    }

    try {
        const { data, error } = await supabase
            .from('supplier_payments')
            .select(`
                *,
                suppliers (name),
                supplier_invoices (invoice_number)
            `)
            .gte('payment_date', fromDate)
            .lte('payment_date', toDate)
            .order('payment_date', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('paymentsBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">لا توجد دفعات في هذه الفترة</td></tr>';
            return;
        }

        const paymentMethods = {
            'cash': '💵 نقدي',
            'bank_transfer': '🏦 تحويل بنكي',
            'check': '📝 شيك',
            'credit': '💳 آجل'
        };

        tbody.innerHTML = data.map(payment => `
            <tr>
                <td>${new Date(payment.payment_date).toLocaleDateString('ar-EG')}</td>
                <td>${payment.suppliers?.name || 'غير محدد'}</td>
                <td>#${payment.supplier_invoices?.invoice_number || payment.invoice_id}</td>
                <td style="font-weight: bold; color: #4caf50;">${payment.payment_amount.toFixed(2)} جنيه</td>
                <td>${paymentMethods[payment.payment_method] || payment.payment_method}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="printPaymentReceipt(${payment.id})">🖨️ طباعة</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePayment(${payment.id})">حذف</button>
                </td>
            </tr>
        `).join('');

        const total = data.reduce((sum, p) => sum + parseFloat(p.payment_amount), 0);
        tbody.innerHTML += `
            <tr style="background: #f0f0f0; font-weight: bold;">
                <td colspan="3">الإجمالي</td>
                <td style="color: #4caf50; font-size: 18px;">${total.toFixed(2)} جنيه</td>
                <td colspan="2"></td>
            </tr>
        `;

    } catch (error) {
        console.error('خطأ في تحميل الدفعات:', error);
    }
}

async function deletePayment(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟ سيتم تحديث رصيد الفاتورة تلقائياً.')) return;

    try {
        const { error } = await supabase
            .from('supplier_payments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ تم حذف الدفعة بنجاح!');
        loadPayments();
        loadInvoices();

    } catch (error) {
        console.error('خطأ في حذف الدفعة:', error);
        alert('حدث خطأ في حذف الدفعة');
    }
}
// ===================================
// عرض أرصدة الموردين
// ===================================

async function loadSuppliersBalance() {
    try {
        const { data: suppliers, error: supError } = await supabase
            .from('suppliers')
            .select('*')
            .order('name');

        if (supError) throw supError;

        const { data: invoices, error: invError } = await supabase
            .from('supplier_invoices')
            .select('supplier_id, amount, paid_amount, status');

        if (invError) throw invError;

        const balances = {};
        suppliers.forEach(sup => {
            balances[sup.id] = {
                name: sup.name,
                phone: sup.phone,
                totalInvoices: 0,
                totalPaid: 0,
                remaining: 0,
                pendingCount: 0
            };
        });

        invoices.forEach(inv => {
            if (balances[inv.supplier_id]) {
                balances[inv.supplier_id].totalInvoices += parseFloat(inv.amount);
                balances[inv.supplier_id].totalPaid += parseFloat(inv.paid_amount);
                if (inv.status !== 'paid') {
                    balances[inv.supplier_id].pendingCount++;
                }
            }
        });

        Object.values(balances).forEach(bal => {
            bal.remaining = bal.totalInvoices - bal.totalPaid;
        });

        const sortedBalances = Object.values(balances)
            .filter(b => b.remaining > 0)
            .sort((a, b) => b.remaining - a.remaining);

        const listDiv = document.getElementById('suppliersBalanceList');
        if (!listDiv) return;

        if (sortedBalances.length === 0) {
            listDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">✅ جميع الفواتير مدفوعة!</div>';
            return;
        }

        const totalRemaining = sortedBalances.reduce((sum, b) => sum + b.remaining, 0);

        listDiv.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <div style="font-size: 16px; margin-bottom: 10px;">إجمالي المستحقات للموردين</div>
                <div style="font-size: 36px; font-weight: bold;">${totalRemaining.toFixed(2)} جنيه</div>
                <div style="font-size: 14px; margin-top: 10px; opacity: 0.9;">عدد الفواتير المعلقة: ${sortedBalances.reduce((sum, b) => sum + b.pendingCount, 0)}</div>
            </div>
            
            <div style="display: grid; gap: 15px;">
                ${sortedBalances.map(bal => `
                    <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-right: 4px solid ${bal.remaining > 1000 ? '#f44336' : '#ff9800'};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${bal.name}</div>
                                <div style="font-size: 14px; color: #666;">${bal.phone || 'لا يوجد رقم'}</div>
                            </div>
                            <div style="text-align: left;">
                                <div style="font-size: 24px; font-weight: bold; color: #f44336;">${bal.remaining.toFixed(2)} جنيه</div>
                                <div style="font-size: 12px; color: #666;">${bal.pendingCount} فاتورة معلقة</div>
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd; display: flex; justify-content: space-between; font-size: 14px;">
                            <div>إجمالي الفواتير: <strong>${bal.totalInvoices.toFixed(2)}</strong> جنيه</div>
                            <div>المدفوع: <strong style="color: #4caf50;">${bal.totalPaid.toFixed(2)}</strong> جنيه</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (error) {
        console.error('خطأ في تحميل الأرصدة:', error);
    }
}

// ===================================
// طباعة إيصال الدفع
// ===================================

async function printPaymentReceipt(paymentId) {
    try {
        const { data, error } = await supabase
            .from('supplier_payments')
            .select(`
                *,
                suppliers (name, phone, address),
                supplier_invoices (invoice_number, amount)
            `)
            .eq('id', paymentId)
            .single();

        if (error) throw error;

        const paymentMethods = {
            'cash': '💵 نقدي',
            'bank_transfer': '🏦 تحويل بنكي',
            'check': '📝 شيك',
            'credit': '💳 آجل'
        };

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>إيصال دفع #${paymentId}</title>
                <style>
                    body { font-family: Arial; padding: 20px; max-width: 400px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #333; padding-bottom: 15px; }
                    .row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px; background: #f9f9f9; border-radius: 4px; }
                    .amount { font-size: 24px; font-weight: bold; margin: 20px 0; padding: 15px; background: #4caf50; color: white; text-align: center; border-radius: 8px; }
                    .footer { margin-top: 30px; padding-top: 15px; border-top: 2px dashed #333; text-align: center; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>🧾 إيصال دفع</h2>
                    <p>رقم: ${paymentId}</p>
                    <p>${new Date(data.payment_date).toLocaleDateString('ar-EG')}</p>
                </div>
                
                <div class="row">
                    <strong>المورد:</strong>
                    <span>${data.suppliers?.name || 'غير محدد'}</span>
                </div>
                
                <div class="row">
                    <strong>رقم الفاتورة:</strong>
                    <span>#${data.supplier_invoices?.invoice_number || data.invoice_id}</span>
                </div>
                
                <div class="row">
                    <strong>طريقة الدفع:</strong>
                    <span>${paymentMethods[data.payment_method]}</span>
                </div>
                
                ${data.receipt_number ? `
                <div class="row">
                    <strong>رقم الإيصال:</strong>
                    <span>${data.receipt_number}</span>
                </div>
                ` : ''}
                
                <div class="amount">
                    المبلغ المدفوع: ${data.payment_amount.toFixed(2)} جنيه
                </div>
                
                ${data.notes ? `
                <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin: 15px 0;">
                    <strong>ملاحظات:</strong>
                    <p style="margin: 5px 0 0 0;">${data.notes}</p>
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>التوقيع: __________________</p>
                    <p>شكراً لتعاملكم معنا</p>
                    <p style="margin-top: 10px; font-size: 10px;">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
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
        alert('حدث خطأ في طباعة الإيصال');
    }
}

// ===================================
// عرض تفاصيل الفاتورة مع سجل الدفعات
// ===================================

async function viewInvoiceDetails(invoiceId) {
    try {
        const { data: invoice, error: invError } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                suppliers (name, phone, address)
            `)
            .eq('id', invoiceId)
            .single();

        if (invError) throw invError;

        const { data: payments, error: payError } = await supabase
            .from('supplier_payments')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('payment_date', { ascending: false });

        if (payError) throw payError;

        const remaining = invoice.amount - invoice.paid_amount;

        const detailsWindow = window.open('', '_blank', 'width=800,height=600');
        detailsWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>تفاصيل الفاتورة #${invoice.invoice_number || invoiceId}</title>
                <style>
                    body { font-family: Arial; padding: 30px; background: #f5f5f5; }
                    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #667eea; }
                    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; }
                    .info-item { background: #f9f9f9; padding: 15px; border-radius: 8px; }
                    .info-item strong { color: #667eea; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
                    th { background: #667eea; color: white; }
                    .amount-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
                    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 5px; }
                    .btn-print { background: #4caf50; color: white; }
                    .btn-close { background: #f44336; color: white; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>تفاصيل الفاتورة #${invoice.invoice_number || invoiceId}</h1>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <strong>المورد:</strong><br>${invoice.suppliers?.name || 'غير محدد'}
                        </div>
                        <div class="info-item">
                            <strong>الهاتف:</strong><br>${invoice.suppliers?.phone || '-'}
                        </div>
                        <div class="info-item">
                            <strong>تاريخ الفاتورة:</strong><br>${new Date(invoice.invoice_date).toLocaleDateString('ar-EG')}
                        </div>
                        <div class="info-item">
                            <strong>الحالة:</strong><br>
                            ${invoice.status === 'paid' ? '✅ مدفوعة' : invoice.status === 'partial' ? '⏳ جزئي' : '⏰ معلقة'}
                        </div>
                    </div>
                    
                    ${invoice.description ? `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <strong>الوصف:</strong>
                        <p>${invoice.description}</p>
                    </div>
                    ` : ''}
                    
                    <div class="amount-box">
                        <div style="font-size: 14px; opacity: 0.9;">المبلغ الكلي</div>
                        <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${invoice.amount.toFixed(2)} جنيه</div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; font-size: 16px;">
                            <div>المدفوع: ${invoice.paid_amount.toFixed(2)} جنيه</div>
                            <div>المتبقي: ${remaining.toFixed(2)} جنيه</div>
                        </div>
                    </div>
                    
                    <h3>سجل الدفعات</h3>
                    ${payments.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>التاريخ</th>
                                    <th>المبلغ</th>
                                    <th>طريقة الدفع</th>
                                    <th>الإيصال</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments.map(p => `
                                    <tr>
                                        <td>${new Date(p.payment_date).toLocaleDateString('ar-EG')}</td>
                                        <td style="font-weight: bold; color: #4caf50;">${p.payment_amount.toFixed(2)} جنيه</td>
                                        <td>${p.payment_method}</td>
                                        <td>${p.receipt_number || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p style="text-align: center; color: #999; padding: 20px;">لا توجد دفعات مسجلة</p>'}
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <button class="btn btn-print" onclick="window.print()">🖨️ طباعة</button>
                        <button class="btn btn-close" onclick="window.close()">إغلاق</button>
                    </div>
                </div>
            </body>
            </html>
        `);
        detailsWindow.document.close();

    } catch (error) {
        console.error('خطأ في عرض التفاصيل:', error);
        alert('حدث خطأ في عرض التفاصيل');
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
                    <button class="btn btn-sm btn-info" onclick="printExpense(${exp.id})">🖨️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteExpense(${exp.id})">حذف</button>
                </td>
            </tr>
        `).join('');

        // حساب الإجماليات حسب النوع
        const totals = {
            electricity: 0,
            water: 0,
            internet: 0,
            gas: 0,
            rent: 0
        };

        data.forEach(exp => {
            if (totals.hasOwnProperty(exp.expense_type)) {
                totals[exp.expense_type] += parseFloat(exp.amount);
            }
        });

        const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

        document.getElementById('electricityTotal').textContent = totals.electricity.toFixed(2) + ' جنيه';
        document.getElementById('waterTotal').textContent = totals.water.toFixed(2) + ' جنيه';
        document.getElementById('internetTotal').textContent = totals.internet.toFixed(2) + ' جنيه';
        document.getElementById('gasTotal').textContent = totals.gas.toFixed(2) + ' جنيه';
        document.getElementById('rentTotal').textContent = totals.rent.toFixed(2) + ' جنيه';
        document.getElementById('expensesGrandTotal').textContent = grandTotal.toFixed(2) + ' جنيه';

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

// ===================================
// وظائف التبويبات الفرعية
// ===================================

function switchSupplierSubTab(tabName) {
    document.querySelectorAll('#suppliersTab .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('#suppliersTab .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + '-subtab').classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'list') loadSuppliers();
    else if (tabName === 'invoices') loadInvoices();
    else if (tabName === 'payments') {
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        document.getElementById('paymentsFromDate').value = monthAgo.toISOString().split('T')[0];
        document.getElementById('paymentsToDate').value = today.toISOString().split('T')[0];
        loadPayments();
    }
    else if (tabName === 'balance') loadSuppliersBalance();
}

console.log('✅ Complete HR & Suppliers Management System with Smart Payments loaded');
