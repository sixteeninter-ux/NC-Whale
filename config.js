"use strict";

/*
  NC Whale Stake — Configuration
  BNB Smart Chain Mainnet
*/

const CONFIG = Object.freeze({
  APP_NAME: "NC Whale Stake",

  CHAIN_ID_DECIMAL: 56,
  CHAIN_ID_HEX: "0x38",

  NETWORK_NAME: "BNB Smart Chain Mainnet",
  NATIVE_SYMBOL: "BNB",

  RPC_URLS: [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed1.ninicoin.io/"
  ],

  BLOCK_EXPLORER_URL: "https://bscscan.com",

  USDT_ADDRESS:
    "0x55d398326f99059fF775485246999027B3197955",

  NC_ADDRESS:
    "0xA0db9B043EA0387BA0f7480189F0392EdAA72108",

  PACKAGE_ADDRESS:
    "0x15D4a6837B49d75C62B3ffd31c8d0351ba051144",

  STAKING_ADDRESS:
    "0x4C98C39A5D892874F66C1Ab71D641647BDF0D4f2",

  CORE_ADDRESS:
    "0x248CEF21BD24C30AD22E29430864Fcaf11303957",

  USDT_DECIMALS: 18,
  NC_DECIMALS: 18,

  PACKAGE_ID_START: 1,
  MAX_PACKAGE_SCAN: 50,
  MAX_STAKE_SCAN: 100,

  REFRESH_INTERVAL_MS: 15000,
  COUNTDOWN_INTERVAL_MS: 1000,

  REFERRAL_QUERY_KEY: "ref"
});


function validateConfiguredAddresses() {
  const addresses = [
    CONFIG.USDT_ADDRESS,
    CONFIG.NC_ADDRESS,
    CONFIG.PACKAGE_ADDRESS,
    CONFIG.STAKING_ADDRESS,
    CONFIG.CORE_ADDRESS
  ];

  addresses.forEach(function (address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error(
        "Invalid contract address in config.js: " + address
      );
    }
  });
}


function shortAddress(
  address,
  front,
  back
) {
  const frontLength =
    typeof front === "number"
      ? front
      : 6;

  const backLength =
    typeof back === "number"
      ? back
      : 4;

  if (
    !address ||
    address.length <
      frontLength + backLength
  ) {
    return address || "-";
  }

  return (
    address.slice(0, frontLength) +
    "..." +
    address.slice(-backLength)
  );
}


function buildReferralLink(address) {
  const url =
    new URL(window.location.href);

  url.searchParams.set(
    CONFIG.REFERRAL_QUERY_KEY,
    address
  );

  return url.toString();
}


function getReferralFromUrl() {
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
    /^0x[a-fA-F0-9]{40}$/.test(
      referral
    )
  ) {
    return referral;
  }

  return "";
}


async function switchToBscNetwork(
  ethereumProvider
) {
  if (!ethereumProvider) {
    throw new Error(
      "Wallet provider not found."
    );
  }

  try {
    await ethereumProvider.request({
      method:
        "wallet_switchEthereumChain",

      params: [
        {
          chainId:
            CONFIG.CHAIN_ID_HEX
        }
      ]
    });

  } catch (error) {

    if (
      Number(error.code) !== 4902
    ) {
      throw error;
    }

    await ethereumProvider.request({
      method:
        "wallet_addEthereumChain",

      params: [
        {
          chainId:
            CONFIG.CHAIN_ID_HEX,

          chainName:
            CONFIG.NETWORK_NAME,

          nativeCurrency: {
            name:
              CONFIG.NATIVE_SYMBOL,

            symbol:
              CONFIG.NATIVE_SYMBOL,

            decimals: 18
          },

          rpcUrls:
            CONFIG.RPC_URLS,

          blockExplorerUrls: [
            CONFIG.BLOCK_EXPLORER_URL
          ]
        }
      ]
    });
  }
}


validateConfiguredAddresses();
