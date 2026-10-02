#!/usr/bin/env node
// Runs as the prepublishOnly script. Publishing to npm is a Sponsor gate, so `npm publish`
// is refused unless NG_UPGRADE_PLANNER_ALLOW_PUBLISH=1 is set explicitly.
if (process.env.NG_UPGRADE_PLANNER_ALLOW_PUBLISH !== '1') {
  console.error(
    'npm publish is blocked: publishing ng-upgrade-planner is a Sponsor gate. ' +
      'Set NG_UPGRADE_PLANNER_ALLOW_PUBLISH=1 only after the Sponsor has approved the release.',
  );
  process.exit(1);
}
