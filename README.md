# markocvjetko.github.io

Source for <https://markocvjetko.github.io>.

Plain HTML + CSS. No build step, no dependencies. GitHub Pages serves `main` directly.

## Files

- `index.html` — content (bio, news, publications)
- `style.css` — styling (light + dark via `prefers-color-scheme`)
- `cv.pdf` — drop your CV here to make the `cv` link work

## How to update

**Add a news item:** add an `<li>` at the top of the `<ul class="news">` block in `index.html`.

**Add a publication:** add an `<li>` to the relevant `<ul class="pubs">` block.

**Edit the bio:** change the text inside `<section id="bio">`.

Push to `main` — Pages redeploys in ~1 min.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
