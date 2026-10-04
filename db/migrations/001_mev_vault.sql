-- MevVault index. On-chain balances stay authoritative; these tables are a read cache and an event log.

CREATE TABLE IF NOT EXISTS vault_deployments (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  asset TEXT NOT NULL,
  proxy_address TEXT NOT NULL,
  implementation_address TEXT NOT NULL,
  admin_address TEXT NOT NULL,
  indexed_block BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, proxy_address)
);

CREATE TABLE IF NOT EXISTS vault_events (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  proxy_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'withdraw', 'arb')),
  user_address TEXT,
  assets NUMERIC(78, 0),
  shares NUMERIC(78, 0),
  profit NUMERIC(78, 0),
  block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS vault_events_wallet_idx
  ON vault_events (chain_id, proxy_address, user_address, block_number DESC);

CREATE TABLE IF NOT EXISTS vault_position_cache (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  proxy_address TEXT NOT NULL,
  shares NUMERIC(78, 0) NOT NULL,
  assets NUMERIC(78, 0) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_address, chain_id, proxy_address)
);
