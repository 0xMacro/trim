import { SexpNode } from "../types"
import { Pos } from "../util"

const WS = /(\s|\n|\r)/

type ParseOptions = {
  topLevel?: boolean
}
export function parseTrim(source: string, pos: Pos, options: ParseOptions = {}): SexpNode[] {
  const parsed: SexpNode[] = []
  while (pos.i < source.length) {
    while (pos.skipWhitespace(source)) { }

    const c = source[pos.i]
    if (!c)
      break

    if (c === ')') {
      pos.newcol()
      return parsed
    }
    else if (c === '(') {
      pos.newcol()
      parsed.push(parseTrim(source, pos))
    }
    else if (c === ';') {
      skipComment(source, pos)
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
  if (source[pos.i] === '"') {
    return readString(source, pos)
  }
  const start = pos.i
  while (pos.i < source.length) {
    const c = source[pos.i]
    if (WS.test(c) || c === ')' || c === ';') {
      break
    }
    pos.push(source)
  }
  const end = pos.i
  const atom = source.slice(start, end)
  return atom
}

function readString(source: string, pos: Pos) {
  if (source[pos.i] !== '"') {
    throw new Error(`[trim] Expected starting quote \`"\``)
  }
  const start = pos.i
  pos.newcol()
  while (pos.i < source.length) {
    const c = source[pos.i]
    if (c === '\n' || c === '\r') {
      throw new Error(`[trim] Expected end quote \`"\`, reached newline instead`)
    }
    if (c === '"') {
      pos.newcol()
      break
    }
    pos.newcol()
  }
  const end = pos.i
  const atom = source.slice(start, end)
  return atom
}

function skipComment(source: string, pos: Pos) {
  if (source[pos.i] !== ';') {
    throw new Error(`[trim] Expected comment semicolon \`;\``)
  }
  while (pos.i < source.length && source[pos.i] !== '\n') {
    pos.newcol()
  }
  pos.skipNewline(source)
}
