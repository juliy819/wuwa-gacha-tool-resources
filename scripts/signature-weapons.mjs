const STANDARD_ROLE_IDS = new Set([1104, 1203, 1301, 1405, 1503]);
const STANDARD_WEAPON_IDS = new Set([
  21010015, 21020015, 21030015, 21040015, 21050015,
  21010045, 21020045, 21030045, 21040045, 21050045,
]);

const eligibleRole = (id, role) => Number.isSafeInteger(id) && id > 0
  && role?.rank === 5 && typeof role.zh === 'string' && role.zh.length > 0
  && !STANDARD_ROLE_IDS.has(id) && !role.zh.startsWith('漂泊者');

const eligibleWeapon = (id, weapon, role) => Number.isSafeInteger(id) && id > 0
  && weapon?.rank === 5 && typeof weapon.zh === 'string' && weapon.zh.length > 0
  && Number.isInteger(role.weapon) && role.weapon >= 1 && role.weapon <= 5
  && role.weapon === weapon.type && !STANDARD_WEAPON_IDS.has(id)
  && !weapon.zh.startsWith('投影');

export async function resolveSignatureWeapons({ characters, weapons, manualPairs, loadDetail, warn = console.warn }) {
  const mappings = new Map();
  const mappedWeapons = new Set();
  for (const pair of manualPairs) {
    const role = characters[pair.role_id];
    const weapon = weapons[pair.weapon_id];
    if (!eligibleRole(pair.role_id, role) || !eligibleWeapon(pair.weapon_id, weapon, role)
      || role.zh !== pair.role_name || weapon.zh !== pair.weapon_name
      || mappings.has(pair.role_id) || mappedWeapons.has(pair.weapon_id)) {
      throw new Error(`invalid signature weapon mapping: ${pair.role_name} / ${pair.weapon_name}`);
    }
    mappings.set(pair.role_id, pair.weapon_id);
    mappedWeapons.add(pair.weapon_id);
  }

  // Manual mappings reserve their weapons before any fallback is considered.
  for (const [id, role] of Object.entries(characters).sort(([a], [b]) => Number(a) - Number(b))) {
    const roleId = Number(id);
    if (!eligibleRole(roleId, role) || mappings.has(roleId)) continue;
    try {
      const detail = await loadDetail(roleId);
      const weaponId = detail?.recommend?.weapon?.[0];
      if (detail?.id !== roleId || detail?.name !== role.zh || detail?.weapon !== role.weapon
        || !eligibleWeapon(weaponId, weapons[weaponId], role) || mappedWeapons.has(weaponId)) {
        warn(`signature weapon fallback skipped: ${roleId} (${role.zh}), invalid recommendation`);
        continue;
      }
      mappings.set(roleId, weaponId);
      mappedWeapons.add(weaponId);
    } catch {
      warn(`signature weapon fallback skipped: ${roleId} (${role.zh}), detail unavailable`);
    }
  }
  return Object.fromEntries(mappings);
}
