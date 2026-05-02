import { state } from './state.js';
import { fetchTasksSupabase, saveTaskSupabase, deleteTaskSupabase } from './api.js?v=15.0';

export function getTasks() {
    return state.tasksCache || [];
}

export async function loadTasks() {
    state.tasksCache = await fetchTasksSupabase();
    renderDashboardTasks();
}

export async function saveTasks(tasks) {
    state.tasksCache = tasks;
    renderDashboardTasks();
}

export function renderDashboardTasks() {
    const container = document.getElementById('tasks-container-dashboard');
    if (!container) return;

    const allItems = getTasks();
    const notes = allItems.filter(i => i.type === 'note');
    const tasks = allItems.filter(i => i.type === 'task');

    if (allItems.length === 0) {
        container.innerHTML = `
            <div class="empty-dashboard-state animate-fade">
                <i class="fas fa-clipboard-check"></i>
                <p>ليس هناك مهام أو ملاحظات مجدولة حالياً</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="dashboard-tasks-grid">
            <div id="dashboard-notes-grid" class="dashboard-notes-grid">
                ${notes.map(n => `
                    <div class="dashboard-note-item animate-in">
                        <div class="note-header">
                            <i class="fas fa-thumbtack note-pin-icon"></i>
                            <div class="note-del" data-id="${n.id}"><i class="fas fa-trash-alt"></i></div>
                        </div>
                        <div class="note-body" onclick="window.viewNote('${n.id}')">
                            <div class="text-content">${n.text.length > 80 ? n.text.substring(0, 80) + '...' : n.text}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div id="dashboard-tasks-list" class="dashboard-tasks-list">
                ${tasks.map(t => `
                    <div class="dashboard-task-item ${t.completed ? 'completed' : ''} animate-in">
                        <div class="task-check" data-id="${t.id}">
                            <i class="fas ${t.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                        </div>
                        <div class="task-text">${t.text}</div>
                        <div class="task-del" data-id="${t.id}"><i class="fas fa-times"></i></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Delegate click events for toggle/delete
    container.onclick = (e) => {
        const checkBtn = e.target.closest('.task-check');
        const delBtn = e.target.closest('.task-del, .note-del');
        
        if (checkBtn) {
            const id = checkBtn.dataset.id;
            toggleTask(id);
        } else if (delBtn) {
            const id = delBtn.dataset.id;
            deleteTask(id);
        }
    };
}

// Expose viewNote globally
window.viewNote = function (id) {
    const tasks = getTasks();
    const note = tasks.find(t => t.id == id);
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
        showToast('الرجاء كتابة نص المهمة أو الملاحظة', 'warning');
        return;
    }
    const newTask = {
        text: text.trim(),
        completed: false,
        type,
        reminder_time: reminderTime || null,
        reminder_sent: false
    };
    
    await saveTaskSupabase(newTask);
    await loadTasks(); // Re-fetch to get IDs and sync

    // Refresh Tasks Board if active
    if (state.currentPage === 'tasks_board') {
        import('./navigation.js').then(m => m.renderTasksBoard());
    }
}

// Background Reminder Checker
function initReminderSystem() {
    if (window._reminderInterval) return;
    
    window._reminderInterval = setInterval(() => {
        const tasks = getTasks();
        const now = new Date();
        
        tasks.forEach(async t => {
            if (t.reminder_time && !t.reminder_sent) {
                const rDate = new Date(t.reminder_time);
                if (now >= rDate) {
                    // Trigger Reminder
                    showToast(`تذكير: ${t.text}`, 'info', 10000);
                    
                    // Browser Notification if possible
                    if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
                        new Notification("تذكير من واجهة القاسم", { body: t.text });
                    }
                    
                    // Mark as sent
                    t.reminder_sent = true;
                    await saveTaskSupabase(t);
                }
            }
        });
    }, 30000); // Check every 30 seconds

    // Request Permission
    if (typeof Notification !== 'undefined' && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

initReminderSystem();

export async function toggleTask(id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id == id);
    if (task && task.type === 'task') {
        task.completed = !task.completed;
        await saveTaskSupabase(task);
        renderDashboardTasks();
    }
}

export async function deleteTask(id) {
    await deleteTaskSupabase(id);
    await loadTasks();
}

window.renderDashboardTasks = renderDashboardTasks;
window.toggleTaskItem = (id) => {
    toggleTask(id);
    if (state.currentPage === 'tasks_board') import('./navigation.js').then(m => m.renderTasksBoard());
};

window.deleteTaskItem = (id) => {
    deleteTask(id);
    if (state.currentPage === 'tasks_board') import('./navigation.js').then(m => m.renderTasksBoard());
};

window.navigateTo = (pageId) => {
    import('./navigation.js?v=15.0').then(m => m.navigateTo(pageId));
};
