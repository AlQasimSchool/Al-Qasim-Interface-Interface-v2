import { state } from './state.js';
import { templates, buildFileItem, buildYouTubeVideoCard } from './ui.js';
import { fetchDriveFiles, fetchYouTubeVideos, fetchReportFiles, fetchStudentsFromDoc } from './api.js';
import { getTasks } from './tasks.js';
import { initCalendar } from './calendar.js';

window.openNewTaskModal = () => {
    // This is a placeholder for wherever the task logic lives
    // Assuming we want to show the calendar modal for now as in mockup
    const today = new Date();
    const dStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    window.openCalendarModal(dStr, today.getDate());
};

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
            }
        } catch (err) {
            console.error('Logic Error:', err);
        }
    }, 150);
}

export async function loadDashboardStats() {
    try {
        const files = await fetchDriveFiles();
        const el = document.getElementById('stat-docs');
        if (el) el.textContent = files.length;
    } catch (e) { console.error('Stats Error:', e); }

    try {
        const videos = await fetchYouTubeVideos();
        updateVideoStat(videos.length);
    } catch (e) { console.error('Stats Error:', e); }

    try {
        const reports = await fetchReportFiles();
        const el = document.getElementById('stat-reports');
        if (el) el.textContent = reports.length;
    } catch (e) { console.error('Stats Error:', e); }

    try {
        const students = await fetchStudentsFromDoc();
        const el = document.getElementById('stat-students');
        if (el) el.textContent = students.length;
    } catch (e) { console.error('Stats Error:', e); }
}

export function updateVideoStat(count) {
    const el = document.getElementById('stat-videos');
    if (el) el.textContent = count;
}

export function updateClock() {
    const clockEl = document.getElementById('header-clock');
    if (!clockEl) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const timeBox = clockEl.querySelector('.time');
    const dateBox = clockEl.querySelector('.date');
    if (timeBox) timeBox.textContent = timeStr;
    if (dateBox) dateBox.textContent = dateStr;
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
                <div class="report-card animate-in" data-report-id="${file.id}" data-preview-url="${previewUrl}" data-name="${file.name}">
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
    const container = document.getElementById('page-content');
    if (!container) return;

    // Show loading state
    container.innerHTML = templates.studentsLoading();

    try {
        const students = await fetchStudentsFromDoc();
        container.innerHTML = templates.students(students);
    } catch (err) {
        console.error('Render Error:', err);
        container.innerHTML = `<div class="error">خطأ في تحميل بيانات الطلاب: ${err.message}</div>`;
    }
}

export function renderTasksBoard() {
    const container = document.getElementById('page-content');
    if (!container) return;

    const tasks = getTasks();
    container.innerHTML = templates.tasks_board(tasks);
}
