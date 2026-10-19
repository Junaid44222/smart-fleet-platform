import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAssignVehicleDriver,
  canChangeVehicleStatus,
  canCreateDriver,
  canCreateVehicle,
  canCreateFuel,
  canCreateMaintenance,
  canDeleteDriver,
  canDeleteFuel,
  canDeleteMaintenance,
  canDeleteVehicle,
  canDeleteUsers,
  canCreateTrip,
  canUpdateTrip,
  canDeleteTrip,
  canManageFuel,
  canManageMaintenance,
  canManageUsers,
  canUpdateDriver,
  canUpdateFuel,
  canUpdateMaintenance,
  canUpdateVehicle,
} from './rolePermissions.ts';

const rolePermissions = {
  Admin: [...Array(17).fill(true), false, true, true, true],
  SuperAdmin: Array(21).fill(true),
  FleetManager: [false, true, true, false, true, true, false, true, true, true, false, true, true, true, false, true, false, false, true, true, false],
  Dispatcher: [false, false, false, false, false, false, false, true, ...Array(10).fill(false), true, true, false],
  MaintenanceTechnician: [false, false, false, false, false, false, false, false, true, true, false, true, false, false, false, false, false, false, false, false, false],
  SafetyOfficer: Array(21).fill(false),
  Viewer: Array(21).fill(false),
  Driver: Array(21).fill(false),
};

const checks = [
  canChangeVehicleStatus,
  canCreateVehicle,
  canUpdateVehicle,
  canDeleteVehicle,
  canCreateDriver,
  canUpdateDriver,
  canDeleteDriver,
  canAssignVehicleDriver,
  canCreateMaintenance,
  canUpdateMaintenance,
  canDeleteMaintenance,
  canManageMaintenance,
  canCreateFuel,
  canUpdateFuel,
  canDeleteFuel,
  canManageFuel,
  canManageUsers,
  canDeleteUsers,
  canCreateTrip,
  canUpdateTrip,
  canDeleteTrip,
];

for (const [role, expected] of Object.entries(rolePermissions)) {
  test(`${role} frontend actions match Fleet API role policy`, () => {
    assert.deepEqual(checks.map((check) => check(role)), expected);
  });
}

test('unknown roles receive no privileged actions', () => {
  assert.deepEqual(checks.map((check) => check('UnexpectedRole')), Array(checks.length).fill(false));
});
