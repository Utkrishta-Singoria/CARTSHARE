# CartShare

A collaborative shopping cart for dorms, office teams and travel groups. Create a room, share the code, and everyone adds items to one cart that updates live. Watch the free-delivery goal fill up, see who added what, and print a clean receipt for the group.

Built with plain HTML, CSS and JavaScript plus Bootstrap 5 (loaded from a CDN). No build step and no backend.

## Run it locally

You need nothing installed except a browser.

1. Download or clone this repository.
2. Open `index.html` in your browser (double-click it), **or** serve the folder for a more realistic test:
   ```bash
   # Python
   python3 -m http.server 8000
   # then visit http://localhost:8000
   ```
3. Internet access is needed the first time so the Bootstrap and Google Fonts files can load.

### Try the multi-user features

Rooms are stored in your browser, so you simulate several people with several tabs.

1. In tab 1, choose **Create a room**, enter a name (for example *Asha*) and create it. Note the 6-character room code.
2. Open `index.html` in tab 2 (same browser, same site address). Choose **Join with a code**, enter a different name (for example *Ravi*) and the code. You can also use **Copy invite link** in tab 1 and paste that link in tab 2.
3. Put the two tabs side by side. Add or remove items in one tab and watch the other update instantly, along with the activity log and the delivery meter.
4. Click **Receipt** to open the printable receipt, then **Print receipt**.

## Features

| Brief requirement | How it works |
| --- | --- |
| Create or join a room with a code | Two forms on the home page. Rooms get a random 6-character code; names are checked, codes are validated, and unknown codes show an error. |
| Shared cart that updates for everyone | Add items (name, price, quantity), change quantity with +/-, remove items. Changes are saved to `localStorage` and pushed to other tabs with the `storage` event. |
| Real-time activity log | Every join, add, quantity change, removal, goal change and leave is logged with the person and time. |
| Free-delivery threshold | A meter at the top shows how far the cart is from the goal, split into colored segments by person. The goal can be changed by anyone in the room. |
| Fair expense split | The "Who owes what" panel totals each person's items. |
| Printable, audit-ready receipt | `receipt.html` lists every item with who added it, totals, goal status, the split by person and the full audit trail. Print rules in `css/print.css` hide the page chrome and format it for A4. A "Copy as text" button is included too. |
| Responsive design | Bootstrap grid plus Flexbox/CSS Grid. The layout stacks on phones. |
| Presence | Avatars show who currently has the room open (green dot). |

## Project structure

```
cartshare/
  index.html        Home page: create or join a room
  room.html         The shared room: meter, cart, split, activity
  receipt.html      Printable receipt
  css/
    styles.css      Screen styles and design tokens
    print.css       Print-only rules for the receipt
  js/
    storage.js      Data layer: rooms, session, presence, money helpers
    index.js        Home page forms and validation
    room.js         Room rendering, cart actions, live sync
    receipt.js      Receipt generation, print, copy as text
  assets/
    logo.svg
    favicon.svg
  README.md
```

## How it works

- **Rooms** live in `localStorage` under the key `cartshare:rooms:v1`. Prices are stored as whole minor units (cents) to avoid floating-point errors.
- **Who you are** is kept per tab in `sessionStorage`. That is why two tabs can act as two different people.
- **Sync**: when one tab writes to `localStorage`, the browser fires a `storage` event in the other tabs, and `room.js` re-renders.
- **Presence** uses a small heartbeat written every 10 seconds; someone counts as online if their last beat is under 25 seconds old.
- User-entered text is escaped before it is put on the page.

## Limits to know about

- `localStorage` is shared only within one browser on one device and one site address. Tabs in the same browser stay in sync; two different phones or browsers will **not** see each other's rooms. That is a limit of the no-backend approach in the brief. Moving to real multi-device sync would mean adding a backend such as Firebase or Supabase.
- Anyone who knows a room code and uses an existing member's name joins as that member (there are no passwords).
- Any member can remove any item; the activity log records who did it.

## Deploy

Any static host works because the project is only static files.

- **GitHub Pages**: push to GitHub, then Settings > Pages > deploy from the `main` branch root.
- **Netlify**: drag the project folder onto the Netlify dashboard, or connect the repo.
- **Vercel**: import the repo; framework preset "Other", no build command.

To test the live site, open the deployed URL in two tabs of the same browser.

## Submission checklist

- [ ] Repository pushed to GitHub with this README
- [ ] Live URL tested in two tabs
- [ ] Folder structure uses `css/`, `js/` and `assets/`
- [ ] Portal entry named `BatchID_FullName_CartShare`
