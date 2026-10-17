# Integration Testing Guide

## Overview

This guide provides step-by-step instructions for testing the Smart Fleet Platform end-to-end, verifying that the frontend can communicate with backend services through the API Gateway.

## Prerequisites

- Docker installed and running
- .NET 10 SDK
- Node.js and npm
- All services started via `run-all.ps1`

### Local AI Assistant Setup

Development uses Ollama by default and does not require Azure credentials. Install Ollama, ensure its local service is running on port 11434, then download the configured model:

```powershell
ollama pull qwen3:0.6b
ollama list
```

The AI service development settings use `http://localhost:11434/v1` and model `qwen3:0.6b`. Restart the AI service after configuration changes. If Ollama is already running, do not start a second `ollama serve` process.

To use Azure OpenAI instead, set these environment variables before starting the AI service; keep the key out of source control:

```powershell
$env:AI__Provider = 'AzureOpenAI'
$env:AzureOpenAI__Endpoint = '<your-endpoint>'
$env:AzureOpenAI__ApiKey = '<your-api-key>'
$env:AzureOpenAI__DeploymentName = '<your-deployment>'
```

## Test Execution Steps

### 1. Start All Services

```powershell
# Navigate to project root
cd c:\Users\YUSUF SAYED\AI Project 070526\smart-fleet-platform

# Run the startup script
.\run-all.ps1
```

**Expected Behavior:**
- All Docker containers (SQL Server, Kafka, Zookeeper) start successfully
- All .NET services (Fleet, Identity, AI, Notification) start without errors
- Frontend (React/Vite) starts on http://localhost:5173
- API Gateway starts on http://localhost:5000

**Verification:**
- Check docker: `docker ps` (should show 3 containers running)
- Fleet Service Swagger: http://localhost:5081/swagger
- Identity Service Swagger: http://localhost:5057/swagger

---

### 2. Authentication Flow Tests

#### Test 2.1: User Registration

**Endpoint:** POST `/identity/Auth/register`

**Request:**
```bash
curl -X POST http://localhost:5000/identity/Auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "testuser@smartfleet.com",
    "password": "Password@123",
    "role": "Dispatcher"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": null
}
```

**Frontend Test:**
1. Navigate to http://localhost:5173/register
2. Enter: Name = "Test User", Email = "testuser@smartfleet.com", Password = "Password@123"
3. Click "Create account"
4. Verify: Success message appears and redirect to login after 1.2 seconds

---

#### Test 2.2: User Login

**Endpoint:** POST `/identity/Auth/login`

**Request:**
```bash
curl -X POST http://localhost:5000/identity/Auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@smartfleet.com",
    "password": "Admin@123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": null
}
```

**Frontend Test:**
1. Navigate to http://localhost:5173/login
2. Enter: Email = "admin@smartfleet.com", Password = "Admin@123"
3. Click "Sign In"
4. Verify: Token stored in localStorage and redirect to /dashboard

---

### 3. Fleet Data Retrieval Tests

#### Test 3.1: Dashboard Stats

**Endpoint:** GET `/fleet/Dashboard/stats`

**Request:**
```bash
curl -X GET http://localhost:5000/fleet/Dashboard/stats \
  -H "Authorization: Bearer {token}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard stats fetched successfully",
  "data": {
    "stats": {
      "totalVehicles": 0,
      "activeTrips": 0,
      "availableDrivers": 0,
      "maintenanceDueCount": 0,
      "monthlyFuelCost": 0,
      "safetyScore": 85
    },
    "vehicleStatusBreakdown": [],
    "monthlyFuelCosts": [],
    "recentActivities": []
  }
}
```

**Frontend Test:**
1. Login successfully
2. Navigate to http://localhost:5173/dashboard
3. Verify: Dashboard loads with KPI cards and charts
4. Verify: No errors in browser console (check DevTools)

---

#### Test 3.2: Vehicles List

**Endpoint:** GET `/fleet/vehicles`

**Request:**
```bash
curl -X GET http://localhost:5000/fleet/vehicles \
  -H "Authorization: Bearer {token}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vehicles fetched successfully",
  "data": []
}
```

**Frontend Test:**
1. From dashboard, navigate to "Vehicles"
2. Verify: Table loads (empty or with placeholder)
3. Click "Add Vehicle" button
4. Fill form: Registration=ABC123, Manufacturer=Toyota, Model=Camry, Year=2024, FuelCapacity=60
5. Click "Create"
6. Verify: Success toast appears and table refreshes

---

#### Test 3.3: Create Vehicle

**Endpoint:** POST `/fleet/vehicles`

**Request:**
```bash
curl -X POST http://localhost:5000/fleet/vehicles \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleNumber": "ABC123",
    "manufacturer": "Toyota",
    "model": "Camry",
    "year": 2024,
    "fuelCapacity": 60
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vehicle created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "vehicleNumber": "ABC123",
    "manufacturer": "Toyota",
    "model": "Camry",
    "year": 2024,
    "fuelCapacity": 60,
    "status": "Active",
    "createdAt": "2026-07-06T10:00:00Z"
  }
}
```

**Frontend Test:**
1. After creating vehicle, click on the vehicle row
2. Verify: Detail page loads showing vehicle info
3. Verify: All fields populate correctly

---

#### Test 3.4: Drivers List

**Endpoint:** GET `/fleet/drivers`

**Request:**
```bash
curl -X GET http://localhost:5000/fleet/drivers \
  -H "Authorization: Bearer {token}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Drivers fetched successfully",
  "data": []
}
```

**Frontend Test:**
1. From dashboard, navigate to "Drivers"
2. Verify: Cards grid loads (empty or with placeholder)
3. Click on a driver card to view detail page

---

### 4. UI/UX Flow Tests

#### Test 4.1: Navigation

- [x] Sidebar navigation works on desktop
- [x] Mobile hamburger menu opens/closes
- [x] Links navigate to correct pages
- [x] Active route highlights in sidebar

#### Test 4.2: Responsive Layout

- [x] Desktop (1920px): Full sidebar, multi-column grids
- [x] Tablet (768px): Responsive cards and tables
- [x] Mobile (375px): Single column, stacked layout

#### Test 4.3: Error Handling

- [x] Logout clears token and redirects to login
- [x] Invalid credentials show error message
- [x] Network timeout shows error alert
- [x] Server errors display gracefully

---

### 5. Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✓ Tested |
| Firefox | Latest | Recommended |
| Safari | Latest | Recommended |
| Edge | Latest | ✓ Tested |

---

## Troubleshooting

### Issue: Login fails with 404 or CORS error

**Solution:**
- Verify API Gateway is running on port 5000
- Check Vite proxy config in `vite.config.ts`
- Clear browser cache and localStorage

### Issue: Dashboard shows no data

**Solution:**
- Verify Fleet Service is running on port 5081
- Check database connection: `docker logs smartfleet-sqlserver`
- Verify Kafka is running: `docker logs zookeeper` and `docker logs kafka`

### Issue: "Token invalid or expired"

**Solution:**
- Re-login to get a fresh token
- Check JWT secret in Identity Service configuration
- Verify all services are synchronized on time

### Issue: AI Assistant cannot connect to its local model

**Solution:**
- Confirm Ollama is running on port 11434 with `ollama list`
- Download the configured model with `ollama pull qwen3:0.6b`
- Restart AIService so it loads the development provider settings

---

## Performance Benchmarks (Target)

- Frontend load time: < 2 seconds
- Dashboard stats API: < 500ms
- Vehicle list API: < 1 second
- Login API: < 500ms

---

## Success Criteria

✓ All 5 test categories pass
✓ No console errors
✓ All API responses match expected contracts
✓ Frontend gracefully handles error states
✓ UI is responsive across all breakpoints

---

## Next Steps

- [ ] Add automated integration tests (Jest/React Testing Library)
- [ ] Load testing with artillery or k6
- [ ] Security testing (OWASP Top 10)
- [ ] Accessibility testing (WCAG 2.1)
