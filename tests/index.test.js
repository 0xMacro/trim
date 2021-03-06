import o from 'ospec'
import {compileTrim} from '../dist/trim/index.js'
import {parseTrim} from '../dist/trim/parse.js'
import {compileBasm} from '../dist/basm.js'
import {Pos} from '../dist/util.js'
import {opcodes} from './_test-helper.js'

o('trim parse', function () {
  const source = `
    (ADD (CALLDATALOAD 0x00 0x03) 0x01)
    (MSTORE 0x40 _)
    (RETURN 0x40 0x20)
    STOP
  `
  o(parseTrim(source, new Pos(), { topLevel: true })).deepEquals([
    ['ADD', ['CALLDATALOAD', '0x00', '0x03'], '0x01'],
    ['MSTORE', '0x40', '_'],
    ['RETURN', '0x40', '0x20'],
    'STOP',
  ])
})

o.spec('trim compile', function() {
  o('basic', function () {
    const source = `
      (ADD (CALLDATALOAD 0x00 0x03) 0x01)
      (MSTORE 0x40 _)
      (RETURN 0x40 0x20)
      STOP
    `
    const expectedBasm = `
      PUSH1 0x01
      PUSH1 0x03
      PUSH1 0x00
      CALLDATALOAD
      ADD
      PUSH1 0x40
      MSTORE
      PUSH1 0x20
      PUSH1 0x40
      RETURN
      STOP
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('first level swap 1', function () {
    const source = `
      PUSH1 0x40
      (MSTORE _ 0x01)
    `
    const expectedBasm = `
      PUSH1 0x40
      PUSH1 0x01
      SWAP1
      MSTORE
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('first level swap 2', function () {
    const source = `
      PUSH1 0x03
      (ADDMOD _ 0x02 0x01)
    `
    const expectedBasm = `
      PUSH1 0x03
      PUSH1 0x01
      PUSH1 0x02
      DUP1
      SWAP3
      ADDMOD
      POP
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('first level swap 6', function () {
    const source = `
      PUSH1 0x07
      (CALL _ 0x06 0x05 0x04 0x03 0x02 0x01)
    `
    const expectedBasm = `
      PUSH1 0x07
      PUSH1 0x01
      PUSH1 0x02
      PUSH1 0x03
      PUSH1 0x04
      PUSH1 0x05
      PUSH1 0x06
      DUP1
      SWAP7
      CALL
      POP
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('push label', function () {
    const source = `
      PUSH1 0x01
      (push #foo)
      PUSH1 0x02
      #foo
      (ADD #foo #foo)
      PUSH1 0x03
    `
    const expectedBasm = `
      PUSH1 0x01
      PUSH2 0x0007
      PUSH1 0x02

      PUSH2 0x0007
      PUSH2 0x0007
      ADD
      PUSH1 0x03
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('before and after #runtime labels', function () {
    const source = `
      PUSH1 0x00
      (push #before)
      (push #runtime)
      (push #after)
      #before
      PUSH1 0x01
      #runtime
      PUSH1 0x02
      (push #runtime)
      #after
      PUSH1 0x03
      (push #after)
    `
    const expectedBasm = `
      PUSH1 0x00
      PUSH2 0x000b
      PUSH2 0x000d
      PUSH2 0x0012

      PUSH1 0x01
      PUSH1 0x02
      PUSH2 0x0000
      PUSH1 0x03
      PUSH2 0x0005
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('comments', function () {
    const source = `
      PUSH1 0x01; Comment 1
      (ADD 0x02 0x03); Comment 2
      PUSH1 0x04
    `
    const expectedBasm = `
      PUSH1 0x01
      PUSH1 0x03
      PUSH1 0x02
      ADD
      PUSH1 0x04
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('full example 1', function () {
    const source = `
      (SSTORE 0x00 "Hello, Trim!")
      (SUB CODESIZE #runtime)
      DUP1
      (CODECOPY 0x00 #runtime _)
      (RETURN 0x00 _)
      STOP

      #runtime
      (CALLDATACOPY 0x1c 0x00 0x04)
      (MLOAD 0x00)

      DUP1
      (EQ 0xcfae3217 _)
      (JUMPI #greet _)

      PUSH4 0xa4136862

      (REVERT 0x00 0x00)

      #greet
      JUMPDEST
      (SLOAD 0x00)
      (MSTORE 0x40 _)
      (RETURN 0x40 0x20)

      #setGreeting
      JUMPDEST
    `
    const expectedBasm = `
      PUSH12 0x48656c6c6f2c205472696d21
      PUSH1 0x00
      SSTORE
      PUSH2 0x0020
      CODESIZE
      SUB
      DUP1
      PUSH2 0x0020
      PUSH1 0x00
      CODECOPY
      PUSH1 0x00
      RETURN
      STOP
      PUSH1 0x04
      PUSH1 0x00
      PUSH1 0x1c
      CALLDATACOPY
      PUSH1 0x00
      MLOAD
      DUP1
      PUSH4 0xcfae3217
      EQ
      PUSH2 0x001f
      JUMPI
      PUSH4 0xa4136862
      PUSH1 0x00
      PUSH1 0x00
      REVERT
      JUMPDEST
      PUSH1 0x00
      SLOAD
      PUSH1 0x40
      MSTORE
      PUSH1 0x20
      PUSH1 0x40
      RETURN
      JUMPDEST
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })
})

o.spec('strings', function () {
  o('escape quote', function () {
    const source = `
      (push "A\\"C")
    `
    const expectedBasm = `
      PUSH3 0x412243
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })
})

o.spec('macros', function () {
  o('push', function () {
    const source = `
      (push "ABC")
    `
    const expectedBasm = `
      PUSH3 0x414243
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('abi/fn-selector', function () {
    const source = `
      (EQ (abi/fn-selector "foo()") "ABC")
    `
    const expectedBasm = `
      PUSH3 0x414243
      PUSH4 0xc2985578
      EQ
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('hex/add', function () {
    const source = `
      (ADD 0x01 (hex/add 0x02 0x03 0x04))
    `
    const expectedBasm = `
      PUSH1 0x09
      PUSH1 0x01
      ADD
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })
})

o.spec('user-defined macros', function () {
  o('simple', function () {
    const source = `
      (def x () STOP)
      (x)
      (x)
    `
    const expectedBasm = `
      STOP
      STOP
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('with a top expression', function () {
    const source = `
      (def foo () (EQ 0x01 _))
      PUSH1 0x00
      (foo)
    `
    const expectedBasm = `
      PUSH1 0x00
      PUSH1 0x01
      EQ
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('sugar compatibility', function () {
    const source = `
      (def x () 0x20)
      (x)
      (x)
    `
    const expectedBasm = `
      PUSH1 0x20
      PUSH1 0x20
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('with params', function () {
    const source = `
      (def foo (x) x 0xff)
      (foo ADD)
    `
    const expectedBasm = `
      ADD PUSH1 0xff
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('using labels', function () {
    const source = `
      (def id (x) x)
      PUSH1 0x10
      #bar
      PUSH1 0x20
      (id #bar)
    `
    const expectedBasm = `
      PUSH1 0x10
      PUSH1 0x20
      PUSH2 0x0002
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })

  o('using a nested macro', function () {
    const source = `
      (def foo (s) (abi/fn-selector s))
      (foo "greet()")
    `
    const expectedBasm = `
      PUSH4 0xcfae3217
    `
    o(compileTrim(source, { opcodes })).equals(compileBasm(expectedBasm, { opcodes }))
  })
})

o.spec('trim errors', function () {
  const compile = (src) => compileTrim(src, { opcodes })

  o('multiple tops', function () {
    o(() => compile(`(ADD _ _)`)).throws('[trim] Multiple top expressions (TODO)')
  })

  o('duplicate labels', function () {
    o(() => compile(`#a #a`)).throws(`[trim] Duplicate label definition: '#a'`)
  })

  o('invalid string position', function () {
    const source = `
      ("Hi")
    `
    // TODO: Throw better errors
    // o(() => compileTrim(source, { opcodes })).throws('[trim] First token in an expression must be a valid opcode or macro')
  })
})
