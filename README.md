# 🏥 MediLedger 
### Secure • Consent-Driven • Decentralized Healthcare Records

A production-grade healthcare data management platform that enables **secure, encrypted, and patient-controlled medical record sharing** using:

- Hyperledger Fabric (permissioned blockchain)
- IPFS (decentralized storage)
- PostgreSQL + Prisma
- Node.js + Express
- React

Built as an enterprise-style system to simulate real hospital infrastructure rather than a basic CRUD app.

---

## 🚀 Overview

Traditional healthcare systems rely on centralized databases that are:

❌ vulnerable to data breaches  
❌ prone to tampering  
❌ lacking audit trails  
❌ offering little patient control  

**MediLedger** solves this by combining:

- Immutable blockchain ledger for consent & audit logs  
- Decentralized encrypted file storage  
- Secure backend APIs  
- Role-based access control  

Result → **Secure • Verifiable • Tamper-proof • Patient-centric**

---

## ✨ Features

### 🔐 Security
- AES-256 file encryption
- SHA-256 hashing
- JWT authentication
- Role-Based Access Control (RBAC)

### 👤 Roles
- Patient
- Doctor
- Hospital Admin

### 📄 Records
- Secure file upload
- Encrypted storage on IPFS
- CID + hash verification
- No raw files stored in DB

### 🔗 Blockchain
- Immutable consent logs
- Access tracking
- Ownership verification
- Tamper detection

### 📜 Auditability
- Every action recorded
- Transparent access history
- Legal-grade logs

---

## 🧠 Architecture

Frontend (React)
↓
Backend API (Express)
↓
PostgreSQL (metadata + users + permissions)
↓
IPFS (encrypted medical files)
+
Hyperledger Fabric (CID + hash + consent + audit logs)


---

## 🔄 Workflow

### Upload
Patient uploads file
→ Encrypt (AES-256)
→ Upload to IPFS
→ Receive CID
→ Generate hash
→ Store metadata in PostgreSQL
→ Record CID + hash on blockchain

### Access
Doctor requests access
→ Patient grants consent
→ Permission verified
→ Fetch CID
→ Retrieve encrypted file from IPFS
→ Decrypt
→ Log access on blockchain

---

## 🛠 Tech Stack

| Layer | Technology |
|---------|------------|
| Frontend | React, TailwindCSS |
| Backend | Node.js, Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Storage | IPFS |
| Blockchain | Hyperledger Fabric (Chaincode) |
| Security | AES-256, SHA-256, JWT |

---

## 📁 Project Structure

mediledger-saas/
│
├── frontend/
├── backend/
│ ├── controllers/
│ ├── routes/
│ ├── middlewares/
│ ├── services/
│ ├── prisma/
│ ├── ipfs/
│ ├── fabric/
│ └── utils/
│
├── blockchain/
│ ├── chaincode/
│ └── network/
│
├── README.md
└── .gitignore

---

## ⚙️ Local Setup

**Prerequisites:** Docker Desktop, WSL 2 (Ubuntu) with Node.js and `jq`, and
[fabric-samples](https://hyperledger-fabric.readthedocs.io/en/latest/install.html) with binaries installed at `~/fabric-samples` inside WSL.

### 1. Clone
```bash
git clone https://github.com/kartikSingh28/MEDILEDGER-saaS.git
cd MEDILEDGER-saaS
```

### 2. Configure the backend
```bash
cp Backend/.env.example Backend/.env   # then set JWT_SECRET and FILE_SECRET
```

### 3. Start the Fabric network (from WSL)
Starts the test network, creates the `mediledger` channel, deploys the consent
chaincode and copies Org1 credentials into `Backend/fabric/crypto`.
```bash
./blockchain/network/network.sh up
```

### 4. Start Postgres, IPFS and the backend
```bash
docker compose up -d --build     # backend on http://localhost:5000
docker compose watch             # optional: live-reload backend on file changes
```
Migrations run automatically. Postgres is exposed on `localhost:5434` for Prisma Studio / pgAdmin.

### 5. Start the frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

### Day-to-day
| Task | Command |
|------|---------|
| Redeploy chaincode after changes | `./blockchain/network/network.sh deploy` (WSL) |
| Backfill ledger from Postgres | `docker compose exec backend npm run fabric:sync` |
| Stop app stack | `docker compose down` (add `-v` to wipe DB + IPFS data) |
| Stop Fabric | `./blockchain/network/network.sh down` (wipes the ledger) |

> After `network.sh down` + `up` the ledger is empty while Postgres keeps its data.
> Run `npm run fabric:sync` to re-anchor existing records and consents.

> **Windows antivirus:** Avast/AVG HTTPS scanning intercepts TLS to the Fabric peer
> from Windows, so run the backend in Docker (as above) rather than with `npm run dev`
> on Windows when `FABRIC_ENABLED=true`.

---

## 🔗 Blockchain Layer

Chaincode: `blockchain/chaincode/consent-contract` (TypeScript, Fabric 2.5)

| Function | Purpose |
|----------|---------|
| `RegisterRecord` | Anchor record CID + SHA-256 hash at upload |
| `RequestAccess` / `GrantAccess` / `DenyAccess` / `RevokeAccess` | Consent lifecycle; only the record owner can change consent |
| `LogAccess` | Called on every download; refuses unless the ledger shows access, then appends to the audit trail |
| `GetAuditTrail` | Full on-chain history for a record (`GET /records/:id/audit`) |

Downloads take the CID and hash from the ledger, so editing Postgres
(e.g. flipping a permission to approved) cannot unlock a file.

The backend signs all transactions with one Org1 identity and passes app user
IDs as arguments; the chaincode enforces the consent rules on those IDs.

---

🔐 Security Model
Risk	Protection
Data breach	Encryption
Tampering	Hash verification
Unauthorized access	RBAC
Insider misuse	Audit logs
Server failure	Decentralized IPFS
Record modification	Blockchain immutability
🚧 Future Improvements

Multi-hospital network

Dockerized Fabric deployment

Key management service

Cloud hosting

FHIR interoperability

Mobile app

Real-time notifications
👨‍💻 Authors

Kartik Singh
Ritik Raj
Manas Kumar
Faiz Mohmad

Major Project – Computer Science & IT
