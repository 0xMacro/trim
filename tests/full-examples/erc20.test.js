import o from 'ospec'
import { pad } from '../../dist/util.js'

import { makeFullExampleVm } from './_test-helper.js'

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

    (def defun (sig label)
      (EQ (abi/fn-selector sig) DUP1)
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

  const vm = makeFullExampleVm({ source, sourceAbi: ERC20_ABI })

  o.beforeEach(async () => {
    await vm.setup()
  })

  o('balanceOf', async () => {
    const [alice] = vm.accounts
    const {results, returnValue} = await alice.call(vm.contractAddr, vm.abi, 'balanceOf(address)', [alice.address])
    o(returnValue).equals(pad('22b', 64)) // 555 in hex
  })
})
