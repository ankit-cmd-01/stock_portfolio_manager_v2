# Stock Portfolio Management System

A comprehensive full-stack web application for managing stock portfolios with advanced analytics, risk assessment, and market insights. Built with Django REST API backend and React frontend.

---

# Sequence Diagram

![sequence_diagram (1)_page-0001](https://github.com/user-attachments/assets/ddee7a5d-75fd-4e05-b489-2460a22bb5e0)


User → React Frontend → Django API → Services Layer → Yahoo Finance / ML Models → Response → UI Dashboard

---

# Frontend Screens

## Dashboard

<img width="1871" height="893" alt="image" src="https://github.com/user-attachments/assets/0eb1566a-1172-4a19-87f0-44318fde9131" />


Features visible on dashboard:

* Portfolio overview
* Total investment value
* Profit / Loss metrics
* Market trend indicators
* Charts and analytics widgets

---

## Portfolio Management

<img width="1919" height="896" alt="image" src="https://github.com/user-attachments/assets/37a207d0-2df3-41cb-b2f3-6bba57c78b8e" />


Users can:

* Create multiple portfolios
* Add stocks with quantity and buy price
* Track portfolio performance
* View individual stock metrics

---

## Portfolio Comparison

<img width="1891" height="865" alt="image" src="https://github.com/user-attachments/assets/084f60c2-aa8c-4e11-86ef-2b1f115801f8" />


Allows users to:

* Compare portfolios with market indices
* Compare performance between portfolios
* Visualize comparison using charts

---

## Explore Metals Market

<img width="1897" height="903" alt="image" src="https://github.com/user-attachments/assets/401bd391-c69b-40f0-9687-259ef04d26fe" />


Tracks precious metals including:

* Gold
* Silver
* Platinum
* Market price trends
* Historical data charts

---

## Risk Categorization

<img width="1897" height="891" alt="image" src="https://github.com/user-attachments/assets/70fa1772-44f3-40b1-86ab-9287175713f1" />


Machine learning based portfolio analysis:

* Risk score calculation
* Categorization (Low / Medium / High Risk)
* Volatility analysis
* Portfolio diversification insights

---

## BTC Forecasting

<img width="1880" height="874" alt="image" src="https://github.com/user-attachments/assets/db260ee2-32e1-415c-8705-3745c8de623a" />


Neural network based Bitcoin prediction:

* Historical BTC price chart
* Forecasted price trend
* Prediction visualization
* Data driven market insights

---

# Features

* **Portfolio Management**: Create and manage multiple stock portfolios
* **Real-time Stock Data**: Live market data integration using Yahoo Finance
* **Risk Analysis**: Advanced portfolio risk categorization and analysis
* **Portfolio Clustering**: Group similar stocks using machine learning algorithms
* **BTC Forecasting**: Bitcoin price prediction using neural networks
* **Metals Market Analysis**: Gold, silver, and other precious metals tracking
* **Comparative Analysis**: Compare portfolio performance against market indices
* **Reports Generation**: Generate PDF and text reports for portfolios
* **Dashboard Analytics**: Comprehensive dashboard with charts and metrics
* **User Authentication**: Secure user registration and login system
* **Responsive Design**: Modern UI built with Tailwind CSS

---

# Tech Stack

## Backend

* **Django 6.0.3** – Web framework
* **SQLite** – Database (development)

Python Libraries:

* `yfinance` – Yahoo Finance market data
* `numpy` & `pandas` – Data processing
* `scikit-learn` – Machine learning algorithms
* `matplotlib` – Chart generation

---

## Frontend

* **React 18** – UI framework
* **Vite** – Build tool
* **Tailwind CSS** – Styling framework
* **React Router** – Client-side routing
* **Recharts** – Data visualization
* **Headless UI** – Accessible UI components
* **Lucide React** – Icons

---

# Prerequisites

* Python 3.8+
* Node.js 16+
* npm or yarn

---

# Installation & Setup

## Backend Setup

Navigate to backend directory

```
cd backend
```

Create virtual environment

```
python -m venv venv
```

Activate environment

Windows

```
venv\Scripts\activate
```

Mac / Linux

```
source venv/bin/activate
```

Install dependencies

```
pip install django djangorestframework yfinance numpy pandas scikit-learn matplotlib
```

Run migrations

```
python manage.py migrate
```

Start backend server

```
python manage.py runserver
```

Backend will run on

```
http://localhost:8000
```

---

## Frontend Setup

Navigate to frontend

```
cd frontend
```

Install dependencies

```
npm install
```

Start development server

```
npm run dev
```

Frontend will run on

```
http://localhost:5173
```

---

# API Endpoints

## Authentication

```
POST /api/auth/login/
POST /api/auth/register/
POST /api/auth/logout/
```

---

## Portfolio Management

```
GET /api/portfolios/
POST /api/portfolios/
GET /api/portfolios/{id}/
PUT /api/portfolios/{id}/
DELETE /api/portfolios/{id}/
```

---

## Stock Operations

```
GET /api/stocks/search/
GET /api/stocks/{symbol}/
POST /api/portfolios/{id}/stocks/
PUT /api/stocks/{id}/
DELETE /api/stocks/{id}/
```

---

## Analytics & Services

```
GET /api/portfolios/{id}/risk/
GET /api/portfolios/{id}/cluster/
GET /api/btc/forecast/
GET /api/metals/
GET /api/compare/
GET /api/reports/{id}/
```

---

# Project Structure

```
stock_portfolio_manage_v2/
│
├── backend/
│   ├── config/
│   ├── portfolio/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── services/
│   │   │   ├── stock_service.py
│   │   │   ├── risk_service.py
│   │   │   ├── clustering_service.py
│   │   │   ├── btc_service.py
│   │   │   ├── metals_service.py
│   │   │   ├── compare_service.py
│   │   │   └── report_service.py
│   │   └── migrations/
│   │
│   ├── db.sqlite3
│   └── manage.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── utils/
│   │   └── styles/
│   │
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

# Development

Run backend tests

```
cd backend
python manage.py test
```

Run frontend tests

```
cd frontend
npm test
```

---

# Production Build

Backend

```
python manage.py collectstatic
```

Frontend

```
npm run build
```

---

# Environment Variables

Create `.env` inside backend

```
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
```

---

# License

MIT License

---

# Acknowledgments

* Yahoo Finance for stock market data
* scikit-learn for machine learning
* Django framework
* React ecosystem
