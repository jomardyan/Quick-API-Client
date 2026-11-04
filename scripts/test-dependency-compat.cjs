'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

(async () => {
    const root = path.resolve(__dirname, '..');
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
    const patterns = [
        ['src/index.js', '**/*.js', {}, true], ['.env', '*', {}, false],
        ['.env', '*', { dot: true }, true], ['A.TS', '*.ts', { nocase: true }, true],
        ['src/a.ts', 'src/*.{js,ts}', {}, true], ['src/a.js', '!**/*.ts', {}, true],
    ];
    let consumers = 0;
    for (const [location, entry] of Object.entries(lock.packages)) {
        if (!location || !entry.dependencies?.minimatch) continue;
        const from = createRequire(path.join(root, location, 'package.json'));
        const match = from('minimatch');
        for (const [file, pattern, options, expected] of patterns) {
            assert.equal(match(file, pattern, options), expected, location);
            assert.equal(match.minimatch(file, pattern, options), expected, location);
            assert.equal(new match.Minimatch(pattern, options).match(file), expected, location);
        }
        assert.equal(match.defaults({ nocase: true })('A.JS', '*.js'), true);
        assert.deepEqual(match.match(['a.js', 'b.ts'], '*.js'), ['a.js']);
        consumers++;
    }
    assert(consumers > 0);
    const merge = createRequire(path.join(root, 'node_modules/jest-config/package.json'))('deepmerge');
    for (const key of ['__proto__', 'constructor', 'prototype']) {
        const hostile = JSON.parse(`{"${key}":{"polluted":true}}`);
        const result = merge(hostile, { safe: true });
        assert.equal(Object.getPrototypeOf(result), Object.prototype);
        assert.equal(result.polluted, undefined);
        assert.equal({}.polluted, undefined);
    }
    const symbol = Symbol('field');
    const merged = merge({ nested: { a: 1 }, list: [1], [symbol]: 'kept' }, { nested: { b: 2 }, list: [2] });
    assert.deepEqual(merged.nested, { a: 1, b: 2 });
    assert.deepEqual(merged.list, [1, 2]);
    assert.equal(merged[symbol], 'kept');
    assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
    assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_, source) => source }), { list: [2] });

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-api-glob-compat-'));
    try {
        fs.writeFileSync(path.join(temp, 'a.js'), 'fixture');
        fs.writeFileSync(path.join(temp, 'b.ts'), 'fixture');
        let globConsumers = 0;
        for (const [location, entry] of Object.entries(lock.packages)) {
            if (!location || !entry.dependencies?.glob) continue;
            const glob = createRequire(path.join(root, location, 'package.json'))('glob');
            assert.deepEqual(await glob.glob('*.js', { cwd: temp }), ['a.js'], location);
            assert.deepEqual(glob.sync('*.ts', { cwd: temp }), ['b.ts'], location);
            const files = await new Promise((resolve, reject) => glob('*.ts', { cwd: temp }, (error, result) => error ? reject(error) : resolve(result)));
            assert.deepEqual(files, ['b.ts'], location);
            globConsumers++;
        }
        assert(globConsumers > 0);
    } finally {
        const resolved = fs.realpathSync(temp);
        assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
        assert(path.basename(resolved).startsWith('quick-api-glob-compat-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
    console.log(consumers + ' minimatch consumers: callable/named/class APIs pass; modern/legacy real glob and deepmerge pollution/behavior regressions pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });
