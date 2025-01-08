export const standardOpcodes = [
  {
    "hex": "00",
    "asm": "STOP"
  },
  {
    "hex": "01",
    "asm": "ADD"
  },
  {
    "hex": "02",
    "asm": "MUL"
  },
  {
    "hex": "03",
    "asm": "SUB"
  },
  {
    "hex": "04",
    "asm": "DIV"
  },
  {
    "hex": "05",
    "asm": "SDIV"
  },
  {
    "hex": "06",
    "asm": "MOD"
  },
  {
    "hex": "07",
    "asm": "SMOD"
  },
  {
    "hex": "08",
    "asm": "ADDMOD"
  },
  {
    "hex": "09",
    "asm": "MULMOD"
  },
  {
    "hex": "0a",
    "asm": "EXP"
  },
  {
    "hex": "0b",
    "asm": "SIGNEXTEND"
  },
  {
    "hex": "10",
    "asm": "LT"
  },
  {
    "hex": "11",
    "asm": "GT"
  },
  {
    "hex": "12",
    "asm": "SLT"
  },
  {
    "hex": "13",
    "asm": "SGT"
  },
  {
    "hex": "14",
    "asm": "EQ"
  },
  {
    "hex": "15",
    "asm": "ISZERO"
  },
  {
    "hex": "16",
    "asm": "AND"
  },
  {
    "hex": "17",
    "asm": "OR"
  },
  {
    "hex": "18",
    "asm": "XOR"
  },
  {
    "hex": "19",
    "asm": "NOT"
  },
  {
    "hex": "1a",
    "asm": "BYTE"
  },
  {
    "hex": "1b",
    "asm": "SHL"
  },
  {
    "hex": "1c",
    "asm": "SHR"
  },
  {
    "hex": "1d",
    "asm": "SAR"
  },
  {
    "hex": "20",
    "asm": "KECCAK256"
  },
  {
    "hex": "30",
    "asm": "ADDRESS"
  },
  {
    "hex": "31",
    "asm": "BALANCE"
  },
  {
    "hex": "32",
    "asm": "ORIGIN"
  },
  {
    "hex": "33",
    "asm": "CALLER"
  },
  {
    "hex": "34",
    "asm": "CALLVALUE"
  },
  {
    "hex": "35",
    "asm": "CALLDATALOAD"
  },
  {
    "hex": "36",
    "asm": "CALLDATASIZE"
  },
  {
    "hex": "37",
    "asm": "CALLDATACOPY"
  },
  {
    "hex": "38",
    "asm": "CODESIZE"
  },
  {
    "hex": "39",
    "asm": "CODECOPY"
  },
  {
    "hex": "3a",
    "asm": "GASPRICE"
  },
  {
    "hex": "3b",
    "asm": "EXTCODESIZE"
  },
  {
    "hex": "3c",
    "asm": "EXTCODECOPY"
  },
  {
    "hex": "3d",
    "asm": "RETURNDATASIZE"
  },
  {
    "hex": "3e",
    "asm": "RETURNDATACOPY"
  },
  {
    "hex": "3f",
    "asm": "EXTCODEHASH"
  },
  {
    "hex": "40",
    "asm": "BLOCKHASH"
  },
  {
    "hex": "41",
    "asm": "COINBASE"
  },
  {
    "hex": "42",
    "asm": "TIMESTAMP"
  },
  {
    "hex": "43",
    "asm": "NUMBER"
  },
  {
    "hex": "44",
    "asm": "PREVRANDAO"
  },
  {
    "hex": "45",
    "asm": "GASLIMIT"
  },
  {
    "hex": "46",
    "asm": "CHAINID"
  },
  {
    "hex": "47",
    "asm": "SELFBALANCE"
  },
  {
    "hex": "48",
    "asm": "BASEFEE"
  },
  {
    "hex": "49",
    "asm": "BLOBHASH"
  },
  {
    "hex": "4a",
    "asm": "BLOBBASEFEE"
  },
  {
    "hex": "50",
    "asm": "POP"
  },
  {
    "hex": "51",
    "asm": "MLOAD"
  },
  {
    "hex": "52",
    "asm": "MSTORE"
  },
  {
    "hex": "53",
    "asm": "MSTORE8"
  },
  {
    "hex": "54",
    "asm": "SLOAD"
  },
  {
    "hex": "55",
    "asm": "SSTORE"
  },
  {
    "hex": "56",
    "asm": "JUMP"
  },
  {
    "hex": "57",
    "asm": "JUMPI"
  },
  {
    "hex": "58",
    "asm": "PC"
  },
  {
    "hex": "59",
    "asm": "MSIZE"
  },
  {
    "hex": "5a",
    "asm": "GAS"
  },
  {
    "hex": "5b",
    "asm": "JUMPDEST"
  },
  {
    "hex": "5c",
    "asm": "TLOAD"
  },
  {
    "hex": "5d",
    "asm": "TSTORE"
  },
  {
    "hex": "5e",
    "asm": "MCOPY"
  },
  {
    "hex": "5f",
    "asm": "PUSH0"
  },
  {
    "hex": "60",
    "asm": "PUSH1"
  },
  {
    "hex": "61",
    "asm": "PUSH2"
  },
  {
    "hex": "62",
    "asm": "PUSH3"
  },
  {
    "hex": "63",
    "asm": "PUSH4"
  },
  {
    "hex": "64",
    "asm": "PUSH5"
  },
  {
    "hex": "65",
    "asm": "PUSH6"
  },
  {
    "hex": "66",
    "asm": "PUSH7"
  },
  {
    "hex": "67",
    "asm": "PUSH8"
  },
  {
    "hex": "68",
    "asm": "PUSH9"
  },
  {
    "hex": "69",
    "asm": "PUSH10"
  },
  {
    "hex": "6a",
    "asm": "PUSH11"
  },
  {
    "hex": "6b",
    "asm": "PUSH12"
  },
  {
    "hex": "6c",
    "asm": "PUSH13"
  },
  {
    "hex": "6d",
    "asm": "PUSH14"
  },
  {
    "hex": "6e",
    "asm": "PUSH15"
  },
  {
    "hex": "6f",
    "asm": "PUSH16"
  },
  {
    "hex": "70",
    "asm": "PUSH17"
  },
  {
    "hex": "71",
    "asm": "PUSH18"
  },
  {
    "hex": "72",
    "asm": "PUSH19"
  },
  {
    "hex": "73",
    "asm": "PUSH20"
  },
  {
    "hex": "74",
    "asm": "PUSH21"
  },
  {
    "hex": "75",
    "asm": "PUSH22"
  },
  {
    "hex": "76",
    "asm": "PUSH23"
  },
  {
    "hex": "77",
    "asm": "PUSH24"
  },
  {
    "hex": "78",
    "asm": "PUSH25"
  },
  {
    "hex": "79",
    "asm": "PUSH26"
  },
  {
    "hex": "7a",
    "asm": "PUSH27"
  },
  {
    "hex": "7b",
    "asm": "PUSH28"
  },
  {
    "hex": "7c",
    "asm": "PUSH29"
  },
  {
    "hex": "7d",
    "asm": "PUSH30"
  },
  {
    "hex": "7e",
    "asm": "PUSH31"
  },
  {
    "hex": "7f",
    "asm": "PUSH32"
  },
  {
    "hex": "80",
    "asm": "DUP1"
  },
  {
    "hex": "81",
    "asm": "DUP2"
  },
  {
    "hex": "82",
    "asm": "DUP3"
  },
  {
    "hex": "83",
    "asm": "DUP4"
  },
  {
    "hex": "84",
    "asm": "DUP5"
  },
  {
    "hex": "85",
    "asm": "DUP6"
  },
  {
    "hex": "86",
    "asm": "DUP7"
  },
  {
    "hex": "87",
    "asm": "DUP8"
  },
  {
    "hex": "88",
    "asm": "DUP9"
  },
  {
    "hex": "89",
    "asm": "DUP10"
  },
  {
    "hex": "8a",
    "asm": "DUP11"
  },
  {
    "hex": "8b",
    "asm": "DUP12"
  },
  {
    "hex": "8c",
    "asm": "DUP13"
  },
  {
    "hex": "8d",
    "asm": "DUP14"
  },
  {
    "hex": "8e",
    "asm": "DUP15"
  },
  {
    "hex": "8f",
    "asm": "DUP16"
  },
  {
    "hex": "90",
    "asm": "SWAP1"
  },
  {
    "hex": "91",
    "asm": "SWAP2"
  },
  {
    "hex": "92",
    "asm": "SWAP3"
  },
  {
    "hex": "93",
    "asm": "SWAP4"
  },
  {
    "hex": "94",
    "asm": "SWAP5"
  },
  {
    "hex": "95",
    "asm": "SWAP6"
  },
  {
    "hex": "96",
    "asm": "SWAP7"
  },
  {
    "hex": "97",
    "asm": "SWAP8"
  },
  {
    "hex": "98",
    "asm": "SWAP9"
  },
  {
    "hex": "99",
    "asm": "SWAP10"
  },
  {
    "hex": "9a",
    "asm": "SWAP11"
  },
  {
    "hex": "9b",
    "asm": "SWAP12"
  },
  {
    "hex": "9c",
    "asm": "SWAP13"
  },
  {
    "hex": "9d",
    "asm": "SWAP14"
  },
  {
    "hex": "9e",
    "asm": "SWAP15"
  },
  {
    "hex": "9f",
    "asm": "SWAP16"
  },
  {
    "hex": "a0",
    "asm": "LOG0"
  },
  {
    "hex": "a1",
    "asm": "LOG1"
  },
  {
    "hex": "a2",
    "asm": "LOG2"
  },
  {
    "hex": "a3",
    "asm": "LOG3"
  },
  {
    "hex": "a4",
    "asm": "LOG4"
  },
  {
    "hex": "f0",
    "asm": "CREATE"
  },
  {
    "hex": "f1",
    "asm": "CALL"
  },
  {
    "hex": "f2",
    "asm": "CALLCODE"
  },
  {
    "hex": "f3",
    "asm": "RETURN"
  },
  {
    "hex": "f4",
    "asm": "DELEGATECALL"
  },
  {
    "hex": "f5",
    "asm": "CREATE2"
  },
  {
    "hex": "fa",
    "asm": "STATICCALL"
  },
  {
    "hex": "fd",
    "asm": "REVERT"
  },
  {
    "hex": "fe",
    "asm": "INVALID"
  },
  {
    "hex": "ff",
    "asm": "SELFDESTRUCT"
  }
]
