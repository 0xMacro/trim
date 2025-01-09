import o from 'ospec'
import {compileTrim} from '../dist/trim/index.js'
import {parseTrim} from '../dist/trim/parse.js'
import {compileBasm} from '../dist/basm.js'
import {Pos} from '../dist/util.js'

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
      0x33
      0x4455
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
      0x33
      0x4455
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('deep swap', function () {
    const source = `
      PUSH1 0x03
      (ADDMOD _ #after 0x01)
      #after
    `
    const expectedBasm = `
      PUSH1 0x03
      PUSH1 0x01
      PUSH2 0x000c
      DUP1
      SWAP3
      ADDMOD
      SWAP1
      POP
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('deep swap 2', function () {
    const source = `
      PUSH1 0x77
      (CALL _ 0xff 0xee 0xdd 0xcc 0xbb 0xaa)
    `
    const expectedBasm = `
      PUSH1 0x77
      PUSH1 0xaa
      PUSH1 0xbb
      PUSH1 0xcc
      PUSH1 0xdd
      PUSH1 0xee
      PUSH1 0xff
      DUP1
      SWAP7
      CALL
      SWAP1
      POP
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('deep swap with non-pushing opcode', function () {
    const source = `
      PUSH1 0x77
      (CALLDATACOPY _ 0xbb 0xaa)
    `
    const expectedBasm = `
      PUSH1 0x77
      PUSH1 0xaa
      PUSH1 0xbb
      DUP1
      SWAP3
      CALLDATACOPY
      POP
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })
})

o.spec('notations', function () {
  o('decimal', function () {
    const source = `
      (ADD 1 31)
    `
    const expectedBasm = `
      PUSH1 0x1f
      PUSH1 0x01
      ADD
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('byte', function () {
    const source = `
      (ADD 1byte 4bytes)
    `
    const expectedBasm = `
      PUSH1 0x04
      PUSH1 0x01
      ADD
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('word', function () {
    const source = `
      (ADD 1word 4words)
    `
    const expectedBasm = `
      PUSH1 0x80
      PUSH1 0x20
      ADD
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })
})

o.spec('math', function () {
  o('expression literals', function () {
    const source = `
      (push (math 1 + 2 * 30 / 4 - 5))
    `
    const expectedBasm = `
      PUSH1 0x0b
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('notations', function () {
    const source = `
      (push (math 0x20 * 4bytes))
    `
    const expectedBasm = `
      PUSH1 0x80
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('subexpressions', function () {
    const source = `
      (push (math 1 + (math 2 * 3)))
    `
    const expectedBasm = `
      PUSH1 0x07
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('throws on invalid terms', function () {
    try {
      compileTrim(`(push (math 1 + 2 blah))`)
      o('should not reach here').equals(false)
    }
    catch(err) {
      o(err.message).equals(`[trim] Invalid token: 'blah'`)
    }
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })


  o('defcounter', function () {
    const source = `
      (defcounter $a)
      (defcounter b 10)
      (defcounter c 200)
      (push $a)
      (push $a)
      (push (b ++))
      (push (b))
      (push (math ($a += 3) + (c ++)))
    `
    const expectedBasm = `
      PUSH1 0x00
      PUSH1 0x00
      PUSH1 0x0a
      PUSH1 0x0b
      PUSH1 0xcb
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
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
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('with multiple body expressions', function () {
    const source = `
      (def foo () (ADD 0x01 0x02) 0x03 (push 0x04))
      PUSH1 0x00
      (foo)
    `
    const expectedBasm = `
      PUSH1 0x00
      PUSH1 0x02
      PUSH1 0x01
      ADD
      0x03
      PUSH1 0x04
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('implicit calls for macros starting with dollar sign', function () {
    const source = `
      (def $foo () 0x07)
      (push $foo)
      (def $$ () 0x09)
      (push $$)
    `
    const expectedBasm = `
      PUSH1 0x07
      PUSH1 0x09
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))

    try {
      compileTrim(`(def no () 0x05) (push no)`)
      o('should not reach here').equals(false)
    }
    catch(err) {
      o(err.message).equals(`[trim] Invalid token: 'no'`)
    }
  })

  o('sugar compatibility', function () {
    const source = `
      (def x () 0x20)
      (x)
      (push (x))
    `
    const expectedBasm = `
      0x20
      PUSH1 0x20
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('with params', function () {
    const source = `
      (def foo (x) (x 0xee 0xff) x)
      (foo ADD)
    `
    const expectedBasm = `
      PUSH1 0xff
      PUSH1 0xee
      ADD
      ADD
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('using labels', function () {
    const source = `
      (def id (x) x)
      PUSH1 0x10
      #bar
      PUSH1 0x20
      (push (id #bar))
    `
    const expectedBasm = `
      PUSH1 0x10
      PUSH1 0x20
      PUSH2 0x0002
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('using a nested macro', function () {
    const source = `
      (def foo (s) (abi/fn-selector s))
      (foo "greet()")
    `
    const expectedBasm = `
      PUSH4 0xcfae3217
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })

  o('using a nested def', function () {
    const source = `
      (defcounter reg-counter)
      (def defreg (name) (def name () (math 1word * (reg-counter ++))))
      (defreg $a)
      (defreg $b)
      (MSTORE $a 0xaa)
      (MSTORE $b 0xbb)
    `
    const expectedBasm = `
      PUSH1 0xaa
      PUSH1 0x00
      MSTORE
      PUSH1 0xbb
      PUSH1 0x20
      MSTORE
    `
    o(compileTrim(source)).equals(compileBasm(expectedBasm))
  })
})

o.spec('trim errors', function () {
  const compile = (src) => compileTrim(src)

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
    // o(() => compileTrim(source)).throws('[trim] First token in an expression must be a valid opcode or macro')
  })
})
