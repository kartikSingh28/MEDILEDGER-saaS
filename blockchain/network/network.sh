#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FABRIC_SAMPLES="${FABRIC_SAMPLES:-$HOME/fabric-samples}"
TEST_NETWORK="$FABRIC_SAMPLES/test-network"
CHANNEL_NAME="${CHANNEL_NAME:-mediledger}"
CC_NAME="${CC_NAME:-consent}"
CC_PATH="$PROJECT_ROOT/blockchain/chaincode/consent-contract"
CRYPTO_OUT="$PROJECT_ROOT/Backend/fabric/crypto"

if [ ! -x "$TEST_NETWORK/network.sh" ]; then
  echo "fabric-samples test-network not found at $TEST_NETWORK (set FABRIC_SAMPLES)" >&2
  exit 1
fi

export PATH="$FABRIC_SAMPLES/bin:$PATH"
export FABRIC_CFG_PATH="$FABRIC_SAMPLES/config"

next_sequence() {
  (
    set +u  # fabric-samples scripts read unset variables
    cd "$TEST_NETWORK"
    export TEST_NETWORK_HOME="$TEST_NETWORK"
    # shellcheck disable=SC1091
    . scripts/envVar.sh >/dev/null
    setGlobals 1 >/dev/null
    current=$(peer lifecycle chaincode querycommitted -C "$CHANNEL_NAME" -n "$CC_NAME" -O json 2>/dev/null | jq -r '.sequence // 0' || echo 0)
    echo $((current + 1))
  )
}

up() {
  # -ca: run a Fabric CA per org so each MediLedger user gets their own certificate
  (cd "$TEST_NETWORK" && ./network.sh up createChannel -ca -c "$CHANNEL_NAME")
  deploy
}

deploy() {
  local seq
  seq=$(next_sequence)
  echo "Deploying chaincode '$CC_NAME' to channel '$CHANNEL_NAME' (sequence $seq)"
  (cd "$TEST_NETWORK" && ./network.sh deployCC \
    -c "$CHANNEL_NAME" \
    -ccn "$CC_NAME" \
    -ccp "$CC_PATH" \
    -ccl typescript \
    -ccv "1.$seq" \
    -ccs "$seq")
  creds
}

# Copies only public TLS roots for each hospital (org); user identities are
# issued by each hospital's CA at signup
creds() {
  rm -rf "$CRYPTO_OUT"
  mkdir -p "$CRYPTO_OUT"

  for org in org1 org2; do
    local peer_tls="$TEST_NETWORK/organizations/peerOrganizations/$org.example.com/peers/peer0.$org.example.com/tls/ca.crt"
    local ca_cert="$TEST_NETWORK/organizations/fabric-ca/$org/ca-cert.pem"

    if [ ! -f "$ca_cert" ]; then
      echo "$org CA certificate not found; is the network up with a CA (./network.sh up)?" >&2
      exit 1
    fi

    cp "$peer_tls" "$CRYPTO_OUT/$org-peer-tls.crt"
    cp "$ca_cert" "$CRYPTO_OUT/$org-ca.pem"
  done

  echo "Copied peer and CA TLS certificates for org1 and org2 to $CRYPTO_OUT"
}

down() {
  (cd "$TEST_NETWORK" && ./network.sh down)
  rm -rf "$CRYPTO_OUT"
}

case "${1:-}" in
  up) up ;;
  deploy) deploy ;;
  creds) creds ;;
  down) down ;;
  *)
    echo "Usage: $0 {up|deploy|creds|down}" >&2
    exit 1
    ;;
esac
