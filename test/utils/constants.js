const { ethers } = require('hardhat');
const { keccak256, toUtf8Bytes } = ethers.utils;

module.exports = {
  NULL_ADDRESS: '0x0000000000000000000000000000000000000000',
  mockSigner: '0xA1176527C8A4b057e1e052bdDC6FF9FA5bE48b8a',
  mockPrivateKey:
    '0xccdd0af596e04e49b52c356bfbb429c91cf33becd135c59265fe41118709df91',
  mockPrivateKey2:
    '0x2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b',
  MAX_SOLIDITY_INTEGER:
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  PAUSER_ROLE: keccak256(toUtf8Bytes('PAUSER_ROLE')).toLowerCase(),
  STORE_ADMIN_ROLE: keccak256(toUtf8Bytes('STORE_ADMIN_ROLE')).toLowerCase(),
  ITEM_ADMIN_ROLE: keccak256(toUtf8Bytes('ITEM_ADMIN_ROLE')).toLowerCase(),
  GEM_ADMIN_ROLE: keccak256(toUtf8Bytes('GEM_ADMIN_ROLE')).toLowerCase(),
  BENEFICIARY_ROLE: keccak256(toUtf8Bytes('BENEFICIARY_ROLE')).toLowerCase(),
  MINTER_ROLE: keccak256(toUtf8Bytes('MINTER_ROLE')).toLowerCase(),
  TREASURER_ROLE: keccak256(toUtf8Bytes('TREASURER_ROLE')).toLowerCase(),
  CLAIM_ADMIN_ROLE: keccak256(toUtf8Bytes('CLAIM_ADMIN_ROLE')).toLowerCase(),
  FEE_ADMIN_ROLE: keccak256(toUtf8Bytes('FEE_ADMIN_ROLE')).toLowerCase(),
  DEFAULT_ADMIN_ROLE:
    '0x0000000000000000000000000000000000000000000000000000000000000000'
};
