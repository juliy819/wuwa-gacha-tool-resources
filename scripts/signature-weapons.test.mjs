import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSignatureWeapons } from './signature-weapons.mjs';

const role = { rank: 5, zh: 'New role', weapon: 2 };
const weapon = { rank: 5, zh: 'Signature weapon', type: 2 };
const detail = { id: 9999, name: role.zh, weapon: 2, recommend: { weapon: [21020086] } };
const fixture = (overrides = {}) => ({
  characters: { 9999: role },
  weapons: { 21020086: weapon },
  manualPairs: [],
  loadDetail: async () => detail,
  warn: () => {},
  ...overrides,
});

test('manual mappings override recommendations without fetching details', async () => {
  const mapping = await resolveSignatureWeapons(fixture({
    manualPairs: [{ role_id: 9999, role_name: role.zh, weapon_id: 21020086, weapon_name: weapon.zh }],
    loadDetail: async () => { assert.fail('manual mapping must not fetch recommendations'); },
  }));
  assert.deepEqual(mapping, { 9999: 21020086 });
});

test('unmapped roles use the first recommended eligible weapon', async () => {
  assert.deepEqual(await resolveSignatureWeapons(fixture()), { 9999: 21020086 });
});

test('standard and Rover roles never fetch recommendations', async () => {
  assert.deepEqual(await resolveSignatureWeapons(fixture({
    characters: { 1301: role, 9999: { ...role, zh: '漂泊者·导电' }, 9998: { ...role, rank: 4 } },
    loadDetail: async () => { assert.fail('excluded role fetched'); },
  })), {});
});

test('invalid, standard, projection and mismatched recommendations remain unmapped', async () => {
  const cases = [
    { loadDetail: async () => ({ ...detail, recommend: {} }) },
    { loadDetail: async () => ({ ...detail, id: 9998 }) },
    { loadDetail: async () => ({ ...detail, recommend: { weapon: ['21020086'] } }) },
    { weapons: { 21020086: { ...weapon, rank: 4 } } },
    { weapons: { 21020086: { ...weapon, type: 1 } } },
    { weapons: { 21020086: { ...weapon, zh: '投影·外观' } } },
    ...[21020015, 21020045].map((id) => ({
      weapons: { [id]: weapon },
      loadDetail: async () => ({ ...detail, recommend: { weapon: [id, 21020086] } }),
    })),
  ];
  for (const overrides of cases) {
    assert.deepEqual(await resolveSignatureWeapons(fixture(overrides)), {});
  }
});

test('failed detail requests warn and preserve manual mappings', async () => {
  const warnings = [];
  const mappings = await resolveSignatureWeapons(fixture({
    characters: { 9998: role, 9999: role },
    manualPairs: [{ role_id: 9998, role_name: role.zh, weapon_id: 21020086, weapon_name: weapon.zh }],
    loadDetail: async () => { throw new Error('timeout'); },
    warn: (message) => warnings.push(message),
  }));
  assert.deepEqual(mappings, { 9998: 21020086 });
  assert.equal(warnings.length, 1);
});

test('fallback cannot claim a weapon already reserved by a manual mapping', async () => {
  assert.deepEqual(await resolveSignatureWeapons(fixture({
    characters: { 9998: role, 9999: role },
    manualPairs: [{ role_id: 9998, role_name: role.zh, weapon_id: 21020086, weapon_name: weapon.zh }],
  })), { 9998: 21020086 });
});

test('invalid manual mappings fail the build', async () => {
  await assert.rejects(resolveSignatureWeapons(fixture({
    manualPairs: [{ role_id: 9999, role_name: 'Wrong name', weapon_id: 21020086, weapon_name: weapon.zh }],
  })), /invalid signature weapon mapping/);
});
