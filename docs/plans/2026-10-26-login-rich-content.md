# Login Screen Rich Content & Picture Management Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Allow Application Administrators to configure rich text and images in Admin Settings to appear below the login box on the public login page, with image assets persisted in PostgreSQL.

**Architecture:** A new PostgreSQL table `uploaded_images` stores binary image data, served via `GET /api/media/:id`. `POST /api/settings/images` handles authenticated admin uploads. `GET /api/public-settings` exposes public configuration (including `login_page_content`) to unauthenticated visitors. A custom React 19 WYSIWYG editor in `Settings.tsx` allows formatting and image uploads with live preview, and `Login.tsx` renders the content beneath the login card.

**Tech Stack:** React 19, TypeScript, Lucide Icons, Vite, Node.js/Express, PostgreSQL (`pg`).

---

### Task 1: Backend Database Schema & API Endpoints

**Files:**
- Modify: `server/index.js`
- Test: `server/test-media.js`

**Step 1: Write failing verification test**
Create a test script `server/test-media.js` that checks:
- `GET /api/public-settings` returns `200` with `login_page_content`.
- `POST /api/settings/images` without authentication returns `401`/`403`.
- `GET /api/media/999999` returns `404 Not Found`.

**Step 2: Run test to verify it fails**
Run: `node server/test-media.js`
Expected: FAIL (endpoints do not exist yet).

**Step 3: Implement minimal backend code**
In `server/index.js`:
1. In `initDB()`, add:
   ```sql
   CREATE TABLE IF NOT EXISTS uploaded_images (
       id SERIAL PRIMARY KEY,
       filename VARCHAR(255) NOT NULL,
       mime_type VARCHAR(100) NOT NULL,
       data BYTEA NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. Add `GET /api/public-settings`:
   ```javascript
   mainRouter.get('/api/public-settings', async (req, res) => {
       try {
           const result = await pool.query("SELECT key, value FROM settings WHERE key IN ('login_page_content')");
           const settings = {};
           result.rows.forEach(r => settings[r.key] = r.value);
           res.json(settings);
       } catch (err) {
           res.status(500).json({ error: err.message });
       }
   });
   ```
3. Add `POST /api/settings/images` (Admin only):
   Accepts `{ filename, mime_type, data }` where `data` is base64 string, validates mime types and size, converts to Buffer, inserts into `uploaded_images`, returns `{ url: '/api/media/' + id, id }`.
4. Add `GET /api/media/:id`:
   Fetches image by ID from `uploaded_images`, responds with `Content-Type`, `Cache-Control: public, max-age=86400`, and binary `data`.

**Step 4: Run test to verify it passes**
Run: `node server/test-media.js`
Expected: PASS. Remove scratch test script after verification.

**Step 5: Commit**
```bash
git add server/index.js
git commit -m "feat(server): add uploaded_images schema, media streaming, and public settings endpoint"
```

---

### Task 2: Frontend RichTextEditor Component

**Files:**
- Create: `client/src/components/RichTextEditor.tsx`
- Modify: `client/src/index.css`

**Step 1: Create RichTextEditor Component**
Build `client/src/components/RichTextEditor.tsx` with:
- `contentEditable` div managing HTML value and onChange notifications.
- Formatting toolbar: Bold, Italic, Underline, Heading selection (P, H1, H2, H3), Bullet List, Numbered List, Alignments (Left, Center, Right), Link creation.
- Image Upload: `<input type="file" accept="image/*" />` handler that converts to base64, posts to `api/settings/images`, and inserts `<img src="${res.data.url}" style="max-width: 100%; border-radius: 4px;" />` at current cursor position.
- Quick image size buttons (Small, Medium, Full Width).
- "Edit" vs "Live Preview" toggle buttons.

**Step 2: Add CSS styling for editor**
Add styles in `client/src/index.css` for `.rich-editor`, `.rich-editor-toolbar`, `.rich-editor-content`, and `.rich-editor-preview`.

**Step 3: Run client build to verify no compilation errors**
Run: `npm --prefix client run build`
Expected: Build passes.

**Step 4: Commit**
```bash
git add client/src/components/RichTextEditor.tsx client/src/index.css
git commit -m "feat(client): create RichTextEditor component with formatting and image upload"
```

---

### Task 3: Admin Settings Integration

**Files:**
- Modify: `client/src/pages/Settings.tsx`

**Step 1: Add login_page_content state and binding**
- In `Settings.tsx`, add state: `const [loginPageContent, setLoginPageContent] = useState('');`
- In `fetchSettings()`, set `setLoginPageContent(res.data.login_page_content || '');`
- In `handleSaveAdminSettings()`, include `login_page_content: loginPageContent` in settings payload.
- Under Admin Controls, render a "Login Screen Content" section with `<RichTextEditor value={loginPageContent} onChange={setLoginPageContent} />`.

**Step 2: Verify client build**
Run: `npm --prefix client run build`
Expected: Build passes.

**Step 3: Commit**
```bash
git add client/src/pages/Settings.tsx
git commit -m "feat(client): integrate RichTextEditor into admin settings"
```

---

### Task 4: Login Screen Display

**Files:**
- Modify: `client/src/pages/Login.tsx`

**Step 1: Fetch and render public login content**
- In `Login.tsx`, add state: `const [loginContent, setLoginContent] = useState<string>('');`
- In `useEffect`, fetch `api/public-settings` and set `loginContent(res.data.login_page_content || '')`.
- Below the login card, conditionally render:
  ```tsx
  {loginContent && (
    <div className="card login-rich-content" style={{ width: '100%', maxWidth: '400px', marginTop: '1.5rem' }}>
      <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
    </div>
  )}
  ```
- Sanitize `<script>` tags and unsafe inline attributes (`onload`, `onerror`).
- Add styles to ensure images inside `.login-rich-content` scale nicely (`max-width: 100%; height: auto;`).

**Step 2: Verify client build**
Run: `npm --prefix client run build`
Expected: Build passes.

**Step 3: Commit**
```bash
git add client/src/pages/Login.tsx
git commit -m "feat(client): display rich text and images below login box"
```

---

### Task 5: Verification & Project Documentation

**Files:**
- Modify: `GEMINI.md`
- Modify: `docs/plans/task.md`

**Step 1: Full verification**
- Verify client build: `npm --prefix client run build`.
- Verify git status: `git status`.
- Update `docs/plans/task.md` marking all tasks completed.
- Update `GEMINI.md` Recent Changes & Learnings with the new feature summary.

**Step 2: Commit**
```bash
git add GEMINI.md docs/plans/task.md
git commit -m "docs: update project notes and task tracker for login rich content feature"
```
