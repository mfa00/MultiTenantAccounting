# Environment Variables Setup

## ✅ **Automatic .env Loading**

**Yes!** Your `.env` file is now **automatically loaded** when you run any npm script.

## 🔧 **How it works:**

All npm scripts are configured to load the `.env` file automatically using `tsx --env-file=.env`:

```json
{
  "scripts": {
    "dev": "tsx --env-file=.env server/index.ts",
    "db:migrate": "tsx --env-file=.env scripts/migrate.ts",
    "db:test": "tsx --env-file=.env scripts/test-db-connection.ts",
    // ... etc
  }
}
```

## 📋 **What this means:**

✅ **`npm run dev`** → Automatically loads `.env`  
✅ **`npm run db:test`** → Automatically loads `.env`  
✅ **`npm run db:migrate`** → Automatically loads `.env`  
✅ **All other scripts** → Automatically load `.env`

## 🎯 **Your current `.env` file:**

```env
# Database Configuration
DATABASE_URL=postgresql://your_user:your_password@your_host:5432/multitenant_accounting

NODE_ENV=development
PORT=3000
SESSION_SECRET=change-this-to-a-random-secret-key
```

## 🚀 **Next Steps:**

1. **Set up your database** (Neon.tech recommended)
2. **Update DATABASE_URL** in `.env` with real connection string
3. **Run `npm run db:test`** to verify connection
4. **Run `npm run dev`** to start your app

## 🔒 **Security Note:**

The `.env` file is already added to `.gitignore`, so your secrets won't be committed to version control. 