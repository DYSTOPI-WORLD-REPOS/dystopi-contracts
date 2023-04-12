const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');
const parseCSVAsync = require('../../utils/parseCSVAsync');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, execute, read } = deployments;

  const { deployer } = await getNamedAccounts();

  const privateVestingAddresses = await parseCSVAsync(
    './vesting/allocation_private.csv',
    {
      delimiter: ';',
      columns: true
    }
  );

  const uniqueAddresses = [
    ...new Set(
      privateVestingAddresses.map(({ beneficiary }) =>
        beneficiary.toLowerCase()
      )
    )
  ];

  log(
    `Dispersing private round vested tokens for ${uniqueAddresses.length} addresses`
  );

  for await (const beneficiary of uniqueAddresses) {
    const vestedCount = await read(
      CONTRACTS.dysVesting,
      'getVestingSchedulesCountByBeneficiary',
      beneficiary
    );

    log(`Vested count for ${beneficiary}: `, vestedCount.toNumber());

    for (let i = 0; i < vestedCount; i++) {
      const vestingId = await read(
        CONTRACTS.dysVesting,
        'computeVestingScheduleIdForAddressAndIndex',
        beneficiary,
        i
      );

      log(`Vesting id for ${beneficiary} at index ${i}: ${vestingId}`);

      const releasableAmount = await read(
        CONTRACTS.dysVesting,
        'computeReleasableAmount',
        vestingId
      );

      if (releasableAmount.gt(0)) {
        log(
          `Releasing ${releasableAmount.toString()} for ${beneficiary}, at vesting index ${i}...`
        );

        await execute(
          CONTRACTS.dysVesting,
          { from: deployer, log: true },
          'release',
          vestingId,
          releasableAmount
        );
      } else {
        log(`Nothing to release for ${beneficiary}, at vesting index ${i}`);
      }
    }
  }
};

module.exports.tags = [
  DEPLOY_TAGS.actions.executePrivateRoundVesting,
  DEPLOY_TAGS.groups.vest
];
module.exports.dependencies = [DEPLOY_TAGS.actions.setPrivateRoundVesting];
