import { state } from './state.js';
import { sendNotification } from './notifications.js';

export function getTasks() {
    return JSON.parse(localStorage.getItem('scout_tasks') || '[]');
}

export function saveTasks(tasks) {
    localStorage.setItem('scout_tasks', JSON.stringify(tasks));
    renderSidebarTasks();
}

export function renderSidebarTasks() {
    const notesGrid = document.getElementById('sidebar-notes-grid');
    const tasksList = document.getElementById('sidebar-tasks-list');
    const container = document.querySelector('.sidebar-tasks-container');

    if (!container) return;

    // Inject containers if missing
    if (!notesGrid || !tasksList) {
        container.innerHTML = `
            <div class="sidebar-tasks-header">
                <div><i class="fas fa-tasks"></i> المهام والملاحظات</div>
                <button id="view-all-tasks" class="view-all-btn" onclick="window.navigateTo('tasks_board')">
                    عرض الكل <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
            <div id="sidebar-notes-grid" class="sidebar-notes-grid"></div>
            <div id="sidebar-tasks-list" class="sidebar-tasks-list"></div>
            <div class="task-input-group">
                <input type="text" id="sidebar-task-input" placeholder="أضف مهمة او ملاحظة...">
                <div id="sidebar-schedule-row" class="task-schedule-row hidden">
                    <div class="task-input-field">
                        <i class="fas fa-calendar-day"></i>
                        <input type="date" id="sidebar-task-date">
                    </div>
                    <div class="task-input-field">
                        <i class="fas fa-clock"></i>
                        <input type="time" id="sidebar-task-time">
                    </div>
                </div>
                <div class="btns">
                    <button id="add-sidebar-task" title="إضافة مهمة"><i class="fas fa-plus"></i> مهمة</button>
                    <button id="add-sidebar-note" title="إضافة ملاحظة"><i class="fas fa-sticky-note"></i> ملاحظة</button>
                    <button id="toggle-sidebar-schedule" class="btn-toggle-schedule" title="جدولة التذكير"><i class="fas fa-clock"></i></button>
                </div>
            </div>
        `;
    }

    const allItems = getTasks();
    const notes = allItems.filter(i => i.type === 'note');
    const tasks = allItems.filter(i => i.type === 'task');

    const ng = document.getElementById('sidebar-notes-grid');
    const tl = document.getElementById('sidebar-tasks-list');

    ng.innerHTML = notes.map(n => {
        const isLong = n.text.length > 45;
        const displayText = isLong ? n.text.substring(0, 45) + '...' : n.text;
        return `
        <div class="sidebar-note-item animate-in">
            <div class="sidebar-note-pin"><i class="fas fa-thumbtack"></i></div>
            <div class="sidebar-note-text">
                <div class="text-content">${displayText}</div>
                ${n.reminderTime ? `<div class="sidebar-note-scheduled"><i class="fas fa-clock"></i> ${new Date(n.reminderTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                ${isLong ? `<span class="read-more-note" onclick="window.viewNote(${n.id})">قراءة المزيد</span>` : ''}
            </div>
            <div class="sidebar-note-del" data-id="${n.id}"><i class="fas fa-trash-alt"></i></div>
        </div>
    `}).join('');

    tl.innerHTML = tasks.length > 0 ? tasks.map(t => `
        <div class="sidebar-item ${t.completed ? 'completed' : ''} animate-in">
            <div class="sidebar-check" data-id="${t.id}"><i class="fas fa-check"></i></div>
            <div class="sidebar-content">
                <div class="sidebar-text">${t.text}</div>
                ${t.reminderTime ? `<div class="sidebar-task-scheduled"><i class="fas fa-clock"></i> ${new Date(t.reminderTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
            </div>
            <div class="sidebar-del" data-id="${t.id}"><i class="fas fa-times"></i></div>
        </div>
    `).join('') : '<div class="sidebar-empty">لا توجد مهام حالياً</div>';
}

// Expose viewNote globally
window.viewNote = function (id) {
    const tasks = getTasks();
    const note = tasks.find(t => t.id === id);
    if (!note) return;

    // Create or reuse modal
    let modal = document.getElementById('note-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'note-modal';
        modal.className = 'custom-modal';
        modal.innerHTML = `
            <div class="modal-content animate-in" style="max-width: 400px">
                <div class="modal-header">
                    <h3><i class="fas fa-sticky-note" style="color:var(--brown)"></i> ملاحظة</h3>
                    <div class="close-modal">&times;</div>
                </div>
                <div class="modal-body">
                    <p id="note-modal-text" style="font-size:1.1rem;line-height:1.6;color:#333;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;max-height:60vh;overflow-y:auto;"></p>
                    <div class="modal-actions">
                        <button class="modal-btn save close-modal-btn">إغلاق</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Close logic
        const close = () => modal.classList.remove('active');
        modal.querySelector('.close-modal').onclick = close;
        modal.querySelector('.close-modal-btn').onclick = close;
        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    }

    modal.querySelector('#note-modal-text').textContent = note.text;
    modal.classList.add('active');
};

export async function addTask(text, type = 'task', reminderTime = null) {
    if (!text || !text.trim()) {
        alert('الرجاء كتابة نص المهمة أو الملاحظة');
        return;
    }
    const tasks = getTasks();
    tasks.push({
        id: Date.now(),
        text: text.trim(),
        completed: false,
        type,
        reminderTime,
        notified: false
    });
    saveTasks(tasks);

    // Refresh Tasks Board if active
    if (state.currentPage === 'tasks_board') {
        import('./navigation.js').then(m => m.renderTasksBoard());
    }

    // Success notification
    sendNotification(
        type === 'task' ? 'تمت إضافة المهمة' : 'تمت إضافة الملاحظة',
        text
    );
}

export function toggleTask(id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task && task.type === 'task') {
        task.completed = !task.completed;
        saveTasks(tasks);
    }
}

export function deleteTask(id) {
    saveTasks(getTasks().filter(t => t.id !== id));
}

// Global helpers for Tasks Board
window.toggleTaskItem = (id) => {
    toggleTask(id);
    if (state.currentPage === 'tasks_board') import('./navigation.js').then(m => m.renderTasksBoard());
};

window.deleteTaskItem = (id) => {
    if (confirm('هل أنت متأكد من الحذف؟')) {
        deleteTask(id);
        if (state.currentPage === 'tasks_board') import('./navigation.js').then(m => m.renderTasksBoard());
    }
};

window.navigateTo = (pageId) => {
    import('./navigation.js').then(m => m.navigateTo(pageId));
};
