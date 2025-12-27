# NFT Collection – ERC-721 Smart Contract

## Project Summary
This repository contains a complete implementation of an **ERC-721 NFT smart contract**, along with an automated test suite and a fully containerized execution environment. The project demonstrates how to design, test, and package a non-fungible token collection in a way that is reproducible, secure, and easy to evaluate.

The focus of this implementation is correctness, clarity, and adherence to established Ethereum standards rather than feature bloat or unnecessary extensions.

---

## Key Capabilities
- ERC-721 compliant NFT contract
- Unique ownership and balance tracking
- Owner-restricted minting logic
- Configurable maximum supply
- Token metadata resolution via `tokenURI`
- Automated tests covering success and failure paths
- Docker container that builds and runs tests without manual setup

---

## Contract Overview
The NFT contract is implemented using **Solidity** and leverages **OpenZeppelin Contracts** for the ERC-721 core logic. This approach ensures compatibility with wallets, marketplaces, and indexing tools while reducing the risk of subtle implementation bugs.

### Main Constraints
- Only the contract owner can mint new tokens
- Each token ID can be minted only once
- Minting is blocked once the maximum supply is reached
- Tokens cannot be minted to the zero address

Ownership transfers, approvals, and event emission are handled by the ERC-721 standard implementation.

---

## Metadata Design
The contract uses a **base URI + token ID** strategy to resolve metadata. A single base URI is stored on-chain, and the final metadata URL is constructed dynamically.

This design:
- Avoids storing per-token metadata on-chain
- Keeps gas usage predictable as the collection grows
- Scales cleanly to large collections without increasing storage costs

---

## Repository Layout
.
├── contracts/
│ └── NftCollection.sol
├── test/
│ └── NftCollection.test.js
├── Dockerfile
├── .dockerignore
├── hardhat.config.js
├── package.json
└── README.md

yaml
Copy code

---

## Test Strategy
The test suite validates the most important behaviors of the NFT contract, including:
- Successful deployment and configuration
- Authorized and unauthorized minting attempts
- Maximum supply enforcement
- Token ownership changes after transfers
- Correct metadata resolution
- Expected reverts for invalid operations

Tests are written using **Hardhat, Mocha, Chai, and Ethers.js**, and are executed automatically inside the Docker container.

---

## Running the Project with Docker

### Build the Docker image
```bash
docker build -t nft-contract .
Run the container
bash
Copy code
docker run nft-contract
When executed, the container installs dependencies, compiles the contracts, and runs the full test suite. Test results are printed directly to the console.

Tooling
Solidity

Hardhat

OpenZeppelin Contracts

Ethers.js

Mocha & Chai

Docker

Node.js & npm

Security Notes
Privileged operations are protected using owner-based access control

Input validation prevents invalid state transitions

No external calls are made before state changes

Core token logic relies on audited OpenZeppelin implementations

Scalability Considerations
If the collection were expanded significantly, potential future improvements could include:

Role-based access control for minting

Batch minting to reduce gas costs

Additional indexing or query helpers

Support for royalty or marketplace standards

The current design intentionally prioritizes simplicity and correctness, making such extensions easier to add later.

Conclusion
This project provides a clean, standards-compliant ERC-721 NFT implementation with strong test coverage and a reproducible Docker-based workflow. It is designed to be easy to evaluate, easy to extend, and suitable as a foundation for production-grade NFT collections.


---
