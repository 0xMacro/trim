import o from 'ospec'
import { pad } from '../../dist/util.js'

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

    const [alice] = vm.accounts
    const foo = await alice.call(vm.contractAddr, encodeFunctionData({
      abi,
      functionName: 'foo',
      args: []
    }))
    o(foo.returnValue).equals(pad('10', 64))
    o(foo.results.execResult.exceptionError).equals(undefined)
  })
})
