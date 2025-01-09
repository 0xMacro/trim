import o from 'ospec'
import { pad } from '../../dist/util.js'

import { makeFullExampleVm } from './_test-helper.js'
import { Interface } from '@ethersproject/abi'

o.spec('Trim Templates', function () {
  const vm = makeFullExampleVm({ source: '', sourceAbi: [] })

  o.beforeEach(async () => {
    await vm.setup()
  })

  o('stubbedContract', async () => {
    const abi = new Interface([
      'function foo()',
      'function bar()',
    ])
    const addr = '0x' + '11'.repeat(20)
    await vm.mockContract(addr, { 'foo()': 10, 'bar()': '0x20' })

    const [alice] = vm.accounts
    const foo = await alice.call(addr, abi, 'foo()', [])
    o(foo.returnValue).equals(pad('a', 64)) // 10 in hex
    o(foo.results.execResult.exceptionError).equals(undefined)

    const bar = await alice.call(addr, abi, 'bar()', [])
    o(bar.returnValue).equals(pad('20', 64))
    o(bar.results.execResult.exceptionError).equals(undefined)
  })
})
