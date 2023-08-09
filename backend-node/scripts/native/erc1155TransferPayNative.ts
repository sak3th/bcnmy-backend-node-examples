import { BiconomySmartAccount, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account"
import { Bundler } from "@biconomy/bundler"
import { BiconomyPaymaster } from "@biconomy/paymaster"
import chalk from "chalk"
import { ethers } from "ethers"
import config from "../../config.json"

const { ERC20ABI } = require('../abi.ts')

export const erc20TransferPayNative = async (
  recipientAddress: string,
  amount: number,
  tokenAddress: string
) => {
  // ------------------------STEP 1: Initialise Biconomy Smart Account SDK--------------------------------//



  // get EOA address from wallet provider
  let provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  let signer = new ethers.Wallet(config.privateKey, provider);
  const eoa = await signer.getAddress();
  console.log(chalk.blue(`EOA address: ${eoa}`));

  // create bundler and paymaster instances
  const bundler = new Bundler({
    bundlerUrl: config.bundlerUrl,
    chainId: config.chainId,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
  });

  const paymaster = new BiconomyPaymaster({
    paymasterUrl: config.biconomyPaymasterUrl
  });

  // Biconomy smart account config
  // Note that paymaster and bundler are optional. You can choose to create new instances of this later and make account API use
  const biconomySmartAccountConfig = {
    signer: signer,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    paymaster: paymaster,
    bundler: bundler,
  };

  // create biconomy smart account instance
  const biconomyAccount = new BiconomySmartAccount(biconomySmartAccountConfig);

  // passing accountIndex is optional, by default it will be 0. You may use different indexes for generating multiple counterfactual smart accounts for the same user
  const biconomySmartAccount = await biconomyAccount.init( {accountIndex: config.accountIndex} );

  const scwAddr = await biconomyAccount.getSmartAccountAddress();
  const isDeployed = await biconomyAccount.isAccountDeployed(scwAddr);
  console.log(chalk.cyan(`Deployment status: `, scwAddr, isDeployed));



  // ------------------------STEP 2: Build Partial User op from your user Transaction/s Request --------------------------------//

  // generate ERC20 transfer data
  // Encode an ERC-20 token transfer to recipient of the specified amount
  const readProvider = new ethers.providers.JsonRpcProvider(config.rpcUrl)
  const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, readProvider)
  let decimals = 18
  try {
    decimals = await tokenContract.decimals()
  } catch (error) {
    throw new Error('invalid token address supplied')
  }
  const amountGwei = ethers.utils.parseUnits(amount.toString(), decimals)
  const data = (await tokenContract.populateTransaction.transfer(recipientAddress, amountGwei)).data
  const transaction = {
    to: tokenAddress,
    data,
  };
  console.log(chalk.cyan(`Transaction : ${JSON.stringify(transaction)}`));

  // build partial userOp
  let partialUserOp = await biconomySmartAccount.buildUserOp([transaction]);
  console.log(chalk.cyan(`partialUserOp : ${JSON.stringify(partialUserOp)}`));

  let finalUserOp = partialUserOp;




  // ------------------------STEP 3: Sign the UserOp and send to the Bundler--------------------------------//

  finalUserOp.paymasterAndData = '0x'
  console.log(chalk.blue(`userOp: ${JSON.stringify(finalUserOp, null, "\t")}`));

  try {
    const userOpResponse = await biconomySmartAccount.sendUserOp(finalUserOp);
    console.log(chalk.green(`userOp Hash: ${userOpResponse.userOpHash}`));
    const transactionDetails = await userOpResponse.wait();
    console.log(
      chalk.blue(
        `transactionDetails: ${JSON.stringify(transactionDetails, null, "\t")}`
      )
    );
  } catch (e) {
    console.log("error received ", e);
  }
};
