import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from '../../resources/js/lib/ui-translations.ts';

await test('manager labels translate both ways and interpolate plain text', () => {
    assert.equal(translate('التقارير', 'en'), 'Reports');
    assert.equal(translate('Reports', 'ar'), 'التقارير');
    assert.equal(translate('Email address', 'ar'), 'عنوان البريد الإلكتروني');
    assert.equal(translate('اللغة الأصلية', 'en'), 'Original language');
    assert.equal(translate('الإنجليزية', 'en'), 'English');
    assert.equal(
        translate('Name: {name}', 'en', { name: '<employee>' }),
        'Name: <employee>',
    );
});
await test('unknown names, phone values and source text remain untouched', () => {
    for (const source of [
        'A synthetic employee name',
        '+15550001111',
        'ركبت ثلاثة فلاتر ولم أكمل العمل.',
        'The brakes are not finished.',
    ]) {
        assert.equal(translate(source, 'en'), source);
        assert.equal(translate(source, 'ar'), source);
    }
});
