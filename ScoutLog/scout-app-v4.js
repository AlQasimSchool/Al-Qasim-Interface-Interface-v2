/**
 * Scout Attendance System - Frontend Logic (Connected to Node.js)
 */

let scouts = [];
let attendance = [];
let keyboardBuffer = "";
let bufferTimer = null;
let isScanning = false;
let scanAbortController = null;

var SUPABASE_URL = 'https://unxhursbcavdaunuvbhr.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueGh1cnNiY2F2ZGF1bnV2YmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mzg4NTksImV4cCI6MjA5MjUxNDg1OX0.56EwISYcShglg-Q_2thnrtJSAXMKkHO1Zmvo_ZC6c4w';
var _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Authentication State
var currentUser = null;
var currentOTP = null;
var tempLoginData = null;

const API_BASE = "/api";

async function uploadFile(file, bucket = 'scouts') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await _supabase.storage
        .from(bucket)
        .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = _supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return publicUrl;
}

function updateFileName(input, targetId) {
    const fileName = input.files[0]?.name;
    const target = document.getElementById(targetId);
    if (target && fileName) {
        target.textContent = fileName;
        target.style.color = '#818cf8';
    }
}

function showPage(pageId) {
    // إخفاء كل الصفحات
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    
    // إظهار الصفحة المطلوبة
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.remove('hidden');

    // تحديث روابط التنقل في كل القوائم (علوية وسفلية)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const onClickAttr = link.getAttribute('onclick');
        if (onClickAttr && onClickAttr.includes(`'${pageId}'`)) {
            link.classList.add('active');
        }
    });

    // تحديث الأيقونات في الصفحة الجديدة
    if(window.lucide) lucide.createIcons();
}

function openDatePicker() {
    if (window.flatpickrInstance) {
        window.flatpickrInstance.open();
    }
}

function init() {
    // التحقق من الجلسة السابقة
    const session = window.safeStorage.getItem('admin_session');
    const rememberedEmail = window.safeStorage.getItem('remembered_email');
    const rememberedId = window.safeStorage.getItem('remembered_id');

    if (session) {
        currentUser = JSON.parse(session);
        document.getElementById('authOverlay').classList.add('hidden');
        document.getElementById('admin-management-section').classList.remove('hidden');
        updateGreeting();
        
        // تحديث بيانات المستخدم من القاعدة للتأكد من الاسم الجديد
        _supabase.from('admins').select('*').eq('email', currentUser.email).single().then(({data}) => {
            if(data) {
                currentUser = data;
                window.safeStorage.setItem('admin_session', JSON.stringify(data));
                updateGreeting();
            }
        });
    } else {
        document.getElementById('authOverlay').classList.remove('hidden');
        
        // تعبئة البريد تلقائياً إذا كان محفوظاً
        if (rememberedEmail) {
            document.getElementById('login-email').value = rememberedEmail;
            document.getElementById('sendCodeBtn').querySelector('span').textContent = "إرسال رمز الدخول السريع";
        }

        checkAndProvisionFirstAdmin();
    }

    // إظهار لوحة التحكم فوراً عند الفتح
    showPage('dashboard');

    const dayFilter = document.getElementById('dayFilter');
    if (dayFilter) {
        dayFilter.value = new Date().toISOString().split('T')[0];
    }

    fetchData();
    setupKeyboardEmulator();
    setupSearch();
    applySettings();
    startLiveClock();
    
    // تهيئة إعدادات وقت نهاية التحضير
    const savedEndTime = window.safeStorage.getItem('scout-pulse-end-time') || "10:30";
    const endTimeInput = document.getElementById('setting-end-time');
    if (endTimeInput) endTimeInput.value = savedEndTime;

    // تهيئة التقويم الاحترافي
    window.flatpickrInstance = flatpickr("#dayFilter", {
        locale: "ar",
        dateFormat: "Y-m-d",
        disableMobile: "true",
        theme: "dark",
        onChange: function(selectedDates, dateStr) {
            updateDashboard();
        }
    });

    // تهيئة محدد الوقت الاحترافي
    window.timePickerInstance = flatpickr("#setting-end-time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: false,
        theme: "dark",
        locale: "ar",
        disableMobile: true, // يمنع ظهور النافذة البيضاء في الجوال والمتصفحات
        defaultDate: window.safeStorage.getItem('scout-pulse-end-time') || "10:30",
        onChange: function(selectedDates, dateStr) {
            updateAttendanceSettings(dateStr);
        }
    });

    // تهيئة القفل بالبصمة إذا كان مفعلاً لهذا الحساب
    if (currentUser) {
        const bioKey = `scout-pulse-biometric-enabled-${currentUser.email}`;
        const isBiometricEnabled = window.safeStorage.getItem(bioKey) === 'true';
        if (isBiometricEnabled) {
            document.getElementById('biometricOverlay').classList.remove('hidden');
            const bioToggle = document.getElementById('setting-biometric');
            if (bioToggle) bioToggle.checked = true;
            // محاولة الفتح التلقائي عند التحميل
            setTimeout(() => {
                if (window.requestBiometricAccess) window.requestBiometricAccess(true);
            }, 1000);
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');
    if (scanId) {
        handleAutoScan(scanId);
    }
    
    const bottomNav = document.getElementById('mobileBottomNav');
    if(bottomNav) bottomNav.classList.remove('hidden');
}

function handleMainFilterChange() {
    const filterSelect = document.getElementById('monthFilter');
    const dayFilter = document.getElementById('dayFilter');
    
    if (filterSelect.value === 'custom') {
        dayFilter.classList.remove('hidden');
        dayFilter.focus();
    } else {
        dayFilter.classList.add('hidden');
        updateDashboard(false);
    }
}

// تشغيل عند التحميل أو فوراً إذا كان المتصفح جاهزاً بالفعل
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}


function getShortName(fullName) {
    if (!fullName) return "---";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    // الاسم الأول + الأخير
    return `${parts[0]} ${parts[parts.length - 1]}`;
}


async function handleAutoScan(id) {
    showToast("🔍 جاري التحضير التلقائي...", "info");
    // ننتظر قليلاً للتأكد من جلب البيانات أولاً
    setTimeout(async () => {
        isScanning = true; // تفعيل مؤقت للسماح بالمعالجة
        await handleScan(id);
        isScanning = false;
        // تنظيف الرابط لعدم تكرار التحضير عند التحديث
        window.history.replaceState({}, document.title, window.location.pathname);
    }, 1500);
}

function applySettings() {
    const isSound = window.safeStorage.getItem('scout-pulse-sound') !== 'false';
    const isDark = window.safeStorage.getItem('scout-pulse-dark') !== 'false';
    
    document.getElementById('setting-sound').checked = isSound;
    document.getElementById('setting-dark').checked = isDark;
    document.body.classList.toggle('light-mode', !isDark);
}

/**
 * Fetch Data from Supabase
 */
async function fetchData() {
    try {
        // 1. جلب بيانات الكشافة
        const { data: scoutsData, error: scoutsError } = await _supabase
            .from('scouts')
            .select('*')
            .order('name');
        if (scoutsError) throw scoutsError;
        
        scouts = scoutsData.map(s => ({
            ...s,
            id: s.id,
            name: s.name,
            rank: s.rank,
            patrol: s.patrol,
            section: s.section || '-',
            photo: s.photo,
            warnings: s.warnings || 0
        }));

        // 2. جلب بيانات الحضور
        const { data: attendanceData, error: attendanceError } = await _supabase
            .from('attendance')
            .select('*')
            .order('created_at', { ascending: false });
        if (attendanceError) throw attendanceError;
        
        attendance = attendanceData.map(a => {
            const d = new Date(a.created_at);
            return {
                studentId: a.scout_id,
                time: d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }),
                date: a.date || d.toLocaleDateString('ar-EG'),
                isoDate: d.toISOString().split('T')[0]
            };
        });
        
        // تحديث كل الواجهات مرة واحدة بكفاءة
        refreshUI();
    } catch (e) {
        console.error("Supabase Fetch Error:", e);
        showToast("⚠️ فشل في جلب البيانات من القاعدة.", "error");
    }
}

function refreshUI() {
    updateDashboard();
    updateDirectory();
    fetchAdmins();
    if(window.lucide) lucide.createIcons();
}

function updateDashboard() {
    const dayFilter = document.getElementById('dayFilter');
    if (!dayFilter) return;

    const selectedDay = dayFilter.value;
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    
    // تحديد التاريخ المستهدف لفحص الإجازة
    const targetDate = selectedDay ? new Date(selectedDay) : now;
    const dayOfWeek = targetDate.getDay();
    const isTargetHoliday = (dayOfWeek === 5 || dayOfWeek === 6);
    const isTodayHoliday = (now.getDay() === 5 || now.getDay() === 6);

    // زر التحضير يبقى متاحاً دائماً (حتى في أيام الإجازة للأيام الاستثنائية)

    // إظهار تنبيه الإجازة
    document.querySelectorAll('.holiday-notice').forEach(el => {
        if (isTodayHoliday) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    // تصفية السجل حسب التاريخ المختار
    let filteredLog = [];
    let periodText = "";

    if (selectedDay) {
        filteredLog = attendance.filter(log => log.isoDate === selectedDay);
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = dayNames[targetDate.getDay()];
        periodText = (selectedDay === todayISO) ? `اليوم (${dayName})` : `${dayName} (${selectedDay})`;
    } else {
        filteredLog = attendance.filter(log => log.isoDate === todayISO);
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = dayNames[now.getDay()];
        periodText = `اليوم (${dayName})`;
    }
    
    const displayMonthElem = document.getElementById('displayMonthName');
    if (displayMonthElem) displayMonthElem.textContent = periodText;

    // حساب عدد أيام حضور كل كشاف وتحديث الأرقام في القائمة
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => {
        scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1;
    });

    scouts.forEach(s => {
        s.currentMonthAttendance = scoutAttendanceMap[s.id] || 0;
    });

    // --- تحديث مركز رؤى القادة ---
    const absentScouts = scouts.filter(s => (scoutAttendanceMap[s.id] || 0) === 0);
    
    // فحص ما إذا كان التاريخ في المستقبل
    const isFuture = selectedDay && (new Date(selectedDay).setHours(0,0,0,0) > new Date().setHours(0,0,0,0));

    // معالجة الحالات الخاصة (إجازة أو تاريخ مستقبلي)
    if (isFuture) {
        document.getElementById('insight-absent-count').textContent = "0";
        document.querySelector('#insight-absent-count').parentElement.nextElementSibling.textContent = "لم يأتِ بعد";
        document.getElementById('insight-best-patrol').textContent = "لا يوجد";
        document.getElementById('insight-total-scans').textContent = "0";
        document.querySelector('#insight-total-scans').parentElement.nextElementSibling.textContent = "في انتظار التاريخ";
        document.getElementById('insight-follow-up-msg').textContent = "هذا التاريخ في المستقبل ⏳";
    } else if (isTargetHoliday) {
        document.getElementById('insight-absent-count').textContent = "0";
        document.querySelector('#insight-absent-count').parentElement.nextElementSibling.textContent = "يوم إجازة";
        document.getElementById('insight-best-patrol').textContent = "إجازة";
        document.getElementById('insight-total-scans').textContent = "0";
        document.querySelector('#insight-total-scans').parentElement.nextElementSibling.textContent = "لا يوجد تحضير";
        document.getElementById('insight-follow-up-msg').textContent = "نهاية أسبوع سعيدة 🌴";
    } else {
        document.getElementById('insight-absent-count').textContent = absentScouts.length;
        document.querySelector('#insight-absent-count').parentElement.nextElementSibling.textContent = `غائب عن ${periodText}`;
        
        const followUpMsg = document.getElementById('insight-follow-up-msg');
        if (absentScouts.length > 0) {
            followUpMsg.textContent = `يوجد ${absentScouts.length} كشاف غائب اليوم.`;
            followUpMsg.style.color = "#fb7185"; 
        } else {
            followUpMsg.textContent = "الجميع حاضر، عمل ممتاز! ✨";
            followUpMsg.style.color = "#34d399";
        }

        document.getElementById('insight-total-scans').textContent = filteredLog.length;
        document.querySelector('#insight-total-scans').parentElement.nextElementSibling.textContent = `حضور ${periodText}`;

        // حساب الفرقة المثالية
        const patrolAttendance = {};
        filteredLog.forEach(log => {
            const s = scouts.find(x => x.id === log.studentId);
            if (s && s.patrol) patrolAttendance[s.patrol] = (patrolAttendance[s.patrol] || 0) + 1;
        });
        
        let bestPatrol = "لا يوجد";
        let maxPatrolCount = 0;
        for (const [p, count] of Object.entries(patrolAttendance)) {
            if (count > maxPatrolCount) {
                maxPatrolCount = count;
                bestPatrol = p;
            }
        }
        document.getElementById('insight-best-patrol').textContent = bestPatrol;

        // --- تحديث ترتيب الطلائع (New Widget) ---
        const leaderboard = document.getElementById('patrolLeaderboard');
        if (leaderboard) {
            const sortedPatrols = Object.entries(patrolAttendance)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            if (sortedPatrols.length > 0) {
                leaderboard.innerHTML = sortedPatrols.map(([p, count], idx) => `
                    <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                        <div class="flex items-center gap-3">
                            <span class="w-6 h-6 flex items-center justify-center rounded-full ${idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-500'} text-[10px] font-bold">${idx + 1}</span>
                            <span class="font-bold text-sm">${p}</span>
                        </div>
                        <span class="text-xs font-black text-indigo-400">${count} حضور</span>
                    </div>
                `).join('');
            } else {
                leaderboard.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-6 text-slate-500 gap-2">
                        <i data-lucide="info" class="w-5 h-5 opacity-20"></i>
                        <p class="text-center text-[10px] italic font-bold">لا توجد بيانات للطلائع اليوم</p>
                    </div>
                `;
            }
        }
    }
    
    // لوحة الشرف
    const topScouts = scouts
        .map(s => ({ ...s, count: scoutAttendanceMap[s.id] || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .filter(s => s.count > 0);

    const topListElem = document.getElementById('topPerformersList');
    if(topScouts.length > 0) {
        topListElem.innerHTML = topScouts.map((s, idx) => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500/50">
                            ${s.photo && s.photo.startsWith('http') ? `<img src="${s.photo}" class="w-full h-full object-cover">` : `<div class="w-full h-full bg-slate-800 flex items-center justify-center text-xs text-slate-500">#${idx+1}</div>`}
                        </div>
                        <div class="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-white font-black">${idx+1}</div>
                    </div>
                    <div>
                        <p class="text-xs font-bold truncate w-24">${getShortName(s.name)}</p>
                        <p class="text-[9px] text-slate-500">${s.patrol}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-black text-amber-500">${s.count}</span>
                    <span class="text-[8px] text-slate-500 block uppercase">يوم</span>
                </div>
            </div>
        `).join('');
    } else {
        topListElem.innerHTML = '<p class="text-slate-500 text-center text-xs italic py-4">لا توجد بيانات لهذه الفترة</p>';
    }
    
    updateScansList(filteredLog, periodText); 
}

function updateCard(idPrefix, scout) {
    document.getElementById(`${idPrefix}-name`).textContent = scout.name;
    document.getElementById(`${idPrefix}-rank`).textContent = `الرتبة: ${scout.rank}`;
    const img = document.getElementById(`${idPrefix}-photo`);
    const icon = img.nextElementSibling;
    
    if(scout.photo && scout.photo.startsWith('http')) {
        img.src = scout.photo;
        img.classList.remove('hidden');
        if(icon) icon.classList.add('hidden');
    } else {
        img.classList.add('hidden');
        if(icon) icon.classList.remove('hidden');
    }
}


function updateDirectory() {
    const grid = document.getElementById('scoutGrid');
    document.getElementById('dir-count').textContent = scouts.length;
    grid.innerHTML = '';
    
    scouts.forEach(s => {
        const card = document.createElement('div');
        card.className = 'glass-card p-5 cursor-pointer group animate-fade-in';
        card.onclick = () => openProfile(s.id);
        
        // Circular Avatar Logic
        const avatarHtml = (s.photo && s.photo.length > 100) 
            ? `<img src="${s.photo}" class="scout-avatar-img">`
            : `<div class="w-full h-full flex items-center justify-center bg-indigo-500/10 text-indigo-400"><i data-lucide="user" class="w-5 h-5"></i></div>`;

        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="scout-avatar-container">
                    ${avatarHtml}
                </div>
                <div class="overflow-hidden flex-1">
                    <h3 class="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">${getShortName(s.name)}</h3>
                    <p class="text-[10px] text-slate-500">${s.rank} • ${s.patrol} • شعبة: ${s.section || '-'}</p>
                    <div class="mt-1.5 flex items-center gap-2">
                        <span class="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-bold">
                            حضر ${s.currentMonthAttendance || 0} أيام هذا الشهر
                        </span>
                        ${s.warnings > 0 ? `<span class="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-md font-bold">⚠️ ${s.warnings}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openProfile(id) {
    const s = scouts.find(x => x.id === id);
    if(!s) return;
    
    // حساب الحضور لهذا الكشاف
    const sa = attendance.filter(a => a.studentId === id);
    
    // حساب "أيام الدوام" التي مرت في الشهر الحالي حتى اليوم (أحد-خميس)
    const now = new Date();
    let workingDaysPassed = 0;
    const tempDate = new Date(now.getFullYear(), now.getMonth(), 1);
    while (tempDate <= now) {
        const d = tempDate.getDay();
        if (d !== 5 && d !== 6) workingDaysPassed++; // استبعاد الجمعة والسبت
        tempDate.setDate(tempDate.getDate() + 1);
    }

    const attendanceCount = sa.length;
    const absenceCount = Math.max(0, workingDaysPassed - attendanceCount);
    const rate = workingDaysPassed > 0 ? Math.round((attendanceCount / workingDaysPassed) * 100) : 0;

    const profileContent = document.getElementById('profilePageContent');
    // Image Fallback for Modal
    const photoHtml = (s.photo && s.photo.length > 100) 
        ? `<img src="${s.photo}" class="w-full h-full object-cover">`
        : `<div class="w-full h-full flex items-center justify-center bg-indigo-500/10 text-indigo-400"><i data-lucide="user" class="w-12 h-12"></i></div>`;

    profileContent.innerHTML = `
        <div class="glass-card p-6 space-y-6">
            <div class="flex flex-col items-center text-center gap-4">
                <div class="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500 shadow-2xl bg-slate-900">
                    ${photoHtml}
                </div>
                <div class="space-y-1">
                    <h2 class="text-2xl font-bold">${s.name}</h2>
                    <div class="flex flex-wrap justify-center gap-2">
                        <span class="px-3 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20">${s.rank}</span>
                        <span class="px-3 py-0.5 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-bold border border-white/10">${s.patrol}</span>
                        <span class="px-3 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">شعبة: ${s.section || '-'}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2 md:gap-3">
                <div class="bg-emerald-500/5 p-2 md:p-3 rounded-2xl border border-emerald-500/10 text-center">
                    <p class="text-lg md:text-xl font-black text-emerald-400">${attendanceCount}</p>
                    <p class="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase">الحضور</p>
                </div>
                <div class="bg-rose-500/5 p-2 md:p-3 rounded-2xl border border-rose-500/10 text-center">
                    <p class="text-lg md:text-xl font-black text-rose-400">${absenceCount}</p>
                    <p class="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase">الغياب</p>
                </div>
                <div class="bg-indigo-500/5 p-2 md:p-3 rounded-2xl border border-indigo-500/10 text-center">
                    <p class="text-lg md:text-xl font-black text-indigo-400">${rate}%</p>
                    <p class="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase">الالتزام</p>
                </div>
            </div>
        </div>

        <div class="glass-card p-6 space-y-4">
            <h3 class="text-base font-bold flex items-center gap-2">
                <i data-lucide="history" class="w-4 h-4 text-indigo-400"></i>
                سجل الحضور الأخير
            </h3>
            <div class="space-y-2">
                ${sa.reverse().slice(0, 5).map(e => `
                    <div class="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                        <span class="text-xs font-bold">${e.date}</span>
                        <span class="text-[10px] text-slate-500">${e.time}</span>
                    </div>
                `).join('') || '<p class="text-slate-500 text-center italic py-4 text-sm">لا توجد بيانات حضور</p>'}
            </div>
        </div>

        <div class="flex flex-col gap-3">
            <div class="flex gap-3">
                <button onclick="updateWarning('${s.id}', 1)" class="flex-1 py-3 rounded-xl bg-rose-500/10 text-rose-400 text-sm font-bold hover:bg-rose-500/20 transition-all border border-rose-500/20">إضافة إنذار</button>
                <button onclick="updateWarning('${s.id}', -1)" class="flex-1 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-all border border-emerald-500/20">تصفير</button>
            </div>
            <div class="flex gap-3">
                <button onclick="openEditModal('${s.id}')" class="flex-1 py-4 rounded-xl bg-white/5 text-indigo-400 text-sm font-bold hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                    تعديل البيانات
                </button>
                <button onclick="startProgramming('${s.id}')" class="flex-[2] py-4 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                    <i data-lucide="nfc" class="w-5 h-5"></i>
                    برمجة البطاقة
                </button>
            </div>
        </div>
    `;
    
    showPage('profile');
    lucide.createIcons();
}

function openEditModal(id) {
    const scout = scouts.find(s => String(s.id).trim() === String(id).trim());
    if(!scout) return;

    document.getElementById('edit-old-id').value = scout.id;
    document.getElementById('edit-id').value = scout.id;
    document.getElementById('edit-name').value = scout.name;
    document.getElementById('edit-rank').value = scout.rank;
    document.getElementById('edit-patrol').value = scout.patrol;
    document.getElementById('edit-warnings').value = scout.warnings || 0;
    // تم إزالة تعبئة الكود السري (PIN)

    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

async function saveScoutChanges() {
    const oldId = document.getElementById('edit-old-id').value;
    const photoInput = document.getElementById('edit-photo');
    const photoFile = photoInput.files ? photoInput.files[0] : null;
    
    // جلب البيانات القديمة للحفاظ على الصورة إذا لم يتم تغييرها
    const oldScout = scouts.find(s => String(s.id).trim() === String(oldId).trim());
    let finalPhotoUrl = oldScout ? oldScout.photo : '';

    try {
        // إذا اختار المستخدم صورة جديدة، نقوم برفعها
        if (photoFile) {
            showToast("⏳ جاري رفع الصورة الجديدة...", "info");
            finalPhotoUrl = await uploadFile(photoFile);
        }

        const newData = {
            id: document.getElementById('edit-id').value,
            name: document.getElementById('edit-name').value,
            rank: document.getElementById('edit-rank').value,
            patrol: document.getElementById('edit-patrol').value,
            warnings: parseInt(document.getElementById('edit-warnings').value) || 0,
            photo: finalPhotoUrl
        };

        const { error } = await _supabase
            .from('scouts')
            .update(newData)
            .eq('id', oldId);

        if(error) throw error;

        showToast("✅ تم تحديث بيانات الكشاف!", "success");
        closeEditModal();
        fetchData(); 
        if (document.getElementById('page-profile').classList.contains('hidden') === false) {
             openProfile(newData.id); // إعادة فتح الملف الشخصي بالبيانات الجديدة
        }
    } catch(err) {
        console.error(err);
        showToast("❌ فشل التحديث: " + err.message, "error");
    }
}



async function toggleScanner(state) {
    console.log("Toggle Scanner:", state);
    isScanning = state;
    const overlay = document.getElementById('scanOverlay');
    const bottomNav = document.getElementById('mobileBottomNav');
    const scannerContent = document.getElementById('scannerContent');
    const scanSummary = document.getElementById('scanSummary');

    if(state) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        scannerContent.classList.remove('hidden');
        scanSummary.classList.add('hidden');
        if(bottomNav) bottomNav.style.visibility = 'hidden';
        updateScanCounts();
    } else {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        if(bottomNav) bottomNav.style.visibility = 'visible';
        
        console.log("Aborting scan...");
        if (scanAbortController) {
            try {
                scanAbortController.abort();
            } catch(e) { console.error("Abort error:", e); }
            scanAbortController = null;
        }
    }
    
    const scanResult = document.getElementById('scanResult');
    if (scanResult) scanResult.classList.add('hidden');
    
    if(state) {
        if ('NDEFReader' in window) {
            try {
                scanAbortController = new AbortController();
                const ndef = new NDEFReader();
                await ndef.scan({ signal: scanAbortController.signal });
                ndef.onreading = e => {
                    let scannedId = e.serialNumber;
                    for (const record of e.message.records) {
                        if (record.recordType === "text") {
                            const textDecoder = new TextDecoder(record.encoding);
                            scannedId = textDecoder.decode(record.data);
                            break;
                        }
                    }
                    handleScan(scannedId);
                };
            } catch(err) { 
                console.error(err);
                showToast("❌ فشل تشغيل القارئ: " + err.message, "error");
            }
        } else {
            console.log("Web NFC API not available — using keyboard wedge for USB NFC reader.");
        }
    }
}

function updateScanCounts() {
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    const presentIds = attendance.filter(a => a.isoDate === todayISO).map(a => String(a.studentId).trim());
    const presentCount = [...new Set(presentIds)].length;
    const totalCount = scouts.length;
    const absentCount = Math.max(0, totalCount - presentCount);

    const presentElem = document.getElementById('scan-present-count');
    const absentElem = document.getElementById('scan-absent-count');
    if (presentElem) presentElem.textContent = presentCount;
    if (absentElem) absentElem.textContent = absentCount;
}

function finishAttendanceSession() {
    const scannerContent = document.getElementById('scannerContent');
    const scanSummary = document.getElementById('scanSummary');
    const absentListSummary = document.getElementById('absentListSummary');

    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    const presentIds = attendance.filter(a => a.isoDate === todayISO).map(a => String(a.studentId).trim());
    const absentScouts = scouts.filter(s => !presentIds.includes(String(s.id).trim()));

    absentListSummary.innerHTML = absentScouts.map(s => `
        <div class="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
            <div class="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <i data-lucide="user-x" class="w-5 h-5"></i>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold text-white">${getShortName(s.name)}</p>
                <p class="text-[10px] text-slate-500">${s.patrol}</p>
            </div>
        </div>
    `).join('') || '<p class="col-span-full text-center py-10 text-emerald-400 font-bold">كل الكشافة حاضرون اليوم! 🎉</p>';

    scannerContent.classList.add('hidden');
    scanSummary.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

// --- NFC Writing Logic ---
let isProgramming = false;
let abortController = null;

async function clearAnyNfcCard() {
    const overlay = document.getElementById('writeOverlay');
    const title = document.getElementById('writeOverlayTitle');
    const sub = document.getElementById('writeOverlaySub');
    const targetName = document.getElementById('writeTargetName');
    
    if (title) title.textContent = "مسح ربط البطاقة";
    if (sub) sub.innerHTML = "مرر البطاقة على القارئ لإزالة ربطها بالكشاف";
    if (targetName) targetName.textContent = "";

    isProgramming = true;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    document.getElementById('writeStatus').classList.remove('hidden');
    document.getElementById('writeSuccess').classList.add('hidden');
    
    const bottomNav = document.getElementById('mobileBottomNav');
    if(bottomNav) bottomNav.style.visibility = 'hidden';
    
    // إيقاف أي عملية مسح نشطة لتجنب التداخل
    if (isScanning) toggleScanner(false);

    if ('NDEFReader' in window) {
        try {
            abortController = new AbortController();
            const ndef = new NDEFReader();
            await ndef.write("", { signal: abortController.signal });
            
            showToast("✅ تم مسح البطاقة بنجاح", "success");
            document.getElementById('writeStatus').classList.add('hidden');
            document.getElementById('writeSuccess').classList.remove('hidden');
            setTimeout(stopProgramming, 2000);
        } catch (error) {
            console.error(error);
            if (error.name !== 'AbortError') {
                showToast("❌ فشل مسح البطاقة: " + error.message, "error");
            }
            stopProgramming();
        }
    } else {
        // Desktop: scan card via USB reader, then remove its link from DB
        let clearBuffer = '';
        let clearTimer;
        
        window._progKeyHandler = function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (/^\d$/.test(e.key)) {
                clearBuffer += e.key;
                clearTimeout(clearTimer);
                clearTimer = setTimeout(() => { clearBuffer = ''; }, 150);
            } else if (e.key === 'Enter' && clearBuffer.length >= 4) {
                const cardUID = clearBuffer;
                clearBuffer = '';
                e.preventDefault();
                document.removeEventListener('keydown', window._progKeyHandler);
                
                // Find scout with this card and remove link
                unlinkCard(cardUID);
            }
        };
        
        document.addEventListener('keydown', window._progKeyHandler);
    }
}

async function unlinkCard(cardUID) {
    try {
        const scout = scouts.find(s => s.nfc_uid === cardUID);
        
        if (scout) {
            await _supabase
                .from('scouts')
                .update({ nfc_uid: null })
                .eq('id', scout.id);
            
            scout.nfc_uid = null;
            showToast(`✅ تم إزالة ربط البطاقة من ${scout.name}`, "success");
        } else {
            showToast("⚠️ هذه البطاقة غير مربوطة بأي كشاف", "info");
        }
        
        document.getElementById('writeStatus').classList.add('hidden');
        document.getElementById('writeSuccess').classList.remove('hidden');
        const successTitle = document.getElementById('writeSuccess').querySelector('h3');
        if (successTitle) successTitle.textContent = "تم مسح الربط!";
        
        setTimeout(stopProgramming, 2000);
    } catch (err) {
        console.error("Unlink Error:", err);
        showToast("❌ فشل إزالة الربط: " + err.message, "error");
        stopProgramming();
    }
}

async function startProgramming(scoutId) {
    const scout = scouts.find(s => String(s.id).trim() === String(scoutId).trim());
    if (!scout) {
        showToast("❌ هذا الرقم غير مسجل", "error");
        return;
    }

    isProgramming = true;
    const overlay = document.getElementById('writeOverlay');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    document.getElementById('writeTargetName').textContent = scout.name;
    document.getElementById('writeSuccess').classList.add('hidden');
    document.getElementById('writeStatus').classList.remove('hidden');
    
    // Update overlay text for linking mode
    const title = document.getElementById('writeOverlayTitle');
    const sub = document.getElementById('writeOverlaySub');
    if (title) title.textContent = "ربط البطاقة";
    if (sub) sub.innerHTML = `مرر بطاقة الكشاف <span class="text-indigo-400 font-bold">${scout.name}</span> على القارئ الآن`;

    const bottomNav = document.getElementById('mobileBottomNav');
    if(bottomNav) bottomNav.style.visibility = 'hidden';
    
    // إيقاف أي عملية مسح نشطة لتجنب التداخل
    if (isScanning) toggleScanner(false);

    if ('NDEFReader' in window) {
        // Mobile: Use Web NFC API to write to the tag
        try {
            abortController = new AbortController();
            const ndef = new NDEFReader();
            await ndef.write({
                records: [{ recordType: "text", data: String(scoutId) }]
            }, { signal: abortController.signal });
            
            document.getElementById('writeStatus').classList.add('hidden');
            document.getElementById('writeSuccess').classList.remove('hidden');
            if(window.safeStorage.getItem('scout-pulse-sound') !== 'false') playBeep();
            
            setTimeout(stopProgramming, 3000);
        } catch (error) {
            console.error("NFC Write Error:", error);
            if (error.name !== 'AbortError') {
                showToast("❌ فشلت عملية البرمجة: " + error.message, "error");
            }
            stopProgramming();
        }
    } else {
        // Desktop: Use USB NFC reader (keyboard wedge) — listen for card UID scan
        let progBuffer = '';
        let progTimer;
        
        window._progKeyHandler = function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (/^\d$/.test(e.key)) {
                progBuffer += e.key;
                clearTimeout(progTimer);
                progTimer = setTimeout(() => { progBuffer = ''; }, 150);
            } else if (e.key === 'Enter' && progBuffer.length >= 4) {
                const cardUID = progBuffer;
                progBuffer = '';
                e.preventDefault();
                
                // Link this card UID to the scout in the database
                linkCardToScout(scoutId, cardUID, scout.name);
                document.removeEventListener('keydown', window._progKeyHandler);
            }
        };
        
        document.addEventListener('keydown', window._progKeyHandler);
    }
}

async function linkCardToScout(scoutId, cardUID, scoutName) {
    try {
        // Save the card UID mapping in Supabase
        const { error } = await _supabase
            .from('scouts')
            .update({ nfc_uid: cardUID })
            .eq('id', scoutId);
        
        if (error) throw error;
        
        // Update local data
        const scout = scouts.find(s => String(s.id).trim() === String(scoutId).trim());
        if (scout) scout.nfc_uid = cardUID;
        
        document.getElementById('writeStatus').classList.add('hidden');
        document.getElementById('writeSuccess').classList.remove('hidden');
        
        const successTitle = document.getElementById('writeSuccess').querySelector('h3');
        if (successTitle) successTitle.textContent = "تم ربط البطاقة بنجاح!";
        
        if(window.safeStorage.getItem('scout-pulse-sound') !== 'false') playBeep();
        showToast(`✅ تم ربط البطاقة ${cardUID} بالكشاف ${scoutName}`, "success");
        
        setTimeout(stopProgramming, 3000);
    } catch (err) {
        console.error("Link Card Error:", err);
        showToast("❌ فشل ربط البطاقة: " + err.message, "error");
        stopProgramming();
    }
}

function stopProgramming() {
    isProgramming = false;
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    // Clean up keyboard wedge listener if active
    if (window._progKeyHandler) {
        document.removeEventListener('keydown', window._progKeyHandler);
        window._progKeyHandler = null;
    }
    document.getElementById('writeOverlay').style.display = 'none';
    document.getElementById('writeOverlay').classList.add('hidden');
    
    const bottomNav = document.getElementById('mobileBottomNav');
    if(bottomNav) bottomNav.style.visibility = 'visible';
    
    // إعادة تعيين نصوص النجاح والعنوان
    const successTitle = document.getElementById('writeSuccess').querySelector('h3');
    if (successTitle) successTitle.textContent = "تمت البرمجة بنجاح!";
    const overlayTitle = document.getElementById('writeOverlayTitle');
    if (overlayTitle) overlayTitle.textContent = "جاهز للبرمجة";
}



function setupKeyboardEmulator() {
    document.addEventListener('keydown', e => {
        // Ignored if typing in a normal input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if(e.key === 'Enter') {
            if(keyboardBuffer.length >= 4) {
                // We got a full scan! Auto-process it even if isScanning is false.
                handleScan(keyboardBuffer);
            }
            keyboardBuffer = "";
        } else if(e.key.length === 1 && /^\d$/.test(e.key)) {
            keyboardBuffer += e.key;
            clearTimeout(bufferTimer);
            bufferTimer = setTimeout(() => keyboardBuffer = "", 150);
        }
    });
}

let recentScans = [];

async function handleScan(id) {
    
    // إذا كان المعرف عبارة عن رابط (بسبب الحل الجذري)، نستخرج الرقم منه
    let processedId = id;
    if (String(id).includes('scanId=')) {
        try {
            const url = new URL(id);
            processedId = url.searchParams.get('scanId');
        } catch(e) {
            // إذا فشل التحليل كرابط، نحاول استخراجها يدوياً
            processedId = id.split('scanId=')[1];
        }
    }
    
    // البحث عن الكشاف باستخدام المعرف المعالج (أو عبر nfc_uid)
    const scout = scouts.find(s => 
        String(s.id).trim() === String(processedId).trim() || 
        (s.nfc_uid && String(s.nfc_uid).trim() === String(processedId).trim())
    );
    const res = document.getElementById('scanResult');
    if (res) res.classList.remove('hidden', 'bg-emerald-500', 'bg-rose-500');

    if(scout) {
        const actualScoutId = scout.id;
        try {
            const now = new Date();
            const todayISO = now.toISOString().split('T')[0];
            const todayAr = now.toLocaleDateString('ar-EG');
            
            // التحقق من الحضور المسبق
            const { data: existing } = await _supabase
                .from('attendance')
                .select('*')
                .eq('scout_id', actualScoutId)
                .filter('created_at', 'gte', todayISO + 'T00:00:00Z');

            if(existing && existing.length > 0) {
                if (res) {
                    res.textContent = `⚠️ ${scout.name} محضر بالفعل!`;
                    res.classList.add('bg-rose-500');
                } else {
                    showToast(`⚠️ ${scout.name} محضر بالفعل!`, "warning");
                }
            } else {
                // تسجيل الحضور بالصيغة العالمية لضمان عمل التقارير
                await _supabase.from('attendance').insert({
                    scout_id: actualScoutId,
                    date: todayAr // نحتفظ بالعربي للعرض فقط
                });

                // إضافة للسجل المحلي فوراً لتحسين الاستجابة السريعة
                attendance.unshift({
                    studentId: actualScoutId,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    date: todayAr,
                    isoDate: todayISO
                });

                if (res) {
                    res.textContent = `✅ تم تحضير: ${scout.name}`;
                    res.classList.add('bg-emerald-500');
                }
                showToast(`✅ تم تحضير: ${scout.name}`, "success");
                if(window.safeStorage.getItem('scout-pulse-sound') !== 'false') playBeep();
                
                // Add to recent scans
                recentScans.unshift({
                    name: scout.name,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }),
                    photo: scout.photo
                });
                if(recentScans.length > 5) recentScans.pop();
                
                updateDashboard(); // تحديث الأرقام والواجهة الرئيسية
                updateScanCounts(); // تحديث العدادات في واجهة المسح
                fetchData(); // مزامنة نهائية مع القاعدة
            }
        } catch (e) { console.error(e); }
    } else {
        if (res) {
            res.textContent = "❌ كشاف غير معروف!";
            res.classList.add('bg-rose-500');
        }
        showToast("❌ هذه البطاقة غير مسجلة في النظام", "error");
    }
    
    setTimeout(() => { if(isScanning && res) res.classList.add('hidden'); }, 3000);
}

function updateScansList(logs, period) {
    const list = document.getElementById('recentScansList');
    const periodLabel = document.getElementById('scansListPeriod');
    
    if (periodLabel) periodLabel.textContent = period;

    if (!logs || logs.length === 0) {
        list.innerHTML = `<div class="text-center py-6 text-slate-500 italic text-sm">لا توجد عمليات تحضير في ${period}</div>`;
        return;
    }
    
    // عرض آخر 10 عمليات في هذه الفترة
    const displayLogs = logs.slice(0, 10);
    
    list.innerHTML = displayLogs.map(log => {
        const s = scouts.find(x => x.id === log.studentId);
        if (!s) return '';
        
        return `
            <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 animate-slide-up">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-indigo-500/30">
                        ${s.photo && s.photo.startsWith('http') 
                            ? `<img src="${s.photo}" class="w-full h-full object-cover">`
                            : `<i data-lucide="user" class="w-6 h-6 text-slate-500"></i>`}
                    </div>
                    <div>
                        <p class="font-bold">${s.name}</p>
                        <p class="text-[10px] text-indigo-400 font-bold uppercase">${log.date}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-slate-400">${log.time}</p>
                </div>
            </div>
        `;
    }).join('');
}

function showScanResult(scout) {
    const res = document.getElementById('scanResult');
    const photoContainer = document.getElementById('resultPhotoContainer') || document.getElementById('resultPhoto');
    
    document.getElementById('resultName').textContent = scout.name;
    document.getElementById('resultRank').textContent = scout.rank;
    
    if (scout.photo && scout.photo.startsWith('http')) {
        photoContainer.innerHTML = `<img src="${scout.photo}" class="w-full h-full object-cover rounded-full border-4 border-indigo-500 shadow-xl">`;
    } else {
        photoContainer.innerHTML = `<div class="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-indigo-500 shadow-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400"><i data-lucide="user" class="w-16 h-16"></i></div>`;
    }
    
    res.classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => { if(isScanning) res.classList.add('hidden'); }, 3000);
}

function setupSearch() {
    document.getElementById('scoutSearch').addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#scoutGrid > div').forEach(card => {
            const isMatch = card.innerText.toLowerCase().includes(term);
            card.style.display = isMatch ? 'block' : 'none';
        });
    });
}

// --- Management & Settings Logic ---

async function addNewScout() {
    const name = document.getElementById('new-name').value.trim();
    const id = document.getElementById('new-id').value.trim();
    const rank = document.getElementById('new-rank').value.trim();
    const patrol = document.getElementById('new-patrol').value.trim();
    const photoInput = document.getElementById('new-photo');
    const photoFile = photoInput.files ? photoInput.files[0] : null;

    if (!name || !id) {
        showToast("⚠️ يرجى إدخال الاسم ورقم الهوية", "error");
        return;
    }

    try {
        let photoUrl = "";
        if (photoFile) {
            showToast("⏳ جاري رفع الصورة...", "info");
            photoUrl = await uploadFile(photoFile);
        }

        const data = {
            id,
            name,
            rank,
            patrol,
            photo: photoUrl,
            warnings: 0
        };

        const { error } = await _supabase
            .from('scouts')
            .insert(data);

        if(error) throw error;

        showToast("✅ تم إضافة الكشاف بنجاح!", "success");
        document.getElementById('addScoutForm').reset();
        fetchData(); 
    } catch(err) { 
        console.error(err);
        showToast("❌ فشل إضافة الكشاف: " + err.message, "error");
    }
}



async function updateWarning(id, change) {
    try {
        const scout = scouts.find(s => String(s.id).trim() === String(id).trim());
        if(!scout) return;
        const newWarnings = change === -1 ? 0 : (scout.warnings || 0) + change;
        const { error } = await _supabase.from('scouts').update({ warnings: newWarnings }).eq('id', id);
        if(error) throw error;
        showToast(change > 0 ? "⚠️ تم إضافة إنذار" : "✅ تم تصفير الإنذارات", change > 0 ? "info" : "success");
        fetchData();
    } catch(err) { showToast("❌ فشل تحديث الإنذارات", "error"); }
}

function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    let icon = "info";
    if(type === "success") icon = "check-circle";
    if(type === "error") icon = "alert-circle";
    
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <span class="font-bold text-sm">${message}</span>
    `;
    container.appendChild(toast);
    if(window.lucide) lucide.createIcons();
    
    setTimeout(() => {
        toast.style.animation = "toast-in 0.5s reverse forwards";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

/**
 * Custom Confirmation Modal Utility
 */
function showConfirm(title, message, needsPass = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const inputArea = document.getElementById('confirmInputArea');
        const passInput = document.getElementById('confirmPass');
        const actionBtn = document.getElementById('confirmActionBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        passInput.value = "";
        
        if (needsPass) inputArea.classList.remove('hidden');
        else inputArea.classList.add('hidden');

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        if(window.lucide) lucide.createIcons();

        const handleConfirm = () => {
            if (needsPass && passInput.value !== "admin") {
                showToast("❌ كلمة المرور غير صحيحة", "error");
                return;
            }
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            actionBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        actionBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

function openExportModal(format) {
    const modal = document.getElementById('exportModal');
    const downloadBtn = document.getElementById('downloadBtn');
    const printBtn = document.getElementById('printBtn');
    modal.classList.remove('hidden');
    
    if (format === 'pdf') printBtn.classList.remove('hidden');
    else printBtn.classList.add('hidden');

    downloadBtn.onclick = () => {
        const period = document.getElementById('exportPeriod').value;
        let periodName = document.getElementById('exportPeriod').options[document.getElementById('exportPeriod').selectedIndex].text;
        
        // تحسين اسم الملف بناءً على الاختيار
        if (period === 'today') {
            periodName = new Date().toLocaleDateString('ar-EG').replace(/\//g, '-');
        } else if (period === 'all') {
            periodName = `السجل السنوي ${new Date().getFullYear()}`;
        }

        if (format === 'excel') executeExcelExport(period, periodName);
        else executePDFExport(period, periodName, 'download');
        closeExportModal();
    };

    printBtn.onclick = () => {
        const period = document.getElementById('exportPeriod').value;
        let periodName = document.getElementById('exportPeriod').options[document.getElementById('exportPeriod').selectedIndex].text;
        
        if (period === 'today') {
            periodName = new Date().toLocaleDateString('ar-EG');
        } else if (period === 'all') {
            periodName = `السجل السنوي ${new Date().getFullYear()}`;
        }

        executePDFExport(period, periodName, 'print');
        closeExportModal();
    };
}

function closeExportModal() { document.getElementById('exportModal').classList.add('hidden'); }

function getFilteredAttendanceForPeriod(period) {
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    
    if (period === 'all') return attendance;
    if (period === 'today') return attendance.filter(log => log.isoDate === todayISO);
    
    // For months like "2026-04"
    return attendance.filter(log => log.isoDate && log.isoDate.startsWith(period));
}

function executeExcelExport(period, periodName) {
    showToast(`📊 جاري تصدير Excel لـ ${periodName}...`, "info");
    const filteredLog = getFilteredAttendanceForPeriod(period);
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => { scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1; });

    let csv = "\uFEFFالاسم,الرتبة,الفرقة,أيام الحضور\n";
    scouts.forEach(s => { 
        csv += `"${s.name}","${s.rank}","${s.patrol}",${scoutAttendanceMap[s.id] || 0}\n`; 
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `سجل_${periodName.replace(/\s+/g, '_')}.csv`);
    link.click();
}

function executePDFExport(period, periodName, mode = 'download') {
    showToast(mode === 'download' ? `⏳ جاري تحميل تقرير ${periodName}...` : `🖨️ جاري تجهيز طباعة تقرير ${periodName}...`, "info");
    const filteredLog = getFilteredAttendanceForPeriod(period);
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => { scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1; });

    // Calculate denominator for the rate
    let denominator = 30; // Default for month
    if (period === 'today') denominator = 1;
    else if (period === 'all') denominator = 100; // Just a placeholder for total

    let tableRows = scouts.map(s => {
        const att = scoutAttendanceMap[s.id] || 0;
        let rateDisplay = "";
        
        if (period === 'today') {
            rateDisplay = att > 0 ? "حاضر" : "غائب";
        } else {
            const rate = Math.round((att / denominator) * 100);
            rateDisplay = `${rate}%`;
        }

        return `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px; text-align:right;"><b>${s.name}</b></td>
                <td style="padding:12px; text-align:center;">${s.rank} / ${s.patrol}</td>
                <td style="padding:12px; text-align:center; font-weight:bold; color:${att > 0 ? '#10b981' : '#ef4444'}">${att}</td>
                <td style="padding:12px; text-align:center;">
                    <span style="padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold; ${att > 0 ? 'background:#ecfdf5; color:#10b981;' : 'background:#fff1f2; color:#ef4444;'}">
                        ${rateDisplay}
                    </span>
                </td>
            </tr>`;
    }).join('');

    const element = document.createElement('div');
    element.innerHTML = `
        <div style="direction:rtl; padding:40px; font-family:'Cairo', sans-serif; background:#fff; color:#1e293b; min-height:290mm;">
            <!-- Header Section -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:4px solid #6366f1; padding-bottom:25px; margin-bottom:35px;">
                <div style="text-align:right;">
                    <h1 style="margin:0; color:#1e293b; font-size:28px; font-weight:900;">سجل حضور الكشافة</h1>
                    <p style="margin:5px 0 0; color:#6366f1; font-size:16px; font-weight:bold;">كشافة عبدالرحمن بن القاسم</p>
                </div>
                <div style="text-align:left;">
                    <div style="background:#f8fafc; padding:10px 20px; border-radius:15px; border:1px solid #e2e8f0;">
                        <p style="margin:0; font-size:12px; color:#64748b; font-weight:bold;">الفترة التقاريرية</p>
                        <p style="margin:5px 0 0; font-size:18px; color:#0f172a; font-weight:900;">${periodName}</p>
                    </div>
                    <p style="margin:10px 0 0; font-size:11px; color:#94a3b8; text-align:center;">تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</p>
                </div>
            </div>

            <!-- Stats Overview (Quick Glance) -->
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; margin-bottom:35px;">
                <div style="background:#f0f9ff; padding:20px; border-radius:20px; border:1px solid #bae6fd; text-align:center;">
                    <p style="margin:0; font-size:12px; color:#0369a1; font-weight:bold;">إجمالي الأعضاء</p>
                    <p style="margin:5px 0 0; font-size:24px; color:#0c4a6e; font-weight:900;">${scouts.length}</p>
                </div>
                <div style="background:#f0fdf4; padding:20px; border-radius:20px; border:1px solid #bbf7d0; text-align:center;">
                    <p style="margin:0; font-size:12px; color:#15803d; font-weight:bold;">إجمالي الحضور</p>
                    <p style="margin:5px 0 0; font-size:24px; color:#064e3b; font-weight:900;">${filteredLog.length}</p>
                </div>
                <div style="background:#f5f3ff; padding:20px; border-radius:20px; border:1px solid #ddd6fe; text-align:center;">
                    <p style="margin:0; font-size:12px; color:#6d28d9; font-weight:bold;">نوع التقرير</p>
                    <p style="margin:5px 0 0; font-size:18px; color:#4c1d95; font-weight:900;">${period === 'today' ? 'يومي' : 'شهري'}</p>
                </div>
            </div>

            <!-- Table Section -->
            <table style="width:100%; border-collapse:separate; border-spacing:0; margin-bottom:50px;">
                <thead>
                    <tr style="background:#6366f1; color:#ffffff;">
                        <th style="padding:15px; text-align:right; border-radius:15px 0 0 0; font-size:14px;">الكشاف</th>
                        <th style="padding:15px; text-align:center; font-size:14px;">الرتبة / الفرقة</th>
                        <th style="padding:15px; text-align:center; font-size:14px;">أيام الحضور</th>
                        <th style="padding:15px; text-align:center; border-radius:0 15px 0 0; font-size:14px;">الحالة / الالتزام</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>

            <!-- Signatures Section -->
            <div style="margin-top:auto; padding-top:60px; display:flex; justify-content:space-between; gap:100px;">
                <div style="flex:1; text-align:center;">
                    <p style="margin:0 0 50px; font-weight:900; font-size:16px; color:#1e293b;">قائد الفرقة</p>
                    <div style="border-top:2px dashed #cbd5e1; width:200px; margin:0 auto;"></div>
                    <p style="margin:10px 0 0; font-size:12px; color:#94a3b8;">التوقيع والختم</p>
                </div>
                <div style="flex:1; text-align:center;">
                    <p style="margin:0 0 50px; font-weight:900; font-size:16px; color:#1e293b;">مدير المدرسة</p>
                    <div style="border-top:2px dashed #cbd5e1; width:200px; margin:0 auto;"></div>
                    <p style="margin:10px 0 0; font-size:12px; color:#94a3b8;">التوقيع والختم</p>
                </div>
            </div>

            <!-- Footer -->
            <div style="margin-top:80px; text-align:center; border-top:1px solid #f1f5f9; padding-top:20px;">
                <p style="margin:0; font-size:10px; color:#94a3b8;">تم إنشاء هذا التقرير آلياً عبر نظام كشافة عبدالرحمن بن القاسم الرقمي</p>
            </div>
        </div>`;

    if (mode === 'print') {
        const printArea = document.getElementById('print-report');
        printArea.innerHTML = element.innerHTML;
        setTimeout(() => { window.print(); }, 500);
    } else {
        const opt = {
            margin: 0,
            filename: `تقرير_حضور_${periodName.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }
}

async function confirmResetAttendance() {
    const confirmed = await showConfirm(
        "تصفير السجلات", 
        "هل أنت متأكد من حذف جميع سجلات الحضور؟ هذا الإجراء لا يمكن التراجع عنه!", 
        true
    );

    if (confirmed) {
            try {
                // تصفير الحضور من Supabase
                const { error } = await _supabase
                    .from('attendance')
                    .delete()
                    .neq('id', 0); // حذف كل الأسطر التي معرفها ليس 0 (أي الكل)

                if(error) throw error;

                showToast("✅ تم تصفير البيانات بنجاح.", "success");
                fetchData();
            } catch(err) { 
                console.error(err);
                showToast("❌ فشل تصفير البيانات.", "error");
        }
    }
}

// Settings Persistence
document.getElementById('setting-sound').addEventListener('change', e => {
    window.safeStorage.setItem('scout-pulse-sound', e.target.checked);
});

document.getElementById('setting-dark').addEventListener('change', e => {
    document.body.classList.toggle('light-mode', !e.target.checked);
    window.safeStorage.setItem('scout-pulse-dark', e.target.checked);
});

function playBeep() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play blocked by browser'));
}

function startLiveClock() {
    setInterval(() => {
        const clock = document.getElementById('liveClock');
        if (clock) {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'م' : 'ص';
            hours = hours % 12;
            hours = hours ? hours : 12; // الساعة 0 تصبح 12
            
            // تحويل الأرقام إلى عربية (اختياري، لكنه يضمن الاتساق)
            const arabicNumbers = (n) => n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
            
            clock.textContent = `${arabicNumbers(hours)}:${arabicNumbers(minutes)}:${arabicNumbers(seconds)} ${ampm}`;
        }
    }, 1000);
}

// --- Authentication & Authorization Logic ---

async function checkAndProvisionFirstAdmin() {
    try {
        const { data, count, error } = await _supabase.from('admins').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.warn("Admins table might not exist yet or no access.");
            return;
        }

        if (count === 0) {
            console.log("No admins found. Provisioning primary admin...");
            // إضافة المسؤول الأول (عمرو)
            await _supabase.from('admins').insert([
                { 
                    email: 'amro.motawa@gmail.com', 
                    id_number: '2282125646', 
                    is_primary: true 
                }
            ]);
            showToast("ℹ️ تم إعداد حساب المسؤول الرئيسي بنجاح", "info");
        }
    } catch (e) {
        console.error("Provisioning check failed:", e);
    }
}

async function sendActualEmail(email, code) {
    console.log(`Sending Email to ${email}: ${code}`);
    
    // لإرسال بريد حقيقي، يمكنك استخدام EmailJS كالتالي:
    /*
    emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
        to_email: email,
        otp_code: code
    }, "YOUR_PUBLIC_KEY");
    */
    
    // للتجربة الآن: سنظهر الكود في تنبيه ونخبرك أنه جاهز للربط بالبريد
    showToast(`📧 تم إرسال كود التحقق لبريدك الإلكتروني بنجاح`, "success");
    console.log("Real OTP generated for email:", code);
}

async function requestAuthCode() {
    const email = document.getElementById('login-email').value.trim();

    if (!email) {
        showToast("⚠️ يرجى إدخال البريد الإلكتروني", "error");
        return;
    }

    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> جاري الإرسال...';
    lucide.createIcons();

    try {
        // 1. التأكد أولاً أن البريد مسجل في القائمة المسموحة
        const { data: admin, error: adminError } = await _supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .single();

        if (adminError || !admin) {
            showToast("❌ هذا البريد غير مسجل ضمن القائمة المسموح لها بالدخول", "error");
            btn.disabled = false;
            btn.innerHTML = '<span>إرسال رمز التحقق (Email)</span>';
            return;
        }

        // 2. طلب إرسال الرمز الحقيقي من Supabase
        const { error: authError } = await _supabase.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true // سيتم إنشاء مستخدم في Auth إذا لم يكن موجوداً
            }
        });

        if (authError) {
            throw authError;
        }

        showToast("✅ تم إرسال رمز التحقق لبريدك الإلكتروني", "success");
        tempLoginData = admin;
        
        document.getElementById('auth-step-1').classList.add('hidden');
        document.getElementById('auth-step-2').classList.remove('hidden');
        
        // بدء مؤقت إعادة الإرسال
        startResendTimer();
    } catch (err) {
        console.error("Auth Error:", err);
        showToast("❌ فشل إرسال الرمز: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>إرسال رمز التحقق (Email)</span>';
        lucide.createIcons();
    }
}

var resendInterval = null;
function startResendTimer() {
    const resendBtn = document.getElementById('resendCodeBtn');
    if (!resendBtn) return;

    let seconds = 60;
    resendBtn.disabled = true;
    
    if (resendInterval) clearInterval(resendInterval);
    
    resendInterval = setInterval(() => {
        seconds--;
        resendBtn.textContent = `إعادة الإرسال خلال (${seconds}ث)`;
        
        if (seconds <= 0) {
            clearInterval(resendInterval);
            resendBtn.disabled = false;
            resendBtn.textContent = "إعادة إرسال الرمز";
        }
    }, 1000);
}

async function verifyAuthCode() {
    const email = document.getElementById('login-email').value.trim();
    const token = document.getElementById('login-otp').value.trim();

    if (!token) {
        showToast("⚠️ يرجى إدخال الرمز", "error");
        return;
    }

    try {
        // التحقق من الرمز عبر Supabase
        const { data, error } = await _supabase.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (error) {
            throw error;
        }

        showToast("✅ تم التحقق بنجاح! جاري الدخول...", "success");
        
        // حفظ بيانات المسؤول في الجلسة المحلية
        currentUser = tempLoginData;
        window.safeStorage.setItem('admin_session', JSON.stringify(currentUser));
        
        // حفظ البريد للتذكر (Auto-fill)
        window.safeStorage.setItem('remembered_email', currentUser.email);
        
        updateGreeting();
        
        document.getElementById('authOverlay').classList.add('hidden');
        document.getElementById('admin-management-section').classList.remove('hidden');
        fetchAdmins();
    } catch (err) {
        console.error("Verify Error:", err);
        showToast("❌ الرمز غير صحيح أو انتهت صلاحيته", "error");
    }
}

function updateGreeting() {
    if (!currentUser || !currentUser.full_name) return;
    const firstName = currentUser.full_name.split(' ')[0];
    const el = document.getElementById('user-first-name');
    if (el) el.textContent = firstName;
}

function resetAuth() {
    document.getElementById('auth-step-1').classList.remove('hidden');
    document.getElementById('auth-step-2').classList.add('hidden');
    currentOTP = null;
    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send"></i> إرسال رمز التحقق (SMS)';
    lucide.createIcons();
}

function logout() {
    window.safeStorage.removeItem('admin_session');
    location.reload();
}

let allAdmins = [];
async function fetchAdmins() {
    if (!currentUser) return;
    try {
        const { data, error } = await _supabase.from('admins').select('*').order('created_at');
        if (error) throw error;
        allAdmins = data;
        updateAdminsUI(data);
    } catch (e) {
        console.error("Error fetching admins:", e);
    }
}

function updateAdminsUI(admins) {
    const list = document.getElementById('admins-list');
    if (!list) return;
    
    list.innerHTML = admins.map(a => `
        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div class="text-right">
                <p class="text-sm font-bold">${a.full_name || 'بدون اسم'}</p>
                <p class="text-[10px] text-slate-400">${a.email}</p>
            </div>
            <div class="flex items-center gap-1">
                <button onclick="handleEditClick('${a.id}')" class="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                ${a.email !== currentUser.email ? `
                    <button onclick="deleteAdmin('${a.id}')" class="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                ` : '<span class="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md">أنت</span>'}
            </div>
        </div>
    `).join('');
    if(window.lucide) lucide.createIcons();
}

// وظائف عالمية للتعديل
window.handleEditClick = function(id) {
    const admin = allAdmins.find(x => x.id === id);
    if (!admin) {
        console.error("Admin not found in list:", id);
        return;
    }
    
    document.getElementById('edit-admin-id').value = admin.id;
    document.getElementById('edit-admin-name').value = admin.full_name || '';
    document.getElementById('edit-admin-email').value = admin.email;
    
    const overlay = document.getElementById('editAdminOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex'; // تأكيد الظهور
    }
    if(window.lucide) lucide.createIcons();
};

window.closeEditAdmin = function() {
    const overlay = document.getElementById('editAdminOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
};

async function addNewAdmin() {
    const name = document.getElementById('admin-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    
    if (!name || !email) {
        showToast("⚠️ يرجى إكمال كافة البيانات", "error");
        return;
    }

    try {
        const { error } = await _supabase.from('admins').insert([{ 
            full_name: name,
            email
        }]);
        if (error) throw error;
        
        showToast("✅ تم إضافة المسؤول بنجاح", "success");
        document.getElementById('addAdminForm').reset();
        fetchAdmins();
    } catch (e) {
        showToast("❌ فشل الإضافة: " + e.message, "error");
    }
}


async function saveAdminEdit() {
    const id = document.getElementById('edit-admin-id').value;
    const name = document.getElementById('edit-admin-name').value.trim();
    const email = document.getElementById('edit-admin-email').value.trim();
    
    if (!name || !email) return;

    try {
        const { error } = await _supabase
            .from('admins')
            .update({ full_name: name, email: email })
            .eq('id', id);
            
        if (error) throw error;
        
        showToast("✅ تم تحديث بيانات المسؤول", "success");
        closeEditAdmin();
        fetchAdmins();
        
        // إذا عدل بياناته الشخصية، نحدث الجلسة
        if (id === currentUser.id) {
            currentUser.full_name = name;
            currentUser.email = email;
            window.safeStorage.setItem('admin_session', JSON.stringify(currentUser));
            updateGreeting();
        }
    } catch (e) {
        showToast("❌ فشل التحديث: " + e.message, "error");
    }
}

async function deleteAdmin(id) {
    if (!confirm("هل أنت متأكد من سحب صلاحية الدخول؟")) return;
    try {
        const { error } = await _supabase.from('admins').delete().eq('id', id);
        if (error) throw error;
        showToast("✅ تم حذف المسؤول", "success");
        fetchAdmins();
    } catch (e) {
        showToast("❌ فشل الحذف", "error");
    }
}

function updateAttendanceSettings(val) {
    if (!val) val = document.getElementById('setting-end-time').value;
    window.safeStorage.setItem('scout-pulse-end-time', val);
    showToast("✅ تم حفظ وقت نهاية التحضير", "success");
}

async function checkAndFinalizeAttendance() {
    const endTime = window.safeStorage.getItem('scout-pulse-end-time') || "10:30";
    const now = new Date();
    
    // لا يتم التحقق في أيام الإجازة (الجمعة والسبت)
    if (now.getDay() === 5 || now.getDay() === 6) return;

    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayISO = now.toISOString().split('T')[0];
    const lastFinalized = window.safeStorage.getItem('scout-pulse-last-finalized');

    if (currentTimeStr >= endTime && lastFinalized !== todayISO) {
        // حفظ التاريخ فوراً لمنع التكرار أثناء المعالجة
        window.safeStorage.setItem('scout-pulse-last-finalized', todayISO);
        await finalizeAbsentees(todayISO);
    }
}

async function finalizeAbsentees(date) {
    try {
        // 1. جلب الكشافة الذين حضروا اليوم
        const { data: attendedData, error: attError } = await _supabase
            .from('attendance')
            .select('studentId')
            .eq('isoDate', date);
        
        if (attError) throw attError;
        const attendedSet = new Set(attendedData.map(a => String(a.studentId)));

        // 2. تحديد الغائبين
        const absentees = scouts.filter(s => !attendedSet.has(String(s.id)));

        if (absentees.length > 0) {
            showToast(`⏳ جاري رصد ${absentees.length} غياب تلقائي...`, "info");
            
            // تحديث الإنذارات لكل غائب
            const updates = absentees.map(s => 
                _supabase
                    .from('scouts')
                    .update({ warnings: (s.warnings || 0) + 1 })
                    .eq('id', s.id)
            );
            
            await Promise.all(updates);
            showToast(`✅ انتهى وقت التحضير. تم تسجيل ${absentees.length} غياب بإنذار.`, "success");
            fetchData();
        }
    } catch (err) {
        console.error("Finalize error:", err);
        // في حال الفشل، نمسح علامة الانتهاء لنحاول لاحقاً
        window.safeStorage.removeItem('scout-pulse-last-finalized');
    }
}

// تشغيل الفحص التلقائي كل دقيقة
setInterval(checkAndFinalizeAttendance, 60000);
// وأيضاً عند بدء التطبيق
setTimeout(checkAndFinalizeAttendance, 5000);

window.updateAttendanceSettings = updateAttendanceSettings;
window.checkAndFinalizeAttendance = checkAndFinalizeAttendance;


// Biometric functions are now handled by auth-unified.js
