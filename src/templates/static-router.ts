import { keccak256 } from "@ethersproject/keccak256"
import { AbiJsonFragment } from "../types.js"
import { pad } from "../util.js"

export type StaticRouterModules = {
  name: string
  address: string
  abi: AbiJsonFragment[]
}[]
export function makeStaticRouter(modules: StaticRouterModules): string {
  if (modules.length > 255) {
    throw new Error("[trim] Too many modules for static router (max 256)")
  }

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

  return `
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
    0x${pad(fns.length.toString(16), 4)}

    #function-data
    ${fns.map((fn) => `${fn.sig} ${fn.moduleIndex} ; ${fn.comment}`).join('\n')}

    #module-count
    0x${pad(modules.length.toString(16), 2)}

    #module-data
    ${modules.map((module) => `${module.address} ; ${module.name}`).join('\n')}
  `
}
