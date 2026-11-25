# Deploy the MediLedger demo on Oracle Cloud

This setup runs the React frontend, Express API, PostgreSQL, Kubo IPFS, and the
two-hospital Hyperledger Fabric test network on one Oracle VM. Cloudflare Quick
Tunnel gives classmates an HTTPS address they can open from their own devices.
MediLedger handles patient and doctor sign-in. Use fictional records for this
classroom deployment.

```text
Browser -> Cloudflare -> cloudflared -> tunnel gateway -> Caddy
                                                          |-- React / Nginx
                                                          `-- Express -> PostgreSQL, IPFS, Fabric
```

## 1. Provision the VM

- Create a `VM.Standard.A1.Flex` instance in your Oracle home region. The demo
  ran on Ubuntu 24.04 ARM64 with 2 OCPUs and 12 GB RAM. Verify availability and
  Always Free eligibility in your tenancy.
- Use a public subnet with an internet gateway and a route to it. Assign an
  ephemeral public IPv4 address for SSH. In the subnet's security list, allow
  inbound TCP port 22 only from your public IPv4 address with a `/32` suffix.
  The tunnel connects outward, so the app needs no public inbound web ports.
- Save the SSH private key on your own computer. Connect as `ubuntu`, then
  install Docker Engine with the Compose plugin, Git, `curl`, `jq`, and Node.js
  22 on the VM. Host Node.js is used to build the TypeScript chaincode.

[Oracle instance setup](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm) ·
[Docker installation on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

## 2. Clone and configure the app

```sh
git clone https://github.com/kartikSingh28/MEDILEDGER-saaS.git
cd MEDILEDGER-saaS
umask 077
printf 'VITE_API_URL=/api\nPOSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
{
  printf 'JWT_SECRET=%s\n' "$(openssl rand -base64 32)"
  printf 'FILE_SECRET=%s\n' "$(openssl rand -base64 32)"
  printf 'WALLET_SECRET=%s\n' "$(openssl rand -base64 32)"
} > Backend/.env
```

Run the secret generation once on a new deployment. Retain and back up these
values when updating an existing deployment. `FILE_SECRET` protects stored files
and `WALLET_SECRET` protects Fabric signing keys. Keep both `.env` files and the
SSH private key out of Git. For a deployment on which the SSH-forwarded frontend
is also used locally, add the actual local browser origin to `CORS_ORIGIN`.

## 3. Start Fabric on ARM64

From the MediLedger repository, run the following with Docker and Node.js on
your PATH. The Fabric 2.5.15 and CA 1.5.22 archives use `linux-arm64` in their
release filenames. Download them directly to avoid the older installer using
`linux-aarch64` on Ubuntu. Fabric 2.5.15 also includes the Docker Engine 29 fix.

```sh
export FABRIC_SAMPLES="$HOME/fabric-samples"
git clone https://github.com/hyperledger/fabric-samples.git "$FABRIC_SAMPLES"
git -C "$FABRIC_SAMPLES" checkout --detach 5789681b4f4d24e58fa40f19a69f5496892374b6

curl -fsSL https://github.com/hyperledger/fabric/releases/download/v2.5.15/hyperledger-fabric-linux-arm64-2.5.15.tar.gz \
  | tar -xz -C "$FABRIC_SAMPLES"
curl -fsSL https://github.com/hyperledger/fabric-ca/releases/download/v1.5.22/hyperledger-fabric-ca-linux-arm64-1.5.22.tar.gz \
  | tar -xz -C "$FABRIC_SAMPLES"
curl -fsSL https://raw.githubusercontent.com/hyperledger/fabric/v2.5.15/scripts/install-fabric.sh \
  -o /tmp/mediledger-install-fabric.sh
bash /tmp/mediledger-install-fabric.sh --fabric-version 2.5.15 --ca-version 1.5.22 docker
docker pull hyperledger/fabric-nodeenv:2.5

bash blockchain/network/network.sh up
docker compose -p compose \
  -f "$FABRIC_SAMPLES/test-network/compose/compose-ca.yaml" \
  -f "$PWD/deploy/oracle/fabric-ca.yml" up -d --no-deps ca_org1 ca_org2
docker update --restart unless-stopped ca_orderer orderer.example.com \
  peer0.org1.example.com peer0.org2.example.com
```

The CA overlay adds the certificate hostnames to the `fabric_test` Docker
network. The backend can enroll users directly with the CAs using those names.
The Fabric test network keeps its generated enrollment material and ledger state
on this VM. Keep the existing network and backups when updating the app.

## 4. Start the app and get the demo link

```sh
docker compose -f docker-compose.yml -f docker-compose.fabric.yml \
  -f docker-compose.prod.yml -f docker-compose.oracle.yml up -d --build
docker logs mediledger-cloudflared-1
```

Open the `https://…trycloudflare.com` URL printed in the logs. The address is
temporary and can change when the tunnel restarts. The gateway checks that
browser requests come from the same origin so the API works with the generated
hostname. The app proxy also listens on the VM's loopback port `8080` for SSH
forwarding and troubleshooting.

## 4b. Permanent link with Tailscale Funnel

The Quick Tunnel address changes whenever `cloudflared` restarts. Tailscale
Funnel gives a fixed `https://mediledger.<tailnet>.ts.net` link for free, with
no domain and no ports opened on the VM. Visitors do not need Tailscale.

1. Sign up at [tailscale.com](https://login.tailscale.com/start) (free plan).
2. In the admin console:
   - **DNS** page: check that **MagicDNS** and **HTTPS Certificates** are
     enabled. Note your tailnet name (for example `tail1a2b3c.ts.net`).
   - **Access controls → JSON editor**: search for `funnel`. New tailnets
     usually have it already. If not, add this at the top level and save:

     ```json
     "nodeAttrs": [
       { "target": ["autogroup:member"], "attr": ["funnel"] }
     ],
     ```
   - **Settings → Keys → Generate auth key**. Leave **Ephemeral** off. Copy
     the key (`tskey-auth-…`).
3. On the VM, use a text editor to set `TS_AUTHKEY` in the private `.env` beside
   the Compose files. The app already calls the API at the relative path `/api`,
   so the hostname can change without rebuilding the frontend.

4. Start the app with the Funnel overlay:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.fabric.yml \
     -f docker-compose.prod.yml -f docker-compose.oracle.yml \
     -f docker-compose.funnel.yml up -d --build
   docker logs mediledger-tailscale-1
   docker exec mediledger-tailscale-1 tailscale funnel status
   ```

   `funnel status` should list `https://mediledger.<tailnet>.ts.net (Funnel on)`.
   The public DNS name can take up to 10 minutes to work the first time. Once
   the new link passes the checks in section 5, stop the old Quick Tunnel if
   you no longer need its URL.

The `tailscale-state` volume keeps the node identity across restarts. After
enrollment, remove `TS_AUTHKEY` from `.env`, recreate only the `tailscale`
service with the same Compose files, and verify the public URL again. You can
revoke the bootstrap auth key afterwards. Renew the device authorization before
its expiry to keep the link working.

To go back to the Quick Tunnel, start without `docker-compose.funnel.yml`.

## 4c. Permanent link on your own domain (named Cloudflare tunnel)

The Quick Tunnel address changes whenever `cloudflared` restarts. A named
tunnel keeps one fixed hostname. It needs a free Cloudflare account and a domain
whose DNS is managed by Cloudflare (add the domain under **Websites → Add a
domain** and switch its nameservers at your registrar).

1. In the Cloudflare dashboard open **Zero Trust → Networks → Tunnels →
   Create a tunnel**, choose **Cloudflared**, and name it `mediledger`.
2. On the install step, copy the token from the shown command (the long string
   after `--token`). You do not need to run that command.
3. Under **Public Hostname**, add:
   - Subdomain: `mediledger` (or any name), Domain: your domain
   - Service type: `HTTP`, URL: `tunnel-gateway:8092`
4. On the VM, add these to `.env` beside the compose files (replace the
   hostname with yours):

   ```sh
   TUNNEL_TOKEN=<token from step 2>
   CORS_ORIGIN=https://mediledger.example.com
   VITE_API_URL=https://mediledger.example.com/api
   ```

5. Restart with the tunnel overlay. `--build` is needed because Vite inlines
   `VITE_API_URL` into the frontend:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.fabric.yml \
     -f docker-compose.prod.yml -f docker-compose.oracle.yml \
     -f docker-compose.tunnel.yml up -d --build
   docker logs mediledger-cloudflared-1
   ```

   The logs should show `Registered tunnel connection`. The tunnel page in the
   dashboard should show it as **Healthy**.

The link is now `https://mediledger.example.com` and survives restarts and
reboots. Keep the token secret: anyone with it can serve traffic on that
hostname. To revoke it, delete the tunnel in the dashboard.

## 5. Verify the demo

1. Open `/api/health` at the tunnel URL and check for `{"status":"ok"}`.
2. Open `/api/records/mine` while signed out and check for HTTP `401`.
3. Create a patient at City General Hospital and a doctor at Metro Care Hospital.
4. Upload a fictional file as the patient. As the doctor, request access to its
   record ID. Approve one download, download the file, and check the patient's
   History for the request, approval, download, and Fabric transaction IDs.

For startup errors, check `docker logs mediledger-backend-1` and
`docker logs mediledger-cloudflared-1`. If using test accounts again, upload a
fresh fictional file for each presentation.

[Hyperledger Fabric test network](https://hyperledger-fabric.readthedocs.io/en/release-2.5/test_network.html) ·
[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) ·
[Tailscale Funnel](https://tailscale.com/kb/1223/funnel) ·
[Cloudflare named tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)
