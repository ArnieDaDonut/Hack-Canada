# Estator AI

Estator AI is a platform for real estate marketing. It helps users improve property photos and create listings.

## Project overview

The platform provides tools for real estate agents and homeowners to prepare properties for the market. It uses artificial intelligence to edit photos and write property descriptions.

## Main features

### Image editing
The artificial intelligence studio allows users to improve lighting and color in photos. Users can remove messy items from rooms and add modern furniture to empty spaces.

### Listing creator
The platform can write property descriptions based on the address and price. It also finds the best parts of a house from the photos provided.

### Property map
Users can look at houses for sale in Chicago on a map. This helps with market research and finding available listings.

## Setup and configuration

This project requires a Cloudinary account to process images and a Repliers account for property data.

### Environment setup
Create a file named .env in the RealEstate folder with these items:
- REACT_APP_CLOUDINARY_CLOUD_NAME: Your Cloudinary cloud name.
- REACT_APP_CLOUDINARY_UPLOAD_PRESET: Your unsigned upload preset.
- REACT_APP_REPLIERS_API_KEY: Your Repliers API key.

## Local development

1. Go to the RealEstate folder.
2. Run npm install to get the required software.
3. Run npm start to open the platform in your browser.

## Documentation

More details about the project are in the Docs folder:
- ACTION_PLAN.md: Future development steps.
- ARCHITECTURE.md: How the app is built.
- CLOUDINARY_SETUP.md: Details for setup.
- DESIGN_SYSTEM.md: Colors and fonts.
- MVP_OUTLINE.md: Goals for the first version.
- RESEARCH_DEVELOPMENT.md: Information about the development process.
- SAMPLE_CASES.md: Examples of how to use the app.
