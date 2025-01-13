import o from 'ospec'
import { pad } from '../../dist/util.js'

import { encodeFunctionData } from 'viem'
import ERC20ABI from '../fixtures/ERC20ABI.json' with {type: "json"}
import { makeFullExampleVm } from './_test-helper.js'


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

  const vm = makeFullExampleVm({ source })

  o.beforeEach(async () => {
    await vm.setup()
  })

  o('balanceOf', async () => {
    const [alice] = vm.accounts
    const {results, returnValue} = await alice.call(vm.contractAddr, encodeFunctionData({
      abi: ERC20ABI,
      functionName: 'balanceOf',
      args: [alice.address]
    }))
    o(returnValue).equals(pad('22b', 64)) // 555 in hex
  })
})
