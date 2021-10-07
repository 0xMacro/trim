import { OpcodeDef } from "./types"

export function pad(str: string, len: number, char='0') {
  for (let i=str.length; i < len; i++) {
    str = char + str
  }
  return str
}

export function getOpcodesByAsm(opcodes: OpcodeDef[]) {
  return opcodes.reduce((all, op) => {
    all[op.asm] = op
    return all
  }, {} as Record<string, OpcodeDef>)
}

export function notNullish<T>(x: T | null | undefined | false | 0): x is T {
  return !!x
}

export type Prop<T> = (newVal?: T) => T

export function prop<T>(value: T): Prop<T> {
  return (newVal?: T) => {
    if (newVal !== undefined) {
      value = newVal
    }
    return value
  }
}

export class Pos {
  constructor(public line=1, public col=1, public i=0) {}
  push(source: string) {
    this.skipNewline(source) || this.newcol()
    return this
  }
  newcol() {
    this.i += 1
    this.col += 1
    return this
  }
  newline(windowsLine=false) {
    this.i += (windowsLine ? 2 : 1)
    this.col = 1
    this.line += 1
  }
  copy() {
    return new Pos(this.line, this.col, this.i)
  }
  skipSpace(source: string) {
    if (source[this.i] === ' ' || source[this.i] === '\t') {
      this.newcol()
      return true
    }
    return false
  }
  skipNewline(source: string) {
    if (source[this.i] === '\n') {
      this.newline(source[this.i+1] === '\r')
      return true
    }
    return false
  }
  skipWhitespace(source: string) {
    if (this.i >= source.length) return false
    return this.skipSpace(source) || this.skipNewline(source)
  }
}
