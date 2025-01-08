# Trim

Trim is a opcode-oriented programming language for the Ethereum Virtual Machine (EVM). It offers syntax for writing highly optimized code in a more readable manner, without introducing mental or complexity overhead.

- [Try it in your browser!](https://0xmacro.com/library/trim/repl)
- [See the ETH Global Talk](https://www.youtube.com/watch?v=J15hxPRflUg)
- [Read the slides](./trim-eth-global-2021.pdf)

## Getting Started

First install Trim (and ethereumjs/vm as you'll probably use its opcode definitions)

```
npm install trim-evm
```

Then use the binary...

```zsh
% trim myfile.trim
0x6100...

% echo '(ADD 0x00 0x01)' | trim
0x6001600001
```

...or import and compile:

```js
import { compileTrim } from 'trim-evm'

const bytecode = compileTrim('(ADD 0x00 0x01)')

console.log("Compile success! Resulting bytecode:", bytecode)
```

## Sample

Here's a template to get started writing a full smart contract with Trim:

```trim
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

```trim
PUSH1 0x20
PUSH2 0x1000
ADD
MLOAD
```

What Trim introduces is **s-expressions**. An s-expression allows you to write in opcode-arguments notation:

```trim
(MLOAD (ADD 0x1000 0x20))
```

This code is equivalent to the previous example.

You can also use the top operator (`_`) to refer to the top of the stack. The following examples are all equivalent:

```trim
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

```trim
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

```trim
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

### Notations

You can write hex (e.g. `0xfeed`) anywhere in Trim.

However, Trim also supports several numerical notations to help you write more readable code:

- Decimal (e.g. `15`)
- Words (e.g. `2words` is equivalent to `0x40` or `64`)
- Bytes (e.g. `4bytes` is equivalent to `0x04` or `4`)

All notations get translated to hex during compilation.

## Macros

Trim has some built-in macros. It has user-defined macros too.

### math

The `math` macro allows you to make compile-time calculations for more robust and readable code.

For example, this code copies the incoming function selector onto the stack:

```trim
(CALLDATACOPY (math 1word - 4bytes) 0 4bytes)
(MLOAD 0)
```

Personally, I find this a little more readable than `(CALLDATACOPY 0x1c 0 4)`.

### abi/fn-selector

A convenience macro to output function selector (also known an "function id") segment of an [ABI encoded function call](https://docs.soliditylang.org/en/v0.5.3/abi-spec.html#function-selector). Useful for running function-specific code.

```trim
(EQ (abi/fn-selector "foo()") DUP1)
(JUMPI #foo _)

; ...

#foo
; More code here
```

### push

Normally when you want to push literal value, you just simply write it, e.g. `(ADD 0x01 0x02)` or `(EQ "abc" _)`.

But what if you want to push a string onto the stack? Just use the `push` macro:

```trim
("Hi")      ; Error, invalid token
(push "Hi") ; Works!
```

### init-runtime-code

This is a simple macro for the standard "copy runtime code to memory and return it" part of deploying a smart contract – something virtually every contract will need.

With this macro, the following is a template that you can use to start writing any contract you want!

```trim
(init-runtime-code)
#runtime
;; TODO: Write code here!
```

### def

You can define your own macros using the `def` macro.

For example, a common pattern is to have a lookup table of function sigs to labels. This is what you would normally write, without macros:

```trim
;; Assumes function selector is already on top of the stack
(EQ (abi/fn-selector "decimals()") DUP1)
(JUMPI #decimals _)

(EQ (abi/fn-selector "balanceOf(address)") DUP1)
(JUMPI #balanceOf _)

;; ...

#decimals
JUMPDEST
;; Code for decimals()

#balanceOf
JUMPDEST
;; Code for balanceOf(address)
```

If you have quite a few of these, you could write a zero-cost macro abstraction to make the code a little nicer:

```trim
(def defun (sig label)
  (EQ (abi/fn-selector sig) DUP1)
  (JUMPI label _))
```

Then, rewrite the previous lookup table to use it:

```trim
(defun "decimals()" #decimals)
(defun "balanceOf(address)" #balanceOf)
```

Macros only rewrite terms, so there is no runtime cost to using a macro vs not using it.

### defcounter

The `defcounter` macro lets you define compile-time counters that can be incremented and used in expressions. This is useful for generating sequences of numbers or managing predefined memory slots.

Basic usage:

```trim
; Define a counter starting at 0
(defcounter my-counter)

; Define a counter with initial value
(defcounter slot 10)

; Use the counter value
(push (my-counter))  ; Pushes 0

; Increment and use
(push (slot ++))   ; Pushes 10 and increments afterwards
(push (slot))      ; Pushes 11

; Add to counter
(push (math 1word * (my-counter += 3)))  ; Adds 3 immediately and uses result
```

A common use case is managing memory slots ("registers") in a more maintainable way. For example:

```trim
; Define a counter for tracking memory slots
(defcounter reg-counter)

; Create a macro to define named memory registers
(def defreg (name)
  (def name () (math 1word * (reg-counter ++))))

; Define some named memory slots
(defreg $balance)
(defreg $owner)

; Use the named slots (they'll be at 0x00, 0x20, etc)
(MSTORE $balance 100)
(MSTORE $owner 0xabc...)
```

Trim evaluates all counter operations during compilation, resulting in fixed values in the final bytecode.

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
