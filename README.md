# Stock Portfolio Management System

A comprehensive full-stack web application for managing stock portfolios with advanced analytics, risk assessment, and market insights. It uses a Django backend, a React/Vite frontend, and is now prepared for Linux Azure VM deployment with Gunicorn and Nginx.

## Sequence Diagram

![sequence_diagram (1)_page-0001](https://github.com/user-attachments/assets/ddee7a5d-75fd-4e05-b489-2460a22bb5e0)

User -> React Frontend -> Django API -> Services Layer -> Yahoo Finance / ML Models -> Response -> UI Dashboard

## Frontend Screens

### Dashboard

<img width="1871" height="893" alt="image" src="https://github.com/user-attachments/assets/0eb1566a-1172-4a19-87f0-44318fde9131" />

Features visible on dashboard:

- Portfolio overview
- Total investment value
- Profit / Loss metrics
- Market trend indicators
- Charts and analytics widgets

### Portfolio Management

<img width="1919" height="896" alt="image" src="https://github.com/user-attachments/assets/37a207d0-2df3-41cb-b2f3-6bba57c78b8e" />

Users can:

- Create multiple portfolios
- Add stocks with quantity and buy price
- Track portfolio performance
- View individual stock metrics

### Portfolio Comparison

<img width="1891" height="865" alt="image" src="https://github.com/user-attachments/assets/084f60c2-aa8c-4e11-86ef-2b1f115801f8" />

Allows users to:

- Compare portfolios with market indices
- Compare performance between portfolios
- Visualize comparison using charts

### Explore Metals Market

<img width="1897" height="903" alt="image" src="https://github.com/user-attachments/assets/401bd391-c69b-40f0-9687-259ef04d26fe" />

Tracks precious metals including:

- Gold
- Silver
- Platinum
- Market price trends
- Historical data charts

### Risk Categorization

<img width="1897" height="891" alt="image" src="https://github.com/user-attachments/assets/70fa1772-44f3-40b1-86ab-9287175713f1" />

Machine learning based portfolio analysis:

- Risk score calculation
- Categorization (Low / Medium / High Risk)
- Volatility analysis
- Portfolio diversification insights

### BTC Forecasting

<img width="1880" height="874" alt="image" src="https://github.com/user-attachments/assets/db260ee2-32e1-415c-8705-3745c8de623a" />

Neural network based Bitcoin prediction:

- Historical BTC price chart
- Forecasted price trend
- Prediction visualization
- Data driven market insights

## Features

- Portfolio management
- Real-time stock data integration using Yahoo Finance
- Risk analysis and categorization
- Portfolio clustering
- BTC forecasting
- Metals market analysis
- Comparative analysis
- PDF and text report generation
- Dashboard analytics
- User authentication flow in frontend context
- Responsive UI

## Stack

- Backend: Django, SQLite by default, yfinance, pandas, numpy, scikit-learn, reportlab
- Frontend: React 18, Vite, Tailwind CSS, React Router, Recharts, Headless UI, Lucide React
- Production runtime: Gunicorn + Nginx

## Project Layout

```text
stock_portfolio_manage_v2/
|-- backend/
|   |-- config/
|   |-- portfolio/
|   |-- manage.py
|   |-- requirements.txt
|   |-- requirements-optional-forecasting.txt
|   `-- .env.example
|-- frontend/
|   |-- src/
|   |-- package.json
|   `-- .env.production.example
|-- deploy/
|   `-- azure-vm/
|       |-- bootstrap.sh
|       |-- gunicorn.service
|       `-- nginx.conf
`-- README.md
```

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/api/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://127.0.0.1:5173/`.

The Vite dev proxy defaults to `http://127.0.0.1:8000`, but you can override it with `VITE_DEV_API_PROXY_TARGET`.

## Production Configuration

The backend reads deployment settings from environment variables.

### Required

```env
DJANGO_SECRET_KEY=replace-this-with-a-long-random-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=YOUR_VM_PUBLIC_IP,localhost,127.0.0.1
```

### Common Optional

```env
DJANGO_CSRF_TRUSTED_ORIGINS=http://YOUR_VM_PUBLIC_IP,https://your-domain.com
DJANGO_CORS_ALLOWED_ORIGINS=http://YOUR_VM_PUBLIC_IP,https://your-domain.com
DJANGO_TIME_ZONE=Asia/Kolkata
DJANGO_SECURE_SSL_REDIRECT=False
DJANGO_SESSION_COOKIE_SECURE=False
DJANGO_CSRF_COOKIE_SECURE=False
DJANGO_SECURE_HSTS_SECONDS=0
# DATABASE_URL=postgres://username:password@127.0.0.1:5432/stock_portfolio
```

If `DATABASE_URL` is not set, Django uses `backend/db.sqlite3`.

For the frontend, keep `VITE_API_BASE_URL` empty when Nginx serves both the frontend and backend from the same host.

## Azure VM Deployment

These steps assume Ubuntu on Azure VM and a project path of `/var/www/stock_portfolio_manage_v2`.

### 1. Install system packages

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx nodejs npm
```

### 2. Upload or clone the project

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <your-repo-url> stock_portfolio_manage_v2
cd stock_portfolio_manage_v2
```

### 3. Create backend env file

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, and the origin settings to your real VM IP or domain.

### 4. Build the app

```bash
chmod +x deploy/azure-vm/bootstrap.sh
./deploy/azure-vm/bootstrap.sh /var/www/stock_portfolio_manage_v2
```

Optional richer BTC forecasting:

```bash
source backend/.venv/bin/activate
pip install -r backend/requirements-optional-forecasting.txt
```

### 5. Create the Gunicorn service

```bash
sudo cp deploy/azure-vm/gunicorn.service /etc/systemd/system/stock-portfolio.service
sudo nano /etc/systemd/system/stock-portfolio.service
```

Update the `User=` line if your VM user is not `azureuser`.

Then start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stock-portfolio
sudo systemctl start stock-portfolio
sudo systemctl status stock-portfolio
```

### 6. Configure Nginx

```bash
sudo cp deploy/azure-vm/nginx.conf /etc/nginx/sites-available/stock-portfolio
sudo ln -s /etc/nginx/sites-available/stock-portfolio /etc/nginx/sites-enabled/stock-portfolio
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

If your project path differs from `/var/www/stock_portfolio_manage_v2`, update the paths inside `deploy/azure-vm/nginx.conf`.

### 7. Open Azure network ports

Allow at least:

- `80` for HTTP
- `443` for HTTPS if you add TLS later

### 8. Verify the deployment

```bash
curl http://YOUR_VM_PUBLIC_IP/api/health/
```

Expected response:

```json
{"status":"ok"}
```

## API Endpoints

- `GET /api/health/`
- `GET /api/portfolios/`
- `POST /api/portfolios/`
- `GET /api/portfolios/{portfolio_id}/stocks/`
- `POST /api/portfolios/{portfolio_id}/stocks/`
- `DELETE /api/portfolios/{portfolio_id}/stocks/{stock_id}/`
- `GET /api/stocks/search/?query=...`
- `GET /api/stocks/detail/{symbol}/`
- `POST /api/compare/`
- `GET /api/metals/history/`
- `POST /api/metals/predict/`
- `GET /api/risk/portfolio/{portfolio_id}/`
- `GET /api/risk/stock/{symbol}/`
- `GET /api/clustering/portfolio/{portfolio_id}/`
- `GET /api/clustering/market/?symbols=AAPL,MSFT`
- `GET /api/btc/history/`
- `GET /api/btc/forecast/`
- `POST /api/reports/portfolio/`

## Development Checks

```bash
cd backend
python manage.py test

cd ../frontend
npm run build
```

## Notes

- Frontend API calls use relative `/api/...` paths by default.
- CORS support is available through env vars if you later host the frontend on a different origin.
- `requirements-optional-forecasting.txt` stays separate because those packages are heavier and not required for the app to boot.

## License

MIT License

## Acknowledgments

- Yahoo Finance for market data
- scikit-learn for machine learning
- Django framework
- React ecosystem
