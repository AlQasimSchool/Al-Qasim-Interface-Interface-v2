import { CONFIG } from './config.js';
import { state } from './state.js';

export async function fetchYouTubeVideos() {
    if (state.youtubeVideosCache) return state.youtubeVideosCache;

    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=25&playlistId=${CONFIG.YOUTUBE_PLAYLIST_ID}&key=${CONFIG.YOUTUBE_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('فشل الاتصال بـ YouTube');
        const data = await response.json();
        state.youtubeVideosCache = (data.items || [])
            .filter(item => {
                const title = item.snippet?.title || '';
                return title !== 'Deleted video' && title !== 'Private video';
            })
            .map(item => {
                const pubDate = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || '';
                return {
                    id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
                    title: item.snippet?.title || 'بدون عنوان',
                    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '',
                    publishedAt: pubDate,
                };
            })
            .filter(item => item.publishedAt) // Ensure we have a date
            .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        return state.youtubeVideosCache;
    } catch (err) {
        console.error('YT API Error:', err);
        throw err;
    }
}

export async function fetchDriveFiles(folderId = null) {
    const targets = folderId ? [folderId] : CONFIG.DRIVE_FOLDER_IDS;
    const allFiles = [];

    for (const targetId of targets) {
        // Correct query to only get direct children of the target folder
        const query = `'${targetId}' in parents and trashed = false`;
        const fields = 'files(id,name,mimeType,parents,modifiedTime,size,iconLink,webViewLink,thumbnailLink,webContentLink)';
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${CONFIG.DRIVE_API_KEY}&fields=${fields}&orderBy=folder,name,modifiedTime+desc&pageSize=100`;

        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            if (data.files) {
                // Strict secondary check: ensure the targetId is actually one of the parents
                const filtered = data.files.filter(f => f.parents && f.parents.includes(targetId));
                allFiles.push(...filtered);
            }
        } catch (err) {
            console.error('Drive API Error:', err);
        }
    }

    // Dedup by ID
    let uniqueFiles = Array.from(new Map(allFiles.map(file => [file.id, file])).values());

    // HIERARCHY FIX: If we are in root view (aggregating multiple config folders),
    // and a file's parent folder is ALSO in the fetched list, hide the file from root.
    // This prevents "double listing" where a file appears both in root and inside its folder.
    if (!folderId) {
        const foldersInList = new Set(uniqueFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').map(f => f.id));

        uniqueFiles = uniqueFiles.filter(f => {
            // Keep if it has no parents in the current list
            if (!f.parents) return true;
            return !f.parents.some(pId => foldersInList.has(pId));
        });

        state.driveFilesCache = uniqueFiles;
    }

    return uniqueFiles;
}

export async function fetchReportFiles() {
    if (state.reportFilesCache) return state.reportFilesCache;

    const folderId = CONFIG.REPORTS_FOLDER_ID;
    const query = `'${folderId}' in parents and trashed = false`;
    const fields = 'files(id,name,mimeType,modifiedTime,size,iconLink,webViewLink,thumbnailLink,webContentLink)';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${CONFIG.DRIVE_API_KEY}&fields=${fields}&orderBy=name&pageSize=100`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('فشل الاتصال بـ Google Drive');
        const data = await response.json();
        state.reportFilesCache = data.files || [];
        return state.reportFilesCache;
    } catch (err) {
        console.error('Reports API Error:', err);
        throw err;
    }
}

export async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=26.42&longitude=50.10&current_weather=true');
        return await res.json();
    } catch (e) {
        return null;
    }
}

export async function fetchStudentsFromDoc() {
    if (state.studentsCache) return state.studentsCache;

    if (!window._supabase) {
        console.error('Supabase client not found on window object');
        throw new Error('فشل الاتصال بقاعدة البيانات - يرجى تحديث الصفحة');
    }

    try {
        const { data, error } = await window._supabase
            .from('scouts')
            .select('*')
            .order('name');

        if (error) throw error;

        if (!data) throw new Error('لا توجد بيانات طلاب في قاعدة البيانات');

        // Map Supabase 'scouts' table to our Student structure
        const students = data.map(s => ({
            id: s.id || s.civil_id || 'N/A',
            name: s.name || 'بدون اسم',
            nationality: s.nationality || 'سعودي',
            civilId: s.id || s.civil_id || '-',
            section: s.section || s.patrol || '-',
            phone: s.phone || '-'
        }));

        state.studentsCache = students;
        return students;
    } catch (err) {
        console.error('Students Fetch Error:', err);
        showToast("فشل تحميل بيانات الطلاب: " + (err.message || "خطأ غير معروف"), "error");
        throw err;
    }
}

// --- Calendar Supabase ---
export async function fetchCalendarEvents() {
    if (!window._supabase) return [];
    try {
        const { data, error } = await window._supabase.from('calendar_events').select('*');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Calendar Fetch Error:', err);
        return [];
    }
}

export async function saveCalendarEventSupabase(event) {
    if (!window._supabase) return;
    try {
        const { error } = await window._supabase.from('calendar_events').insert([event]);
        if (error) throw error;
    } catch (err) {
        console.error('Calendar Save Error:', err);
    }
}

export async function deleteCalendarEventSupabase(id) {
    if (!window._supabase) return;
    try {
        const { error } = await window._supabase.from('calendar_events').delete().eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Calendar Delete Error:', err);
    }
}

// --- Tasks Supabase ---
export async function fetchTasksSupabase() {
    if (!window._supabase) return [];
    try {
        const { data, error } = await window._supabase.from('tasks').select('*');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Tasks Fetch Error:', err);
        return [];
    }
}

export async function saveTaskSupabase(task) {
    if (!window._supabase) return;
    try {
        const { error } = await window._supabase.from('tasks').upsert([task]);
        if (error) throw error;
    } catch (err) {
        console.error('Task Save Error:', err);
    }
}

export async function deleteTaskSupabase(id) {
    if (!window._supabase) return;
    try {
        const { error } = await window._supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Task Delete Error:', err);
    }
}

// --- Links Supabase ---
export async function fetchCustomLinksSupabase() {
    if (!window._supabase) return [];
    try {
        const { data, error } = await window._supabase.from('custom_links').select('*');
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Links Fetch Error:', err);
        return [];
    }
}

export async function saveCustomLinkSupabase(link) {
    if (!window._supabase) return;
    try {
        const { error } = await window._supabase.from('custom_links').upsert([link]);
        if (error) throw error;
    } catch (err) {
        console.error('Link Save Error:', err);
    }
}

export async function deleteCustomLinkSupabase(id) {
    if (!window._supabase) return;
    try {
        const { error } = await window._supabase.from('custom_links').delete().eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Link Delete Error:', err);
    }
}
