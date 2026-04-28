import { state } from './state.js';
import { templates, buildFileItem, buildYouTubeVideoCard } from './ui.js';
import { fetchDriveFiles, fetchYouTubeVideos, fetchReportFiles, fetchStudentsFromDoc } from './api.js';
import { getTasks } from './tasks.js';
import { initCalendar } from './calendar.js';

window.openNewTaskModal = () => {
    const modal = document.createElement('div');
    modal.className = 'custom-modal active';
    modal.innerHTML = `
        <div class="modal-content animate-in" style="max-width: 500px; border-radius: 28px;">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle" style="color:var(--primary); margin-left: 10px;"></i>إضافة جديد</h3>
                <i class="fas fa-times close-modal"></i>
            </div>
            <div class="modal-body" style="padding-top: 20px;">
                <div class="task-type-selector" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <label class="type-btn active" data-type="task" style="flex: 1; text-align: center; padding: 12px; background: rgba(99, 102, 241, 0.1); border: 2px solid var(--primary); border-radius: 15px; cursor: pointer; font-weight: 800; transition: 0.3s;">
                        <i class="fas fa-check-double" style="margin-left: 5px;"></i> مهمة
                    </label>
                    <label class="type-btn" data-type="note" style="flex: 1; text-align: center; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 2px solid transparent; border-radius: 15px; cursor: pointer; font-weight: 800; transition: 0.3s;">
                        <i class="fas fa-sticky-note" style="margin-left: 5px;"></i> ملاحظة
                    </label>
                </div>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 700; opacity: 0.8;">المحتوى</label>
                    <textarea id="task-text-input" placeholder="اكتب ما يدور في ذهنك..." style="width: 100%; height: 120px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 15px; color: white; font-family: inherit; resize: none;"></textarea>
                </div>

                <div class="form-group" style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 700; opacity: 0.8;">موعد التذكير (اختياري)</label>
                    <div style="position: relative;">
                        <i class="fas fa-bell" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: var(--primary); opacity: 0.7;"></i>
                        <input type="datetime-local" id="task-reminder-input" style="width: 100%; padding: 12px 45px 12px 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: white;">
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="modal-btn cancel close-modal-btn" style="flex: 1; height: 50px; border-radius: 14px;">إلغاء</button>
                    <button class="modal-btn save" id="confirm-add-task" style="flex: 2; height: 50px; border-radius: 14px; background: var(--primary); font-weight: 800;">حفظ الإضافة</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    let selectedType = 'task';
    const typeBtns = modal.querySelectorAll('.type-btn');
    typeBtns.forEach(btn => {
        btn.onclick = () => {
            typeBtns.forEach(b => {
                b.style.background = 'rgba(255, 255, 255, 0.05)';
                b.style.borderColor = 'transparent';
                b.classList.remove('active');
            });
            btn.style.background = 'rgba(99, 102, 241, 0.1)';
            btn.style.borderColor = 'var(--primary)';
            btn.classList.add('active');
            selectedType = btn.dataset.type;
        };
    });

    const close = () => modal.remove();
    modal.querySelector('.close-modal').onclick = close;
    modal.querySelector('.close-modal-btn').onclick = close;

    modal.querySelector('#confirm-add-task').onclick = async () => {
        const text = modal.querySelector('#task-text-input').value;
        const reminder = modal.querySelector('#task-reminder-input').value;
        
        const { addTask } = await import('./tasks.js');
        await addTask(text, selectedType, reminder);
        close();
    };
};

// Sidebar Pinning Logic
document.addEventListener('DOMContentLoaded', () => {
    const pinBtn = document.getElementById('pin-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    
    if (pinBtn && sidebar) {
        // Load initial state
        const isPinned = localStorage.getItem('scout-sidebar-pinned') === 'true';
        if (isPinned) sidebar.classList.add('pinned');
        
        pinBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const pinned = sidebar.classList.toggle('pinned');
            localStorage.setItem('scout-sidebar-pinned', pinned);
        });
    }
});

export function navigateTo(pageId) {
    const pageContent = document.getElementById('page-content');
    if (!pageContent || !templates[pageId]) return;

    // Set page attribute for CSS targeting
    document.body.setAttribute('data-page', pageId);

    state.currentPage = pageId;

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });

    pageContent.style.opacity = '0';
    setTimeout(async () => {
        try {
            pageContent.innerHTML = templates[pageId]();
        } catch (err) {
            console.error('Render Error:', err);
            pageContent.innerHTML = `<div class="error">خطأ في عرض الصفحة: ${err.message}</div>`;
        }
        pageContent.style.opacity = '1';

        // Trigger page-specific logic
        try {
            if (pageId === 'dashboard') {
                loadDashboardStats();
                updateSidebarFooter();
            } else if (pageId === 'documents') {
                await renderDocuments();
            } else if (pageId === 'media') {
                await renderMedia();
            } else if (pageId === 'links') {
                renderLinks();
            } else if (pageId === 'calendar') {
                initCalendar();
            } else if (pageId === 'reports') {
                await renderReports();
            } else if (pageId === 'students') {
                await renderStudents();
            } else if (pageId === 'tasks_board') {
                renderTasksBoard();
            } else if (pageId === 'attendance') {
                updateSidebarFooter();
            } else if (pageId === 'settings') {
                if (window.renderAdminsList) window.renderAdminsList();
                if (window.renderAdminRequestsList) window.renderAdminRequestsList();
                updateSidebarFooter();
            } else {
                updateSidebarFooter();
            }
        } catch (err) {
            console.error('Logic Error:', err);
        }
    }, 150);
}

export function updateSidebarFooter() {
    const adminSession = JSON.parse(localStorage.getItem('admin_session') || '{}');
    if (adminSession.full_name) {
        const nameEl = document.getElementById('sidebar-admin-name');
        const avatarEl = document.getElementById('sidebar-admin-avatar');
        if (nameEl) nameEl.textContent = adminSession.full_name;
        if (avatarEl) avatarEl.textContent = adminSession.full_name.charAt(0);
    }
}

export async function loadDashboardStats() {
    // Force hide loading screen on mobile quickly
    if (window.innerWidth < 850) {
        const screen = document.getElementById('loading-screen');
        if (screen) screen.classList.add('hidden');
    }

    const jobs = [
        fetchDriveFiles().then(d => { if(document.getElementById('stat-docs')) document.getElementById('stat-docs').textContent = d.length; }).catch(e=>e),
        fetchYouTubeVideos().then(v => updateVideoStat(v.length)).catch(e=>e),
        fetchReportFiles().then(r => { if(document.getElementById('stat-reports')) document.getElementById('stat-reports').textContent = r.length; }).catch(e=>e),
        fetchStudentsFromDoc().then(s => { if(document.getElementById('stat-students')) document.getElementById('stat-students').textContent = s.length; }).catch(e=>e)
    ];

    const taskJob = (async () => {
        try {
            const { loadTasks } = await import('./tasks.js');
            if (!state.tasksCache) await loadTasks();
            else if (window.renderDashboardTasks) window.renderDashboardTasks();
        } catch (e) {}
    })();

    Promise.allSettled([...jobs, taskJob]).then(() => {
        renderLatestVideo();
        const screen = document.getElementById('loading-screen');
        if (screen) screen.classList.add('hidden');
    });
}

async function renderLatestVideo() {
    const container = document.getElementById('latest-yt-video');
    if (!container) return;

    try {
        const videos = await fetchYouTubeVideos();
        if (videos && videos.length > 0) {
            const v = videos[0];
            container.innerHTML = `
                <div class="yt-widget animate-fade">
                    <a href="https://youtube.com/watch?v=${v.id}" target="_blank" style="text-decoration:none">
                        <div class="yt-thumb" style="background-image: url('${v.thumbnail}')">
                            <div class="yt-play-overlay"><i class="fas fa-play"></i></div>
                        </div>
                        <div class="yt-info">
                            <h4>${v.title}</h4>
                            <span>${new Date(v.publishedAt).toLocaleDateString('ar-SA')}</span>
                        </div>
                    </a>
                </div>
            `;
        } else {
            container.innerHTML = '<p style="opacity:0.5; font-size:0.8rem">لا توجد فيديوهات متاحة</p>';
        }
    } catch (e) {
        container.innerHTML = '<p style="opacity:0.5; font-size:0.8rem">فشل تحميل الفيديو</p>';
    }
}

export function updateVideoStat(count) {
    const el = document.getElementById('stat-videos');
    if (el) el.textContent = count;
}

export function updateClock() {
    const headerTimeEl = document.querySelector('.header-clock .time');
    const dashboardTimeEl = document.querySelector('#dashboard-clock .time');
    
    if (!headerTimeEl && !dashboardTimeEl) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (headerTimeEl) headerTimeEl.textContent = timeStr;
    if (dashboardTimeEl) dashboardTimeEl.textContent = timeStr;
}

export async function renderDocuments(folderId = null) {
    const container = document.getElementById('drive-files-container');
    if (!container) return;

    // Reset view if it's a new folder
    if (folderId) {
        state.currentFolderId = folderId;
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل المجلد...</p></div>';
    }

    try {
        const files = await fetchDriveFiles(folderId);

        // Filter out items that should stay inside folders
        // Except if we are already inside a folder
        container.innerHTML = files.map(f => buildFileItem(f)).join('');

        // Add click handlers for folders
        container.querySelectorAll('[data-mime="application/vnd.google-apps.folder"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = el.dataset.id;
                const name = el.querySelector('h4').textContent;
                state.folderStack.push({ id, name });
                renderDocuments(id);
            });
        });

        updateBreadcrumb();
    } catch (err) {
        container.innerHTML = `<div class="error">فشل تحميل الملفات: ${err.message}</div>`;
    }
}

function updateBreadcrumb() {
    const el = document.getElementById('folder-breadcrumb');
    if (!el) return;

    const items = [{ id: null, name: 'الرئيسية' }, ...state.folderStack];
    el.innerHTML = items.map((item, index) => `
        <span class="crumb" data-index="${index}" data-id="${item.id}">${item.name}</span>
    `).join(' <i class="fas fa-chevron-left divider"></i> ');

    el.querySelectorAll('.crumb').forEach(crumb => {
        crumb.addEventListener('click', () => {
            const idx = parseInt(crumb.dataset.index);
            state.folderStack = state.folderStack.slice(0, idx);
            renderDocuments(crumb.dataset.id === 'null' ? null : crumb.dataset.id);
        });
    });
}

export async function renderMedia() {
    const container = document.getElementById('youtube-videos-container');
    if (!container) return;

    try {
        const videos = await fetchYouTubeVideos();
        if (videos.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>لا توجد مقاطع</h3><p>لم يتم العثور على مقاطع في قائمة التشغيل.</p></div>';
            return;
        }

        container.innerHTML = '<div class="video-grid">' + videos.map(v => buildYouTubeVideoCard(v)).join('') + '</div>';

        // Update stat
        updateVideoStat(videos.length);
    } catch (err) {
        container.innerHTML = `<div class="error">خطأ في تحميل المقاطع: ${err.message}</div>`;
    }
}

export function renderLinks() {
    // Note: link rendering is mostly handled by the template itself for now
    // but this function ensures we can trigger updates if needed.
    const container = document.getElementById('page-content');
    if (state.currentPage === 'links') {
        container.innerHTML = templates.links();
    }
}

export async function renderReports() {
    const container = document.getElementById('reports-container');
    if (!container) return;

    try {
        const files = await fetchReportFiles();
        if (files.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>لا توجد تقارير</h3><p>لم يتم العثور على ملفات في مجلد التقارير.</p></div>';
            return;
        }

        container.innerHTML = files.map(file => {
            const isPDF = file.mimeType === 'application/pdf';
            const previewUrl = isPDF
                ? `https://drive.google.com/file/d/${file.id}/preview`
                : (file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`);
            const thumb = file.thumbnailLink ? file.thumbnailLink.replace('=s220', '=s400') : null;

            return `
                <div class="report-card glass-card animate-in" data-report-id="${file.id}" data-preview-url="${previewUrl}" data-name="${file.name}">
                    <div class="report-card-thumb">
                        ${thumb ? `<img src="${thumb}" loading="lazy">` : '<i class="fas fa-file-pdf"></i>'}
                    </div>
                    <div class="report-card-info">
                        <h4 title="${file.name}">${file.name}</h4>
                        <div class="report-card-actions">
                            <button class="report-view-btn" title="عرض التقرير"><i class="fas fa-eye"></i> عرض</button>
                            ${file.webContentLink ? `<a href="${file.webContentLink}" class="report-dl-btn" onclick="event.stopPropagation()" title="تحميل"><i class="fas fa-download"></i></a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = `<div class="error">خطأ في تحميل التقارير: ${err.message}</div>`;
    }
}

export async function renderStudents() {
    window.renderStudents = renderStudents;
    const container = document.getElementById('page-content');
    if (!container) return;

    // Show loading state ONLY if no cache exists
    if (!state.studentsCache) {
        container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل بيانات الطلاب من السحابة...</p></div>';
    }

    try {
        const students = await fetchStudentsFromDoc();
        container.innerHTML = templates.students(students);
        
        // Add checkbox selection logic
        const selectAll = document.getElementById('select-all-students');
        if (selectAll) {
            selectAll.onclick = () => {
                const allCheckboxes = document.querySelectorAll('.student-checkbox');
                allCheckboxes.forEach(cb => {
                    const row = cb.closest('.student-row');
                    if (row && row.style.display !== 'none') {
                        cb.checked = selectAll.checked;
                    }
                });
                if (window.updateSelectionToolbar) window.updateSelectionToolbar();
            };
        }

        // Add click listener to the labels to ensure toggle works perfectly
        container.querySelectorAll('.custom-checkbox').forEach(label => {
            label.onclick = (e) => {
                // Let the event bubble to the input
                setTimeout(() => {
                    if (window.updateSelectionToolbar) window.updateSelectionToolbar();
                }, 50);
            };
        });

        // Attach print modal caller
        const printBtn = document.getElementById('print-students-btn');
        if (printBtn) {
            printBtn.onclick = () => window.openPrintModal(students);
        }
    } catch (err) {
        console.error("Students render error", err);
        container.innerHTML = `
            <div class="error-state animate-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; gap: 20px;">
                <i class="fas fa-wifi-slash" style="font-size: 4rem; color: #e74c3c; opacity: 0.8;"></i>
                <h2 style="font-size: 1.5rem; font-weight: 800;">عذراً، تعذر الوصول للبيانات</h2>
                <p style="color: var(--text-secondary); max-width: 400px; font-weight: 600;">${err.message || 'تأكد من اتصال الإنترنت أو إعدادات الحماية في متصفحك.'}</p>
                <button class="glass-btn" onclick="window.navigateTo('students')" style="padding: 12px 30px; border-radius: 12px; background: var(--primary); color: white; border: none; font-weight: 800; cursor: pointer;">
                    <i class="fas fa-sync-alt" style="margin-left: 8px;"></i>إعادة المحاولة
                </button>
            </div>
        `;
    }
}

export function renderTasksBoard() {
    const container = document.getElementById('page-content');
    if (!container) return;

    const tasks = getTasks();
    container.innerHTML = templates.tasks_board(tasks);
}

// Global Print Modal Logic
window.openPrintModal = function(studentsData) {
    // 0. Use cache if data is missing
    if (!studentsData && typeof state !== 'undefined') {
        studentsData = state.studentsCache;
    }

    // 1. Security Check: Cannot print if locked
    if (!state.isStudentsUnlocked) {
        showToast('يرجى فك قفل البيانات أولاً لتتمكن من الطباعة', 'error');
        if (window.openPasswordPopup) window.openPasswordPopup();
        return;
    }

    const selectedIds = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.dataset.id);
    
    if (selectedIds.length === 0) {
        if (window.showToast) window.showToast('يرجى اختيار طالب واحد على الأقل للطباعة', 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'custom-modal active';
    modal.innerHTML = `
        <div class="modal-content animate-in" style="max-width: 550px; border-radius: 28px;">
            <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px;">
                <h3 style="font-size: 1.4rem;"><i class="fas fa-print" style="color:var(--primary); margin-left: 10px;"></i>تجهيز ملف الطباعة</h3>
                <i class="fas fa-times close-modal" style="font-size: 1.2rem; cursor: pointer;"></i>
            </div>
            <div class="modal-body" style="padding-top: 25px;">
                <div class="print-stats-info" style="margin-bottom: 25px; padding: 18px; background: rgba(99, 102, 241, 0.1); border-radius: 20px; border: 1px solid rgba(99, 102, 241, 0.2); text-align: center;">
                    <p style="margin:0; font-size: 1.1rem; font-weight: 800;">عدد السجلات المختارة: <span style="color:var(--primary); font-size: 1.3rem;">${selectedIds.length}</span></p>
                </div>

                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 700; color: var(--text-secondary); font-size: 0.9rem;">اسم الكشف / العنوان:</label>
                    <input type="text" id="print-doc-title" placeholder="مثال: كشف بيانات الطلاب" style="width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; color: white; font-size: 1rem; outline: none; transition: 0.3s; box-sizing: border-box;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--glass-border)'">
                </div>

                <p style="margin-bottom: 15px; font-weight: 700; opacity: 0.9; text-align: right; font-size: 0.9rem;">حدد البيانات المطلوبة:</p>
                
                <div class="print-options-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 30px;">
                    <label class="p-option"><input type="checkbox" checked data-col="name"> <span>الاسم الكامل</span></label>
                    <label class="p-option"><input type="checkbox" checked data-col="id"> <span>رقم السجل</span></label>
                    <label class="p-option"><input type="checkbox" checked data-col="nationality"> <span>الجنسية</span></label>
                    <label class="p-option"><input type="checkbox" checked data-col="section"> <span>الشعبة</span></label>
                    <label class="p-option"><input type="checkbox" checked data-col="phone"> <span>رقم الجوال</span></label>
                    <label class="p-option"><input type="checkbox" data-col="empty-check"> <span>خانة تحضير</span></label>
                </div>

                <div class="modal-actions" style="gap: 15px;">
                    <button class="modal-btn cancel close-modal-btn" style="flex: 1; height: 55px; border-radius: 16px;">إلغاء</button>
                    <button class="modal-btn save" id="start-print-btn" style="flex: 2; height: 55px; border-radius: 16px; background: var(--primary); color: white; font-weight: 800; font-size: 1.05rem;">
                        <i class="fas fa-file-pdf" style="margin-left: 8px;"></i> إنشاء التقرير
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.close-modal').onclick = close;
    modal.querySelector('.close-modal-btn').onclick = close;

    modal.querySelector('#start-print-btn').onclick = () => {
        const columns = Array.from(modal.querySelectorAll('.print-options-grid input:checked')).map(i => i.dataset.col);
        const dataToUse = studentsData || state.studentsCache;
        if (!dataToUse) {
            showToast('لا توجد بيانات متاحة للطباعة', 'error');
            return;
        }
        const selectedStudents = dataToUse.filter(s => selectedIds.includes(String(s.id)));
        
        const customTitle = modal.querySelector('#print-doc-title').value.trim() || 'كشف بيانات الطلاب';
        generatePrintDoc(selectedStudents, columns, customTitle);
        close();
    };
};

function generatePrintDoc(students, columns, customTitle) {
    let printSection = document.getElementById('print-section');
    if (!printSection) {
        printSection = document.createElement('div');
        printSection.id = 'print-section';
        document.body.appendChild(printSection);
    }

    const columnLabels = {
        'id': 'رقم السجل',
        'name': 'الاسم الكامل',
        'nationality': 'الجنسية',
        'section': 'الشعبة',
        'phone': 'رقم الجوال',
        'empty-check': 'التوقيع/الحالة'
    };

    const headerHtml = `
        <div class="print-doc-container" style="font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; padding: 40px; color: #0f172a; background: #fff; margin: 0;">
            <div class="print-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px;">
                <div style="text-align: right; line-height: 1.6; flex: 1;">
                    <h3 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #475569;">المملكة العربية السعودية</h3>
                    <h3 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #475569;">وزارة التعليم</h3>
                    <h3 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: #64748b;">ثانوية عبد الرحمن بن القاسم</h3>
                </div>
                <div style="text-align: center; flex: 1.5;">
                    <img src="ico.png" style="width: 70px; height: 70px; margin-bottom: 10px; object-fit: contain;">
                    <h2 style="margin: 0; font-size: 1.8rem; font-weight: 900; color: #6366f1; letter-spacing: -0.5px;">${customTitle}</h2>
                    <p style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #64748b;">الفرقة الكشفية — العام 1447 هـ</p>
                </div>
                <div style="text-align: left; line-height: 1.6; flex: 1;">
                    <p style="margin: 0; font-weight: 700; font-size: 0.9rem;">التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                    <p style="margin: 0; font-weight: 700; font-size: 0.9rem;">العدد: ${students.length} سجل</p>
                    <div style="margin-top: 5px; display: inline-block; padding: 4px 12px; background: #eef2ff; color: #6366f1; border-radius: 8px; font-size: 0.75rem; font-weight: 800;">نسخة القادة - نظام القاسم</div>
                </div>
            </div>
    `;

    // Ensure 'name' is always first if selected
    const sortedCols = [...columns].sort((a, b) => {
        if (a === 'name') return -1;
        if (b === 'name') return 1;
        return 0;
    });

    const tableHtml = `
            <div style="border: 1.5px solid #334155; border-radius: 8px; overflow: hidden; margin-top: 10px;">
                <table style="width: 100%; border-collapse: collapse; direction: rtl; font-size: 0.85rem; table-layout: auto;">
                <thead>
                    <tr style="background: #f1f5f9 !important; color: #1e293b !important; -webkit-print-color-adjust: exact; border-bottom: 2px solid #334155;">
                        <th style="padding: 10px 5px; font-weight: 800; width: 30px; text-align: center; border-left: 1px solid #cbd5e1;">م</th>
                        ${sortedCols.map(c => `
                            <th style="padding: 10px 5px; font-weight: 800; text-align: ${c === 'name' ? 'right' : 'center'}; border-left: 1px solid #cbd5e1; white-space: nowrap;">
                                ${columnLabels[c]}
                            </th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${students.map((s, index) => `
                        <tr style="background: ${index % 2 === 0 ? '#fff' : '#f8fafc'} !important; -webkit-print-color-adjust: exact; border-bottom: 1px solid #cbd5e1;">
                            <td style="padding: 8px 5px; text-align: center; font-weight: 700; color: #475569; border-left: 1px solid #cbd5e1;">${index + 1}</td>
                            ${sortedCols.map(c => `
                                <td style="padding: 8px 5px; text-align: ${c === 'name' ? 'right' : 'center'}; color: #0f172a; font-weight: ${c === 'name' ? '700' : '400'}; border-left: 1px solid #cbd5e1; ${c === 'name' ? 'white-space: nowrap;' : ''}">
                                    ${c === 'empty-check' ? '' : (s[c] || '-')}
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

            <div style="display: flex; justify-content: space-between; margin-top: 60px; padding: 0 40px; text-align: center;">
                <div style="width: 220px;">
                    <p style="font-size: 1rem; font-weight: 800; margin-bottom: 45px; color: #475569;">قائد الفرقة الكشفية</p>
                    <div style="border-bottom: 2px solid #6366f1; width: 100%; opacity: 0.3;"></div>
                    <p style="margin-top: 8px; font-size: 0.8rem; color: #94a3b8;">الاسم والتوقيع</p>
                </div>
                <div style="width: 220px;">
                    <p style="font-size: 1rem; font-weight: 800; margin-bottom: 45px; color: #475569;">يعتمد،، مدير المدرسة</p>
                    <div style="border-bottom: 2px solid #6366f1; width: 100%; opacity: 0.3;"></div>
                    <p style="margin-top: 8px; font-size: 0.8rem; color: #94a3b8;">الختم والتوقيع الرسمي</p>
                </div>
            </div>
            <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                <p style="font-size: 0.7rem; color: #94a3b8; font-weight: 700;">تم إنشاء هذا التقرير آلياً بواسطة واجهة القاسم الذكية - نظام التحضير</p>
            </div>
        </div>
    `;

    printSection.innerHTML = headerHtml + tableHtml;
    
    // Wait for fonts and images to load properly
    setTimeout(() => {
        window.print();
    }, 1000);
}
