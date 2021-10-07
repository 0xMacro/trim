import { OpcodeDef } from "./types"
import { getOpcodesByAsm, notNullish, Pos } from "./util"

const WS = /(\s|\n|\r)/

type ToplevelSexp = SexpNode[]

type SexpNode =
  | string
  | SexpNode[]

type BytecodeAstNode =
  | { type: 'op', bytes: string, push: boolean, pushBytes?: string }
  | { type: 'top' }
  | { type: 'literal', bytes: string }
  | { type: 'exp', nodes: BytecodeAstNode[] }

type CompileOptions = {
  opcodes: OpcodeDef[]
}
export function compileTrim(source: string, options: CompileOptions) {
  const program = parseTrim(source, new Pos(), { topLevel: true })
  const ast = generateBytecodeAst(program, options.opcodes)
  console.log("AST", require('util').inspect(ast, { depth: 10 }))
  return '0x' + generateBytecode(ast).join('')
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

    // console.log('c', c)
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
  // console.log("ATOM", start, end, atom)
  return atom
}

const HEX_VAL = /^0x[0-9a-f]+$/

function generateBytecodeAst(sexps: ToplevelSexp, opcodes: OpcodeDef[]) {
  const opcodesByAsm = getOpcodesByAsm(opcodes)
  return sexps.map(exp => _generateBytecodeAst(exp, opcodesByAsm, true))
}

function _generateBytecodeAst(exp: SexpNode, opcodesByAsm: Record<string, OpcodeDef>, isTopLevel: boolean): BytecodeAstNode {
  console.log('sexp', exp)
  if (Array.isArray(exp)) {
    return {
      type: 'exp',
      nodes: exp.map(e => _generateBytecodeAst(e, opcodesByAsm, false)),
    }
  }
  else if (exp === '_') {
    return { type: 'top' }
  }
  else if (HEX_VAL.test(exp)) {
    console.log("LALA", exp, isTopLevel)
    let bytes = exp.slice(2)
    if (bytes.length % 2 === 1) {
      bytes = '0' + bytes
    }
    if (isTopLevel) {
      return { type: 'literal', bytes }
    }
    else {
      return { type: 'op', bytes: opcodesByAsm['PUSH' + bytes.length/2].hex, push: true, pushBytes: bytes }
    }
  }
  else if (opcodesByAsm[exp]) {
    const op = opcodesByAsm[exp]
    return { type: 'op', bytes: op.hex, push: op.asm.startsWith('PUSH') }
  }
  else {
    throw new Error(`[trim] Invalid token: '${exp}'`)
  }
}

// PUSH1 0x0f
// (ADD (CALLDATALOAD (DIV _ 0x03) 0x01) 0x02)

// 0x0f | 0x02 (0x01 (0x03 _ DIV) CALLDATALOAD) ADD

function generateBytecode(ast: BytecodeAstNode[]): string[] {
  return ast.flatMap((node, i) => {
    if (node.type === 'op' || node.type === 'literal') {
      return node.bytes
    }
    else if (node.type === 'exp') {
      return _generateBytecode(node.nodes, { seenTop: false, level: 0 })
    }
    else if (node.type === 'top') {
      throw new Error(`[trim] Top expressions not allowed on top level`)
    }
    else {
      throw new Error(`[trim] Unexpected node type (1)`)
    }
  })
}

function _generateBytecode(ast: BytecodeAstNode[], ctx: { seenTop: boolean, level: number }): string[] {
  let seenTop = ctx.seenTop
  return ast.slice().reverse().flatMap((node, i) => {
    console.log('gen', node)
    if (node.type === 'top' && seenTop) {
      throw new Error(`[trim] Multiple top expressions not allowed`)
    }
    else if (node.type === 'top' && (i > 0 || ctx.level > 0)) {
      throw new Error(`[trim] Deep top expression (TODO)`)
    }
    else if (node.type === 'top') {
      // Top expressions as the last item in an sexp naturally uses the top item in the stack
      seenTop = true
      return []
    }
    else if (node.type === 'op') {
      if (node.push && !node.pushBytes) {
        throw new Error(`[trim] Expected pushBytes`)
      }
      return node.push ? [node.bytes, node.pushBytes!] : node.bytes
    }
    else if (node.type === 'exp') {
      return _generateBytecode(node.nodes, { seenTop, level: ctx.level + 1 })
    }
    else {
      throw new Error(`[trim] Unexpected node type (2)`)
    }
  })
}
