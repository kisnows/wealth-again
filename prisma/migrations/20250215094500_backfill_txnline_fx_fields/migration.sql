-- Backfill transfer lines to ensure counterparty与汇率信息完整

UPDATE "TxnLine"
SET "counterpartyAccountId" = (
    SELECT other."accountId"
    FROM "TxnLine" AS other
    WHERE other."entryId" = "TxnLine"."entryId"
      AND other."id" <> "TxnLine"."id"
    LIMIT 1
)
WHERE "type" = 'TRANSFER'
  AND "counterpartyAccountId" IS NULL;

UPDATE "TxnLine"
SET "counterpartyName" = (
    SELECT "name"
    FROM "Account"
    WHERE "Account"."id" = "TxnLine"."counterpartyAccountId"
)
WHERE "type" = 'TRANSFER'
  AND "counterpartyAccountId" IS NOT NULL;

UPDATE "TxnLine"
SET "exchangeRateAB" = (
    SELECT json_extract("meta", '$.effectiveRate')
    FROM "TxnEntry"
    WHERE "TxnEntry"."id" = "TxnLine"."entryId"
)
WHERE "type" = 'TRANSFER'
  AND "exchangeRateAB" IS NULL;

UPDATE "TxnLine"
SET "exchangeRateAB" = 1
WHERE "type" = 'TRANSFER'
  AND "exchangeRateAB" IS NULL;

UPDATE "TxnLine"
SET "rateAtoUSD" = COALESCE("rateAtoUSD", 1)
WHERE "type" = 'TRANSFER';

UPDATE "TxnLine"
SET "rateUSDtoB" = COALESCE("rateUSDtoB", "exchangeRateAB")
WHERE "type" = 'TRANSFER';

UPDATE "TxnLine"
SET "fxEffectiveAt" = COALESCE(
    "fxEffectiveAt",
    (
      SELECT json_extract("meta", '$.rateSnapshots[0].effectiveFrom')
      FROM "TxnEntry"
      WHERE "TxnEntry"."id" = "TxnLine"."entryId"
    )
)
WHERE "type" = 'TRANSFER';

UPDATE "TxnLine"
SET "fxEffectiveAt" = COALESCE(
    "fxEffectiveAt",
    (
      SELECT "occurredAt"
      FROM "TxnEntry"
      WHERE "TxnEntry"."id" = "TxnLine"."entryId"
    )
)
WHERE "type" = 'TRANSFER';

UPDATE "TxnLine"
SET "viaCurrency" = COALESCE(NULLIF("viaCurrency", ''), 'USD')
WHERE "type" = 'TRANSFER';
