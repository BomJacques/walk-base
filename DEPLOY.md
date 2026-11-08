# Publishing Walk Base on GitHub Pages

The app is one built page plus a few files. `npm run package` puts them in `site/`: the app (`index.html`), a manifest, an offline cache (`sw.js`), icons, `robots.txt`, `404.html` and `.nojekyll`. It contains no book content. Pictures you load are read on the device and never uploaded; the app makes no network requests of its own.

Every path in it is relative, so it works at `https://USER.github.io/REPO/` as well as at the root of a domain. GitHub Pages cannot set headers, so the security policy (nothing may load from elsewhere) and the no-referrer rule are inside the page itself.

## One-time setup

1. Create a repository on GitHub (it can be private if your plan allows Pages for private repositories; public is simplest). Do not add a README or licence there.
2. Push this folder to it (from the folder that holds `package.json`):

   ```bash
   git remote add origin https://github.com/USER/REPO.git
   git push -u origin main
   ```

3. On GitHub open the repository, **Settings, Pages**, and under **Build and deployment** set **Source** to **GitHub Actions**.
4. The push started a run under the **Actions** tab. When it is green the site is at `https://USER.github.io/REPO/`. The first run can take a minute or two.

After that, every push to `main` tests, builds and publishes by itself. **Actions, Publish Walk Base, Run workflow** publishes again without a change.

## On the iPad

1. Open the address in Safari while online.
2. Tap Share, then Add to Home Screen. It opens full screen like an app.
3. Open it once with a connection, so the offline cache installs. After that it opens with no connection.

## Checking a deploy locally

```bash
node tests/serve-site.mjs 8098 repo-name      # serves site/ the way Pages does, under /repo-name/
node tests/deploy-check.mjs chromium <folder with playwright> http://localhost:8098/repo-name/
```

It checks the page, the policy in the page, the manifest and icons, that nothing depends on being at the root, and that the offline cache works with the network off.

## Updating

Change `src/`, commit and push. The workflow rebuilds everything. The offline cache version changes by itself, so devices pick up the new version the next time the app is opened with a connection, and use it after one more open.

If you build by hand: `npm run build` (needs `npm install` once), then `npm run package`.

## Notes

- The site asks search engines to stay away (`robots.txt` and a robots tag). Remove them in `package.mjs` and `build.mjs` if you want it found.
- GitHub Pages serves files with a ten minute cache. The offline cache is versioned, so this only delays updates a little.
- A repository can have a custom domain under Settings, Pages. Nothing in the app needs changing for it.
