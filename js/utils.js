export function getFileType(mimeType) {
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

export function getFileTypeName(mimeType) {
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

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('ar-EG', options);
}

export function getFileOpenUrl(file) {
    if (file.webViewLink) return file.webViewLink;
    return `https://drive.google.com/file/d/${file.id}/view`;
}

export function getFileIcon(type) {
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
    return icons[type] || icons.file;
}

export function getWeatherIcon(code) {
    if (code === 0) return 'fa-sun';
    if (code <= 3) return 'fa-cloud-sun';
    if (code <= 48) return 'fa-cloud';
    return 'fa-cloud-showers-heavy';
}
