# Cardiac Crusade Volunteer App

A comprehensive web application for coordinating volunteers to map Automated External Defibrillators (AEDs) and save lives during cardiac emergencies.  

## Key Features

### Map Screen & Discovery
- **Import by Category**: Discover businesses via Google Places based on specific categories (e.g., Gyms, Restaurants, Schools).
- **Import by Area**: Draw a circular area on the map to search for all businesses within a specific radius.
- **Manual Addition**: Manually add locations with Google Places Address Autocomplete support.
- **Geolocation Support**: Use the "📍 Use My Location" feature to instantly capture coordinates and address.
- **Excel-like Filtering**: Powerful real-time filtering for search results (by name, address, or category) before confirming imports.
- **Geographical Assignment**: Assign volunteers to specific areas by drawing rectangles on the map.

### Management & Reporting
- **User Hierarchy**: Supports Admins, City Coordinators, CHAARG Leaders, and Volunteers with cascading reporting.
- **Audit Logs**: Full history of status changes for every location.
- **Location Details**: Deep links to `aed.new` for official mapping and confetti-celebration for completed tasks.
- **Mobile-First Design**: Optimized for field use with touch-friendly map controls.

### Security
- **Multi-Method Auth**: Supports Passkeys (FIDO2/WebAuthn), Social Login (Google/Facebook), and OTP-secured Email/Password.
- **Admin Controls**: Manage Google API keys and project settings directly from the UI.

## Local Deployment (Testing)

The recommended way to deploy the application locally for testing after making changes is using **Docker Compose**.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/dotson97/cardiac-crusade.git
    cd cardiac-crusade
    ```
2.  **Configure Environment**:
    Copy the example environment file and adjust values if needed:
    ```bash
    cp .env.example .env
    ```
3.  **Build and Run**:
    Use Docker Compose to build the images and start the services:
    ```bash
    docker compose up --build -d
    ```
4.  **Access the App**:
    Open your browser and navigate to:
    `http://localhost:1443`

### Administrative Configuration
After logging in for the first time:
1. Navigate to the **Settings** page.
2. In the **Admin Controls** section, provide your **Google Places API Key**.
3. Set your **Default Origin City** (e.g., "Lexington, KY") to bias address autocomplete and searches.

## Troubleshooting
- **Logs**: View application logs using `docker compose logs -f`.
- **Database**: The PostgreSQL database is persistent and stored in the `pgdata` volume.
- **Reset**: To completely reset the environment, run `docker compose down -v`.

---
© 2026 [Cardiac Crusade](https://cardiaccrusade.org/)
