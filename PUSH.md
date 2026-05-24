# GitHub Push — Lépésről lépésre

## 1. Repo létrehozása GitHub-on

Menj ide: **https://github.com/new**

- **Repository name:** `trendwatcher`
- **Description:** `Breakout watchlist dashboard — mid-cap AI / energy / defense / crypto picks`
- **Visibility:** ✅ Public
- **Initialize this repository with:** ❌ NE pipálj be semmit (README, .gitignore, license — egyik se kell)
- Kattints **Create repository**

## 2. Push a parancssorból

Nyiss meg egy PowerShell-t vagy Terminal-t és futtasd ezeket (Windows):

```powershell
cd "C:\Users\rober\AppData\Roaming\Claude\local-agent-mode-sessions\43a14fa8-1481-46b0-865a-65217e4eb588\ae97e7aa-6fc4-48f2-9839-b8cdabacb80c\local_d07ead02-a077-4a45-93d0-c5fbbcee07b4\outputs\trendwatcher"

# Töröld a részben létrehozott .git mappát (a sandbox csinálta, sérült)
Remove-Item -Recurse -Force .git

# Friss git repo
git init -b main
git config user.email "robert.selesh@gmail.com"
git config user.name "robertselesh"
git add .
git commit -m "feat: initial trendwatcher dashboard"

# Hozzákötjük a GitHub repodhoz
git remote add origin https://github.com/robertselesh/trendwatcher.git
git push -u origin main
```

Ha auth-ot kér: használd a **Personal Access Token-t** jelszó helyett.
PAT generálás: https://github.com/settings/tokens/new (scope: `repo` — pipáld be)

## 3. Netlify auto-deploy bekötése (egyszer kell)

1. Menj a Netlify dashboard-ra: https://app.netlify.com
2. Ha még a régi `trendwatcher` site van Drop-pal feltöltve:
   - **Site settings → Build & deploy → Continuous deployment → Link site to Git**
   - VAGY: csinálj egy újat: **Add new site → Import an existing project → Deploy with GitHub**
3. Authorizáld a Netlify-t GitHub OAuth-tal
4. Válaszd a `robertselesh/trendwatcher` repo-t
5. Build settings (a `netlify.toml` már beállítja):
   - Build command: *(üres)*
   - Publish directory: `.`
6. **Deploy site**

Ettől kezdve minden `git push` után **automatikusan** újratelepül a `trendwatcher.netlify.app` ~15 másodperc alatt.

## 4. Mostantól a workflow

```powershell
# Cowork-ben: módosítod a watchlist-et Claude segítségével
# Commit-olod:
cd "C:\...\outputs\trendwatcher"
git add .
git commit -m "refresh: prices + new picks YYYY-MM-DD"
git push

# Netlify automatikusan deploy-olja → friss az URL
```

## Tipp — gyorsabb workflow `gh` CLI-vel

Ha telepítve van a GitHub CLI (`gh`):
```powershell
gh auth login
gh repo create trendwatcher --public --source=. --push --description "Breakout watchlist dashboard"
```
Ez egy parancsban csinálja a repo létrehozást + push-t.
