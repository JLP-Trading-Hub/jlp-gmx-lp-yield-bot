import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { privateKeyToAccount } from "viem/accounts";

export interface WalletIdentity {
  readonly chain: "solana" | "arbitrum";
  readonly address: string;
  readonly canSign: boolean;
}

export interface UnsignedTransaction {
  readonly chain: "solana" | "arbitrum";
  readonly description: string;
  readonly payload: string;
}

export interface SignedTransaction {
  readonly chain: "solana" | "arbitrum";
  readonly description: string;
  readonly serialized: string;
  readonly signer: string;
}

export interface ChainWallet {
  identity(): WalletIdentity;
  sign(transaction: UnsignedTransaction): Promise<SignedTransaction>;
}

function decodeBase58(input: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const char of input) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid base58 private key");
    number = number * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (number > 0n) {
    bytes.unshift(Number(number & 255n));
    number >>= 8n;
  }
  const leading = input.match(/^1*/)?.[0].length ?? 0;
  return Uint8Array.from([...Array(leading).fill(0), ...bytes]);
}

export class SolanaWalletAdapter implements ChainWallet {
  private readonly keypair?: Keypair;
  private readonly address: string;
  constructor(privateKey?: string, publicAddress?: string) {
    this.keypair = privateKey ? Keypair.fromSecretKey(decodeBase58(privateKey)) : undefined;
    this.address = this.keypair?.publicKey.toBase58() ?? new PublicKey(publicAddress ?? "11111111111111111111111111111111").toBase58();
  }
  identity(): WalletIdentity {
    return { chain: "solana", address: this.address, canSign: Boolean(this.keypair) };
  }
  async sign(transaction: UnsignedTransaction): Promise<SignedTransaction> {
    if (transaction.chain !== "solana") throw new Error("Solana wallet cannot sign non-Solana payload");
    if (!this.keypair) throw new Error("Solana wallet is watch-only");
    const parsed = Transaction.from(Buffer.from(transaction.payload, "base64"));
    parsed.partialSign(this.keypair);
    return { chain: "solana", description: transaction.description, serialized: parsed.serialize({ requireAllSignatures: false }).toString("base64"), signer: this.address };
  }
}

export class ArbitrumWalletAdapter implements ChainWallet {
  private readonly account?: ReturnType<typeof privateKeyToAccount>;
  constructor(privateKey?: string, private readonly watchAddress = "0x0000000000000000000000000000000000000000") {
    this.account = privateKey
      ? privateKeyToAccount(privateKey as `0x${string}`)
      : undefined;
  }
  identity(): WalletIdentity {
    return { chain: "arbitrum", address: this.account?.address ?? this.watchAddress, canSign: Boolean(this.account) };
  }
  async sign(transaction: UnsignedTransaction): Promise<SignedTransaction> {
    if (transaction.chain !== "arbitrum") throw new Error("Arbitrum wallet cannot sign non-EVM payload");
    if (!this.account) throw new Error("Arbitrum wallet is watch-only");
    const signature = await this.account.signMessage({ message: transaction.payload });
    return { chain: "arbitrum", description: transaction.description, serialized: signature, signer: this.account.address };
  }
}

export function requireSigner(wallet: ChainWallet): WalletIdentity {
  const identity = wallet.identity();
  if (!identity.canSign) throw new Error(`${identity.chain} wallet has no signing key`);
  return identity;
}
