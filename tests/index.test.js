import o from 'ospec'
import {compileTrim} from '../dist/trim/index.js'
import {parseTrim} from '../dist/trim/parse.js'
import {compileBasm} from '../dist/basm.js'
import {pad, Pos} from '../dist/util.js'

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
    o(() => compileTrim(source, { opcodes })).throws('[trim] First token in an expression must be a valid opcode or macro')
  })
})

const opcodes = [
  {code: 0, fullName: "STOP"},
  {code: 1, fullName: "ADD"},
  {code: 2, fullName: "MUL"},
  {code: 3, fullName: "SUB"},
  {code: 4, fullName: "DIV"},
  {code: 5, fullName: "SDIV"},
  {code: 6, fullName: "MOD"},
  {code: 7, fullName: "SMOD"},
  {code: 8, fullName: "ADDMOD"},
  {code: 9, fullName: "MULMOD"},
  {code: 10, fullName: "EXP"},
  {code: 11, fullName: "SIGNEXTEND"},
  {code: 16, fullName: "LT"},
  {code: 17, fullName: "GT"},
  {code: 18, fullName: "SLT"},
  {code: 19, fullName: "SGT"},
  {code: 20, fullName: "EQ"},
  {code: 21, fullName: "ISZERO"},
  {code: 22, fullName: "AND"},
  {code: 23, fullName: "OR"},
  {code: 24, fullName: "XOR"},
  {code: 25, fullName: "NOT"},
  {code: 26, fullName: "BYTE"},
  {code: 27, fullName: "SHL"},
  {code: 28, fullName: "SHR"},
  {code: 29, fullName: "SAR"},
  {code: 32, fullName: "SHA3"},
  {code: 48, fullName: "ADDRESS"},
  {code: 49, fullName: "BALANCE"},
  {code: 50, fullName: "ORIGIN"},
  {code: 51, fullName: "CALLER"},
  {code: 52, fullName: "CALLVALUE"},
  {code: 53, fullName: "CALLDATALOAD"},
  {code: 54, fullName: "CALLDATASIZE"},
  {code: 55, fullName: "CALLDATACOPY"},
  {code: 56, fullName: "CODESIZE"},
  {code: 57, fullName: "CODECOPY"},
  {code: 58, fullName: "GASPRICE"},
  {code: 59, fullName: "EXTCODESIZE"},
  {code: 60, fullName: "EXTCODECOPY"},
  {code: 61, fullName: "RETURNDATASIZE"},
  {code: 62, fullName: "RETURNDATACOPY"},
  {code: 63, fullName: "EXTCODEHASH"},
  {code: 64, fullName: "BLOCKHASH"},
  {code: 65, fullName: "COINBASE"},
  {code: 66, fullName: "TIMESTAMP"},
  {code: 67, fullName: "NUMBER"},
  {code: 68, fullName: "DIFFICULTY"},
  {code: 69, fullName: "GASLIMIT"},
  {code: 70, fullName: "CHAINID"},
  {code: 71, fullName: "SELFBALANCE"},
  {code: 80, fullName: "POP"},
  {code: 81, fullName: "MLOAD"},
  {code: 82, fullName: "MSTORE"},
  {code: 83, fullName: "MSTORE8"},
  {code: 84, fullName: "SLOAD"},
  {code: 85, fullName: "SSTORE"},
  {code: 86, fullName: "JUMP"},
  {code: 87, fullName: "JUMPI"},
  {code: 88, fullName: "PC"},
  {code: 89, fullName: "MSIZE"},
  {code: 90, fullName: "GAS"},
  {code: 91, fullName: "JUMPDEST"},
  {code: 96, fullName: "PUSH1"},
  {code: 97, fullName: "PUSH2"},
  {code: 98, fullName: "PUSH3"},
  {code: 99, fullName: "PUSH4"},
  {code: 100, fullName: "PUSH5"},
  {code: 101, fullName: "PUSH6"},
  {code: 102, fullName: "PUSH7"},
  {code: 103, fullName: "PUSH8"},
  {code: 104, fullName: "PUSH9"},
  {code: 105, fullName: "PUSH10"},
  {code: 106, fullName: "PUSH11"},
  {code: 107, fullName: "PUSH12"},
  {code: 108, fullName: "PUSH13"},
  {code: 109, fullName: "PUSH14"},
  {code: 110, fullName: "PUSH15"},
  {code: 111, fullName: "PUSH16"},
  {code: 112, fullName: "PUSH17"},
  {code: 113, fullName: "PUSH18"},
  {code: 114, fullName: "PUSH19"},
  {code: 115, fullName: "PUSH20"},
  {code: 116, fullName: "PUSH21"},
  {code: 117, fullName: "PUSH22"},
  {code: 118, fullName: "PUSH23"},
  {code: 119, fullName: "PUSH24"},
  {code: 120, fullName: "PUSH25"},
  {code: 121, fullName: "PUSH26"},
  {code: 122, fullName: "PUSH27"},
  {code: 123, fullName: "PUSH28"},
  {code: 124, fullName: "PUSH29"},
  {code: 125, fullName: "PUSH30"},
  {code: 126, fullName: "PUSH31"},
  {code: 127, fullName: "PUSH32"},
  {code: 128, fullName: "DUP1"},
  {code: 129, fullName: "DUP2"},
  {code: 130, fullName: "DUP3"},
  {code: 131, fullName: "DUP4"},
  {code: 132, fullName: "DUP5"},
  {code: 133, fullName: "DUP6"},
  {code: 134, fullName: "DUP7"},
  {code: 135, fullName: "DUP8"},
  {code: 136, fullName: "DUP9"},
  {code: 137, fullName: "DUP10"},
  {code: 138, fullName: "DUP11"},
  {code: 139, fullName: "DUP12"},
  {code: 140, fullName: "DUP13"},
  {code: 141, fullName: "DUP14"},
  {code: 142, fullName: "DUP15"},
  {code: 143, fullName: "DUP16"},
  {code: 144, fullName: "SWAP1"},
  {code: 145, fullName: "SWAP2"},
  {code: 146, fullName: "SWAP3"},
  {code: 147, fullName: "SWAP4"},
  {code: 148, fullName: "SWAP5"},
  {code: 149, fullName: "SWAP6"},
  {code: 150, fullName: "SWAP7"},
  {code: 151, fullName: "SWAP8"},
  {code: 152, fullName: "SWAP9"},
  {code: 153, fullName: "SWAP10"},
  {code: 154, fullName: "SWAP11"},
  {code: 155, fullName: "SWAP12"},
  {code: 156, fullName: "SWAP13"},
  {code: 157, fullName: "SWAP14"},
  {code: 158, fullName: "SWAP15"},
  {code: 159, fullName: "SWAP16"},
  {code: 160, fullName: "LOG0"},
  {code: 161, fullName: "LOG1"},
  {code: 162, fullName: "LOG2"},
  {code: 163, fullName: "LOG3"},
  {code: 164, fullName: "LOG4"},
  {code: 240, fullName: "CREATE"},
  {code: 241, fullName: "CALL"},
  {code: 242, fullName: "CALLCODE"},
  {code: 243, fullName: "RETURN"},
  {code: 244, fullName: "DELEGATECALL"},
  {code: 245, fullName: "CREATE2"},
  {code: 250, fullName: "STATICCALL"},
  {code: 253, fullName: "REVERT"},
  {code: 254, fullName: "INVALID"},
  {code: 255, fullName: "SELFDESTRUCT"},
].map(op => ({
  hex: pad(op.code.toString(16), 2),
  asm: op.fullName,
}))
