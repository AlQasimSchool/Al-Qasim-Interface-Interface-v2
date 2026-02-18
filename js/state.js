export const state = {
    driveFilesCache: null,
    reportFilesCache: null,
    youtubeVideosCache: null,
    docsViewMode: localStorage.getItem('scout_docs_view') || 'grid',
    customLinks: JSON.parse(localStorage.getItem('scout_custom_links') || '[]'),
    mostOpenedCache: null,
    currentPage: 'dashboard',

    // For Folder Navigation
    folderStack: [], // To handle "Back" logic
    currentFolderId: null,
    isStudentsUnlocked: false,
    studentsCache: null
};

// State update helpers
export function saveCustomLinks() {
    localStorage.setItem('scout_custom_links', JSON.stringify(state.customLinks));
}

export function saveDocsViewMode() {
    localStorage.setItem('scout_docs_view', state.docsViewMode);
}
