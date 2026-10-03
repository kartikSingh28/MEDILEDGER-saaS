import path from "path";

/*
  Fabric connection settings for each hospital. A hospital is a Fabric
  organization (MSP) with its own peer and CA; the Hospital table links a
  hospital to its mspId here.

  Defaults match fabric-samples test-network reached from the host
  (localhost ports). In Docker, override the *_PEER_ENDPOINT and *_CA_URL
  variables (see docker-compose.yml).
*/

export interface OrgConfig {
  mspId: string;
  peerEndpoint: string;
  peerHostAlias: string;
  peerTlsFile: string;
  caUrl: string;
  caName: string;
  caCertFile: string;
  affiliation: string;
}

export const cryptoPath = path.resolve(process.env.FABRIC_CRYPTO_PATH || "fabric/crypto");

const orgs: Record<string, OrgConfig> = {
  Org1MSP: {
    mspId: "Org1MSP",
    peerEndpoint: process.env.FABRIC_ORG1_PEER_ENDPOINT || "localhost:7051",
    peerHostAlias: "peer0.org1.example.com",
    peerTlsFile: "org1-peer-tls.crt",
    caUrl: process.env.FABRIC_ORG1_CA_URL || "https://localhost:7054",
    caName: "ca-org1",
    caCertFile: "org1-ca.pem",
    affiliation: "org1.department1",
  },
  Org2MSP: {
    mspId: "Org2MSP",
    peerEndpoint: process.env.FABRIC_ORG2_PEER_ENDPOINT || "localhost:9051",
    peerHostAlias: "peer0.org2.example.com",
    peerTlsFile: "org2-peer-tls.crt",
    caUrl: process.env.FABRIC_ORG2_CA_URL || "https://localhost:8054",
    caName: "ca-org2",
    caCertFile: "org2-ca.pem",
    affiliation: "org2.department1",
  },
};

export function orgConfig(mspId: string): OrgConfig {
  const org = orgs[mspId];
  if (!org) {
    throw new Error(`No Fabric organization configured for ${mspId}`);
  }
  return org;
}
