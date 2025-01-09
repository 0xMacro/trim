import o from 'ospec'
import { pad } from '../../dist/util.js'

import { makeFullExampleVm } from '../full-examples/_test-helper.js'
import { Interface } from '@ethersproject/abi'

const ABI = new Interface([
  'function greetings(address)',
  'function initOrUpgradeNft(bytes32,string,string,string,address)',
  'function getAssociatedSystem(bytes32)',
  'function setGreeting(string)',
  'function greet(address)',
  'function initOrUpgradeToken(bytes32,string,string,uint8,address)',
  'function greet()',
  'function registerUnmanagedSystem(bytes32,address)',
])


o.spec('Static Router', function () {
  const GREETER_MODULE = '0x703aef879107aDE9820A795d3a6C36d6B9CC2B97'
  const SAMPLE_MODULE = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

  const source = `
    (init-runtime-code)

    #runtime

    ;; Helper to copy data from code to memory with the correct memory offset.
    (def codecopy-word (reg offset length)
      (CODECOPY (math reg + 1word - length) offset length))

    ;;
    ;; Set up registers
    ;;
    (defcounter reg-counter)
    (def defreg (name) (defconst name (math 1word * (reg-counter ++))))

    ;; Scratch space
    (defreg $$)

    ;; Incoming function selector
    (defreg $input)
    (defreg $current)
    (defreg $current-pos)
    (CALLDATACOPY (math $input + 1word - 4bytes) 0 4bytes)

    ;; Found module contract address, if any
    (defreg $module)

    ;; Binary search boundaries
    (defreg $bot)
    (defreg $top)
    (defreg $mid)
    (codecopy-word $top #function-count 2bytes)
    (MSTORE $top (SUB (MLOAD $top) 1))

    ;;
    ;; Main Body
    ;;
    #search
    JUMPDEST

    ;; Load middle of search range - the next function selector to match against.
    (MSTORE
      $mid
      (ADD (MLOAD $bot) (DIV (SUB (MLOAD $top) (MLOAD $bot)) 2)))
    (MSTORE
      $current-pos
      (ADD (MUL 5bytes (MLOAD $mid)) #function-data))

    (codecopy-word $current (MLOAD $current-pos) 4bytes)

    ;; If we have a match, delegate. Else, continue searching.
    (EQ (MLOAD $input) (MLOAD $current))
    (JUMPI #delegate _)

    ;; Base case: no more functions to search.
    (EQ (MLOAD $bot) (MLOAD $top))
    (JUMPI #nomatch _)

    ;; If input is below current, search lower half.
    (LT (MLOAD $input) (MLOAD $current))
    (JUMPI #search-lower _)

    ;; Else, search upper half.
    (MSTORE $bot (ADD 1 (MLOAD $mid)))
    (JUMP #search)

    #search-lower
    JUMPDEST
    (MSTORE $top (MLOAD $mid))
    (JUMP #search)

    #delegate
    JUMPDEST

    ;; Get module index
    (codecopy-word $$ (ADD (MLOAD $current-pos) 4bytes) 1byte)

    ;; Load module address
    (codecopy-word
      $$
      (ADD (MUL 20bytes (MLOAD $$)) #module-data)
      20bytes)

    ;; Delegate
    (MLOAD $$) ; Next lines thrash memory, so load module address onto stack first.

    (CALLDATACOPY 0 0 CALLDATASIZE)
    (DELEGATECALL GAS _ 0 CALLDATASIZE 0 0)
    (RETURNDATACOPY 0 0 RETURNDATASIZE)

    (JUMPI #delegate-success _)
    (REVERT 0 RETURNDATASIZE)

    #delegate-success
    JUMPDEST
    (RETURN 0 RETURNDATASIZE)

    STOP

    #nomatch
    JUMPDEST
    REVERT ; No matching function selector

    #function-count
    0x0008

    #function-data
    0x26ffaa03 0x00 ; GreeterModule.greetings(address)
    0x2d22bef9 0x01 ; SampleModule.initOrUpgradeNft(bytes32,string,string,string,address)
    0x60988e09 0x01 ; SampleModule.getAssociatedSystem(bytes32)
    0xa4136862 0x00 ; GreeterModule.setGreeting()
    0xad55cd0a 0x00 ; GreeterModule.greet(address)
    0xc6f79537 0x01 ; SampleModule.initOrUpgradeToken(bytes32,string,string,uint8,address)
    0xcfae3217 0x00 ; GreeterModule.greet()
    0xd245d983 0x01 ; SampleModule.registerUnmanagedSystem(bytes32,address)

    #module-count
    0x02

    #module-data
    ${GREETER_MODULE} ; GreeterModule
    ${SAMPLE_MODULE} ; SampleModule
  `

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
