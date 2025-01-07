import { BytecodeAstNode, MacroDefs, OpcodeDef, OpcodesByAsm, SexpNode, ToplevelSexp } from "../types"
import { prop, Prop, pad, getBackwardsFriendlyOpcodesByAsm } from "../util.js"
import { defineMacro } from "./macros.js"

const HEX_VAL = /^0x[0-9a-f]+$/
const DEC_VAL = /^[0-9]+$/

export function generateBytecodeAst(sexps: ToplevelSexp, opcodes: OpcodeDef[], macros: MacroDefs) {
  const opcodesByAsm = getBackwardsFriendlyOpcodesByAsm(opcodes)
  return sexps.map(exp => _generateBytecodeAst(exp, opcodesByAsm, { macros, level: 0, inMacro: false }))
}

function _generateBytecodeAst(exp: SexpNode, opcodesByAsm: OpcodesByAsm, ctx: {
  macros: MacroDefs
  level: number
  inMacro: boolean
}): BytecodeAstNode {
  if (Array.isArray(exp)) {
    if (!exp.length) return { type: 'exp', nodes: [] }

    const firstNode = _generateBytecodeAst(exp[0], opcodesByAsm, { ...ctx, level: ctx.level + 1 })

    if (firstNode.type === 'macro' && firstNode.name === 'def') {
      if (ctx.level > 1) {
        throw new Error(`[trim] 'def' macro can only be on top level`)
      }

      const [nameNode, paramsNode] = exp.slice(1,3).map(e =>
        _generateBytecodeAst(e, opcodesByAsm, { ...ctx, level: 0, inMacro: true })
      )
      const body = exp.slice(3)

      if (nameNode.type !== 'atom') {
        throw new Error(`[trim] invalid def name`)
      }
      const name = nameNode.name

      if (paramsNode.type !== 'exp') {
        throw new Error(`[trim] def '${name}' is missing parameters`)
      }
      const paramNames = paramsNode.nodes.map(node => {
        if (node.type !== 'atom') {
          throw new Error(`[trim] Invalid def '${name}' parameter type: '${node.type}'`)
        }
        return node.name
      })

      ctx.macros[name] = defineMacro(name, paramNames, body)

      return { type: 'exp', nodes: [] }
    }
    else if (!ctx.inMacro && firstNode.type !== 'op' && firstNode.type !== 'macro') {
      throw new Error(`[trim] First token in an expression must be a valid opcode or macro\n  Instead found: '${
        'name' in firstNode ? firstNode.name : firstNode.type}'`)
    }
    else {
      const restNodes = exp.slice(1).map(e => _generateBytecodeAst(e, opcodesByAsm, { ...ctx, level: ctx.level + 1 }))
      return { type: 'exp', nodes: ([] as typeof restNodes).concat(firstNode, restNodes) }
    }
  }
  else if (typeof exp !== 'string') {
    return exp
  }
  else if (exp === '_') {
    return { type: 'top' }
  }
  else if (exp[0] === '#') {
    return { type: 'label', name: exp }
  }
  else if (exp.startsWith('"') && exp.endsWith('"')) {
    return { type: 'literal', subtype: 'string', value: exp.slice(1, exp.length - 1) }
  }
  else if (HEX_VAL.test(exp)) {
    let bytes = exp.slice(2)
    if (bytes.length % 2 === 1) {
      bytes = '0' + bytes.slice(2)
    }
    return { type: 'literal', subtype: 'hex', value: bytes }
  }
  else if (DEC_VAL.test(exp)) {
    let bytes = parseInt(exp, 10).toString(16)
    if (bytes.length % 2 === 1) {
      bytes = '0' + bytes
    }
    return { type: 'literal', subtype: 'hex', value: bytes }
  }
  else if (opcodesByAsm[exp]) {
    const op = opcodesByAsm[exp]
    return { type: 'op', bytes: op.hex, push: op.asm.startsWith('PUSH') }
  }
  else if (ctx.macros[exp]) {
    return { type: 'macro', name: exp }
  }
  else if (/[a-z]/.test(exp[0])) {
    return { type: 'atom', name: exp }
  }
  else {
    throw new Error(`[trim] Invalid token: '${exp}'`)
  }
}

export function generateBytecode(ast: BytecodeAstNode[], opcodes: OpcodeDef[], macros: MacroDefs): string[] {
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
}): (string | (() => string))[] {

  let limit = parseInt(process.env.MACRO_LOOP_LIMIT || '', 10) || 250
  while (ast.length && ast[0].type === 'macro' && limit > 0) {
    ast = ctx.macros[ast[0].name].call({
      parseSexp(sexp) {
        return _generateBytecodeAst(sexp, ctx.opcodesByAsm, { ...ctx, inMacro: true })
      },
    }, ...ast.slice(1))
    ast = ast.reverse()
    limit -= 1
  }
  if (ast.length && ast[0].type === 'macro' && limit === 0) {
    throw new Error(`[trim] Macro loop limit reached`)
  }

  return ast.slice().reverse().flatMap((node, i) => {
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
