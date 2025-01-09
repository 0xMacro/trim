import { BytecodeAstNode, MacroDefs, MacroFn, SexpNode } from "../types";
import { keccak256 } from '@ethersproject/keccak256'
import { autoPad, decToHex } from "../util.js";

export const standardMacros: MacroDefs = {
  push(val) {
    return [{ type: 'exp', nodes: this.parseSexp(val) }]
  },

  math(...vals) {
    const validTerms: (string | number)[] = vals.map(term => {
      // Check for math specific terms first since these are not normally valid tokens
      if (typeof term === 'string' && /^(\+|-|\*|\/)/.test(term)) {
        return term
      }

      // Otherwise, resolve Trim terms as usual
      const [result] = this.parseSexp(term)
      if (result.type !== 'literal' || result.subtype !== 'hex') {
        // TODO: Better error message (need reverse parser)
        throw new Error(`[trim] Invalid math term: '${'name' in result ? result.name : JSON.stringify(result)}'`)
      }
      return parseInt(result.value, 16)
    })

    const result = eval(validTerms.join(' '))

    if (typeof result !== 'number') {
      // TODO: Better error message (need reverse parser)
      throw new Error(`[trim] Math result is not a number: '${result}'`)
    }

    return [`0x${decToHex(result)}`]
  },

  'abi/fn-selector'(functionSigString) {
    const [sig] = this.parseSexp(functionSigString)
    if (sig.type !== 'literal' || sig.subtype !== 'string') {
      throw new Error(`[trim] abi/fn-selector expects a string literal argument`)
    }
    const fnId = keccak256(Buffer.from(sig.value)).slice(2, 10)
    return [['push', `0x${fnId}`]]
  },

  'init-runtime-code'() {
    return [
      ['SUB', 'CODESIZE', '#runtime'],
      'DUP1',
      ['CODECOPY', '0x00', '#runtime', '_'],
      ['RETURN', '0x00', '_']
    ]
  },

  'revert': makeReMacro('REVERT'),
  'return': makeReMacro('RETURN'),

  // Empty definitions for simplifying logic elsewhere
  def() { return [] },
  defconst() { return [] },
  defcounter() { return [] },
}

function makeReMacro(opcode: 'REVERT' | 'RETURN'): MacroFn {
  let labelCounter = 0
  return function returnRevertMacro (msg, cond) {
    // It's safe to always thrash memory since we're about to exit anyway
    const ops = [
      ['MSTORE', '0', msg || '_'],
      [opcode, '0', '0x20'],
    ]
    if (cond) {
      // Support both (revert "msg" (term1 term2))
      // and (revert "msg" term1) syntax
      const _cond: SexpNode[][] = Array.isArray(cond) && Array.isArray(cond[0])
        ? cond as any
        : [cond]
      let label = `#${opcode.toLowerCase()}-if-skip-${labelCounter++}`
      return [
        ..._cond,
        ['ISZERO', '_'],
        ['JUMPI', label, '_'],
        ...ops,
        label,
        'JUMPDEST'
      ]
    }
    return ops
  }
}

export function defineMacro(name: string, params: string[], body: SexpNode[]): MacroFn {
  return function userMacro(...args) {
    if (args.length !== params.length) {
      throw new Error(`[trim] Macro '${name}' expects ${params.length} arguments, got ${args.length}`)
    }
    return walkReplace(body, new Map(params.map((param, i) => [param, args[i]])))
  }
}


function walkReplace<T extends SexpNode>(exp: T, paramsToArg: Map<string, SexpNode>): T extends Array<any> ? SexpNode[] : SexpNode {
  if (Array.isArray(exp)) {
    return exp.map(node => walkReplace(node, paramsToArg))
  }
  else if (typeof exp === 'string' && paramsToArg.has(exp)) {
    return paramsToArg.get(exp) as any
  }
  return exp as any
}
