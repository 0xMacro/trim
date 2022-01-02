import o from 'ospec'
// import ethers from 'ethers'
import { compileTrim } from '../../dist/trim/index.js'
import { getOpcodesForTrim } from '../../dist/interop.js'
import { pad } from '../../dist/util.js'

import { defaultAbiCoder as AbiCoder, Interface } from '@ethersproject/abi'
import { BN, Account, Address, pubToAddress, toBuffer } from 'ethereumjs-util'
import { getOpcodesForHF } from '@ethereumjs/vm/dist/evm/opcodes/index.js'
import TX from '@ethereumjs/tx'
const { Transaction } = TX
import evm from '@ethereumjs/vm'
const { default: VM } = evm
import ejs from '@ethereumjs/common'
const { default: Common, Chain, Hardfork } = ejs

const ERC20_ABI = [
  'function name()', // string
  'function symbol()', // string
  'function decimals()', // uint8
  'function totalSupply()', // uint256

  'function approve(address, uint256)', // bool
  'function balanceOf(address)', // uint256

  'function transfer(address, uint256)', // bool
  'function transferFrom(address, address, uint256)', // bool
  'function allowance(address, address)', // uint256
  // {
  //   "payable": true,
  //   "stateMutability": "payable",
  //   "type": "fallback"
  // },
  // {
  //   "anonymous": false,
  //   "inputs": [
  //     {
  //       "indexed": true,
  //       "name": "owner",
  //       "type": "address"
  //     },
  //     {
  //       "indexed": true,
  //       "name": "spender",
  //       "type": "address"
  //     },
  //     {
  //       "indexed": false,
  //       "name": "value",
  //       "type": "uint256"
  //     }
  //   ],
  //   "name": "Approval",
  //   "type": "event"
  // },
  // {
  //   "anonymous": false,
  //   "inputs": [
  //     {
  //       "indexed": true,
  //       "name": "from",
  //       "type": "address"
  //     },
  //     {
  //       "indexed": true,
  //       "name": "to",
  //       "type": "address"
  //     },
  //     {
  //       "indexed": false,
  //       "name": "value",
  //       "type": "uint256"
  //     }
  //   ],
  //   "name": "Transfer",
  //   "type": "event"
  // }
]


o.spec('ERC-20', function () {

  const source = `
    ; Mint sender 555 tokens
    (MSTORE 0x00 CALLER) ; Storage slot 0 + msg.sender
    (SHA3 0x00 0x20) ; Calculate mapping key
    (SSTORE _ 0x022b) ; Mint

    ; Return runtime code
    (SUB CODESIZE #runtime)
    DUP1
    (CODECOPY 0x00 #runtime _)
    (RETURN 0x00 _)

    #runtime
    (CALLDATACOPY 0x1c 0x00 0x04)
    (MLOAD 0x00) ; copy function id onto the stack

    (def defun (selector label)
      (EQ (abi/fn-selector selector) DUP1)
      (JUMPI label _)
    )
    (defun "balanceOf(address)" #balanceOf)

    REVERT ; No matching function id

    #balanceOf
    JUMPDEST
    (MSTORE 0x00 (CALLDATALOAD 0x04)) ; (Storage slot 0 + address) mapping key
    (SHA3 0x00 0x20) ; Calculate storage key
    SLOAD
    (MSTORE 0x00 _)
    (RETURN 0x00 0x20)
  `
  const abi = new Interface(ERC20_ABI)

  let accounts, vm, contractAddr

  o.beforeEach(async () => {
    accounts = []
    const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Berlin })
    const opcodes = getOpcodesForTrim(getOpcodesForHF(common))
    vm = new VM({ common })
    await makeAccount(0, 123)

    // Compile & deploys the contract
    const {createdAddress} = await runTx(0, {
      nonce: '0x00',
      gasPrice: "0x09184e72a000",
      gasLimit: "0x90710",
      data: compileTrim(source, { opcodes }),
    })
    contractAddr = createdAddress
  })


  o('balanceOf', async () => {
    const acc = 0
    const {results, returnValue} = await call(contractAddr, acc, abi, 'balanceOf(address)', [accounts[acc].address])
    o(returnValue).equals(pad('22b', 64)) // 555 in hex
  })

  //
  // Helpers
  //
  async function call(contractAddr, account, abi, funcName, args) {
    const calldata = abi.getSighash(funcName) + AbiCoder.encode(abi.functions[funcName].inputs, args).slice(2)
    return await runTx(account, {
      to: contractAddr,
      gasPrice: "0x09184e72a000",
      gasLimit: "0x90710",
      data: calldata
    })
  }
  async function runTx(index, txData) {
    const account = accounts[index]
    const tx = Transaction.fromTxData({
      ...txData,
      nonce: `0x${account.nonce.toString(16)}`,
    }).sign(account.privateKeyBuf)

    account.nonce += 1

    const results = await vm.runTx({ tx })
    const returnValue = results.execResult.returnValue.toString('hex')

    // console.log('gas used: ' + results.gasUsed.toString())
    // console.log('returned: ' + results.execResult.returnValue.toString('hex'))

    return { createdAddress: results.createdAddress, results, returnValue }
  }

  async function makeAccount(index, balance) {
    const keyPair = keyPairs[index]
    const account = Account.fromAccountData({
      nonce: 0,
      balance: new BN(10).pow(new BN(18)).mul(new BN(balance))
    })
    const privateKeyBuf = toBuffer(keyPair.privateKey)
    const publicKeyBuf = toBuffer(keyPair.publicKey)
    const address = new Address(pubToAddress(publicKeyBuf, true))
    accounts[index] = { address: address.toString(), nonce: 0, privateKeyBuf }

    await vm.stateManager.putAccount(address, account)
  }

})

const keyPairs = [{
  "privateKey": "0x3cd7232cd6f3fc66a57a6bedc1a8ed6c228fff0a327e169c2bcc5e869ed49511",
  "publicKey": "0x0406cc661590d48ee972944b35ad13ff03c7876eae3fd191e8a2f77311b0a3c6613407b5005e63d7d8d76b89d5f900cde691497688bb281e07a5052ff61edebdc0"
}]
