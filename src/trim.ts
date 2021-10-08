import { BytecodeAstNode, OpcodeDef, OpcodesByAsm } from "./types"
import { getOpcodesByAsm, notNullish, prop, Prop, Pos, pad } from "./util"

const WS = /(\s|\n|\r)/

type ToplevelSexp = SexpNode[]

type SexpNode =
  | string
  | SexpNode[]


type CompileOptions = {
  opcodes: OpcodeDef[]
}
export function compileTrim(source: string, options: CompileOptions) {
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, options.opcodes)
  return '0x' + generateBytecode(ast, options.opcodes).join('')
}


type ParseOptions = {
  topLevel?: boolean
}
export function parseTrim(source: string, pos: Pos, options: ParseOptions = {}): SexpNode[] {
  const parsed: SexpNode[] = []
  while(pos.i < source.length) {
    while(pos.skipWhitespace(source)) {}

    const c = source[pos.i]
    if (!c) break

    if (c === ')') {
      pos.newcol()
      return parsed
    }
    else if (c === '(') {
      pos.newcol()
      parsed.push(parseTrim(source, pos))
    }
    else {
      parsed.push(readAtom(source, pos))
    }
  }
  if (!options.topLevel) {
    throw new Error(`EOF`)
  }
  return parsed
}

function readAtom(source: string, pos: Pos) {
  const start = pos.i
  while (pos.i < source.length) {
    const c = source[pos.i]
    if (WS.test(c) || c === ')') {
      break
    }
    pos.push(source)
  }
  const end = pos.i
  const atom = source.slice(start, end)
  return atom
}

const HEX_VAL = /^0x[0-9a-f]+$/

function generateBytecodeAst(sexps: ToplevelSexp, opcodes: OpcodeDef[]) {
  const opcodesByAsm = getOpcodesByAsm(opcodes)
  if (sexps.length === 2 && sexps[0] === 'PUSH2' && typeof sexps[1] === 'string' && sexps[1].startsWith('#')) {

  }
  return sexps.map(exp => _generateBytecodeAst(exp, opcodesByAsm, { isTopLevel: true }))
}

function _generateBytecodeAst(exp: SexpNode, opcodesByAsm: OpcodesByAsm, ctx: {
  isTopLevel: boolean
}): BytecodeAstNode {
  if (Array.isArray(exp)) {
    const nodes = exp.map(e => _generateBytecodeAst(e, opcodesByAsm, { ...ctx, isTopLevel: false }))
    if (nodes[0].type !== 'op') {
      throw new Error(`[trim] First token in an expression must be a valid opcode`)
    }
    if (
      nodes.length === 2 &&
      nodes[0].type === 'op' && nodes[0].bytes === opcodesByAsm.PUSH2.hex &&
      nodes[1].type === 'label'
    ) {
      return { type: 'exp', nodes: [nodes[1]] }2
    }
    return { type: 'exp', nodes }
  }
  else if (exp === '_') {
    return { type: 'top' }
  }
  else if (HEX_VAL.test(exp)) {
    let bytes = exp.slice(2)
    if (bytes.length % 2 === 1) {
      bytes = '0' + bytes
    }
    if (ctx.isTopLevel) {
      return { type: 'literal', bytes }
    }
    else {
      return { type: 'op', bytes: opcodesByAsm['PUSH' + bytes.length/2].hex, push: true, pushBytes: bytes }
    }
  }
  else if (exp[0] === '#') {
    return { type: 'label', name: exp }
  }
  else if (opcodesByAsm[exp]) {
    const op = opcodesByAsm[exp]
    return { type: 'op', bytes: op.hex, push: op.asm.startsWith('PUSH') }
  }
  else {
    throw new Error(`[trim] Invalid token: '${exp}'`)
  }
}

function generateBytecode(ast: BytecodeAstNode[], opcodes: OpcodeDef[]): string[] {
  const pc = prop(0)
  const inc = (byteCount: number) => pc(pc() + byteCount)
  const labels = {} as Record<string,number>
  const opcodesByAsm = getOpcodesByAsm(opcodes)

  function registerLabel (name: string) {
    return function resolveLabel () {
      if (labels[name] === undefined) throw new Error(`[trim] No such label: '${name}'`)
      const pc = labels[name].toString(16)
      return pad(pc, 4)
    }
  }

  const ast2 = ast.flatMap((node, i) => {
    if (node.type === 'op' || node.type === 'literal') {
      inc(node.bytes.length / 2)
      return node.bytes
    }
    else if (node.type === 'exp') {
      const seenTop = prop(false)
      const trailingBytes: string[] = []
      const bytes = _generateBytecode(node.nodes, {
        inc,
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
      labels[node.name] = pc() + 1
      return []
    }
    else {
      throw new Error(`[trim] Unexpected node type '${(node as any).type}' (1)`)
    }
  })
  return ast2.map(node => typeof node === 'string' ? node : node())
}

function _generateBytecode(ast: BytecodeAstNode[], ctx: {
  inc: (byteCount: number) => void
  level: number
  append: (bytes: string) => void
  seenTop: Prop<boolean>
  opcodesByAsm: OpcodesByAsm
  registerLabel: (name: string) => (() => string)
}): (string | (() => string))[] {

  return ast.slice().reverse().flatMap((node, i) => {
    if (node.type === 'top' && ctx.seenTop()) {
      throw new Error(`[trim] Multiple top expressions not allowed`)
    }
    else if (node.type === 'top' && ctx.level === 0) {
      ctx.seenTop(true)
      if (i === 0) {
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
        ctx.opcodesByAsm['SWAP' + (i+1)].hex,
      ]
    }
    else if (node.type === 'top' && ctx.level > 0) {
      throw new Error(`[scat] Deep top expression (TODO)`)
    }
    else if (node.type === 'top') {
      // Top expressions as the last item in an sexp naturally uses the top item in the stack
      ctx.seenTop(true)
      return []
    }
    else if (node.type === 'op') {
      if (node.push) {
        if (!node.pushBytes) {
          throw new Error(`[trim] Expected pushBytes`)
        }
        ctx.inc((node.bytes.length + node.pushBytes.length) / 2)
        return [node.bytes, node.pushBytes]
      }
      else {
        ctx.inc(node.bytes.length / 2)
        return node.bytes
      }
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
