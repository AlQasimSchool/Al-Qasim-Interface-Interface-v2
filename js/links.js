import { state } from './state.js';
import { navigateTo } from './navigation.js';
import { fetchCustomLinksSupabase, saveCustomLinkSupabase, deleteCustomLinkSupabase } from './api.js';

export async function loadCustomLinks() {
    state.customLinks = await fetchCustomLinksSupabase();
}

export async function saveCustomLink(name, url, desc, icon) {
    if (!name || !url) {
        alert('الرجاء إدخال الاسم والرابط');
        return false;
    }

    if (!icon) icon = 'fas fa-link';

    const newLink = {
        name,
        url,
        desc: desc || '',
        cat: 'user',
        icon: icon,
        color: 'blue'
    };

    await saveCustomLinkSupabase(newLink);
    await loadCustomLinks();
    return true;
}

export async function deleteCustomLink(id) {
    await deleteCustomLinkSupabase(id);
    await loadCustomLinks();
    navigateTo('links');
}
