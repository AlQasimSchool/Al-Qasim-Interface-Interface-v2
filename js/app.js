import { navigateTo, renderDocuments, renderReports, renderStudents, updateClock } from './navigation.js';
import { handleGlobalSearch } from './search.js';
import { fetchWeather } from './api.js';
import { getWeatherIcon } from './utils.js';
import { state, saveDocsViewMode } from './state.js';
import { initCalendar, selectedDay, calDate, calEvents } from './calendar.js';
import { renderSidebarTasks, addTask, toggleTask, deleteTask } from './tasks.js';
import { trackClick } from './tracking.js';
import { deleteCustomLink, saveCustomLink } from './links.js';
import { STUDENTS_PASSWORD } from './students.js';
import { initNotifications } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Navigation & UI
    navigateTo('dashboard');
    updateClock();
    initGlobalWeather();
    renderSidebarTasks();
    initNotifications();

    // 2. Continuous Features
    setInterval(updateClock, 1000);

    // 3. Event Listeners (Global Delegation)
    document.body.addEventListener('click', async (e) => {
        // Sidebar Navigation
        const navItem = e.target.closest('.nav-item');
        if (navItem) {
            e.preventDefault();
            navigateTo(navItem.dataset.page);
            updateCenterButton(navItem.dataset.page);

            // Auto-close sidebar on mobile after navigation
            if (window.innerWidth <= 850) {
                document.querySelector('.sidebar').classList.remove('active');
                document.getElementById('sidebar-overlay').classList.remove('active');
            }
        }

        // Center button in bottom nav
        const centerBtn = e.target.closest('#nav-center-btn');
        if (centerBtn) {
            const currentPage = centerBtn.dataset.page;
            if (currentPage === 'calendar') {
                navigateTo('calendar');
                updateCenterButton('calendar');
            } else {
                // We're on calendar, + opens add event for selected day
                if (selectedDay) {
                    const parts = selectedDay.split('-');
                    const dayNum = parseInt(parts[2]);
                    window.openCalendarModal(selectedDay, dayNum);
                } else {
                    // No day selected, select today first
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
                    window.openCalendarModal(todayStr, today.getDate());
                }
            }
        }

        // Dashboard Card Navigation
        const navCard = e.target.closest('[data-nav]');
        if (navCard && !e.target.closest('.card-input-group')) {
            navigateTo(navCard.dataset.nav);
        }

        // Tracking click
        const trackingEl = e.target.closest('[data-item]');
        if (trackingEl) {
            trackClick(JSON.parse(trackingEl.dataset.item));
        }

        // View Toggles
        if (e.target.closest('#view-list')) {
            state.docsViewMode = 'list';
            saveDocsViewMode();
            renderDocuments(state.currentFolderId);
        }
        if (e.target.closest('#view-grid')) {
            state.docsViewMode = 'grid';
            saveDocsViewMode();
            renderDocuments(state.currentFolderId);
        }

        // Mobile Sidebar Toggle
        if (e.target.closest('#mobile-toggle')) {
            document.querySelector('.sidebar').classList.add('active');
            document.getElementById('sidebar-overlay').classList.add('active');
        }

        // Close sidebar by overlay
        if (e.target.id === 'sidebar-overlay') {
            document.querySelector('.sidebar').classList.remove('active');
            document.getElementById('sidebar-overlay').classList.remove('active');
        }

        // Refresh buttons (Simplified & Global)
        if (e.target.closest('#refresh-docs')) renderDocuments(state.currentFolderId);
        if (e.target.closest('#refresh-videos')) import('./navigation.js').then(m => m.renderMedia());
        if (e.target.closest('#refresh-reports')) { state.reportFilesCache = null; renderReports(); }
        if (e.target.closest('#refresh-students')) { state.studentsCache = null; renderStudents(); }
        if (e.target.closest('#refresh-calendar')) { state.calendarEventsCache = null; initCalendar(); }

        // Report Card — open PDF viewer
        const reportCard = e.target.closest('.report-card');
        if (reportCard && (e.target.closest('.report-view-btn') || !e.target.closest('.report-dl-btn'))) {
            e.preventDefault();
            const previewUrl = reportCard.dataset.previewUrl;
            const name = reportCard.dataset.name;
            const reportId = reportCard.dataset.reportId;

            // Track for Smart Access
            trackClick({ id: reportId, name: name, url: previewUrl, type: 'pdf', sub: 'تقرير', icon: 'fas fa-file-pdf' });

            openPdfViewer(previewUrl, name);
        }

        // Students — handle click (unlock or copy)
        const studentRow = e.target.closest('.student-row');
        if (studentRow) {
            if (!state.isStudentsUnlocked) {
                openPasswordPopup();
            } else {
                // Already unlocked — copy clicked cell text
                const cell = e.target.closest('td');
                // Skip if it's the ID column (index 0) or blurred
                if (cell && cell.cellIndex !== 0 && !cell.querySelector('.blurred')) {
                    const text = cell.textContent.trim();
                    if (text && text !== '#' && !text.includes('\n')) {
                        navigator.clipboard.writeText(text).then(() => {
                            showToast(`تم نسخ: ${text}`);
                        });
                    }
                }
            }
        }

        // Students unlock
        if (e.target.closest('#students-unlock-btn')) {
            openPasswordPopup();
        }

        // Sidebar Tasks
        if (e.target.closest('#add-sidebar-task') || e.target.closest('#add-sidebar-note')) {
            const isTask = e.target.closest('#add-sidebar-task');
            const input = document.getElementById('sidebar-task-input');
            const dateInput = document.getElementById('sidebar-task-date');
            const timeInput = document.getElementById('sidebar-task-time');
            let reminder = null;

            if (timeInput && timeInput.value) {
                const now = new Date();
                const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const dateVal = dateInput.value || localDateStr;
                const [h, m] = timeInput.value.split(':').map(Number);
                const [y, mm, d] = dateVal.split('-').map(Number);
                reminder = new Date(y, mm - 1, d, h, m).toISOString();
            } else if (dateInput && dateInput.value) {
                const [y, mm, d] = dateInput.value.split('-').map(Number);
                reminder = new Date(y, mm - 1, d, 8, 0).toISOString();
            }

            await addTask(input.value, isTask ? 'task' : 'note', reminder);
            input.value = '';
            if (dateInput) dateInput.value = '';
            if (timeInput) timeInput.value = '';
        }

        // Dashboard Card Tasks
        if (e.target.closest('#add-dash-task') || e.target.closest('#add-dash-note')) {
            const isTask = e.target.closest('#add-dash-task');
            const input = document.getElementById('dashboard-task-input');
            const dateInput = document.getElementById('dashboard-task-date');
            const timeInput = document.getElementById('dashboard-task-time');
            let reminder = null;

            if (timeInput && timeInput.value) {
                const now = new Date();
                const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const dateVal = dateInput.value || localDateStr;
                const [h, m] = timeInput.value.split(':').map(Number);
                const [y, mm, d] = dateVal.split('-').map(Number);
                reminder = new Date(y, mm - 1, d, h, m).toISOString();
            } else if (dateInput && dateInput.value) {
                const [y, mm, d] = dateInput.value.split('-').map(Number);
                reminder = new Date(y, mm - 1, d, 8, 0).toISOString();
            }

            await addTask(input.value, isTask ? 'task' : 'note', reminder);
            input.value = '';
            if (dateInput) dateInput.value = '';
            if (timeInput) timeInput.value = '';
        }

        // Toggle Schedule Visibility (Sidebar)
        if (e.target.closest('#toggle-sidebar-schedule')) {
            const btn = e.target.closest('#toggle-sidebar-schedule');
            const row = document.getElementById('sidebar-schedule-row');
            if (row) {
                row.classList.toggle('hidden');
                btn.classList.toggle('active');
            }
        }

        // Toggle Schedule Visibility (Dashboard)
        if (e.target.closest('#toggle-dash-schedule')) {
            const btn = e.target.closest('#toggle-dash-schedule');
            const row = document.getElementById('dashboard-schedule-row');
            if (row) {
                row.classList.toggle('hidden');
                btn.classList.toggle('active');
            }
        }

        const taskCheck = e.target.closest('.sidebar-check');
        if (taskCheck) {
            import('./tasks.js').then(m => m.toggleTask(parseInt(taskCheck.dataset.id)));
        }

        const taskDel = e.target.closest('.sidebar-del') || e.target.closest('.sidebar-note-del');
        if (taskDel) {
            import('./tasks.js').then(m => m.deleteTask(parseInt(taskDel.dataset.id)));
        }

        // Links management
        if (e.target.closest('.add-link-btn')) {
            document.getElementById('add-link-modal').style.display = 'flex';
            // Select default icon
            document.querySelector('.icon-option[data-icon="fas fa-link"]').click();
        }
        if (e.target.closest('.link-modal-close')) {
            document.getElementById('add-link-modal').style.display = 'none';
        }

        // Toggle Edit Mode
        if (e.target.closest('#toggle-edit-links')) {
            const btn = e.target.closest('#toggle-edit-links');
            const section = document.getElementById('links-section-container');
            section.classList.toggle('edit-mode');

            if (section.classList.contains('edit-mode')) {
                btn.style.background = '#ffebee';
                btn.style.color = '#c62828';
                btn.style.borderColor = '#c62828';
                btn.querySelector('span').textContent = 'إلغاء التعديل';
            } else {
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderColor = '';
                btn.querySelector('span').textContent = 'تعديل';
            }
        }

        // Icon Picker Selection
        if (e.target.closest('.icon-option')) {
            document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
            e.target.closest('.icon-option').classList.add('selected');
        }

        if (e.target.closest('.link-save-btn')) {
            const name = document.getElementById('link-name').value;
            const url = document.getElementById('link-url').value;
            const desc = document.getElementById('link-desc').value;

            const selectedIconEl = document.querySelector('.icon-option.selected');
            const icon = selectedIconEl ? selectedIconEl.dataset.icon : 'fas fa-link';

            if (saveCustomLink(name, url, desc, icon)) {
                document.getElementById('add-link-modal').style.display = 'none';
                // Reset fields
                document.getElementById('link-name').value = '';
                document.getElementById('link-url').value = '';
                document.getElementById('link-desc').value = '';

                import('./navigation.js').then(m => m.navigateTo('links'));
            }
        }
        if (e.target.closest('.del-link')) {
            if (confirm('هل أنت متأكد من حذف هذا الرابط؟')) {
                deleteCustomLink(e.target.closest('.del-link').dataset.url);
                // Refresh view
                import('./navigation.js').then(m => m.navigateTo('links'));
                // Keep edit mode active visual hack or just let it reset
            }
        }

        // Document Opening
        const docItem = e.target.closest('[data-url]');
        if (docItem && !e.target.closest('.card-dl-btn') && !e.target.closest('.doc-dl-btn') && !e.target.closest('.yt-open-btn')) {
            if (docItem.dataset.mime !== 'application/vnd.google-apps.folder') {
                // If it's a video, open in modal
                if (docItem.dataset.videoId || (docItem.dataset.item && JSON.parse(docItem.dataset.item).type === 'video')) {
                    const videoId = docItem.dataset.videoId || JSON.parse(docItem.dataset.item).id;
                    openVideo(videoId);
                } else {
                    window.open(docItem.dataset.url, '_blank');
                }
            }
        }

        // Search blur handling
        if (!e.target.closest('.header-search')) {
            document.getElementById('search-results')?.classList.remove('active');
        }

        // Search Result Interaction
        const searchItem = e.target.closest('.search-result-item');
        if (searchItem) {
            const { searchType, searchUrl, searchName } = searchItem.dataset;
            document.getElementById('search-results').classList.remove('active');
            document.getElementById('global-search').value = '';

            if (searchType === 'video') {
                openVideo(searchUrl);
            } else if (searchType === 'report' || searchType === 'doc') {
                openPdfViewer(searchUrl, searchName);
            } else if (searchType === 'student') {
                navigateTo('students');
            } else if (searchType === 'link') {
                window.open(searchUrl, '_blank');
            }
        }
    });

    // 3.1 Long Press Logic for Students
    let longPressTimer;
    const LONG_PRESS_DURATION = 700;

    const startLongPress = (e) => {
        const row = e.target.closest('.student-row');
        if (!row || !state.isStudentsUnlocked) return;

        // Feedback
        row.style.transform = 'scale(0.98)';
        row.style.backgroundColor = 'rgba(46, 125, 50, 0.05)';

        longPressTimer = setTimeout(() => {
            const data = JSON.parse(row.dataset.student);
            const textToCopy = `
بيانات الطالب: ${data.name}
الرقم: ${data.id}
الجنسية: ${data.nationality}
السجل المدني: ${data.civilId}
الشعبة: ${data.section}
الجوال: ${data.phone}
            `.trim();

            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast(`تم نسخ كامل بيانات: ${data.name}`);
                row.style.transform = '';
                row.style.backgroundColor = '';
                // Haptic feedback if available
                if (window.navigator.vibrate) window.navigator.vibrate(50);
            });
        }, LONG_PRESS_DURATION);
    };

    const cancelLongPress = (e) => {
        clearTimeout(longPressTimer);
        const row = e.target.closest('.student-row');
        if (row) {
            row.style.transform = '';
            row.style.backgroundColor = '';
        }
    };

    document.body.addEventListener('mousedown', startLongPress);
    document.body.addEventListener('mouseup', cancelLongPress);
    document.body.addEventListener('mouseleave', cancelLongPress);
    document.body.addEventListener('touchstart', startLongPress, { passive: true });
    document.body.addEventListener('touchend', cancelLongPress, { passive: true });
    document.body.addEventListener('touchcancel', cancelLongPress, { passive: true });

    function openVideo(videoId) {
        const modal = document.createElement('div');
        modal.className = 'video-modal';
        modal.innerHTML = `
            <div class="video-modal-backdrop"></div>
            <div class="video-modal-content animate-in">
                <button class="video-modal-close"><i class="fas fa-times"></i></button>
                <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                        frameborder="0" 
                        allow="autoplay; encrypted-media; picture-in-picture" 
                        allowfullscreen></iframe>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.video-modal-backdrop').onclick = () => modal.remove();
        modal.querySelector('.video-modal-close').onclick = () => modal.remove();
    }

    function openPdfViewer(url, title) {
        const modal = document.createElement('div');
        modal.className = 'pdf-viewer-modal';
        modal.innerHTML = `
            <div class="pdf-modal-backdrop"></div>
            <div class="pdf-modal-content animate-in">
                <div class="pdf-modal-header">
                    <h3><i class="fas fa-file-pdf"></i> ${title}</h3>
                    <button class="pdf-modal-close"><i class="fas fa-times"></i></button>
                </div>
                <iframe src="${url}" frameborder="0" allowfullscreen></iframe>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.pdf-modal-backdrop').onclick = () => modal.remove();
        modal.querySelector('.pdf-modal-close').onclick = () => modal.remove();
    }

    function openPasswordPopup() {
        if (document.getElementById('password-popup')) return;

        const modal = document.createElement('div');
        modal.id = 'password-popup';
        modal.className = 'password-popup-modal';
        modal.innerHTML = `
            <div class="password-popup-backdrop"></div>
            <div class="password-popup-content animate-in">
                <input type="text" name="fake-user" style="display:none" aria-hidden="true" tabindex="-1">
                <input type="password" name="fake-pass" style="display:none" aria-hidden="true" tabindex="-1">
                
                <div class="password-popup-icon"><i class="fas fa-user-shield"></i></div>
                <h3>التحقق من الهوية</h3>
                <p>يرجى إدخال كلمة المرور لرؤية البيانات الحساسة.</p>
                
                <div class="lock-form" style="display: flex; flex-direction: column; gap: 12px; align-items: center">
                    <input type="password" id="popup-password" placeholder="كلمة المرور" 
                           autocomplete="new-password" autofocus 
                           style="width: 100%; max-width: 300px; text-align: center">
                    
                    <button id="popup-unlock-btn" style="width: 100%; max-width: 300px">فتح</button>
                </div>
                <div id="popup-error" class="lock-error"></div>
            </div>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#popup-password');
        const unlock = () => {
            if (input.value === STUDENTS_PASSWORD) {
                state.isStudentsUnlocked = true;
                unblurStudentsData();
                modal.remove();
            } else {
                modal.querySelector('#popup-error').textContent = 'كلمة المرور خاطئة';
                input.value = '';
                input.focus();
            }
        };

        modal.querySelector('#popup-unlock-btn').onclick = unlock;
        modal.querySelector('.password-popup-backdrop').onclick = () => modal.remove();
        input.onkeydown = (e) => { if (e.key === 'Enter') unlock(); };
    }

    function unblurStudentsData() {
        document.querySelectorAll('.student-sensitive span.blurred').forEach(el => {
            el.classList.remove('blurred');
        });
    }

    function handleStudentsSearch(val) {
        val = val.toLowerCase().trim();
        document.querySelectorAll('.student-row').forEach(row => {
            const name = row.dataset.name.toLowerCase();
            row.style.display = name.includes(val) ? '' : 'none';
        });
    }

    function showToast(message) {
        let toast = document.getElementById('copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'copy-toast';
            toast.className = 'copy-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        toast.classList.add('active');

        setTimeout(() => {
            toast.classList.remove('active');
        }, 2500);
    }


    // 4. Input Events
    document.getElementById('global-search')?.addEventListener('input', (e) => {
        handleGlobalSearch(e.target.value);
    });

    // Enter key for students password
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'students-password') {
            unlockStudentsPage();
        }
    });

    // Students Search
    document.addEventListener('input', (e) => {
        if (e.target.id === 'students-search') {
            handleStudentsSearch(e.target.value);
        }
    });

    // Smart Link Auto-Fetch
    document.addEventListener('focusout', async (e) => {
        if (e.target.id === 'link-url') {
            const url = e.target.value;
            if (url && url.startsWith('http')) {
                const loader = document.getElementById('url-fetching');
                const nameInput = document.getElementById('link-name');
                const descInput = document.getElementById('link-desc');

                // Only fetch if name is empty to avoid overwriting user edits
                if (nameInput.value !== '') return;

                loader.classList.add('active');
                try {
                    const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
                    const data = await response.json();

                    if (data.status === 'success') {
                        if (data.data.title) nameInput.value = data.data.title;
                        if (data.data.description) descInput.value = data.data.description;
                    }
                } catch (err) {
                    console.log('Fetch failed', err);
                } finally {
                    loader.classList.remove('active');
                }
            }
        }
    });
    // Center button toggle logic
    function updateCenterButton(pageId) {
        const btn = document.getElementById('nav-center-btn');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (!icon) return;

        if (pageId === 'calendar') {
            // Check if selected day has an event
            const hasEvent = selectedDay && calEvents[selectedDay];

            if (hasEvent) {
                icon.className = 'fas fa-pen-to-square'; // Modern edit icon
                btn.dataset.page = 'edit';
            } else {
                icon.className = 'fas fa-plus';
                btn.dataset.page = 'add';
            }
        } else {
            // Switch back to calendar navigation
            icon.className = 'fas fa-calendar-alt';
            btn.dataset.page = 'calendar';
        }
    }

    // Make it accessible globally
    window.updateCenterButton = updateCenterButton;
});

import { fetchDriveFiles, fetchYouTubeVideos } from './api.js';

async function initGlobalWeather() {
    const weatherBox = document.getElementById('header-weather');
    if (!weatherBox) return;

    const data = await fetchWeather();
    if (data && data.current_weather) {
        const w = data.current_weather;
        const hour = new Date().getHours();
        const isNight = hour >= 18 || hour <= 5;

        // Map codes to icons with day/night awareness
        let icon = getWeatherIcon(w.weathercode);
        if (isNight && icon === 'fa-sun') icon = 'fa-moon';
        if (isNight && icon === 'fa-cloud-sun') icon = 'fa-cloud-moon';

        weatherBox.innerHTML = `
            <div class="weather-content animate-fade">
                <i class="fas ${icon}" style="color: ${isNight ? '#94a3b8' : '#f1c40f'}"></i>
                <span class="temp">${Math.round(w.temperature)}°C</span>
                <span class="city">الدمام</span>
            </div>
        `;
    }
}
