// Run: node --experimental-strip-types tests/level-scope.test.ts  (pure parts only; no database)
import assert from 'node:assert/strict';
import { scopeOf, inScope } from '../src/lib/levelScopeCore.ts';
assert.equal(scopeOf({ role: 'PRINCIPAL', level: 'sd' }), 'SD');
assert.equal(scopeOf({ role: 'HRD', level: 'SD' }), null, 'HRD is shared');
assert.equal(scopeOf({ role: 'DIRECTOR', level: null }), null);
assert.equal(scopeOf({ role: 'ADMIN', level: null }), null, 'central admin stays global');
assert.equal(inScope('SMP', 'SD'), false);
assert.equal(inScope('SD', 'SD'), true);
assert.equal(inScope('TK', null), false, 'people without a school are hidden from a school-bound viewer');
console.log('level scope rules ok');
