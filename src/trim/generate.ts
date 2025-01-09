import { BytecodeAstNode, MacroDefs, OpcodeDef, OpcodeMeta, OpcodesByAsm, SexpNode, ToplevelSexp } from "../types"
import { prop, Prop, pad, getBackwardsFriendlyOpcodesByAsm, decToHex } from "../util.js"
import { defineMacro } from "./macros.js"

const HEX_VAL = /^0x[0-9a-fA-F]+$/
const DEC_VAL = /^[0-9]+$/
const BYTE_COUNT_VAL = /^([0-9]+)(byte|word)s?$/

const MACRO_LOOP_LIMIT = parseInt(process.env.MACRO_LOOP_LIMIT || '', 10) || 250

type GenerateBytecodeAstOptions = {
  macros: MacroDefs
  opcodes: OpcodeDef[]
}
export function generateBytecodeAst(sexps: ToplevelSexp, { opcodes, macros }: GenerateBytecodeAstOptions) {
  const opcodesByAsm = getBackwardsFriendlyOpcodesByAsm(opcodes)
  return sexps.flatMap(exp => _generateBytecodeAst(exp, { opcodesByAsm, macros, level: 0, limit: 0, inMacro: false }))
}

function _generateBytecodeAst(exp: SexpNode, ctx: {
  opcodesByAsm: OpcodesByAsm
  macros: MacroDefs
  level: number
  limit: number
  inMacro: boolean
}): BytecodeAstNode[] {
  const { opcodesByAsm } = ctx
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

    if (!ctx.macros[firstNode]) {
      throw new Error(`[trim] No such macro: '${firstNode}'`)
    }
    if (ctx.level + ctx.limit > MACRO_LOOP_LIMIT) {
      throw new Error(`[trim] Macro loop limit reached`)
    }

    if (firstNode === 'def') {
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

      ctx.macros[name] = defineMacro(name, params as string[], body)

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
      ctx.macros[name] = function counterMacro(op, inc) {
        let val = counter
        if (op === '++' || op === '+=') {
          const [amount] = inc
            ? _generateBytecodeAst(inc, { ...ctx, level: ctx.level + 1 })
            : [{ type: 'literal', subtype: 'hex', value: '01' }]

          if (amount.type !== 'literal' || amount.subtype !== 'hex') {
            throw new Error(`[trim] Invalid counter increment value`)
          }

          counter += parseInt(amount.value, 16)
          if (op === '+=') val = counter
          else if (inc) throw new Error(`[trim] Counter ++ does not take an increment value`)
        }

        return [{ type: 'literal', subtype: 'hex', value: decToHex(val) }]
      }

      return []
    }
    else {
      function parseSexp(sexp: SexpNode) {
        return _generateBytecodeAst(sexp, { ...ctx, inMacro: true, level: ctx.level + 1 })
      }
      const replaced = ctx.macros[firstNode].call({ parseSexp, level: ctx.level }, ...exp.slice(1))
      return replaced.flatMap(node => _generateBytecodeAst(node, { ...ctx, limit: ctx.limit + 1 }))
    }
  }
  else if (typeof exp !== 'string') {
    return [exp]
  }
  else if (ctx.macros[exp] && exp[0] === '$') {
    // Allow bare macro calls, e.g. `(push myMacro)
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

type GenerateBytecodeOptions = {
  macros: MacroDefs
  opcodes: OpcodeDef[]
  opcodesMetadata: Record<string, OpcodeMeta>
}
export function generateBytecode(ast: BytecodeAstNode[], { opcodes, macros, opcodesMetadata }: GenerateBytecodeOptions): string[] {
  const pc = prop(0)
  const inc = (byteCount: number) => pc(pc() + byteCount)
  const labels = {} as Record<string, number>
  const opcodesByAsm = getBackwardsFriendlyOpcodesByAsm(opcodes)

  let seenRuntime = false

  function registerLabel(name: string) {
    const isRuntime = seenRuntime
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

  const ast2 = ast.flatMap((node, i) => {
    if (node.type === 'literal' && node.subtype === 'hex') {
      inc(node.value.length / 2)
      return node.value
    }
    else if (node.type === 'op' || node.type === 'literal') {
      return _generateBytecode([node], {
        inc,
        macros,
        seenTop: () => false,
        level: 0,
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
        inc,
        macros,
        seenTop,
        level: 0,
        opcodesByAsm,
        registerLabel,
        opcodesMetadata,
        append(bytes) {
          trailingBytes.push(bytes)
        }
      })
      inc(trailingBytes.length)
      return bytes.concat(trailingBytes)
    }
    else if (node.type === 'top') {
      throw new Error(`[trim] Top expressions not allowed on top level`)
    }
    else if (node.type === 'label') {
      if (node.name in labels) {
        throw new Error(`[trim] Duplicate label definition: '${node.name}'`)
      }
      labels[node.name] = pc()
      if (node.name === '#runtime') {
        seenRuntime = true
      }
      return []
    }
    else {
      throw new Error(`[trim] Unexpected ${(node as any).type} node ${'name' in node ? `'${node.name}'` : ''}`)
    }
  })

  return ast2.map(node => typeof node === 'string' ? node : node())
}

function _generateBytecode(ast: BytecodeAstNode[], ctx: {
  inc: (byteCount: number) => void
  level: number
  append: (bytes: string) => void
  macros: MacroDefs
  seenTop: Prop<boolean>
  opcodesByAsm: OpcodesByAsm
  registerLabel: (name: string) => (() => string)
  opcodesMetadata: Record<string, OpcodeMeta>
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
      ctx.inc(1 + pushBytes.length / 2)
      return [
        ctx.opcodesByAsm['PUSH' + pushBytes.length / 2].hex,
        pushBytes,
      ]
    }
    else if (node.type === 'literal' && node.subtype === 'hex') {
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
