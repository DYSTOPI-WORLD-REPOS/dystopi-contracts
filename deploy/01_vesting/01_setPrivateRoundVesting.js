const { DEPLOY_TAGS, CONTRACTS } = require('../../utils/constants');
const parseCSVAsync = require('../../utils/parseCSVAsync');
const { ethers } = require('hardhat');

const duration = 63072000;
const slicePeriodSeconds = duration / 24;

const vestingOpts = {
  start: Math.floor(Date.now() / 1000) - slicePeriodSeconds, // starts now minus 1 period, first release available right away
  cliffDelta: 0, // vesting starts right away
  duration, // fully vests in 2 years
  slicePeriodSeconds, // ~1 month in seconds
  revocable: false // cannot be revoked
};

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

  log(
    `Setting up private round vesting for ${privateVestingAddresses.length} addresses`
  );

  const vestedCount = await read(
    CONTRACTS.dysVesting,
    'getVestingSchedulesCount'
  );

  log('Current vested count: ', vestedCount.toNumber());

  if (vestedCount >= privateVestingAddresses.length) {
    log('Private round vesting already set up, exiting...');
    return;
  }

  const param = privateVestingAddresses.map(({ beneficiary, amount }) => ({
    beneficiary,
    ...vestingOpts,
    amount: ethers.utils.parseUnits(amount, 'ether')
  }));

  const tokensToBeVested = param.reduce(
    (acc, { amount }) => acc.add(amount),
    ethers.BigNumber.from(0)
  );

  const tokensCanBeVested = await read(
    CONTRACTS.dysVesting,
    'getWithdrawableAmount'
  );

  log('Tokens to be vested: ', tokensToBeVested.toString());
  log('Tokens can be vested: ', tokensCanBeVested.toString());

  if (tokensToBeVested.gt(tokensCanBeVested)) {
    log('Trying to vest more tokens than the balance...');
    return;
  }

  await execute(
    CONTRACTS.dysVesting,
    { from: deployer, log: true },
    'createVestingSchedules',
    param
  );

  log('Private round vesting set up successfully');
};

module.exports.tags = [
  DEPLOY_TAGS.actions.setPrivateRoundVesting,
  DEPLOY_TAGS.groups.vesting
];
module.exports.dependencies = [DEPLOY_TAGS.actions.deployDysVesting];
