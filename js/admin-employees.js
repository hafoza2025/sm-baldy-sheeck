// js/admin-employees.js
// نظام إدارة الموظفين والحضور والرواتب

const EmployeeManager = {
    employees: [],
    attendance: [],
    salaries: [],
    currentTab: 'list',

    async init() {
        console.log('✅ Employee Manager Initialized');
        await this.loadEmployees();
    },

    // التبديل بين التابات
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // إخفاء كل التابات
        document.querySelectorAll('#employees-section .tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        // إزالة active من كل الأزرار
        document.querySelectorAll('#employees-section .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // عرض التاب المطلوب
        const tabContent = document.getElementById(`employee-${tabName}-tab`);
        if (tabContent) {
            tabContent.style.display = 'block';
            event.target.classList.add('active');
        }
        
        // تحميل البيانات
        switch(tabName) {
            case 'list':
                this.loadEmployees();
                break;
            case 'attendance':
                this.loadAttendance();
                break;
            case 'salaries':
                this.loadSalaries();
                break;
        }
    },

    // تحميل الموظفين
    async loadEmployees() {
        try {
            const { data, error } = await Database.supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.employees = data || [];
            this.renderEmployees();
        } catch (error) {
            console.error('Error loading employees:', error);
            alert('حدث خطأ في تحميل الموظفين');
        }
    },

    // عرض الموظفين
    renderEmployees() {
        const tbody = document.getElementById('employeesTableBody');
        if (!tbody) return;

        if (this.employees.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" style="text-align:center; padding: 40px;">
                    لا يوجد موظفين حالياً
                </td></tr>
            `;
            return;
        }

        tbody.innerHTML = this.employees.map(emp => `
            <tr>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.job_title}</td>
                <td>${emp.phone || '-'}</td>
                <td>${emp.daily_salary.toFixed(2)} ج.م</td>
                <td>${new Date(emp.hire_date).toLocaleDateString('ar-EG')}</td>
                <td>
                    <span class="badge ${emp.status === 'active' ? 'badge-success' : 'badge-danger'}">
                        ${emp.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="EmployeeManager.editEmployee(${emp.id})" title="تعديل">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="EmployeeManager.deleteEmployee(${emp.id})" title="حذف">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // فلترة الموظفين
    filterEmployees() {
        const searchValue = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('employeeStatusFilter')?.value || '';

        const filtered = this.employees.filter(emp => {
            const matchSearch = emp.name.toLowerCase().includes(searchValue) || 
                              emp.job_title.toLowerCase().includes(searchValue);
            const matchStatus = !statusFilter || emp.status === statusFilter;
            return matchSearch && matchStatus;
        });

        const tbody = document.getElementById('employeesTableBody');
        if (!tbody) return;

        tbody.innerHTML = filtered.map(emp => `
            <tr>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.job_title}</td>
                <td>${emp.phone || '-'}</td>
                <td>${emp.daily_salary.toFixed(2)} ج.م</td>
                <td>${new Date(emp.hire_date).toLocaleDateString('ar-EG')}</td>
                <td>
                    <span class="badge ${emp.status === 'active' ? 'badge-success' : 'badge-danger'}">
                        ${emp.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="EmployeeManager.editEmployee(${emp.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="EmployeeManager.deleteEmployee(${emp.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    // عرض نافذة إضافة موظف
    showAddModal() {
        document.getElementById('employeeModalTitle').textContent = 'إضافة موظف جديد';
        document.getElementById('employeeForm').reset();
        document.getElementById('employeeId').value = '';
        document.getElementById('employeeHireDate').valueAsDate = new Date();
        document.getElementById('employeeStatus').value = 'active';
        document.getElementById('employeeModal').style.display = 'block';
    },

    // تعديل موظف
    editEmployee(id) {
        const employee = this.employees.find(e => e.id === id);
        if (!employee) return;

        document.getElementById('employeeModalTitle').textContent = 'تعديل بيانات الموظف';
        document.getElementById('employeeId').value = employee.id;
        document.getElementById('employeeName').value = employee.name;
        document.getElementById('employeePhone').value = employee.phone || '';
        document.getElementById('employeeNationalId').value = employee.national_id || '';
        document.getElementById('employeeJobTitle').value = employee.job_title;
        document.getElementById('employeeHireDate').value = employee.hire_date;
        document.getElementById('employeeDailySalary').value = employee.daily_salary;
        document.getElementById('employeeMonthlySalary').value = employee.monthly_salary || '';
        document.getElementById('employeeStatus').value = employee.status;
        document.getElementById('employeeNotes').value = employee.notes || '';
        document.getElementById('employeeModal').style.display = 'block';
    },

    // حفظ موظف
    async saveEmployee(event) {
        event.preventDefault();

        const employeeData = {
            name: document.getElementById('employeeName').value,
            phone: document.getElementById('employeePhone').value || null,
            national_id: document.getElementById('employeeNationalId').value || null,
            job_title: document.getElementById('employeeJobTitle').value,
            hire_date: document.getElementById('employeeHireDate').value,
            daily_salary: parseFloat(document.getElementById('employeeDailySalary').value),
            monthly_salary: parseFloat(document.getElementById('employeeMonthlySalary').value) || null,
            status: document.getElementById('employeeStatus').value,
            notes: document.getElementById('employeeNotes').value || null
        };

        const employeeId = document.getElementById('employeeId').value;

        try {
            if (employeeId) {
                // تحديث
                const { error } = await Database.supabase
                    .from('employees')
                    .update(employeeData)
                    .eq('id', employeeId);

                if (error) throw error;
                alert('✅ تم تحديث بيانات الموظف بنجاح');
            } else {
                // إضافة جديد
                const { error } = await Database.supabase
                    .from('employees')
                    .insert([employeeData]);

                if (error) throw error;
                alert('✅ تم إضافة الموظف بنجاح');
            }

            this.closeModal();
            await this.loadEmployees();
        } catch (error) {
            console.error('Error saving employee:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    // حذف موظف
    async deleteEmployee(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;

        try {
            const { error } = await Database.supabase
                .from('employees')
                .delete()
                .eq('id', id);

            if (error) throw error;

            alert('✅ تم حذف الموظف بنجاح');
            await this.loadEmployees();
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert('❌ حدث خطأ في الحذف');
        }
    },

    closeModal() {
        document.getElementById('employeeModal').style.display = 'none';
    },

    // ===== الحضور والغياب =====

    async loadAttendance() {
        try {
            const dateFilter = document.getElementById('attendanceDateFilter')?.value;
            const employeeFilter = document.getElementById('attendanceEmployeeFilter')?.value;

            let query = Database.supabase
                .from('employee_attendance')
                .select(`
                    *,
                    employee:employees(name, job_title)
                `)
                .order('attendance_date', { ascending: false });

            if (dateFilter) {
                query = query.eq('attendance_date', dateFilter);
            }
            if (employeeFilter) {
                query = query.eq('employee_id', employeeFilter);
            }

            const { data, error } = await query.limit(50);

            if (error) throw error;

            this.attendance = data || [];
            this.renderAttendance();
            await this.populateEmployeeFilters();
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    },

    renderAttendance() {
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;

        if (this.attendance.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">لا يوجد سجلات حضور</td></tr>';
            return;
        }

        const statusIcons = {
            'present': '✅ حاضر',
            'absent': '❌ غائب',
            'half_day': '⏰ نصف يوم',
            'vacation': '🏖️ إجازة',
            'sick': '🤒 مريض'
        };

        tbody.innerHTML = this.attendance.map(att => `
            <tr>
                <td><strong>${att.employee?.name || '-'}</strong></td>
                <td>${new Date(att.attendance_date).toLocaleDateString('ar-EG')}</td>
                <td>${statusIcons[att.status] || att.status}</td>
                <td>${att.check_in_time || '-'}</td>
                <td>${att.check_out_time || '-'}</td>
                <td>${att.notes || '-'}</td>
            </tr>
        `).join('');
    },

    async populateEmployeeFilters() {
        const selects = [
            'attendanceEmployeeFilter',
            'salaryEmployeeFilter',
            'attendanceEmployeeId',
            'salaryEmployeeId'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">كل الموظفين</option>' + 
                this.employees
                    .filter(e => e.status === 'active')
                    .map(e => `<option value="${e.id}">${e.name} - ${e.job_title}</option>`)
                    .join('');
            
            if (currentValue) select.value = currentValue;
        });
    },

    showAttendanceModal() {
        document.getElementById('attendanceForm').reset();
        document.getElementById('attendanceDate').valueAsDate = new Date();
        this.populateEmployeeFilters();
        document.getElementById('attendanceModal').style.display = 'block';
    },

    async saveAttendance(event) {
        event.preventDefault();

        const attendanceData = {
            employee_id: parseInt(document.getElementById('attendanceEmployeeId').value),
            attendance_date: document.getElementById('attendanceDate').value,
            status: document.getElementById('attendanceStatus').value,
            check_in_time: document.getElementById('attendanceCheckIn').value || null,
            check_out_time: document.getElementById('attendanceCheckOut').value || null,
            notes: document.getElementById('attendanceNotes').value || null
        };

        try {
            const { error } = await Database.supabase
                .from('employee_attendance')
                .insert([attendanceData]);

            if (error) throw error;

            alert('✅ تم تسجيل الحضور بنجاح');
            this.closeAttendanceModal();
            await this.loadAttendance();
        } catch (error) {
            console.error('Error saving attendance:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    closeAttendanceModal() {
        document.getElementById('attendanceModal').style.display = 'none';
    },

    // ===== الرواتب =====

    async loadSalaries() {
        try {
            const { data, error } = await Database.supabase
                .from('employee_salaries')
                .select(`
                    *,
                    employee:employees(name, job_title)
                `)
                .order('payment_date', { ascending: false })
                .limit(50);

            if (error) throw error;

            this.salaries = data || [];
            this.renderSalaries();
            await this.calculateSalaryStats();
        } catch (error) {
            console.error('Error loading salaries:', error);
        }
    },

    renderSalaries() {
        const tbody = document.getElementById('salariesTableBody');
        if (!tbody) return;

        if (this.salaries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">لا يوجد رواتب مسجلة</td></tr>';
            return;
        }

        const paymentTypes = {
            'daily': 'يومي',
            'weekly': 'أسبوعي',
            'monthly': 'شهري',
            'advance': 'سلفة',
            'bonus': 'مكافأة',
            'deduction': 'خصم'
        };

        tbody.innerHTML = this.salaries.map(sal => `
            <tr>
                <td><strong>${sal.employee?.name || '-'}</strong></td>
                <td>${new Date(sal.payment_date).toLocaleDateString('ar-EG')}</td>
                <td>${paymentTypes[sal.payment_type] || sal.payment_type}</td>
                <td>${sal.days_count || '-'}</td>
                <td><strong>${sal.amount.toFixed(2)} ج.م</strong></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="EmployeeManager.printSalaryReceipt(${sal.id})" title="طباعة">
                        🖨️
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async calculateSalaryStats() {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const monthSalaries = this.salaries.filter(s => 
            new Date(s.payment_date) >= firstDayOfMonth
        );

        const total = monthSalaries.reduce((sum, s) => sum + parseFloat(s.amount), 0);
        const activeCount = this.employees.filter(e => e.status === 'active').length;

        const totalEl = document.getElementById('totalSalariesMonth');
        const countEl = document.getElementById('activeEmployeesCount');

        if (totalEl) totalEl.textContent = total.toFixed(2) + ' ج.م';
        if (countEl) countEl.textContent = activeCount;
    },

    showSalaryModal() {
        document.getElementById('salaryForm').reset();
        document.getElementById('salaryPaymentDate').valueAsDate = new Date();
        this.populateEmployeeFilters();
        document.getElementById('salaryModal').style.display = 'block';
    },

    calculateSalary() {
        const employeeId = document.getElementById('salaryEmployeeId').value;
        const paymentType = document.getElementById('salaryPaymentType').value;
        const daysCount = parseInt(document.getElementById('salaryDaysCount').value) || 1;

        const employee = this.employees.find(e => e.id === parseInt(employeeId));
        if (!employee) return;

        let amount = 0;
        const daysGroup = document.getElementById('daysCountGroup');

        switch(paymentType) {
            case 'daily':
                amount = employee.daily_salary * daysCount;
                daysGroup.style.display = 'block';
                break;
            case 'weekly':
                amount = employee.daily_salary * 7;
                daysGroup.style.display = 'none';
                break;
            case 'monthly':
                amount = employee.monthly_salary || (employee.daily_salary * 30);
                daysGroup.style.display = 'none';
                break;
            default:
                daysGroup.style.display = 'none';
        }

        if (amount > 0) {
            document.getElementById('salaryAmount').value = amount.toFixed(2);
        }
    },

    async saveSalary(event) {
        event.preventDefault();

        const salaryData = {
            employee_id: parseInt(document.getElementById('salaryEmployeeId').value),
            payment_date: document.getElementById('salaryPaymentDate').value,
            payment_type: document.getElementById('salaryPaymentType').value,
            days_count: parseInt(document.getElementById('salaryDaysCount').value) || null,
            amount: parseFloat(document.getElementById('salaryAmount').value),
            notes: document.getElementById('salaryNotes').value || null,
            paid_by: Auth.currentUser?.id || null
        };

        try {
            const { data, error } = await Database.supabase
                .from('employee_salaries')
                .insert([salaryData])
                .select()
                .single();

            if (error) throw error;

            alert('✅ تم صرف الراتب بنجاح');
            this.closeSalaryModal();
            await this.loadSalaries();

            // طباعة إيصال
            if (confirm('هل تريد طباعة إيصال؟')) {
                this.printSalaryReceipt(data.id);
            }
        } catch (error) {
            console.error('Error saving salary:', error);
            alert('❌ حدث خطأ: ' + error.message);
        }
    },

    async printSalaryReceipt(salaryId) {
        try {
            const { data, error } = await Database.supabase
                .from('employee_salaries')
                .select(`
                    *,
                    employee:employees(name, job_title)
                `)
                .eq('id', salaryId)
                .single();

            if (error) throw error;

            ThermalPrinter.printSalaryReceipt({
                id: data.id,
                employee_name: data.employee.name,
                job_title: data.employee.job_title,
                payment_type: data.payment_type,
                days_count: data.days_count,
                amount: data.amount,
                notes: data.notes
            });
        } catch (error) {
            console.error('Error printing receipt:', error);
            alert('❌ حدث خطأ في الطباعة');
        }
    },

    closeSalaryModal() {
        document.getElementById('salaryModal').style.display = 'none';
    }
};

window.EmployeeManager = EmployeeManager;
console.log('✅ Employee Manager Loaded');
