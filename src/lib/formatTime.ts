export function formatPostTime(input: string | Date): string {
    const date = typeof input === 'string' ? new Date(input) : input;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const hourMs = 1000 * 60 * 60;
    const dayMs = hourMs * 24;

    const diffHours = Math.floor(diffMs / hourMs);
    if (diffHours < 24) {
        const safeHours = Math.max(0, diffHours);
        return `${safeHours}時間前`;
    }

    const diffDays = Math.floor(diffMs / dayMs);
    if (diffDays < 2) {
        return `${diffDays}日前`;
    }

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}
