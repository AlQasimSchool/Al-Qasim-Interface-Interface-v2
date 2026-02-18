import { state } from './state.js';
import { formatDate, getFileType, getFileTypeName, getFileIcon, getFileOpenUrl } from './utils.js';
import { getMostOpened } from './tracking.js';
import { CONFIG } from './config.js';
import { DEFAULT_LINKS } from './data.js';
import { STUDENTS } from './students.js'; // Added this import

export const templates = {
    /* ===================== الرئيسية ===================== */
    dashboard: () => {
        const opened = getMostOpened();
        let mostOpenedHtml = '';

        if (opened.length > 0) {
            mostOpenedHtml = `
                <div class="most-opened-section animate-in" style="margin-top: 28px; margin-bottom: 28px">
                    <h3 class="section-title">الوصول الذكي (الأكثر استخداماً)</h3>
                    <div class="agenda-list">
                        ${opened.map(item => {
                const typeLabel = item.type === 'video' ? 'فيديو' : item.type === 'link' ? 'رابط' : item.type === 'pdf' ? 'تقرير' : 'مستند';
                const colorClass = item.type === 'video' ? 'red' : item.type === 'link' ? 'blue' : item.type === 'pdf' ? 'purple' : 'brown';

                // Fallback icon if missing in storage (Old data)
                let iconClass = item.icon || 'fas fa-file-alt';

                return `
                                <a href="${item.url}" target="_blank" class="agenda-list-item" data-item='${JSON.stringify(item)}'>
                                    <div class="item-icon ${colorClass}">
                                        <i class="${iconClass}"></i>
                                    </div>
                                    <div class="item-info">
                                        <h4>${item.name}</h4>
                                        <span>${typeLabel}</span>
                                    </div>
                                    <i class="fas fa-chevron-left item-arrow"></i>
                                </a>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        return `
            <div class="page-section animate-fade">
                <div class="dashboard-header-flex">
                    <div class="page-header">
                        <h1><i class="fas fa-hand-wave" style="margin-left:10px;color:var(--primary-green)"></i>أهلاً بعودتك، عبدالرحمن الرميح</h1>
                        <p>سعيدون برؤيتك مجدداً في لوحة التحكم الخاصة بك.</p>
                    </div>
                </div>

                <div class="stats-row">
                    <div class="stat-widget animate-in stagger-1">
                        <div class="stat-icon card-icon green"><i class="fas fa-file-alt"></i></div>
                        <div class="stat-info"><h4 id="stat-docs">—</h4><span>مستند متاح</span></div>
                    </div>
                    <div class="stat-widget animate-in stagger-2">
                        <div class="stat-icon card-icon brown"><i class="fas fa-video"></i></div>
                        <div class="stat-info"><h4 id="stat-videos">—</h4><span>مقطع فيديو</span></div>
                    </div>
                    <div class="stat-widget animate-in stagger-3">
                        <div class="stat-icon card-icon purple"><i class="fas fa-file-pdf"></i></div>
                        <div class="stat-info"><h4 id="stat-reports">—</h4><span>تقرير</span></div>
                    </div>
                    <div class="stat-widget animate-in stagger-4">
                        <div class="stat-icon card-icon blue"><i class="fas fa-link"></i></div>
                        <div class="stat-info"><h4>5</h4><span>رابط مفيد</span></div>
                    </div>
                </div>

                ${mostOpenedHtml}

                <h3 class="section-title">الوصول السريع</h3>
                <div class="card-grid">
                    <div class="card animate-in stagger-1" data-nav="documents">
                        <div class="card-icon brown"><i class="fas fa-folder-open"></i></div>
                        <h3>المستندات</h3>
                        <p class="card-desc">ملفات التدريب والسجلات والمخططات الكشفية.</p>
                    </div>
                    <div class="card animate-in stagger-2" data-nav="media">
                        <div class="card-icon green"><i class="fas fa-play-circle"></i></div>
                        <h3>المقاطع</h3>
                        <p class="card-desc">شاهد آخر فيديوهات فعالياتنا التعليمية.</p>
                    </div>
                    <div class="card animate-in stagger-3" data-nav="reports">
                        <div class="card-icon purple"><i class="fas fa-file-pdf"></i></div>
                        <h3>التقارير</h3>
                        <p class="card-desc">عرض وتحميل تقارير الفرقة بصيغة PDF.</p>
                    </div>
                    <div class="card animate-in stagger-4" data-nav="students">
                        <div class="card-icon blue"><i class="fas fa-users"></i></div>
                        <h3>الطلاب</h3>
                        <p class="card-desc">بيان بأسماء أعضاء الفرقة الكشفية.</p>
                    </div>
                    <div class="card animate-in stagger-5" data-nav="links">
                        <div class="card-icon blue"><i class="fas fa-compass"></i></div>
                        <h3>الروابط</h3>
                        <p class="card-desc">مواقع التطوع والاتحاد الكشفي.</p>
                    </div>
                    <div class="card animate-in stagger-6" data-nav="tasks_board" style="cursor: pointer; overflow: visible">
                        <div class="card-icon green"><i class="fas fa-tasks"></i></div>
                        <h3>المهام والملاحظات</h3>
                        <p class="card-desc" style="margin-bottom: 12px">أضف وتابع مهامك وأفكارك الكشفية.</p>
                        
                        <div class="card-input-group">
                            <input type="text" id="dashboard-task-input" placeholder="اكتب شيئاً...">
                            <div id="dashboard-schedule-row" class="task-schedule-row hidden">
                                <div class="task-input-field">
                                    <i class="fas fa-calendar-day"></i>
                                    <input type="date" id="dashboard-task-date">
                                </div>
                                <div class="task-input-field">
                                    <i class="fas fa-clock"></i>
                                    <input type="time" id="dashboard-task-time">
                                </div>
                            </div>
                            <div class="card-input-btns btns">
                                <button id="add-dash-note" title="إضافة ملاحظة"><i class="fas fa-sticky-note"></i> ملاحظة</button>
                                <button id="add-dash-task" title="إضافة مهمة"><i class="fas fa-plus"></i> مهمة</button>
                                <button id="toggle-dash-schedule" class="btn-toggle-schedule" title="جدولة التذكير"><i class="fas fa-calendar-alt"></i></button>
                                <button onclick="window.testNotification()" class="btn-toggle-schedule" title="اختبار الإشعارات"><i class="fas fa-bell"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /* ===================== المستندات ===================== */
    documents: () => `
        <div class="page-section animate-fade">
            <div class="page-header sticky-header">
                <div>
                    <h1><i class="fas fa-folder-open" style="margin-left:10px;color:var(--primary-green)"></i>المستندات</h1>
                    <div id="folder-breadcrumb" class="breadcrumb" style="margin-top:4px"></div>
                </div>
                <div class="header-actions">
                    <button class="glass-btn" id="refresh-docs"><i class="fas fa-sync-alt"></i> <span>تحديث</span></button>
                </div>
            </div>

            <div id="drive-files-container" class="docs-${state.docsViewMode}">
                <div class="loading-state"><div class="spinner"></div><p>جاري تحميل الملفات...</p></div>
            </div>
        </div>
    `,

    /* ===================== التقويم ===================== */
    calendar: () => `
    <div class="page-section animate-fade">
            <div class="page-header sticky-header">
                <div>
                    <h1><i class="fas fa-calendar-alt" style="margin-left:10px;color:var(--primary-green)"></i>التقويم</h1>
                    <p style="margin-top:4px">خطط لمستقبلك الكشفي! اضغط على أي يوم لإضافة حدث.</p>
                </div>
            </div>
            <div class="calendar-wrapper animate-in">
                <div class="calendar-header">
                    <button class="cal-btn" id="cal-prev"><i class="fas fa-chevron-right"></i></button>
                    <h2 id="calendar-month-year"></h2>
                    <button class="cal-btn" id="cal-next"><i class="fas fa-chevron-left"></i></button>
                </div>
                <div class="calendar-grid-header">
                    <span>أحد</span><span>إثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span><span>سبت</span>
                </div>
                <div id="calendar-grid" class="calendar-grid"></div>
            </div>

            <div class="upcoming-events-section animate-in">
                <h3 class="section-title"><i class="fas fa-list-check" style="margin-left:8px;color:var(--primary-green)"></i>جدول الأعمال</h3>
                <div id="upcoming-events-list" class="upcoming-events-list">
                    <p class="empty-upcoming">لا توجد أحداث قادمة. اضغط على أي يوم لإضافة حدث جديد.</p>
                </div>
            </div>
        </div>
    `,

    /* ===================== المقاطع ===================== */
    media: () => `
    <div class="page-section animate-fade">
            <div class="page-header sticky-header">
                <div>
                    <h1><i class="fas fa-play-circle" style="margin-left:10px;color:var(--primary-green)"></i>المقاطع والمرئيات</h1>
                    <p style="margin-top:4px">آخر المقاطع المنشورة. اضغط لمشاهدة المقطع.</p>
                </div>
                <div class="header-actions">
                    <button class="glass-btn" id="refresh-videos">
                        <i class="fas fa-sync-alt"></i> <span>تحديث</span>
                    </button>
                </div>
            </div>

            <div id="youtube-videos-container">
                <div class="loading-state"><div class="spinner"></div><p>جاري تحميل المقاطع من YouTube...</p></div>
            </div>
        </div>
    `,

    /* ===================== روابط ===================== */
    links: () => {
        const categories = {
            'sites': 'مواقعنا',
            'edu': 'خدمات تعليمية',
            'vol': 'تطوع ومنظمات',
            'user': 'روابطي المضافة'
        };

        const defaultLinks = DEFAULT_LINKS;
        const all = [...defaultLinks, ...state.customLinks.map(l => ({ ...l, cat: 'user' }))];

        return `
    <div class="page-section animate-fade links-section" id="links-section-container">
        <div class="page-header sticky-header">
            <div>
                <h1><i class="fas fa-compass" style="margin-left:10px;color:var(--primary-green)"></i>روابط تهمنا</h1>
                <p style="margin-top:4px">مجموعة من المواقع والمنصات المفيدة لأعضاء الكشافة.</p>
            </div>
            <div class="header-actions">
                <button class="glass-btn" id="toggle-edit-links">
                    <i class="fas fa-edit"></i> <span>تعديل</span>
                </button>
                <button class="glass-btn add-link-btn">
                    <i class="fas fa-plus-circle"></i> <span>إضافة رابط</span>
                </button>
            </div>
        </div>

                ${Object.entries(categories).map(([key, label]) => {
            const catItems = all.filter(l => l.cat === key);
            if (catItems.length === 0) return '';
            return `
                        <h3 class="section-title" style="margin-top:${key === 'sites' ? '0' : '30px'}">${label}</h3>
                        <div class="card-grid">
                            ${catItems.map(l => `
                                <div class="card-wrapper">
                                    <a href="${l.url}" target="_blank" class="link-card animate-in" data-item='${JSON.stringify({ id: l.url, name: l.name, type: 'link', icon: l.icon, url: l.url })}'>
                                        <div class="link-icon card-icon ${l.color}"><i class="${l.icon}"></i></div>
                                        <div class="link-info">
                                            <h4>${l.name}</h4>
                                            <p>${l.desc || 'رابط خارجي'}</p>
                                        </div>
                                    </a>
                                    ${key === 'user' ? `<button class="del-link" data-url="${l.url}"><i class="fas fa-trash-alt"></i></button>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
        }).join('')
            }
            </div>

    <div id="add-link-modal" class="custom-modal">
        <div class="modal-content animate-in">
            <div class="modal-header">
                <h3>إضافة رابط ذكي</h3>
                <i class="fas fa-times close-modal link-modal-close"></i>
            </div>
            <div class="modal-body">
                <div class="form-group" style="position:relative">
                    <label>رابط الموقع (URL)</label>
                    <input type="url" id="link-url" placeholder="انسخ الرابط هنا لجلب البيانات تلقائياً...">
                        <div class="fetching-overlay" id="url-fetching"><i class="fas fa-spinner fa-spin"></i> جلب البيانات...</div>
                </div>
                <div class="form-group">
                    <label>اسم الموقع</label>
                    <input type="text" id="link-name" placeholder="سيكتب تلقائياً...">
                </div>
                <div class="form-group">
                    <label>وصف مختصر</label>
                    <input type="text" id="link-desc" placeholder="وصف الرابط...">
                </div>

                <label class="icon-picker-label">اختر أيقونة مناسبة</label>
                <div class="icon-picker-grid" id="icon-picker-grid">
                    <!-- Education -->
                    <div class="icon-option" data-icon="fas fa-graduation-cap"><i class="fas fa-graduation-cap"></i></div>
                    <div class="icon-option" data-icon="fas fa-book-open"><i class="fas fa-book-open"></i></div>
                    <div class="icon-option" data-icon="fas fa-chalkboard-teacher"><i class="fas fa-chalkboard-teacher"></i></div>
                    <!-- Scouting -->
                    <div class="icon-option" data-icon="fas fa-campground"><i class="fas fa-campground"></i></div>
                    <div class="icon-option" data-icon="fas fa-compass"><i class="fas fa-compass"></i></div>
                    <div class="icon-option" data-icon="fas fa-fire"><i class="fas fa-fire"></i></div>
                    <div class="icon-option" data-icon="fas fa-knot-tied"><i class="fas fa-knot-tied"></i></div>
                    <div class="icon-option" data-icon="fas fa-map-marked-alt"><i class="fas fa-map-marked-alt"></i></div>
                    <!-- Agriculture/Nature -->
                    <div class="icon-option" data-icon="fas fa-leaf"><i class="fas fa-leaf"></i></div>
                    <div class="icon-option" data-icon="fas fa-seedling"><i class="fas fa-seedling"></i></div>
                    <div class="icon-option" data-icon="fas fa-tree"><i class="fas fa-tree"></i></div>
                    <!-- Tech -->
                    <div class="icon-option" data-icon="fas fa-laptop-code"><i class="fas fa-laptop-code"></i></div>
                    <div class="icon-option" data-icon="fas fa-wifi"><i class="fas fa-wifi"></i></div>
                    <!-- General -->
                    <div class="icon-option" data-icon="fas fa-link"><i class="fas fa-link"></i></div>
                    <div class="icon-option" data-icon="fas fa-globe"><i class="fas fa-globe"></i></div>
                    <div class="icon-option" data-icon="fas fa-star"><i class="fas fa-star"></i></div>
                    <div class="icon-option" data-icon="fas fa-info-circle"><i class="fas fa-info-circle"></i></div>
                </div>

                <div class="modal-actions">
                    <button class="modal-btn cancel link-modal-close">إلغاء</button>
                    <button class="modal-btn save link-save-btn">حفظ الرابط</button>
                </div>
            </div>
        </div>
    </div>
`;
    },

    /* ===================== التقارير ===================== */
    reports: () => `
    <div class="page-section animate-fade">
            <div class="page-header sticky-header">
                <div>
                    <h1><i class="fas fa-file-pdf" style="margin-left:10px;color:var(--primary-green)"></i>التقارير</h1>
                    <p style="margin-top:4px">عرض وتحميل تقارير الفرقة بصيغة PDF.</p>
                </div>
                <div class="header-actions">
                    <button class="glass-btn" id="refresh-reports"><i class="fas fa-sync-alt"></i> <span>تحديث</span></button>
                </div>
            </div>

            <div id="reports-container" class="reports-grid">
                <div class="loading-state"><div class="spinner"></div><p>جاري تحميل التقارير...</p></div>
            </div>
        </div>
    `,

    studentsLoading: () => `
    <div class="page-section animate-fade">
            <div class="page-header sticky-header">
                <div>
                    <h1><i class="fas fa-users" style="margin-left:10px;color:var(--primary-green)"></i>الطلاب</h1>
                </div>
                <div class="header-actions">
                    <a href="https://docs.google.com/document/d/${CONFIG.STUDENTS_DOC_ID}/edit" target="_blank" class="glass-btn" title="فتح المستند الأصلي">
                        <i class="fas fa-file-word"></i> <span>فتح الملف</span>
                    </a>
                    <button id="refresh-students" class="btn-refresh glass-btn" title="تحديث البيانات">
                        <i class="fas fa-sync-alt"></i>
                        <span>تحديث</span>
                    </button>
                </div>
            </div>
            <div class="loading-state" style="margin-top:60px">
                <div class="spinner"></div>
                <p>جاري تحميل سجلات الطلاب...</p>
            </div>
        </div>
    `,

    /* ===================== الطلاب ===================== */
    students: (studentsList = []) => {
        const isUnlocked = state.isStudentsUnlocked;
        const rows = studentsList.map(s => `
    <tr class="student-row" data-name="${s.name}" data-student='${JSON.stringify(s)}'>
                <td>${s.id}</td>
                <td class="student-name">${s.name}</td>
                <td class="student-sensitive"><span class="${isUnlocked ? '' : 'blurred'}">${s.nationality}</span></td>
                <td class="student-sensitive"><span class="${isUnlocked ? '' : 'blurred'}">${s.civilId}</span></td>
                <td class="student-sensitive"><span class="${isUnlocked ? '' : 'blurred'}">${s.section}</span></td>
                <td class="student-sensitive"><span class="${isUnlocked ? '' : 'blurred'}">${s.phone}</span></td>
            </tr>
    `).join('');

        return `
    <div class="page-section animate-fade" >
            <div class="page-header sticky-header">
                <div>
                    <h1><i class="fas fa-users" style="margin-left:10px;color:var(--primary-green)"></i>الطلاب</h1>
                    <p style="margin-top:4px">بيان بأسماء الفرقة الكشفية. المزامنة مفعلة مع Google Docs.</p>
                </div>
                <div class="header-actions">
                    <a href="https://docs.google.com/document/d/${CONFIG.STUDENTS_DOC_ID}/edit" target="_blank" class="glass-btn" title="فتح المستند الأصلي">
                        <i class="fas fa-file-word"></i> <span>فتح الملف</span>
                    </a>
                    <button id="refresh-students" class="btn-refresh glass-btn" title="تحديث البيانات">
                        <i class="fas fa-sync-alt"></i>
                        <span>تحديث</span>
                    </button>
                </div>
            </div>

            <div class="students-toolbar">
                <div class="students-search-box">
                    <i class="fas fa-search"></i>
                    <!-- Anti-autofill measures -->
                    <input type="text" id="students-search" placeholder="ابحث بالاسم..." 
                           autocomplete="off" 
                           role="presentation"
                           aria-autocomplete="none"
                           name="search_${Math.random().toString(36).substring(7)}">
                </div>
            </div>

            <div class="students-table-wrapper">
                <table class="students-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>الاسم</th>
                            <th>الجنسية</th>
                            <th>السجل المدني</th>
                            <th>الشعبة</th>
                            <th>رقم الجوال</th>
                        </tr>
                    </thead>
                    <tbody id="students-tbody">
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    },

    /* ===================== لوحة المهام ===================== */
    tasks_board: (tasks = []) => {
        const notes = tasks.filter(t => t.type === 'note');
        const pendingTasks = tasks.filter(t => t.type === 'task' && !t.completed);
        const doneTasks = tasks.filter(t => t.type === 'task' && t.completed);

        return `
    <div class="page-section animate-fade tasks-board-page">
                <div class="page-header sticky-header">
                    <div>
                        <h1><i class="fas fa-tasks" style="margin-left:10px;color:var(--primary-green)"></i>لوحة المهام والملاحظات</h1>
                        <p style="margin-top:4px">إدارة شاملة لجميع أفكارك ومسؤولياتك الكشفية.</p>
                    </div>
                </div>

                <div class="tasks-board-grid">
                    <!-- Notes Section -->
                    <div class="board-section">
                        <h3 class="section-title"><i class="fas fa-sticky-note"></i> الملاحظات (${notes.length})</h3>
                        <div class="notes-board-grid">
                            ${notes.map(n => `
                                <div class="note-card animate-in">
                                    <div class="note-card-pin"><i class="fas fa-thumbtack"></i></div>
                                    <p>${n.text}</p>
                                    <button class="note-card-del" onclick="window.deleteTaskItem(${n.id})">حذف</button>
                                </div>
                            `).join('')}
                            ${notes.length === 0 ? '<div class="empty-state">لا توجد ملاحظات</div>' : ''}
                        </div>
                    </div>

                    <!-- Tasks Section -->
                    <div class="board-section">
                        <h3 class="section-title"><i class="fas fa-check-double"></i> المهام (${pendingTasks.length + doneTasks.length})</h3>
                        <div class="tasks-board-list">
                            <div class="task-group">
                                <h4>قيد التنفيذ</h4>
                                ${pendingTasks.map(t => `
                                    <div class="task-board-item animate-in">
                                        <div class="task-check" onclick="window.toggleTaskItem(${t.id})"><i class="fas fa-check"></i></div>
                                        <div class="task-info">
                                            <div class="task-text">${t.text}</div>
                                            ${t.reminderTime ? `<div class="task-due-time"><i class="fas fa-clock"></i> ${new Date(t.reminderTime).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                                        </div>
                                        <div class="task-del" onclick="window.deleteTaskItem(${t.id})"><i class="fas fa-times"></i></div>
                                    </div>
                                `).join('')}
                                ${pendingTasks.length === 0 ? '<div class="empty-state">كل المهام منجزة! ✨</div>' : ''}
                            </div>
                            
                            ${doneTasks.length > 0 ? `
                                <div class="task-group completed">
                                    <h4>مكتملة</h4>
                                    ${doneTasks.map(t => `
                                        <div class="task-board-item completed">
                                            <div class="task-check active" onclick="window.toggleTaskItem(${t.id})"><i class="fas fa-check"></i></div>
                                            <div class="task-info">
                                                <div class="task-text">${t.text}</div>
                                                ${t.reminderTime ? `<div class="task-due-time"><i class="fas fa-clock"></i> ${new Date(t.reminderTime).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                                            </div>
                                            <div class="task-del" onclick="window.deleteTaskItem(${t.id})"><i class="fas fa-times"></i></div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
    `;
    }
}

export function buildFileItem(file) {
    const type = getFileType(file.mimeType);
    const typeName = getFileTypeName(file.mimeType);
    const openUrl = getFileOpenUrl(file);
    const icon = getFileIcon(type);

    if (state.docsViewMode === 'grid') {
        const thumb = file.thumbnailLink ? file.thumbnailLink.replace('=s220', '=s400') : null;
        return `
    <div class="doc-card animate-in" data-id="${file.id}" data-mime="${file.mimeType}" data-url="${openUrl}">
                <div class="doc-card-thumb ${type}">
                    ${thumb ? `<img src="${thumb}" loading="lazy">` : `<i class="${icon}"></i>`}
                    <div class="doc-card-type-icon">${typeName}</div>
                </div>
                <div class="doc-card-info">
                    <h4 title="${file.name}">${file.name}</h4>
                    <div class="doc-card-bottom">
                        <span>${typeName}</span>
                        ${file.webContentLink ? `<a href="${file.webContentLink}" class="card-dl-btn" onclick="event.stopPropagation()"><i class="fas fa-download"></i></a>` : ''}
                    </div>
                </div>
            </div>
    `;
    }

    return `
    <div class="doc-item animate-in" data-id="${file.id}" data-mime="${file.mimeType}" data-url="${openUrl}">
            <div class="doc-icon ${type}"><i class="${icon}"></i></div>
            <div class="doc-info">
                <h4>${file.name}</h4>
                <span>${typeName}</span>
            </div>
            <div class="doc-actions">
                ${file.webContentLink ? `<a href="${file.webContentLink}" class="doc-dl-btn" onclick="event.stopPropagation()"><i class="fas fa-download"></i></a>` : ''}
                <button class="btn-open">فتح</button>
            </div>
        </div>
    `;
}

export function buildYouTubeVideoCard(video) {
    const trackingItem = {
        id: video.id,
        name: video.title,
        type: 'video',
        icon: 'fab fa-youtube',
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    return `
        <div class="video-card animate-in" data-video-id="${video.id}" data-item='${JSON.stringify(trackingItem).replace(/"/g, '&quot;')}'>
            <div class="thumb-container">
                <img class="thumb" src="${video.thumbnail}" alt="${video.title}" loading="lazy" onerror="this.outerHTML='<div class=thumb-placeholder><i class=fas fa-play-circle></i></div>'">
                <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" class="yt-open-btn" onclick="event.stopPropagation()" title="فتح في يوتيوب">
                    <i class="fab fa-youtube"></i> فتح في يوتيوب
                </a>
            </div>
            <div class="video-info">
                <h4>${video.title}</h4>
                <div class="video-card-actions">
                    <span>${new Date(video.publishedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
        </div>
    `;
}
