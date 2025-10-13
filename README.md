# Text-Detection-GCP

A small demo app that detects text inside uploaded images using a serverless function (Google Cloud Functions) and a React + Vite frontend. The project shows a minimal end-to-end flow: image upload in the browser, server-side OCR/detection, and storing or surfacing results.

This repository contains:

- A React + Vite TypeScript frontend in `src/` that lets users upload images and view detection results.
- A serverless function under `supabase/functions/detect-text/` (TypeScript) intended to run on a serverless platform (GCP Cloud Functions, Supabase Edge Functions, or similar). The function runs OCR/detection logic and returns results.
- A SQL migration file in `supabase/migrations/` for text detection tables.

## Features

- Upload an image from the browser
- Serverless text detection (OCR) endpoint
- Simple results display component
- Example wiring for Supabase client usage in `src/lib/supabase.ts`

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- (For GCP deployment) A Google Cloud project with billing enabled and the Cloud Functions API activated
- (Optional) A Supabase project if you plan to use the provided Supabase client code and persistence

## Local development (frontend)

1. Install dependencies

```bash
# from project root
npm install
```

1. Run the dev server

```bash
npm run dev
```

1. Open [http://localhost:5173](http://localhost:5173) in your browser

The frontend is a Vite + React + TypeScript app. Available npm scripts are defined in `package.json`:

- `dev` - start Vite dev server
- `build` - build for production
- `preview` - preview the production build
- `lint` - run ESLint
- `typecheck` - run TypeScript type checks

## Serverless function (detect-text)

The server function is in `supabase/functions/detect-text/index.ts`. It is written in TypeScript and intended to be deployed as a serverless endpoint. The function should accept an image (or a reference to an image stored in object storage), run OCR or text-detection logic, and return structured results.

The repository does not include a prebuilt OCR binary. You can implement the detection using one of these approaches:

- Call a cloud OCR API (Google Cloud Vision API, AWS Textract, Azure OCR)
- Use a lightweight node OCR library (tesseract.js) and deploy where the runtime allows it

### Local tesseract.js example

If you prefer an on-node implementation without a cloud OCR API, there's a simple example server included at `supabase/functions/detect-text/tesseract-example-node.ts`.

To run it locally:

```bash
# from project root
cd supabase/functions/detect-text
npm install express body-parser tesseract.js node-fetch
# if you use TypeScript locally also install types: npm i -D @types/express @types/node
node tesseract-example-node.ts
```

Then POST to `http://localhost:3000/detect` with JSON body containing `imageUrl` or `imageBase64`.

### Deploying to Google Cloud Functions (example)

This is a minimal outline — adapt for your CI/CD and build system.

1. Build the function bundle (if necessary). For TypeScript you may compile to JavaScript using your preferred tool (tsc or esbuild).
2. Deploy using gcloud CLI:

```bash
# Example: deploy a bundled function (adjust runtime, entry point, and region)
gcloud functions deploy detectText \
  --entry-point=handler \
  --runtime=nodejs18 \
  --trigger-http \
  --region=us-central1 \
  --allow-unauthenticated
```

1. Update the frontend to call the deployed function URL (or use environment variables / proxy during development)

## Supabase notes

- `src/lib/supabase.ts` contains example Supabase client initialization. If you plan to use Supabase to store detection results, create a Supabase project and set the appropriate keys in your environment.
- A SQL migration file is included in `supabase/migrations/` to create example detection tables. Inspect before applying to your database.

## Project structure

- `src/` - frontend app
  - `components/` - React components (`ImageUploader`, `DetectionResults`)
  - `lib/` - client helpers (Supabase client)
- `supabase/functions/detect-text/` - serverless detection function
- `supabase/migrations/` - SQL migrations
- `index.html`, `vite.config.ts`, `tsconfig*.json` - project config

## Environment variables

Create a `.env` file (or use your CI/CD) with the following variables when needed by the frontend or function:

- REACT_APP_SUPABASE_URL - your Supabase URL (if using Supabase)
- REACT_APP_SUPABASE_ANON_KEY - your Supabase anon/public key
- DETECT_TEXT_FUNCTION_URL - URL to the deployed detect-text function (if not proxied)

Vite uses `import.meta.env` for env variables. Prefix frontend variables with `VITE_` if you want to access them client-side (for example `VITE_SUPABASE_URL`).

## Testing and type checks

- Run TypeScript type checks:

```bash
npm run typecheck
```

- Run ESLint:

```bash
npm run lint
```

## Next steps / Improvements

- Add automated tests for the frontend and the serverless function
- Add CI/CD pipeline to build and deploy the function and the frontend
- Add example serverless OCR implementation (e.g., call to Google Vision API) and an integration test

## License

This project is provided as-is. Add an appropriate license file if you intend to redistribute or open-source it.

## References

- Vite: [https://vitejs.dev/](https://vitejs.dev/)
- Supabase: [https://supabase.com/](https://supabase.com/)
- Google Cloud Functions: [https://cloud.google.com/functions](https://cloud.google.com/functions)

text-detection-gcp
