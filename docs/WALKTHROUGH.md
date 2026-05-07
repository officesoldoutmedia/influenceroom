# Influence Room — Ghid de utilizare

**Aplicația live:** [https://influenceroom.office-2e5.workers.dev](https://influenceroom.office-2e5.workers.dev)

---

## Bun venit la Influence Room

Influence Room e tool-ul intern al agenției pentru gestionarea brand-urilor, influencerilor, campaniilor și task-urilor de zi cu zi. Înlocuiește spreadsheet-urile și e-mail-urile dezordonate cu un singur loc unde toată echipa vede aceleași date și aceleași deadline-uri.

---

## Cum te loghezi

1. Deschide linkul aplicației.
2. Vezi cardurile cu toți colegii activi. **Click pe cardul tău.**
3. Apare un modal cu 4 căsuțe — introdu PIN-ul tău (4 cifre).
4. La 4 cifre corecte, ești redirecționat la dashboard.

**Atenție:** dacă greșești PIN-ul de **5 ori** la rând, contul tău se blochează automat pentru **5 minute** ca măsură de securitate. Nu intra în panică — așteaptă 5 minute și reîncearcă, sau cere owner-ul să-ți reseteze PIN-ul.

---

## Roluri și permisiuni

| Rol | Vezi | Editezi | Reset PIN-uri | Setări notificări |
|-----|------|---------|---------------|-------------------|
| **Owner** | tot | tot | da | da |
| **Manager** | tot | brands, influenceri, campanii, task-uri | nu | nu |
| **Account** | tot | brands (read), influenceri, propriile campanii, propriile task-uri | nu | nu |
| **Intern** | tot (read-only) | doar status pe task-urile asignate lui | nu | nu |

Owner-ul (Stefan) e singurul care poate adăuga utilizatori noi sau le poate reseta PIN-urile. Dacă vrei un rol nou pe cineva sau ai uitat PIN-ul, contactează-l direct.

---

## Adăugarea unui brand client

În **Brands** din meniu de sus → click pe **+ Add brand** (dreapta sus). Modal cu câmpuri:

- **Name** (obligatoriu) — numele brand-ului
- **Contact person** + **email** + **phone** — persoana de la brand cu care vorbim
- **Logo URL** — opțional, link la o imagine (de ex. de pe site-ul lor)
- **Detalii facturare** — text liber: entitate, CUI, IBAN, adresă
- **Notes** — orice info utilă

Click **Create**. Apare în tabel. Pentru a-l dezactiva (păstrează istoric, nu apare în campanii noi): click **Deactivate** pe rând. Click **Edit** ca să modifici câmpuri.

---

## Adăugarea unui influencer

În **Influencers** → **+ Add**. Formularul are mai multe secțiuni:

**Basic** — nume, primary handle (de ex. `@anainsta`), tier (nano/micro/mid/macro/mega — clasificare după nr. follower-i), limbă, oraș, țară.

**Niche tags** — tag-uri ca `fashion`, `beauty`, `tech`. Click pe pillele predefinite ca să le adaugi, sau scrii unul nou și apeși Enter.

**Platforms** — câte un mini-form per platformă (Instagram, TikTok, YouTube, Twitch). Pentru fiecare unde influencer-ul are cont, completezi: handle, follower count, engagement rate (zecimal 0-1, ex. `0.045` = 4.5%). Lasă goale platformele pe care nu e prezent.

**Rates (RON)** — câte un câmp pentru rate post / story / reel / video. Lasă gol dacă nu știi încă.

**Contact** — email, telefon, agent name + email (dacă e cazul).

**Fiscal** — tip entitate (PFA / SRL / persoană fizică), CUI, IBAN, adresă. Necesare pentru facturare.

**Status & notes** — `active` default, `exclusive` checkbox dacă e talent exclusiv al agenției.

Tier definitions (ghid orientativ — nu sunt validări strict):
- **nano** — sub 10K followers
- **micro** — 10K-100K
- **mid** — 100K-500K
- **macro** — 500K-1M
- **mega** — peste 1M

După Create, intri pe profilul lui din **Influencers → click pe nume**. De acolo vezi totul + buton **Edit** pentru modificări.

---

## Crearea unei campanii din template

În **Campaigns** → **+ New campaign**. Modal:

1. **Brand** (dropdown din brands active) — obligatoriu
2. **Template** — alegi unul din cele 3 starter templates predefinite:
   - **Brand Collab Standard (IG)** — 28 zile, 5 grupuri, 19 task-uri
   - **TikTok Challenge** — 14 zile, mai rapid
   - **YouTube Long-form Sponsorship** — 56 zile, ciclu complet
   
   Sau "No template — blank" dacă vrei să adaugi task-uri manual.
3. **Name** — numele intern al campaniei (ex. "Q4 Brand Boost ACME")
4. **Start date (publish / T+0)** — **DATA LA CARE GO LIVE CONȚINUTUL**. Asta e ancora — toate deadline-urile task-urilor se calculează relativ la ea (T-21 = 21 zile ÎNAINTE de publish, T+7 = 7 zile DUPĂ).
5. **End date** — se completează automat din template, dar poți modifica
6. Total budget, deliverables count, brief, owner (default tu), internal notes.

Click **Create**. Te trimite la pagina campaniei. Vezi toate cele 5 grupuri cu task-urile auto-generate, fiecare cu deadline calculat din `start_date + offset`.

---

## Lucrul cu task board-ul

Pe pagina campaniei vezi grupurile (collapsabile prin click pe header) și task-urile lor.

**Editare instant pe rând:**
- **Status dropdown** — schimbi `todo → in_progress → done` etc. — se salvează imediat
- **Priority dropdown** — `low | normal | high | urgent`
- **Assignee dropdown** — membrii echipei sau "Unassigned"
- **Due date** — date picker, salvează la blur

**Drag-and-drop:**
- Trag-i de mânerul `⋮⋮` din stânga task-ului ca să-l reordonezi în cadrul aceluiași grup
- Trag-i de mânerul `⋮⋮` de la header-ul grupului ca să mutezi tot grupul în sus/jos
- Pentru a muta un task între grupuri: click pe **3-dots → Edit → Group dropdown** (drag-and-drop cross-group nu e suportat încă)

**3-dots menu pe fiecare rând:** Edit (modal complet) sau Delete (cu confirmare).

**+ Add task** — buton la sfârșitul fiecărui grup. Tastezi titlu → Enter → apare cu status=todo, priority=normal.

**+ Add group** — la sfârșit de tot. Modal cu nume + due_date.

**Mark a task as done** → status=done → automat se salvează `completed_at` cu timestamp-ul curent.

---

## Roster influenceri per campanie

Pe pagina campaniei → buton **Open roster →** (în secțiunea Influencers).

Roster-ul e lista influencerilor care lucrează pe campania asta. Fiecare are propriul status în workflow:

```
pitched → negotiating → confirmed → content_in_review → published → paid
```

`cancelled` e disponibil din orice stare (dacă pică deal-ul).

**Cum adaugi un influencer pe campanie:**
1. **+ Add influencer** (dreapta sus)
2. Caută după nume — apar doar influencerii activi care nu sunt deja pe campania asta
3. Click pe rezultat → completezi: agreed_fee (RON), deliverables (text liber, ex. "1 IG Reel + 3 Stories"), status inițial (default `pitched`), notes
4. Add

**Cum schimbi statusul:** dropdown-ul "→ status" pe rând arată doar tranzițiile valide din workflow. La click pe `published` cere obligatoriu `publish_date` + `post_url` — fără ele, primești eroare. Edit-ează rândul ca să le completezi întâi.

**Performance metrics** — în Edit modal poți adăuga views, likes, saves, reach, comments, shares (după ce postarea a fost live). Apar în coloana "Performance" din tabel ca scurtă "12.5K views".

**Remove from campaign** — buton roșu pe rând. Hard delete (nu lasă urmă în roster). Dacă te răzgândești poți readăuga același influencer.

---

## My Tasks

În meniu sus: **My Tasks**. Vezi doar task-urile asignate ție, grupate pe deadline-uri:

- **Overdue** (roșu) — deadline-ul a trecut și încă nu e done
- **Today** — au deadline azi
- **This week** — în următoarele 7 zile
- **Later** — restul (sau fără deadline)

Schimbi status direct din lista — la `done`, dispar din listă. Click pe numele campaniei → te duci pe pagina ei.

**Owner+Manager only:** buton **Show all tasks** sus → comuți la vizualizarea tuturor task-urilor active din toate campaniile (utilă pentru supraveghere).

---

## Settings (doar Owner)

Owner-ul are 3 secțiuni admin în meniu:

- **Templates** — vezi cele 3 starter templates (Brand Collab IG, TikTok, YouTube). Read-only deocamdată — duplicate/edit vor veni într-un sprint viitor.
- **Notifications** — listă de reguli email (5 evenimente: task assigned, task status changed, deadline reminder, daily digest, campaign started). Toggle on/off per regulă, edit JSON config (ex. cine primește, ore-deadline). În tabelul "Recent" vezi toate emailurile trimise + status (queued/sent/failed). Buton "Send test" trimite o mostră ție însuți. Buton "Run worker now" forțează procesarea queue-ului (folosește când vrei să trimiți imediat fără să aștepți cron-ul automat).
- **Team** — manage utilizatori. Add member (nume + email + rol + PIN inițial), Edit, Reset PIN, Activate/Deactivate. Nu te poți dezactiva pe tine însuți.

---

## Întrebări frecvente

**Am uitat PIN-ul. Ce fac?**
Cere owner-ul (Stefan) să-l reseteze din `/admin/team` → click 3-dots pe rândul tău → Reset PIN → setează unul nou și ți-l comunică.

**Cum șterg un task?**
Click 3-dots pe task → Delete. Confirmă în pop-up. Dispare din DB (nu se recuperează).

**Cum opresc emailurile pentru un anumit eveniment?**
Doar owner-ul poate. `/admin/notifications` → toggle off pe regula respectivă. Reguli oprite nu mai produc emailuri noi.

**Pot recupera un task șters?**
Nu. Hard delete. Dacă era important, recreează-l manual.

**App-ul e mobile-friendly?**
Funcționează pe mobil pentru consultare rapidă, dar tabelele sunt optimizate pentru desktop. Pentru editări complexe (campanii, formulare lungi de influencer), folosește desktop sau tabletă.

**Schimbarea status-ului unui task `in_progress → done` de ce nu trimite email celorlalți?**
Default-ul `task_status_changed` e configurat să trimită doar către `owner` și `manager`, nu către toți. Plus: tu (cel care faci modificarea) nu primești notificare pentru propriile acțiuni. Modifici comportamentul din `/admin/notifications`.

**Cum exportez datele într-un Excel?**
Momentan, nu. Phase 2 backlog. Workaround: copy-paste manual din tabel.

**Cron-ul automat trimite zilnic daily-digest?**
Nu încă. Cron-ul automat (Cloudflare Workers Triggers) cere upgrade la planul Workers Paid ($5/lună). Până atunci, folosești "Run worker now" din `/admin/notifications` ca să flush-uiești manual queue-ul când vrei.

---

## Contact pentru bug-uri

Trimite-mi un mesaj direct pe Slack (Stefan Sprianu) sau pe email la `office@soldoutmedia.ro`. Include:
- Ce încercai să faci
- Ce s-a întâmplat (mesaj de eroare exact, dacă e)
- URL-ul paginii
- Screenshot dacă ajută

Mulțumesc 🙏
