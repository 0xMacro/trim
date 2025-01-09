import o from 'ospec'
import { pad } from '../../dist/util.js'
import { makeStaticRouter } from '../../dist/templates/static-router.js'

import { makeFullExampleVm } from '../full-examples/_test-helper.js'
import { Interface } from '@ethersproject/abi'
import GreeterModuleABI from '../fixtures/GreeterModuleABI.json' with {type: "json"}
import SampleModuleABI from '../fixtures/SampleModuleABI.json' with {type: "json"}

const ABI = new Interface([
  ...GreeterModuleABI.filter(x => x.type === 'function'),
  ...SampleModuleABI.filter(x => x.type === 'function'),
])

o.spec('Static Router', function () {
  const GREETER_MODULE = '0x703aef879107aDE9820A795d3a6C36d6B9CC2B97'
  const SAMPLE_MODULE = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

  const source = makeStaticRouter([{
    name: 'GreeterModule',
    address: GREETER_MODULE,
    abi: GreeterModuleABI,
  }, {
    name: 'SampleModule',
    address: SAMPLE_MODULE,
    abi: SampleModuleABI,
  }])

  const vm = makeFullExampleVm({ source, sourceAbi: ABI })

  o.beforeEach(async () => {
    await vm.setup()
    await vm.mockContract(GREETER_MODULE, {
      'greet()': '0x11',
      'greet(address)': '0x22',
      'greetings(address)': '0x33',
      'setGreeting(string)': '0x44',
    })
    await vm.mockContract(SAMPLE_MODULE, {
      'initOrUpgradeNft(bytes32,string,string,string,address)': '0x55',
      'getAssociatedSystem(bytes32)': '0x66',
      'initOrUpgradeToken(bytes32,string,string,uint8,address)': '0x77',
      'registerUnmanagedSystem(bytes32,address)': '0x88',
    })
  })

  o('delegates to the correct modules', async () => {
    const SAMPLE_ADDR = '0x0000111100002222000033330000444400005555'
    const SAMPLE_BYTES32 = '0x' + pad('abcd', 64)

    vm.instance.evm.events.on('step', ({ opcode, stack, depth, memory, address }) => {
      // console.log(address.toString('hex'), opcode.name)
      const match = opcode.name.match(/LOG([0-4])/)
      if (match) {
        const n = parseInt(match[1])
        console.log('LOG:', ...stack.slice(-(n + 2)).reverse().slice(2).map(x => '0x'+x.toString(16)))
      }
    })

    const [alice] = vm.accounts
    const testcall = (sig, args, expected) => alice.call(vm.contractAddr, ABI, sig, args).then(r => {
      // console.log("hrm", r)
      if (r.results?.execResult?.exceptionError) {
        console.log('ERR:', r.results.execResult.exceptionError)
      }
      o(r.returnValue).equals(pad(expected.replace(/^0x/, ''), 64))
      o(r.results.execResult.exceptionError).equals(undefined)
    })

    await testcall('greet()', [], '0x11')
    await testcall('greet(address)', [SAMPLE_ADDR], '0x22')
    await testcall('greetings(address)', [SAMPLE_ADDR], '0x33')
    await testcall('setGreeting(string)', ['hello'], '0x44')

    await testcall('initOrUpgradeNft(bytes32,string,string,string,address)', [SAMPLE_BYTES32, 'a', 'b', 'c', SAMPLE_ADDR], '0x55')
    await testcall('getAssociatedSystem(bytes32)', [SAMPLE_BYTES32], '0x66')
    await testcall('initOrUpgradeToken(bytes32,string,string,uint8,address)', [SAMPLE_BYTES32, 'a', 'b', 1, SAMPLE_ADDR], '0x77')
    await testcall('registerUnmanagedSystem(bytes32,address)', [SAMPLE_BYTES32, SAMPLE_ADDR], '0x88')
  })
})
