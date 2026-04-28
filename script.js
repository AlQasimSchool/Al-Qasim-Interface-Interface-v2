/* ====================================================
   Scout PC Interface — script.js
   ==================================================== */

// ─── Google Drive API ───────────────────────────────
let driveFilesCache = null;
let youtubeVideosCache = null;
let docsViewMode = localStorage.getItem('scout_docs_view') || 'grid';
let customLinks = JSON.parse(localStorage.getItem('scout_custom_links') || '[]');

// ─── Configuration ──────────────────────────────────
const CONFIG = {
    // Google Drive
    DRIVE_API_KEY: 'AIzaSyCneVvRpv1aXlEBhrkxG6rokMo3SwEjCz0',
    DRIVE_FOLDER_IDS: [
        '1hMDo9jb_fxq7lTj1xfMJ_B93TDe-3CGA',
        '1HhB8nitX0djtUQzXLe08rjHaEVOzVJht',
        '1VjlKNELHLAmNMnA8zoDErsFQkjORvK0o'
    ],

    // YouTube
    YOUTUBE_API_KEY: 'AIzaSyDkHepsjqqTQ1LdZDHHj-nAOtsONNdYTTY',
    YOUTUBE_PLAYLIST_ID: 'PLDbetXSiS1VW5eKPsKsazC1hkJRVapB-o',
};

// ─── Tracking System ────────────────────────────────
let mostOpenedCache = null;

// ─── Tasks & Notes System ───────────────────────────
function getTasks() {
    return JSON.parse(localStorage.getItem('scout_tasks') || '[]');
}

function saveTasks(tasks) {
    localStorage.setItem('scout_tasks', JSON.stringify(tasks));
    renderSidebarTasks();
}

function addTask(type = 'task') {
    const input = document.getElementById('sidebar-task-input');
    const text = input.value.trim();
    if (!text) return;

    const tasks = getTasks();
    tasks.push({
        id: Date.now(),
        text,
        completed: false,
        type: type // 'task' or 'note'
    });
    saveTasks(tasks);
    input.value = '';
}

function toggleTask(id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task && task.type === 'task') {
        task.completed = !task.completed;
        saveTasks(tasks);
    }
}

function deleteTask(id) {
    let tasks = getTasks();
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(tasks);
}

function renderSidebarTasks() {
    const notesGrid = document.getElementById('sidebar-notes-grid');
    const tasksList = document.getElementById('sidebar-tasks-list');
    
    if (!notesGrid || !tasksList) return;

    const allItems = getTasks();

    // 1. Render Notes Grid (Square Cards) - Limit to 3 for sidebar
    const notes = allItems.filter(i => i.type === 'note');
    const displayNotes = notes.slice(0, 3);

    if (notes.length === 0) {
        notesGrid.innerHTML = '';
    } else {
        notesGrid.innerHTML = displayNotes.map(n => {
            const isLong = n.text.length > 40;
            return `
                <div class="sidebar-note-item ${isLong ? 'full-row' : ''} animate-in">
                    <div class="sidebar-note-pin"><i class="fas fa-thumbtack"></i></div>
                    <div class="sidebar-note-text">${n.text}</div>
                    <div class="sidebar-note-del" onclick="deleteTask(${n.id})">
                        <i class="fas fa-trash-alt"></i> حذف
                    </div>
                </div>
            `;
        }).join('');
    }

    // 2. Render Tasks List (Compact) - Limit to 1 pending task for sidebar
    const tasks = allItems.filter(i => i.type === 'task');
    const pendingTasks = tasks.filter(t => !t.completed).slice(0, 1);

    if (tasks.length === 0 && notes.length === 0) {
        tasksList.innerHTML = '<div class="sidebar-empty">لا توجد مهام أو ملاحظات حالياً.</div>';
    } else if (pendingTasks.length === 0) {
        tasksList.innerHTML = '';
    } else {
        tasksList.innerHTML = pendingTasks.map(t => `
            <div class="sidebar-item ${t.completed ? 'completed' : ''} animate-in">
                <div class="sidebar-check" onclick="toggleTask(${t.id})">
                    <i class="fas fa-check"></i>
                </div>
                <div class="sidebar-text" title="${t.text}">${t.text}</div>
                <div class="sidebar-del" onclick="deleteTask(${t.id})">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        `).join('');
    }
}

function trackClick(item) {
    let history = JSON.parse(localStorage.getItem('scout_history') || '{}');
    if (!history[item.id]) {
        history[item.id] = { ...item, count: 0 };
    }
    history[item.id].count += 1;
    history[item.id].lastOpened = Date.now();
    localStorage.setItem('scout_history', JSON.stringify(history));
}

function getMostOpened() {
    let history = JSON.parse(localStorage.getItem('scout_history') || '{}');
    const now = Date.now();

    return Object.values(history)
        .map(item => {
            // Smart Scoring: Frecency (Frequency + Recency)
            // Weight = count * (1 / (1 + days_since_last_opened))
            const hoursSince = (now - item.lastOpened) / (1000 * 60 * 60);
            const daysSince = hoursSince / 24;
            const score = item.count * (1 / (1 + daysSince));
            return { ...item, smartScore: score };
        })
        // Only show items opened more than once (to be "smart" and not just show everything)
        // AND sort by smartScore
        .filter(item => item.count >= 2)
        .sort((a, b) => b.smartScore - a.smartScore)
        .slice(0, 4);
}

// ─── YouTube API ────────────────────────────────────
// youtubeVideosCache is declared at the top of the file

async function fetchYouTubeVideos() {
    if (youtubeVideosCache) return youtubeVideosCache;

    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=25&playlistId=${CONFIG.YOUTUBE_PLAYLIST_ID}&key=${CONFIG.YOUTUBE_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errData = await response.json();
            console.error('YouTube API Error:', errData);
            throw new Error(errData.error?.message || 'فشل في الاتصال بـ YouTube');
        }
        const data = await response.json();
        youtubeVideosCache = (data.items || []).map(item => ({
            id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
            title: item.snippet?.title || 'بدون عنوان',
            description: item.snippet?.description || '',
            thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
            publishedAt: item.snippet?.publishedAt || '',
            channelTitle: item.snippet?.channelTitle || '',
        }));
        return youtubeVideosCache;
    } catch (err) {
        console.error('YouTube fetch error:', err);
        throw err;
    }
}

function formatYouTubeDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildYouTubeVideoCard(video) {
    const trackingItem = {
        id: video.id,
        name: video.title,
        type: 'video',
        icon: 'fab fa-youtube',
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    return `
        <div class="video-card animate-in" onclick="trackClick(${JSON.stringify(trackingItem).replace(/"/g, '&quot;')}); openVideo('${video.id}')">
            <div class="thumb-container">
                <img class="thumb" src="${video.thumbnail}" alt="${video.title}" loading="lazy" onerror="this.outerHTML='<div class=thumb-placeholder><i class=fas fa-play-circle></i></div>'">
                <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" class="yt-open-btn" onclick="event.stopPropagation()" title="فتح في يوتيوب">
                    <i class="fab fa-youtube"></i> فتح في يوتيوب
                </a>
            </div>
            <div class="video-info">
                <h4>${video.title}</h4>
                <div class="video-card-actions">
                    <span>${formatYouTubeDate(video.publishedAt)}</span>
                </div>
            </div>
        </div>
    `;
}

function openVideo(videoId) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.innerHTML = `
        <div class="video-modal-backdrop" onclick="closeVideoModal()"></div>
        <div class="video-modal-content animate-in">
            <button class="video-modal-close" onclick="closeVideoModal()"><i class="fas fa-times"></i></button>
            <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                    frameborder="0" 
                    allow="autoplay; encrypted-media; picture-in-picture" 
                    allowfullscreen></iframe>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeVideoModal() {
    const modal = document.querySelector('.video-modal');
    if (modal) modal.remove();
}

async function loadYouTubeVideos() {
    const container = document.getElementById('youtube-videos-container');
    if (!container) return;

    try {
        const videos = await fetchYouTubeVideos();

        if (videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fab fa-youtube"></i>
                    <h3>لا توجد مقاطع</h3>
                    <p>لم يتم العثور على مقاطع في قائمة التشغيل. تأكد من إضافة فيديوهات للقائمة.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '<div class="video-grid">' + videos.map(v => buildYouTubeVideoCard(v)).join('') + '</div>';

        // Animate
        const items = container.querySelectorAll('.animate-in');
        items.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.animationDelay = `${0.04 * i}s`;
            requestAnimationFrame(() => { el.style.opacity = ''; });
        });

        // Update stat
        updateVideoStat(videos.length);

    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color:#e74c3c"></i>
                <h3>خطأ في تحميل المقاطع</h3>
                <p>${err.message}</p>
                <button class="toolbar-btn" style="margin-top:16px" onclick="refreshYouTubeVideos()">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }
}

async function refreshYouTubeVideos() {
    youtubeVideosCache = null;
    const container = document.getElementById('youtube-videos-container');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>جاري تحميل المقاطع من YouTube...</p>
            </div>
        `;
    }
    await loadYouTubeVideos();
}

function updateVideoStat(count) {
    const el = document.getElementById('stat-videos');
    if (el) el.textContent = count;
}

async function fetchDriveFiles() {
    if (driveFilesCache) return driveFilesCache;

    const allFiles = [];

    for (const folderId of CONFIG.DRIVE_FOLDER_IDS) {
        const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${CONFIG.DRIVE_API_KEY}&fields=files(id,name,mimeType,modifiedTime,size,iconLink,webViewLink,thumbnailLink,webContentLink)&orderBy=modifiedTime+desc&pageSize=50`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errData = await response.json();
                console.error(`Drive API Error (Folder ${folderId}):`, errData);
                continue; // Skip failed folder
            }
            const data = await response.json();
            if (data.files) {
                allFiles.push(...data.files);
            }
        } catch (err) {
            console.error(`Drive fetch error (Folder ${folderId}):`, err);
        }
    }

    // Sort combined results by modifiedTime desc
    allFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

    driveFilesCache = allFiles;
    return driveFilesCache;
}

// Map Google MIME types to our icon system
function getFileType(mimeType) {
    const map = {
        'application/pdf': 'pdf',
        'application/vnd.google-apps.document': 'doc',
        'application/vnd.google-apps.spreadsheet': 'sheet',
        'application/vnd.google-apps.presentation': 'slide',
        'application/vnd.google-apps.folder': 'folder',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slide',
        'application/msword': 'doc',
        'application/vnd.ms-excel': 'sheet',
        'application/vnd.ms-powerpoint': 'slide',
        'image/jpeg': 'image',
        'image/png': 'image',
        'image/gif': 'image',
        'video/mp4': 'video',
        'audio/mpeg': 'audio',
    };
    return map[mimeType] || 'file';
}

function getFileTypeName(mimeType) {
    const map = {
        'application/pdf': 'PDF',
        'application/vnd.google-apps.document': 'مستند Google',
        'application/vnd.google-apps.spreadsheet': 'جدول بيانات Google',
        'application/vnd.google-apps.presentation': 'عرض تقديمي Google',
        'application/vnd.google-apps.folder': 'مجلد',
        'application/vnd.google-apps.form': 'نموذج Google',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'مستند Word',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'جدول Excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'عرض PowerPoint',
        'image/jpeg': 'صورة JPEG',
        'image/png': 'صورة PNG',
        'video/mp4': 'فيديو MP4',
    };
    return map[mimeType] || 'ملف';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('ar-EG', options);
}

function getFileOpenUrl(file) {
    // For Google Workspace files, webViewLink opens editor directly
    if (file.webViewLink) return file.webViewLink;
    // For other files, use Drive preview
    return `https://drive.google.com/file/d/${file.id}/view`;
}

// ─── Page Templates ─────────────────────────────────
const pages = {

    /* ===================== الرئيسية ===================== */
    /* ===================== الرئيسية ===================== */
    dashboard: () => {
        const opened = getMostOpened();
        let mostOpenedHtml = '';

        if (opened.length > 0) {
            mostOpenedHtml = `
                <div class="most-opened-section animate-in" style="margin-top: 32px; margin-bottom: 32px">
                    <h3 class="section-title">الوصول الذكي (الأكثر استخداماً)</h3>
                    <div class="most-opened-grid">
                        ${opened.map(item => `
                            <a href="${item.url}" target="_blank" class="mini-card" onclick="trackClick(${JSON.stringify(item).replace(/"/g, '&quot;')}); if('${item.type}'==='video') { event.preventDefault(); openVideo('${item.id}'); }">
                                <div class="mini-icon card-icon ${item.type === 'video' ? 'red' : item.type === 'link' ? 'blue' : 'brown'}">
                                    <i class="${item.icon}"></i>
                                </div>
                                <div class="mini-info">
                                    <h5>${item.name}</h5>
                                    <span>${item.type === 'video' ? 'فيديو' : item.type === 'link' ? 'رابط' : 'مستند'}</span>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            // Placeholder when empty or not enough data
            mostOpenedHtml = `
                <div class="most-opened-section animate-in" style="margin-top: 32px; margin-bottom: 32px; opacity: 0.7">
                    <h3 class="section-title">الوصول الذكي</h3>
                    <div style="background: var(--glass-bg); padding: 20px; border-radius: var(--radius-md); text-align: center; border: 1px dashed var(--brown-light)">
                        <p style="font-size: 0.85rem; color: var(--text-secondary)">بمجرد تكرار فتحك للملفات والروابط، ستظهر هنا تلقائياً لسهولة الوصول إليها.</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="page-section animate-fade">
                <div class="dashboard-header-flex">
                    <div class="page-header">
                        <h1><i class="fas fa-campground" style="margin-left:10px;color:var(--primary-green)"></i>كشافة عبدالرحمن بن القاسم</h1>
                        <p>إدارة المهام، المستندات، والأنشطة الكشفية في مكان واحد.</p>
                    </div>
                    <div class="clock-widget animate-in" id="live-clock">
                        <div class="time">--:--:--</div>
                        <div class="date">جاري التحميل...</div>
                    </div>
                </div>

                <!-- Stats -->
                <div class="stats-row">
                    <div class="stat-widget animate-in stagger-1">
                        <div class="stat-icon card-icon green"><i class="fas fa-file-alt"></i></div>
                        <div class="stat-info">
                            <h4 id="stat-docs">—</h4>
                            <span>مستند متاح</span>
                        </div>
                    </div>
                    <div class="stat-widget animate-in stagger-2">
                        <div class="stat-icon card-icon brown"><i class="fas fa-video"></i></div>
                        <div class="stat-info">
                            <h4 id="stat-videos">—</h4>
                            <span>مقطع فيديو</span>
                        </div>
                    </div>
                    <div class="stat-widget animate-in stagger-3">
                        <div class="stat-icon card-icon blue"><i class="fas fa-link"></i></div>
                        <div class="stat-info">
                            <h4>5</h4>
                            <span>رابط مفيد</span>
                        </div>
                    </div>
                </div>

                <!-- Most Opened -->
                ${mostOpenedHtml}

                <!-- Quick Access Cards -->
                <h3 class="section-title" style="margin-top: 40px">الوصول السريع</h3>
                <div class="card-grid">
                    <div class="card animate-in stagger-2" onclick="navigateTo('documents')">
                        <div class="card-icon brown"><i class="fas fa-folder-open"></i></div>
                        <h3>المستندات</h3>
                        <p class="card-desc">ملفات التدريب والسجلات والمخططات الكشفية. يمكنك فتحها وتعديلها مباشرة من Google Drive.</p>
                        <span class="badge badge-green"><i class="fab fa-google-drive" style="margin-left:4px"></i>متصل مباشرة</span>
                    </div>
                    <div class="card animate-in stagger-3" onclick="navigateTo('media')">
                        <div class="card-icon green"><i class="fas fa-play-circle"></i></div>
                        <h3>المقاطع والمرئيات</h3>
                        <p class="card-desc">شاهد آخر فيديوهات فعالياتنا ودروسنا التعليمية على قناة اليوتيوب.</p>
                        <span class="badge badge-green"><i class="fab fa-youtube" style="margin-left:4px"></i>متصل مباشرة</span>
                    </div>
                    <div class="card animate-in stagger-4" onclick="navigateTo('links')">
                        <div class="card-icon blue"><i class="fas fa-compass"></i></div>
                        <h3>روابط تهمنا</h3>
                        <p class="card-desc">مواقع التطوع، الاتحاد الكشفي، وروابط خارجية مهمة للمجموعة.</p>
                        <span class="badge badge-brown">5 روابط</span>
                    </div>
                </div>

                <!-- QR Codes for Mobile Access -->
                <div class="qr-codes-section animate-in" style="margin-top: 50px">
                    <h3 class="section-title">التصفح عبر الجوال (QR Code)</h3>
                    <div class="qr-grid">
                        <div class="qr-card website animate-in stagger-1">
                            <i class="fas fa-globe"></i>
                            <h4>موقع المجموعة</h4>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://scout-abdulrahman-bin-al-qasim.lovable.app/" alt="QR Website">
                            <span>امسح الكود لفتح الموقع على جوالك</span>
                        </div>
                        <div class="qr-card youtube animate-in stagger-2">
                            <i class="fab fa-youtube"></i>
                            <h4>قناة اليوتيوب</h4>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.youtube.com/@Al-QasimSchool-Scouts" alt="QR YouTube">
                            <span>امسح الكود لمشاهدة الفعاليات على جوالك</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /* ===================== المستندات ===================== */
    documents: () => `
        <div class="page-section animate-fade">
            <div class="page-header">
                <h1><i class="fas fa-folder-open" style="margin-left:10px;color:var(--brown)"></i>المستندات والملفات</h1>
                <p>جميع ملفات الكشافة من Google Drive. اضغط "فتح" للاطلاع على الملف أو التعديل عليه مباشرة.</p>
            </div>

            <div class="drive-toolbar">
                <div class="toolbar-left">
                    <button class="toolbar-btn ${docsViewMode === 'list' ? 'active' : ''}" onclick="setDocsView('list')" title="عرض قائمة">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="toolbar-btn ${docsViewMode === 'grid' ? 'active' : ''}" onclick="setDocsView('grid')" title="عرض شبكة">
                        <i class="fas fa-th-large"></i>
                    </button>
                </div>
                <div class="toolbar-right">
                    <button class="toolbar-btn" onclick="refreshDriveFiles()">
                        <i class="fas fa-sync-alt"></i> تحديث
                    </button>
                    <a href="https://drive.google.com/drive/folders/${CONFIG.DRIVE_FOLDER_ID}" target="_blank" class="toolbar-btn">
                        <i class="fab fa-google-drive"></i> فتح في Drive
                    </a>
                </div>
            </div>

            <div id="drive-files-container">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>جاري تحميل الملفات من Google Drive...</p>
                </div>
            </div>
        </div>
    `,

    /* ===================== المقاطع ===================== */
    media: () => `
        <div class="page-section animate-fade">
            <div class="page-header">
                <h1><i class="fas fa-play-circle" style="margin-left:10px;color:var(--primary-green)"></i>المقاطع والمرئيات</h1>
                <p>آخر المقاطع المنشورة على قائمة تشغيل الكشافة في يوتيوب. اضغط على أي مقطع لمشاهدته.</p>
            </div>

            <div class="drive-toolbar">
                <div class="toolbar-right">
                    <a href="https://www.youtube.com/playlist?list=${CONFIG.YOUTUBE_PLAYLIST_ID}" target="_blank" class="toolbar-btn">
                        <i class="fab fa-youtube"></i> فتح في YouTube
                    </a>
                    <button class="toolbar-btn" onclick="refreshYouTubeVideos()">
                        <i class="fas fa-sync-alt"></i> تحديث
                    </button>
                </div>
            </div>

            <div id="youtube-videos-container">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>جاري تحميل المقاطع من YouTube...</p>
                </div>
            </div>
        </div>
    `,

    /* ===================== روابط ===================== */
    /* ===================== روابط ===================== */
    links: () => {
        const categories = {
            'sites': 'مواقعنا',
            'edu': 'خدمات تعليمية',
            'vol': 'تطوع ومنظمات',
            'user': 'روابطي المضافة'
        };

        const defaultLinks = [
            { name: 'موقع كشافة عبدالرحمن بن القاسم', desc: 'الموقع الرسمي للمجموعة — أخبار وفعاليات وتسجيل', icon: 'fas fa-globe', color: 'green', url: 'https://scout-abdulrahman-bin-al-qasim.lovable.app/', cat: 'sites' },
            { name: 'قناة اليوتيوب', desc: 'تابع آخر مقاطع الفيديو والفعاليات الكشفية', icon: 'fab fa-youtube', color: 'red', url: 'https://www.youtube.com/@Al-QasimSchool-Scouts', cat: 'sites' },
            { name: 'نظام نور', desc: 'نظام نور للإدارة التعليمية — وزارة التعليم', icon: 'fas fa-graduation-cap', color: 'green', url: 'https://noor.moe.gov.sa/', cat: 'edu' },
            { name: 'منصة مدرستي', desc: 'نظام التعلم عن بعد الرسمي للمدارس — وزارة التعليم', icon: 'fas fa-laptop-code', color: 'blue', url: 'https://schools.madrasati.sa/', cat: 'edu' },
            { name: 'المنصة الوطنية للعمل التطوعي', desc: 'المنصة الرسمية للتطوع في المملكة العربية السعودية — NVG', icon: 'fas fa-hand-holding-heart', color: 'green', url: 'https://nvg.gov.sa/', cat: 'vol' },
            { name: 'منصة التطوع — الهلال الأحمر', desc: 'سجّل ساعاتك التطوعية عبر منصة الهلال الأحمر السعودي', icon: 'fas fa-hands-helping', color: 'red', url: 'https://volunteer.srca.org.sa/#!/ar/home', cat: 'vol' },
            { name: 'المنظمة العالمية للحركة الكشفية', desc: 'WOSM — الموقع الرسمي للمنظمة العالمية', icon: 'fas fa-earth-americas', color: 'purple', url: 'https://www.scout.org', cat: 'vol' }
        ];

        const all = [...defaultLinks, ...customLinks.map(l => ({ ...l, cat: 'user' }))];

        return `
            <div class="page-section animate-fade">
                <div class="page-header-flex">
                    <div class="page-header">
                        <h1><i class="fas fa-compass" style="margin-left:10px;color:var(--primary-green)"></i>روابط تهمنا</h1>
                        <p>مجموعة من المواقع والمنصات المفيدة لأعضاء الكشافة.</p>
                    </div>
                    <button class="toolbar-btn add-link-btn" onclick="showAddLinkModal()">
                        <i class="fas fa-plus-circle"></i> إضافة رابط جديد
                    </button>
                </div>

                ${Object.entries(categories).map(([key, label]) => {
            const catItems = all.filter(l => l.cat === key);
            if (catItems.length === 0) return '';
            return `
                        <h3 class="section-title" style="margin-top:${key === 'sites' ? '0' : '30px'}">${label}</h3>
                        <div class="card-grid">
                            ${catItems.map(l => `
                                <div class="card-wrapper">
                                    ${linkCard(l.name, l.desc, l.icon, l.color, l.url)}
                                    ${key === 'user' ? `<button class="del-link" onclick="deleteCustomLink('${l.url}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
        }).join('')}
            </div>
            
            <!-- Modal -->
            <div id="add-link-modal" class="custom-modal">
                <div class="modal-content animate-in">
                    <h3>إضافة رابط جديد</h3>
                    <div class="form-group">
                        <label>عنوان الموقع</label>
                        <input type="text" id="link-name" placeholder="مثال: محرك بحث جوجل">
                    </div>
                    <div class="form-group">
                        <label>رابط الموقع (URL)</label>
                        <input type="url" id="link-url" placeholder="https://example.com">
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" onclick="closeAddLinkModal()">إلغاء</button>
                        <button class="modal-btn save" onclick="saveCustomLink()">حفظ الرابط</button>
                    </div>
                </div>
            </div>
        `;
    }
};

function showAddLinkModal() {
    document.getElementById('add-link-modal').style.display = 'flex';
}

function closeAddLinkModal() {
    document.getElementById('add-link-modal').style.display = 'none';
}

function saveCustomLink() {
    const name = document.getElementById('link-name').value;
    const url = document.getElementById('link-url').value;

    if (!name || !url) {
        if (window.showAlert) window.showAlert('تنبيه', 'يرجى ملء جميع الحقول', 'fa-exclamation-circle');
        else alert('يرجى ملء جميع الحقول');
        return;
    }

    customLinks.push({
        name,
        url,
        desc: 'رابط مضاف من قبلك',
        icon: 'fas fa-link',
        color: 'blue'
    });

    localStorage.setItem('scout_custom_links', JSON.stringify(customLinks));
    closeAddLinkModal();
    navigateTo('links');
}

function deleteCustomLink(url) {
    customLinks = customLinks.filter(l => l.url !== url);
    localStorage.setItem('scout_custom_links', JSON.stringify(customLinks));
    navigateTo('links');
}

// ─── Helper: Build doc item from Drive file ─────────
function buildDriveFileItem(file) {
    const type = getFileType(file.mimeType);
    const typeName = getFileTypeName(file.mimeType);
    const modified = file.modifiedTime ? formatDate(file.modifiedTime) : '';
    const openUrl = getFileOpenUrl(file);
    const thumbnail = file.thumbnailLink ? file.thumbnailLink.replace('=s220', '=s400') : null;

    const icons = {
        pdf: 'fas fa-file-pdf',
        doc: 'fas fa-file-word',
        sheet: 'fas fa-file-excel',
        slide: 'fas fa-file-powerpoint',
        folder: 'fas fa-folder',
        image: 'fas fa-file-image',
        video: 'fas fa-file-video',
        audio: 'fas fa-file-audio',
        file: 'fas fa-file',
    };

    const trackingItem = {
        id: file.id,
        name: file.name,
        type: 'doc',
        icon: icons[type] || icons.file,
        url: openUrl
    };

    if (docsViewMode === 'grid') {
        return `
            <div class="doc-card animate-in" onclick="trackClick(${JSON.stringify(trackingItem).replace(/"/g, '&quot;')}); window.open('${openUrl}','_blank')">
                <div class="doc-card-thumb ${type}">
                    ${thumbnail ? `<img src="${thumbnail}" alt="${file.name}" loading="lazy">` : `<i class="${icons[type] || icons.file}"></i>`}
                    <div class="doc-card-type-icon"><i class="${icons[type] || icons.file}"></i></div>
                </div>
                <div class="doc-card-info">
                    <h4 title="${file.name}">${file.name}</h4>
                    <div class="doc-card-bottom">
                        <span>${typeName}</span>
                        ${file.webContentLink ? `
                            <a href="${file.webContentLink}" class="card-dl-btn" onclick="event.stopPropagation()" title="تحميل">
                                <i class="fas fa-download"></i>
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="doc-item animate-in" onclick="trackClick(${JSON.stringify(trackingItem).replace(/"/g, '&quot;')}); window.open('${openUrl}','_blank')">
            <div class="doc-icon ${type}"><i class="${icons[type] || icons.file}"></i></div>
            <div class="doc-info">
                <h4>${file.name}</h4>
                <span>${typeName}${modified ? ' • تعديل: ' + modified : ''}</span>
            </div>
            <div class="doc-actions-group">
                ${file.webContentLink ? `<a href="${file.webContentLink}" class="doc-dl-btn" onclick="event.stopPropagation()" title="تحميل"><i class="fas fa-download"></i></a>` : ''}
                <button class="doc-action" onclick="event.stopPropagation(); trackClick(${JSON.stringify(trackingItem).replace(/"/g, '&quot;')}); window.open('${openUrl}','_blank')">فتح</button>
            </div>
        </div>
    `;
}

function setDocsView(mode) {
    docsViewMode = mode;
    localStorage.setItem('scout_docs_view', mode);
    renderDriveFiles(); // Re-render if container exists
}

function renderDriveFiles() {
    const container = document.getElementById('drive-files-container');
    if (!container || !driveFilesCache) return;

    if (driveFilesCache.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fab fa-google-drive"></i>
                <h3>لا توجد ملفات</h3>
                <p>لم يتم العثور على ملفات في المجلد المحدد.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `<div class="docs-${docsViewMode}">` +
        driveFilesCache.map(f => buildDriveFileItem(f)).join('') +
        '</div>';

    // Highlight active button in toolbar
    document.querySelectorAll('.drive-toolbar .toolbar-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(`'${docsViewMode}'`)) {
            btn.classList.add('active');
        }
    });

    // Staggered animation
    const items = container.querySelectorAll('.animate-in');
    items.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.animationDelay = `${0.03 * i}s`;
        requestAnimationFrame(() => { el.style.opacity = ''; });
    });
}

// ─── Load Drive files into the documents page ───────
async function loadDriveFiles() {
    const container = document.getElementById('drive-files-container');
    if (!container) return;

    try {
        const files = await fetchDriveFiles();

        if (files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>لا توجد ملفات</h3>
                    <p>لم يتم العثور على ملفات في هذا المجلد. تأكد من إضافة ملفات إلى المجلد المشترك على Google Drive.</p>
                </div>
            `;
            return;
        }

        renderDriveFiles();

        // Update dashboard stat
        updateDocStat(files.length);

    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color:#e74c3c"></i>
                <h3>خطأ في تحميل الملفات</h3>
                <p>${err.message}</p>
                <button class="toolbar-btn" style="margin-top:16px" onclick="refreshDriveFiles()">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }
}

async function refreshDriveFiles() {
    driveFilesCache = null;
    const container = document.getElementById('drive-files-container');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>جاري تحديث الملفات...</p>
            </div>
        `;
    }
    await loadDriveFiles();
}

function updateDocStat(count) {
    const el = document.getElementById('stat-docs');
    if (el) el.textContent = count;
}


// ─── Helper: Link Card ──────────────────────────────
function linkCard(title, desc, icon, color, url) {
    const trackingItem = {
        id: url,
        name: title,
        type: 'link',
        icon: icon,
        url: url
    };
    return `
        <a href="${url}" target="_blank" class="link-card animate-in" onclick="trackClick(${JSON.stringify(trackingItem).replace(/"/g, '&quot;')})">
            <div class="link-icon card-icon ${color}"><i class="${icon}"></i></div>
            <div class="link-info">
                <h4>${title}</h4>
                <p>${desc}</p>
            </div>
        </a>
    `;
}

// ─── Search & Weather Helpers ───────────────────────
function handleGlobalSearch() {
    const query = document.getElementById('global-search').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');

    if (!query) {
        resultsContainer.classList.remove('active');
        return;
    }

    const results = [];

    // Search Drive Files
    if (driveFilesCache) {
        driveFilesCache.filter(f => f.name.toLowerCase().includes(query)).forEach(f => {
            results.push({ name: f.name, type: 'مستند', icon: 'fas fa-file-alt', url: getFileOpenUrl(f) });
        });
    }

    // Search YouTube
    if (youtubeVideosCache) {
        youtubeVideosCache.filter(v => v.title.toLowerCase().includes(query)).forEach(v => {
            results.push({ name: v.title, type: 'فيديو', icon: 'fab fa-youtube', url: `https://youtube.com/watch?v=${v.id}` });
        });
    }

    // Search Links
    const allLinks = [...JSON.parse(localStorage.getItem('scout_custom_links') || '[]')];
    // Add default links too if needed, but for now focusing on dynamic data

    resultsContainer.innerHTML = results.length > 0
        ? results.slice(0, 8).map(r => `
            <div class="search-result-item" onclick="window.open('${r.url}', '_blank')">
                <i class="${r.icon}"></i>
                <div class="info">
                    <h6>${r.name}</h6>
                    <span>${r.type}</span>
                </div>
            </div>
        `).join('')
        : '<div class="empty-results" style="padding:15px;text-align:center;font-size:0.8rem;color:var(--text-muted)">لا توجد نتائج</div>';

    resultsContainer.classList.add('active');
}

async function initWeather() {
    const weatherContainer = document.getElementById('weather-widget');
    if (!weatherContainer) return;

    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=26.42&longitude=50.10&current_weather=true');
        const data = await res.json();
        const w = data.current_weather;

        weatherContainer.innerHTML = `
            <div class="weather-content animate-fade">
                <i class="fas ${getWeatherIcon(w.weathercode)}"></i>
                <span class="temp">${Math.round(w.temperature)}°C</span>
                <span class="city">الدمام</span>
            </div>
        `;
    } catch (e) {
        weatherContainer.innerHTML = '';
    }
}

function getWeatherIcon(code) {
    if (code === 0) return 'fa-sun';
    if (code <= 3) return 'fa-cloud-sun';
    if (code <= 48) return 'fa-cloud';
    return 'fa-cloud-showers-heavy';
}

// ─── Navigation Logic ───────────────────────────────
let currentPage = 'dashboard';

function navigateTo(pageId) {
    if (!pages[pageId]) return;
    currentPage = pageId;

    // Update active sidebar item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });

    // Render with transition
    const container = document.getElementById('page-content');
    if (!container) return;

    container.style.opacity = '0';

    setTimeout(() => {
        container.innerHTML = pages[pageId]();
        container.style.opacity = '1';

        // Stagger animate-in items
        const items = container.querySelectorAll('.animate-in');
        items.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.animationDelay = `${0.04 * i}s`;
            requestAnimationFrame(() => { el.style.opacity = ''; });
        });

        // Initialize features based on page
        if (pageId === 'dashboard') {
            loadDashboardStats();
            initWeather();
        } else if (pageId === 'documents') {
            loadDriveFiles();
        } else if (pageId === 'media') {
            loadYouTubeVideos();
        } else if (pageId === 'links') {
            renderLinks();
        } else if (pageId === 'calendar') {
            initCalendar();
        } else if (pageId === 'settings') {
            if (window.renderAdminsList) window.renderAdminsList();
        }
    }, 150);
}

// ─── Dashboard Stats & Clock ───────────────────────
function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    clockEl.querySelector('.time').textContent = timeStr;
    clockEl.querySelector('.date').textContent = dateStr;
}

async function loadDashboardStats() {
    updateClock(); // Initialize immediately
    try {
        const files = await fetchDriveFiles();
        updateDocStat(files.length);
    } catch (e) { /* silently fail */ }

    try {
        const videos = await fetchYouTubeVideos();
        updateVideoStat(videos.length);
    } catch (e) { /* silently fail */ }

    // Update Sidebar Footer Info
    const adminSession = JSON.parse(localStorage.getItem('admin_session') || '{}');
    if (adminSession.full_name) {
        const nameEl = document.getElementById('sidebar-admin-name');
        const avatarEl = document.getElementById('sidebar-admin-avatar');
        if (nameEl) nameEl.textContent = adminSession.full_name;
        if (avatarEl) avatarEl.textContent = adminSession.full_name.charAt(0);
    }
}

// ─── Calendar Logic ─────────────────────────────────
let calDate = new Date();
let calEvents = JSON.parse(localStorage.getItem('scout_cal_events') || '{}');
let selectedDay = null;

function initCalendar() {
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('calendar-month-year');
    if (!grid || !label) return;

    grid.innerHTML = '';
    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    // Arabic Month Names
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
    for (let d = 1; d <= daysInMonth; d++) {
        const dayEl = document.createElement('div');
        const dStr = `${year}-${month}-${d}`;
        dayEl.className = 'cal-day animate-in';
        if (dStr === todayStr) dayEl.classList.add('today');

        dayEl.innerHTML = `<span>${d}</span>`;
        if (calEvents[dStr]) {
            dayEl.innerHTML += `<div class="event-indicator" title="${calEvents[dStr]}"></div>`;
        }

        dayEl.onclick = () => openCalendarModal(dStr, d);
        grid.appendChild(dayEl);
    }
}

function changeMonth(dir) {
    calDate.setMonth(calDate.getMonth() + dir);
    renderCalendar();
}

function openCalendarModal(dateStr, dayNum) {
    selectedDay = dateStr;
    const modal = document.getElementById('calendar-modal');
    const title = document.getElementById('cal-modal-date');
    const area = document.getElementById('cal-event-text');

    title.textContent = `فعالية يوم ${dayNum}`;
    area.value = calEvents[dateStr] || '';
    modal.classList.add('active');
}

function closeCalendarModal() {
    document.getElementById('calendar-modal').classList.remove('active');
}

function saveCalendarEvent() {
    const text = document.getElementById('cal-event-text').value.trim();
    if (text) {
        calEvents[selectedDay] = text;
    } else {
        delete calEvents[selectedDay];
    }
    localStorage.setItem('scout_cal_events', JSON.stringify(calEvents));
    closeCalendarModal();
    renderCalendar();
}

// ─── Init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Start clock interval
    setInterval(updateClock, 1000);

    // Initial Sidebar Tasks Render
    renderSidebarTasks();

    // Bind sidebar clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });

    // Close search on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-search')) {
            const res = document.getElementById('search-results');
            if (res) res.classList.remove('active');
        }
    });

    // Show dashboard
    navigateTo('dashboard');
});
