# Budgetability

A modern, responsive budget tracking application with Supabase backend and GitHub Pages deployment.

## Architecture

- **Frontend**: React + Vite → GitHub Pages
- **Backend/Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **CI/CD**: GitHub Actions

## Quick Start

### 1. Setup Supabase Backend

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Run the database schema** in your Supabase SQL editor:

   ```sql
   -- Copy and paste the contents from supabase/schema.sql
   ```

3. **Get your project credentials** from Settings > API:
   - Project URL
   - Anon/Public key

### 2. Setup GitHub Repository

1. **Fork this repository**

2. **Configure repository secrets** (Settings > Secrets and variables > Actions):

   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Enable GitHub Pages** (Settings > Pages):
   - Source: "GitHub Actions"

### 3. Deploy

Push to the `main` branch and GitHub Actions will automatically:

- Build the React app
- Deploy to GitHub Pages
- Your app will be available at: `https://yourusername.github.io/repository-name`

## Local Development

```bash
# Clone and install
git clone your-repo-url
cd daily-budget-app
npm install

# Create environment file
cp .env.example .env
# Add your Supabase credentials to .env

# Start development server
npm run dev
```

## Features

- 📅 Monthly calendar with expense tracking
- 📊 Weekly budget planning
- 💰 Real-time budget calculations
- 🎨 Beautiful paper-inspired UI
- 🔄 Real-time sync with Supabase
- 📱 Fully responsive design
- 🔒 Secure user authentication
- 📊 Data persistence in the cloud

## Database Schema

Three main tables with Row Level Security:

- **budgets**: Monthly budget amounts per user
- **expenses**: Individual expense records per user
- **plans**: Weekly planning items per user

## Deployment Details

### Supabase Setup

- PostgreSQL database with Row Level Security
- Built-in authentication system
- Real-time subscriptions ready
- Automatic backups and scaling

### GitHub Pages Deployment

- Automatic builds on push to main
- Optimized static site delivery
- Custom domain support
- HTTPS by default

## Environment Variables

Production environment (GitHub Secrets):

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Local development (.env):

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Build**: Vite
- **UI**: shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Deployment**: GitHub Actions → GitHub Pages
- **Fallback**: localStorage (when offline)

## Workflow

1. **Code changes** pushed to main branch
2. **GitHub Actions** triggers automatically
3. **Build process** creates optimized static files
4. **Deployment** to GitHub Pages
5. **Live app** available immediately

The app works offline with localStorage fallback and syncs when back online.
