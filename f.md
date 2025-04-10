# Vercel Deployment Troubleshooting Log: `[handle]/route.ts` Type Error

## Initial Error State (Commit: fab2826)

**Timestamp:** Approx. 12:38 UTC (from Vercel log)
**Environment:** Vercel Deployment
**Node.js Version:** 20.x (Changed from 22.x)

**Error Message:**

```
src/app/api/users/[handle]/route.ts
Type error: Route "src/app/api/users/[handle]/route.ts" has an invalid "GET" export:
  Type "Context" is not a valid type for the function's second argument.
```

**Relevant Build Warnings:**

- `npm warn ERESOLVE overriding peer dependency` for `react` (found 18.3.1, needed by `react-dom@18.3.1`, but project uses react@^19.0.0).
- `npm warn ERESOLVE overriding peer dependency` for `react` (found 19.1.0, needed `^16.8.0 || ^17.0.0 || ^18.0.0` by `use-sync-external-store@1.2.0` via `valtio`).
- `Module not found: Can't resolve 'pino-pretty'` (dependency of `pino`, used by `@walletconnect`).
- `@next/next/no-img-element` lint warning in `src/app/profile/page.tsx`.

## Steps Taken So Far

1.  Changed Node.js version in Vercel Project Settings from 22.x to 20.x.
2.  Triggered redeployment.

## Troubleshooting Iterations

### Iteration 1: Fix Route Handler Signature

**Hypothesis:** The primary error is the incorrect type signature for the `GET` handler in the API route, as explicitly stated by the build error. Peer dependency warnings might be secondary.

**Applied Change:** Updated the signature of the `GET` function in `src/app/api/users/[handle]/route.ts` to match the Next.js App Router convention and removed the unused `Context` type.

```diff
- type Context = {
-  params: {
-    handle: string;
-  };
- };
-
- export async function GET(req: NextRequest, context: Context) {
-  const handle = context?.params?.handle;
+ export async function GET(
+   req: NextRequest,
+   { params }: { params: { handle: string } }
+ ) {
+   const handle = params.handle;
```

**Result:**

- Code change applied to `src/app/api/users/[handle]/route.ts`.
- Local checklist run:
  - Log cleared.
  - `curl` successful (returned 404, expected for test user).
  - `server.log` remained empty (no server errors).
  - **`npm run build` FAILED** locally with the _same_ type error:
    ```
    Type error: Route "src/app/api/users/[handle]/route.ts" has an invalid "GET" export:
      Type "{ params: { handle: string; }; }" is not a valid type for the function's second argument.
    ```
- File contents verified; the correct signature _is_ present.

**Conclusion for Iteration 1:** Fixing the signature alone did not resolve the build error. The root cause might be caching, dependency conflicts, or a more subtle issue.

### Iteration 2: Clean Install & Re-check

**Hypothesis:** Stale caches or dependency conflicts (specifically the React version mismatch) might be causing the build system to incorrectly report the type error despite the code being visually correct.

**Steps Taken:**

1. Cleaned the project: `rm -rf node_modules .next`
2. Reinstalled dependencies: `npm install`

**Result:**

- Dependencies reinstalled (React peer dependency warnings persisted).
- Local checklist run (against original dev server):
  - Log cleared.
  - `curl` failed (returned 500 Internal Server Error).
  - `server.log` remained empty.
  - **`npm run build` FAILED** locally with the _same_ type error as Iteration 1.

**Conclusion for Iteration 2:** Cleaning caches and reinstalling did not resolve the build error or the new local 500 error. The React peer dependency conflicts remain the most likely suspect.

### Iteration 3: Downgrade React & Re-check

**Hypothesis:** The conflict between the project's requested React 19 and dependencies requiring React 18 is causing the build failure and potentially the local 500 error.

**Steps Taken:**

1.  Downgraded React/React-DOM to `^18.3.1` in `package.json`.
2.  Downgraded `@types/react`/`@types/react-dom` to `^18`.
3.  Clean Install: `rm -rf node_modules .next && npm install` (Still showed type warnings).
4.  Restarted Dev Server.
5.  Local checklist run:
    - Log cleared.
    - `curl` failed (returned 500 Internal Server Error, citing missing `pino-pretty/index.js`).
    - Verified `node_modules/pino-pretty/index.js` _does_ exist.
    - `server.log` remained empty.
6.  Added `pino-pretty` to `devDependencies`, ran `npm install`, restarted dev server.
7.  Local checklist re-run:
    - Log cleared.
    - `curl` failed again (returned 500 Internal Server Error, _still_ citing missing `pino-pretty/index.js`).
    - `server.log` remained empty.
8.  Ran `npm run build`.

**Result:**

- Local dev server consistently returns 500 error related to `pino-pretty` after React downgrade.
- **`npm run build` STILL FAILED** locally with the _same_ type error as Iterations 1 & 2:
  ```
  Type error: Route "src/app/api/users/[handle]/route.ts" has an invalid "GET" export:
    Type "{ params: { handle: string; }; }" is not a valid type for the function's second argument.
  ```

**Conclusion for Iteration 3:** Downgrading React did not fix the original build error and introduced a persistent 500 error in the local dev server related to `pino-pretty`. The build type error remains the primary blocker for Vercel deployment.

### Iteration 4: Explicit Route Handler Return Type

**Hypothesis:** Although the signature for the arguments seems correct, perhaps explicitly typing the return value (`Promise<NextResponse>`) might satisfy the build system's type checking.

**Steps Taken:**

1.  Modified `src/app/api/users/[handle]/route.ts` to add `: Promise<NextResponse>` to the `GET` function signature.
2.  Ran `npm run build` locally.

**Result:**

- **`npm run build` STILL FAILED** locally with the _same_ type error as previous iterations.

**Conclusion for Iteration 4:** Adding an explicit return type did not resolve the build error. The error message contradicts the code which appears to follow Next.js conventions.

### Iteration 5: Check tsconfig / Consider Next.js Downgrade

**Hypothesis:** The persistent type error, despite seemingly correct code, might stem from TypeScript configuration issues (`tsconfig.json`) or a bug/incompatibility in the current Next.js version (15.2.5).

**Steps Taken:**

1.  Examined `tsconfig.json`. Found standard settings, no obvious conflicts identified.

**Next Step:** Proceed with Next.js downgrade.

**Proposed Steps:**

1.  Downgrade Next.js: Modify `package.json` dependencies to `"next": "^14.2.5"` and devDependencies to `"eslint-config-next": "^14.2.5"`.
2.  Clean Install: `rm -rf node_modules .next && npm install`
3.  Run `npm run build` locally.
4.  Analyze build output.
5.  If build passes, commit relevant changes and attempt Vercel deployment (requires approval).

---

## Standard Checklist (Run Locally After Each Iteration)

_Make sure your local dev server (`npm run dev`) is running and hasn't been restarted unless specified (like after `npm install`)._

1.  [x] **Clear Previous Log:** `rm -f server.log && touch server.log`.
2.  [x] **Test Endpoint:** `curl http://localhost:3334/api/users/testuser`. Check response (expect 200/404).
3.  [x] **Check Server Log:** Check `server.log` for new errors.
4.  [x] **Verify No Build Errors Locally:** Run `npm run build` locally.

## Notes

- **Dependency Issues:** If fixing the signature doesn't resolve the build, the next step might involve addressing the `react` peer dependency warnings (e.g., downgrading React/ReactDOM or updating dependent packages). This might require `rm -rf node_modules && npm install`.
- **Git Push:** Remember `git push` triggers the Vercel deployment and needs approval. Ensure local checks pass first.
- **Other Warnings:** Address the `pino-pretty` and `no-img-element` warnings later if they are not blocking the deployment.
