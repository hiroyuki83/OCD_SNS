export function publicHandleFromEmail(email: string | null | undefined) {
    const value = (email ?? '').trim();
    if (!value) return 'user';
    return value.split('@')[0] || 'user';
}
