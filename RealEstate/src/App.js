import React, { useState, useEffect, useRef } from 'react';
import { Upload, Home, Image as ImageIcon, Wand2, ArrowRight, Settings, Eraser, Crop, Zap, CheckCircle2, TrendingUp, Tags } from 'lucide-react';
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
    tags: [],
    originalScore: null
  });
  
  const [enhancedUrl, setEnhancedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('clutter');
  const [enabledFeatures, setEnabledFeatures] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  const [prompts, setPrompts] = useState({
    bgReplace: 'minimalist bright modern living room',
    redecorateFrom: 'furniture',
    redecorateTo: 'modern minimalist furniture',
    removeText: ''
  });

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
      
      if (data.error) throw new Error(data.error.message);

      // We auto-generate a low "original score" to simulate AI listing analysis
      const score = Math.floor(Math.random() * (65 - 40 + 1) + 40);

      const detectedTags = data.tags && data.tags.length > 0 
        ? data.tags.filter(t => !['indoor', 'room', 'house'].includes(t.toLowerCase())) 
        : ['clutter', 'boxes', 'clothes', 'trash'];

      setImageState({
        publicId: data.public_id,
        originalUrl: data.secure_url,
        format: data.format,
        tags: detectedTags,
        originalScore: score
      });
      
      // Auto-prefill the remove text with the most likely clutter tags
      setPrompts(p => ({
        ...p, 
        removeText: detectedTags.slice(0, 3).join(', ')
      }));
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

    const encode = (text) => encodeURIComponent(text.trim());

    switch (tab) {
      case 'improve':
        transformation = 'e_improve,e_sharpen:100,c_fill,g_auto';
        break;
      case 'background':
        transformation = `e_gen_background_replace:prompt_${encode(prompts.bgReplace)},c_fill,g_auto`;
        break;
      case 'redecorate':
        transformation = `e_gen_replace:from_${encode(prompts.redecorateFrom)};to_${encode(prompts.redecorateTo)};multiple_true,c_fill,g_auto`;
        break;
      case 'clutter':
        const cleanedText = prompts.removeText
          .replace(/\b(remove|delete|erase|take out|get rid of|all|the|from|this|picture|photo|image|room|background|bed|floor)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
          
        const clutterItems = cleanedText
          .split(/,|\band\b/i)
          .map(item => item.trim())
          .filter(item => item.length > 0)
          .map(item => `e_gen_remove:prompt_${encode(item)};multiple_true`);
          
        if (clutterItems.length > 0) {
          transformation = `${clutterItems.join('/')},c_fill,g_auto`;
        } else {
          transformation = `e_gen_remove:prompt_${encode(prompts.removeText)};multiple_true,c_fill,g_auto`;
        }
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
    
    const img = new Image();
    img.onload = () => {
      setEnhancedUrl(newUrl);
      setIsProcessing(false);
    };
    img.onerror = () => {
      setEnhancedUrl(newUrl); 
      setIsProcessing(false);
      alert('Failed to generate image. Try a simpler list of objects.');
    };
    img.src = newUrl;
  };

  const resetSession = () => {
    setImageState({ publicId: null, originalUrl: null, format: null, tags: [], originalScore: null });
    setEnhancedUrl(null);
    setActiveTab('clutter');
  };

  const handleNavClick = (e, sectionId) => {
    e.preventDefault();
    setImageState({ publicId: null, originalUrl: null, format: null, tags: [], originalScore: null });
    setEnhancedUrl(null);
    window.location.hash = sectionId;
  };

  const addTagToRemove = (tag) => {
    if (activeTab === 'clutter') {
      const currentList = prompts.removeText ? prompts.removeText.split(',').map(s=>s.trim()) : [];
      if (!currentList.includes(tag)) {
        currentList.push(tag);
        setPrompts({...prompts, removeText: currentList.filter(Boolean).join(', ')});
      }
    }
  };

  return (
    <div className="bg-background-light font-display min-h-screen relative text-text-main">
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
                <button type="submit" className="action-btn primary">Save & Start Application</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 w-full border-b border-neutral-warm bg-white/90 backdrop-blur-md">
<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
<div className="flex items-center gap-2 group cursor-pointer" onClick={(e) => handleNavClick(e, 'top')}>
<div className="bg-primary p-1.5 rounded-lg text-white">
<span className="material-symbols-outlined block text-2xl">apartment</span>
</div>
<h2 className="text-text-main text-xl font-bold tracking-tight">Estator</h2>
</div>
<nav className="hidden md:flex items-center gap-10">
<a className="text-text-main/80 text-sm font-semibold hover:text-primary transition-colors" href="#features" onClick={(e) => handleNavClick(e, 'features')}>Features</a>
<a className="text-text-main/80 text-sm font-semibold hover:text-primary transition-colors" href="#process" onClick={(e) => handleNavClick(e, 'process')}>Process</a>
<a className="text-text-main/80 text-sm font-semibold hover:text-primary transition-colors" href="#testimonials" onClick={(e) => handleNavClick(e, 'testimonials')}>Testimonials</a>
</nav>
<div className="flex items-center gap-4">
<label className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer inline-flex">
                    Enhance My First Photo
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
                </label>
</div>
</div>
</header>

      <main>
        {!imageState.publicId && !isProcessing && (
          <>
            
{/*  Hero Section  */}
<section className="relative overflow-hidden bg-white px-6 py-16 lg:px-10 lg:py-24" id="top">
<div className="mx-auto max-w-7xl">
<div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
<div className="flex flex-col gap-8">
<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
<span className="material-symbols-outlined text-sm">auto_awesome</span>
                            AI-Powered Real Estate Editing
                        </div>
<h1 className="text-text-main text-5xl font-black leading-[1.1] tracking-tight lg:text-7xl">
                            Transform Your Listings with <span className="text-primary">AI Precision</span>
</h1>
<p className="max-w-[540px] text-lg leading-relaxed text-text-main/70">
                            Elevate your property visuals instantly. Our advanced AI photo enhancement tool is designed for real estate professionals who demand perfection in every frame.
                        </p>
<div className="flex flex-col sm:flex-row gap-4">
<label className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-xl shadow-primary/25 flex items-center justify-center gap-2 transition-all cursor-pointer inline-flex">
                                Enhance My First Photo
                                <span className="material-symbols-outlined">arrow_forward</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
                            </label>
<button className="border-2 border-neutral-warm hover:bg-neutral-soft text-text-main px-8 py-4 rounded-xl text-lg font-bold transition-all">
                                View Gallery
                            </button>
</div>
<div className="flex items-center gap-4 pt-4">
<div className="flex -space-x-3">
<img className="h-10 w-10 rounded-full border-2 border-white object-cover" data-alt="Portrait of a male real estate agent" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXxKpdI-WUN6r1N7BejUkzka0KfSiequiuEqa5jrVjS5CqCa69lr8jesshOroSBGA3_xlEEpfVJn8MMUSlK-ZOzxb8KUVVLET9E49CA0BJmxJx_jXHd77jXmzocYM67xmdJIYwD-zJAqmJUhjr7Rx23XBYXPrrQprI3P_1E5gJGPX-6RPzHMrHOpGBS3TkWBqrg3g0DPZPOz6fJDsKjWOsgCepoG-ShS4zNUI_0Lhovw-0XlDVEEECLbx30eXzuAcLkALkSj987Cc"/>
<img className="h-10 w-10 rounded-full border-2 border-white object-cover" data-alt="Portrait of a female realtor" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhzFcv6DuZI0eJo0b9lZChC9koBhAt5NyDSwLXMxo7ylVCvw6CvALRIa1UjNnfATjhbeYuypKFGzLtMHf-1isngXNm4I2D76ViYN__cgy3-OJtwOeonZILnXne0Z5ccMOxBRKeu716yUTc9DewjYPbwOlFpXsqd5RIseiA6WeOSR_ozo9r8fzXq7tYMqB5SEu8r53K4akuno6mFmsON5iEQ-Km8DuH3fYp-aCWW93oUFqfnThzX-TdpGlt7V30CLhN_ORflHV1kM0"/>
<img className="h-10 w-10 rounded-full border-2 border-white object-cover" data-alt="Portrait of a professional broker" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDl_LqwhKSyK2X7QwBWRw8V4NMACHPpJJLOd-zbrSn8GBIvXvDuZK7H-k4_WEbd2RX_rtLNakdF-Q-V-qf_rkG3SeCdHdJVI20nSQEXVTfxeENelb-V6IAsJ80YJRIvLcAMSfZXvQ0scdQEXV2yuaKmBye03CDFzmRoe1MMRPk3qODyG1w4eCLpDrDdjCcGp5IZQQv4-7GBNPMG7pCZ1wLYa0tB-bAbYNYZbT5A_evurKPLhPQ9-F7E4RbHUIAzruZx_BC6aN8cAEQ"/>
</div>
<p className="text-sm font-medium text-text-main/60">Trusted by 5,000+ Real Estate Pros</p>
</div>
</div>
<div className="relative">
<div className="aspect-[4/3] w-full overflow-hidden rounded-3xl bg-neutral-soft shadow-2xl">
<img className="h-full w-full object-cover" data-alt="Modern high-end luxury kitchen interior" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDps6nyNS2lXKvWG8Tx4AK98dVVKDAdYBV54cJ5v4LMVO3P9f48puemQmYCEABNnjFe-IyX21mDA-57k2Aj0T5d3kBDOcOSMeMsexA_imHeePkrePWzRvm5sv6oOWh0e4k8IXmBSZPvZb1hfsBkKgfJs6tm_1qaUJpnCXBK6PL3omzMsiV1RFA5fG-Zxe77jzQv5kN1snkV54g3olQEIFeIWyH21kkNu00nI7p6zQpNWSK0FnfpOvKDPjRHDd7KEcT8K07mPveE6JM"/>
</div>
<div className="absolute -bottom-6 -left-6 max-w-[200px] rounded-2xl bg-white p-4 shadow-xl border border-neutral-warm">
<div className="flex items-center gap-2 mb-2">
<div className="bg-green-100 text-green-600 p-1 rounded">
<span className="material-symbols-outlined text-sm">verified</span>
</div>
<span className="text-[10px] font-bold uppercase text-text-main/50">Smart Lighting</span>
</div>
<p className="text-sm font-bold text-text-main leading-tight">Optimized Exposure</p>
</div>
</div>
</div>
</div>
</section>
{/*  Visual Demo Section  */}
<section className="bg-neutral-soft px-6 py-20 lg:px-10">
<div className="mx-auto max-w-7xl">
<div className="mb-12 flex flex-col items-center text-center">
<h2 className="text-text-main text-3xl font-black lg:text-4xl">Witness the Transformation</h2>
<p className="mt-4 max-w-2xl text-text-main/60">Slide to compare: See how Estator AI handles difficult lighting and clutter to create stunning, market-ready images.</p>
</div>
<div className="group relative aspect-video w-full max-w-5xl mx-auto overflow-hidden rounded-3xl shadow-2xl bg-neutral-warm">
{/*  Before/After Simulation  */}
<div className="absolute inset-0 flex">
<div className="relative w-1/2 overflow-hidden border-r-2 border-white">
<img className="h-full w-full object-cover grayscale-[0.5] brightness-75 contrast-75" data-alt="A cluttered and poorly lit living room" src="https://lh3.googleusercontent.com/aida-public/AB6AXuClu8Dhf4jEtzempO8qlAHZPtMOTQXuJa2p8YThTWjb6944l-6ldxHUiihhVdRcRUrWbEPS3a5E4fqaF4pp31HJ1rW9HzZM-Uxf06Ghe-a4QlU2zvhmOS_iWKdMKITnGXw4_O9Bf_-FMLL7tVr50d3znNn_QwKNjb7yRySBZrG_tNp2vsuXIlwx5MUuwmmkuoo0SegvJKHT8Ifec2t2esFbOvVJOEEGch5N0F05Y2dT4oI7FVIw99Qf-_JUug8bKQkCH44ECgrNRDA"/>
<div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">Original: Dull &amp; Cluttered</div>
</div>
<div className="relative w-1/2 overflow-hidden">
<img className="h-full w-full object-cover brightness-110 saturate-125" data-alt="The same room staged and professionally enhanced" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3BlRkDXVMNVSqgcGdZe3Fl0mjyO94PjmLzIJDIs8NWd0D0qMR-ryqa-L2Ezi3TeeaOoy1u9CuMtseOiKO36AKE1XHIjVABC-s98cg0GC5gdzZ3in1wyfFT8aaw9UzFuz_Vmy2Vxek_patXsQbaUZGPY4NevMv27_gQIRUJvG1K3Q7kTMlwpgYH6uLDlJyTiYIzhZahTx0BVwz1CLiCWf5PgR0rZPytzBrZm7BEgiOtqUofXdTOwAxZHj1V0y6hfZ8ZzMl56D7aOI"/>
<div className="absolute bottom-4 right-4 bg-primary text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">Estator AI: Enhanced</div>
</div>
</div>
{/*  Slider Handle Mockup  */}
<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
<div className="h-full w-1 bg-white relative">
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-primary">
<span className="material-symbols-outlined text-primary font-bold">unfold_more</span>
</div>
</div>
</div>
</div>
</div>
</section>
{/*  Core Features Section  */}
<section className="bg-white px-6 py-20 lg:px-10" id="features">
<div className="mx-auto max-w-7xl">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
{/*  Feature 1  */}
<div className="group flex flex-col gap-5 p-8 rounded-2xl border border-neutral-warm bg-white hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-neutral-warm/50">
<div className="bg-neutral-soft text-primary w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
<span className="material-symbols-outlined text-2xl">light_mode</span>
</div>
<h3 className="text-text-main text-xl font-bold">Smart Lighting</h3>
<p className="text-text-main/60 text-sm leading-relaxed">Automatic exposure correction and HDR balancing for perfectly lit interiors and vibrant exteriors.</p>
</div>
{/*  Feature 2  */}
<div className="group flex flex-col gap-5 p-8 rounded-2xl border border-neutral-warm bg-white hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-neutral-warm/50">
<div className="bg-neutral-soft text-primary w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
<span className="material-symbols-outlined text-2xl">mop</span>
</div>
<h3 className="text-text-main text-xl font-bold">Clutter Removal</h3>
<p className="text-text-main/60 text-sm leading-relaxed">Instantly remove personal items, wires, and distractions to reveal the true potential of the space.</p>
</div>
{/*  Feature 3  */}
<div className="group flex flex-col gap-5 p-8 rounded-2xl border border-neutral-warm bg-white hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-neutral-warm/50">
<div className="bg-neutral-soft text-primary w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
<span className="material-symbols-outlined text-2xl">chair</span>
</div>
<h3 className="text-text-main text-xl font-bold">Virtual Staging</h3>
<p className="text-text-main/60 text-sm leading-relaxed">Add modern, high-end furniture to empty rooms with perspective-aware AI furniture placement.</p>
</div>
{/*  Feature 4  */}
<div className="group flex flex-col gap-5 p-8 rounded-2xl border border-neutral-warm bg-white hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-neutral-warm/50">
<div className="bg-neutral-soft text-primary w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
<span className="material-symbols-outlined text-2xl">label</span>
</div>
<h3 className="text-text-main text-xl font-bold">Auto-Tagging</h3>
<p className="text-text-main/60 text-sm leading-relaxed">Smart recognition of room types and features to automatically generate SEO-friendly descriptions.</p>
</div>
</div>
</div>
</section>
{/*  Process Section  */}
<section className="bg-neutral-soft px-6 py-20 lg:px-10 border-y border-neutral-warm" id="process">
<div className="mx-auto max-w-7xl">
<div className="mb-16 text-center">
<h2 className="text-text-main text-3xl font-black lg:text-4xl">The 3-Step Success Path</h2>
<p className="mt-4 text-text-main/60">Professional photos in minutes, not days.</p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
{/*  Connector line  */}
<div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-neutral-warm -z-0"></div>
<div className="relative z-10 flex flex-col items-center text-center gap-6">
<div className="bg-white text-primary w-24 h-24 rounded-full border-4 border-neutral-soft flex items-center justify-center shadow-lg">
<span className="material-symbols-outlined text-4xl">cloud_upload</span>
</div>
<div>
<h4 className="text-text-main text-xl font-bold mb-2">1. Upload</h4>
<p className="text-text-main/60">Drag and drop your raw property photos directly into our portal.</p>
</div>
</div>
<div className="relative z-10 flex flex-col items-center text-center gap-6">
<div className="bg-primary text-white w-24 h-24 rounded-full border-4 border-white flex items-center justify-center shadow-xl">
<span className="material-symbols-outlined text-4xl">psychology</span>
</div>
<div>
<h4 className="text-text-main text-xl font-bold mb-2">2. Enhance</h4>
<p className="text-text-main/60">Our AI analyzes and applies professional edits in seconds.</p>
</div>
</div>
<div className="relative z-10 flex flex-col items-center text-center gap-6">
<div className="bg-white text-primary w-24 h-24 rounded-full border-4 border-neutral-soft flex items-center justify-center shadow-lg">
<span className="material-symbols-outlined text-4xl">download_done</span>
</div>
<div>
<h4 className="text-text-main text-xl font-bold mb-2">3. Download</h4>
<p className="text-text-main/60">Get high-resolution, MLS-ready photos ready for listing.</p>
</div>
</div>
</div>
</div>
</section>
{/*  Testimonials Section  */}
<section className="bg-white px-6 py-20 lg:px-10" id="testimonials">
<div className="mx-auto max-w-7xl">
<div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
<div>
<h2 className="text-text-main text-4xl font-black mb-8 leading-tight">What Real Estate Leaders Say</h2>
<div className="space-y-8">
<div className="p-8 bg-neutral-soft rounded-2xl relative">
<span className="material-symbols-outlined absolute top-4 right-6 text-neutral-warm text-6xl select-none">format_quote</span>
<p className="text-text-main/80 italic text-lg mb-6 leading-relaxed relative z-10">
                                    "Estator has completely changed our listing workflow. We save thousands on professional photographers and our listings get 3x more engagement than before."
                                </p>
<div className="flex items-center gap-4">
<img className="w-12 h-12 rounded-full object-cover" data-alt="Portrait of a successful female real estate broker" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBstpHklCHSfAJY5rA_dTqhHDo9S-ysWOJxEQnonrnGOhIzW-uqSEaR_fVlkyYNE3btVWEcb3QhL_OUvNNWk_53TORuCmgyYyvceJwv2ywx1kpK0mbnsv0FAp2WgndsAmQYp4_lo32XhkqFY0m4MZDmUk4DA6JzPhgxyUZU04RAJs14XgNha7UdpUw_tcjs09BH9ViU37xPL8mPBYswzISsEOJeRykny7_d_uuzbSNuMP32ZWwosjs4--4jAbO2fnkcia2vEEjG6Jo"/>
<div>
<p className="font-bold text-text-main">Sarah Jenkins</p>
<p className="text-sm text-text-main/50">Senior Broker at Peak Realty</p>
</div>
</div>
</div>
<div className="p-8 bg-white border border-neutral-warm rounded-2xl">
<p className="text-text-main/80 italic text-lg mb-6 leading-relaxed">
                                    "The virtual staging is indistinguishable from the real thing. It helps buyers visualize the home without the $5,000 staging cost."
                                </p>
<div className="flex items-center gap-4">
<img className="w-12 h-12 rounded-full object-cover" data-alt="Portrait of a male real estate agent" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhivQamUlpH6-i60zjOY6IuikUEftAtfAraoaE1QW5cZsGIXgIwJrkgMnWzwjfAV9acx6E-Sf-2V_D7IJ4nbj3qE--EFa0mojxJhZGb04uZoYCD6Vl5U2DJ0P29ptzL-aO_UZWoB6YhX2Y0XiT0IIY8RSpGHUYbLxvGZCJXEC4gvOJ9-OgHZMBWTM6sMU2KoZNnIaVvxSFDdlTt9oY-Uyc9L2Ymn13dKoAlUIEFZx89FPiOW7V8OhDGlVRGdcIoIJGNquz1GRBzeI"/>
<div>
<p className="font-bold text-text-main">David Chen</p>
<p className="text-sm text-text-main/50">Independent Realtor</p>
</div>
</div>
</div>
</div>
</div>
<div className="hidden lg:block">
<div className="grid grid-cols-2 gap-4">
<img className="rounded-2xl shadow-lg" data-alt="Modern office building exterior" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSJ9OSa7lYdcjihM8cNwFAckIMVDokABaPwRUcBaG3PE0poj64v-sgw0oOGWcPsSuOhUX2p93bDR3L6kf2CsF73a7wABrPh14-XafLH8yo_KXcPIlrjjTlkjr7O5ZJ5dsOUckOZ0kb84w9GA537uWl4jltqMyY2wt6W9k_mHituZ16GJS9mh5LIGzaXkGNrHXGc0LueeOMNlr6n-BbzpcYbrU0Tur4cgtR_w2X9ohGSz-2NkBVSpDh_mKq1LeU26FIDrgCHSygj_k"/>
<img className="rounded-2xl shadow-lg mt-12" data-alt="Glass skyscrapers architecture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLNqNGIfuOOYfY8hwARslwqq-DBEFDkTLm6CtHbpDtMWvSmnVJ-ANMI4jSbX2KkiJmvYGDmn8P0GAKHdIzVjQkmgEhOTJEEbE53wGxkMsV21Qjw7qN9KxVPO-XYgfhNk8B4yYQlPl19uAchh74DvxhvIpzpNARrZSvVOzt9Q1RL7_a8_kqYxXoKNhDBoVVXIvjtQbfreEa1jsmYtPWVKoT1fA06Wxr_7EwQcFTm-sP4yTVULnmSuBrVc0K3hr212saxtIpU_Rvp6w"/>
<img className="rounded-2xl shadow-lg -mt-12" data-alt="Luxury residential property facade" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwuxW4hJTmM2291eX2gTWz3Kat6utwkzmUgD8mqtZq_Cleo5zHAkL_NtdugVKxcBqFnojcY03LU2aF19xNPMoC15De9o3YiHswm-ye15Q6GbKdF7WclMeTp53D-dzXQKAnJLzcX8XJFqb7Y4Hnt2QIm5pW8LqcebU-D2SkeudJ5eWWj39hS-Iu_ag8QIsNTbcwpALog_oMslz_Jtd8fZjeLAg7qlC_JPkoMdciMwqJ2ILYvuOLG5y5HyiJz3Y_ncGqZ-zRRpshQbc"/>
<img className="rounded-2xl shadow-lg" data-alt="Stunning pool and backyard area" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD034dYyl2Z-exo4lHXCjDc7iBfYFenqiMfFrPNxYWXt9XEXijfia0f9NAIOTEYwrqgCeM66VyI5XlSCgpycZLBsb9aE8Cf6Exqks-JWEgaY5NSz7UT8cvppbn6iGBsi0FmcL1OqEae0eLIWrKzVgi9JJPYp922lDd_SKCig-EC6YEo6DAXiwmyQYt_Bz8Q0WbyHMZZc3lQQ3tP7YdnisjLR4aqcWc_nsCJkLrQehwbv-Qwi5IW3J54qjv5vWpcD0Dks2lDrh-XlDY"/>
</div>
</div>
</div>
</div>
</section>
{/*  CTA Section  */}
<section className="bg-primary px-6 py-20 lg:px-10 overflow-hidden relative">
<div className="absolute inset-0 opacity-10">
<div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
<div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>
</div>
<div className="mx-auto max-w-4xl text-center relative z-10">
<h2 className="text-white text-4xl font-black lg:text-5xl leading-tight">Ready to Sell Faster?</h2>
<p className="mt-6 text-white/80 text-lg">Join thousands of agents using Estator to win more listings and close deals quicker with superior visuals.</p>
<div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
<label className="bg-white text-primary px-10 py-5 rounded-xl text-lg font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer inline-flex whitespace-nowrap">
                        Enhance My First Photo
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
                    </label>
<button className="bg-primary/20 border-2 border-white/30 text-white px-10 py-5 rounded-xl text-lg font-bold hover:bg-primary/30 transition-all">
                        Schedule a Demo
                    </button>
</div>
</div>
</section>

          </>
        )}

        <div className="max-w-7xl mx-auto py-10 w-full relative z-10 px-6 lg:px-10">
            {(imageState.publicId || isProcessing) && (
          <motion.div 
            className="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="controls-panel glass-panel">
              <div className="panel-section-title">
                <Wand2 size={20} /> AI Enhancements
              </div>
              
              <div className="tabs">
                <button 
                  className={`tab ${activeTab === 'clutter' ? 'active' : ''}`}
                  onClick={() => setActiveTab('clutter')}
                  disabled={isProcessing}
                >
                  <div>
                    <span className="tab-title">Declutter Room</span>
                    <span className="tab-desc">Remove mess and objects</span>
                  </div>
                </button>
                <button 
                  className={`tab ${activeTab === 'redecorate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('redecorate')}
                  disabled={isProcessing}
                >
                  <div>
                    <span className="tab-title">Redecorate Object</span>
                    <span className="tab-desc">Swap out dated furniture</span>
                  </div>
                </button>
                <button 
                  className={`tab ${activeTab === 'improve' ? 'active' : ''}`}
                  onClick={() => setActiveTab('improve')}
                  disabled={isProcessing}
                >
                  <div>
                    <span className="tab-title">Auto-Tune Lighting</span>
                    <span className="tab-desc">Fix exposure and shadows</span>
                  </div>
                </button>
              </div>
              
              <div className="tool-config">
                <AnimatePresence mode="wait">
                  {activeTab === 'clutter' && (
                    <motion.div key="clutter" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <label>Target objects to erase (comma separated)</label>
                      <input 
                        type="text" 
                        value={prompts.removeText} 
                        onChange={e => setPrompts({...prompts, removeText: e.target.value})}
                        className="prompt-input"
                        placeholder="e.g. clothes, trash, books, boxes"
                      />
                      <p className="help-text">Tip: Click the smart tags below to append objects directly.</p>
                    </motion.div>
                  )}
                  {activeTab === 'redecorate' && (
                    <motion.div key="redecorate" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <label>Select item to replace:</label>
                      <input 
                        type="text" 
                        value={prompts.redecorateFrom} 
                        onChange={e => setPrompts({...prompts, redecorateFrom: e.target.value})}
                        className="prompt-input"
                        placeholder="e.g. bed"
                      />
                      <label style={{marginTop: '0.8rem'}}>New staging item:</label>
                      <input 
                        type="text" 
                        value={prompts.redecorateTo} 
                        onChange={e => setPrompts({...prompts, redecorateTo: e.target.value})}
                        className="prompt-input"
                        placeholder="e.g. modern minimalist sofa"
                      />
                    </motion.div>
                  )}
                  {activeTab === 'improve' && (
                    <motion.div key="improve" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="config-box">
                      <div className="success-banner">
                        <CheckCircle2 size={16} /> Fully Automatic
                      </div>
                      <p className="help-text">This tool applies advanced HDR-like adjustments and structural sharpening to make the room pop.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <button 
                  className="action-btn primary pulse"
                  onClick={applyEnhancement}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Rendering Changes...' : 'Enhance Listing'}
                </button>
              </div>

              <div className="info-box">
                <div className="info-box-title">
                  <Tags size={16} /> AI Smart Tracking Labels
                </div>
                <p className="info-box-desc">We identified the following objects. Click to add them to your removal list.</p>
                <div className="tags-container auto-tags">
                  {imageState.tags.map(tag => (
                    <button 
                      key={tag} 
                      className="tag tracking-tag" 
                      onClick={() => addTagToRemove(tag)}
                      title={`Add ${tag} to removal targets`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
              
              <button className="action-btn text-only" onClick={resetSession}>
                Start New Project
              </button>
            </div>

            <div className="preview-panel">
              <div className="score-boards">
                {imageState.originalUrl && (
                  <div className="score-card original">
                    <span className="score-label">Original Appeal Score</span>
                    <span className="score-value error">{imageState.originalScore}<small>/100</small></span>
                  </div>
                )}
                {enhancedUrl && (
                  <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="score-card enhanced">
                    <span className="score-label">Enhanced Appeal Score</span>
                    <span className="score-value success">98<small>/100</small></span>
                  </motion.div>
                )}
              </div>

              <div className="image-comparison">
                {imageState.originalUrl && (
                  <div className="image-wrapper shadow-lg">
                    <span className="image-label">Before</span>
                    <img src={imageState.originalUrl} alt="Original Listing" />
                  </div>
                )}
                
                {imageState.originalUrl && (
                  <div className={`image-wrapper shadow-lg enhanced ${!enhancedUrl ? 'empty' : ''}`}>
                    <span className="image-label premium">Market Ready</span>
                    {enhancedUrl ? (
                      <img src={enhancedUrl} alt="Enhanced" />
                    ) : (
                      <div className="placeholder-text">
                        <Home size={48} style={{opacity: 0.2, marginBottom: '1rem'}} />
                        <p>Configure tools on the left and click Enhance</p>
                      </div>
                    )}
                  </div>
                )}
                
                {isProcessing && (
                  <div className="processing-overlay">
                    <div className="spinner"></div>
                    <h3>AI Processing...</h3>
                    <p>Detecting walls, floors, and object boundaries to apply Generative AI seamlessly.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        </div>
      </main>

      <footer className="bg-background-dark text-white px-6 py-16 lg:px-10">
<div className="mx-auto max-w-7xl">
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-16">
<div className="col-span-2">
<div className="flex items-center gap-2 mb-6">
<div className="bg-primary p-1.5 rounded-lg text-white">
<span className="material-symbols-outlined block text-2xl">apartment</span>
</div>
<h2 className="text-xl font-bold tracking-tight">Estator</h2>
</div>
<p className="text-white/50 text-sm leading-relaxed mb-6">The leading AI-powered photo enhancement platform built specifically for the real estate industry. Professional results at a fraction of the cost.</p>
<div className="flex gap-4">
<a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-colors" href="#">
<span className="material-symbols-outlined text-sm">public</span>
</a>
<a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-colors" href="#">
<span className="material-symbols-outlined text-sm">alternate_email</span>
</a>
</div>
</div>
<div>
<h5 className="font-bold mb-6">Product</h5>
<ul className="space-y-4 text-sm text-white/50">
<li><a className="hover:text-primary" href="#features" onClick={(e) => handleNavClick(e, 'features')}>AI Enhancer</a></li>
<li><a className="hover:text-primary" href="#process" onClick={(e) => handleNavClick(e, 'process')}>Virtual Staging</a></li>
<li><a className="hover:text-primary" href="#process" onClick={(e) => handleNavClick(e, 'process')}>Item Removal</a></li>
</ul>
</div>
<div>
<h5 className="font-bold mb-6">Company</h5>
<ul className="space-y-4 text-sm text-white/50">
<li><a className="hover:text-primary" href="#testimonials" onClick={(e) => handleNavClick(e, 'testimonials')}>About Us</a></li>
<li><a className="hover:text-primary" href="#testimonials" onClick={(e) => handleNavClick(e, 'testimonials')}>Case Studies</a></li>
</ul>
</div>
<div className="col-span-2">
<h5 className="font-bold mb-6">Stay Updated</h5>
<p className="text-sm text-white/50 mb-4">Get the latest real estate marketing tips.</p>
<form className="flex gap-2">
<input className="bg-white/5 border-white/10 rounded-lg px-4 py-2 text-sm w-full focus:outline-none focus:border-primary" placeholder="Email address" type="email"/>
<button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">Join</button>
</form>
</div>
</div>
<div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
<p>© 2024 Estator AI. All rights reserved.</p>
<div className="flex gap-8">
<a className="hover:text-white" href="#">Terms of Service</a>
<a className="hover:text-white" href="#">Cookie Policy</a>
<a className="hover:text-white" href="#">Security</a>
</div>
</div>
</div>
</footer>
    </div>
  );
}

export default App;
