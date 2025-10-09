# Deployment Guide - Hosting Options

This guide covers how to deploy your text detection application to various hosting platforms.

## Prerequisites

Before deploying to any platform:

1. **Configure Environment Variables**
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

2. **GCP Vision API Setup** (See GCP_DEPLOYMENT_GUIDE.md)
   - Configure `GCP_VISION_API_KEY` in Supabase Edge Functions

3. **Build the Project**
   ```bash
   npm install
   npm run build
   ```
   This creates a `dist/` folder with production-ready files.

---

## Option 1: Vercel (Recommended)

Vercel is perfect for React/Vite applications with zero configuration.

### Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - Project name? (default or custom)
# - Directory? ./
# - Override settings? No
```

### Deploy via Git (GitHub/GitLab/Bitbucket)

1. Push your code to a Git repository
2. Go to https://vercel.com/new
3. Import your repository
4. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click "Deploy"

### Custom Domain

```bash
vercel --prod
vercel domains add yourdomain.com
```

---

## Option 2: Netlify

Netlify offers easy deployment with great CI/CD integration.

### Deploy via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize and deploy
netlify init

# Follow prompts and configure:
# - Build command: npm run build
# - Publish directory: dist

# Deploy
netlify deploy --prod
```

### Deploy via Git

1. Push code to GitHub/GitLab/Bitbucket
2. Go to https://app.netlify.com/start
3. Connect your repository
4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click "Deploy site"

### Netlify Configuration File

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Option 3: GitHub Pages

Free hosting for static sites directly from your GitHub repository.

### Setup Steps

1. **Install gh-pages package**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "homepage": "https://yourusername.github.io/repository-name",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Update vite.config.ts**
   ```typescript
   export default defineConfig({
     base: '/repository-name/',
     plugins: [react()],
   })
   ```

4. **Deploy**
   ```bash
   npm run deploy
   ```

5. **Configure GitHub**
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: gh-pages
   - Folder: / (root)

### Environment Variables

GitHub Pages doesn't support server-side env vars. You need to:
- Use GitHub Actions to inject env vars during build
- Or hardcode them (not recommended for sensitive data)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Add secrets in Settings → Secrets and variables → Actions.

---

## Option 4: Cloudflare Pages

Fast global CDN with generous free tier.

### Deploy via CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
npx wrangler pages deploy dist --project-name=text-detection
```

### Deploy via Git

1. Push code to GitHub/GitLab
2. Go to https://dash.cloudflare.com
3. Pages → Create a project
4. Connect your repository
5. Configure build:
   - Build command: `npm run build`
   - Build output directory: `dist`
6. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Save and Deploy

---

## Option 5: AWS Amplify

Enterprise-grade hosting with AWS integration.

### Deploy via Console

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your Git repository
4. Configure build:
   - Build command: `npm run build`
   - Base directory: (leave empty)
   - Build output directory: `dist`
5. Add Environment Variables
6. Save and Deploy

### amplify.yml Configuration

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

---

## Option 6: Firebase Hosting

Google's hosting solution with great performance.

### Setup and Deploy

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Configure:
# - Public directory: dist
# - Single-page app: Yes
# - GitHub integration: Optional

# Build and deploy
npm run build
firebase deploy
```

### firebase.json Configuration

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## Option 7: DigitalOcean App Platform

Simple PaaS with transparent pricing.

### Deploy via Console

1. Go to DigitalOcean App Platform
2. Create New App
3. Connect your repository
4. Configure:
   - Type: Static Site
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add Environment Variables
6. Deploy

### app.yaml Configuration

```yaml
name: text-detection
static_sites:
- name: web
  build_command: npm run build
  output_dir: dist
  environment_slug: node-js
  envs:
  - key: VITE_SUPABASE_URL
    value: ${VITE_SUPABASE_URL}
  - key: VITE_SUPABASE_ANON_KEY
    value: ${VITE_SUPABASE_ANON_KEY}
```

---

## Option 8: Render

Modern cloud platform with easy deployment.

### Deploy via Console

1. Go to https://render.com
2. New → Static Site
3. Connect your repository
4. Configure:
   - Build Command: `npm run build`
   - Publish Directory: `dist`
5. Add Environment Variables
6. Create Static Site

### render.yaml Configuration

```yaml
services:
  - type: web
    name: text-detection
    env: static
    buildCommand: npm run build
    staticPublishPath: dist
    envVars:
      - key: VITE_SUPABASE_URL
        sync: false
      - key: VITE_SUPABASE_ANON_KEY
        sync: false
```

---

## Option 9: Self-Hosted (VPS/Server)

Deploy to your own server (DigitalOcean Droplet, AWS EC2, etc.)

### Using Nginx

```bash
# On your server
# Install Node.js and Nginx
sudo apt update
sudo apt install nodejs npm nginx

# Clone repository
git clone your-repo-url
cd your-repo

# Install dependencies and build
npm install
npm run build

# Configure Nginx
sudo nano /etc/nginx/sites-available/text-detection

# Add configuration:
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/your-repo/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/text-detection /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:

```bash
docker build -t text-detection .
docker run -p 80:80 text-detection
```

---

## Environment Variables Management

### Creating .env.production

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Platform-Specific Notes

- **Never commit .env files to Git**
- Most platforms support environment variables in their dashboard
- For GitHub Pages, use GitHub Actions secrets
- For Docker, use docker-compose or pass via `-e` flag

---

## Post-Deployment Checklist

- [ ] Application loads correctly
- [ ] Environment variables are configured
- [ ] Supabase connection works
- [ ] Image upload functions properly
- [ ] Text detection returns results
- [ ] GCP Vision API key is configured in Supabase
- [ ] HTTPS is enabled (SSL certificate)
- [ ] Custom domain configured (if applicable)
- [ ] Error monitoring setup (optional)

---

## Recommended Platforms by Use Case

| Use Case | Recommended Platform | Reason |
|----------|---------------------|---------|
| Quick Deploy | Vercel | Zero config, instant |
| Free Tier | Netlify / Cloudflare Pages | Generous limits |
| GitHub Integration | GitHub Pages / Vercel | Seamless workflow |
| Enterprise | AWS Amplify | AWS ecosystem |
| Self-Hosted | DigitalOcean + Docker | Full control |
| Global CDN | Cloudflare Pages | Best performance |

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Environment Variables Not Working
- Check variable names start with `VITE_`
- Rebuild after adding new env vars
- Verify env vars in platform dashboard

### 404 on Refresh
- Configure SPA redirects (all platforms above include this)
- Add redirect rules to serve index.html for all routes

### CORS Errors
- Check Supabase CORS settings
- Verify edge function CORS headers
- Ensure correct Supabase URL in env vars

---

## Support

For platform-specific issues:
- Vercel: https://vercel.com/docs
- Netlify: https://docs.netlify.com
- Cloudflare: https://developers.cloudflare.com/pages
- Firebase: https://firebase.google.com/docs/hosting
