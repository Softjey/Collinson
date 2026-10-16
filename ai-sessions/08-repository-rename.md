# Session 08: repository rename

Started 2026-10-14 13:17 UTC.

## User

Hi, rename the public repo so that it describes the task neutrally, without mentioning the company

> `Bash` : `git remote -v && gh repo view --json name,visibility,url && grep -rniI "<company-name>" --exclude-dir=node_modules --exclude-dir=.git . | head -20`
> `Bash` : `gh repo rename weather-activity-ranking --yes && git remote -v`

## Claude

The repo is renamed from its previous name to **`weather-activity-ranking`**. New link: https://github.com/Softjey/weather-activity-ranking.

The local `origin` already points to the new address. GitHub redirects old links automatically. The company name does not appear in the repo files, so nothing had to be changed there.

I chose the name myself. If you want a different one, tell me.

The folder on disk is still named after the company. It can be renamed manually, and this does not affect the repo. If you rename it, the Claude Code history for this project is tied to the path, so it will stay under the old name.
