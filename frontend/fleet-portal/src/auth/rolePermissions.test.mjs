import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAssignVehicleDriver,
  canChangeVehicleStatus,
  canCreateDriver,
  canCreateVehicle,
  canManageFuel,
  canManageMaintenance,
  canManageUsers,
} from './rolePermissions.ts';

const rolePermissions = {
  Admin: [true, true, true, true, true, true, true],
  SuperAdmin: [false, true, true, true, true, true, true],
  FleetManager: [false, true, true, true, true, true, false],
  Dispatcher: [false, false, false, true, false, false, false],
  MaintenanceTechnician: [false, false, false, false, true, false, false],
  SafetyOfficer: [false, false, false, false, false, false, false],
  Viewer: [false, false, false, false, false, false, false],
  Driver: [false, false, false, false, false, false, false],
};

const checks = [
  canChangeVehicleStatus,
  canCreateVehicle,
  canCreateDriver,
  canAssignVehicleDriver,
  canManageMaintenance,
  canManageFuel,
  canManageUsers,
];

for (const [role, expected] of Object.entries(rolePermissions)) {
  test(`${role} frontend actions match Fleet API role policy`, () => {
    assert.deepEqual(checks.map((check) => check(role)), expected);
  });
}

test('unknown roles receive no privileged actions', () => {
  assert.deepEqual(checks.map((check) => check('UnexpectedRole')), Array(7).fill(false));
});
