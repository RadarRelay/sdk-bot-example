# DEPRECATED - Please use [0x Connect](https://0x.org/docs/connect#introduction)
---

## SDK Bot Example

This repository contains the Radar Relay Bot example used in the [Building a Bot](https://developers.radarrelay.com/bot-tutorial) tutorial.

<img width="972" alt="bot_screenshot" src="https://user-images.githubusercontent.com/20102664/41553318-9f234f34-72ee-11e8-934a-041284e1d1e6.png">

## Setup

1. `npm install`

2. `export RADAR_WALLET_PASSWORD=yourpassword`

3. Run: `npm start` 

  The first time you run the bot it will output the wallet address and wait to receive Kovan ETH.
  Enter the address into a [Kovan Faucet](https://faucet.kovan.network/) to obtain Kovan ETH.

4. Once the ETH is received the bot will:
   1. Set WETH token allowance
   2. Wrap ETH
   3. Subscribe to the ZRX/WETH book websocket
   4. Place a ZRX/WETH limit order
