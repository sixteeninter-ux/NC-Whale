"use strict";

/* =========================================================
   NC WHALE STAKE — MAIN.JS
   ethers.js v5
========================================================= */

let ethereumProvider = null;
let provider = null;
let signer = null;
let account = "";

let usdtContract = null;
let ncContract = null;
let packageContract = null;
let stakingContract = null;
let coreContract = null;

let packages = [];
let selectedPackage = null;

let countdownTimer = null;
let maturityRefreshRunning = false;


/* =========================================================
   HELPERS
========================================================= */

function byId(id) {
  return document.getElementById(id);
}

function showStatus(message, type) {
  const box = byId("statusBox");

  if (!box) {
    return;
  }

  box.className = "status-box " + (type || "info");
  box.textContent = message;
}

function shortAddress(address) {
  if (!address || address.length < 12) {
    return address || "-";
  }

  return address.slice(0, 6) + "..." + address.slice(-4);
}

function zeroAddress() {
  return ethers.constants.AddressZero;
}

function isValidAddress(value) {
  try {
    return ethers.utils.isAddress(value);
  } catch (error) {
    return false;
  }
}

function formatUnits(value, decimals, digits) {
  try {
    const text = ethers.utils.formatUnits(value, decimals);
    const numberValue = Number(text);

    return numberValue.toLocaleString(undefined, {
      maximumFractionDigits: digits
    });
  } catch (error) {
    return "0";
  }
}

function formatUSDT(value) {
  return (
    formatUnits(
      value,
      CONFIG.USDT_DECIMALS,
      4
    ) + " USDT"
  );
}

function formatNC(value) {
  return (
    formatUnits(
      value,
      CONFIG.NC_DECIMALS,
      4
    ) + " NC"
  );
}

function formatBps(value) {
  return (Number(value) / 100).toFixed(2) + "%";
}

function formatDuration(seconds) {
  let total = Number(seconds);

  if (!Number.isFinite(total) || total <= 0) {
    return "0 seconds";
  }

  const days = Math.floor(total / 86400);

  if (days > 0 && total % 86400 === 0) {
    return (
      days +
      " day" +
      (days === 1 ? "" : "s")
    );
  }

  const hours = Math.floor(total / 3600);

  if (hours > 0 && total % 3600 === 0) {
    return (
      hours +
      " hour" +
      (hours === 1 ? "" : "s")
    );
  }

  const minutes = Math.floor(total / 60);

  if (minutes > 0 && total % 60 === 0) {
    return (
      minutes +
      " minute" +
      (minutes === 1 ? "" : "s")
    );
  }

  return (
    total +
    " second" +
    (total === 1 ? "" : "s")
  );
}

function formatCountdown(seconds) {
  let total = Math.max(
    0,
    Math.floor(Number(seconds))
  );

  if (total <= 0) {
    return "Matured";
  }

  const days = Math.floor(total / 86400);
  total %= 86400;

  const hours = Math.floor(total / 3600);
  total %= 3600;

  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  if (days > 0) {
    return (
      days +
      "d " +
      hours +
      "h " +
      minutes +
      "m " +
      secs +
      "s"
    );
  }

  if (hours > 0) {
    return (
      hours +
      "h " +
      minutes +
      "m " +
      secs +
      "s"
    );
  }

  return minutes + "m " + secs + "s";
}

function formatDate(timestamp) {
  const value = Number(timestamp);

  if (!value) {
    return "-";
  }

  return new Date(
    value * 1000
  ).toLocaleString();
}

function getErrorMessage(error) {
  console.error(error);

  if (error && error.reason) {
    return error.reason;
  }

  if (
    error &&
    error.error &&
    error.error.message
  ) {
    return error.error.message;
  }

  if (
    error &&
    error.data &&
    error.data.message
  ) {
    return error.data.message;
  }

  if (error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   WALLET PROVIDER
========================================================= */

function getWalletProvider() {
  if (!window.ethereum) {
    return null;
  }

  if (
    Array.isArray(window.ethereum.providers) &&
    window.ethereum.providers.length > 0
  ) {
    const metamask =
      window.ethereum.providers.find(
        function (item) {
          return item.isMetaMask;
        }
      );

    if (metamask) {
      return metamask;
    }

    const bitget =
      window.ethereum.providers.find(
        function (item) {
          return item.isBitKeep || item.isBitget;
        }
      );

    if (bitget) {
      return bitget;
    }

    return window.ethereum.providers[0];
  }

  return window.ethereum;
}

async function ensureBSC() {
  const chainId =
    await ethereumProvider.request({
      method: "eth_chainId"
    });

  if (
    String(chainId).toLowerCase() ===
    String(
      CONFIG.CHAIN_ID_HEX
    ).toLowerCase()
  ) {
    return;
  }

  try {
    await ethereumProvider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: CONFIG.CHAIN_ID_HEX
        }
      ]
    });
  } catch (error) {
    if (Number(error.code) !== 4902) {
      throw error;
    }

    await ethereumProvider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CONFIG.CHAIN_ID_HEX,
          chainName: CONFIG.NETWORK_NAME,

          nativeCurrency: {
            name: "BNB",
            symbol: "BNB",
            decimals: 18
          },

          rpcUrls: CONFIG.RPC_URLS,

          blockExplorerUrls: [
            CONFIG.BLOCK_EXPLORER_URL
          ]
        }
      ]
    });
  }
}


/* =========================================================
   CONTRACTS
========================================================= */

function createContracts() {
  const ABI = window.NC_WHALE_ABI;

  if (!ABI) {
    throw new Error(
      "ABI not loaded. Check that abi.js exists and is loaded before main.js."
    );
  }

  usdtContract = new ethers.Contract(
    CONFIG.USDT_ADDRESS,
    ABI.ERC20,
    signer
  );

  ncContract = new ethers.Contract(
    CONFIG.NC_ADDRESS,
    ABI.ERC20,
    signer
  );

  packageContract = new ethers.Contract(
    CONFIG.PACKAGE_ADDRESS,
    ABI.PACKAGE,
    signer
  );

  stakingContract = new ethers.Contract(
    CONFIG.STAKING_ADDRESS,
    ABI.STAKING,
    signer
  );

  coreContract = new ethers.Contract(
    CONFIG.CORE_ADDRESS,
    ABI.CORE,
    signer
  );
}


/* =========================================================
   CONNECT
========================================================= */

async function connectWallet() {
  try {
    ethereumProvider = getWalletProvider();

    if (!ethereumProvider) {
      throw new Error(
        "MetaMask or Bitget Wallet not found."
      );
    }

    showStatus(
      "Connecting wallet...",
      "info"
    );

    await ensureBSC();

    provider =
      new ethers.providers.Web3Provider(
        ethereumProvider,
        "any"
      );

    await provider.send(
      "eth_requestAccounts",
      []
    );

    signer = provider.getSigner();
    account = await signer.getAddress();

    createContracts();

    const walletAddressBtn =
      byId("walletAddressBtn");

    if (walletAddressBtn) {
      walletAddressBtn.textContent =
        shortAddress(account);
    }

    const connectBtn = byId("connectBtn");

    if (connectBtn) {
      connectBtn.textContent = "Connected";
    }

    const copyReferralBtn =
      byId("copyReferralBtn");

    if (copyReferralBtn) {
      copyReferralBtn.disabled = false;
    }

    makeReferralLink();

    await loadEverything();

    showStatus(
      "Wallet connected successfully.",
      "success"
    );

    startCountdown();

  } catch (error) {
    showStatus(
      "Connect failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   REFERRAL
========================================================= */

function makeReferralLink() {
  if (!account) {
    return;
  }

  const input = byId("referralLinkInput");

  if (!input) {
    return;
  }

  const url = new URL(
    window.location.href
  );

  url.searchParams.set(
    CONFIG.REFERRAL_QUERY_KEY,
    account
  );

  input.value = url.toString();
}

function loadReferralFromUrl() {
  const sponsorInput =
    byId("sponsorInput");

  if (!sponsorInput) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const referral =
    params.get(
      CONFIG.REFERRAL_QUERY_KEY
    );

  if (
    referral &&
    isValidAddress(referral)
  ) {
    sponsorInput.value = referral;
  }
}

async function copyReferralLink() {
  const input =
    byId("referralLinkInput");

  const value = input
    ? input.value
    : "";

  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(
      value
    );

    showStatus(
      "Referral link copied.",
      "success"
    );
  } catch (error) {
    showStatus(
      "Copy failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadEverything() {
  if (!account) {
    return;
  }

  try {
    await loadWalletOverview();
    await loadReferralData();
    await loadPackages();
    await loadStakes();
    await updateAllowance();

  } catch (error) {
    showStatus(
      "Load failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   WALLET OVERVIEW
========================================================= */

async function loadWalletOverview() {
  const values = await Promise.all([
    usdtContract.balanceOf(account),
    ncContract.balanceOf(account),
    coreContract.totalPurchasedUSDT(
      account
    ),
    coreContract.totalReferralReceivedUSDT(
      account
    ),
    coreContract.purchaseCountOf(account),
    stakingContract.stakesCount(account)
  ]);

  if (byId("walletUsdt")) {
    byId("walletUsdt").textContent =
      formatUSDT(values[0]);
  }

  if (byId("walletNc")) {
    byId("walletNc").textContent =
      formatNC(values[1]);
  }

  if (byId("totalPurchased")) {
    byId("totalPurchased").textContent =
      formatUSDT(values[2]);
  }

  if (byId("referralReceived")) {
    byId(
      "referralReceived"
    ).textContent =
      formatUSDT(values[3]);
  }

  if (byId("purchaseCount")) {
    byId("purchaseCount").textContent =
      values[4].toString();
  }

  if (byId("stakeCount")) {
    byId("stakeCount").textContent =
      values[5].toString();
  }
}


/* =========================================================
   REFERRAL DATA
========================================================= */

async function loadReferralData() {
  const values = await Promise.all([
    coreContract.referralBps(),
    coreContract.sponsorLocked(account),
    coreContract.sponsorOf(account)
  ]);

  const bps = values[0];
  const locked = values[1];
  const sponsor = values[2];

  if (byId("referralPercentBadge")) {
    byId(
      "referralPercentBadge"
    ).textContent =
      formatBps(bps);
  }

  const sponsorInput =
    byId("sponsorInput");

  if (
    locked &&
    sponsor !== zeroAddress()
  ) {
    if (byId("sponsorStatus")) {
      byId("sponsorStatus").textContent =
        "Locked";
    }

    if (byId("lockedSponsor")) {
      byId("lockedSponsor").textContent =
        shortAddress(sponsor);
    }

    if (sponsorInput) {
      sponsorInput.value = sponsor;
      sponsorInput.disabled = true;
    }

  } else {
    if (byId("sponsorStatus")) {
      byId("sponsorStatus").textContent =
        "Unlocked";
    }

    if (byId("lockedSponsor")) {
      byId("lockedSponsor").textContent =
        "Not registered";
    }

    if (sponsorInput) {
      sponsorInput.disabled = false;
    }

    loadReferralFromUrl();
  }
}


/* =========================================================
   PACKAGES
   USER SHOWS ACTIVE PACKAGES ONLY
========================================================= */

async function loadPackages() {
  const list = byId("packageList");

  if (!list) {
    return;
  }

  const countRaw =
    await packageContract.packageCount();

  const count = Math.min(
    Number(countRaw),
    CONFIG.MAX_PACKAGE_SCAN
  );

  packages = [];
  list.innerHTML = "";

  let activePackageCount = 0;

  if (count === 0) {
    list.innerHTML =
      '<div class="loading-card">' +
      "No package has been created yet." +
      "</div>";

    clearSelectedPackage();
    return;
  }

  for (
    let packageId = 1;
    packageId <= count;
    packageId++
  ) {
    try {
      const values = await Promise.all([
        packageContract.getPackage(
          packageId
        ),
        packageContract.packageRewardNC(
          packageId
        ),
        packageContract.packageTotalNC(
          packageId
        )
      ]);

      const packageData = values[0];
      const rewardNC = values[1];
      const totalData = values[2];

      const active =
        Boolean(packageData[5]);

      /*
        หน้า User ไม่แสดง Package
        ที่ Owner ปิดการใช้งาน
      */
      if (!active) {
        continue;
      }

      let referralUSDT =
        ethers.BigNumber.from(0);

      let ownerUSDT =
        ethers.BigNumber.from(0);

      try {
        const referralData =
          await coreContract
            .referralAmountForPackage(
              packageId
            );

        referralUSDT = referralData[0];
        ownerUSDT = referralData[1];

      } catch (error) {
        console.warn(
          "Referral amount unavailable for package",
          packageId,
          error
        );
      }

      const item = {
        id: packageId,
        name: packageData[0],
        priceUSDT: packageData[1],
        principalNC: packageData[2],
        dailyRewardBps: packageData[3],
        lockSeconds: packageData[4],
        active: active,
        rewardNC: rewardNC,
        totalNC: totalData[2],
        referralUSDT: referralUSDT,
        ownerUSDT: ownerUSDT
      };

      packages.push(item);

      list.appendChild(
        makePackageCard(item)
      );

      activePackageCount++;

    } catch (error) {
      console.error(
        "Package load failed:",
        packageId,
        error
      );
    }
  }

  if (activePackageCount === 0) {
    list.innerHTML =
      '<div class="loading-card">' +
      "No active package is currently available." +
      "</div>";

    clearSelectedPackage();
    return;
  }

  /*
    ถ้า Package ที่เลือกไว้ถูกปิด
    ให้ล้าง Selected Package
  */
  if (selectedPackage) {
    const stillActive =
      packages.some(function (item) {
        return (
          item.id === selectedPackage.id
        );
      });

    if (!stillActive) {
      clearSelectedPackage();
    }
  }
}

function makePackageCard(item) {
  const card =
    document.createElement("article");

  card.className = "package-card";

  card.setAttribute(
    "data-package-id",
    String(item.id)
  );

  card.innerHTML =
    '<div class="package-head">' +

      '<h3 class="package-name">' +
        escapeHtml(item.name) +
      "</h3>" +

      '<span class="package-id">#' +
        item.id +
      "</span>" +

    "</div>" +

    '<div class="package-price">' +

      formatUnits(
        item.priceUSDT,
        CONFIG.USDT_DECIMALS,
        4
      ) +

      " <small>USDT</small>" +

    "</div>" +

    '<div class="package-details">' +

      '<div class="package-detail-row">' +
        "<span>NC Principal</span>" +
        "<strong>" +
          formatNC(item.principalNC) +
        "</strong>" +
      "</div>" +

      '<div class="package-detail-row">' +
        "<span>Daily Reward</span>" +
        "<strong>" +
          formatBps(
            item.dailyRewardBps
          ) +
        "</strong>" +
      "</div>" +

      '<div class="package-detail-row">' +
        "<span>Stake Duration</span>" +
        "<strong>" +
          formatDuration(
            item.lockSeconds
          ) +
        "</strong>" +
      "</div>" +

      '<div class="package-detail-row">' +
        "<span>Total Reward</span>" +
        "<strong>" +
          formatNC(item.rewardNC) +
        "</strong>" +
      "</div>" +

      '<div class="package-detail-row">' +
        "<span>Total at Maturity</span>" +
        "<strong>" +
          formatNC(item.totalNC) +
        "</strong>" +
      "</div>" +

    "</div>" +

    '<button class="btn btn-cyan" ' +
      'type="button">' +
      "Select Package" +
    "</button>";

  const button =
    card.querySelector("button");

  if (button) {
    button.addEventListener(
      "click",
      function () {
        selectPackage(item.id);
      }
    );
  }

  return card;
}

function selectPackage(packageId) {
  const item = packages.find(
    function (entry) {
      return (
        entry.id ===
        Number(packageId)
      );
    }
  );

  if (!item || !item.active) {
    return;
  }

  selectedPackage = item;

  document
    .querySelectorAll(".package-card")
    .forEach(function (card) {
      const currentId = Number(
        card.getAttribute(
          "data-package-id"
        )
      );

      card.classList.toggle(
        "selected",
        currentId === item.id
      );
    });

  if (byId("selectedPackageName")) {
    byId(
      "selectedPackageName"
    ).textContent =
      item.name;
  }

  if (byId("selectedPackageId")) {
    byId(
      "selectedPackageId"
    ).textContent =
      String(item.id);
  }

  if (byId("selectedPackagePrice")) {
    byId(
      "selectedPackagePrice"
    ).textContent =
      formatUSDT(item.priceUSDT);
  }

  if (byId("selectedPrincipalNc")) {
    byId(
      "selectedPrincipalNc"
    ).textContent =
      formatNC(item.principalNC);
  }

  if (byId("selectedDailyReward")) {
    byId(
      "selectedDailyReward"
    ).textContent =
      formatBps(
        item.dailyRewardBps
      );
  }

  if (byId("selectedLockTime")) {
    byId(
      "selectedLockTime"
    ).textContent =
      formatDuration(
        item.lockSeconds
      );
  }

  if (byId("selectedRewardNc")) {
    byId(
      "selectedRewardNc"
    ).textContent =
      formatNC(item.rewardNC);
  }

  if (byId("selectedTotalNc")) {
    byId(
      "selectedTotalNc"
    ).textContent =
      formatNC(item.totalNC);
  }

  if (byId("selectedReferralUsdt")) {
    byId(
      "selectedReferralUsdt"
    ).textContent =
      formatUSDT(
        item.referralUSDT
      );
  }

  if (byId("selectedOwnerUsdt")) {
    byId(
      "selectedOwnerUsdt"
    ).textContent =
      formatUSDT(
        item.ownerUSDT
      );
  }

  updateAllowance();
}

function clearSelectedPackage() {
  selectedPackage = null;

  document
    .querySelectorAll(".package-card")
    .forEach(function (card) {
      card.classList.remove("selected");
    });

  if (byId("selectedPackageName")) {
    byId(
      "selectedPackageName"
    ).textContent =
      "None";
  }

  if (byId("selectedPackageId")) {
    byId(
      "selectedPackageId"
    ).textContent =
      "-";
  }

  if (byId("selectedPackagePrice")) {
    byId(
      "selectedPackagePrice"
    ).textContent =
      "0 USDT";
  }

  if (byId("selectedPrincipalNc")) {
    byId(
      "selectedPrincipalNc"
    ).textContent =
      "0 NC";
  }

  if (byId("selectedDailyReward")) {
    byId(
      "selectedDailyReward"
    ).textContent =
      "0%";
  }

  if (byId("selectedLockTime")) {
    byId(
      "selectedLockTime"
    ).textContent =
      "0";
  }

  if (byId("selectedRewardNc")) {
    byId(
      "selectedRewardNc"
    ).textContent =
      "0 NC";
  }

  if (byId("selectedTotalNc")) {
    byId(
      "selectedTotalNc"
    ).textContent =
      "0 NC";
  }

  if (byId("selectedReferralUsdt")) {
    byId(
      "selectedReferralUsdt"
    ).textContent =
      "0 USDT";
  }

  if (byId("selectedOwnerUsdt")) {
    byId(
      "selectedOwnerUsdt"
    ).textContent =
      "0 USDT";
  }

  if (byId("approveBtn")) {
    byId("approveBtn").disabled = true;
  }

  if (byId("buyBtn")) {
    byId("buyBtn").disabled = true;
  }
}


/* =========================================================
   ALLOWANCE / APPROVE
========================================================= */

async function updateAllowance() {
  if (
    !account ||
    !usdtContract
  ) {
    return;
  }

  const allowance =
    await usdtContract.allowance(
      account,
      CONFIG.CORE_ADDRESS
    );

  if (byId("usdtAllowance")) {
    byId(
      "usdtAllowance"
    ).textContent =
      formatUSDT(allowance);
  }

  if (!selectedPackage) {
    if (byId("approveBtn")) {
      byId("approveBtn").disabled = true;
    }

    if (byId("buyBtn")) {
      byId("buyBtn").disabled = true;
    }

    return;
  }

  const enough =
    allowance.gte(
      selectedPackage.priceUSDT
    );

  if (byId("approveBtn")) {
    byId("approveBtn").disabled = enough;
  }

  if (byId("buyBtn")) {
    byId("buyBtn").disabled = !enough;
  }
}

async function approveUSDT() {
  try {
    if (!selectedPackage) {
      throw new Error(
        "Select a package first."
      );
    }

    showStatus(
      "Please confirm USDT approval in your wallet.",
      "info"
    );

    const tx =
      await usdtContract.approve(
        CONFIG.CORE_ADDRESS,
        selectedPackage.priceUSDT
      );

    showStatus(
      "USDT approval submitted. Waiting for confirmation...",
      "info"
    );

    await tx.wait();

    await updateAllowance();

    showStatus(
      "USDT approval successful.",
      "success"
    );

  } catch (error) {
    showStatus(
      "Approval failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   BUY
========================================================= */

async function buyPackage() {
  try {
    if (!selectedPackage) {
      throw new Error(
        "Select a package first."
      );
    }

    /*
      ตรวจ Package จาก Contract อีกครั้ง
      ก่อนส่งธุรกรรม
    */
    const currentPackage =
      await packageContract.getPackage(
        selectedPackage.id
      );

    const currentActive =
      Boolean(currentPackage[5]);

    if (!currentActive) {
      clearSelectedPackage();

      await loadPackages();

      throw new Error(
        "This package is no longer active."
      );
    }

    const paused =
      await coreContract.buyPaused();

    if (paused) {
      throw new Error(
        "Buying is paused."
      );
    }

    let sponsor = "";

    const sponsorInput =
      byId("sponsorInput");

    if (sponsorInput) {
      sponsor =
        sponsorInput.value.trim();
    }

    const locked =
      await coreContract.sponsorLocked(
        account
      );

    if (locked) {
      sponsor =
        await coreContract.sponsorOf(
          account
        );

    } else if (
      !sponsor ||
      !isValidAddress(sponsor) ||
      sponsor.toLowerCase() ===
        account.toLowerCase()
    ) {
      sponsor = zeroAddress();
    }

    const allowance =
      await usdtContract.allowance(
        account,
        CONFIG.CORE_ADDRESS
      );

    if (
      allowance.lt(
        selectedPackage.priceUSDT
      )
    ) {
      throw new Error(
        "Approve USDT first."
      );
    }

    showStatus(
      "Please confirm package purchase in your wallet.",
      "info"
    );

    const tx =
      await coreContract.buyPackage(
        selectedPackage.id,
        sponsor
      );

    showStatus(
      "Purchase submitted. Waiting for confirmation...",
      "info"
    );

    await tx.wait();

    showStatus(
      "Package purchased and auto stake created.",
      "success"
    );

    await loadEverything();

  } catch (error) {
    showStatus(
      "Purchase failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   STAKES
========================================================= */

async function loadStakes() {
  if (
    !account ||
    !stakingContract
  ) {
    return;
  }

  const list = byId("stakeList");

  if (!list) {
    return;
  }

  const values = await Promise.all([
    stakingContract.stakesCount(account),
    stakingContract.userTotalClaimedNC(
      account
    ),
    ncContract.balanceOf(
      CONFIG.STAKING_ADDRESS
    )
  ]);

  const count = Math.min(
    Number(values[0]),
    CONFIG.MAX_STAKE_SCAN
  );

  let activePrincipal =
    ethers.BigNumber.from(0);

  let pendingReward =
    ethers.BigNumber.from(0);

  let maturedTotal =
    ethers.BigNumber.from(0);

  let nearestEnd = 0;

  list.innerHTML = "";

  if (count === 0) {
    list.innerHTML =
      '<div class="loading-card">' +
      "No staking positions found." +
      "</div>";
  }

  for (
    let stakeId = 0;
    stakeId < count;
    stakeId++
  ) {
    try {
      const stake =
        await stakingContract.getStake(
          account,
          stakeId
        );

      const item = {
        stakeId: stakeId,
        packageId: stake[0],
        principalNC: stake[1],
        rewardNC: stake[2],
        startTime: Number(stake[3]),
        endTime: Number(stake[4]),
        claimed: Boolean(stake[5])
      };

      let matured = false;

      if (!item.claimed) {
        try {
          /*
            ใช้สถานะจาก Blockchain
            เป็นหลัก
          */
          matured =
            await stakingContract.matured(
              account,
              stakeId
            );

        } catch (error) {
          /*
            สำรองด้วยเวลาจากเครื่อง
            หาก RPC อ่าน matured ไม่สำเร็จ
          */
          const now =
            Math.floor(
              Date.now() / 1000
            );

          matured =
            now >= item.endTime;
        }
      }

      if (!item.claimed) {
        activePrincipal =
          activePrincipal.add(
            item.principalNC
          );

        pendingReward =
          pendingReward.add(
            item.rewardNC
          );

        if (matured) {
          maturedTotal =
            maturedTotal
              .add(item.principalNC)
              .add(item.rewardNC);

        } else if (
          nearestEnd === 0 ||
          item.endTime < nearestEnd
        ) {
          nearestEnd = item.endTime;
        }
      }

      list.appendChild(
        makeStakeCard(
          item,
          Boolean(matured)
        )
      );

    } catch (error) {
      console.error(
        "Stake load failed:",
        stakeId,
        error
      );
    }
  }

  if (byId("activePrincipalNc")) {
    byId(
      "activePrincipalNc"
    ).textContent =
      formatNC(activePrincipal);
  }

  if (byId("pendingRewardNc")) {
    byId(
      "pendingRewardNc"
    ).textContent =
      formatNC(pendingReward);
  }

  if (byId("maturedTotalNc")) {
    byId(
      "maturedTotalNc"
    ).textContent =
      formatNC(maturedTotal);
  }

  if (byId("claimedTotalNc")) {
    byId(
      "claimedTotalNc"
    ).textContent =
      formatNC(values[1]);
  }

  if (byId("stakingNcBalance")) {
    byId(
      "stakingNcBalance"
    ).textContent =
      formatNC(values[2]);
  }

  const nextUnlock =
    byId("nextUnlockCountdown");

  if (nextUnlock) {
    nextUnlock.setAttribute(
      "data-end-time",
      nearestEnd
        ? String(nearestEnd)
        : ""
    );
  }

  updateCountdowns();
}

function makeStakeCard(
  item,
  matured
) {
  const card =
    document.createElement("article");

  const status = item.claimed
    ? "claimed"
    : matured
      ? "matured"
      : "active";

  const total =
    item.principalNC.add(
      item.rewardNC
    );

  card.className =
    "stake-card " + status;

  card.setAttribute(
    "data-stake-id",
    String(item.stakeId)
  );

  card.innerHTML =
    '<div class="stake-card-header">' +

      "<h3>Stake #" +
        item.stakeId +
      "</h3>" +

      '<span class="stake-status ' +
        status +
      '">' +

        (
          item.claimed
            ? "Claimed"
            : matured
              ? "Matured"
              : "Active"
        ) +

      "</span>" +

    "</div>" +

    '<div class="stake-detail-grid">' +

      '<div class="stake-detail-item">' +
        "<span>Package ID</span>" +
        "<strong>#" +
          item.packageId.toString() +
        "</strong>" +
      "</div>" +

      '<div class="stake-detail-item">' +
        "<span>Principal</span>" +
        "<strong>" +
          formatNC(item.principalNC) +
        "</strong>" +
      "</div>" +

      '<div class="stake-detail-item">' +
        "<span>Reward</span>" +
        "<strong>" +
          formatNC(item.rewardNC) +
        "</strong>" +
      "</div>" +

      '<div class="stake-detail-item">' +
        "<span>Total Claim</span>" +
        "<strong>" +
          formatNC(total) +
        "</strong>" +
      "</div>" +

      '<div class="stake-detail-item">' +
        "<span>Start</span>" +
        "<strong>" +
          formatDate(item.startTime) +
        "</strong>" +
      "</div>" +

      '<div class="stake-detail-item">' +
        "<span>End</span>" +
        "<strong>" +
          formatDate(item.endTime) +
        "</strong>" +
      "</div>" +

      '<div class="stake-detail-item">' +
        "<span>Countdown</span>" +

        '<strong class="stake-countdown" ' +
          'data-end-time="' +
            item.endTime +
          '" ' +

          'data-claimed="' +
            item.claimed +
          '">' +

          (
            item.claimed
              ? "-"
              : formatCountdown(
                  item.endTime -
                  Math.floor(
                    Date.now() / 1000
                  )
                )
          ) +

        "</strong>" +
      "</div>" +

    "</div>" +

    '<div class="stake-card-actions">' +

      '<button class="btn ' +

        (
          matured && !item.claimed
            ? "btn-cyan"
            : "btn-dark"
        ) +

        '" type="button" ' +

        (
          matured && !item.claimed
            ? ""
            : "disabled"
        ) +

      ">" +

        (
          item.claimed
            ? "Already Claimed"
            : matured
              ? "Claim Principal + Reward"
              : "Not Matured"
        ) +

      "</button>" +

    "</div>";

  const button =
    card.querySelector("button");

  if (
    button &&
    matured &&
    !item.claimed
  ) {
    button.addEventListener(
      "click",
      function () {
        claimStake(item.stakeId);
      }
    );
  }

  return card;
}

async function claimStake(stakeId) {
  try {
    if (
      !account ||
      !stakingContract
    ) {
      throw new Error(
        "Connect wallet first."
      );
    }

    const claimPaused =
      await stakingContract.claimPaused();

    if (claimPaused) {
      throw new Error(
        "Claiming is currently paused."
      );
    }

    const matured =
      await stakingContract.matured(
        account,
        stakeId
      );

    if (!matured) {
      await loadStakes();

      throw new Error(
        "Stake is not matured."
      );
    }

    showStatus(
      "Please confirm claim in your wallet.",
      "info"
    );

    const tx =
      await stakingContract.claim(
        stakeId
      );

    showStatus(
      "Claim submitted. Waiting for confirmation...",
      "info"
    );

    await tx.wait();

    showStatus(
      "Claim successful. Principal and reward were sent to your wallet.",
      "success"
    );

    await loadEverything();

  } catch (error) {
    showStatus(
      "Claim failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   COUNTDOWN
========================================================= */

async function updateCountdowns() {
  const now =
    Math.floor(Date.now() / 1000);

  let needsStakeRefresh = false;

  document
    .querySelectorAll(
      ".stake-countdown"
    )
    .forEach(function (item) {
      const claimed =
        item.getAttribute(
          "data-claimed"
        ) === "true";

      if (claimed) {
        item.textContent = "-";
        return;
      }

      const endTime = Number(
        item.getAttribute(
          "data-end-time"
        )
      );

      const remaining =
        endTime - now;

      item.textContent =
        formatCountdown(remaining);

      /*
        Countdown ครบแล้ว
        แต่ปุ่มยังเป็น disabled
        จึงต้องโหลด Stake Card ใหม่
      */
      if (remaining <= 0) {
        const card =
          item.closest(
            ".stake-card"
          );

        const button = card
          ? card.querySelector(
              ".stake-card-actions button"
            )
          : null;

        if (
          button &&
          button.disabled
        ) {
          needsStakeRefresh = true;
        }
      }
    });

  const next =
    byId("nextUnlockCountdown");

  if (next) {
    const endTime = Number(
      next.getAttribute(
        "data-end-time"
      )
    );

    next.textContent = endTime
      ? formatCountdown(
          endTime - now
        )
      : "-";
  }

  /*
    รีเฟรชอัตโนมัติเมื่อ Stake
    เพิ่งครบกำหนด
  */
  if (
    needsStakeRefresh &&
    !maturityRefreshRunning &&
    account &&
    stakingContract
  ) {
    maturityRefreshRunning = true;

    try {
      await loadStakes();

    } catch (error) {
      console.error(
        "Automatic maturity refresh failed:",
        error
      );

    } finally {
      maturityRefreshRunning = false;
    }
  }
}

function startCountdown() {
  if (countdownTimer) {
    clearInterval(
      countdownTimer
    );
  }

  countdownTimer = setInterval(
    function () {
      updateCountdowns();
    },
    CONFIG.COUNTDOWN_INTERVAL_MS
  );
}


/* =========================================================
   CONTRACT ADDRESS COPY
========================================================= */

async function copyContract(type) {
  const map = {
    package:
      CONFIG.PACKAGE_ADDRESS,

    staking:
      CONFIG.STAKING_ADDRESS,

    core:
      CONFIG.CORE_ADDRESS,

    nc:
      CONFIG.NC_ADDRESS
  };

  if (!map[type]) {
    return;
  }

  try {
    await navigator.clipboard.writeText(
      map[type]
    );

    showStatus(
      type + " address copied.",
      "success"
    );

  } catch (error) {
    showStatus(
      "Copy failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  const connectBtn =
    byId("connectBtn");

  if (connectBtn) {
    connectBtn.addEventListener(
      "click",
      connectWallet
    );
  }

  const refreshBtn =
    byId("refreshBtn");

  if (refreshBtn) {
    refreshBtn.addEventListener(
      "click",
      loadEverything
    );
  }

  const reloadPackagesBtn =
    byId("reloadPackagesBtn");

  if (reloadPackagesBtn) {
    reloadPackagesBtn.addEventListener(
      "click",
      loadPackages
    );
  }

  const refreshStakesBtn =
    byId("refreshStakesBtn");

  if (refreshStakesBtn) {
    refreshStakesBtn.addEventListener(
      "click",
      loadStakes
    );
  }

  const copyReferralBtn =
    byId("copyReferralBtn");

  if (copyReferralBtn) {
    copyReferralBtn.addEventListener(
      "click",
      copyReferralLink
    );
  }

  const approveBtn =
    byId("approveBtn");

  if (approveBtn) {
    approveBtn.addEventListener(
      "click",
      approveUSDT
    );
  }

  const buyBtn =
    byId("buyBtn");

  if (buyBtn) {
    buyBtn.addEventListener(
      "click",
      buyPackage
    );
  }

  document
    .querySelectorAll(
      "[data-copy-contract]"
    )
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          copyContract(
            button.getAttribute(
              "data-copy-contract"
            )
          );
        }
      );
    });
}

function bindWalletEvents() {
  const wallet =
    getWalletProvider();

  if (
    !wallet ||
    !wallet.on
  ) {
    return;
  }

  wallet.on(
    "accountsChanged",
    function () {
      window.location.reload();
    }
  );

  wallet.on(
    "chainChanged",
    function () {
      window.location.reload();
    }
  );
}


/* =========================================================
   INITIALIZE PAGE
========================================================= */

function initializePage() {
  try {
    loadReferralFromUrl();
    bindEvents();
    bindWalletEvents();

    if (byId("packageContractText")) {
      byId(
        "packageContractText"
      ).textContent =
        shortAddress(
          CONFIG.PACKAGE_ADDRESS
        );
    }

    if (byId("stakingContractText")) {
      byId(
        "stakingContractText"
      ).textContent =
        shortAddress(
          CONFIG.STAKING_ADDRESS
        );
    }

    if (byId("coreContractText")) {
      byId(
        "coreContractText"
      ).textContent =
        shortAddress(
          CONFIG.CORE_ADDRESS
        );
    }

    if (byId("ncContractText")) {
      byId(
        "ncContractText"
      ).textContent =
        shortAddress(
          CONFIG.NC_ADDRESS
        );
    }

    showStatus(
      "Connect your wallet to load packages.",
      "info"
    );

  } catch (error) {
    showStatus(
      "Page initialization failed: " +
      getErrorMessage(error),
      "error"
    );
  }
}

document.addEventListener(
  "DOMContentLoaded",
  initializePage
);
