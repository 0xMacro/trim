import o from 'ospec'

import { trim } from '../../dist/index.js'
import { makeFullExampleVm } from './_test-helper.js'
import { encodeFunctionData, parseAbi, decodeFunctionResult } from 'viem'

o.spec('ABI Encoding', function () {

  o('tuple', async () => {
    const abi = parseAbi(['function foo() external view returns (uint256, uint256)'])
    const source = trim.source`
      (init-runtime-code)
      #runtime
      (MSTORE 0words 0x11) ; first item
      (MSTORE 1words 0x22) ; second item
      (RETURN 0 2words)
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const [alice] = vm.accounts
    const foo = await alice.call(vm.contractAddr, encodeFunctionData({ abi, functionName: 'foo' }))
    o(foo.results.execResult.exceptionError).equals(undefined)

    const result = decodeFunctionResult({ abi, functionName: 'foo', data: '0x'+foo.returnValue })
    o(result.length).equals(2)
    o(result[0].toString(16)).equals('11')
    o(result[1].toString(16)).equals('22')
  })

  o('hardcoded array', async () => {
    const abi = parseAbi(['function foo() external view returns (uint256[])'])
    const source = trim.source`
      (init-runtime-code)
      #runtime
      (MSTORE 0 0x20)      ; offset to array
      (MSTORE 1word  2)    ; length
      (MSTORE 2words 0x11) ; first item
      (MSTORE 3words 0x22) ; second item
      (RETURN 0 4words)
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const [alice] = vm.accounts
    const foo = await alice.call(vm.contractAddr, encodeFunctionData({ abi, functionName: 'foo' }))
    o(foo.results.execResult.exceptionError).equals(undefined)

    const arr = decodeFunctionResult({ abi, functionName: 'foo', data: '0x'+foo.returnValue })
    o(arr.length).equals(2)
    o(arr[0].toString(16)).equals('11')
    o(arr[1].toString(16)).equals('22')
  })

  o('dynamic array', async () => {
    const abi = parseAbi(['function makeArray(uint256 count) external view returns (uint256[])'])
    const source = trim.source`
      (init-runtime-code)
      #runtime

      ;;
      ;; NOTE:
      ;; This code would be WAY simpler with registers
      ;; but we need at least one example that primarily uses the stack 🥲
      ;;
      (CALLDATALOAD 4bytes) ; [count]

      ;; Start of return data
      (MSTORE 0x00 0x20) ; offset to array
      (MSTORE 0x20 DUP1) ; array length

      ;; Build array of n length, where n is the count parameter
      PUSH1 0x00      ; [index, count]
      PUSH1 0x40 ; [mem-offset, index, count]

      #loop
      JUMPDEST ; Invariant -> [mem-offset, index, count]

      (JUMPI #done (EQ DUP3 DUP3)) ; if index == count, then we're done

      ; else, append the next value to the array
      (ADD 0xff00 DUP2)     ; [next-value, mem-offset, index, count]
      DUP2                  ; [mem-offset, next-value, mem-offset, index, count]
      MSTORE                ; [mem-offset, index, count]
      SWAP1 (ADD 1 _)       ; [index', mem-offset, count]
      SWAP1 (ADD 0x20 _)    ; [mem-offset', index', count]
      (JUMP #loop)

      #done
      JUMPDEST
      (RETURN 0 _)
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const [alice] = vm.accounts
    const foo = await alice.call(vm.contractAddr, encodeFunctionData({
      abi,
      functionName: 'makeArray',
      args: [3]
    }))
    o(foo.results.execResult.exceptionError).equals(undefined)

    const arr = decodeFunctionResult({ abi, functionName: 'makeArray', data: '0x'+foo.returnValue })
    o(arr.length).equals(3)
    o(arr[0].toString(16)).equals('ff00')
    o(arr[1].toString(16)).equals('ff01')
    o(arr[2].toString(16)).equals('ff02')
  })

  o('hardcoded array of arrays', async () => {
    const abi = parseAbi(['function foo() external view returns (uint256[][])'])
    const source = trim.source`
      (init-runtime-code)
      #runtime
      (defcounter memory-index)
      (def append (value) (MSTORE (math 1word * (memory-index ++)) value))

      ;; Goal: return [[0x11, 0x22], [0x33, 0x44], [0x55, 0x66]]
      ;; Outer array
      (append 1word) ; offset to outer array
      (append 3) ; length of outer array

      ;; Outer array items
      (append (math 1word * 3))             ; offset to first inner array
      (append (math 1word * 3 + 1word * 3)) ; offset to second inner array
      (append (math 1word * 3 + 1word * 6)) ; offset to third inner array

      ;; Inner array 1
      (append    2) ; length
      (append 0x11) ; first item
      (append 0x22) ; second item

      ;; Inner array 2
      (append    2) ; length
      (append 0x33) ; first item
      (append 0x44) ; second item

      ;; Inner array 3
      (append    2) ; length
      (append 0x55) ; first item
      (append 0x66) ; second item

      (RETURN 0 (math 1word * (memory-index)))
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const [alice] = vm.accounts
    const foo = await alice.call(vm.contractAddr, encodeFunctionData({ abi, functionName: 'foo' }))
    o(foo.results.execResult.exceptionError).equals(undefined)

    const arr = decodeFunctionResult({ abi, functionName: 'foo', data: '0x'+foo.returnValue })
    o(arr.length).equals(3)
    o(arr[0][0].toString(16)).equals('11')
    o(arr[0][1].toString(16)).equals('22')

    o(arr[1][0].toString(16)).equals('33')
    o(arr[1][1].toString(16)).equals('44')

    o(arr[2][0].toString(16)).equals('55')
    o(arr[2][1].toString(16)).equals('66')
  })


  o('dynamic array of arrays', async () => {
    const abi = parseAbi(['function make2dArray(uint256 xlen, uint256 ylen) external view returns (uint256[][])'])
    const source = trim.source`
      (init-runtime-code)
      #runtime

      (defcounter reg-counter)
      (def defreg (name) (defconst name (math 1word * (reg-counter ++))))

      (defreg $$)
      (defreg $xlen)
      (defreg $ylen)

      (CALLDATACOPY $xlen          4bytes  1word)
      (CALLDATACOPY $ylen (+ 1word 4bytes) 1word)

      (defreg $x)
      (defreg $y)

      ;; Free memory pointer (for return data)
      (defreg $mem)

      ;; Return data start position
      ;; WARNING: MUST BE LAST REGISTER!!
      (defreg $ret)
      (MSTORE $mem $ret)
      (def write (value) (MSTORE (MLOAD $mem) value) (MSTORE $mem (ADD 1word (MLOAD $mem))))

      ;; First two words are always known
      (write 0x20)          ; offset to outer array
      (write (MLOAD $xlen)) ; length of outer array

      ;;
      ;; Each inner array has a length of ylen.
      ;; For each inner array, calculate its offset and add as an outer array item
      ;;
      (MSTORE $$ (MUL 1word (MLOAD $xlen))) ; cumulative offset; starts at end of parameters

      #outer-loop
      JUMPDEST
      (write (MLOAD $$))

      ; Increment for-loop variables
      (MSTORE $x (ADD 1 (MLOAD $x)))
      (JUMPI #outer-loop-done (EQ (MLOAD $x) (MLOAD $xlen)))

      (MSTORE $$
        (ADD 1word (ADD (MLOAD $$) (MUL 1word (MLOAD $ylen))))) ; length of an inner array + 1word for its length field
      (JUMP #outer-loop)

      #outer-loop-done
      JUMPDEST

      ;;
      ;; Build inner arrays
      ;;
      (MSTORE $x 0)      ; reuse x register
      (MSTORE $$ 0xff00) ; the item value counter we'll be appending

      #array-build-loop
      JUMPDEST

      (EQ (MLOAD $x) (MLOAD $xlen)) ; if x == xlen, then all arrays are fulfilled
      (JUMPI #array-build-loop-done)

      (MSTORE $y 0)
      (write (MLOAD $ylen)) ; length of inner array

      #item-loop
      JUMPDEST

      (EQ (MLOAD $y) (MLOAD $ylen)) ; if y == ylen, then inner array is fulfilled
      (JUMPI #item-loop-done)

      (write (MLOAD $$))

      (MSTORE $$ (ADD 1 (MLOAD $$))) ; increment item value counter
      (MSTORE $y (ADD 1 (MLOAD $y))) ; increment inner loop index

      (JUMP #item-loop)

      #item-loop-done
      JUMPDEST
      (MSTORE $x (ADD 1 (MLOAD $x))) ; increment outer loop index
      (JUMP #array-build-loop)

      #array-build-loop-done
      JUMPDEST
      (RETURN $ret (SUB (MLOAD $mem) $ret)) ; Return all data written
    `
    const vm = makeFullExampleVm({ source })
    await vm.setup()

    const [alice] = vm.accounts
    const foo = await alice.call(vm.contractAddr, encodeFunctionData({
      abi,
      functionName: 'make2dArray',
      args: [3,2]
    }))
    o(foo.results.execResult.exceptionError).equals(undefined)
    if (foo.results.execResult.exceptionError) {
      throw new Error("Error data: " + foo.returnValue)
    }

    const arr = decodeFunctionResult({ abi, functionName: 'make2dArray', data: '0x'+foo.returnValue })
    o(arr.length).equals(3)

    o(arr[0].length).equals(2)
    o(arr[0][0].toString(16)).equals('ff00')
    o(arr[0][1].toString(16)).equals('ff01')

    o(arr[1].length).equals(2)
    o(arr[1][0].toString(16)).equals('ff02')
    o(arr[1][1].toString(16)).equals('ff03')

    o(arr[2].length).equals(2)
    o(arr[2][0].toString(16)).equals('ff04')
    o(arr[2][1].toString(16)).equals('ff05')
  })
})
