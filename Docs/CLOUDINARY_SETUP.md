# Environment & Cloudinary Setup ☁️

Estator AI relies on Cloudinary for its generative AI features. This guide covers the configuration required to run the project.

## Cloudinary Configuration

To enable image processing, you must provide your Cloudinary credentials. These can be set via a `.env` file or in the in-app configuration modal.

### Variables
- `REACT_APP_CLOUDINARY_CLOUD_NAME`: Found in your Cloudinary Dashboard.
- `REACT_APP_CLOUDINARY_UPLOAD_PRESET`: Required for unsigned uploads from the browser.

### Creating an Unsigned Upload Preset
1. Go to **Cloudinary Settings** > **Upload**.
2. Scroll to **Upload presets** and click **Add upload preset**.
3. Set **Signing Mode** to `Unsigned`.
4. Copy the generated Preset Name and use it in your environment.

## External APIs

### Repliers API (MLS Data)
- **Header**: `REPLIERS-API-KEY`
- **Endpoint**: `https://api.repliers.io/listings`
- Used to fetch live Chicago real estate data for the map view.

## Vercel Deployment Settings
Ensure the following variables are set in your Vercel Project Settings to match your local `.env`.
