# **Aimea.ai Real-Time Transcriber**

A sophisticated, low-latency voice-to-text application designed for high-accuracy, real-time transcription. The application utilizes a robust WebSocket-based binary streaming architecture to deliver instant results across both desktop and mobile devices.

## **Key Features**

* **Real-Time AI Processing:** Integrates the Deepgram Nova-2 engine for lightning-fast speech recognition.  
* **Binary Audio Streaming:** Implements ArrayBuffer serialization to ensure high-fidelity audio transmission from microphone to server.  
* **Mobile-First Design:** Fully responsive interface optimized for mobile browsers, including secure HTTPS microphone handling.  
* **Developer-Friendly UI:** Includes dark mode, visual activity indicators, and transcript management tools (Copy/Export).

## **Architecture**

* **Frontend:** Built with React, TypeScript, and Vite. Uses socket.io-client for persistent, bi-directional communication.  
* **Backend:** Node.js and Express server with socket.io for high-concurrency event handling.  
* **Infrastructure:** Deployed on Render with environment-based configuration for secure API key management.

## **Installation & Setup**

### **Prerequisites**

* Node.js (v18+)  
* Deepgram API Key

### **Configuration**

1. Clone the repository.  
2. In the backend folder, create a .env file:  
   DEEPGRAM\_API\_KEY=your\_actual\_api\_key\_here  
   PORT=3001

3. Install dependencies:  
   \# Frontend  
   cd frontend && npm install

   \# Backend  
   cd ../backend && npm install

### **Running Locally**

* **Backend:** node server.js  
* **Frontend:** npm run dev

## **Deployment Notes**

The application is optimized for cloud deployment. The frontend and backend are served from a single origin in production, and WebSocket transports are explicitly configured to websocket to bypass restrictive network load balancers.