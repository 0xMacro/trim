import { keccak256 } from "@ethersproject/keccak256"
import { AbiJsonFragment } from "../types.js"
import { pad } from "../util.js"
import { trim } from "../index.js"

export type StaticRouterModules = {
  name: string
  address: string
  abi: AbiJsonFragment[]
}[]

export type StaticRouterOptions = {
  diamondCompat?: boolean | 'deprioritized'
}

export function makeStaticRouter(modules: StaticRouterModules, options: StaticRouterOptions = {}): string {
  if (modules.length > 255) {
    throw new Error("[trim] Too many modules for static router (max 256)")
  }

  const dcompat = !!options.diamondCompat

  const fns = modules.flatMap((module, moduleIndex) =>
    module.abi
      .filter((fn) => fn.type === "function")
      .map((fn) => {
        const sig = `${fn.name}(${fn.inputs!.map((i) => i.type).join(",")})`
        return {
          sig: `0x${keccak256(Buffer.from(sig)).slice(2, 10)}`,
          moduleIndex: `0x${pad(moduleIndex.toString(16), 2)}`,
          comment: `${module.name}.${sig}`,
        }
      })
  )
  fns.sort((a, b) => a.sig.localeCompare(b.sig))

  return trim.source`
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
    (CALLDATACOPY (math $input + 1word - 4bytes) 0 4bytes)

    ;; Binary search data
    (defreg $bot)
    (defreg $top)
    (defreg $mid)
    (codecopy-word $top #function-count 2bytes)
    (MSTORE $top (SUB (MLOAD $top) 1))

    (defreg $current)
    (defreg $current-pos)

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

    ;; If we have a match, we're done. Else, continue searching.
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

    ${!dcompat ? '' : trim.source`
      ;; Diamond compatibility
      (MLOAD $input) ; Put on stack since we're only working with one value

      (JUMPI #facets (EQ (abi/fn-selector "facets()") DUP1))
      (JUMPI #facetAddress (EQ (abi/fn-selector "facetAddress(bytes4)") DUP1))
      (JUMPI #facetAddresses (EQ (abi/fn-selector "facetAddresses()") DUP1))
      (JUMPI #facetFunctionSelectors (EQ (abi/fn-selector "facetFunctionSelectors(address)") DUP1))

      (JUMP #nomatch-diamond)

      ;;
      ;; Macro definitions for all diamond loupe functions
      ;; At the start of a loup function, we can assume that memory is clean
      ;;
      (def write/setup ()
        (defreg $mem) ; Free memory pointer (for return data)
        (defreg $ret) ; Return data start position
        (MSTORE $mem $ret)
        (def write (value) (MSTORE (MLOAD $mem) value) (MSTORE $mem (ADD 1word (MLOAD $mem))))
        (def returnall () (RETURN $ret (SUB (MLOAD $mem) $ret)))
      )
      (def clear (reg) (MSTORE reg 0))
      (def loop (label ...body) label JUMPDEST ...body (JUMP label) (label/append label /break) JUMPDEST)

      #facetAddress
      JUMPDEST
      (scope
        (defcounter reg-counter)
        (defreg $$)

        (defreg $input)
        (clear $input)
        (CALLDATACOPY (math $input + 1word - 4bytes) 4bytes 4bytes)

        (defreg $i)
        (clear $i)

        (defreg $i-pos) ; No need to clear since we're MSTOREing into it

        (defreg $fn-count)
        (clear $fn-count)
        (codecopy-word $fn-count #function-count 2bytes)

        ;; Since loupes are called offchain, we don't have to be execution efficient.
        ;; Do a simple loop over all function selectors.
        (loop #find
          (JUMPI #find/break (EQ (MLOAD $i) $fn-count))
          (MSTORE $i-pos (ADD (MUL 5bytes (MLOAD $i)) #function-data))
          (codecopy-word $$ (MLOAD $i-pos) 4bytes)
          (JUMPI #found (EQ (MLOAD $input) (MLOAD $$)))
          (MSTORE $i (ADD 1 (MLOAD $i)))
        )
        (REVERT 0 0) ; No matching function selector

        #found
        JUMPDEST
        (clear $$)
        (codecopy-word $$ (ADD (MLOAD $i-pos) 4bytes) 1byte) ; Module index
        (codecopy-word $$ (ADD (MUL 20bytes (MLOAD $$)) #module-data) 20bytes) ; Module address
        (return (MLOAD $$))
      )

      #facetAddresses
      JUMPDEST
      (scope
        (defcounter reg-counter)
        (defreg $$)
        (codecopy-word $$ #module-count 1byte)

        (defreg $i)
        (MSTORE $i 0)

        (write/setup)

        (MLOAD $$) ; Put length on stack since we're only working with that one value

        (write 0x20) ; Array data start offset (abi encoding)
        (write DUP1) ; Array length

        (loop #build-item
          (JUMPI #build-item/break (EQ (MLOAD $i) DUP1))
          (codecopy-word $$ (ADD (MUL 20bytes (MLOAD $i)) #module-data) 20bytes)
          (write (MLOAD $$))
          (MSTORE $i (ADD 1 (MLOAD $i)))
        )
        (returnall)
      )

      #facetFunctionSelectors
      JUMPDEST
      (scope
        (defcounter reg-counter)
        (defreg $$)
        (clear $$)

        (defreg $input)
        (MSTORE $input (CALLDATALOAD 4))

        (defreg $i)
        (clear $i)

        (defreg $i-pos) ; No need to clear since we're MSTOREing into it

        (defreg $mod-i) ; Separate working register so we don't have to remember to clear it
        (clear $mod-i)

        (defreg $mod-addr) ; Separate working register so we don't have to remember to clear it
        (clear $mod-addr)

        (defreg $fn-count)
        (clear $fn-count)
        (codecopy-word $fn-count #function-count 2bytes)

        (defreg $total)
        (clear $total)

        (write/setup)

        (write 0x20) ; Array data start offset (abi encoding)
        (write 0)    ; Fill this in later

        ;; Since loupes are called offchain, we don't have to be execution efficient.
        ;; Do a simple loop over all function selectors.
        (loop #find
          (JUMPI #find/break (EQ (MLOAD $i) (MLOAD $fn-count)))
          (MSTORE $i-pos (ADD (MUL 5bytes (MLOAD $i)) #function-data))
          (MSTORE $i (ADD 1 (MLOAD $i)))

          (codecopy-word $mod-i (ADD 4bytes (MLOAD $i-pos)) 1byte)
          (codecopy-word $mod-addr (ADD (MUL 20bytes (MLOAD $mod-i)) #module-data) 20bytes)
          (JUMPI #find (ISZERO (EQ (MLOAD $mod-addr) (MLOAD $input))))

          (CODECOPY $$ (MLOAD $i-pos) 4bytes) ; bytes4 values are right-padded
          (write (MLOAD $$))
          (MSTORE $total (ADD 1 (MLOAD $total)))
        )
        (MSTORE (+ 0x20 $ret) (MLOAD $total)) ; Fill in array length
        (returnall)
      )

      #facets
      JUMPDEST
      (revert) ; TODO

      #nomatch-diamond
      JUMPDEST
    `}

    REVERT ; No matching function selector

    #function-count
    0x${pad(fns.length.toString(16), 4)}

    #function-data
    ${fns.map((fn) => `${fn.sig} ${fn.moduleIndex} ; ${fn.comment}`).join('\n')}

    #module-count
    0x${pad(modules.length.toString(16), 2)}

    #module-data
    ${modules.sort((a,b) => a.address.localeCompare(b.address)).map((module) => `${module.address} ; ${module.name}`).join('\n')}
  `
}
