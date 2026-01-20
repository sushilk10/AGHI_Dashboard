# AGHI (Aadhaar Governance Health Index) Dashboard

> **"Optimizing Digital Identity Governance through AI & Data Analytics"**

![AGHI Dashboard](https://via.placeholder.com/800x400.png?text=AGHI+Executive+Dashboard)

## 🚀 Overview

The **AGHI Executive Dashboard** is a state-of-the-art analytical platform designed for UIDAI administrators. It transforms raw biometric and demographic update logs into a real-time **Governance Health Index (AGHI)**—a composite metric tracking system efficiency, data integrity, and inclusivity.

Unlike static reports, this dashboard is **alive**. It features an integrated **AI Assistant** that monitors the system, answers queries, and automates navigation.

---

## 🎯 Core Capabilities

### 1. 🇮🇳 National vs. State Views (Persona Switching)
- **Executive Hub**: Bird's-eye view of India's biometric ecosystem. Tracking National AGHI (61.8) and Update Success Rates.
- **State Admin Mode**: One-click drill-down into specific states (e.g., **Maharashtra Pilot**). Visualizes district-level performance maps.
- **Critical Operations**: A dedicated "Ops Monitor" for tracking SLA breaches and system failures.

### 2. 🧠 Proper AI Assistant (Backend Integrated)
An intelligent conversational agent powered by `AGHIChatbot` logic.
- **Data-Driven**: Reads live values from the backend dataset.
- **Navigation**: Command it to *"Show me Bihar"* or *"Open Critical Ops"*.
- **Comparison Engine**: Ask *"Compare Punjab and Gujarat"* to get a comparative gap analysis.
- **Problem Detection**: Ask *"What is the problem in Maharashtra?"* to identify the weakest governance pillar.

### 3. ⚡ Operational Intelligence
- **SLA Tracker**: Monitors Enrollment TAT (<3 days) and Update TAT (<5 days).
- **Failure Analysis**: Visualizes root causes of transaction failures (Bio-Mismatch, Tech Errors).
- **Live Ticker**: Real-time system feed simulating monitoring of 700+ districts.

---

## � Component Guide

## 📖 Component Guide

### 1. 🧭 Header Navigation & Persona Switching
The top bar acts as the central control deck. It uses a **"Pill-Style" Switcher** to toggle the dashboard's mode:
- **National View**: The default aggregation level. Calculates averages from all 36 States/UTs.
- **State Admin**: A "Drill-Down" mode. Specifically optimized for the **Maharashtra Pilot**. When clicked, it loads district-level CSV data and re-renders the map.
- **Operations Manager**: Switches the UI to a "Dark Mode" aesthetic, focusing purely on technical health and error rates.

### 2. � AGHI AI Command Center (Bottom-Right)
A floating conversational agent that acts as a co-pilot.
- **Backend-Powered**: Unlike simple chatbots, this sends your query to `backend/chatbot.py`.
- **RAG Capability**: It "reads" the entire dataset to answer complex questions like *"What is the updated rate in Pune compared to Mumbai?"*.
- **Action Triggers**: If you say *"Open Critical Ops"*, the AI doesn't just reply—it **executes** the layout switch automatically using the dashboard's API.
- **Suggestion Chips**: One-click prompts (`[National View]`, `[Gen Report]`) for quick navigation.

### 3. 🗺️ Interactive Geospatial Map (Leaflet.js)
- **Choropleth Logic**: The map automatically colors regions based on their AGHI Score:
  - 🟢 **Green (>80)**: Excellent Governance.
  - 🟡 **Yellow (40-80)**: Average Performance.
  - 🔴 **Red (<40)**: Critical Intervention Zone.
- **Drill-Down**: Clicking a state zooms in to show district boundaries (currently active for Maharashtra).
- **Search**: A fuzzy-search bar (`dashboard.js`) allows instant zooming to any locale.

### 4. � Trend Analysis & KPI Cards
- **Live KPIs**: The top row shows "National AGHI", "Update Success Rate", and "Digital Inclusion". These pulse to indicate live data feeds.
- **Trend Lab (Plotly.js)**: The large line chart tracks performance over 12 months.
  - **Dynamic Metrics**: Browsing the dropdown alters the X/Y axis to show `Enrollments`, `Biometric Updates`, or `Demographic Changes`.
  - **Comparative View**: In State mode, it overlays the District's line against the State Average.

### 5. 🚨 Critical Operations Monitor (Ops View)
A specialized view for technical oversight.
- **SLA Tracker**: Visual progress bars showing adherence to statutory timelines (e.g., *Enrollment must be processed in <3 days*).
- **Failure Root Cause Analysis**: A Donut Chart that breaks down *why* transactions fail (e.g., 45% due to Doc Quality, 15% due to Biometric Mismatch).
- **Integrity Watchlist**: A prioritized table listing operators or regions flagged by the `AnomalyDetector` engine.

---

## 🎨 Dashboard Layout & Visual Components

### Header Section
**National Intelligence Header**
- **System Vitality Badge**: Shows "OPTIMAL" status with color-coded indicators
- **National Resilience Score**: Calculated metric showing governance stability
- **Intervention Zones Counter**: Displays number of critical regions requiring attention
- **Governance Maturity Badge**: Level-based classification (e.g., "LEVEL 4 - ADVANCED")
- **System Volume Bar**: Visual load indicator showing current processing capacity

### KPI Cards (Top Row)
Five premium cards displaying real-time metrics:

1. **National AGHI Card**
   - Large numeric display of the composite governance score
   - Trend indicator (↑/↓) showing monthly change
   - Animated "heartbeat" line indicating live data
   - Last updated timestamp

2. **Update Success Rate Card**
   - Percentage display of successful biometric/demographic updates
   - "Across all states" context label
   - Color-coded based on threshold (>90% = green)

3. **Priority Regions Card**
   - Count of districts requiring immediate intervention
   - Warning icon for critical status
   - Links to detailed intervention plans

4. **Digital Inclusion Card**
   - Youth coverage ratio (0-17 years)
   - Percentage display with progress visualization
   - Tracks Aadhaar penetration in younger demographics

5. **Top Performer Card** (Special Design)
   - Gold trophy icon with premium styling
   - Large "#1" rank badge
   - State name with AGHI score
   - "GOVERNANCE CHAMPION" status tag

### Main Dashboard Grid

**Left Column (Large):**
- **Interactive Map Container**
  - Breadcrumb navigation (India → State → District)
  - Search box for instant location lookup
  - Choropleth visualization (550px height)
  - Color legend showing AGHI ranges
  - Hover tooltips with quick stats

**Right Column (Small):**
- **State Rankings Panel**
  - Toggle between "Top Performers" and "Priority States"
  - Scrollable list with rank badges
  - Each item shows: Rank, State/District name, AGHI score, Category badge
  - Color-coded performance indicators

**Full Width Row:**
- **Trend Analysis Lab**
  - 5 mini-charts in a grid layout
  - Each chart tracks a different metric over 12 months
  - Metrics: AGHI Score, Monthly Enrollment, Total Updates, Demographic Updates, Biometric Updates
  - Responsive design with synchronized time axes

**Bottom Section:**
- **AI Command Directives Terminal**
  - Terminal-style interface with monospace font
  - Real-time alert feed
  - Badge counter showing active alerts
  - "SYSTEM MONITORING ACTIVE" status indicator

### Critical Operations Section (Ops View Only)
Appears when "Operations" persona is selected:

- **SLA Compliance Tracker**
  - Three progress bars: Enrollment TAT, Update TAT, Grievance Resolution
  - Color-coded: Green (>90%), Yellow (80-90%), Red (<80%)
  - Percentage labels on each bar

- **Failure Root Cause Analysis**
  - Three circular donut charts
  - Categories: Bio-Mismatch (15%), Doc Quality (45%), Tech Error (10%)
  - Animated on load with color gradients

- **Operator Integrity Watchlist**
  - Sortable data table
  - Columns: Region, Flagged Ops, Risk Score, Status
  - "View All" button for detailed reports

### Footer
**Intelligence Ticker**
- Horizontal scrolling news feed
- Live system updates (e.g., "Data Integrity Check: Passed 99.8%")
- Icons for different alert types
- Infinite loop animation

---

## 🛠️ Technology Stack

- **Backend**: Python (Flask)
  - `pandas` for high-performance data aggregation.
  - `scikit-learn` for anomaly detection (Isolation Forest).
  - Custom `AGHIChatbot` module for NLP intent recognition.
- **Frontend**: 
  - **HTML5/CSS3**: Custom "Glassmorphism" Design System.
  - **Vanilla JavaScript**: Lightweight, dependency-free logic.
  - **Plotly.js**: Interactive Trend Charts and Heatmaps.
  - **Leaflet/Geo**: Vector maps for district-level rendering.

---

## 📦 Installation & Setup

### Prerequisites
- Python 3.8+
- `pip`

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```
*(Key requirements: flask, pandas, numpy, scikit-learn)*

### Step 2: Launch the System
```bash
python backend/app.py
```

### Step 3: Access Dashboard
Open your secure browser channel:
`http://localhost:5000/dashboard.html`

---

## 🤖 AI Commands to Try
Once the dashboard is running, click the **Robot Icon** and try these:
- `"Show me National"`
- `"Analysis for Maharashtra"`
- `"Compare Kerala and Assam"`
- `"What is the Inclusion Score?"`
- `"Alert Critical Ops"`

---

**Developed for UIDAI Hackathon 2024**
*Bringing Data-Driven Transparency to a Billion Identities.*
#   A G H I _ D a s h b o a r d  
 