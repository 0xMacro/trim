# Trim

Trim is a opcode-oriented programming language for the Ethereum Virtual Machine (EVM). It offers syntax for writing highly optimized code in a more readable manner, without introducing mental or complexity overhead.

- [Try it in your browser!](https://macro.cx/trim/repl)
- [See the ETH Global Talk](https://www.youtube.com/watch?v=J15hxPRflUg)
- [Read the slides](./trim-eth-global-2021.pdf)

## Getting Started

First install Trim (and ethereumjs/vm as you'll probably use its opcode definitions)

```
npm install @0xmacro/trim @ethereumjs/vm
```

Then just import and compile:

```js
import { compileTrim, getOpcodesForTrim } from '@0xmacro/trim'
import { getOpcodesForHF } from '@ethereumjs/vm/dist/evm/opcodes'
import Common, { Chain, Hardfork } from '@ethereumjs/common'

const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Berlin })
const opcodes = getOpcodesForTrim(getOpcodesForHF(common))

const bytecode = compileTrim('(ADD 0x00 0x01)', { opcodes })

console.log("Compile success! Resulting bytecode:", bytecode)
```

## Sample

Here's a template to get started writing a full smart contract with Trim:

```
(SUB CODESIZE #runtime)
DUP1
(CODECOPY 0x00 #runtime _)
(RETURN 0x00 _)

#runtime
(CALLDATACOPY 0x1c 0x00 0x04)
(MLOAD 0x00) ; copy function id onto the stack

(EQ (abi/fn-selector "hello()") DUP1)
(JUMPI #hello _)

REVERT ; No matching function id

#hello
(MSTORE 0x00 "Hello, world!")
(RETURN 0x00 0x20)
```

## Syntax

First and foremost, Trim is a superset of bare assembly. You can always write opcodes in a plain manner. For example, this is valid Trim:

```
PUSH1 0x20
PUSH2 0x1000
ADD
MLOAD
```

What Trim introduces is **s-expressions**. An s-expression allows you to write in opcode-arguments notation:

```
(MLOAD (ADD 0x1000 0x20))
```

This code is equivalent to the previous example.

You can also use the top operator (`_`) to refer to the top of the stack. The following examples are all equivalent:

```
; Example A
PUSH1 0x20
(ADD 0x1000 _)
(MLOAD _)

; Example B
(ADD 0x1000 0x20)
(MLOAD _)

; Example C
(ADD 0x1000 0x20)
MLOAD
```

Note how you don't have to write *all* your code in s-expressions.

## Features

When you write a Trim s-expression, you gain access to a few features. Aside from defining a label, these features are only accessible within s-expressions.

### Strings

Trim allows you to write double-quoted string literals. For example:

```
; Old way
PUSH12 0x48656c6c6f2c205472696d21
EQ

; New way
(EQ "Hello, Trim!" _)
```

### Labels

When deploying an EVM smart contract, you deploy both the **initialization code** and the **runtime code** as one long sequence of bytes. During this deployment transaction, the EVM will **run** this code, take its **return value**, and then **persist** this return value to the block chain. In other words, the value returned is the bytecode that will always run when future transactions are made to the new contract's address.

Unfortunately, writing in plain opcodes for this task is a big hassle, as it involves manually counting bytes and hardcoding those numbers into your code. Worse, if you add or remove lines of code during development, you will have to recount and update these hardcoded numbers before testing it again.

Trim solves this by introducing **labels**:

```
(SUB CODESIZE #runtime)
DUP1
(CODECOPY 0x00 #runtime _)
(RETURN 0x00 _)

#runtime
(MSTORE 0x00 "Hello, world!")
(RETURN 0x00 0x20)
```

In the above code, line 6 is a **label definition**, which ends up being 15 bytes:

- 3 bytes for each `#runtime` reference (each get compiled to a `PUSH2` statement)
- 2 bytes for each `0x00` (each get compiled to a `PUSH1` statement)
- 1 byte for each other opcode before the `#runtime` definition.

### The #runtime label

Trim treats a label named `#runtime` as a special case. If it's present, all labels defined **after** `#runtime` will automatically be offset by that amount. This is necessary to correct runtime label offsets, compensating for the removal of the init code.


## Macros

Trim has some built-in macros. In the future it will have user-defined macros too.

### push

Normally when you want to push literal value, you just simply write it, e.g. `(ADD 0x01 0x02)` or `(EQ "abc" _)`.

But what if you want to push a string onto the stack? Just use the `push` macro:

```
("Hi")      ; Error, invalid token
(push "Hi") ; Works!
```

### abi/fn-selector

A convenience macro to output function selector (also known an "function id") segment of an [ABI encoded function call](https://docs.soliditylang.org/en/v0.5.3/abi-spec.html#function-selector). Useful for running function-specific code.

```
(EQ (abi/fn-selector "foo()") DUP1)
(JUMPI #foo _)

; ...

#foo
; More code here
```

## Roadmap

These are some features we're considering adding to Trim. Create an issue to discuss or suggest more!

- [x] User-defined macros
- [ ] Defining labels with macros
- [ ] Hardhat integration
- [ ] More standard ABI macros
- [ ] Imports

## Developing

- Run `tsc --watch` then `npm test`
- Run `node update-opcodes.js` if/when the standard opcode list needs to be updated
