import { BiconomySmartAccount, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account"
import { Bundler } from "@biconomy/bundler"
import { BiconomyPaymaster } from "@biconomy/paymaster"
import chalk from "chalk"
import { ethers } from "ethers"
import config from "../../config.json"

const { ERC20ABI } = require('../abi.ts')

export const erc1155TransferPayNative = async (
    recipientAddress: string,
    amount: number,
    tokenAddress: string,
    tokenId: number,
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

  // generate ERC1155 transfer data
  // Encode an ERC-1155 token transfer to recipient of the specified amount
  const erc1155Interface = new ethers.utils.Interface([
    "function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes _data)",
  ])
  //const data = erc1155Interface.encodeFunctionData("safeTransferFrom", [fromAddr, to, nft.tokenId, amt, []])
  const data = erc1155Interface.encodeFunctionData("safeTransferFrom", [scwAddr, recipientAddress, tokenId, amount, []])
  const transaction = {
    from: scwAddr,
    to: tokenAddress,
    data: data,
  }

  console.log(chalk.cyan(`Transaction : ${JSON.stringify(transaction)}`));

  // build partial userOp
  let partialUserOp = await biconomySmartAccount.buildUserOp([transaction]);
  console.log(chalk.cyan(`partialUserOp : ${JSON.stringify(partialUserOp)}`));

  let finalUserOp = partialUserOp;




  // ------------------------STEP 3: Sign the UserOp and send to the Bundler--------------------------------//

  finalUserOp.paymasterAndData = '0x'
  console.log(chalk.blue(`userOp: ${JSON.stringify(finalUserOp, null, "\t")}`));

  // Below function gets the signature from the user (signer provided in Biconomy Smart Account)
  // and also send the full op to attached bundler instance

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
