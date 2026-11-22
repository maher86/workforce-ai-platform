import assert from 'node:assert/strict';
import test from 'node:test';
import {
    compactReportSlices,
    reportSliceColor,
} from '../../resources/js/lib/report-chart.ts';

await test('pie grouping preserves the exact total and retains distinct same-name employees', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
        key: `person:${i}`,
        label: 'Synthetic employee',
        total: i + 1,
    }));
    const snapshot = structuredClone(rows);
    const slices = compactReportSlices(rows, 'Other employees');
    assert.equal(slices.length, 8);
    assert.equal(
        slices.reduce((sum, row) => sum + row.total, 0),
        1275,
    );
    assert.equal(slices.at(-1).key, 'group:other');
    assert.equal(
        slices.at(-1).total,
        rows
            .filter((row) => row.total <= 43)
            .reduce((sum, row) => sum + row.total, 0),
    );
    assert.deepEqual(rows, snapshot);
});

await test('empty and zero-report charts do not produce a fake slice; bad counts fail explicitly', () => {
    assert.deepEqual(compactReportSlices([], 'Other'), []);
    assert.deepEqual(
        compactReportSlices(
            [{ key: 'zero', label: 'Zero', total: 0 }],
            'Other',
        ),
        [],
    );
    for (const total of [-1, NaN, Infinity, 1.5])
        assert.throws(() =>
            compactReportSlices([{ key: 'bad', label: 'Bad', total }], 'Other'),
        );
    assert.throws(() => compactReportSlices([], 'Other', 1));
});

await test('slice identities and colors stay stable when order, locale or period changes', () => {
    const rows = [
        { key: 'person:3', label: 'Arabic name', total: 4 },
        { key: 'person:2', label: 'Same name', total: 4 },
    ];
    const first = compactReportSlices(rows, 'Other');
    assert.deepEqual(first, compactReportSlices([...rows].reverse(), 'البقية'));
    assert.equal(
        reportSliceColor(rows[0].key),
        reportSliceColor({ ...rows[0], total: 99 }.key),
    );
    assert.equal(first.length, 2);
});
