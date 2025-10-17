// js/auth.js
// إدارة المصادقة والصلاحيات

const Auth = {
    // الحصول على المستخدم الحالي
    getCurrentUser() {
        const userStr = localStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    },

    // حفظ بيانات المستخدم
    setCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    },

    // تسجيل الخروج
    logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    },

    // التحقق من الصلاحيات
    checkAuth(allowedRoles) {
        const user = this.getCurrentUser();

        if (!user) {
            window.location.href = 'login.html';
            return null;
        }

        if (!allowedRoles.includes(user.role)) {
            Utils.showNotification('ليس لديك صلاحية الوصول لهذه الصفحة', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return null;
        }

        return user;
    },

    // تسجيل الدخول
    async login(username, password, role) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('role', role)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                throw new Error('بيانات الدخول غير صحيحة');
            }

            // في بيئة الإنتاج، يجب استخدام bcrypt للمقارنة
            if (data.password_hash !== password) {
                throw new Error('كلمة المرور غير صحيحة');
            }

            this.setCurrentUser(data);
            return { success: true, user: data };

        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // تغيير كلمة المرور
    async changePassword(userId, oldPassword, newPassword) {
        try {
            const { data: user } = await supabase
                .from('users')
                .select('password_hash')
                .eq('id', userId)
                .single();

            if (user.password_hash !== oldPassword) {
                throw new Error('كلمة المرور القديمة غير صحيحة');
            }

            const { error } = await supabase
                .from('users')
                .update({ password_hash: newPassword })
                .eq('id', userId);

            if (error) throw error;

            return { success: true };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.Auth = Auth;
}
