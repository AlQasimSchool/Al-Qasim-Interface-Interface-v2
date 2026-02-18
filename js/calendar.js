import { getHoliday } from './holidays.js';
import { sendNotification } from './notifications.js';

export let calDate = new Date();
export let calEvents = JSON.parse(localStorage.getItem('scout_cal_events') || '{}');
export let selectedDay = null;

export function initCalendar() {
    renderCalendar();

    // Bind navigation buttons
    document.getElementById('cal-prev')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('cal-next')?.addEventListener('click', () => changeMonth(1));

    // Check for today's agenda on load
    checkTodayAgenda();
}

export function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-year');
    if (!grid || !label) return;

    grid.innerHTML = '';
    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    label.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    // Days
    const isMobile = window.innerWidth <= 600;
    const dayNamesFull = ["الأحد", "الأثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const dayNamesShort = ["أحد", "ثنين", "ثلوث", "ربع", "خميس", "جمعة", "سبت"];

    const gridHeader = document.querySelector('.calendar-grid-header');
    if (gridHeader) {
        gridHeader.innerHTML = (isMobile ? dayNamesShort : dayNamesFull).map(n => `<span>${n}</span>`).join('');
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dayEl = document.createElement('div');
        const dStr = `${year}-${month}-${d}`;
        dayEl.className = 'cal-day animate-in';
        if (dStr === todayStr) dayEl.classList.add('today');

        const holiday = getHoliday(year, month, d);
        if (holiday) {
            dayEl.classList.add('is-holiday');
        }

        dayEl.innerHTML = `<span>${d}</span>`;

        // Dots/Indicators instead of text for simplicity
        if (holiday || calEvents[dStr]) {
            dayEl.innerHTML += `<div class="day-indicator-dot"></div>`;
        }

        dayEl.onclick = () => {
            // New logic: Select Day and show details card
            document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
            dayEl.classList.add('selected');
            renderDayDetails(dStr, d);
        };
        grid.appendChild(dayEl);
    }

    // Details card container if missing
    if (!document.getElementById('day-details-card')) {
        const cardNav = document.createElement('div');
        cardNav.id = 'day-details-card';
        cardNav.className = 'day-details-card';
        grid.parentElement.appendChild(cardNav);
    }

    // Auto-select today
    if (month === today.getMonth() && year === today.getFullYear()) {
        const todayEl = Array.from(grid.children).find(el => el.textContent == today.getDate() && !el.classList.contains('empty'));
        if (todayEl) todayEl.click();
    }

    // Render upcoming events below
    renderUpcomingEvents();
}

function renderDayDetails(dateStr, dayNum) {
    const card = document.getElementById('day-details-card');
    if (!card) return;

    selectedDay = dateStr;
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const holiday = getHoliday(year, month, dayNum);
    const event = calEvents[dateStr];

    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const dayNames = ["الأحد", "الأثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const dateObj = new Date(year, month, dayNum);
    const dayName = dayNames[dateObj.getDay()];
    const dateLabel = `${dayName}، ${dayNum} ${monthNames[month]}`;

    // Determine the main title and description
    let title = 'لا توجد أحداث';
    let desc = 'اضغط تعديل لإضافة حدث جديد لهذا اليوم.';
    let hasContent = false;

    if (holiday) {
        title = holiday.name;
        desc = '';
        if (holiday.desc) desc = holiday.desc;
        hasContent = true;
    }
    if (event) {
        title = event;
        desc = holiday ? `مناسبة: ${holiday.name}` : '';
        hasContent = true;
    }

    // Context-aware icon mapping
    const getCornerIcon = (text) => {
        if (!text) return '';
        const t = text.toLowerCase();
        if (t.includes('رمضان')) return '<i class="fas fa-moon corner-icon-style"></i>';
        if (t.includes('تأسيس')) return '<i class="fas fa-landmark corner-icon-style"></i>';
        if (t.includes('وطني')) return '<i class="fas fa-flag corner-icon-style"></i>';
        if (t.includes('عيد')) return '<i class="fas fa-gift corner-icon-style"></i>';
        if (t.includes('معلم')) return '<i class="fas fa-chalkboard-teacher corner-icon-style"></i>';
        return '<i class="fas fa-star corner-icon-style"></i>'; // Fallback
    };

    const cornerIcon = hasContent ? getCornerIcon(title + desc) : '';

    card.innerHTML = `
        <div class="day-detail-hero modern-card">
            <div class="day-detail-pattern"></div>
            <div class="day-detail-top">
                ${cornerIcon ? `<div class="day-detail-corner-left">${cornerIcon}</div>` : ''}
                <div class="day-detail-date" style="${!cornerIcon ? 'width: 100%; text-align: right;' : ''}">${dateLabel}</div>
            </div>
            
            <div class="day-detail-content">
                <div class="day-detail-title">
                    ${title}
                </div>
                ${desc ? `<div class="day-detail-desc">${desc}</div>` : ''}
            </div>
        </div>
    `;
    card.classList.add('active');

    // Update center button icon based on content
    if (window.updateCenterButton) {
        window.updateCenterButton('calendar');
    }
}

// Attach openCalendarModal to window so it can be called from details card
window.openCalendarModal = (dateStr, dayNum) => {
    openCalendarModal(dateStr, dayNum);
};

function changeMonth(dir) {
    calDate.setMonth(calDate.getMonth() + dir);
    renderCalendar();
}

function openCalendarModal(dateStr, dayNum) {
    selectedDay = dateStr;

    // Check if modal exists, if not create it
    let modal = document.getElementById('calendar-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'calendar-modal';
        modal.className = 'custom-modal';
        modal.innerHTML = `
            <div class="modal-content animate-in">
                <div class="modal-header">
                    <h3 id="cal-modal-date">إضافة حدث</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <textarea id="cal-event-text" placeholder="اكتب تفاصيل الحدث هنا..."></textarea>
                    <button class="btn-primary" id="save-event">حفظ الحدث</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
        modal.querySelector('#save-event').onclick = saveCalendarEvent;
    }

    modal.querySelector('#cal-modal-date').textContent = `حدث يوم ${dayNum}`;
    modal.querySelector('#cal-event-text').value = calEvents[dateStr] || '';
    modal.classList.add('active');
}

async function saveCalendarEvent() {
    const text = document.getElementById('cal-event-text').value.trim();
    if (text) {
        calEvents[selectedDay] = text;

        // Notify success via robust helper
        sendNotification('تم تحديث التقويم', `تم حفظ: ${text}`);
    } else {
        delete calEvents[selectedDay];
    }
    localStorage.setItem('scout_cal_events', JSON.stringify(calEvents));
    document.getElementById('calendar-modal').classList.remove('active');
    renderCalendar();

    // Re-render details to update buttons/ui
    if (selectedDay) {
        const parts = selectedDay.split('-');
        renderDayDetails(selectedDay, parseInt(parts[2]));
    }
}

async function checkTodayAgenda() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const event = calEvents[todayStr];

    if (event) {
        sendNotification(
            'أجندة اليوم 📅',
            `لديك حدث اليوم: ${event}`
        );
    }

    // Set up a daily check if it doesn't exist
    if (!window._agendaCheckInterval) {
        window._agendaCheckInterval = setInterval(() => {
            const now = new Date();
            // If it's the first hour of a new day, check again
            if (now.getHours() === 0 && now.getMinutes() < 60) {
                checkTodayAgenda();
            }
        }, 3600000); // Check every hour
    }
}

function renderUpcomingEvents() {
    const container = document.getElementById('upcoming-events-list');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const dayNames = ["الأحد", "الأثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    // Parse all events and filter upcoming
    const upcoming = [];
    for (const [key, text] of Object.entries(calEvents)) {
        const parts = key.split('-');
        const eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
        eventDate.setHours(0, 0, 0, 0);
        if (eventDate >= today) {
            upcoming.push({ date: eventDate, text, key });
        }
    }

    // Sort chronologically
    upcoming.sort((a, b) => a.date - b.date);

    if (upcoming.length === 0) {
        container.innerHTML = '<p class="empty-upcoming">لا توجد أحداث قادمة. اضغط على أي يوم لإضافة حدث جديد.</p>';
        return;
    }

    // Group events by date for agenda-style
    const grouped = {};
    for (const ev of upcoming.slice(0, 15)) {
        const key = `${ev.date.getDate()}-${ev.date.getMonth()}-${ev.date.getFullYear()}`;
        if (!grouped[key]) {
            grouped[key] = { date: ev.date, events: [] };
        }
        grouped[key].events.push(ev);
    }

    let html = '';
    for (const [, group] of Object.entries(grouped)) {
        const isToday = group.date.getTime() === today.getTime();
        const dayName = dayNames[group.date.getDay()];
        const dateStr = `${dayName}، ${group.date.getDate()} ${monthNames[group.date.getMonth()]}`;

        html += `<div class="agenda-day-group">`;
        html += `<div class="agenda-day-header">${dateStr}${isToday ? ' — <strong style="color:var(--primary-green)">اليوم</strong>' : ''}</div>`;

        for (const ev of group.events) {
            html += `
                <div class="upcoming-event-item ${isToday ? 'today' : ''}">
                    <div class="upcoming-event-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="upcoming-event-info">
                        <h4>${ev.text}</h4>
                        <span>${dayName} — ${ev.date.getDate()} ${monthNames[ev.date.getMonth()]} ${ev.date.getFullYear()}</span>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
    }

    container.innerHTML = html;
}
