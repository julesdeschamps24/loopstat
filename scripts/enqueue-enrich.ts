import { enrichCatalogQueue } from "../worker/queue";

async function main() {
  await enrichCatalogQueue.add(
    "enrich-catalog",
    {},
    { jobId: "enrich-catalog-global" },
  );
  console.log("Enqueued enrich-catalog job");
  process.exit(0);
}

main();
