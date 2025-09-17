# Unchaining the Narrative: A Web3 Journalism Platform

## Introduction

**Unchaining the Narrative** is a decentralized Web3 platform designed to empower journalists with unconventional or dissenting views. By leveraging the **Algorand blockchain**, it ensures that published articles are **immutable, censorship-resistant, and permanently stored**. The platform also integrates fair and transparent compensation mechanisms for content creators through **Algorand Standard Assets (ASA)**.

This project is structured as a **monorepo** containing both the **frontend application** and the **smart contracts**.

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Configuration](#configuration)
7. [Documentation](#documentation)
8. [Troubleshooting](#troubleshooting)
9. [Contributors](#contributors)
10. [License](#license)

---

## Features

* **Immutable Articles**

  * Journalists can publish articles as **NFTs** on Algorand.
  * Content is permanent and cannot be deleted or altered.

* **Fair Compensation**

  * Uses **Algorand Standard Assets (ASA)** to provide a transparent and efficient payment system.

* **Decentralized Architecture**

  * Built with **Algorand** and **AlgoKit**, ensuring scalability, security, and decentralization.

---

## Project Structure

```
journal-web3/
├── projects/
│   ├── wedoitagain-contracts   # Smart contracts (Algorand TypeScript)
│   └── wedoitagain-frontend    # React-based web application
```

Each sub-project contains its own README with detailed instructions.

---

## Prerequisites

Before starting, ensure you have the following installed:

* [**AlgoKit CLI**](https://github.com/algorandfoundation/algokit-cli) – Essential toolkit for Algorand development.
* [**Docker**](https://www.docker.com/) – Runs a local Algorand network for testing.
* [**Node.js**](https://nodejs.org/) – JavaScript runtime environment.

---

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/adhisreepaul/journal-web3.git
   cd journal-web3
   ```

2. **Bootstrap the Project**

   ```bash
   algokit project bootstrap all
   ```

   This installs dependencies for both the frontend and smart contracts.

3. **Start LocalNet**

   ```bash
   algokit localnet start
   ```

   Spins up a local Algorand blockchain network for development.

---

## Usage

1. **Run the Frontend**

   ```bash
   cd projects/wedoitagain-frontend
   npm run dev
   ```

   This builds and starts the frontend application. It automatically connects to your local Algorand network.

2. **Deploy Smart Contracts**
   Navigate to `projects/wedoitagain-contracts` for instructions on compiling and deploying contracts.

---

## Configuration

* Local development is configured to connect to **AlgoKit LocalNet**.
* Blockchain interactions (NFTs & ASAs) are handled through smart contracts located in `wedoitagain-contracts`.
* Frontend settings (e.g., API endpoints, contract addresses) can be configured in the frontend environment variables.

---

## Documentation

* **Frontend Documentation**: [projects/wedoitagain-frontend/README.md](projects/wedoitagain-frontend/README.md)
* **Contracts Documentation**: [projects/wedoitagain-contracts/README.md](projects/wedoitagain-contracts/README.md)

---

## Troubleshooting

* **Docker not running** → Ensure Docker is installed and running before starting LocalNet.
* **AlgoKit command not found** → Verify that AlgoKit CLI is installed and added to your system PATH.
* **Frontend connection issues** → Confirm that LocalNet is running and contracts are deployed.

---

## Contributors

* **Adhisree Paul** – Project creator and maintainer.
* Contributions welcome! Please submit issues and pull requests on the [GitHub repository](https://github.com/adhisreepaul/journal-web3).

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

Do you want me to also **include example workflows** (like publishing an article NFT and receiving ASA payments) in the README, or keep it focused just on setup and usage?
