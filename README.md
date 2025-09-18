# Expense Tracker

A simple, client-side expense tracker to record income/expenses, view summaries, filter by category and month/year, and visualize data with charts. Data is stored in the browser using localStorage.

## Features
- Add, edit, delete transactions (amount, category, type, date)
- Include/exclude transactions from main summary
- Persistent storage via localStorage
- Summary cards: total income, expenses, and balance
- Filters: category, year, month (e.g., 01 - January)
- Dual summaries (Main and Excluded)
- Charts (Chart.js):
  - Pie: expenses by category
  - Line: income vs expense over time (YYYY-MM)

## Getting Started
1. Clone or download this repository
2. Open `index.html` in your browser

No build step required. Modern browsers recommended.

## Usage
- Fill the form and click "Add Transaction"
- Click "Edit" or "Delete" on any transaction
- Use filters (Category, Year, Month) to refine the list and summaries
- Check "Exclude from main summary" to keep an item out of the main totals (it appears in the Excluded summary)

## Tech Stack
- HTML, CSS, JavaScript (no framework)
- Chart.js (via CDN) for visualizations
- localStorage for persistence

## Project Structure
- `index.html` — markup & sections (summary, filters, charts, form, list)
- `style.css` — layout and component styles
- `script.js` — app logic, persistence, filters, summaries, charts

## License
MIT
