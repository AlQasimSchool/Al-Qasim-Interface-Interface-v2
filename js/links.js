import { state, saveCustomLinks } from './state.js';
import { navigateTo } from './navigation.js';

export function saveCustomLink(name, url, desc, icon) {
    if (!name || !url) {
        alert('الرجاء إدخال الاسم والرابط');
        return false;
    }

    // Default icon if none selected
    if (!icon) icon = 'fas fa-link';

    state.customLinks.push({
        name,
        url,
        desc: desc || '',
        cat: 'user',
        icon: icon,
        color: 'blue'
    });
    saveCustomLinks();
    return true;
}

export function deleteCustomLink(url) {
    state.customLinks = state.customLinks.filter(l => l.url !== url);
    saveCustomLinks();
    navigateTo('links');
}
