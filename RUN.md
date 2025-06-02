# Running VibeLab

This document outlines the steps to set up and run the VibeLab application.

## Prerequisites

- Python 3.11.7 (as confirmed by the `.venv` environment)
- Node.js (version to be confirmed, assumed for frontend serving if not using `python -m http.server`)

## Setup

1.  **Clone the Repository (if you haven't already):**
    ```bash
    git clone <repository_url>
    cd vibelab-2 # Or your project directory name
    ```

2.  **Python Backend Setup:**
    *   Ensure the virtual environment directory `.venv` exists. If not, you might need to recreate it (the method depends on how it was initially created, e.g., `python3 -m venv .venv`).
    *   The `start_vibelab_venv.sh` script handles activation. Dependencies are listed in `requirements.txt`. If you need to install them manually into the venv:
        ```bash
        source .venv/bin/activate
        pip install -r requirements.txt
        deactivate 
        ```

## Running the Application

The `start_vibelab_venv.sh` script automates the process of starting both the backend and frontend.

1.  **Make the script executable (if needed):**
    ```bash
    chmod +x start_vibelab_venv.sh
    ```

2.  **Run the script:**
    ```bash
    ./start_vibelab_venv.sh
    ```

This will:
*   Activate the Python virtual environment.
*   Start the FastAPI backend on `http://localhost:8081`.
    *   API documentation will be available at `http://localhost:8081/docs`.
*   Start a simple Python HTTP server for the frontend on `http://localhost:8080`.
    *   The application should be accessible at `http://localhost:8080`.

## Stopping the Application

*   Press `Ctrl+C` in the terminal where `start_vibelab_venv.sh` is running.
*   Alternatively, the script outputs the PIDs for the backend and frontend processes. You can kill them manually using:
    ```bash
    kill <BACKEND_PID> <FRONTEND_PID> 
    ```
    (Replace `<BACKEND_PID>` and `<FRONTEND_PID>` with the actual process IDs displayed by the script).

## Frontend Notes

*   The current setup uses `python3 -m http.server 8080` to serve the frontend. This is suitable for development.
*   If a `package.json` file exists or is created, Node.js and npm/yarn might be used for more advanced frontend dependency management and build processes in the future. For now, no specific Node.js steps are required beyond having Python available.
