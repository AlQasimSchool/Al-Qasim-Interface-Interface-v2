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
            .map(item => ({
                id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
                title: item.snippet?.title || 'بدون عنوان',
                thumbnail: item.snippet?.thumbnails?.high?.url || '',
                publishedAt: item.snippet?.publishedAt || '',
            }));
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

    const url = `https://www.googleapis.com/drive/v3/files/${CONFIG.STUDENTS_DOC_ID}/export?mimeType=text/plain&key=${CONFIG.DRIVE_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('فشل جلب ملف الطلاب');

        const text = await response.text();
        const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l !== ''); // Keep '-' to maintain alignment

        // Logic: Find where headers end. Data starts after "رقم الجوال"
        const headerIndex = lines.findIndex(l => l.includes('رقم الجوال'));
        if (headerIndex === -1) throw new Error('تنسيق الملف غير صحيح');

        const dataLines = lines.slice(headerIndex + 1);
        const students = [];

        // Every 6 lines = 1 student (ID, Name, Nationality, CivilID, Section, Phone)
        for (let i = 0; i < dataLines.length; i += 6) {
            // Check if we have enough lines and if the first line is a number (ID)
            const id = dataLines[i];
            if (isNaN(id)) break; // End of list or unexpected line

            if (i + 5 < dataLines.length) {
                students.push({
                    id: parseInt(id),
                    name: dataLines[i + 1],
                    nationality: dataLines[i + 2],
                    civilId: dataLines[i + 3],
                    section: dataLines[i + 4],
                    phone: dataLines[i + 5],
                });
            }
        }

        state.studentsCache = students;
        return students;
    } catch (err) {
        console.error('Students API Error:', err);
        throw err;
    }
}
