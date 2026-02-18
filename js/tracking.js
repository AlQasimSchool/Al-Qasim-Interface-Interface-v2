export function trackClick(item) {
    let history = JSON.parse(localStorage.getItem('scout_history') || '{}');
    if (!history[item.id]) {
        history[item.id] = { ...item, count: 0 };
    }
    history[item.id].count += 1;
    history[item.id].lastOpened = Date.now();
    localStorage.setItem('scout_history', JSON.stringify(history));
}

export function getMostOpened() {
    let history = JSON.parse(localStorage.getItem('scout_history') || '{}');
    const now = Date.now();

    return Object.values(history)
        .map(item => {
            const hoursSince = (now - item.lastOpened) / (1000 * 60 * 60);
            const daysSince = hoursSince / 24;
            const score = item.count * (1 / (1 + daysSince));
            return { ...item, smartScore: score };
        })
        .filter(item => item.count >= 2)
        .sort((a, b) => b.smartScore - a.smartScore)
        .slice(0, 4);
}
