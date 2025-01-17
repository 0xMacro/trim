import { BytecodeAstNode, MacroDefs, MacroFn, SexpNode } from "../types";
import { keccak256 } from '@ethersproject/keccak256'
import { createContext, runInNewContext } from 'vm';
import { autoPad, decToHex } from "../util.js";

export const standardMacros: MacroDefs = {
  push(val) {
    return [{ type: 'exp', nodes: this.parseSexp(val) }]
  },

  math: makeMathMacro(),
  'math/ceil': makeMathMacro({ direction: 'ceil' }),
  'math/floor': makeMathMacro({ direction: 'floor' }),

  '+': makeMathOpMacro('+'),
  '-': makeMathOpMacro('-'),
  '*': makeMathOpMacro('*'),
  '/': makeMathOpMacro('/'),
  '//': makeMathOpMacro('/', 'math/floor'),

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

  'label/append'(labelNode, xNode) {
    const [label] = this.parseSexp(labelNode)
    if (label.type !== 'label') {
      throw new Error(`[trim] label/append expects a label as first argument`)
    }
    let xLabel = (() => {
      if (typeof xNode === 'string') {
        return xNode
      }
      const [x] = this.parseSexp(xNode)
      return (
        x.type === 'label' ? x.name :
        x.type === 'atom' ? x.name :
        null
      )
    })()
    if (!xLabel) {
      throw new Error(`[trim] label/append expects a label or atom as second argument`)
    }
    return [`${label.name}${xLabel}`]
  },

  // Empty definitions for simplifying logic elsewhere
  def() { return [] },
  compile() { return [] },
  defconst() { return [] },
  defcounter() { return [] },
  'counter/reset'() { return [] },
}

// Kinda roundabout way of doing this, but it's better than implementing an operator precedence parser I guess
function makeMathOpMacro(op: string, mathMacro='math'): MacroFn {
  return function mathOpMacro (...terms) {
    if (terms.length < 2) {
      throw new Error(`[trim] ${op} expects at least 2 arguments`)
    }
    const [first, ...rest] = terms
    return [
      rest.reduce((a, b) => {
        return [mathMacro, a, op, b]
      }, first)
    ]
  }
}

function makeMathMacro(options: { direction?: 'ceil' | 'floor' } = {}): MacroFn {
  return function mathMacro (...vals) {
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

    const mathExpression = validTerms.join(' ');

    // Sandbox
    const context = createContext({});
    let result = runInNewContext(mathExpression, context, {
      timeout: 100,
      displayErrors: true
    });

    if (typeof result !== 'number') {
      // TODO: Better error message (need reverse parser)
      throw new Error(`[trim] Math result is not a number: '${result}'`)
    }
    if (options.direction === 'ceil')  result = Math.ceil(result)
    if (options.direction === 'floor') result = Math.floor(result)

    return [`0x${decToHex(result)}`]
  }
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
  const restIndex = params.findIndex(p => p.startsWith('...'))
  if (restIndex >= 0 && restIndex !== params.length - 1) {
    throw new Error(`[trim] Macro '${name}' has a rest parameter, but it is not the last parameter`)
  }
  const hasRest = restIndex >= 0
  return function userMacro(...args) {
    if (hasRest) {
      args[restIndex] = args.slice(restIndex)
    }
    else if (args.length !== params.length) {
      throw new Error(`[trim] Macro '${name}' expects ${params.length} arguments, got ${args.length}`)
    }
    return body.flatMap(node =>
      walkReplace(node, new Map(params.map((param, i) => [param, args[i]]))))
  }
}


function walkReplace<T extends SexpNode>(exp: T, paramsToArg: Map<string, SexpNode>): SexpNode[] {
  if (Array.isArray(exp)) {
    return [exp.flatMap(node => walkReplace(node, paramsToArg))]
  }
  else if (typeof exp === 'string' && paramsToArg.has(exp)) {
    const replaced = paramsToArg.get(exp)!
    return exp.startsWith('...') ? replaced as any : [replaced]
  }
  return [exp] as any
}
