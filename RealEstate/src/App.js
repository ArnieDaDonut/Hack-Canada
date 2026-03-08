import React, { useState, useEffect } from 'react';
import { Home, Wand2, Settings, Zap, CheckCircle2, Tags, ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default Leaflet icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function App() {
  const [config, setConfig] = useState({
    cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || localStorage.getItem('estate_cloud_name') || '',
    uploadPreset: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || localStorage.getItem('estate_upload_preset') || ''
  });

  const [showConfig, setShowConfig] = useState(false);
  const [imageState, setImageState] = useState(() => {
    const saved = sessionStorage.getItem('estate_imageState');
    return saved ? JSON.parse(saved) : {
      publicId: null,
      originalUrl: null,
      format: null,
      tags: []
    };
  });

  const [enhancedUrl, setEnhancedUrl] = useState(() => sessionStorage.getItem('estate_enhancedUrl') || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('estate_activeTab') || 'clutter');
  const [landingSliderPos, setLandingSliderPos] = useState(50);

  const [view, setView] = useState(() => sessionStorage.getItem('estate_view') || 'landing');
  const [listingStep, setListingStep] = useState(1);
  const [listingImages, setListingImages] = useState({
    kitchen: [],
    living: [],
    bedroom: [],
    bathroom: [],
    other: []
  });
  const [listingImageIndex, setListingImageIndex] = useState(0);
  const [listingDetails, setListingDetails] = useState({
    address: '',
    price: '',
    sqft: '',
    contact: '',
    enhanceAll: true,
    generatedDescription: '',
    strongPoints: [],
    isGenerating: false
  });

  const [prompts, setPrompts] = useState(() => {
    const saved = sessionStorage.getItem('estate_prompts');
    return saved ? JSON.parse(saved) : {
      bgReplace: 'minimalist bright modern living room',
      redecorateFrom: 'furniture',
      redecorateTo: 'modern minimalist furniture',
      removeText: ''
    };
  });

  const [chicagoListings, setChicagoListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [loadingMap, setLoadingMap] = useState(false);

  // Filters State
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterBeds, setFilterBeds] = useState('any');
  const [filterBaths, setFilterBaths] = useState('any');
  const [filterType, setFilterType] = useState('any');
  const [filterMinSqft, setFilterMinSqft] = useState('');

  const filteredListings = React.useMemo(() => {
    return chicagoListings.filter(listing => {
      // Keyword Search
      if (filterSearch) {
        const query = filterSearch.toLowerCase();
        const addressMatch = `${listing.address?.streetNumber} ${listing.address?.streetName}`.toLowerCase().includes(query);
        const descMatch = (listing.details?.description || '').toLowerCase().includes(query);
        if (!addressMatch && !descMatch) return false;
      }

      // Price
      if (filterMinPrice && listing.listPrice < parseInt(filterMinPrice)) return false;
      if (filterMaxPrice && listing.listPrice > parseInt(filterMaxPrice)) return false;

      // Beds / Baths
      if (filterBeds !== 'any' && (listing.details?.numBedrooms || 0) < parseInt(filterBeds)) return false;
      if (filterBaths !== 'any' && (listing.details?.numBathrooms || 0) < parseInt(filterBaths)) return false;

      // Type
      if (filterType !== 'any' && listing.details?.propertyType !== filterType) return false;

      // Sqft
      if (filterMinSqft && parseInt(listing.details?.sqft || 0) < parseInt(filterMinSqft)) return false;

      return true;
    });
  }, [chicagoListings, filterSearch, filterMinPrice, filterMaxPrice, filterBeds, filterBaths, filterType, filterMinSqft]);

  useEffect(() => {
    sessionStorage.setItem('estate_imageState', JSON.stringify(imageState));
  }, [imageState]);

  useEffect(() => {
    if (enhancedUrl) sessionStorage.setItem('estate_enhancedUrl', enhancedUrl);
    else sessionStorage.removeItem('estate_enhancedUrl');
  }, [enhancedUrl]);

  useEffect(() => { sessionStorage.setItem('estate_view', view); }, [view]);
  useEffect(() => { sessionStorage.setItem('estate_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { sessionStorage.setItem('estate_prompts', JSON.stringify(prompts)); }, [prompts]);

  const loadChicagoListings = async () => {
    if (chicagoListings.length > 0) return;
    setLoadingMap(true);
    try {
      const res = await fetch('https://api.repliers.io/listings?city=Chicago&resultsPerPage=40', {
        headers: {
          'REPLIERS-API-KEY': process.env.REACT_APP_REPLIERS_API_KEY
        }
      });
      const data = await res.json();
      setChicagoListings(data.listings || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load listings from Repliers API');
    } finally {
      setLoadingMap(false);
    }
  };

  useEffect(() => {
    if (view === 'chicago-map') {
      loadChicagoListings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const saveConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('estate_cloud_name', config.cloudName);
    localStorage.setItem('estate_upload_preset', config.uploadPreset);
    setShowConfig(false);
  };

  const uploadToCloudinary = async (fileOrBlob) => {
    setIsProcessing(true);

    let fileToUpload = fileOrBlob;

    // If it's a URL (from the map), we fetch it and convert it to a Blob first for the upload
    if (typeof fileOrBlob === 'string') {
      try {
        const response = await fetch(fileOrBlob);
        fileToUpload = await response.blob();
      } catch (err) {
        console.error("Error fetching map image", err);
        setIsProcessing(false);
        alert("Failed to prepare image for enhancement.");
        return;
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
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
      const detectedTags = data.tags && data.tags.length > 0
        ? data.tags.filter(t => !['indoor', 'room', 'house'].includes(t.toLowerCase()))
        : ['clutter', 'boxes', 'clothes', 'trash'];

      setImageState({
        publicId: data.public_id,
        originalUrl: data.secure_url,
        format: data.format,
        tags: detectedTags
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

    setView('editor');
    window.scrollTo(0, 0);
    uploadToCloudinary(file);
    e.target.value = '';
  };

  const startListing = () => {
    setView('listing-builder');
    setListingStep(1);
    window.scrollTo(0, 0);
  };

  const handleListingUpload = (category, files) => {
    const fileList = Array.from(files).map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));
    setListingImages(prev => ({
      ...prev,
      [category]: [...prev[category], ...fileList]
    }));
  };

  const analyzeImagesForStrongPoints = () => {
    const points = [];
    const categories = Object.keys(listingImages);

    const possiblePoints = {
      kitchen: ['Gourmet Chef\'s Kitchen', 'Stainless Steel Appliances', 'Custom Cabinetry', 'Quartz Countertops'],
      living: ['Sun-Drenched Living Space', 'Open Concept Layout', 'Designer Lighting', 'Hardwood Flooring'],
      bedroom: ['Spacious Master Suite', 'Walk-in Closets', 'Serene Retreat', 'Laminate Wood Finish'],
      bathroom: ['Spa-Like Finishes', 'Modern Vanity', 'High-End Fixtures', 'Pristine Tiling'],
      other: ['Curb Appeal', 'Professional Landscaping', 'Updated Exterior', 'Private Outdoor Space']
    };

    categories.forEach(cat => {
      if (listingImages[cat].length > 0) {
        // Pick one random point for each category that has images
        const options = possiblePoints[cat];
        points.push(options[Math.floor(Math.random() * options.length)]);
      }
    });

    return points.slice(0, 4); // Max 4 points
  };

  const handleGenerateListing = () => {
    setListingDetails(prev => ({ ...prev, isGenerating: true }));

    // Simulate AI analysis time
    setTimeout(() => {
      const strongPoints = analyzeImagesForStrongPoints();
      const description = `Introducing a spectacular residence at ${listingDetails.address}. This ${listingDetails.sqft} sq ft home has been meticulously curated for the modern market. ${strongPoints.length > 0 ? `Key highlights include ${strongPoints.join(', ')}.` : ''} ${listingDetails.enhanceAll ? 'The property features professional AI enhancements that elevate every room to its highest potential.' : ''} Whether you're entertaining in the expansive living areas or relaxing in the private suites, this home offers unparalleled style and comfort. Positioned at an attractive price point of $${listingDetails.price}, this property represents an incredible opportunity for discerning buyers.`;

      setListingDetails(prev => ({
        ...prev,
        isGenerating: false,
        strongPoints,
        generatedDescription: description
      }));
      setListingStep(4);
      window.scrollTo(0, 0);
    }, 2500);
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
    setImageState({ publicId: null, originalUrl: null, format: null, tags: [] });
    setEnhancedUrl(null);
    setActiveTab('clutter');
    setView('landing');
  };

  const handleDownload = async () => {
    if (!enhancedUrl) return;
    try {
      const response = await fetch(enhancedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enhanced-property-${imageState.publicId || 'image'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to download image. Please try again.');
    }
  };

  const handleNavClick = (e, sectionId) => {
    e.preventDefault();
    setImageState({ publicId: null, originalUrl: null, format: null, tags: [] });
    setEnhancedUrl(null);
    window.location.hash = sectionId;
    setView('landing');
  };

  const addTagToRemove = (tag) => {
    if (activeTab === 'clutter') {
      const currentList = prompts.removeText ? prompts.removeText.split(',').map(s => s.trim()) : [];
      if (!currentList.includes(tag)) {
        currentList.push(tag);
        setPrompts({ ...prompts, removeText: currentList.filter(Boolean).join(', ') });
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
        <div className="mx-auto flex max-w-[1920px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={(e) => handleNavClick(e, 'top')}>
            <div className="bg-primary p-1.5 rounded-lg text-white">
              <span className="material-symbols-outlined block text-2xl">apartment</span>
            </div>
            <h2 className="text-text-main text-xl font-bold tracking-tight">Estator</h2>
          </div>
          <nav className="hidden md:flex items-center gap-10">
            <a className="text-text-main/80 text-sm font-semibold hover:text-primary transition-colors" href="#features" onClick={(e) => handleNavClick(e, 'features')}>Features</a>
            <a className="text-text-main/80 text-sm font-semibold hover:text-primary transition-colors" href="#process" onClick={(e) => handleNavClick(e, 'process')}>Process</a>
            <button className={`text-text-main/80 text-sm font-semibold hover:text-primary transition-colors ${view === 'chicago-map' ? 'text-primary' : ''}`} onClick={() => setView('chicago-map')}>Chicago Map <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1 uppercase tracking-widest">New</span></button>
            <a className="text-text-main/80 text-sm font-semibold hover:text-primary transition-colors" href="#testimonials" onClick={(e) => handleNavClick(e, 'testimonials')}>Testimonials</a>
          </nav>
          <div className="flex items-center gap-4">
            <button
              onClick={startListing}
              className="text-text-main/80 text-sm font-bold hover:text-primary transition-colors hidden sm:block"
            >
              Create Listing
            </button>

            <label className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 cursor-pointer inline-flex">
              Enhance My First Photo
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={showConfig} />
            </label>
          </div>
        </div>
      </header>

      <main>
        {view === 'chicago-map' && (
          <div className="h-[calc(100vh-80px)] w-full flex relative overflow-hidden bg-neutral-soft">
            <div className="flex-1 h-full z-0 relative">
              {loadingMap && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                  <div className="spinner" style={{ width: 50, height: 50, borderWidth: 5 }}></div>
                </div>
              )}
              <MapContainer
                center={[41.8781, -87.6298]}
                zoom={11}
                minZoom={10}
                maxZoom={18}
                preferCanvas={true}
                style={{ height: "100%", width: "100%", zIndex: 1 }}
              >
                <MapResizer />
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  keepBuffer={4}
                  updateWhenIdle={true}
                  updateWhenZooming={false}
                />
                {filteredListings.map(listing => {
                  if (!listing.map || !listing.map.latitude || !listing.map.longitude) return null;
                  return (
                    <Marker
                      key={listing.mlsNumber}
                      position={[listing.map.latitude, listing.map.longitude]}
                      eventHandlers={{
                        click: () => {
                          setSelectedListing(listing);
                        },
                      }}
                    >
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Right Side Filter Panel */}
            <div className="w-80 h-full bg-white border-l border-neutral-warm flex flex-col shadow-xl z-10 relative overflow-y-auto hidden md:flex">
              <div className="p-5 border-b border-neutral-warm sticky top-0 bg-white z-10">
                <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">filter_alt</span> Search Filters
                </h3>
                <p className="text-sm font-bold text-text-main/50 mt-1">{filteredListings.length} properties found</p>
              </div>

              <div className="p-5 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-main/70 uppercase tracking-wider">Keyword Search</label>
                  <input type="text" placeholder="Address, city, or features..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-main/70 uppercase tracking-wider">Price Range</label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Min" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                    <input type="number" placeholder="Max" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-main/70 uppercase tracking-wider">Bedrooms</label>
                    <select value={filterBeds} onChange={e => setFilterBeds(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="any">Any</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                      <option value="5">5+</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-main/70 uppercase tracking-wider">Bathrooms</label>
                    <select value={filterBaths} onChange={e => setFilterBaths(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="any">Any</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-main/70 uppercase tracking-wider">Property Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="any">All Types</option>
                    <option value="Residential Freehold">Residential Freehold</option>
                    <option value="Condominium">Condominium</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Residential Income">Residential Income</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-main/70 uppercase tracking-wider">Square Footage</label>
                  <input type="number" placeholder="Min Sqft" value={filterMinSqft} onChange={e => setFilterMinSqft(e.target.value)} className="w-full bg-neutral-soft border border-neutral-warm rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </div>

                <button
                  onClick={() => {
                    setFilterSearch(''); setFilterMinPrice(''); setFilterMaxPrice('');
                    setFilterBeds('any'); setFilterBaths('any'); setFilterType('any'); setFilterMinSqft('');
                  }}
                  className="w-full mt-4 bg-neutral-warm/50 hover:bg-neutral-warm text-text-main/80 font-bold py-2 rounded-lg text-sm transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Listing Details Drawer */}
            <AnimatePresence>
              {selectedListing && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  style={{ zIndex: 9999 }}
                  className="w-full max-w-md bg-white h-full border-l border-neutral-warm shadow-2xl flex flex-col absolute right-0 top-0 overflow-hidden"
                >
                  <div className="p-4 border-b border-neutral-warm flex justify-between items-center bg-white sticky top-0 z-20">
                    <div>
                      <h3 className="font-black text-lg truncate w-64">{selectedListing.address?.streetNumber} {selectedListing.address?.streetName} {selectedListing.address?.streetSuffix}</h3>
                      <p className="text-sm font-bold text-primary">${selectedListing.listPrice?.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setSelectedListing(null)} className="p-2 hover:bg-neutral-soft rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-neutral-soft/50 space-y-6">
                    <div className="flex gap-4 text-sm font-bold text-text-main/70">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">bed</span> {selectedListing.details?.numBedrooms || 0} Beds</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">shower</span> {selectedListing.details?.numBathrooms || 0} Baths</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">straighten</span> {selectedListing.details?.sqft || 'N/A'} Sqft</span>
                    </div>

                    {/* Dynamic Listing Subtags */}
                    <div className="flex flex-wrap gap-2">
                      {selectedListing.details?.propertyType && (
                        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20">
                          {selectedListing.details.propertyType}
                        </span>
                      )}
                      {selectedListing.details?.style && (
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                          {selectedListing.details.style}
                        </span>
                      )}
                      {selectedListing.details?.heating && (
                        <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                          🌡️ {selectedListing.details.heating}
                        </span>
                      )}
                      {selectedListing.details?.basement1 && (
                        <span className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">
                          Basement: {selectedListing.details.basement1}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold mb-3 uppercase tracking-widest text-[10px] text-text-main/50">Property Details</h4>
                      <p className="text-sm text-text-main/80 leading-relaxed bg-white p-4 rounded-xl shadow-sm border border-neutral-warm">
                        {selectedListing.details?.description || 'No description available.'}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold mb-3 uppercase tracking-widest text-[10px] text-text-main/50">Gallery ({selectedListing.photoCount || 0})</h4>
                      <div className="grid grid-cols-1 gap-4">
                        {(selectedListing.images || []).map((img, idx) => {
                          const imgUrl = `https://cdn.repliers.io/${img}`;
                          return (
                            <div key={idx} className="relative group rounded-xl overflow-hidden border border-neutral-warm bg-white shadow-sm">
                              <img src={imgUrl} alt={`Property view ${idx + 1}`} className="w-full aspect-video object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <button
                                  className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all pointer-events-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setView('editor');
                                    uploadToCloudinary(imgUrl);
                                  }}
                                >
                                  <Wand2 size={16} /> Enhance Photo
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {view === 'listing-builder' && (
          <div className="listing-builder">
            <div className="max-w-[1920px] mx-auto px-6">
              <div className="flex items-center justify-between mb-12">
                <button onClick={() => setView('landing')} className="flex items-center gap-2 text-text-main/60 hover:text-primary transition-colors font-bold">
                  <span className="material-symbols-outlined">arrow_back</span>
                  Back to Homepage
                </button>
                <div className="text-right">
                  <h1 className="text-2xl font-black">Property Listing Creator</h1>
                  <p className="text-sm text-text-main/60">Create a professional listing in minutes</p>
                </div>
              </div>

              {/* Stepper */}
              <div className="stepper">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className={`step ${listingStep === s ? 'active' : ''} ${listingStep > s ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {listingStep > s ? <CheckCircle2 size={18} /> : s}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                      {['Uploads', 'Enhance', 'Details', 'Preview', 'Share'][s - 1]}
                    </span>
                  </div>
                ))}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-neutral-warm -z-0"></div>
              </div>

              {/* Step 1: Uploads */}
              {listingStep === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black mb-2">Step 1: Upload Room Photos</h2>
                    <p className="text-text-main/60">Categorize your property images for the best AI analysis</p>
                  </div>

                  <div className="upload-grid">
                    {[
                      { id: 'kitchen', icon: 'cooking', label: 'Kitchen' },
                      { id: 'living', icon: 'weekend', label: 'Living Room' },
                      { id: 'bedroom', icon: 'bed', label: 'Bedrooms' },
                      { id: 'bathroom', icon: 'bathtub', label: 'Bathrooms' },
                      { id: 'other', icon: 'home_work', label: 'Other/Exterior' }
                    ].map((cat) => (
                      <label key={cat.id} className="category-box group">
                        <div className="category-icon group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-4xl">{cat.icon}</span>
                        </div>
                        <h3 className="category-title">{cat.label}</h3>
                        <p className="file-count">
                          {listingImages[cat.id].length > 0
                            ? `${listingImages[cat.id].length} photos uploaded`
                            : 'Click to upload multiple'}
                        </p>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleListingUpload(cat.id, e.target.files)}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-16 flex justify-center">
                    <button
                      onClick={() => setListingStep(2)}
                      disabled={Object.values(listingImages).every(arr => arr.length === 0)}
                      className="bg-primary text-white px-12 py-4 rounded-xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
                    >
                      Continue to Enhancement
                      <span className="material-symbols-outlined">magic_button</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Enhancement */}
              {listingStep === 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white">
                  <div className="bg-primary p-12 text-center text-white">
                    <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
                      <span className="material-symbols-outlined text-4xl">auto_fix_high</span>
                    </div>
                    <h2 className="text-3xl font-black mb-4">Apply AI Magic?</h2>
                    <p className="text-white/80">Would you like us to automatically enhance all uploaded photos for maximum market appeal?</p>
                  </div>

                  <div className="p-12 space-y-8">
                    <div
                      onClick={() => setListingDetails({ ...listingDetails, enhanceAll: true })}
                      className={`flex items-start gap-6 p-6 rounded-2xl border-2 cursor-pointer transition-all ${listingDetails.enhanceAll ? 'border-primary bg-primary/5 shadow-lg' : 'border-neutral-warm hover:border-primary/30'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-colors ${listingDetails.enhanceAll ? 'border-primary bg-primary text-white' : 'border-neutral-warm'}`}>
                        {listingDetails.enhanceAll && <CheckCircle2 size={14} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Yes, Enhance Everything</h4>
                        <p className="text-text-main/60 text-sm">Apply lighting correction, sharpening, and decluttering to all photos.</p>
                      </div>
                    </div>

                    <div
                      onClick={() => setListingDetails({ ...listingDetails, enhanceAll: false })}
                      className={`flex items-start gap-6 p-6 rounded-2xl border-2 cursor-pointer transition-all ${!listingDetails.enhanceAll ? 'border-primary bg-primary/5 shadow-lg' : 'border-neutral-warm hover:border-primary/30'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-colors ${!listingDetails.enhanceAll ? 'border-primary bg-primary text-white' : 'border-neutral-warm'}`}>
                        {!listingDetails.enhanceAll && <CheckCircle2 size={14} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">No, Keep Originals</h4>
                        <p className="text-text-main/60 text-sm">Keep the photos exactly as they were uploaded.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button onClick={() => setListingStep(1)} className="flex-1 px-8 py-4 rounded-xl font-bold border-2 border-neutral-warm hover:bg-neutral-soft transition-all">Back</button>
                      <button onClick={() => setListingStep(3)} className="flex-1 bg-primary text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Next: Property Info</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Details */}
              {listingStep === 3 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto shadow-2xl rounded-3xl overflow-hidden bg-white">
                  <div className="bg-neutral-soft p-12 text-center border-b border-neutral-warm">
                    <h2 className="text-3xl font-black mb-2">Listing Details</h2>
                    <p className="text-text-main/60">Provide the core information for your property advertisement</p>
                  </div>

                  <div className="p-12 space-y-6">
                    <div className="form-group flex flex-col gap-2">
                      <label className="text-xs font-black uppercase tracking-widest text-text-main/50">Property Address</label>
                      <input
                        className="w-full px-5 py-4 bg-neutral-soft border-2 border-neutral-warm rounded-xl focus:border-primary focus:bg-white transition-all outline-none"
                        placeholder="123 Luxury Ave, Toronto, ON"
                        value={listingDetails.address}
                        onChange={(e) => setListingDetails({ ...listingDetails, address: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="form-group flex flex-col gap-2">
                        <label className="text-xs font-black uppercase tracking-widest text-text-main/50">Asking Price ($)</label>
                        <input
                          className="w-full px-5 py-4 bg-neutral-soft border-2 border-neutral-warm rounded-xl focus:border-primary focus:bg-white transition-all outline-none"
                          placeholder="e.g. 1,250,000"
                          value={listingDetails.price}
                          onChange={(e) => setListingDetails({ ...listingDetails, price: e.target.value })}
                        />
                      </div>
                      <div className="form-group flex flex-col gap-2">
                        <label className="text-xs font-black uppercase tracking-widest text-text-main/50">Square Footage</label>
                        <input
                          className="w-full px-5 py-4 bg-neutral-soft border-2 border-neutral-warm rounded-xl focus:border-primary focus:bg-white transition-all outline-none"
                          placeholder="e.g. 2,400"
                          value={listingDetails.sqft}
                          onChange={(e) => setListingDetails({ ...listingDetails, sqft: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group flex flex-col gap-2">
                      <label className="text-xs font-black uppercase tracking-widest text-text-main/50">Contact Email/Phone</label>
                      <input
                        className="w-full px-5 py-4 bg-neutral-soft border-2 border-neutral-warm rounded-xl focus:border-primary focus:bg-white transition-all outline-none"
                        placeholder="sarah@peakrealty.com or (555) 0123"
                        value={listingDetails.contact}
                        onChange={(e) => setListingDetails({ ...listingDetails, contact: e.target.value })}
                      />
                    </div>

                    <div className="flex gap-4 pt-8">
                      <button onClick={() => setListingStep(2)} className="flex-1 px-8 py-4 rounded-xl font-bold border-2 border-neutral-warm hover:bg-neutral-soft transition-all">Back</button>
                      <button
                        onClick={handleGenerateListing}
                        disabled={!listingDetails.address || !listingDetails.price || listingDetails.isGenerating}
                        className="flex-1 bg-primary text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {listingDetails.isGenerating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Analyzing Assets...
                          </>
                        ) : (
                          'Generate Listing'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Preview */}
              {listingStep === 4 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1700px] mx-auto pb-20">
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black mb-2">AI-Generated Listing</h2>
                    <p className="text-text-main/60">Review your professional property advertisement</p>
                  </div>

                  <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-neutral-warm">
                    <div className="aspect-[21/9] w-full bg-neutral-soft relative group">
                      {/* Image Gallery */}
                      {(() => {
                        const allImages = Object.values(listingImages).flat();
                        const currentImage = allImages[listingImageIndex]?.url || '/after_transformation.png';

                        return (
                          <>
                            <img
                              src={currentImage}
                              className="w-full h-full object-cover transition-all duration-500 animate-in fade-in fill-mode-forwards"
                              alt="Listing Hero"
                              key={currentImage}
                            />

                            {allImages.length > 1 && (
                              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setListingImageIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1))}
                                  className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/40 text-white flex items-center justify-center hover:bg-white/50 transition-all shadow-lg pointer-events-auto"
                                >
                                  <ChevronLeft size={24} />
                                </button>
                                <button
                                  onClick={() => setListingImageIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0))}
                                  className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/40 text-white flex items-center justify-center hover:bg-white/50 transition-all shadow-lg pointer-events-auto"
                                >
                                  <ChevronRight size={24} />
                                </button>
                              </div>
                            )}

                            {allImages.length > 0 && (
                              <div className="absolute top-6 right-6 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                                Photo {listingImageIndex + 1} of {allImages.length}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="absolute top-6 left-6 flex gap-2">
                        <span className="bg-primary text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">New Listing</span>
                        {listingDetails.enhanceAll && <span className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">AI Enhanced</span>}
                      </div>
                      <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-neutral-warm shadow-lg">
                        <p className="text-xs font-black text-text-main/50 uppercase tracking-widest">Asking Price</p>
                        <p className="text-xl font-black text-primary">${listingDetails.price}</p>
                      </div>
                    </div>

                    <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
                      <div className="lg:col-span-2 space-y-8">
                        <div>
                          <h1 className="text-3xl font-black mb-2">{listingDetails.address}</h1>
                          <div className="flex items-center gap-6 text-text-main/60 font-bold">
                            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">straighten</span> {listingDetails.sqft} Sq Ft</span>
                            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">calendar_today</span> 2026 Built</span>
                            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">map</span> Great Location</span>
                          </div>
                        </div>

                        <div className="prose prose-neutral max-w-none">
                          <h3 className="text-xl font-bold mb-4">Property Description</h3>
                          <div className="p-8 bg-neutral-soft rounded-2xl border-l-4 border-primary">
                            <p className="text-text-main/80 leading-relaxed italic">
                              "{listingDetails.generatedDescription}"
                            </p>
                          </div>
                        </div>

                        {listingDetails.strongPoints.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                            {listingDetails.strongPoints.map((point, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-xl border border-neutral-warm shadow-sm flex flex-col items-center text-center gap-3 group hover:border-primary/30 transition-all">
                                <div className="w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                  <CheckCircle2 size={18} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-main/70">{point}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className="p-6 bg-neutral-soft rounded-2xl border border-neutral-warm">
                          <h4 className="font-black text-xs uppercase tracking-widest text-text-main/50 mb-4">Represented By</h4>
                          <div className="flex items-center gap-4 mb-6 overflow-hidden">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0">SM</div>
                            <div className="overflow-hidden min-w-0">
                              <p className="font-bold break-all text-sm leading-tight mb-1">{listingDetails.contact || 'Pro Agent'}</p>
                              <p className="text-[10px] text-text-main/60 uppercase font-black tracking-widest">Verified Estator Partner</p>
                            </div>
                          </div>
                          <button onClick={() => setListingStep(5)} className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                            Share Listing
                            <span className="material-symbols-outlined">send</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 flex justify-center pb-10">
                    <button onClick={() => setListingStep(3)} className="text-text-main/60 font-bold hover:text-primary transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined">edit</span>
                      Edit Listing Info
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Share */}
              {listingStep === 5 && (
                <div className="animate-in fade-in zoom-in duration-500 max-w-xl mx-auto pb-20">
                  <div className="bg-white rounded-3xl p-12 text-center shadow-2xl border border-neutral-warm">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
                      <span className="material-symbols-outlined text-5xl">mark_email_read</span>
                    </div>
                    <h2 className="text-3xl font-black mb-4">Listing Ready!</h2>
                    <p className="text-text-main/60 mb-10">Your professional property listing is live and ready to be shared with potential buyers.</p>

                    <div className="space-y-4 mb-10">
                      <div className="form-group flex flex-col gap-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-main/40">Recipient Emails (comma separated)</label>
                        <input
                          className="w-full px-5 py-4 bg-neutral-soft border-2 border-neutral-warm rounded-xl focus:border-primary focus:bg-white transition-all outline-none"
                          placeholder="buyers-group@realestate.com, client@example.com"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => {
                          alert('Listing shared successfully!');
                          setView('landing');
                          setListingStep(1);
                        }}
                        className="bg-primary text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all"
                      >
                        Send to Recipients
                      </button>
                      <button onClick={() => setListingStep(4)} className="text-text-main/60 font-bold hover:text-text-main transition-all">Back to Preview</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'landing' && (
          <>

            {/*  Hero Section  */}
            <section className="relative overflow-hidden bg-white px-6 py-16 lg:px-10 lg:py-24" id="top">
              <div className="mx-auto max-w-[1920px]">
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
                      <button
                        onClick={startListing}
                        className="bg-white border-2 border-primary text-primary hover:bg-primary/5 px-8 py-4 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/5"
                      >
                        Create Full Listing
                        <span className="material-symbols-outlined">add_business</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-4 pt-4">
                      <div className="flex -space-x-3">
                        <img className="h-10 w-10 rounded-full border-2 border-white object-cover" alt="Portrait of a male real estate agent" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXxKpdI-WUN6r1N7BejUkzka0KfSiequiuEqa5jrVjS5CqCa69lr8jesshOroSBGA3_xlEEpfVJn8MMUSlK-ZOzxb8KUVVLET9E49CA0BJmxJx_jXHd77jXmzocYM67xmdJIYwD-zJAqmJUhjr7Rx23XBYXPrrQprI3P_1E5gJGPX-6RPzHMrHOpGBS3TkWBqrg3g0DPZPOz6fJDsKjWOsgCepoG-ShS4zNUI_0Lhovw-0XlDVEEECLbx30eXzuAcLkALkSj987Cc" />
                        <img className="h-10 w-10 rounded-full border-2 border-white object-cover" alt="Portrait of a female realtor" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhzFcv6DuZI0eJo0b9lZChC9koBhAt5NyDSwLXMxo7ylVCvw6CvALRIa1UjNnfATjhbeYuypKFGzLtMHf-1isngXNm4I2D76ViYN__cgy3-OJtwOeonZILnXne0Z5ccMOxBRKeu716yUTc9DewjYPbwOlFpXsqd5RIseiA6WeOSR_ozo9r8fzXq7tYMqB5SEu8r53K4akuno6mFmsON5iEQ-Km8DuH3fYp-aCWW93oUFqfnThzX-TdpGlt7V30CLhN_ORflHV1kM0" />
                        <img className="h-10 w-10 rounded-full border-2 border-white object-cover" alt="Portrait of a professional broker" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDl_LqwhKSyK2X7QwBWRw8V4NMACHPpJJLOd-zbrSn8GBIvXvDuZK7H-k4_WEbd2RX_rtLNakdF-Q-V-qf_rkG3SeCdHdJVI20nSQEXVTfxeENelb-V6IAsJ80YJRIvLcAMSfZXvQ0scdQEXV2yuaKmBye03CDFzmRoe1MMRPk3qODyG1w4eCLpDrDdjCcGp5IZQQv4-7GBNPMG7pCZ1wLYa0tB-bAbYNYZbT5A_evurKPLhPQ9-F7E4RbHUIAzruZx_BC6aN8cAEQ" />
                      </div>
                      <p className="text-sm font-medium text-text-main/60">Trusted by 5,000+ Real Estate Pros</p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl bg-neutral-soft shadow-2xl">
                      <img className="h-full w-full object-cover" alt="Modern high-end luxury kitchen interior" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDps6nyNS2lXKvWG8Tx4AK98dVVKDAdYBV54cJ5v4LMVO3P9f48puemQmYCEABNnjFe-IyX21mDA-57k2Aj0T5d3kBDOcOSMeMsexA_imHeePkrePWzRvm5sv6oOWh0e4k8IXmBSZPvZb1hfsBkKgfJs6tm_1qaUJpnCXBK6PL3omzMsiV1RFA5fG-Zxe77jzQv5kN1snkV54g3olQEIFeIWyH21kkNu00nI7p6zQpNWSK0FnfpOvKDPjRHDd7KEcT8K07mPveE6JM" />
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
              <div className="mx-auto max-w-[1920px]">
                <div className="mb-12 flex flex-col items-center text-center">
                  <h2 className="text-text-main text-3xl font-black lg:text-4xl">Witness the Transformation</h2>
                  <p className="mt-4 max-w-2xl text-text-main/60">Slide to compare: See how Estator AI handles difficult lighting and clutter to create stunning, market-ready images.</p>
                </div>
                <div className="group relative aspect-video w-full max-w-5xl mx-auto overflow-hidden rounded-3xl shadow-2xl bg-neutral-warm">
                  <div className="comparison-slider-container">
                    {/* Before Image */}
                    <div className="relative h-full w-full overflow-hidden">
                      <img
                        className="comparison-image before"
                        data-alt="A highly cluttered and messy living room"
                        src="/before_transformation.png"
                      />
                      <div className="slider-label before">Original: Messy & Cluttered</div>
                    </div>

                    {/* After Image */}
                    <div
                      className="absolute inset-0 z-10 overflow-hidden"
                      style={{ clipPath: `inset(0 0 0 ${landingSliderPos}%)` }}
                    >
                      <img
                        className="comparison-image after"
                        data-alt="The same room professionally staged and cleaned"
                        src="/after_transformation.png"
                      />
                      <div className="slider-label after">Estator AI: Staged & Bright</div>
                    </div>

                    {/* Slider UI */}
                    <div
                      className="slider-handle-line"
                      style={{ left: `${landingSliderPos}%` }}
                    />
                    <div
                      className="slider-handle-button"
                      style={{ left: `${landingSliderPos}%` }}
                    >
                      <Zap className="w-6 h-6 fill-primary" />
                    </div>

                    {/* Input Overlay */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={landingSliderPos}
                      onChange={(e) => setLandingSliderPos(e.target.value)}
                      className="comparison-slider-input"
                    />
                  </div>
                </div>
              </div>
            </section>
            {/*  Core Features Section  */}
            <section className="bg-white px-6 py-20 lg:px-10" id="features">
              <div className="mx-auto max-w-[1920px]">
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
              <div className="mx-auto max-w-[1920px]">
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
              <div className="mx-auto max-w-[1920px]">
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
                          <img className="w-12 h-12 rounded-full object-cover" alt="Portrait of a successful female real estate broker" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBstpHklCHSfAJY5rA_dTqhHDo9S-ysWOJxEQnonrnGOhIzW-uqSEaR_fVlkyYNE3btVWEcb3QhL_OUvNNWk_53TORuCmgyYyvceJwv2ywx1kpK0mbnsv0FAp2WgndsAmQYp4_lo32XhkqFY0m4MZDmUk4DA6JzPhgxyUZU04RAJs14XgNha7UdpUw_tcjs09BH9ViU37xPL8mPBYswzISsEOJeRykny7_d_uuzbSNuMP32ZWwosjs4--4jAbO2fnkcia2vEEjG6Jo" />
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
                          <img className="w-12 h-12 rounded-full object-cover" alt="Portrait of a male real estate agent" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhivQamUlpH6-i60zjOY6IuikUEftAtfAraoaE1QW5cZsGIXgIwJrkgMnWzwjfAV9acx6E-Sf-2V_D7IJ4nbj3qE--EFa0mojxJhZGb04uZoYCD6Vl5U2DJ0P29ptzL-aO_UZWoB6YhX2Y0XiT0IIY8RSpGHUYbLxvGZCJXEC4gvOJ9-OgHZMBWTM6sMU2KoZNnIaVvxSFDdlTt9oY-Uyc9L2Ymn13dKoAlUIEFZx89FPiOW7V8OhDGlVRGdcIoIJGNquz1GRBzeI" />
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
                      <img className="rounded-2xl shadow-lg" alt="Modern office building exterior" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSJ9OSa7lYdcjihM8cNwFAckIMVDokABaPwRUcBaG3PE0poj64v-sgw0oOGWcPsSuOhUX2p93bDR3L6kf2CsF73a7wABrPh14-XafLH8yo_KXcPIlrjjTlkjr7O5ZJ5dsOUckOZ0kb84w9GA537uWl4jltqMyY2wt6W9k_mHituZ16GJS9mh5LIGzaXkGNrHXGc0LueeOMNlr6n-BbzpcYbrU0Tur4cgtR_w2X9ohGSz-2NkBVSpDh_mKq1LeU26FIDrgCHSygj_k" />
                      <img className="rounded-2xl shadow-lg mt-12" alt="Glass skyscrapers architecture" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLNqNGIfuOOYfY8hwARslwqq-DBEFDkTLm6CtHbpDtMWvSmnVJ-ANMI4jSbX2KkiJmvYGDmn8P0GAKHdIzVjQkmgEhOTJEEbE53wGxkMsV21Qjw7qN9KxVPO-XYgfhNk8B4yYQlPl19uAchh74DvxhvIpzpNARrZSvVOzt9Q1RL7_a8_kqYxXoKNhDBoVVXIvjtQbfreEa1jsmYtPWVKoT1fA06Wxr_7EwQcFTm-sP4yTVULnmSuBrVc0K3hr212saxtIpU_Rvp6w" />
                      <img className="rounded-2xl shadow-lg -mt-12" alt="Luxury residential property facade" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwuxW4hJTmM2291eX2gTWz3Kat6utwkzmUgD8mqtZq_Cleo5zHAkL_NtdugVKxcBqFnojcY03LU2aF19xNPMoC15De9o3YiHswm-ye15Q6GbKdF7WclMeTp53D-dzXQKAnJLzcX8XJFqb7Y4Hnt2QIm5pW8LqcebU-D2SkeudJ5eWWj39hS-Iu_ag8QIsNTbcwpALog_oMslz_Jtd8fZjeLAg7qlC_JPkoMdciMwqJ2ILYvuOLG5y5HyiJz3Y_ncGqZ-zRRpshQbc" />
                      <img className="rounded-2xl shadow-lg" alt="Stunning pool and backyard area" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD034dYyl2Z-exo4lHXCjDc7iBfYFenqiMfFrPNxYWXt9XEXijfia0f9NAIOTEYwrqgCeM66VyI5XlSCgpycZLBsb9aE8Cf6Exqks-JWEgaY5NSz7UT8cvppbn6iGBsi0FmcL1OqEae0eLIWrKzVgi9JJPYp922lDd_SKCig-EC6YEo6DAXiwmyQYt_Bz8Q0WbyHMZZc3lQQ3tP7YdnisjLR4aqcWc_nsCJkLrQehwbv-Qwi5IW3J54qjv5vWpcD0Dks2lDrh-XlDY" />
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
                </div>
              </div>
            </section>

          </>
        )}

        {view === 'editor' && (
          <div className="max-w-[1920px] mx-auto py-10 w-full relative z-10 px-6 lg:px-10">
            <div className="mb-8">
              <button onClick={() => setView('landing')} className="flex items-center gap-2 text-text-main/60 hover:text-primary transition-colors font-bold">
                <span className="material-symbols-outlined">arrow_back</span>
                Back to Homepage
              </button>
            </div>
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
                        <motion.div key="clutter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="config-box">
                          <label>Target objects to erase (comma separated)</label>
                          <input
                            type="text"
                            value={prompts.removeText}
                            onChange={e => setPrompts({ ...prompts, removeText: e.target.value })}
                            className="prompt-input"
                            placeholder="e.g. clothes, trash, books, boxes"
                          />
                          <p className="help-text">Tip: Click the smart tags below to append objects directly.</p>
                        </motion.div>
                      )}
                      {activeTab === 'redecorate' && (
                        <motion.div key="redecorate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="config-box">
                          <label>Select item to replace:</label>
                          <input
                            type="text"
                            value={prompts.redecorateFrom}
                            onChange={e => setPrompts({ ...prompts, redecorateFrom: e.target.value })}
                            className="prompt-input"
                            placeholder="e.g. bed"
                          />
                          <label style={{ marginTop: '0.8rem' }}>New staging item:</label>
                          <input
                            type="text"
                            value={prompts.redecorateTo}
                            onChange={e => setPrompts({ ...prompts, redecorateTo: e.target.value })}
                            className="prompt-input"
                            placeholder="e.g. modern minimalist sofa"
                          />
                        </motion.div>
                      )}
                      {activeTab === 'improve' && (
                        <motion.div key="improve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="config-box">
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
                  {enhancedUrl && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex justify-end mb-4">
                      <button
                        onClick={handleDownload}
                        className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                      >
                        <Download size={20} /> Download Enhanced Photo
                      </button>
                    </motion.div>
                  )}

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
                            <Home size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>Configure tools on the left and click Enhance</p>
                          </div>
                        )}
                      </div>
                    )}

                    {isProcessing && (
                      <div className="processing-overlay">
                        <div className="spinner"></div>
                        <h3>Cloudinary AI processing...</h3>
                        <p>Detecting walls, floors, and object boundaries to apply Cloudinary Generative AI seamlessly.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-background-dark text-white px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-[1920px]">
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
              </ul>
            </div>
            <div className="col-span-2">
              <h5 className="font-bold mb-6">Stay Updated</h5>
              <p className="text-sm text-white/50 mb-4">Get the latest real estate marketing tips.</p>
              <form className="flex gap-2">
                <input className="bg-white/5 border-white/10 rounded-lg px-4 py-2 text-sm w-full focus:outline-none focus:border-primary" placeholder="Email address" type="email" />
                <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">Join</button>
              </form>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
            <p>© 2024 Estator AI. All rights reserved.</p>
            <div className="flex gap-8">
                <a href="/" className="hover:text-white">Terms of Service</a>
                <a href="/" className="hover:text-white">Cookie Policy</a>
                <a href="/" className="hover:text-white">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
