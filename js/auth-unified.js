/**
 * ScoutLog Unified Authentication System
 * Handles Email/OTP Login, Session Persistence, and Biometric Security.
 */

const SUPABASE_URL = 'https://unxhursbcavdaunuvbhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueGh1cnNiY2F2ZGF1bnV2YmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mzg4NTksImV4cCI6MjA5MjUxNDg1OX0.56EwISYcShglg-Q_2thnrtJSAXMKkHO1Zmvo_ZC6c4w';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let tempLoginData = null;
let resendInterval = null;

// Initialize Auth
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // Check for password recovery/reset from URL
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        setTimeout(() => {
            window.showActionPrompt({
                title: "تعيين كلمة المرور الجديدة",
                subtitle: "يرجى إدخال كلمة المرور التي تريد استخدامها للدخول",
                icon: "fa-key",
                type: "password",
                placeholder: "كلمة المرور الجديدة",
                callback: async (newPassword) => {
                    if (newPassword.length < 6) {
                        showToast("كلمة المرور قصيرة جداً", "warning");
                        return 'keep-open';
                    }
                    try {
                        const { error } = await _supabase.auth.updateUser({ password: newPassword });
                        if (error) throw error;
                        showToast("تم تعيين كلمة المرور بنجاح! يمكنك الدخول الآن.", "success");
                        window.location.hash = ''; // Clear hash
                        return true;
                    } catch (err) {
                        showToast("فشل التحديث: " + err.message, "error");
                        return 'keep-open';
                    }
                }
            });
        }, 1500);
    }
    
    // Auto-fill email if remembered
    const savedEmail = window.safeStorage.getItem('remembered_email');
    if (savedEmail) {
        const emailInput = document.getElementById('login-email');
        if (emailInput) emailInput.value = savedEmail;
    }

    // Sync Biometric Toggle UI
    const bioToggle = document.getElementById('biometric-toggle');
    if (bioToggle) {
        bioToggle.checked = window.safeStorage.getItem('scout-pulse-biometric-enabled') === 'true';
    }
});

async function checkSession() {
    const authLoading = document.getElementById('auth-loading-state');
    const authStep1 = document.getElementById('auth-step-1');
    const bioLoading = document.getElementById('bio-loading-state');
    const bioContent = document.getElementById('bio-content-area');
    const authOverlay = document.getElementById('authOverlay');
    const bioOverlay = document.getElementById('biometricOverlay');

    const session = window.safeStorage.getItem('admin_session');
    
    if (session) {
        try {
            currentUser = JSON.parse(session);
            
            if (authLoading) authLoading.classList.remove('hidden');
            if (bioLoading) bioLoading.classList.remove('hidden');
            if (authStep1) authStep1.classList.add('hidden');
            if (bioContent) bioContent.classList.add('hidden');

            // Verify if admin still exists in DB
            const { data: admin, error } = await _supabase
                .from('admins')
                .select('full_name, email, pin')
                .eq('email', currentUser.email)
                .maybeSingle();
            
            if (admin) {
                currentUser = admin;
                window.safeStorage.setItem('admin_session', JSON.stringify(currentUser));
                
                // Set UI greetings
                const greetingEl = document.getElementById('bio-admin-greeting');
                const subtitleEl = document.querySelector('#biometricOverlay .auth-subtitle');
                if (greetingEl && currentUser.full_name) {
                    greetingEl.textContent = `مرحباً ${currentUser.full_name.split(' ')[0]}`;
                }
                if (subtitleEl) {
                    subtitleEl.textContent = 'أدخل الرقم السري للعبور أو استخدم البصمة';
                }

                if (currentUser.pin) {
                    authOverlay.classList.add('hidden');
                    bioOverlay.classList.remove('hidden');
                    if (bioContent) bioContent.classList.remove('hidden');
                    
                    // Hide X button if this is the initial app lock
                    const closeBtn = document.querySelector('#biometricOverlay .modal-close-btn');
                    if (closeBtn && !window.pendingUnlock) closeBtn.style.display = 'none';
                    if (isBiometricEnabled) {
                        requestBiometricAccess();
                    }
                } else {
                    showAuthStep(1);
                }
            } else {
                // Admin removed from DB, logout
                logout();
            }
        } catch (e) { 
            console.error("Session sync failed", e);
            showAuthStep(1);
        } finally {
            if (authLoading) authLoading.classList.add('hidden');
            if (bioLoading) bioLoading.classList.add('hidden');
        }
    } else {
        if (authLoading) authLoading.classList.add('hidden');
        showAuthStep(1);
    }
}

function showAuthStep(step) {
    const authOverlay = document.getElementById('authOverlay');
    const authStep1 = document.getElementById('auth-step-1');
    const authStep2 = document.getElementById('auth-step-2');
    const bioOverlay = document.getElementById('biometricOverlay');

    authOverlay.classList.remove('hidden');
    bioOverlay.classList.add('hidden');

    if (step === 1) {
        authStep1.classList.remove('hidden');
        authStep2.classList.add('hidden');
    } else {
        authStep1.classList.add('hidden');
        authStep2.classList.remove('hidden');
    }
}

window.verifyPinCode = function() {
    const pinInput = document.getElementById('lock-pin');
    if (!pinInput) return;
    const pin = pinInput.value;
    
    if (currentUser && currentUser.pin && pin === currentUser.pin) {
        document.getElementById('biometricOverlay').classList.add('hidden');
        // Verification message removed as per user request
        
        if (window.pendingUnlock === 'students') {
            window.pendingUnlock = null;
            if (window.state) {
                window.state.isStudentsUnlocked = true;
                if (window.renderStudents) window.renderStudents();
                showToast("تم إظهار معلومات الطلاب بنجاح", "success");
            }
        } else {
            if (window.updateGreeting) window.updateGreeting();
        }
    } else {
        showToast("الرقم السري غير صحيح", "error");
        pinInput.value = '';
    }
};

// Aliases for compatibility with old cached buttons
window.verifyPinAuth = window.verifyPinCode;
window.verifyPin = window.verifyPinCode;


window.closePromptModal = function() {
    document.getElementById('promptModal').classList.add('hidden');
};

window.showActionPrompt = function(options) {
    const { title, subtitle, icon, placeholder, type, callback, hideInput } = options;
    const modal = document.getElementById('promptModal');
    const input = document.getElementById('prompt-input');
    const inputGroup = input.closest('.auth-input-group');
    const confirmBtn = document.getElementById('prompt-confirm-btn');
    
    document.getElementById('prompt-title').textContent = title || 'التحقق من الهوية';
    document.getElementById('prompt-subtitle').textContent = subtitle || '';
    if (icon) document.getElementById('prompt-icon-box').innerHTML = `<i class="fas ${icon}"></i>`;
    
    input.value = '';
    input.type = type || 'text';
    input.placeholder = placeholder || '----';
    
    if (hideInput) {
        inputGroup.style.display = 'none';
    } else {
        inputGroup.style.display = 'block';
    }
    
    modal.classList.remove('hidden');
    if (!hideInput) input.focus();
    
    confirmBtn.onclick = async () => {
        const val = input.value.trim();
        const result = await callback(val);
        if (result !== false && result !== 'keep-open') {
            window.closePromptModal();
        }
    };
};

window.showConfirm = function(title, subtitle, callback) {
    window.showActionPrompt({
        title,
        subtitle,
        icon: 'fa-question-circle',
        hideInput: true,
        callback: () => callback()
    });
};



window.verifyAdminAction = async function(callback) {
    window.showActionPrompt({
        title: "تأكيد الهوية",
        subtitle: "يرجى إدخال كلمة مرور حسابك لتأكيد هذا الإجراء",
        icon: "fa-shield-alt",
        type: "password",
        placeholder: "كلمة المرور",
        callback: async (password) => {
            if (!password) {
                showToast("كلمة المرور مطلوبة", "warning");
                return 'keep-open';
            }
            
            try {
                // Verify password by trying a silent re-auth
                const { error } = await _supabase.auth.signInWithPassword({
                    email: currentUser.email,
                    password: password
                });

                if (error) {
                    showToast("كلمة المرور غير صحيحة", "error");
                    return 'keep-open';
                }

                // Success! Execute the actual action
                await callback();
                return true;
            } catch (err) {
                showToast("خطأ في التحقق: " + err.message, "error");
                return 'keep-open';
            }
        }
    });
};

window.requestPinChange = async function() {
    window.verifyAdminAction(async () => {
        setTimeout(() => {
            window.showActionPrompt({
                title: "الرقم السري الجديد",
                subtitle: "أدخل الرقم السري الجديد المكون من 4 أرقام:",
                icon: "fa-key",
                placeholder: "0000",
                type: "password",
                callback: async (newPin) => {
                    if (!newPin || newPin.length !== 4 || isNaN(newPin)) {
                        showToast("يجب إدخال 4 أرقام فقط", "error");
                        return false;
                    }
                    
                    try {
                        const { error: updateError } = await _supabase
                            .from('admins')
                            .update({ pin: newPin })
                            .eq('email', currentUser.email);
                            
                        if (updateError) throw updateError;
                        
                        showToast("تم تحديث الرقم السري بنجاح", "success");
                        currentUser.pin = newPin;
                        window.safeStorage.setItem('admin_session', JSON.stringify(currentUser));
                        if (window.navigateTo) window.navigateTo('settings');
                        return true;
                    } catch (e) {
                        console.error("PIN Update Error:", e);
                        showToast("فشل التحديث: " + (e.message || ""), "error");
                        return false;
                    }
                }
            });
        }, 100);
    });
};

window.approveAdminRequest = async function(requestId, name, email) {
    window.verifyAdminAction(async () => {
        try {
            // 1. Add to admins table
            const { error: insertError } = await _supabase
                .from('admins')
                .insert([{ full_name: name, email: email }]);

            if (insertError) throw insertError;

            // 2. Update request status
            const { error: updateError } = await _supabase
                .from('admin_requests')
                .update({ status: 'approved' })
                .eq('id', requestId);

            if (updateError) throw updateError;

            showToast("تم قبول الطلب وإضافة المسؤول بنجاح", "success");
            window.renderAdminRequestsList();
            window.renderAdminsList();
        } catch (err) {
            console.error("Approve error:", err);
            const errorCode = err.code || 'Unknown';
            const errorMsg = err.message || 'حدث خطأ غير معروف';
            showToast(`فشل في معالجة الطلب (كود: ${errorCode}): ${errorMsg}`, "error");
        }
    });
};

window.rejectAdminRequest = async function(requestId) {
    window.verifyAdminAction(async () => {
        try {
            const { error } = await _supabase
                .from('admin_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);

            if (error) throw error;

            showToast("تم رفض الطلب", "info");
            window.renderAdminRequestsList();
        } catch (err) {
            console.error("Reject error:", err);
            const errorCode = err.code || 'Unknown';
            const errorMsg = err.message || 'حدث خطأ غير معروف';
            showToast(`فشل في رفض الطلب (كود: ${errorCode}): ${errorMsg}`, "error");
        }
    });
};

window.fallbackToEmail = function() {
    document.getElementById('biometricOverlay').classList.add('hidden');
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('auth-step-1').classList.remove('hidden');
    document.getElementById('auth-step-2').classList.add('hidden');
};

window.loginWithPassword = async function() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();
    const btn = document.getElementById('loginBtn');

    if (!email || !password) {
        showToast("يرجى إدخال البريد الإلكتروني وكلمة المرور", "error");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>جاري التحقق...</span> <i class="fas fa-spinner fa-spin"></i>';

    try {
        const { data, error } = await _supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Fetch user info from our admins table
        const { data: admin, error: dbError } = await _supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (dbError || !admin) {
            // If authenticated but not in admins table, they are pending or invalid
            throw new Error("عذراً، لم يتم تفعيل حسابك كمسؤول بعد.");
        }

        currentUser = admin;
        window.safeStorage.setItem('admin_session', JSON.stringify(currentUser));
        window.safeStorage.setItem('remembered_email', currentUser.email);
        
        const greetingEl = document.getElementById('bio-admin-greeting');
        if (greetingEl && currentUser.full_name) {
            greetingEl.textContent = `مرحباً ${currentUser.full_name.split(' ')[0]}`;
        }

        document.getElementById('authOverlay').classList.add('hidden');
        if (window.updateGreeting) window.updateGreeting();
        
    } catch (err) {
        console.error("Login Error:", err);
        showToast("فشل تسجيل الدخول: " + (err.message === "Invalid login credentials" ? "البيانات غير صحيحة" : err.message), "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>تسجيل الدخول</span> <i class="fas fa-sign-in-alt"></i>';
    }
};

window.handleForgotPassword = async function() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    if (!email) {
        showToast("يرجى كتابة بريدك الإلكتروني أولاً في الخانة المخصصة", "warning");
        return;
    }

    window.showConfirm("تعيين كلمة المرور", `هل تريد إرسال رابط تعيين كلمة المرور إلى ${email}؟`, async () => {
        try {
            const { error } = await _supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname,
            });
            if (error) throw error;
            showToast("تم إرسال رابط التعيين لبريدك بنجاح", "success");
        } catch (err) {
            showToast("خطأ: " + err.message, "error");
        }
    });
};

// Deprecated OTP functions (keeping for compatibility if needed)
window.sendLoginOtp = () => showToast("تم استبدال نظام الرمز بكلمة المرور", "info");

async function toggleBiometricLock(checkbox) {
    if (checkbox.checked) {
        const available = await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            showToast("جهازك لا يدعم البصمة أو الوجه في المتصفح", "error");
            checkbox.checked = false;
            return;
        }

        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "Al-Qasim PC Interface" },
                    user: {
                        id: Uint8Array.from(currentUser.id.replace(/-/g, ""), c => c.charCodeAt(0)),
                        name: currentUser.email,
                        displayName: currentUser.full_name || currentUser.email
                    },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
                    authenticatorSelection: { 
                        authenticatorAttachment: "platform",
                        userVerification: "required" 
                    },
                    timeout: 60000
                }
            });

            if (credential) {
                window.safeStorage.setItem('scout-pulse-biometric-enabled', 'true');
                showToast("تم تفعيل القفل بالبصمة بنجاح", "success");
            }
        } catch (err) {
            console.error(err);
            showToast("تم إلغاء تفعيل البصمة أو حدث خطأ", "error");
            checkbox.checked = false;
        }
    } else {
        window.safeStorage.removeItem('scout-pulse-biometric-enabled');
        showToast("تم إيقاف القفل بالبصمة", "info");
    }
}

async function requestBiometricAccess() {
    const isBiometricEnabled = window.safeStorage.getItem('scout-pulse-biometric-enabled') === 'true';
    if (!isBiometricEnabled) {
        showToast("البصمة غير مفعلة، يرجى استخدام الرقم السري", "warning");
        return;
    }

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                timeout: 60000,
                userVerification: "required"
            }
        });

        if (assertion) {
            document.getElementById('biometricOverlay').classList.add('hidden');
            if (window.pendingUnlock === 'students') {
                window.pendingUnlock = null;
                if (window.unblurStudentsData) window.unblurStudentsData();
                import('./state.js').then(({ state }) => state.isStudentsUnlocked = true);
                showToast("تم إظهار معلومات الطلاب بنجاح", "success");
            } else {
                showToast("تم التحقق، مرحباً بك مجدداً", "success");
                if (window.updateGreeting) window.updateGreeting();
            }
        }
    } catch (err) {
        console.error(err);
        showToast("فشل التحقق، حاول مرة أخرى", "error");
    }
}

function resetAuth() {
    document.getElementById('auth-step-1').classList.remove('hidden');
    document.getElementById('auth-step-2').classList.add('hidden');
    const reqStep = document.getElementById('auth-step-request');
    if (reqStep) reqStep.classList.add('hidden');
    tempLoginData = null;
}

window.showRequestStep = function() {
    document.getElementById('auth-step-1').classList.add('hidden');
    document.getElementById('auth-step-2').classList.add('hidden');
    document.getElementById('auth-step-request').classList.remove('hidden');
};

window.submitAdminRequest = async function() {
    const name = document.getElementById('req-name').value.trim();
    const email = document.getElementById('req-email').value.trim().toLowerCase();
    const password = document.getElementById('req-password').value.trim();
    const btn = document.getElementById('submitRequestBtn');

    if (!name || !email || !password) {
        showToast("يرجى إكمال جميع الحقول بما في ذلك كلمة المرور", "error");
        return;
    }

    if (password.length < 6) {
        showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "warning");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>جاري المعالجة...</span> <i class="fas fa-spinner fa-spin"></i>';

    try {
        // 1. Sign up user in Supabase Auth
        const { data: authData, error: authError } = await _supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        });

        if (authError) throw authError;

        // 2. Add to admin_requests for manual approval
        const { error: reqError } = await _supabase
            .from('admin_requests')
            .insert([{ 
                full_name: name, 
                email: email, 
                status: 'pending' 
            }]);

        if (reqError) throw reqError;

        showToast("تم تسجيل طلبك بنجاح! يرجى انتظار تفعيل حسابك من قبل المسؤول.", "success");
        resetAuth();
    } catch (err) {
        console.error("Registration Error:", err);
        showToast(`خطأ في التسجيل: ${err.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>إرسال طلب التسجيل</span> <i class="fas fa-paper-plane"></i>';
    }
};

window.toggleRegistration = async function(isClosed) {
    try {
        const valueStr = isClosed.toString();
        
        // Strategy: Try to update first, if it fails or returns 0 rows, try to insert.
        // This is more compatible than upsert in some RLS configurations.
        const { data: updateData, error: updateError } = await _supabase
            .from('settings')
            .update({ value: valueStr })
            .eq('key', 'registration_closed')
            .select();

        if (updateError) throw updateError;

        // If no rows were updated, it means the key doesn't exist, so insert it.
        if (!updateData || updateData.length === 0) {
            const { error: insertError } = await _supabase
                .from('settings')
                .insert({ key: 'registration_closed', value: valueStr });
            
            if (insertError) throw insertError;
        }

        showToast(isClosed ? "تم إغلاق باب الطلبات" : "تم فتح باب الطلبات", "success");
    } catch (err) {
        console.error("Toggle Reg Error:", err);
        // Show the actual error code for debugging
        const errorCode = err.code || 'Unknown';
        const errorMsg = err.message || 'خطأ غير معروف';
        showToast(`فشل في التحديث (كود: ${errorCode}): ${errorMsg}`, "error");
    }
};

window.checkRegistrationStatus = async function() {
    try {
        const { data, error } = await _supabase
            .from('settings')
            .select('value')
            .eq('key', 'registration_closed')
            .maybeSingle();

        if (error) throw error;
        const isClosed = data?.value === 'true';
        
        const joinBtn = document.getElementById('show-request-btn');
        if (joinBtn) {
            joinBtn.style.display = isClosed ? 'none' : 'block';
        }
        return isClosed;
    } catch (err) {
        return false;
    }
};

// Auto check on load
document.addEventListener('DOMContentLoaded', window.checkRegistrationStatus);

function logout() {
    window.showConfirm("تسجيل الخروج", "هل أنت متأكد أنك تريد تسجيل الخروج من النظام؟", () => {
        window.safeStorage.removeItem('admin_session');
        location.reload();
    });
}

async function addNewAdmin() {
    const nameEl = document.getElementById('new-admin-name');
    const emailEl = document.getElementById('new-admin-email');
    
    if (!nameEl || !emailEl) return;
    
    const full_name = nameEl.value.trim();
    const email = emailEl.value.trim().toLowerCase();

    if (!full_name || !email) {
        showToast("يرجى تعبئة جميع الحقول", "error");
        return;
    }

    try {
        const { error } = await _supabase
            .from('admins')
            .insert([{ full_name, email }]);

        if (error) throw error;

        showToast("تم إضافة المسؤول بنجاح", "success");
        nameEl.value = '';
        emailEl.value = '';
        if (window.renderAdminsList) window.renderAdminsList();
    } catch (err) {
        console.error("Add Admin Error:", err);
        showToast("فشل إضافة المسؤول: " + err.message, "error");
    }
}

async function fetchAdmins() {
    try {
        const { data, error } = await _supabase
            .from('admins')
            .select('full_name, email')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Fetch Admins Error:", err);
        return [];
    }
}

async function syncStudentsToSupabase() {
    const studentsData = [
        { id: '1147826471', name: 'محمد عبدالرحمن أحمد الحلافي', nationality: 'سعودي', phone: '0541700823', section: '205' },
        { id: '1153678790', name: 'الحسن محمد باقر السلامين', nationality: 'سعودي', phone: '0533611822', section: '103' },
        { id: '1150992939', name: 'طلال بن محمد الشمراني', nationality: 'سعودي', phone: '0504243630', section: '104' },
        { id: '1146262140', name: 'أديب خالد عبدالعزيز الصقر', nationality: 'سعودي', phone: '0550196021', section: '201' },
        { id: '1148673047', name: 'جمعان خالد جمعان الدوسري', nationality: 'سعودي', phone: '0578365651', section: '202' },
        { id: '1154819872', name: 'تركي فيصل عبدالله العسيري', nationality: 'سعودي', phone: '0506595113', section: '103' },
        { id: '1154410334', name: 'محمد عبدالعزيز محمد العسيري', nationality: 'سعودي', phone: '0550064551', section: '104' },
        { id: '1149252775', name: 'عبدالعزيز خالد بوشليبي', nationality: 'سعودي', phone: '0534492324', section: '203' },
        { id: '2282125646', name: 'عمرو احمد عبدالستار مطاوع', nationality: 'مصري', phone: '0544776253', section: '205' },
        { id: '1146662679', name: 'احمد عبدالله الرزق', nationality: 'سعودي', phone: '0577159417', section: '203' },
        { id: '1168019246', name: 'زياد عبدالرحمن سعيد الزهراني', nationality: 'سعودي', phone: '0557257325', section: '103' },
        { id: '2270164532', name: 'يوسف سامي محمد العمودي', nationality: 'يمني', phone: '0549889406', section: '204' },
        { id: '1164569137', name: 'عبد الرحمن عادل الدوسري', nationality: 'سعودي', phone: '0545053137', section: '101' },
        { id: '1146671878', name: 'علي سعيد علي الغرير', nationality: 'سعودي', phone: '0530471551', section: '204' },
        { id: '1146137847', name: 'خالد عبدالعزيز عبدالله بوردحه', nationality: 'سعودي', phone: '0500621499', section: '203' },
        { id: '1148565912', name: 'عبدالله محمد عبدالله الزهراني', nationality: 'سعودي', phone: '0537973279', section: '103' },
        { id: '1151899240', name: 'راشد بن سعيد الهاجري', nationality: 'سعودي', phone: '0535550062', section: '204' },
        { id: '1149716829', name: 'حسن احمد علي بوعبيد', nationality: 'سعودي', phone: '0500029782', section: '102' },
        { id: 'm-sadeq', name: 'محمد صادق علي الدرع', nationality: 'سعودي', phone: '-', section: '103' },
        { id: '1149250720', name: 'فهد عبد العزيز هويمل', nationality: 'سعودي', phone: '0564208987', section: '203' },
    ];

    try {
        const { error } = await _supabase
            .from('scouts')
            .upsert(studentsData, { onConflict: 'id' });

        if (error) throw error;
        showToast("تم تحديث بيانات الطلاب في القاعدة", "success");
    } catch (err) {
        console.error("Sync Error:", err);
        showToast("فشل التحديث: " + err.message, "error");
    }
}

function showToast(message, type = 'info') {
    let toast = document.getElementById('copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'copy-toast';
        document.body.appendChild(toast);
    }
    
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    toast.className = `custom-toast active ${type}`;
    
    // Clear any existing timeout to prevent flickering
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('active');
    }, 3500);
}

window.showAlert = function(title, subtitle, icon = 'fa-info-circle') {
    if (title === "تنبيه" || !title || title === "ScoutPulse") {
        showToast(subtitle, 'info');
    } else {
        window.showActionPrompt({
            title,
            subtitle,
            icon,
            hideInput: true,
            callback: () => true
        });
    }
};

window.closeBiometricOverlay = function() {
    // Only allow closing if it's NOT the main app lock
    if (window.pendingUnlock) {
        document.getElementById('biometricOverlay').classList.add('hidden');
        document.getElementById('lock-pin').value = '';
        window.pendingUnlock = null;
    } else {
        showToast("يجب التحقق أولاً للمتابعة", "warning");
    }
};

window.closePromptModal = function() {
    document.getElementById('promptModal').classList.add('hidden');
    const input = document.getElementById('prompt-input');
    if (input) input.value = '';
};

// Update existing open function or add logic to show/hide X
window.openPasswordPopup = function() {
    window.pendingUnlock = 'students';
    const closeBtn = document.querySelector('#biometricOverlay .modal-close-btn');
    if (closeBtn) closeBtn.style.display = 'flex'; // Show X for students
    
    document.getElementById('biometricOverlay').classList.remove('hidden');
    const pinInput = document.getElementById('lock-pin');
    if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
    }
};

window._supabase = _supabase;
// Auth Background Slider Logic
const authBgs = [
    'imgs/image (1).png',
    'imgs/image.png'
];
let currentAuthBgIndex = 0;
let authBgInterval = null;

window.updateAuthBg = function() {
    const layer = document.querySelector('.auth-image-layer');
    const counter = document.getElementById('auth-bg-counter');
    if (!layer || !counter) return;

    layer.style.backgroundImage = `url('${authBgs[currentAuthBgIndex]}')`;
    counter.textContent = `0${currentAuthBgIndex + 1}/0${authBgs.length}`;
};

window.nextAuthBg = function() {
    currentAuthBgIndex = (currentAuthBgIndex + 1) % authBgs.length;
    window.updateAuthBg();
    resetAuthBgInterval();
};

window.prevAuthBg = function() {
    currentAuthBgIndex = (currentAuthBgIndex - 1 + authBgs.length) % authBgs.length;
    window.updateAuthBg();
    resetAuthBgInterval();
};

function resetAuthBgInterval() {
    if (authBgInterval) clearInterval(authBgInterval);
    authBgInterval = setInterval(window.nextAuthBg, 5000);
}

// Start slider when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.updateAuthBg();
    resetAuthBgInterval();
});

window.logout = logout;
window.resetAuth = resetAuth;
window.toggleBiometricLock = toggleBiometricLock;
window.requestBiometricAccess = requestBiometricAccess;
window.syncStudentsToSupabase = syncStudentsToSupabase;
window.addNewAdmin = addNewAdmin;
window.fetchAdmins = fetchAdmins;
window.showToast = showToast;
window.showRequestStep = window.showRequestStep;
window.submitAdminRequest = window.submitAdminRequest;
window.nextAuthBg = window.nextAuthBg;
window.prevAuthBg = window.prevAuthBg;

window.renderAdminRequestsList = async function() {
    const container = document.getElementById('admin-requests-list-container');
    if (!container) return;

    container.innerHTML = '<div style="padding: 15px; text-align: center; opacity: 0.6; font-size: 0.8rem">جاري تحميل الطلبات...</div>';

    try {
        const { data, error } = await _supabase
            .from('admin_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="padding: 15px; text-align: center; opacity: 0.5; font-size: 0.85rem">لا توجد طلبات معلقة حالياً.</p>';
            return;
        }

        container.innerHTML = data.map(req => `
            <div class="admin-item-premium animate-in" style="flex-direction: column; align-items: stretch; gap: 12px; padding: 15px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="admin-item-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--primary-light);"><i class="fas fa-user-clock"></i></div>
                    <div class="admin-item-info">
                        <strong>${req.full_name}</strong>
                        <span>${req.email}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-premium-save" onclick="window.approveAdminRequest('${req.id}', '${req.full_name}', '${req.email}')" style="flex: 1; padding: 8px; font-size: 0.8rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                        <i class="fas fa-check"></i> قبول
                    </button>
                    <button class="btn-premium-save" onclick="window.rejectAdminRequest('${req.id}')" style="flex: 1; padding: 8px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">
                        <i class="fas fa-times"></i> رفض
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Fetch requests error:", err);
        container.innerHTML = '<p style="color: #ef4444; font-size: 0.8rem; text-align: center;">خطأ في تحميل البيانات</p>';
    }
};



