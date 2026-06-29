# 🤖 ParaPhase

ParaPhase is a lightweight, modern Progressive Web App (PWA) that leverages Artificial Intelligence to rephrase, humanize, and optimize text. Built with a minimalist, high-performance architecture, ParaPhase handles heavy linguistic operations directly in the client browser using background worker threads, ensuring a fast, private, and offline-capable user experience.

---

## ✨ Features

* **AI-Powered Rephrasing:** Instantly rewrite sentences or entire paragraphs while preserving the core contextual meaning.
* **Context Optimization:** Fine-tuned adjustments to tone, clarity, and structural flow.
* **Progressive Web App (PWA):** Fully installable on desktop and mobile devices with comprehensive offline support.
* **Privacy-First Architecture:** Text transformation logic runs via highly efficient non-blocking background workers (`sw.js` and `worker.ts`).
* **Sleek User Interface:** A modern, scannable minimalist layout built for optimal focus and utility.

---

## 🛠️ Tech Stack & Architecture

* **Frontend Ecosystem:** React 18, TypeScript, Vite
* **Styling:** Modern CSS (focusing on a clean, responsive layout)
* **Asynchronous Processing:** Web Workers (`src/worker.ts`) for intense background calculations without blocking main UI threads.
* **Offline/Caching Layer:** Service Workers (`public/sw.js`) utilizing a client-side progressive caching strategy.
* **Server Component:** Minimalist TypeScript-based runtime server (`server.ts`) for static routing and build pipeline handoffs.

---

## 📁 Directory Structure

```text
paraphase/
├── assets/             # Application design configurations & icons
├── public/
│   ├── icon.svg        # Universal vector graphic brand asset
│   ├── manifest.json   # PWA installation and UI configurations
│   └── sw.js           # Service Worker managing application caching & offline capability
├── src/
│   ├── App.tsx         # Main application container and interface lifecycle
│   ├── index.css       # Core typography, glassmorphism hooks, and CSS configurations
│   ├── main.tsx        # React client-side hydration injection root
│   ├── worker.ts       # Text parsing & heavy processing background worker thread
│   └── worker.d.ts     # TypeScript type boundaries for worker threads
├── package.json        # Node metadata and module dependency graph
├── server.ts           # Development & deployment server entrypoint
└── vite.config.ts      # Build optimizations, compilation pipeline, and alias resolutions

```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18.x or later) and npm installed.

### 1. Installation

Clone the repository and install the project dependencies:

```bash
git clone [https://github.com/moizshabbir/paraphase.git](https://github.com/moizshabbir/paraphase.git)
cd paraphase
npm install

```

### 2. Configuration

Create a `.env` file in the root directory based on the provided configuration sample:

```bash
cp .env.example .env

```

Open `.env` and configure your API tokens or backend environment bindings as indicated.

### 3. Local Development

Spin up the local Vite-powered development server:

```bash
npm run dev

```

Alternatively, to execute the application using the native TypeScript runtime configuration file:

```bash
npx tsx server.ts

```

### 4. Production Build

Compile and bundle production-optimized static assets:

```bash
npm run build

```

Preview the final compiled build locally:

```bash
npm run preview

```

---

## ⚙️ Service Worker & Performance

ParaPhase relies on **Web Workers** and **Service Workers** to maintain smooth UI rendering during intense textual analysis:

* **`src/worker.ts`**: Runs tasks in an isolated thread parallel to the UI window. This prevents frame drops and UI freezes when formatting large text inputs.
* **`public/sw.js`**: Handles immediate app loads and assets recovery. It intercepts local fetch events to cache UI screens locally, creating an instantaneous launch experience.

---

## 📄 License

This project is licensed under the terms specified in the repository's licensing terms.
