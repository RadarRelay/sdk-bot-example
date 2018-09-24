import {SdkManager, EventName} from '@radarrelay/sdk';
import {WebsocketRequestTopic, UserOrderType} from '@radarrelay/types';
import colors = require('colors/safe');
import request = require('request-promise');
import BigNumber from 'bignumber.js';

// CONFIG
const WALLET_PASSWORD = process.env.RADAR_WALLET_PASSWORD; // NOTE: export RADAR_WALLET_PASSWORD=thewalletspassword
const API_ENDPOINT = 'https://api.radarrelay.com/v2';
const WS_ENDPOINT = 'wss://ws.radarrelay.com/v2';
const KOVAN_RPC = 'https://kovan.infura.io/radar';

(async () => {

  // Instantiate the SDK
  // -------------------
  console.log('Radar Relay Bot Powering Up 📡');
  console.log('------------------------------');

  if(!WALLET_PASSWORD) {
    console.log(colors.red('password required: ') + colors.yellow('please run `export RADAR_WALLET_PASSWORD=yourpassword`'));
    process.exit();
  }

  // Handle errors
  process.on('unhandledRejection', (reason, p) => {
    const message = reason.message ? reason.message.split('\n')[0] : reason;
    console.log(colors.red(message));
    process.exit(0);
  });

  // Setup SDK
  // ---------
  const rr = SdkManager.Setup({
    wallet: {
      password: WALLET_PASSWORD
    },
    dataRpcUrl: KOVAN_RPC,
    radarRestEndpoint: API_ENDPOINT,
    radarWebsocketEndpoint: WS_ENDPOINT
  });

  // Listen to loading progress
  rr.events.on(EventName.Loading, data => {
    process.stdout.write('....');
    if (data.progress === 100) {
      process.stdout.write('🚀');
    }
  });

  // Init wallet
  await SdkManager.InitializeAsync(rr);

  // Get token rates
  // ---------------
  const ethTicker = JSON.parse(await request.get('https://api.coinmarketcap.com/v1/ticker/ethereum/'));
  const zrxTicker = JSON.parse(await request.get('https://api.coinmarketcap.com/v1/ticker/0x/'));
  const ethPrice = ethTicker[0]['price_usd'];
  const zrxPrice = zrxTicker[0]['price_usd'];
  const zrxEthRate = parseFloat(zrxPrice) / parseFloat(ethPrice);

  // Get balances
  // ------------
  const zrxEthMarket = await rr.markets.getAsync('ZRX-WETH');
  let curEthBal = await rr.account.getEthBalanceAsync();
  const curWethBal = await rr.account.getTokenBalanceAsync(zrxEthMarket.quoteTokenAddress);
  const curZrxBal  = await rr.account.getTokenBalanceAsync(zrxEthMarket.baseTokenAddress);

  // Output data
  // -----------
  console.log("\n\n"+'Current Exchange Rates:');
  console.log('-----------------------');
  console.log(colors.green(`ETH/USD: ${ethPrice}`));
  console.log(colors.green(`ZRX/ETH: ${zrxEthRate}`));
  console.log("\n"+'Balances:', rr.account.address);
  console.log('----------------------------------------------------');
  console.log(colors.green(`ETH: ${curEthBal.toNumber()}`));
  console.log(colors.green(`WETH: ${curWethBal.toNumber()}`));
  console.log(colors.green(`ZRX: ${curZrxBal.toNumber()}`));

  if (curEthBal.lte(0)) {
    console.log("\n" + colors.yellow(`Visit https://faucet.kovan.radarrelay.com and enter your address: ${rr.account.address}`));
    process.stdout.write('Waiting for ETH...');
    while(curEthBal.lte(0)) {
      curEthBal = await rr.account.getEthBalanceAsync();
      process.stdout.write('...');
      await new Promise(resolve => {setTimeout(resolve, 3000)});
    }
    console.log(colors.green(`${curEthBal.toNumber()} ETH received!`));
  }

  // Setup Wallet
  // ------------
  console.log("\n"+'Setting Up Wallet:');
  console.log('------------------');

  // Set WETH Allowance
  // ------------------
  const wethAllowance = await rr.account.getTokenAllowanceAsync(zrxEthMarket.quoteTokenAddress);
  if (wethAllowance.lte(0)) {
    console.log('Setting WETH allowance...');
    const receipt = await rr.account.setUnlimitedTokenAllowanceAsync(zrxEthMarket.quoteTokenAddress, {
      transactionOpts: { gasPrice: new BigNumber(1) },
      awaitTransactionMined: true
    });
    console.log(colors.green(`tx: ${(receipt as any).transactionHash}`));
  }

  // Wrap ETH
  // --------
  if (curWethBal.lt(0.01)) {
    console.log('Wrapping 0.01 ETH...');
    const receipt = await rr.account.wrapEthAsync(new BigNumber('0.01'), {
      transactionOpts: { gasPrice: new BigNumber(1) },
      awaitTransactionMined: true
    });
    console.log(colors.green(`tx: ${(receipt as any).transactionHash}`));
  }

  // Setup book subscription
  // -----------------------
  const subscription = await zrxEthMarket.subscribeAsync(WebsocketRequestTopic.BOOK, message => {
    if (message.action && message.action === 'NEW'
    && message.event.order.signedOrder.makerAddress === rr.account.address) {
      console.log('Order Placed! ' + colors.green(message.event.order.orderHash));
      console.log('Goodbye.');
      process.exit();
    }
  });

  // Create ZRX Buy Order
  // --------------------
  console.log("\n" + `Creating ZRX/WETH buy order:`);
  console.log('----------------------------');
  await zrxEthMarket.limitOrderAsync(UserOrderType.BUY,
    new BigNumber('0.1'),
    new BigNumber('0.00001'),
    new BigNumber((new Date().getTime() / 1000) + 43200).floor() // 12 hours
  );

})();
