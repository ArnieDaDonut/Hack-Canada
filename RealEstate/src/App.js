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

  // Interactive AI Prompts
  const [prompts, setPrompts] = useState({
    bgReplace: 'minimalist bright modern living room',
    redecorateFrom: 'furniture',
    redecorateTo: 'modern minimalist furniture',
    removeText: 'clothes and trash and clutter'
  });

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
    const optimizations = 'f_auto,q_auto'; 

    // Encode spaces and special characters for the URL parameters
    const encode = (text) => encodeURIComponent(text.trim());

    switch (tab) {
      case 'improve':
        transformation = 'e_improve,e_sharpen:100,c_fill,g_auto';
        break;
      case 'background':
        // Replace background behind the main subject
        transformation = `e_gen_background_replace:prompt_${encode(prompts.bgReplace)},c_fill,g_auto`;
        break;
      case 'redecorate':
        // Replace a specific object with another object (multiple_true replaces all instances)
        transformation = `e_gen_replace:from_${encode(prompts.redecorateFrom)};to_${encode(prompts.redecorateTo)};multiple_true,c_fill,g_auto`;
        break;
      case 'clutter':
        // Clean conversational filler words
        const cleanedText = prompts.removeText
          .replace(/\b(remove|delete|erase|take out|get rid of|all|the|from|this|picture|photo|image|room|background|bed|floor)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
          
        // Convert comma/and separated list into multiple Cloudinary prompts + multiple_true
        const clutterItems = cleanedText
          .split(/,|\band\b/i)
          .map(item => item.trim())
          .filter(item => item.length > 0)
          .map(item => `prompt_${encode(item)}`)
          .join(';');
          
        // Fallback to original if totally stripped
        const finalClutter = clutterItems.length > 0 ? clutterItems : `prompt_${encode(prompts.removeText)}`;
          
        transformation = `e_gen_remove:${finalClutter};multiple_true,c_fill,g_auto`;
        break;
      default:
        transformation = '';
    }

    return `${base}/${transformation}/${optimizations}/${imageState.publicId}.${imageState.format}`;
  };

  const applyEnhancement = () => {
    if (!imageState.publicId) return;
    setIsProcessing(true);
    
    const newUrl = generateTransformationUrl(activeTab);
    
    // Create an Image object to preload the Cloudinary URL
    const img = new Image();
    img.onload = () => {
      setEnhancedUrl(newUrl);
      setIsProcessing(false);
    };
    img.onerror = () => {
      // If it fails (e.g. 400 Bad Request), still show so they can see error, stop spinner
      setEnhancedUrl(newUrl); 
      setIsProcessing(false);
      alert('Failed to generate image. Please check your Cloudinary configuration or Try a simpler prompt.');
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
                  onClick={() => setActiveTab('improve')}
                  disabled={isProcessing}
                >
                  <Wand2 size={16} /> Auto-Improve Lighting
                </button>
                <button 
                  className={`tab ${activeTab === 'clutter' ? 'active' : ''}`}
                  onClick={() => setActiveTab('clutter')}
                  disabled={isProcessing}
                >
                  <Eraser size={16} /> Remove Clutter
                </button>
                <button 
                  className={`tab ${activeTab === 'redecorate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('redecorate')}
                  disabled={isProcessing}
                >
                  <ImageIcon size={16} /> Redecorate Room
                </button>
                <button 
                  className={`tab ${activeTab === 'background' ? 'active' : ''}`}
                  onClick={() => setActiveTab('background')}
                  disabled={isProcessing}
                >
                  <ImageIcon size={16} /> Virtual Staging (Background)
                </button>
              </div>
              
              <div className="tool-config">
                <AnimatePresence mode="wait">
                  {activeTab === 'improve' && (
                    <motion.div key="improve" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <p className="help-text">Instantly applies intelligent cropping, sharpening, and color adjustments.</p>
                    </motion.div>
                  )}
                  {activeTab === 'clutter' && (
                    <motion.div key="clutter" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <label>What objects to remove?</label>
                      <input 
                        type="text" 
                        value={prompts.removeText} 
                        onChange={e => setPrompts({...prompts, removeText: e.target.value})}
                        className="prompt-input"
                        placeholder="e.g. clothes, trash, books, boxes"
                      />
                      <p className="help-text">For best results, just list the object names (comma-separated).</p>
                    </motion.div>
                  )}
                  {activeTab === 'redecorate' && (
                    <motion.div key="redecorate" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <label>Replace object:</label>
                      <input 
                        type="text" 
                        value={prompts.redecorateFrom} 
                        onChange={e => setPrompts({...prompts, redecorateFrom: e.target.value})}
                        className="prompt-input"
                        placeholder="e.g. bed"
                      />
                      <label style={{marginTop: '0.5rem'}}>With new object:</label>
                      <input 
                        type="text" 
                        value={prompts.redecorateTo} 
                        onChange={e => setPrompts({...prompts, redecorateTo: e.target.value})}
                        className="prompt-input"
                        placeholder="e.g. modern minimalist sofa"
                      />
                      <p className="help-text">Uses Generative Replace to seamlessly swap out furniture pieces.</p>
                    </motion.div>
                  )}
                  {activeTab === 'background' && (
                    <motion.div key="background" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <label>Generate new background:</label>
                      <textarea 
                        value={prompts.bgReplace} 
                        onChange={e => setPrompts({...prompts, bgReplace: e.target.value})}
                        className="prompt-input"
                        rows="2"
                        placeholder="e.g. minimalist bright modern living room"
                      />
                      <p className="help-text">Best for empty spaces or portraits. Replaces the background behind the primary foreground subject.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <button 
                  className="action-btn primary"
                  onClick={applyEnhancement}
                  disabled={isProcessing}
                  style={{marginTop: '1.5rem'}}
                >
                  {isProcessing ? 'Generating AI...' : 'Apply Magic ✨'}
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
                        Configure the AI tool on the left and click "Apply Magic" to see the result!
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
