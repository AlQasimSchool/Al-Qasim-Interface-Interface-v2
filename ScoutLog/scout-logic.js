/**
 * Scout Attendance System - Frontend Logic (Connected to Node.js)
 */

let scouts = [];
let attendance = [];
let keyboardBuffer = "";
let bufferTimer = null;
let isScanning = false;

const SUPABASE_URL = 'https://unxhursbcavdaunuvbhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueGh1cnNiY2F2ZGF1bnV2YmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mzg4NTksImV4cCI6MjA5MjUxNDg1OX0.56EwISYcShglg-Q_2thnrtJSAXMKkHO1Zmvo_ZC6c4w';

let _supabase;
try {
    if (typeof supabase !== 'undefined') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("✅ Supabase Client Initialized");
    } else {
        throw new Error("Supabase library not found. Check your internet connection or CDN link.");
    }
} catch (e) {
    console.error("Critical Init Error:", e);
}

const API_BASE = "/api";

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

function init() {
    console.log("🚀 Initializing Scout System...");
    
    // Safety check: ensure unified auth has prioritized control
    if (!localStorage.getItem('admin_session')) {
        console.log("No active session. Waiting for authentication...");
        return;
    }

    // إظهار لوحة التحكم فوراً عند الفتح
    showPage('dashboard');

    if (!_supabase) {
        console.error("Abort Init: Supabase not ready");
        return;
    }

    fetchData();
    setupKeyboardEmulator();
    setupSearch();
    applySettings();

    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');
    if (scanId) {
        handleAutoScan(scanId);
    }
    
    const bottomNav = document.getElementById('mobileBottomNav');
    if(bottomNav) bottomNav.classList.remove('hidden');
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
    const isSound = localStorage.getItem('scout-pulse-sound') !== 'false';
    const isDark = localStorage.getItem('scout-pulse-dark') !== 'false';
    
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
            photo: s.photo,
            warnings: s.warnings || 0,
            pin: s.pin || '1234'
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
                time: d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                date: a.date || d.toLocaleDateString('ar-EG'),
                isoDate: d.toISOString().split('T')[0]
            };
        });
        
        // جلب البيانات من Supabase فقط
        updateDashboard();
        updateDirectory();
        updateManagementList();
    } catch (e) {
        console.error("Supabase Fetch Error:", e);
        showToast("❌ خطأ في الاتصال بقاعدة البيانات: " + (e.message || "عطل غير معروف"), "error");
    }
}

function updateDashboard() {
    const filterSelect = document.getElementById('monthFilter');
    const selectedMonth = filterSelect.value;
    const monthName = filterSelect.options[filterSelect.selectedIndex].text;
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const isHoliday = (dayOfWeek === 5 || dayOfWeek === 6); // 5: Friday, 6: Saturday

    // إظهار تنبيه الإجازة في كل الصفحات التي تحتوي على الكلاس
    document.querySelectorAll('.holiday-notice').forEach(el => {
        if (isHoliday) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    const todayISO = now.toISOString().split('T')[0];
    const todayAr = now.toLocaleDateString('ar-EG');

    // تصفية السجل حسب الاختيار (كامل السنة، اليوم، أو شهر محدد)
    let filteredLog = [];
    if (selectedMonth === 'all') {
        filteredLog = attendance;
    } else if (selectedMonth === 'today') {
        filteredLog = attendance.filter(log => log.isoDate === todayISO || log.date === todayAr);
    } else {
        filteredLog = attendance.filter(log => log.date.includes(selectedMonth) || log.isoDate?.startsWith(selectedMonth));
    }

    // حساب عدد أيام حضور كل كشاف وتحديث الأرقام في القائمة
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => {
        scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1;
    });

    // تحديث الكائنات محلياً ليتم عرضها في الدليل
    scouts.forEach(s => {
        s.currentMonthAttendance = scoutAttendanceMap[s.id] || 0;
    });

    // --- تحديث مركز رؤى القادة (Leader Insights) ---
    const periodText = selectedMonth === 'all' ? "طوال العام" : (selectedMonth === 'today' ? "اليوم" : "هذا الشهر");
    
    const absentScouts = scouts.filter(s => (scoutAttendanceMap[s.id] || 0) === 0);
    
    if (selectedMonth === 'today' && isHoliday) {
        document.getElementById('insight-absent-count').textContent = "---";
        document.querySelector('#insight-absent-count').parentElement.nextElementSibling.textContent = "اليوم إجازة رسمية";
        document.getElementById('insight-best-patrol').textContent = "إجازة";
        document.getElementById('insight-total-scans').textContent = "---";
        document.querySelector('#insight-total-scans').parentElement.nextElementSibling.textContent = "لا يوجد تحضير اليوم";
        document.getElementById('insight-follow-up-msg').textContent = "يوم الجمعة والسبت إجازة، استمتع بوقتك! 😎";
        document.getElementById('insight-follow-up-msg').style.color = "#818cf8";
    } else {
        document.getElementById('insight-absent-count').textContent = absentScouts.length;
        document.querySelector('#insight-absent-count').parentElement.nextElementSibling.textContent = `كشاف لم يحضر ${periodText}`;
        
        const followUpMsg = document.getElementById('insight-follow-up-msg');
        if (absentScouts.length > 0) {
            followUpMsg.textContent = `يوجد ${absentScouts.length} كشاف غائبين تماماً، يرجى متابعتهم.`;
            followUpMsg.style.color = "#fb7185"; 
        } else {
            followUpMsg.textContent = "جميع الكشافة سجلوا حضوراً واحداً على الأقل، ممتاز!";
            followUpMsg.style.color = "#34d399";
        }
    }
    
    const patrolAttendance = {};
    filteredLog.forEach(log => {
        const s = scouts.find(x => x.id === log.studentId);
        if (s && s.patrol) {
            patrolAttendance[s.patrol] = (patrolAttendance[s.patrol] || 0) + 1;
        }
    });
    
    let bestPatrol = "---";
    let maxPatrolCount = 0;
    for (const [p, count] of Object.entries(patrolAttendance)) {
        if (count > maxPatrolCount) {
            maxPatrolCount = count;
            bestPatrol = p;
        }
    }

    if (!(selectedMonth === 'today' && isHoliday)) {
        document.getElementById('insight-best-patrol').textContent = bestPatrol;
        document.getElementById('insight-total-scans').textContent = filteredLog.length;
        document.querySelector('#insight-total-scans').parentElement.nextElementSibling.textContent = `إجمالي حضور ${periodText}`;
    }

    // --- حساب لوحة الشرف (Top 3) ---
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
        topListElem.innerHTML = '<p class="text-slate-500 text-center text-xs italic py-4">لا توجد بيانات لهذا الشهر</p>';
    }
    
    updateDirectory(); // تحديث الدليل ليعرض أرقام الشهر المختار
    lucide.createIcons();
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
                    <p class="text-[10px] text-slate-500">${s.rank} • ${s.patrol}</p>
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
    lucide.createIcons();
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
                        <span class="px-3 py-0.5 rounded-full bg-slate-800/50 text-slate-500 text-[10px] font-medium border border-white/5">#${s.id}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
                <div class="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10 text-center">
                    <p class="text-xl font-black text-emerald-400">${attendanceCount}</p>
                    <p class="text-[9px] text-slate-500 font-bold uppercase">الحضور</p>
                </div>
                <div class="bg-rose-500/5 p-3 rounded-2xl border border-rose-500/10 text-center">
                    <p class="text-xl font-black text-rose-400">${absenceCount}</p>
                    <p class="text-[9px] text-slate-500 font-bold uppercase">الغياب</p>
                </div>
                <div class="bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10 text-center">
                    <p class="text-xl font-black text-indigo-400">${rate}%</p>
                    <p class="text-[9px] text-slate-500 font-bold uppercase">الالتزام</p>
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
    document.getElementById('edit-pin').value = scout.pin || '1234';
    document.getElementById('edit-photo').value = scout.photo || '';

    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

async function saveScoutChanges() {
    const oldId = document.getElementById('edit-old-id').value;
    const newData = {
        id: document.getElementById('edit-id').value,
        name: document.getElementById('edit-name').value,
        rank: document.getElementById('edit-rank').value,
        patrol: document.getElementById('edit-patrol').value,
        warnings: parseInt(document.getElementById('edit-warnings').value) || 0,
        pin: document.getElementById('edit-pin').value,
        photo: document.getElementById('edit-photo').value
    };

    try {
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
    isScanning = state;
    const overlay = document.getElementById('scanOverlay');
    const bottomNav = document.getElementById('mobileBottomNav');

    if(state) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        if(bottomNav) bottomNav.style.visibility = 'hidden';
    } else {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        if(bottomNav) bottomNav.style.visibility = 'visible';
    }
    
    document.getElementById('scanResult').classList.add('hidden');
    
    if(state) {
        if ('NDEFReader' in window) {
            try {
                const ndef = new NDEFReader();
                await ndef.scan();
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
            showToast("⚠️ الـ NFC غير مدعوم في هذا المتصفح. يمكنك استخدام لوحة المفاتيح.", "info");
        }
    }
}

// --- NFC Writing Logic ---
let isProgramming = false;
let abortController = null;

async function startProgramming(scoutId) {
    // بحث قوي يتجاهل المسافات واختلاف الأنواع (نص/رقم)
    const scout = scouts.find(s => String(s.id).trim() === String(scoutId).trim());
    if (!scout) {
        showToast("❌ هذا الرقم غير مسجل", "error");
        return;
    }

    if (!('NDEFReader' in window)) {
        let reason = "المتصفح لا يدعم تقنية Web NFC.";
        
        if (!window.isSecureContext) {
            reason = "يجب استخدام رابط آمن (HTTPS) لتعمل الميزة.";
        } else if (!/Android/i.test(navigator.userAgent)) {
            reason = "ميزة الـ NFC في المتصفح مدعومة حالياً على أندرويد فقط.";
        } else if (!/Chrome/i.test(navigator.userAgent)) {
            reason = "يرجى استخدام متصفح Google Chrome الرسمي.";
        }

        showToast("⚠️ " + reason, "error");
        alert("⚠️ عذراً، الـ NFC غير مدعوم حالياً.\n\nالسبب المحتمل: " + reason + "\n\nتأكد من:\n1. استخدام أندرويد + كروم.\n2. الرابط يبدأ بـ https://\n3. تفعيل الـ NFC في إعدادات الهاتف.");
        return;
    }

    isProgramming = true;
    const overlay = document.getElementById('writeOverlay');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    document.getElementById('writeTargetName').textContent = scout.name;
    document.getElementById('writeSuccess').classList.add('hidden');
    document.getElementById('writeStatus').classList.remove('hidden');

    try {
        abortController = new AbortController();
        const ndef = new NDEFReader();
        // العودة لكتابة الرقم فقط كنص عادي بناءً على طلبك
        await ndef.write({
            records: [{ recordType: "text", data: String(scoutId) }]
        }, { signal: abortController.signal });
        
        // Success!
        document.getElementById('writeStatus').classList.add('hidden');
        document.getElementById('writeSuccess').classList.remove('hidden');
        if(localStorage.getItem('scout-pulse-sound') !== 'false') playBeep();
        
        setTimeout(() => {
            stopProgramming();
        }, 3000);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("NFC Write Error:", error);
            alert("❌ فشلت عملية البرمجة: " + error.message);
            stopProgramming();
        }
    }
}

function stopProgramming() {
    isProgramming = false;
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    document.getElementById('writeOverlay').style.display = 'none';
    document.getElementById('writeOverlay').classList.add('hidden');
}

function setupKeyboardEmulator() {
    document.addEventListener('keydown', e => {
        if(!isScanning) return;
        if(e.key === 'Enter') {
            if(keyboardBuffer) handleScan(keyboardBuffer);
            keyboardBuffer = "";
        } else if(e.key.length === 1) {
            keyboardBuffer += e.key;
            clearTimeout(bufferTimer);
            bufferTimer = setTimeout(() => keyboardBuffer = "", 500);
        }
    });
}

let recentScans = [];

async function handleScan(id) {
    if(!isScanning) return;
    
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
    
    // البحث عن الكشاف باستخدام المعرف المعالج
    const scout = scouts.find(s => String(s.id).trim() === String(processedId).trim());
    const res = document.getElementById('scanResult');
    res.classList.remove('hidden', 'bg-emerald-500', 'bg-rose-500');

    if(scout) {
        try {
            const now = new Date();
            const todayISO = now.toISOString().split('T')[0];
            const todayAr = now.toLocaleDateString('ar-EG');
            
            // التحقق من الحضور المسبق
            const { data: existing } = await _supabase
                .from('attendance')
                .select('*')
                .eq('scout_id', processedId)
                .filter('created_at', 'gte', todayISO + 'T00:00:00Z');

            if(existing && existing.length > 0) {
                res.textContent = `⚠️ ${scout.name} محضر بالفعل!`;
                res.classList.add('bg-rose-500');
            } else {
                // تسجيل الحضور بالصيغة العالمية لضمان عمل التقارير
                await _supabase.from('attendance').insert({
                    scout_id: processedId,
                    date: todayAr // نحتفظ بالعربي للعرض فقط
                });

                res.textContent = `✅ تم تحضير: ${scout.name}`;
                res.classList.add('bg-emerald-500');
                if(localStorage.getItem('scout-pulse-sound') !== 'false') playBeep();
                
                // Add to recent scans
                recentScans.unshift({
                    name: scout.name,
                    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    photo: scout.photo
                });
                if(recentScans.length > 5) recentScans.pop();
                updateRecentScans();
                fetchData(); // Refresh counts
            }
        } catch (e) { console.error(e); }
    } else {
        res.textContent = "❌ كشاف غير معروف!";
        res.classList.add('bg-rose-500');
    }
    
    setTimeout(() => { if(isScanning) res.classList.add('hidden'); }, 3000);
}

function updateRecentScans() {
    const list = document.getElementById('recentScansList');
    if(recentScans.length === 0) return;
    
    list.innerHTML = recentScans.map(s => `
        <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 animate-slide-up">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-indigo-500/30">
                    ${s.photo && s.photo.startsWith('http') 
                        ? `<img src="${s.photo}" class="w-full h-full object-cover">`
                        : `<i data-lucide="user" class="w-6 h-6 text-slate-500"></i>`}
                </div>
                <div>
                    <p class="font-bold">${s.name}</p>
                    <p class="text-[10px] text-indigo-400 font-bold uppercase">تم التحضير بنجاح</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-bold text-slate-400">${s.time}</p>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
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
    const data = {
        id: document.getElementById('new-id').value,
        name: document.getElementById('new-name').value,
        rank: document.getElementById('new-rank').value,
        patrol: document.getElementById('new-patrol').value,
        photo: document.getElementById('new-photo').value,
        pin: document.getElementById('new-pin').value || '1234',
        warnings: 0
    };

    try {
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

function updateManagementList() {
    const manageList = document.getElementById('manage-scout-list');
    if(!manageList) return;

    manageList.innerHTML = scouts.map(s => `
        <div class="glass-card p-6 flex items-center justify-between border-white/5 animate-fade-in">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold overflow-hidden border border-indigo-500/20">
                    ${s.photo && s.photo.startsWith('http') ? `<img src="${s.photo}" class="w-full h-full object-cover">` : s.name.charAt(0)}
                </div>
                <div>
                    <p class="font-bold text-white">${s.name}</p>
                    <div class="flex gap-2">
                        <p class="text-[10px] text-slate-500">${s.patrol}</p>
                        ${s.warnings > 0 ? `<span class="text-[9px] text-rose-500 font-bold">⚠️ ${s.warnings} انذار</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="updateWarning('${s.id}', 1)" class="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-all border border-rose-500/10" title="إضافة إنذار"><i data-lucide="alert-triangle" class="w-4 h-4"></i></button>
                <button onclick="updateWarning('${s.id}', -1)" class="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/10" title="تصفير الإنذارات"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
                <button onclick="openEditModal('${s.id}')" class="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-all border border-indigo-500/10" title="تعديل البيانات"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
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
    const iconMap = { success: 'check-circle-2', info: 'info', error: 'alert-circle' };
    toast.innerHTML = `<i data-lucide="${iconMap[type]}" class="w-5 h-5"></i><span class="font-bold">${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => {
        toast.style.animation = "toast-in 0.5s reverse forwards";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
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
    const todayISO = new Date().toISOString().split('T')[0];
    const todayAr = new Date().toLocaleDateString('ar-EG');
    if (period === 'all') return attendance;
    if (period === 'today') return attendance.filter(log => log.isoDate === todayISO || log.date === todayAr);
    return attendance.filter(log => log.date.includes(period) || log.isoDate?.startsWith(period));
}

function executeExcelExport(period, periodName) {
    showToast(`📊 جاري تصدير Excel لـ ${periodName}...`, "info");
    const filteredLog = getFilteredAttendanceForPeriod(period);
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => { scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1; });

    let csv = "\uFEFFالاسم,رقم الهوية / الإقامة,الرتبة,الفرقة,أيام الحضور\n";
    scouts.forEach(s => { csv += `${s.name},${s.id},${s.rank},${s.patrol},${scoutAttendanceMap[s.id] || 0}\n`; });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `سجل_${periodName}.csv`);
    link.click();
}

function executePDFExport(period, periodName, mode = 'download') {
    showToast(mode === 'download' ? `⏳ جاري تحميل تقرير ${periodName}...` : `🖨️ جاري تجهيز طباعة تقرير ${periodName}...`, "info");
    const filteredLog = getFilteredAttendanceForPeriod(period);
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => { scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1; });

    let tableRows = scouts.map(s => {
        const att = scoutAttendanceMap[s.id] || 0;
        const rate = Math.round((att / 30) * 100);
        return `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px; text-align:right;"><b>${s.name}</b><br><small>${s.id}</small></td>
                <td style="padding:12px; text-align:center;">${s.rank} / ${s.patrol}</td>
                <td style="padding:12px; text-align:center;">${att}</td>
                <td style="padding:12px; text-align:center;">${rate}%</td>
            </tr>`;
    }).join('');

    const element = document.createElement('div');
    element.innerHTML = `
        <div style="direction:rtl; padding:30px; font-family:sans-serif; background:white;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #6366f1; padding-bottom:10px; margin-bottom:20px;">
                <h2 style="margin:0; font-size:20px;">تقرير الحضور: ${periodName}</h2>
                <p style="margin:0; font-size:10px; color:#666;">تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f9fafb; font-size:12px;">
                        <th style="padding:10px; text-align:right;">الكشاف</th>
                        <th style="padding:10px; text-align:center;">الرتبة/الفرقة</th>
                        <th style="padding:10px; text-align:center;">الأيام</th>
                        <th style="padding:10px; text-align:center;">الالتزام</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`;

    if (mode === 'print') {
        const printArea = document.getElementById('print-report');
        printArea.innerHTML = element.innerHTML;
        setTimeout(() => { window.print(); }, 500);
    } else {
        const opt = {
            margin: 10,
            filename: `سجل_حضور_${periodName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }
}

async function confirmResetAttendance() {
    if(confirm("⚠️ هل أنت متأكد من حذف جميع سجلات الحضور؟ هذا الإجراء لا يمكن التراجع عنه!")) {
        const pass = prompt("أدخل كلمة المرور للتأكيد (افتراضي: admin):");
        if(pass === "admin") {
            try {
                // تصفير الحضور من Supabase
                const { error } = await _supabase
                    .from('attendance')
                    .delete()
                    .neq('id', 0); // حذف كل الأسطر التي معرفها ليس 0 (أي الكل)

                if(error) throw error;

                alert("✅ تم تصفير البيانات بنجاح.");
                fetchData();
            } catch(err) { 
                console.error(err);
                alert("❌ فشل تصفير البيانات.");
            }
        }
    }
}

// Settings Persistence
document.getElementById('setting-sound').addEventListener('change', e => {
    localStorage.setItem('scout-pulse-sound', e.target.checked);
});

document.getElementById('setting-dark').addEventListener('change', e => {
    document.body.classList.toggle('light-mode', !e.target.checked);
    localStorage.setItem('scout-pulse-dark', e.target.checked);
});

function playBeep() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play blocked by browser'));
}
