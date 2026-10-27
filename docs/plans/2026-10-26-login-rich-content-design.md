# Design Document: Login Screen Rich Content & Picture Management

## 1. Overview
This feature allows an Application Administrator to configure rich text and images in the Admin Settings page to be displayed below the login box on the public login page. The content supports text styling, headings, bulleted/numbered lists, links, alignments, and image uploads. Uploaded images are stored in the PostgreSQL database to persist across Kubernetes pod restarts and rollouts without requiring local filesystem persistent volume claims on the app container.

## 2. Architecture & Data Model

### Database Changes
1. **`uploaded_images` table**:
   ```sql
   CREATE TABLE IF NOT EXISTS uploaded_images (
       id SERIAL PRIMARY KEY,
       filename VARCHAR(255) NOT NULL,
       mime_type VARCHAR(100) NOT NULL,
       data BYTEA NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. **`settings` table**:
   - Uses key `'login_page_content'` with value storing the generated HTML string.

### Backend Endpoints (`server/index.js`)
1. **`GET /api/public-settings`**:
   - Public endpoint (no authentication token required).
   - Returns `{ login_page_content: string }` from the settings table.
2. **`POST /api/settings/images`**:
   - Authenticated, restricted to `Application Administrator`.
   - Accepts image uploads (base64 JSON payload or multipart data).
   - Validates MIME type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`) and enforces 5MB size limit.
   - Inserts into `uploaded_images` and returns `{ url: '/api/media/:id', id: number }`.
3. **`GET /api/media/:id`**:
   - Public endpoint.
   - Fetches image record from `uploaded_images`.
   - Sends image binary data with appropriate `Content-Type` header and cache control headers.

## 3. UI Components

### 1. `RichTextEditor.tsx` (`client/src/components/RichTextEditor.tsx`)
- WYSIWYG editor built using React 19 and standard `contentEditable`.
- Toolbar equipped with `lucide-react` icons:
  - Formatting: Bold, Italic, Underline.
  - Headings: Paragraph, H1, H2, H3.
  - Lists: Bullet list, Numbered list.
  - Alignment: Left, Center, Right.
  - Hyperlinks: Insert/edit link modal or prompt.
  - Image tools: "Upload Image" button uploading to `/api/settings/images` and inserting `<img>` tag at cursor position.
  - Image controls: Size options (Small, Medium, Full Width).
  - Undo / Redo controls.
- "Edit" vs "Live Preview" tabs for real-time verification before saving.

### 2. `Settings.tsx` (`client/src/pages/Settings.tsx`)
- Add "Login Screen Content" card in the Admin Controls section.
- Integrates `RichTextEditor` bound to `login_page_content`.
- Saves automatically with the "Save Admin Settings" action.

### 3. `Login.tsx` (`client/src/pages/Login.tsx`)
- On mount, calls `GET /api/public-settings`.
- If `login_page_content` exists and is non-empty, renders it in a centered card/container below the login box (`maxWidth: 400px` or responsive expand up to 480px).
- Applies clean styling (responsive image max-width, formatted typography, margin spacing).
- Sanitizes script tags and unsafe inline event handlers before rendering.

## 4. Error Handling & Edge Cases
- Image upload failures display error messages to the administrator in the editor.
- Missing images or 404s fail gracefully without breaking the login page layout.
- If no login content is configured, no empty card or container is rendered on `/login`.
