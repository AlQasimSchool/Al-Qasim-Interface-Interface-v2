/**
 * Scout Attendance System - Frontend Logic (Connected to Node.js)
 */

let scouts = [];
let attendance = [];
let keyboardBuffer = "";
let bufferTimer = null;
let isScanning = false;

var SUPABASE_URL = 'https://unxhursbcavdaunuvbhr.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueGh1cnNiY2F2ZGF1bnV2YmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mzg4NTksImV4cCI6MjA5MjUxNDg1OX0.56EwISYcShglg-Q_2thnrtJSAXMKkHO1Zmvo_ZC6c4w';
var _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const API_BASE = "/api";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupKeyboardEmulator();
    setupSearch();
    applySettings();
    showPage('dashboard');
    
    // الحل الجذري: فحص إذا كان المستخدم دخل عبر مسح بطاقة (رابط مباشر)
    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');
    if (scanId) {
        handleAutoScan(scanId);
    }
    
    const bottomNav = document.getElementById('mobileBottomNav');
    if(bottomNav) bottomNav.classList.remove('hidden');
});

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
        // جلب الكشافة
        const { data: scoutsData, error: scoutsError } = await _supabase
            .from('scouts')
            .select('*')
            .order('name');
            
        if (scoutsError) throw scoutsError;
        
        // جلب الحضور
        const { data: attendanceData, error: attendanceError } = await _supabase
            .from('attendance')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (attendanceError) throw attendanceError;
        
        // تحويل الحقول لتناسب الكود القديم (لعدم كسر الواجهة)
        scouts = scoutsData.map(s => ({
            ...s,
            id: s.id,
            name: s.name,
            rank: s.rank,
            patrol: s.patrol,
            photo: s.photo,
            warnings: s.warnings || 0
        }));
        
        attendance = attendanceData.map(a => ({
            studentId: a.scout_id,
            time: new Date(a.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            date: a.date || new Date(a.created_at).toLocaleDateString('ar-EG')
        }));
        
        // إذا كانت قاعدة البيانات فارغة، نقترح الجلب من جوجل (اختياري)
        if (scouts.length === 0) {
            console.log("قاعدة بيانات Supabase فارغة. جاري محاولة الجلب من جوجل دوتس...");
            syncFromGoogle();
        }
        
        updateDashboard();
        updateDirectory();
    } catch (e) {
        console.error("Supabase Fetch Error:", e);
        showToast("⚠️ خطأ في الاتصال بقاعدة البيانات.", "error");
    }
}

async function syncFromGoogle() {
    try {
        const response = await fetch(`${API_BASE}/data`);
        const data = await response.json();
        if (data.scouts && data.scouts.length > 0) {
            showToast("🔄 جاري مزامنة البيانات من جوجل...", "info");
            // إضافة البيانات لـ Supabase
            for (const s of data.scouts) {
                await _supabase.from('scouts').upsert({
                    id: String(s.id),
                    name: s.name,
                    rank: s.rank,
                    patrol: s.patrol,
                    photo: s.photo,
                    warnings: s.warnings || 0
                });
            }
            fetchData(); // إعادة التحميل بعد المزامنة
        }
    } catch(e) { console.log("Sync Error:", e); }
}

function updateDashboard() {
    const filterSelect = document.getElementById('monthFilter');
    const selectedMonth = filterSelect.value;
    const monthName = filterSelect.options[filterSelect.selectedIndex].text;
    
    // تحديث اسم الشهر المعروض
    document.getElementById('displayMonthName').textContent = monthName;
    
    // تصفية السجل حسب الشهر المختار
    const filteredLog = selectedMonth === 'all' 
        ? attendance 
        : attendance.filter(log => log.date.includes(selectedMonth));

    // حساب عدد أيام حضور كل كشاف وتحديث الأرقام في القائمة
    const scoutAttendanceMap = {};
    filteredLog.forEach(log => {
        scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1;
    });

    // تحديث الكائنات محلياً ليتم عرضها في الدليل
    scouts.forEach(s => {
        s.currentMonthAttendance = scoutAttendanceMap[s.id] || 0;
    });

    // تحديث إحصائيات لوحة التحكم
    const totalScouts = scouts.length;
    const today = new Date().toLocaleDateString('ar-EG');
    
    // إذا كان الفلتر "كامل السنة"، نظهر حضور اليوم. إذا كان شهراً معيناً، نظهر إجمالي حضور هذا الشهر.
    const displayCount = selectedMonth === 'all' 
        ? attendance.filter(log => log.date === today).length
        : filteredLog.length;

    document.getElementById('stat-today-count').textContent = displayCount;
    document.getElementById('stat-total-scouts').textContent = selectedMonth === 'all' ? `/ ${totalScouts} كشاف اليوم` : `إجمالي حضور ${monthName}`;
    
    const progress = totalScouts > 0 ? (displayCount / (selectedMonth === 'all' ? totalScouts : (totalScouts * 30))) * 100 : 0;
    document.getElementById('stat-today-progress').style.width = `${Math.min(progress, 100)}%`;

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
                        <p class="text-xs font-bold truncate w-24">${s.name}</p>
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

function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    
    // Update active states for ALL nav links (top and bottom)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const clickAttr = link.getAttribute('onclick');
        if(clickAttr && clickAttr.includes(`'${pageId}'`)) {
            link.classList.add('active');
        }
    });
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
        const avatarHtml = (s.photo && s.photo.startsWith('http')) 
            ? `<img src="${s.photo}" class="scout-avatar-img">`
            : `<i data-lucide="user" class="w-6 h-6 text-indigo-400"></i>`;

        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="scout-avatar-container">
                    ${avatarHtml}
                </div>
                <div class="overflow-hidden flex-1">
                    <h4 class="font-bold truncate group-hover:text-indigo-400 transition-colors text-sm">${s.name}</h4>
                    <p class="text-[10px] text-slate-500">${s.rank} • ${s.patrol}</p>
                    <div class="mt-1.5 flex items-center gap-2">
                        <span class="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-bold">
                            حضر ${s.currentMonthAttendance || 0} / 30 يوم
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
    
    // حساب "أيام الدوام" التي مرت في الشهر الحالي (أحد-خميس)
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
    const photoHtml = (s.photo && s.photo.startsWith('http')) 
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
            <button onclick="startProgramming('${s.id}')" class="w-full py-4 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                <i data-lucide="nfc" class="w-5 h-5"></i>
                برمجة البطاقة الشخصية
            </button>
        </div>
    `;
    
    showPage('profile');
    lucide.createIcons();
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
    if(!scout) {
        showToast("❌ لم يتم العثور على بيانات الكشاف", "error");
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
            const today = new Date().toLocaleDateString('ar-EG');
            
            // التحقق من الحضور المسبق في Supabase
            const { data: existing } = await _supabase
                .from('attendance')
                .select('*')
                .eq('scout_id', processedId)
                .eq('date', today);

            if(existing && existing.length > 0) {
                res.textContent = `⚠️ ${scout.name} محضر بالفعل!`;
                res.classList.add('bg-rose-500');
            } else {
                // تسجيل الحضور
                await _supabase.from('attendance').insert({
                    scout_id: processedId,
                    date: today
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
        warnings: 0
    };

    try {
        const { error } = await _supabase
            .from('scouts')
            .insert(data);

        if(error) throw error;

        showToast("✅ تم إضافة الكشاف بنجاح!", "success");
        document.getElementById('addScoutForm').reset();
        fetchData(); // تحديث القائمة
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

        const { error } = await _supabase
            .from('scouts')
            .update({ warnings: newWarnings })
            .eq('id', id);

        if(error) throw error;

        showToast(change > 0 ? "⚠️ تم إضافة إنذار" : "✅ تم تصفير الإنذارات", change > 0 ? "info" : "success");
        fetchData(); // تحديث البيانات
    } catch(err) { 
        console.error(err); 
        showToast("❌ فشل تحديث الإنذارات", "error");
    }
}

// Professional Toast System
function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    const iconMap = {
        success: 'check-circle-2',
        info: 'info',
        error: 'alert-circle'
    };

    toast.innerHTML = `
        <i data-lucide="${iconMap[type]}" class="w-5 h-5"></i>
        <span class="font-bold">${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.animation = "toast-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function exportToExcel() {
    showToast("📊 جاري تصدير ملف Excel...", "info");
    
    let csv = "\uFEFFالاسم,المعرف,الرتبة,الفرقة,عدد الإنذارات\n";
    scouts.forEach(s => {
        csv += `${s.name},${s.id},${s.rank},${s.patrol},${s.warnings}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `سجل_الكشافة_${new Date().toLocaleDateString('ar-EG')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToPDF() {
    const selectedMonth = document.getElementById('monthFilter').value;
    const monthName = selectedMonth === 'all' ? "كامل السنة" : selectedMonth;
    
    showToast(`⏳ جاري تجهيز التقرير لشهر ${monthName}...`, "info");
    
    const printArea = document.getElementById('print-report');
    const now = new Date();
    
    // Filter attendance log by selected month for the report
    const filteredLog = selectedMonth === 'all' 
        ? attendance 
        : attendance.filter(log => log.date.startsWith(selectedMonth));

    const scoutAttendanceMap = {};
    filteredLog.forEach(log => {
        scoutAttendanceMap[log.studentId] = (scoutAttendanceMap[log.studentId] || 0) + 1;
    });

    // Calculate stats
    const totalDays = Object.values(scoutAttendanceMap).reduce((max, val) => Math.max(max, val), 0) || 1;

    let tableRows = scouts.map(s => {
        const monthAtt = scoutAttendanceMap[s.id] || 0;
        const attendanceRate = ((monthAtt / totalDays) * 100).toFixed(0);
        return `
            <tr>
                <td>${s.name}</td>
                <td>${s.rank} / ${s.patrol}</td>
                <td><span class="stat-badge">${monthAtt}</span> يوم</td>
                <td>${attendanceRate}%</td>
                <td>${s.warnings > 0 ? `<span style="color:red">${s.warnings}</span>` : '0'}</td>
            </tr>
        `;
    }).join('');

    printArea.innerHTML = `
        <div class="report-header">
            <h1>تقرير حضور كشافة عبدالرحمن بن القاسم</h1>
            <p>سجل الحضور الشهري: <strong>${monthName}</strong></p>
        </div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>اسم الكشاف</th>
                    <th>الرتبة / الفرقة</th>
                    <th>أيام الحضور</th>
                    <th>نسبة الحضور</th>
                    <th>الإنذارات</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <div class="report-footer">
            <span>تاريخ استخراج التقرير: ${now.toLocaleString('ar-EG')}</span>
            <span>نظام التحضير الذكي - نسخة القادة</span>
        </div>
    `;

    setTimeout(() => {
        window.print();
    }, 1000);
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
