"use strict";

/* =========================================================
   ERC-20 ABI
========================================================= */

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];


/* =========================================================
   PACKAGE CONTRACT ABI
   0x15D4a6837B49d75C62B3ffd31c8d0351ba051144
========================================================= */

const PACKAGE_ABI = [
  "function BPS() view returns (uint16)",
  "function core() view returns (address)",
  "function owner() view returns (address)",
  "function packageCount() view returns (uint256)",
  "function minPackagePriceUSDT() view returns (uint256)",
  "function maxDailyRewardBps() view returns (uint16)",

  "function getPackage(uint256 packageId) view returns (string name_, uint256 priceUSDT_, uint256 principalNC_, uint16 dailyRewardBps_, uint64 lockSeconds_, bool active_)",

  "function packageForCore(uint256 packageId) view returns (uint256 priceUSDT_, uint256 principalNC_, uint16 dailyRewardBps_, uint64 lockSeconds_, bool active_)",

  "function packageRewardNC(uint256 packageId) view returns (uint256 rewardNC)",

  "function packageTotalNC(uint256 packageId) view returns (uint256 principalNC_, uint256 rewardNC_, uint256 totalNC_)",

  "function calculateRewardNC(uint256 principalNC_, uint16 dailyRewardBps_, uint64 lockSeconds_) pure returns (uint256 rewardNC)",

  "function createPackage(string name_, uint256 priceUSDT_, uint256 principalNC_, uint16 dailyRewardBps_, uint64 lockSeconds_, bool active_) returns (uint256 packageId)",

  "function updatePackage(uint256 packageId, string name_, uint256 priceUSDT_, uint256 principalNC_, uint16 dailyRewardBps_, uint64 lockSeconds_, bool active_)",

  "function setPackageActive(uint256 packageId, bool active_)",

  "function setPackageLimits(uint256 newMinPriceUSDT, uint16 newMaxDailyRewardBps)",

  "function setCore(address newCore)",

  "function transferOwnership(address newOwner)"
];


/* =========================================================
   STAKING CONTRACT ABI
   0x4C98C39A5D892874F66C1Ab71D641647BDF0D4f2
========================================================= */

const STAKING_ABI = [
  "function NC() view returns (address)",
  "function owner() view returns (address)",
  "function core() view returns (address)",
  "function claimPaused() view returns (bool)",

  "function stakesCount(address user) view returns (uint256)",

  "function getStake(address user, uint256 stakeId) view returns (uint256 packageId, uint256 principalNC, uint256 rewardNC, uint64 startTime, uint64 endTime, bool claimed)",

  "function matured(address user, uint256 stakeId) view returns (bool)",

  "function timeUntilUnlock(address user, uint256 stakeId) view returns (uint256)",

  "function userTotalClaimedNC(address user) view returns (uint256)",

  "function reservedNC() view returns (uint256)",

  "function surplusNC() view returns (uint256)",

  "function totalClaimedNC() view returns (uint256)",

  "function totalPositions() view returns (uint256)",

  "function totalPrincipalObligationNC() view returns (uint256)",

  "function totalRewardObligationNC() view returns (uint256)",

  "function claim(uint256 stakeId)",

  "function stakeFor(address user, uint256 packageId, uint256 principalNC, uint256 rewardNC, uint64 lockSeconds) returns (uint256 stakeId)",

  "function setClaimPaused(bool paused_)",

  "function setCore(address newCore)",

  "function withdrawSurplusNC(address to, uint256 amount)",

  "function emergencyWithdrawToken(address token, address to, uint256 amount)",

  "function transferOwnership(address newOwner)"
];


/* =========================================================
   CORE CONTRACT ABI
   0x248CEF21BD24C30AD22E29430864Fcaf11303957
========================================================= */

const CORE_ABI = [
  "function BPS() view returns (uint16)",

  "function USDT() view returns (address)",

  "function owner() view returns (address)",

  "function ownerWallet() view returns (address)",

  "function packageContract() view returns (address)",

  "function stakingContract() view returns (address)",

  "function defaultSponsor() view returns (address)",

  "function referralBps() view returns (uint16)",

  "function buyPaused() view returns (bool)",

  "function sponsorOf(address user) view returns (address)",

  "function sponsorLocked(address user) view returns (bool)",

  "function hasPurchased(address user) view returns (bool)",

  "function totalPurchasedUSDT(address user) view returns (uint256)",

  "function totalReferralReceivedUSDT(address user) view returns (uint256)",

  "function purchaseCountOf(address user) view returns (uint256)",

  "function totalSalesUSDT() view returns (uint256)",

  "function totalReferralPaidUSDT() view returns (uint256)",

  "function totalOwnerReceivedUSDT() view returns (uint256)",

  "function totalPurchases() view returns (uint256)",

  "function totalUniqueBuyers() view returns (uint256)",

  "function coreUSDTBalance() view returns (uint256)",

  "function referralAmountForPackage(uint256 packageId) view returns (uint256 referralUSDT, uint256 ownerUSDT)",

  "function calculateRewardNC(uint256 principalNC, uint16 dailyRewardBps, uint64 lockSeconds) pure returns (uint256)",

  "function buyPackage(uint256 packageId, address sponsorInput) returns (uint256 stakeId)",

  "function setOwnerWallet(address newOwnerWallet)",

  "function setContracts(address newPackageContract, address newStakingContract)",

  "function setReferralBps(uint16 newReferralBps)",

  "function setDefaultSponsor(address newDefaultSponsor)",

  "function setBuyPaused(bool paused_)",

  "function emergencyWithdrawToken(address token, address to, uint256 amount)",

  "function transferOwnership(address newOwner)"
];


/* =========================================================
   EXPORT
========================================================= */

window.NC_WHALE_ABI = Object.freeze({
  ERC20: ERC20_ABI,
  PACKAGE: PACKAGE_ABI,
  STAKING: STAKING_ABI,
  CORE: CORE_ABI
});
