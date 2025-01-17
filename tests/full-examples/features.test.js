import o from 'ospec'
import { pad } from '../../dist/util.js'

import { trim } from '../../dist/index.js'
import { makeFullExampleVm } from './_test-helper.js'
import { encodeFunctionData } from 'viem'

o.spec('Trim Features', function () {

  o('advanced top', async () => {
    const abi = [{
      type: 'function',
      name: 'foo',
      inputs: [],
      outputs: []
    }]
    const source = `
      (init-runtime-code)
      #runtime
      PUSH1 0x20
      (ADDMOD _ 0x30 0x40)
      (return)
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const foo = await vm.accounts[0].call(vm.contractAddr, encodeFunctionData({
      abi,
      functionName: 'foo',
      args: []
    }))
    o(foo.returnValue).equals(pad('10', 64))
    o(foo.results.execResult.exceptionError).equals(undefined)
  })

  o('loop in label', async () => {
    const source = trim.source`
      (init-runtime-code)
      #runtime
      (defconst $i 0x00)
      (def loop (label ...body) label JUMPDEST ...body (JUMP label) (label/append label /break) JUMPDEST)
      (push 5)
;      (scope
        (loop #build-item
          (JUMPI #build-item/break (EQ (MLOAD $i) DUP1))
          (MSTORE $i (ADD 1 (MLOAD $i)))
        )
;      )
      (return 0xeeff)
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const foo = await vm.accounts[0].call(vm.contractAddr, '0x')
    o(foo.returnValue).equals(pad('eeff', 64))
    o(foo.results.execResult.exceptionError).equals(undefined)
  })

  o('local-call', async () => {
    const source = trim.source`
      (init-runtime-code)
      #runtime
      (defcounter local-call-counter)
      (def local-call (label ...params)
        (JUMP label ...params (label/append #local-ret- (atom/dec (local-call-counter))))
        (label/append #local-ret- (atom/dec (local-call-counter ++)))
        JUMPDEST)

      (local-call #local-add 0x11 0x22)
      (return (ADD 1 _))

      #local-add
      JUMPDEST
      ADD
      (JUMP SWAP1)
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const foo = await vm.accounts[0].call(vm.contractAddr, '0x')
    o(foo.returnValue).equals(pad('34', 64))
    o(foo.results.execResult.exceptionError).equals(undefined)
  })
})
