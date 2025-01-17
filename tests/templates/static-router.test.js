import o from 'ospec'
import { pad } from '../../dist/util.js'
import { makeStaticRouter } from '../../dist/templates/static-router.js'

import { makeFullExampleVm } from '../full-examples/_test-helper.js'
import { decodeFunctionResult, encodeFunctionData, keccak256 } from 'viem'
import GreeterModuleABI from '../fixtures/GreeterModuleABI.json' with {type: "json"}
import SampleModuleABI from '../fixtures/SampleModuleABI.json' with {type: "json"}
import DiamondLoupeABI from '../fixtures/DiamondLoupeABI.json' with {type: "json"}

const abi = [
  ...GreeterModuleABI.filter(x => x.type === 'function'),
  ...SampleModuleABI.filter(x => x.type === 'function'),
  ...DiamondLoupeABI.filter(x => x.type === 'function'),
]

o.spec('Static Router', function () {
  const GREETER_MODULE = '0x703aef879107aDE9820A795d3a6C36d6B9CC2B97'
  const SAMPLE_MODULE = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

  let vm

  const testcall = (sig, args, expected) => vm.accounts[0].call(vm.contractAddr, encodeFunctionData({
    abi: abi,
    functionName: sig,
    args,
  })).then(r => {
    console.log("Return:", r.returnValue)
    if (r.results?.execResult?.exceptionError) {
      console.log('ERR:', r.results.execResult.exceptionError, r.returnValue)
    }
    if (expected) {
      o(r.returnValue).equals(pad(expected.replace(/^0x/, ''), 64))
      o(r.results.execResult.exceptionError).equals(undefined)
    }
    return r.returnValue
  })

  async function setup(source) {
    vm = makeFullExampleVm({ source })
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
  }

  o('delegates to the correct modules', async () => {
    const source = makeStaticRouter([{
      name: 'GreeterModule',
      address: GREETER_MODULE,
      abi: GreeterModuleABI,
    }, {
      name: 'SampleModule',
      address: SAMPLE_MODULE,
      abi: SampleModuleABI,
    }])
    await setup(source)

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

    await testcall('greet', [], '0x11')
    await testcall('greet', [SAMPLE_ADDR], '0x22')
    await testcall('greetings', [SAMPLE_ADDR], '0x33')
    await testcall('setGreeting', ['hello'], '0x44')

    await testcall('initOrUpgradeNft', [SAMPLE_BYTES32, 'a', 'b', 'c', SAMPLE_ADDR], '0x55')
    await testcall('getAssociatedSystem', [SAMPLE_BYTES32], '0x66')
    await testcall('initOrUpgradeToken', [SAMPLE_BYTES32, 'a', 'b', 1, SAMPLE_ADDR], '0x77')
    await testcall('registerUnmanagedSystem', [SAMPLE_BYTES32, SAMPLE_ADDR], '0x88')
  })

  o.only('supports diamond compatibility', async () => {
    const source = makeStaticRouter([{
      name: 'GreeterModule',
      address: GREETER_MODULE,
      abi: GreeterModuleABI,
    }, {
      name: 'SampleModule',
      address: SAMPLE_MODULE,
      abi: SampleModuleABI,
    }], {
      diamondCompat: true
    })
    await setup(source)

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

    //
    // facetAddresses()
    //
    // const addresses = decodeFunctionResult({
    //   abi,
    //   functionName: 'facetAddresses',
    //   data: '0x' + await testcall('facetAddresses', []),
    // })
    // o(addresses.length).equals(2)
    // o(addresses[0]).equals(GREETER_MODULE)
    // o(addresses[1]).equals(SAMPLE_MODULE)

    //
    // facetAddress(bytes4 selector)
    //
    // const facetAddress = async (sig) => decodeFunctionResult({
    //   abi,
    //   functionName: 'facetAddress',
    //   data: '0x' + await testcall('facetAddress', [`0x${keccak256(Buffer.from(sig)).slice(2, 10)}`]),
    // })
    // o(await facetAddress('greet()')).equals(GREETER_MODULE)
    // o(await facetAddress('greet(address)')).equals(GREETER_MODULE)
    // o(await facetAddress('greetings(address)')).equals(GREETER_MODULE)
    // o(await facetAddress('setGreeting(string)')).equals(GREETER_MODULE)

    // o(await facetAddress('initOrUpgradeNft(bytes32,string,string,string,address)')).equals(SAMPLE_MODULE)
    // o(await facetAddress('getAssociatedSystem(bytes32)')).equals(SAMPLE_MODULE)
    // o(await facetAddress('initOrUpgradeToken(bytes32,string,string,uint8,address)')).equals(SAMPLE_MODULE)
    // o(await facetAddress('registerUnmanagedSystem(bytes32,address)')).equals(SAMPLE_MODULE)

    //
    // facetFunctionSelectors(address facet)
    //
    const facetFunctionSelectors = async (addr) => decodeFunctionResult({
      abi,
      functionName: 'facetFunctionSelectors',
      data: '0x' + await testcall('facetFunctionSelectors', [addr]),
    })
    o(await facetFunctionSelectors(GREETER_MODULE)).deepEquals([
      `0x${keccak256(Buffer.from('greetings(address)')).slice(2, 10)}`,
      `0x${keccak256(Buffer.from('setGreeting(string)')).slice(2, 10)}`,
      `0x${keccak256(Buffer.from('greet(address)')).slice(2, 10)}`,
      `0x${keccak256(Buffer.from('greet()')).slice(2, 10)}`,
    ])
    o(await facetFunctionSelectors(SAMPLE_MODULE)).deepEquals([
      `0x${keccak256(Buffer.from('initOrUpgradeNft(bytes32,string,string,string,address)')).slice(2, 10)}`,
      `0x${keccak256(Buffer.from('getAssociatedSystem(bytes32)')).slice(2, 10)}`,
      `0x${keccak256(Buffer.from('initOrUpgradeToken(bytes32,string,string,uint8,address)')).slice(2, 10)}`,
      `0x${keccak256(Buffer.from('registerUnmanagedSystem(bytes32,address)')).slice(2, 10)}`,
    ])

    //
    // All functions should still operate as before
    //
    // await testcall('greet', [], '0x11')
    // await testcall('greet', [SAMPLE_ADDR], '0x22')
    // await testcall('greetings', [SAMPLE_ADDR], '0x33')
    // await testcall('setGreeting', ['hello'], '0x44')

    // await testcall('initOrUpgradeNft', [SAMPLE_BYTES32, 'a', 'b', 'c', SAMPLE_ADDR], '0x55')
    // await testcall('getAssociatedSystem', [SAMPLE_BYTES32], '0x66')
    // await testcall('initOrUpgradeToken', [SAMPLE_BYTES32, 'a', 'b', 1, SAMPLE_ADDR], '0x77')
    // await testcall('registerUnmanagedSystem', [SAMPLE_BYTES32, SAMPLE_ADDR], '0x88')
  })
})
