/*
  Consent policy tests.

  Runs the compiled contract against a stubbed Fabric context: an in-memory
  state map, a clock the test moves forward, and a client identity per caller.
  That covers the parts of the contract worth testing — the access policy and
  the state it writes — without standing up a network.

  Build first, then run:  npm run build && npm test
*/
const path = require("path");
const assert = require("assert");

const DIST = path.join(__dirname, "..", "dist");
const { ConsentContract } = require(path.join(DIST, "ConsentContract.js"));

// ---- stub ledger -------------------------------------------------
let clock = new Date("2026-11-21T10:00:00.000Z");
let txCounter = 0;
const state = new Map();

const SEP = "\u0000";
function makeCtx(user) {
  txCounter++;
  const txId = `tx${String(txCounter).padStart(3, "0")}`;
  return {
    stub: {
      createCompositeKey: (type, attrs) => SEP + type + SEP + attrs.join(SEP) + SEP,
      getState: async (k) => state.get(k) ?? Buffer.alloc(0),
      putState: async (k, v) => void state.set(k, Buffer.from(v)),
      setEvent: () => {},
      getTxID: () => txId,
      getDateTimestamp: () => new Date(clock),
      getStateByPartialCompositeKey: (type, attrs) => {
        const prefix = SEP + type + SEP + attrs.join(SEP) + SEP;
        const hits = [...state.entries()].filter(([k]) => k.startsWith(prefix));
        return (async function* () {
          for (const [, value] of hits) yield { value };
        })();
      },
    },
    clientIdentity: {
      getAttributeValue: (a) =>
        a === "mediledger.userId" ? user.id : a === "mediledger.role" ? user.role : null,
      getMSPID: () => user.msp,
      getID: () => `x509::/CN=mediledger-user-${user.id}::/CN=ca.${user.msp}`,
    },
  };
}

const patient = { id: "1", role: "PATIENT", msp: "Org1MSP" };
const doctor = { id: "7", role: "DOCTOR", msp: "Org2MSP" };
const other = { id: "9", role: "DOCTOR", msp: "Org2MSP" };

const c = new ConsentContract();
const HASH = "a".repeat(64);
const TAMPERED = "b".repeat(64);

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `  (got ${actual}, want ${expected})`}`);
  ok ? pass++ : fail++;
}
async function throws(label, fn, match) {
  try {
    await fn();
    console.log(` FAIL  ${label}  (expected a throw)`);
    fail++;
  } catch (e) {
    const ok = e.message.includes(match);
    console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `  (got "${e.message}")`}`);
    ok ? pass++ : fail++;
  }
}

function reset() {
  state.clear();
  clock = new Date("2026-11-21T10:00:00.000Z");
}
const advance = (ms) => (clock = new Date(clock.getTime() + ms));

async function main() {
  // --- happy path: hash-bound grant, used within its terms ---------
  console.log("\nhash-bound consent");
  reset();
  await c.RegisterRecord(makeCtx(patient), "101", "QmCID", HASH);
  await c.RequestAccess(makeCtx(doctor), "101", "TREATMENT");

  const granted = JSON.parse(
    await c.GrantAccess(makeCtx(patient), "101", "Org2MSP", "7", "2026-12-21T10:00:00.000Z", "2")
  );
  check("grant binds the record hash", granted.dataHash, HASH);
  check("grant keeps the stated purpose", granted.purpose, "TREATMENT");

  let r = JSON.parse(await c.LogAccess(makeCtx(doctor), "101", HASH));
  check("matching hash is allowed", r.allowed, true);
  check("access is counted", r.accessCount, 1);

  // --- integrity: the file no longer hashes to what consent covers --
  console.log("\ntampered file auto-revokes");
  r = JSON.parse(await c.LogAccess(makeCtx(doctor), "101", TAMPERED));
  check("tampered hash is refused", r.allowed, false);
  check("outcome is CONSENT_INVALIDATED", r.outcome, "CONSENT_INVALIDATED");

  const after = JSON.parse(await c.GetConsent(makeCtx(patient), "101", "Org2MSP", "7"));
  check("consent is invalidated on the ledger", after.status, "INVALIDATED");

  r = JSON.parse(await c.LogAccess(makeCtx(doctor), "101", HASH));
  check("the good hash no longer helps", r.allowed, false);

  // --- time-bound ---------------------------------------------------
  console.log("\ntime-bound consent");
  reset();
  await c.RegisterRecord(makeCtx(patient), "102", "QmCID2", HASH);
  await c.RequestAccess(makeCtx(doctor), "102", "DIAGNOSIS");
  await c.GrantAccess(makeCtx(patient), "102", "Org2MSP", "7", "2026-11-21T11:00:00.000Z", "0");

  check("allowed before expiry", JSON.parse(await c.LogAccess(makeCtx(doctor), "102", HASH)).allowed, true);
  advance(2 * 60 * 60 * 1000); // +2h, past the 11:00 expiry
  r = JSON.parse(await c.LogAccess(makeCtx(doctor), "102", HASH));
  check("refused after expiry", r.allowed, false);
  check("outcome is CONSENT_EXPIRED", r.outcome, "CONSENT_EXPIRED");
  check(
    "consent marked EXPIRED",
    JSON.parse(await c.GetConsent(makeCtx(patient), "102", "Org2MSP", "7")).status,
    "EXPIRED"
  );
  await throws(
    "a past expiry is rejected at grant time",
    () => c.GrantAccess(makeCtx(patient), "102", "Org2MSP", "7", "2020-01-01T00:00:00.000Z", "0"),
    "must be in the future"
  );

  // --- access frequency ---------------------------------------------
  console.log("\naccess frequency cap");
  reset();
  await c.RegisterRecord(makeCtx(patient), "103", "QmCID3", HASH);
  await c.RequestAccess(makeCtx(doctor), "103", "TREATMENT");
  await c.GrantAccess(makeCtx(patient), "103", "Org2MSP", "7", "", "2");

  check("1st download", JSON.parse(await c.LogAccess(makeCtx(doctor), "103", HASH)).allowed, true);
  check("2nd download", JSON.parse(await c.LogAccess(makeCtx(doctor), "103", HASH)).allowed, true);
  r = JSON.parse(await c.LogAccess(makeCtx(doctor), "103", HASH));
  check("3rd is refused", r.allowed, false);
  check("outcome is CONSENT_EXHAUSTED", r.outcome, "CONSENT_EXHAUSTED");

  // --- emergency break-glass ------------------------------------------
  console.log("\nemergency access");
  reset();
  await c.RegisterRecord(makeCtx(patient), "104", "QmCID4", HASH);
  const em = JSON.parse(
    await c.EmergencyAccess(makeCtx(doctor), "104", "Unconscious patient in A&E, needs allergy history")
  );
  check("emergency grant is flagged", em.emergency, true);
  check("emergency purpose", em.purpose, "EMERGENCY");
  check("emergency capped at 3", em.maxAccesses, 3);
  check("emergency is hash-bound", em.dataHash, HASH);
  check("emergency works immediately", JSON.parse(await c.LogAccess(makeCtx(doctor), "104", HASH)).allowed, true);

  await throws(
    "emergency needs a real reason",
    () => c.EmergencyAccess(makeCtx(other), "104", "sick"),
    "at least 10 characters"
  );

  advance(61 * 60 * 1000); // past the 60 min TTL
  check("emergency lapses after an hour", JSON.parse(await c.LogAccess(makeCtx(doctor), "104", HASH)).allowed, false);

  // --- no consent at all -----------------------------------------------
  console.log("\nblocked attempts");
  reset();
  await c.RegisterRecord(makeCtx(patient), "105", "QmCID5", HASH);
  r = JSON.parse(await c.LogAccess(makeCtx(other), "105", HASH));
  check("a stranger is blocked", r.allowed, false);
  check("outcome is ACCESS_BLOCKED", r.outcome, "ACCESS_BLOCKED");
  check("owner always reads their own record", JSON.parse(await c.LogAccess(makeCtx(patient), "105", HASH)).allowed, true);

  // --- audit trail --------------------------------------------------
  console.log("\naudit trail");
  const trail = JSON.parse(await c.GetAuditTrail(makeCtx(patient), "105"));
  check("blocked attempt is on the trail", trail.some((e) => e.action === "ACCESS_BLOCKED"), true);
  check("so is the owner's own read", trail.some((e) => e.action === "RECORD_ACCESSED"), true);
  await throws(
    "a doctor cannot read the trail",
    () => c.GetAuditTrail(makeCtx(doctor), "105"),
    "Only a patient"
  );

  // --- validation ---------------------------------------------------
  console.log("\nvalidation");
  await throws(
    "purpose must be known",
    () => c.RequestAccess(makeCtx(doctor), "105", "CURIOSITY"),
    "purpose must be one of"
  );

  console.log(`\n${pass} passed, ${fail} failed\n`);
  assert.strictEqual(fail, 0, `${fail} consent policy check(s) failed`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
