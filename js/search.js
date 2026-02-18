import { state } from './state.js';
import { getFileOpenUrl } from './utils.js';
import { DEFAULT_LINKS } from './data.js';

export function handleGlobalSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    query = query.toLowerCase().trim();
    if (!query) {
        resultsContainer.classList.remove('active');
        return;
    }

    const categories = {
        docs: { label: 'المستندات', icon: 'fas fa-folder-open', color: 'var(--primary-green)', results: [] },
        videos: { label: 'المقاطع المرئية', icon: 'fas fa-play-circle', color: '#ff0000', results: [] },
        links: { label: 'الروابط المفيدة', icon: 'fas fa-compass', color: 'var(--primary-green)', results: [] },
        reports: { label: 'التقارير', icon: 'fas fa-file-pdf', color: '#e11d48', results: [] },
        students: { label: 'الطلاب', icon: 'fas fa-users', color: 'var(--primary-green)', results: [] }
    };

    // 1. Search Documents
    if (state.driveFilesCache) {
        state.driveFilesCache.filter(f => f.name.toLowerCase().includes(query)).forEach(f => {
            categories.docs.results.push({
                name: f.name,
                url: getFileOpenUrl(f),
                sub: 'مستند درايف',
                type: 'doc'
            });
        });
    }

    // 2. Search Videos
    if (state.youtubeVideosCache) {
        state.youtubeVideosCache.filter(v => v.title.toLowerCase().includes(query)).forEach(v => {
            categories.videos.results.push({
                name: v.title,
                url: v.id,
                sub: 'مقطع فيديو كشفي',
                type: 'video'
            });
        });
    }

    // 3. Search Links (Default + Custom)
    const allLinks = [...DEFAULT_LINKS, ...state.customLinks];
    allLinks.filter(l => l.name.toLowerCase().includes(query)).forEach(l => {
        categories.links.results.push({
            name: l.name,
            url: l.url,
            sub: 'رابط خارجي',
            type: 'link'
        });
    });

    // 4. Search Reports
    if (state.reportFilesCache) {
        state.reportFilesCache.filter(f => f.name.toLowerCase().includes(query)).forEach(f => {
            categories.reports.results.push({
                name: f.name,
                url: `https://drive.google.com/file/d/${f.id}/preview`,
                sub: 'تـقرير PDF',
                type: 'report'
            });
        });
    }

    // 5. Search Students
    if (state.studentsCache) {
        state.studentsCache.filter(s => s.name.toLowerCase().includes(query)).forEach(s => {
            categories.students.results.push({
                name: s.name,
                url: 'students',
                sub: `شعبة: ${s.section}`,
                type: 'student'
            });
        });
    }

    const hasResults = Object.values(categories).some(c => c.results.length > 0);

    if (hasResults) {
        resultsContainer.innerHTML = Object.entries(categories).map(([key, cat]) => {
            if (cat.results.length === 0) return '';
            return `
                <div class="search-category">
                    <div class="search-category-header">
                        <i class="${cat.icon}" style="color:${cat.color}"></i>
                        <span>${cat.label}</span>
                    </div>
                    ${cat.results.slice(0, 5).map(r => `
                        <div class="search-result-item" data-search-type="${r.type}" data-search-url="${r.url}" data-search-name="${r.name}">
                            <div class="search-result-info">
                                <h6>${r.name}</h6>
                                <span>${r.sub}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
    } else {
        resultsContainer.innerHTML = '<div class="empty-results">لا توجد نتائج مطابقة لبحثك..</div>';
    }

    resultsContainer.classList.add('active');
}
