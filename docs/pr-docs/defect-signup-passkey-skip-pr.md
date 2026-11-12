# Signup passkey skip: commit and pull request notes

## Suggested commit message

```text
Prevent signup without a usable sign-in method

Delay volunteer account creation until a password or verified passkey
is available. Replace passkey-only skipping with a return-to-signup
password fallback, and preserve password-based skip behavior.

Add signup endpoint regression tests and correct passkey credential
ID handling for authentication.
```

## Suggested pull request title

Prevent credential-less accounts during volunteer signup

## Problem and previous behavior

1. A volunteer could select **Sign up with Passkey only (no password)** and continue.
2. The signup endpoint immediately created the user with no password and issued a session, before passkey registration.
3. The next screen offered **Create Passkey** and **Skip for Now** regardless of whether a password was supplied.
4. If registration failed, was cancelled, or was never attempted, **Skip for Now** still took the user to the map. Leaving the flow with the browser Back button could also leave the account behind.
5. That user had neither a password nor a registered passkey and could be locked out after logging out. Retrying signup with the same email failed because the account already existed.

## Resolution and updated flows

No user is inserted, and no signup session is issued, until the server has a valid password, a verified passkey, or both. The initial form submission only advances the UI; it does not create an account.

### Password signup

1. Enter a name, email, and matching password of at least eight characters; select **Sign Up**.
2. The passkey setup screen appears. Creating a passkey adds it to the new account when registration succeeds.
3. Alternatively, select **Skip for Now**, including after a cancelled or failed passkey attempt. The account is created with the password and the user is signed in.

### Passkey-only signup

1. Enter a name and email, select **Sign up with Passkey only (no password)**, and continue.
2. The passkey setup screen offers **Create Passkey** and **Return to Sign Up**, not **Skip for Now**.
3. If passkey creation fails or is cancelled, the user can retry. No account is created and the user cannot proceed to the map through this flow.
4. **Return to Sign Up** retains the name and email, clears and disables the passkey-only selection for the current signup, and displays the password fields. Submitting a valid password then skips the passkey screen and creates a password-based account. A passkey can be added later in Settings.
5. If passkey creation and verification succeed, the user and credential are inserted together and the user is signed in.

If account creation succeeds but the subsequent automatic authentication check fails, the UI reports that the account was created and offers a login link rather than submitting the signup again.

### Server-side enforcement

- `POST /api/signup/passkey-options` checks the email and returns WebAuthn registration options plus a signed signup token bound to the normalized email and challenge. The token expires after 10 minutes; requesting options does not create a user.
- `POST /api/signup` validates the password, if supplied. For a passkey, it checks the signup token and verifies the WebAuthn registration against the expected challenge, origin, and relying-party ID. It rejects a request without a password or verified passkey, including direct requests that bypass the UI.
- Passkey signup requests a discoverable credential with user verification, matching the login screen's discoverable-passkey flow. The user row and its credential are saved in the same insert.
- Existing passkey authentication now passes credential IDs as base64url strings, as expected by the installed WebAuthn library.

## Files in this change

| File | Status | Purpose |
| --- | --- | --- |
| [`server/signup-routes.js`](../server/signup-routes.js) | New; **required at runtime** | Defines the signup options and completion routes. `server/index.js` imports and mounts this module; omitting it prevents the server from starting. |
| [`server/test/signup-routes.test.js`](../server/test/signup-routes.test.js) | New; **keep as regression coverage** | Exercises the signup routes with a fake database and injected WebAuthn responses. It is not required for the running application, but should be committed to preserve the tests. |
| [`server/index.js`](../server/index.js) | Modified | Mounts the signup router and corrects passkey credential ID handling during authentication. |
| [`client/src/pages/Signup.tsx`](../client/src/pages/Signup.tsx) | Modified | Delays submission, provides the correct skip or return action, retains form data, and handles authentication errors after account creation. |
| [`client/src/context/AuthContext.tsx`](../client/src/context/AuthContext.tsx) | Modified | Returns the result of the authentication check so signup can report automatic sign-in failure. |
| [`README.md`](../README.md) | Modified | Summarizes the signup requirement and links to these notes. |
| [`docs/defect-signup-passkey-skip-pr.md`](./defect-signup-passkey-skip-pr.md) | New | Documents the defect, implementation, and retesting steps for the commit and PR. |

## Automated retesting

From the repository root, with the project dependencies already installed and Node.js 24 or newer:

```sh
node --test server/test/signup-helper.test.js server/test/signup-routes.test.js
```

The route tests cover credential-less rejection; forged, expired, wrong-email, and unverified passkey rejection; passkey-only signup; password-only signup; combined signup; session issuance; and duplicate signup. They use an in-memory fake database and stub WebAuthn verification: they do **not** test PostgreSQL, a real authenticator, or the real WebAuthn verification implementation end to end.

To run all existing server tests and build the client:

```sh
node --test server/test/*.test.js
npm run build --prefix client
```

During implementation, all 18 server tests passed and the client build succeeded. The build reported existing CSS minification and large-bundle warnings.

## Manual retesting

Use an isolated test deployment and disposable, unique email addresses. Successful cases create real user accounts; do not run them against a shared production database. For passkey cases, use a supported browser and authenticator with a secure WebAuthn origin, and configure the server's `RP_ID` and `ORIGIN` to match that origin.

1. **Passkey-only failure and return:** Start a passkey-only signup, cancel or reject the authenticator prompt, and confirm the screen reports failure, offers retry and **Return to Sign Up**, and has no **Skip for Now**. Confirm no account was created. Return to the form; verify name and email remain, passkey-only is unchecked and disabled, and password inputs appear. Enter a valid password and submit; confirm the passkey screen is skipped, the map opens, and password login works after logout.
2. **Password signup and skip:** Enter a valid password and submit. Confirm the passkey screen appears and no account exists yet. Cancel or fail passkey setup, choose **Skip for Now**, and confirm the account can log in with the password after logout.
3. **Passkey-only success:** Complete signup using a discoverable, user-verified passkey. Confirm the account reaches the map, the passkey appears in Settings, and passkey login succeeds after logout.
4. **Password and passkey:** Supply a password and successfully create a passkey. After logout, confirm both sign-in methods work.
5. **Leave before completing:** Start a passkey-only signup, leave the page before registering, and retry with the same email. Confirm no account was created by the abandoned attempt.
6. **Server guard:** Submit signup without a password or passkey and confirm it is rejected without creating a user or issuing a session. Also confirm duplicate email and invalid or expired passkey challenges are rejected.

The implementation was also checked in a browser using a virtual authenticator and a temporary test server with an in-memory database; this verified passkey signup and a subsequent passkey login using real WebAuthn verification. The temporary server is not part of the project and that check does not replace testing against the deployed application and PostgreSQL.
