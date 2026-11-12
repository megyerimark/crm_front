# VállalkozóOS – frontend (Angular)

> Ügyfél- és munkakezelés szolgáltató vállalkozóknak. Arculat: mélyzöld (`--primary`) + borostyán kiemelés (`--accent`), Manrope címsorok, `src/styles.scss` tokenek, logó: `src/app/shared/logo.component.ts`.

Angular 20 (standalone komponensek, signals), prémium üzleti megjelenés világos és sötét témával, futás közben váltható **magyar / angol / német** felülettel. A backend a `crm_back` Laravel API (`/api/v1`).

## Indítás

```bash
npm install
npm start            # http://localhost:4200 – a dev build a http://localhost:8000/api/v1 API-t hívja
npm run build        # éles build: dist/crm_front (az API a /api/v1 relatív útvonalon, ugyanazon a domainen)
```

Demo belépés (a backend `php artisan migrate --seed` után): `demo@example.com` / `password`, Super Admin: `admin@example.com` / `password`.

## Felépítés

| Mappa | Tartalom |
|---|---|
| `src/app/core` | API-kliens, hitelesítés (Sanctum token), munkaterület-fejléc (`X-Workspace-Id`), guardok, i18n (`i18n/hu.ts`, `en.ts`, `de.ts`), téma, értesítések |
| `src/app/layout` | Oldalsáv + felső sáv (munkaterület-váltó, próbaidő-jelzés, nyelv, téma, értesítések), belépési elrendezés |
| `src/app/shared` | Ikonok, modal, lapozás, formázó pipe-ok (dátum időzónával, pénznem), oszlopdiagram |
| `src/app/features` | Áttekintés, ügyfelek, érdeklődők, értékesítési kanban, teendők + naptár, űrlapok (szerkesztő, megosztás, beágyazás), publikus űrlap (`/f/:slug`), importközpont, riportok, csapat, beállítások, Super Admin |

A jogosultságot és a csomaglimiteket mindig a backend ellenőrzi; a felület csak elrejti/zárolja a nem elérhető funkciókat (402-es válasznál „Csomagváltás” értesítést mutat).

## Nyilvános oldal és előfizetés

- `/welcome` – landing oldal (funkciók, működés, árak havi/éves váltóval, GYIK). Bejelentkezés nélkül a `/` ide irányít.
- A csomagválasztás a regisztrációig követi a felhasználót (`/register?plan=business&interval=yearly`); a 14 napos Pro próba bankkártya nélkül indul.
- Beállítások → Előfizetés: jelenlegi csomag és felhasználás, Stripe Checkout, csomag- és ciklusváltás, lemondás/visszavonás, Stripe ügyfélportál, számlázási adatok (adószám), Számlázz.hu e-számlák PDF-ben.

## Publikus űrlap beágyazása

```html
<iframe src="https://<frontend>/f/<slug>?embed=1" style="width:100%;min-height:640px;border:0" loading="lazy"></iframe>
```

UTM-paraméterek (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) a megosztott linkhez fűzve kerülnek a forráskövetésbe (Pro csomagtól).
