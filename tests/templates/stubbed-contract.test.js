import o from 'ospec'
import { pad } from '../../dist/util.js'

import { makeFullExampleVm } from '../full-examples/_test-helper.js'
import { encodeFunctionData, parseAbi } from 'viem'

o.spec('Stubbed Contract Template', function () {
  const vm = makeFullExampleVm({ source: '', sourceAbi: [] })

  o.beforeEach(async () => {
    await vm.setup()
  })

  o('hardcodes return values', async () => {
    const abi = parseAbi([
      'function foo()',
      'function bar()',
    ])
    const addr = '0x' + '11'.repeat(20)
    await vm.mockContract(addr, { 'foo()': 10, 'bar()': '0x20' })

    const [alice] = vm.accounts
    const foo = await alice.call(addr, encodeFunctionData({
      abi,
      functionName: 'foo'
    }))
    o(foo.returnValue).equals(pad('a', 64)) // 10 in hex
    o(foo.results.execResult.exceptionError).equals(undefined)

    const bar = await alice.call(addr, encodeFunctionData({
      abi,
      functionName: 'bar'
    }))
    o(bar.returnValue).equals(pad('20', 64))
    o(bar.results.execResult.exceptionError).equals(undefined)
  })
})
