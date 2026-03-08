# Research & Development 🧪

This project involves significant R&D in Generative AI for real estate and multi-source data integration.

## Key Learnings

### 1. Cloudinary Generative AI
- **Generative Background Replace**: Research showed that descriptive prompts like `"minimalist bright modern living room"` yield much better results than generic ones.
- **Generative Fill vs. Remove**: Using `gen_remove` with specific prompts (e.g., `"furniture"`) is more effective for decluttering than broad object removal.
- **Transformation Chaining**: Combining `e_improve` (lighting) with generative features in a single URL string reduces latency and Cloudinary credit usage.

### 2. Repliers MLS Data Integration
- **Real-time Performance**: Fetching large property sets (40+ results) for a map requires careful handling of React state to avoid UI lag.
- **Data Normalization**: MLS data fields vary widely. We developed a normalization layer to map diverse API responses to a consistent "Listing Detail" UI.

### 3. Automated Description Generation
- **Visual-to-Text Research**: Investigated ways to cross-reference auto-tags (AI findings) with property details to create "Evidence-based" descriptions (e.g., if the AI sees a "Chef's Kitchen," the description highlights it).
