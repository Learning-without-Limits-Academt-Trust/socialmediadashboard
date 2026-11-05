# LwLAT social media dashboard

Shows how the trust's social media channels are doing. It covers followers, impressions, engagements and engagement rate, with daily trends, figures for each account and the top posts. The figures come from Windsor.ai. The design follows Pulse Concept C and the LwLAT Brand Guidelines v1.0.

## What is in this folder

| File | What it does |
|---|---|
| `index.html` | The whole page: layout, styles and charts. |
| `assets/lwlat-logo-white.png` | The white (reversed) LwLAT logo. |
| `netlify/functions/social.mjs` | A small server-side script. It holds the Windsor.ai connection, so the API key never reaches the browser. |
| `netlify.toml` | Tells Netlify where things are. No build step is needed. |

If you open `index.html` straight from your computer, it shows **sample figures** marked "SAMPLE". Live figures appear only once it runs on Netlify with the key set. You can force sample mode at any time by adding `?demo` to the address.

## Set-up, step by step

1. **Create the GitHub repository** and upload these files, keeping the folder structure as it is.
2. **On Netlify**, choose *Add new site > Import an existing project*, pick the repository and deploy. Leave the build settings blank.
3. **Add the API key.** In Netlify go to *Site configuration > Environment variables > Add a variable*.
   - Key: `WINDSOR_API_KEY`
   - Value: your Windsor.ai API key
   - Then *Deploys > Trigger deploy* so the function picks it up.
4. **Check each platform.** Visit `https://YOUR-SITE.netlify.app/api/social?check=facebook` (then `instagram` and `linkedin`). The reply lists the columns Windsor.ai returned and any field that came back empty.
5. **Correct field names if needed.** Edit the `PLATFORMS` block at the top of `netlify/functions/social.mjs` on GitHub. Netlify redeploys on its own when you save. The quickest way to get the exact names is from Windsor.ai itself: build the query for each connector in your Windsor.ai account and copy the field names from the API URL it gives you.
6. **Switch on TikTok or YouTube** later by changing `enabled: false` to `enabled: true` in the same block.

## Keeping the key safe

- Never paste the key into `index.html`, the README or any file in GitHub. Anyone who can see the repository could use it.
- Figures are cached for 30 minutes, which keeps Windsor.ai usage low.

## Things you can change easily

- **Friendly account names:** the `ACCOUNT_NAMES` list in `social.mjs`.
- **Chart colours:** the `PLATFORM` list near the top of the script in `index.html`.
