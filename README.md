# Recall AI: AI-Powered Flashcard Generator

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Recall AI is a full-stack web application that automates the creation of flashcard decks from various content sources like audio lectures, documents, and raw text, using generative AI.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Tech Stack & Rationale](#tech-stack--rationale)
- [End-to-End Workflow](#end-to-end-workflow)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Configuration](#configuration)
  - [Running Locally](#running-locally)
- [Repository Structure](#repository-structure)

## Project Overview

This project solves the time-consuming problem of manual flashcard creation. It provides a platform where students and professionals can upload their learning materials and receive flashcard decks in minutes, ready to export to anki, quizlet, and more. The application is built on a modern, scalable, and distributed architecture, combining a Next.js frontend, a serverless Firebase backend, and a containerized Python AI microservice.

## Live Demo

**[Link to your live application here]**

*(Consider adding a GIF or screenshot of the app in action)*
![App Screenshot](https://placehold.co/800x400/2d3748/ffffff?text=App+Screenshot+Here)

## Architecture

The system is designed with a clear separation of concerns, ensuring maintainability and independent scaling of its components.

```mermaid
graph TD
    subgraph User
        A[User's Browser]
    end

    subgraph Frontend (Next.js on Vercel/Firebase Hosting)
        B[Next.js App]
    end

    subgraph Serverless Backend (Firebase)
        C[Firebase Authentication]
        D[Firebase Storage]
        E[Firestore Database]
        F[Cloud Functions]
    end

    subgraph AI Microservice (Python on Google Cloud Run)
        G[Docker Container]
        H[Flask/FastAPI Server]
        I[Audio Transcription Model]
        J[Gemini for Card Generation]
    end

    A -- Interacts with --> B
    B -- Authenticates with --> C
    B -- Uploads file to --> D
    B -- Writes job to & Reads data from --> E
    E -- onDeckCreate event triggers --> F
    F -- HTTP Request --> H
    H --> I
    H --> J
    H -- Downloads file from --> D
    F -- Updates job in --> E
```

## Key Features

- **Multi-Source Content Upload**: Users can generate flashcards from audio files, documents, or by pasting raw text.
- **AI-Powered Generation**: Leverages Google's Gemini model to create accurate and relevant question-and-answer pairs from source content.
- **Secure User Authentication**: Full user registration and login system handled by Firebase Authentication.
- **Real-Time Updates**: The frontend listens for real-time updates from the Firestore database, so users see their generated decks the moment they are ready.
- **Persistent Storage**: All user-generated decks are securely stored and associated with their account in Firestore.
- **Anki Export**: Allows users to download their generated decks as `.apkg` files for easy import into the Anki spaced-repetition software.

## Tech Stack & Rationale

| Technology | Purpose | Why Chosen |
|---|---|---|
| **Next.js (React)** | Frontend UI | Provides a modern, component-based architecture for a fast and interactive user experience. |
| **Firebase Auth** | User Authentication | A secure, easy-to-implement, and fully managed authentication service. |
| **Firestore** | NoSQL Database | A scalable, real-time NoSQL database perfect for storing user data and application state. |
| **Firebase Storage** | File Storage | Provides a simple and secure way to store user-uploaded content like audio files and documents. |
| **Firebase Functions**| Serverless Backend | Runs backend code in response to events (like a new Firestore document), acting as the orchestrator between the frontend and the AI service. |
| **Python (Flask/FastAPI)** | AI Microservice | The industry standard for AI/ML, with excellent libraries for interfacing with models like Gemini. |
| **Docker** | Containerization | Packages the Python AI service into a portable container, allowing it to run anywhere and scale independently. |
| **Google Gemini** | Generative AI Model | A powerful large language model used for the core task of generating flashcard content from text. |

## End-to-End Workflow

1.  **User Authentication**: The user signs up or logs in via the Next.js app, and Firebase Auth creates a secure session.
2.  **File Upload**: The user uploads an audio file, which is sent directly from the browser to Firebase Storage.
3.  **Job Creation**: The frontend creates a new document in the `decks` collection in Firestore with a `processing` status and a reference to the uploaded file.
4.  **Backend Trigger**: A Firebase Cloud Function, listening for new documents in the `decks` collection, is automatically triggered.
5.  **AI Service Invocation**: The Cloud Function sends an HTTP request to the containerized Python AI service, providing the location of the file.
6.  **AI Processing**: The Python service downloads the file, transcribes it to text, sends the text to the Gemini API for flashcard generation, and receives the structured Q&A pairs.
7.  **Data Update**: The AI service returns the generated cards to the Cloud Function, which then updates the document in Firestore with the new data and sets the status to `completed`.
8.  **Real-Time UI Update**: The Next.js frontend, listening to the Firestore document in real-time, automatically updates to display the newly generated flashcards to the user.

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- Node.js and npm/yarn
- Python 3.9+ and pip
- Docker Desktop
- Firebase Account & Google Cloud Project
- Google Gemini API Key

### Configuration

1.  **Clone the Repository**:
    ```bash
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    cd your-repo-name
    ```

2.  **Firebase Setup**:
    - Create a new Firebase project.
    - Enable Authentication (Email/Password), Firestore, and Storage.
    - Get your Firebase project configuration keys and place them in a `.env.local` file in the `recall-ai-app/` directory. See `.env.example`.

3.  **Frontend Setup**:
    ```bash
    cd recall-ai-app
    npm install
    ```

4.  **AI Service Setup**:
    - Create a `.env` file in the `ai-service/` directory and add your `GEMINI_API_KEY`. See `.env.example`.
    - Install Python dependencies:
    ```bash
    cd ../ai-service
    pip install -r requirements.txt
    ```

5.  **Backend Functions Setup**:
    ```bash
    cd ../functions
    npm install
    ```

### Running Locally

1.  **Start the AI Service**:
    ```bash
    # From the ai-service/ directory
    docker build -t recall-ai-service .
    docker run -p 8080:8080 -e PORT=8080 --env-file .env recall-ai-service
    ```

2.  **Start the Firebase Emulators**:
    ```bash
    # From the root directory
    firebase emulators:start
    ```

3.  **Start the Next.js Frontend**:
    ```bash
    # From the recall-ai-app/ directory, in a new terminal
    npm run dev
    ```
    Your application should now be running on `http://localhost:3000`.

## Repository Structure

```
.
├── ai-service/             # Python AI microservice (Flask/FastAPI, Docker)
├── functions/              # Firebase Cloud Functions (TypeScript)
├── recall-ai-app/          # Next.js frontend application
├── firebase.json           # Firebase project configuration
└── firestore.rules         # Security rules for Firestore database
```
