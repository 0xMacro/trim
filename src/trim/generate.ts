import { BytecodeAstNode, GenerateFeatures, MacroDefs, OpcodeDef, OpcodeMeta, OpcodesByAsm, SexpNode, ToplevelSexp } from "../types"
import { prop, Prop, pad, getBackwardsFriendlyOpcodesByAsm, decToHex, Counter } from "../util.js"
import { defineMacro } from "./macros.js"

const HEX_VAL = /^0x[0-9a-fA-F]+$/
const DEC_VAL = /^[0-9]+$/
const BYTE_COUNT_VAL = /^([0-9]+)(byte|word)s?$/

// Constant naming patterns
const DOLLAR_PREFIX_PATTERN = /^\$[A-Za-z0-9_\-$]*$/
const SCREAMING_SNAKE_PATTERN = /^[A-Z_][A-Z0-9_]*$/

function isValidConstantName(name: string): boolean {
  if (name.startsWith('$')) {
    return DOLLAR_PREFIX_PATTERN.test(name)
  }
  return SCREAMING_SNAKE_PATTERN.test(name)
}

function getConstantNameError(name: string): string {
  if (!name.startsWith('$') && !/^[A-Z_]/.test(name)) {
    return `Non-$-prefixed constants must start with uppercase letter or underscore`
  }
  if (name.startsWith('$') && !DOLLAR_PREFIX_PATTERN.test(name)) {
    return `$-prefixed constants must match pattern: $[A-Za-z0-9_-$]*`
  }
  if (!name.startsWith('$') && !SCREAMING_SNAKE_PATTERN.test(name)) {
    return `Non-$-prefixed constants must be in SCREAMING_SNAKE_CASE`
  }
  return 'Invalid constant name'
}

const MACRO_LOOP_LIMIT = parseInt(process.env.MACRO_LOOP_LIMIT || '', 10) || 250

type CompileOptions = {
  macros: MacroDefs
  opcodes: OpcodeDef[]
  opcodesMetadata: Record<string, OpcodeMeta>
  features: GenerateFeatures
}
export function generateBytecodeAst(sexps: ToplevelSexp, options: CompileOptions) {
  // Defensive copy as we'll be mutating macros
  options = { ...options }
  options.macros = { ...options.macros }
  const opcodesByAsm = getBackwardsFriendlyOpcodesByAsm(options.opcodes)
  return sexps.flatMap(exp => _generateBytecodeAst(exp, { options, opcodesByAsm, level: 0, limit: 0, inMacro: false }))
}

function _generateBytecodeAst(exp: SexpNode, ctx: {
  opcodesByAsm: OpcodesByAsm
  level: number
  limit: number
  inMacro: boolean
  options: CompileOptions
}): BytecodeAstNode[] {
  const { opcodesByAsm } = ctx
  const { macros } = ctx.options
  if (Array.isArray(exp)) {
    if (!exp.length) return []

    let firstNode = exp[0]!

    if (Array.isArray(firstNode) && exp.length === 1) {
      // Extraneous parens
      return _generateBytecodeAst(firstNode, ctx)
    }
    if (typeof firstNode !== 'string') {
      throw new Error(`[trim] Invalid expression: ${JSON.stringify(firstNode)}`)
    }

    if (opcodesByAsm[firstNode]) {
      return [{ type: 'exp', nodes: exp.flatMap(e => _generateBytecodeAst(e, { ...ctx, level: ctx.level + 1 })) }]
    }

    if (!macros[firstNode]) {
      throw new Error(`[trim] No such macro: '${firstNode}'`)
    }
    if (ctx.level + ctx.limit > MACRO_LOOP_LIMIT) {
      throw new Error(`[trim] Macro loop limit reached`)
    }

    if (firstNode === 'scope') {
      if (ctx.level > 0) {
        throw new Error(`[trim] 'scope' macro can only be on top level`)
      }
      let scope = { ...macros }
      return [{
        type: 'scope',
        nodes: exp.slice(1).flatMap(e => _generateBytecodeAst(e, { ...ctx, options: { ...ctx.options, macros: scope } }))
      }]
    }
    else if (firstNode === 'def') {
      if (ctx.level > 1) {
        throw new Error(`[trim] 'def' macro can only be on top level`)
      }

      const [name, params] = exp.slice(1,3)
      const body = exp.slice(3)

      if (typeof name !== 'string') {
        throw new Error(`[trim] invalid def name`)
      }

      if (!Array.isArray(params)) {
        throw new Error(`[trim] def '${name}' is missing parameters`)
      }
      for (let node of params) {
        if (typeof node !== 'string') {
          throw new Error(`[trim] Invalid def '${name}' parameter type: '${node}'`)
        }
      }

      macros[name] = defineMacro(name, params as string[], body)

      return []
    }
    else if (firstNode === 'defcounter') {
      const [name, startNode] = exp.slice(1)
      if (typeof name !== 'string') {
        throw new Error(`[trim] defcounter requires a name`)
      }
      const start = (function () {
        if (!startNode) return 0
        const [s] = _generateBytecodeAst(startNode, { ...ctx, level: ctx.level + 1 })
        if (s.type !== 'literal' || s.subtype !== 'hex') {
          throw new Error(`[trim] defcounter requires a literal start value`)
        }
        return parseInt(s.value, 16)
      })()

      let counter = start
      macros[name] = function counterMacro(op, inc) {
        let val = counter
        if (op === '++' || op === '+=' || op === '=') {
          const [amount] = inc
            ? _generateBytecodeAst(inc, { ...ctx, level: ctx.level + 1 })
            : [{ type: 'literal', subtype: 'hex', value: '01' }]

          if (amount.type !== 'literal' || amount.subtype !== 'hex') {
            throw new Error(`[trim] Invalid counter increment value`)
          }

          counter = (op === '=' ? 0 : counter) + parseInt(amount.value, 16)
          if (op !== '++') val = counter
          else if (inc) throw new Error(`[trim] Counter ++ does not take an increment value`)
        }
        else if (op) {
          throw new Error(`[trim] Unknown counter operation: '${op}'`)
        }

        return [{ type: 'literal', subtype: 'hex', value: decToHex(val) }]
      }

      return []
    }
    else if (firstNode === 'counter/reset') {
      const [counter, startNode] = exp.slice(1)
      const start = (function () {
        if (!startNode) return '0'
        const [s] = _generateBytecodeAst(startNode, { ...ctx, level: ctx.level + 1 })
        if (s.type !== 'literal' || s.subtype !== 'hex') {
          throw new Error(`[trim] invalid counter/reset start value`)
        }
        return s
      })()

      _generateBytecodeAst([counter, '=', start], ctx) // mutate counter
      return []
    }
    else if (firstNode === 'defconst') {
      const [name, valueNode] = exp.slice(1)
      if (typeof name !== 'string') {
        throw new Error(`[trim] defconst requires a name`)
      }
      if (!isValidConstantName(name)) {
        throw new Error(`[trim] ${getConstantNameError(name)}: '${name}'`)
      }
      const [value] = _generateBytecodeAst(valueNode, { ...ctx, level: ctx.level + 1 })
      if (value.type !== 'literal' || value.subtype !== 'hex') {
        throw new Error(`[trim] const requires a literal value`)
      }
      return _generateBytecodeAst(['def', name, [], value], ctx)
    }
    else if (firstNode === 'compile') {
      const ast = exp.slice(1).flatMap(e => _generateBytecodeAst(e, {
        level: 0,
        limit: 0,
        inMacro: false,
        options: { ...ctx.options, macros: { ...ctx.options.macros } },
        opcodesByAsm,
      }))
      const bytecode = generateBytecode(ast, ctx.options).join('')
      return [{ type: 'literal', subtype: 'hex', value: bytecode }]
    }
    else {
      function parseSexp(sexp: SexpNode) {
        return _generateBytecodeAst(sexp, { ...ctx, inMacro: true, level: ctx.level + 1 })
      }
      const replaced = macros[firstNode].call({ parseSexp, level: ctx.level }, ...exp.slice(1))
      return replaced.flatMap(node => _generateBytecodeAst(node, { ...ctx, limit: ctx.limit + 1 }))
    }
  }
  else if (typeof exp !== 'string') {
    return [exp]
  }
  else if (macros[exp] && isValidConstantName(exp)) {
    // Allow bare macro calls, e.g. `(push $myMacro)` or `(push MY_CONST)`
    return _generateBytecodeAst([exp], ctx)
  }
  else if (exp === '_') {
    return [{ type: 'top' }]
  }
  else if (exp[0] === '#') {
    return [{ type: 'label', name: exp }]
  }
  else if (exp.startsWith('"') && exp.endsWith('"')) {
    return [{ type: 'literal', subtype: 'string', value: exp.slice(1, exp.length - 1) }]
  }
  else if (HEX_VAL.test(exp)) {
    let bytes = exp.slice(2)
    if (bytes.length % 2 === 1) {
      bytes = '0' + bytes.slice(2)
    }
    return [{ type: 'literal', subtype: 'hex', value: bytes }]
  }
  else if (DEC_VAL.test(exp)) {
    return [{ type: 'literal', subtype: 'hex', value: decToHex(parseInt(exp, 10)) }]
  }
  else if (BYTE_COUNT_VAL.test(exp)) {
    const m = exp.match(BYTE_COUNT_VAL)!
    const count = parseInt(m[1], 10)
    const mult = m[2] === 'byte' ? 1 : 32
    return [{ type: 'literal', subtype: 'hex', value: decToHex(count * mult) }]
  }
  else if (opcodesByAsm[exp]) {
    const op = opcodesByAsm[exp]
    return [{ type: 'op', bytes: op.hex, push: op.asm.startsWith('PUSH') }]
  }
  else {
    throw new Error(`[trim] Invalid token: '${exp}'`)
  }
}

type GenerateContext = {
  pc: Counter
  level: number
  labels: Record<string, number>
  options: CompileOptions
  seenRuntime: Prop<boolean>
}
export function generateBytecode(ast: BytecodeAstNode[], options: CompileOptions): string[] {
  const nodes = _generateBytecodeToplevel(ast, { pc: new Counter(), labels: {}, level: 0, options, seenRuntime: prop(false) })
  return nodes.map(node => typeof node === 'string' ? node : node())
}

export function _generateBytecodeToplevel(ast: BytecodeAstNode[], ctx: GenerateContext): (string | (() => string))[] {
  const { pc, labels } = ctx
  const { opcodes, opcodesMetadata, features } = ctx.options
  const opcodesByAsm = getBackwardsFriendlyOpcodesByAsm(opcodes)

  function registerLabel(name: string) {
    const isRuntime = ctx.seenRuntime()
    return function resolveLabel() {
      if (labels[name] === undefined)
        throw new Error(`[trim] No such label: '${name}'`)
      let pc = labels[name]
      if (isRuntime) {
        pc -= labels['#runtime']
      }
      return pad(pc.toString(16), 4)
    }
  }

  return ast.flatMap((node, i) => {
    if (node.type === 'scope') {
      return _generateBytecodeToplevel(node.nodes, { ...ctx, pc, labels: Object.create(labels), level: ctx.level + 1 })
    }
    else if (node.type === 'literal' && node.subtype === 'hex') {
      pc.inc(node.value.length / 2)
      return node.value
    }
    else if (node.type === 'op' || node.type === 'literal') {
      return _generateBytecode([node], {
        inc: pc.inc,
        seenTop: () => false,
        level: 0,
        features,
        opcodesByAsm,
        registerLabel,
        opcodesMetadata,
        append: () => {},
      })
    }
    else if (node.type === 'exp') {
      const seenTop = prop(false)
      const trailingBytes: string[] = []
      const bytes = _generateBytecode(node.nodes, {
        inc: pc.inc,
        seenTop,
        level: 0,
        features,
        opcodesByAsm,
        registerLabel,
        opcodesMetadata,
        append(bytes) {
          trailingBytes.push(bytes)
        }
      })
      pc.inc(trailingBytes.length)
      return bytes.concat(trailingBytes)
    }
    else if (node.type === 'top') {
      throw new Error(`[trim] Top expressions not allowed on top level`)
    }
    else if (node.type === 'label') {
      if (node.name in labels) {
        throw new Error(`[trim] Duplicate label definition: '${node.name}'`)
      }
      labels[node.name] = pc.value
      if (node.name === '#runtime') {
        ctx.seenRuntime(true)
      }
      return []
    }
    else {
      throw new Error(`[trim] Unexpected ${(node as any).type} node ${'name' in node ? `'${node.name}'` : ''}`)
    }
  })
}

function _generateBytecode(ast: BytecodeAstNode[], ctx: {
  inc: (byteCount: number) => void
  level: number
  append: (bytes: string) => void
  seenTop: Prop<boolean>
  opcodesByAsm: OpcodesByAsm
  registerLabel: (name: string) => (() => string)
  opcodesMetadata: Record<string, OpcodeMeta>
  features: GenerateFeatures
}): (string | (() => string))[] {
  return ast.slice().reverse().flatMap((node, i, exp) => {
    if (node.type === 'top' && ctx.seenTop()) {
      throw new Error(`[trim] Multiple top expressions (TODO)`)
    }
    else if (node.type === 'top') {
      ctx.seenTop(true)
      if (i === 0) {
        // Top expressions as the last item in an sexp naturally uses the top item in the stack
        return []
      }
      if (i === 1) {
        ctx.inc(1)
        return [ctx.opcodesByAsm.SWAP1.hex]
      }

      const firstNode = exp[exp.length - 1] // We reversed the array
      if (firstNode.type === 'op' && ctx.opcodesMetadata[firstNode.bytes].pushes === 1) {
        ctx.append(ctx.opcodesByAsm.SWAP1.hex)
      }
      ctx.append(ctx.opcodesByAsm.POP.hex)
      ctx.inc(2)
      return [
        ctx.opcodesByAsm.DUP1.hex,
        ctx.opcodesByAsm['SWAP' + (i + 1)].hex,
      ]
    }
    else if (node.type === 'literal' && node.subtype === 'string') {
      const pushBytes = Buffer.from(node.value).toString('hex')
      if (/^0+$/.test(pushBytes) && ctx.features.push0) {
        ctx.inc(1)
        return [ctx.opcodesByAsm.PUSH0.hex]
      }
      ctx.inc(1 + pushBytes.length / 2)
      return [
        ctx.opcodesByAsm['PUSH' + pushBytes.length / 2].hex,
        pushBytes,
      ]
    }
    else if (node.type === 'literal' && node.subtype === 'hex') {
      if (/^0+$/.test(node.value) && ctx.features.push0) {
        ctx.inc(1)
        return [ctx.opcodesByAsm.PUSH0.hex]
      }
      ctx.inc(1 + node.value.length / 2)
      return [
        ctx.opcodesByAsm['PUSH' + node.value.length / 2].hex,
        node.value
      ]
    }
    else if (node.type === 'op') {
      ctx.inc(node.bytes.length / 2)
      return node.bytes
    }
    else if (node.type === 'exp') {
      return _generateBytecode(node.nodes, { ...ctx, level: ctx.level + 1 })
    }
    else if (node.type === 'label') {
      ctx.inc(3)
      return [
        ctx.opcodesByAsm.PUSH2.hex,
        ctx.registerLabel(node.name)
      ]
    }
    else {
      throw new Error(`[trim] Unexpected node type '${(node as any).type}' (2)`)
    }
  })
}
