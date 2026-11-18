# LwLAT social media dashboard

Shows how the trust's social media channels are doing. It covers followers (in total and for each channel), impressions, engagements and engagement rate, with daily trends, figures for each account and the top posts. The figures come from Windsor.ai. The design follows Pulse Concept C and the LwLAT Brand Guidelines 2026 (version 1.0, October 2026).

## What is in this folder

| File | What it does |
|---|---|
| `index.html` | The whole page: layout, styles and charts. |
| `assets/lwlat-logo-white.png` | The white (reversed) LwLAT logo. |
| `assets/mission-line-white.png` | *To add.* The mission line artwork, white and yellow version. Until it is added, the mission is written out as plain text. |
| `assets/lwlat-symbol-circle.png` | *To add.* The symbol in a white circle, used as the browser tab icon. |
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
- **Chart colours:** the `PLATFORM` list near the top of the script in `index.html`. Use colours from the brand palette only.

## How the brand guidelines are applied

- **Colours.** Only the core and values colours from pages 9 and 10 are used, plus white, near-black text and light tints of teal. Small text on white is in darkest teal (#00706A) or grey.
- **Script yellow** (#F2C925) is kept for the mission line artwork and is not used anywhere else.
- **Logo.** The white version sits on teal, with clear space around it, and is never shown below 120 pixels wide.
- **Mission line.** Shown from the supplied artwork once `mission-line-white.png` is added. It is never retyped in another font. Until then it appears in full, in sentence case, as plain text.
- **Values.** All four appear together at the foot of the page, in the set order, with the names and descriptors exactly as written in the guidelines, each in its own colour. Value names on pink and green are large and bold, as page 10 requires.
- **Typeface.** The Sans is listed first. Source Sans 3 stands in on computers that do not have a licensed copy of The Sans. Modish is not used.
