import React, { useState, useEffect } from 'react';
import { Upload, Sparkles, Image as ImageIcon, Wand2, ArrowRight, Settings, Eraser, Crop, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  const [config, setConfig] = useState({
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || localStorage.getItem('estate_cloud_name') || '',
    uploadPreset: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || localStorage.getItem('estate_upload_preset') || ''
  });
  
  const [showConfig, setShowConfig] = useState(!config.cloudName || !config.uploadPreset);
  const [imageState, setImageState] = useState({
    publicId: null,
    originalUrl: null,
    format: null,
    tags: []
  });
  
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('improve');

  // Save config to local storage
  const saveConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('estate_cloud_name', config.cloudName);
    localStorage.setItem('estate_upload_preset', config.uploadPreset);
    setShowConfig(false);
  };

  const uploadToCloudinary = async (file) => {
    setIsProcessing(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', config.uploadPreset);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      setImageState({
        publicId: data.public_id,
        originalUrl: data.secure_url,
        format: data.format,
        tags: data.tags && data.tags.length > 0 ? data.tags : ['real estate', 'property']
      });
      setEnhancedUrl(null);
    } catch (error) {
      console.error('Upload Error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Quick validation
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    uploadToCloudinary(file);
  };

  const generateTransformationUrl = (tab) => {
    if (!imageState.publicId) return null;
    
    const base = `https://res.cloudinary.com/${config.cloudName}/image/upload`;
    let transformation = '';
    const optimizations = 'f_auto,q_auto'; // Always apply performance optimizations

    switch (tab) {
      case 'improve':
        transformation = 'e_improve,e_sharpen:100,c_fill,g_auto';
        break;
      case 'staging':
        // Generate a beautifully staged background
        transformation = 'e_gen_background_replace:prompt_minimalist bright modern living room,c_fill,g_auto';
        break;
      case 'clutter':
        // Try to remove clutter (furniture in this case to empty the room)
        transformation = 'e_gen_remove:prompt_furniture;mess;clutter';
        break;
      case 'optimize':
        // Just resize nicely and optimize for web
        transformation = 'c_fill,w_1200,h_800,g_auto';
        break;
      default:
        transformation = '';
    }

    return `${base}/${transformation}/${optimizations}/${imageState.publicId}.${imageState.format}`;
  };

  const applyEnhancement = (tab) => {
    setActiveTab(tab);
    setIsProcessing(true);
    
    const newUrl = generateTransformationUrl(tab);
    
    // We create an Image object to preload the Cloudinary URL (which might take a few seconds if generating AI)
    const img = new Image();
    img.onload = () => {
      setEnhancedUrl(newUrl);
      setIsProcessing(false);
    };
    img.onerror = () => {
      setEnhancedUrl(newUrl); // Still set it so the user sees the image/error
      setIsProcessing(false);
    };
    img.src = newUrl;
  };

  const resetSession = () => {
    setImageState({ publicId: null, originalUrl: null, format: null, tags: [] });
    setEnhancedUrl(null);
    setActiveTab('improve');
  };

  return (
    <div className="app-container">
      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfig && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="modal-content glass-panel">
              <div className="modal-header">
                <Settings size={28} color="var(--accent-color)" />
                <h2>Cloudinary Setup</h2>
              </div>
              <p>Please enter your Cloudinary credentials. This app requires an <strong>unsigned upload preset</strong>.</p>
              
              <form onSubmit={saveConfig} className="config-form">
                <div className="form-group">
                  <label>Cloud Name</label>
                  <input 
                    type="text" 
                    value={config.cloudName} 
                    onChange={(e) => setConfig({ ...config, cloudName: e.target.value })}
                    required
                    placeholder="e.g. demo"
                  />
                </div>
                <div className="form-group">
                  <label>Upload Preset</label>
                  <input 
                    type="text" 
                    value={config.uploadPreset} 
                    onChange={(e) => setConfig({ ...config, uploadPreset: e.target.value })}
                    required
                    placeholder="e.g. my_unsigned_preset"
                  />
                </div>
                <button type="submit" className="action-btn primary">Save & Start</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Sparkles size={24} color="var(--accent-color)" />
          </div>
          <h1>EstateEnhance AI</h1>
        </div>
        <p className="subtitle">Transform any photo into a premium real estate listing instantly.</p>
        <button className="settings-btn" onClick={() => setShowConfig(true)}>
          <Settings size={18} /> Configure
        </button>
      </header>

      <main className="main-content">
        {!imageState.publicId && !isProcessing && (
          <motion.div 
            className="upload-panel glass-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="upload-zone">
              <input 
                type="file" 
                id="file-upload" 
                className="file-input" 
                accept="image/*" 
                onChange={handleImageUpload}
                disabled={showConfig}
              />
              <label htmlFor="file-upload" className="upload-label">
                <div className="upload-icon-wrapper">
                  <Upload size={48} />
                </div>
                <h3>Upload Listing Photo</h3>
                <p>Drag and drop or click to browse</p>
                <div className="supported-formats">Supports JPG, PNG, WEBP</div>
              </label>
            </div>
            
            <div className="feature-cards">
              <div className="feature-card">
                <Wand2 size={24} />
                <h4>Smart Lighting</h4>
                <p>Fix dark raw photos automatically</p>
              </div>
              <div className="feature-card">
                <ImageIcon size={24} />
                <h4>Virtual Staging</h4>
                <p>AI generated interior design</p>
              </div>
              <div className="feature-card">
                <Zap size={24} />
                <h4>Web Optimized</h4>
                <p>Fast loading, highest quality</p>
              </div>
            </div>
          </motion.div>
        )}

        {(imageState.publicId || isProcessing) && (
          <motion.div 
            className="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="controls-panel glass-panel">
              <h3>AI Tools</h3>
              <div className="tabs">
                <button 
                  className={`tab ${activeTab === 'improve' ? 'active' : ''}`}
                  onClick={() => applyEnhancement('improve')}
                  disabled={isProcessing}
                >
                  <Wand2 size={16} /> Auto-Improve Lighting
                </button>
                <button 
                  className={`tab ${activeTab === 'staging' ? 'active' : ''}`}
                  onClick={() => applyEnhancement('staging')}
                  disabled={isProcessing}
                >
                  <ImageIcon size={16} /> Virtual Staging (AI)
                </button>
                <button 
                  className={`tab ${activeTab === 'clutter' ? 'active' : ''}`}
                  onClick={() => applyEnhancement('clutter')}
                  disabled={isProcessing}
                >
                  <Eraser size={16} /> Remove Clutter (AI)
                </button>
                <button 
                  className={`tab ${activeTab === 'optimize' ? 'active' : ''}`}
                  onClick={() => applyEnhancement('optimize')}
                  disabled={isProcessing}
                >
                  <Crop size={16} /> Best Crop & Web Format
                </button>
              </div>
              
              <div className="info-box">
                <h4>Detected Attributes</h4>
                <div className="tags-container" style={{ position: 'relative', bottom: 0, left: 0, right: 0 }}>
                  {imageState.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
              
              <button 
                className="action-btn secondary"
                onClick={resetSession}
                style={{ marginTop: 'auto' }}
              >
                Upload Different Photo
              </button>
            </div>

            <div className="preview-panel glass-panel">
              <div className="image-comparison">
                {imageState.originalUrl && (
                  <div className="image-wrapper">
                    <span className="image-label">Original</span>
                    <img src={imageState.originalUrl} alt="Original" />
                  </div>
                )}
                
                {imageState.originalUrl && (
                  <div className="image-wrapper enhanced">
                    <span className="image-label">Enhanced Listing</span>
                    {enhancedUrl ? (
                      <img src={enhancedUrl} alt="Enhanced" />
                    ) : (
                      <div className="placeholder-text">
                        Select an AI tool from the left to enhance this photo
                      </div>
                    )}
                  </div>
                )}
                
                {isProcessing && (
                  <div className="processing-overlay">
                    <div className="spinner"></div>
                    <p>{!imageState.publicId ? 'Uploading to Cloudinary...' : 'Cloudinary AI is processing...'}</p>
                    <p style={{fontSize: '0.8rem', opacity: 0.7, maxWidth: '80%', textAlign: 'center'}}>
                      Generative AI transformations can take up to 20-30 seconds on the first run.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default App;
