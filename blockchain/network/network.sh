

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
  (cd "$TEST_NETWORK" && ./network.sh up createChannel -c "$CHANNEL_NAME")
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

creds() {
  local org="$TEST_NETWORK/organizations/peerOrganizations/org1.example.com"
  local user="$org/users/User1@org1.example.com/msp"

  if [ ! -d "$user" ]; then
    echo "Org1 credentials not found; is the network up?" >&2
    exit 1
  fi

  rm -rf "$CRYPTO_OUT"
  mkdir -p "$CRYPTO_OUT"
  cp "$user"/signcerts/*.pem "$CRYPTO_OUT/cert.pem"
  cp "$user"/keystore/* "$CRYPTO_OUT/key.pem"
  cp "$org/peers/peer0.org1.example.com/tls/ca.crt" "$CRYPTO_OUT/tls-ca.crt"
  echo "Copied Org1 User1 credentials to $CRYPTO_OUT"
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
