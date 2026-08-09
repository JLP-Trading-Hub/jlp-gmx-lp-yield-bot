import { loadConfig } from "./config.js";
import { YieldRuntime } from "./app/runtime.js";

async function main(): Promise<void> {
  const config = loadConfig(process.argv.slice(2));
  const runtime = new YieldRuntime(config);
  console.log(`Starting ${config.mode} JLP/GM allocator (${config.loops} cycles)`);
  for (let index = 0; index < config.loops; index += 1) {
    try {
      const result = await runtime.cycle();
      console.log(JSON.stringify({ cycle: index + 1, action: result.action, allocation: result.state.allocation, yieldUsd: result.state.ledger.jlpFeesUsd + result.state.ledger.gmFeesUsd }));
    } catch (error) {
      if (config.mode !== "paper") throw error;
      const result = await runtime.cycle(runtime.paperQuotes());
      console.warn(`Network quote failed; paper fallback: ${(error as Error).message}`);
      console.log(JSON.stringify({ cycle: index + 1, action: result.action, allocation: result.state.allocation }));
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
