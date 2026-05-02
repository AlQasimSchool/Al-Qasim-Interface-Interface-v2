export const state = {
    driveFilesCache: null,
    reportFilesCache: null,
    youtubeVideosCache: null,
    docsViewMode: window.safeStorage.getItem('scout_docs_view') || 'grid',
    customLinks: JSON.parse(window.safeStorage.getItem('scout_custom_links') || '[]'),
    mostOpenedCache: null,
    currentPage: 'dashboard',

    // For Folder Navigation
    folderStack: [], // To handle "Back" logic
    currentFolderId: null,
    isStudentsUnlocked: false,
    studentsCache: null,
    guestsCache: null
};

// Globalize for non-module scripts like auth-unified
window.state = state;

// State update helpers
export function saveCustomLinks() {
    window.safeStorage.setItem('scout_custom_links', JSON.stringify(state.customLinks));
}

export function saveDocsViewMode() {
    window.safeStorage.setItem('scout_docs_view', state.docsViewMode);
}
