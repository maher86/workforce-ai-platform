export type ReportSlice = { key: string; label: string; total: number };

// Explicitly aggregate the tail so charts remain readable without losing reports.
export function compactReportSlices(
    rows: ReportSlice[],
    other: string,
    limit = 8,
): ReportSlice[] {
    if (!Number.isInteger(limit) || limit < 2)
        throw new Error('Invalid slice limit');
    if (rows.some((row) => !Number.isSafeInteger(row.total) || row.total < 0))
        throw new Error('Invalid report count');
    const sorted = rows
        .filter((row) => row.total > 0)
        .map((row) => ({ ...row }))
        .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
    if (sorted.length <= limit) return sorted;
    return [
        ...sorted.slice(0, limit - 1),
        {
            key: 'group:other',
            label: other,
            total: sorted
                .slice(limit - 1)
                .reduce((sum, row) => sum + row.total, 0),
        },
    ];
}

export function reportSliceColor(key: string): string {
    const colors = [
        '#f58220',
        '#28476b',
        '#4b8091',
        '#7288ad',
        '#ad7654',
        '#668578',
        '#a18c62',
        '#8494a6',
    ];
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return colors[hash % colors.length];
}
