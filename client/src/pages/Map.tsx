import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

// Fix Leaflet marker icon issue
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'gm-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { id?: string; slot?: string };
    }
  }
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const getStatusColor = (status: string, assigned: boolean) => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'aed located and mapped at aed.new - done') return 'gold';
  if (lowerStatus === 'unvisited' || lowerStatus === 'pending') return assigned ? 'blue' : 'gray';
  
  if (lowerStatus.endsWith('done')) return 'green';
  if (lowerStatus.endsWith('follow-up') || lowerStatus.endsWith('follow up')) return 'yellow';
  
  return 'gray';
};

const CustomMarkerIcon = (color: string, isTarget: boolean) => {
  if (isTarget) {
    return new L.DivIcon({
      className: 'custom-marker target',
      html: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" fill="white"/>
          <circle cx="12" cy="12" r="6" stroke="${color}" stroke-width="2"/>
          <circle cx="12" cy="12" r="2" fill="${color}"/>
        </svg>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  }
  return new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const formatCategoryName = (name: string) => {
  if (!name || typeof name !== 'string') return 'N/A';
  try {
    return name.replace(/_/g, ' ')
               .split(' ')
               .filter(Boolean)
               .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
               .join(' ');
  } catch (e) {
    return name || 'N/A';
  }
};

const MapEvents = ({ onDrawCreated, onCircleCreated, activeTool, onToolEnabled }: { 
  onDrawCreated: (bounds: L.LatLngBounds) => void, 
  onCircleCreated: (center: L.LatLng, radius: number) => void,
  activeTool: string | null,
  onToolEnabled: (tool: string | null) => void
}) => {
  const map = useMap();
  const handleDrawRef = useRef(onDrawCreated);
  const handleCircleRef = useRef(onCircleCreated);

  useEffect(() => {
    handleDrawRef.current = onDrawCreated;
    handleCircleRef.current = onCircleCreated;
  }, [onDrawCreated, onCircleCreated]);

  useEffect(() => {
    if (activeTool === 'Circle') {
      map.pm.enableDraw('Circle');
      onToolEnabled(null);
    } else if (activeTool === 'MasterRectangle') {
      map.pm.enableDraw('Rectangle');
      onToolEnabled(null);
    }
  }, [activeTool, map, onToolEnabled]);

  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawPolygon: false,
      drawCircle: false,
      drawMarker: false,
      drawText: false,
      cutPolygon: false,
      editMode: false,
      dragMode: false,
      removalMode: false,
    });

    map.on('pm:drawstart', () => {
      // Freely allow drawing
    });

    const handleCreate = (e: any) => {
      if (e.shape === 'Rectangle' || e.shape === 'Polygon') {
        const layer = e.layer;
        const bounds = layer.getBounds();
        handleDrawRef.current(bounds);
        e.layer.remove();
      } else if (e.shape === 'Circle') {
        handleCircleRef.current(e.layer.getLatLng(), e.layer.getRadius());
        e.layer.remove(); // Remove temporary circle after search
      }
    };

    map.on('pm:create', handleCreate);

    return () => {
      map.pm.removeControls();
      map.off('pm:create', handleCreate);
      map.off('pm:drawstart');
    };
  }, [map]);

  return null;
};

const Map: React.FC = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [grids, setGrids] = useState<any[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [importCity, setImportCity] = useState('Lexington, KY');
  const [isImporting, setIsImporting] = useState(false);
  
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [activeTool, setActiveTool] = useState<string | null>(null);
  
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [settings, setSettings] = useState<any>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(!!(window as any).google);
  
  const [gridPromptBounds, setGridPromptBounds] = useState<L.LatLngBounds | null>(null);
  const [gridSizeInput, setGridSizeInput] = useState<string>('0.25');
  const [isGeneratingGrid, setIsGeneratingGrid] = useState(false);

  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualData, setManualData] = useState<any>({
    name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', lat: 38.0406, lng: -84.5037
  });

  const [showDeleteCategory, setShowDeleteCategory] = useState(false);
  const [deleteCategory, setDeleteCategory] = useState('');
  const [locationsToDelete, setLocationsToDelete] = useState<any[]>([]);
  const [selectedDeleteIndices, setSelectedDeleteIndices] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Stable script loader
  useEffect(() => {
    if (settings?.google_api_key && !(window as any).google) {
      const script = document.createElement('script');
      // Adding libraries=places back with v=beta is the standard way to enable modern components
      script.src = `https://maps.googleapis.com/maps/api/js?key=${settings.google_api_key}&v=beta&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => {
        console.log('Google Maps Beta Script Loaded');
        setIsGoogleLoaded(true);
      };
      script.onerror = () => console.error('Google Maps Script Load Error');
      document.head.appendChild(script);
    }
  }, [settings]);

  // Autocomplete initialization
  useEffect(() => {
    if (showManualAdd && isGoogleLoaded) {
      const timer = setTimeout(async () => {
        try {
          const g = (window as any).google;
          if (!g?.maps) return;

          const { PlaceAutocompleteElement } = await g.maps.importLibrary("places");
          
          const container = document.getElementById('autocomplete-container');
          if (!container) return;
          
          // Clear existing content
          container.innerHTML = '';
          
          const autocomplete = new PlaceAutocompleteElement();
          
          // Style the element to match our UI
          autocomplete.style.width = '100%';
          
          if (settings?.default_origin_city) {
            const { Geocoder } = await g.maps.importLibrary("geocoding");
            const geocoder = new Geocoder();
            geocoder.geocode({ address: settings.default_origin_city }, (results: any, status: any) => {
              if (status === 'OK' && results?.[0]?.geometry?.viewport) {
                autocomplete.locationBias = results[0].geometry.viewport;
              }
            });
          }

          const handlePlaceSelect = async (e: any) => {
            console.log('Place changed/selected event fired:', e.type);
            const rawPlace = e.place || autocomplete.value || autocomplete.place || (e.placePrediction && typeof e.placePrediction.toPlace === 'function' ? e.placePrediction.toPlace() : null);
            console.log('Selected place object:', rawPlace);
            
            if (rawPlace) {
              // Ensure we have the required fields
              if (typeof rawPlace.fetchFields === 'function' && !rawPlace.location) {
                 await rawPlace.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
              }
              const place = rawPlace;
              setManualData((prev: any) => ({
                ...prev,
                address: place.formattedAddress || place.displayName || prev.address || '',
                lat: place.location && typeof place.location.lat === 'function' ? place.location.lat() : prev.lat,
                lng: place.location && typeof place.location.lng === 'function' ? place.location.lng() : prev.lng
              }));
            }
          };

          autocomplete.addEventListener('gm-placechange', handlePlaceSelect);
          autocomplete.addEventListener('gmp-placeselect', handlePlaceSelect);
          autocomplete.addEventListener('gmp-select', handlePlaceSelect);

          container.appendChild(autocomplete);
          
          // Listen to bubbling input events from the shadow DOM to sync text
          autocomplete.addEventListener('input', (e: any) => {
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const val = path[0]?.value || e.target?.value || autocomplete.inputValue || autocomplete.value || '';
            setManualData((prev: any) => ({ ...prev, address: val }));
          });

          // Attempt to add 1password ignore if the input is accessible
          const shadowInput = autocomplete.shadowRoot?.querySelector('input') || autocomplete.querySelector('input');
          if (shadowInput) {
            shadowInput.setAttribute('data-1p-ignore', 'true');
            shadowInput.placeholder = "Type address or search...";
          }

          console.log('Modern Autocomplete initialized');
        } catch (err) {
          console.error('Modern Autocomplete Error:', err);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showManualAdd, isGoogleLoaded, settings]);

  const fetchLocations = async () => {
    try {
      const res = await axios.get('api/locations');
      setLocations(res.data);
    } catch (err) {
      console.error('Failed to fetch locations', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('api/settings');
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const fetchVolunteers = async () => {
    if (['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '')) {
      try {
        const res = await axios.get('api/users');
        const data = res.data;
        setVolunteers(data.filter((u: any) => u.role === 'Volunteer' || u.role === 'CHAARG leader'));
      } catch (err) {
        console.error('Failed to fetch volunteers', err);
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('api/categories');
      setCategories(res.data);
      if (res.data.length > 0) setSelectedCategory(res.data[0]);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchGrids = async () => {
    try {
      const res = await axios.get('api/grids');
      setGrids(res.data);
    } catch (err) {
      console.error('Failed to fetch grids', err);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchVolunteers();
    fetchCategories();
    fetchSettings();
    fetchGrids();
  }, [user]);

  const handleGridAreaCreated = async (bounds: L.LatLngBounds) => {
    setGridPromptBounds(bounds);
  };

  const handleGenerateGridClick = () => {
    if (grids.length > 0) {
      if (!window.confirm("Are you sure?  This will remove the grid and all grid assignments.")) {
        return;
      }
    }
    setActiveTool('MasterRectangle');
  };

  const handleConfirmGridGeneration = async () => {
    if (!gridPromptBounds || !gridSizeInput) return;
    setIsGeneratingGrid(true);
    try {
        const sw = gridPromptBounds.getSouthWest();
        const ne = gridPromptBounds.getNorthEast();
        const payloadBounds = {
            _southWest: { lat: sw.lat, lng: sw.lng },
            _northEast: { lat: ne.lat, lng: ne.lng }
        };
        await axios.post('api/grids/generate', { bounds: payloadBounds, gridSizeMiles: parseFloat(gridSizeInput) });
        fetchGrids();
        setGridPromptBounds(null);
    } catch (err) {
        console.error('Failed to generate grids', err);
        alert('Failed to generate grids. Check console for details.');
    } finally {
        setIsGeneratingGrid(false);
    }
  };

  const handleCircleCreated = async (center: L.LatLng, radius: number) => {
    setIsImporting(true);
    setShowImport(true); // Open the unified modal
    setCandidates([]);
    try {
      const res = await axios.post('api/locations/search-nearby', {
        lat: center.lat,
        lng: center.lng,
        radius: radius
      });
      setCandidates(res.data);
      setSelectedCandidates(new Set(res.data.map((_: any, i: number) => i)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Nearby search failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSearch = async () => {
    setIsImporting(true);
    setCandidates([]);
    setSelectedCandidates(new Set());
    try {
      const res = await axios.post('api/locations/search', {
        category: selectedCategory,
        city: importCity
      });
      setCandidates(res.data);
      setSelectedCandidates(new Set(res.data.map((_: any, i: number) => i)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Search failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    const locationsToImport = candidates.filter((_, i) => selectedCandidates.has(i));
    if (locationsToImport.length === 0) {
      alert('Please select at least one location.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await axios.post('api/locations/confirm-import', {
        locations: locationsToImport
      });
      alert(`Imported ${res.data.importedCount} locations.`);
      setShowImport(false);
      setCandidates([]);
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleCandidate = (index: number) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(index)) newSelected.delete(index);
    else newSelected.add(index);
    setSelectedCandidates(newSelected);
  };

  const deselectAll = () => {
    setSelectedCandidates(new Set());
  };

  const handleManualSubmit = async () => {
    console.log('handleManualSubmit started, manualData state is:', manualData);
    let dataToSave = { ...manualData };
    
    // Default coordinates check (using 38.0406 as 'missing' indicator)
    if (dataToSave.lat === 38.0406) {
      try {
        const res = await axios.post('api/locations/geocode', { address: dataToSave.address });
        dataToSave.lat = res.data.lat;
        dataToSave.lng = res.data.lng;
        dataToSave.address = res.data.formatted_address;
      } catch (err: any) {
        alert('Could not find location for this address. Please ensure "Geocoding API" is enabled in your Google Cloud Console, or select an option from the autocomplete list.');
        return;
      }
    }

    try {
      await axios.post('api/locations', dataToSave);
      setShowManualAdd(false);
      setManualData({
        name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', lat: 38.0406, lng: -84.5037
      });
      fetchLocations();
    } catch (err) {
      alert('Failed to add location');
    }
  };

  const handleFindDeleteCategory = () => {
    if (!deleteCategory) {
      alert('Please select a category.');
      return;
    }
    const matching = locations.filter(l => l.category === deleteCategory);
    if (matching.length === 0) {
      alert('No locations found for this category.');
      return;
    }
    setLocationsToDelete(matching);
    setSelectedDeleteIndices(new Set(matching.map((_, i) => i)));
  };

  const toggleDeleteCandidate = (index: number) => {
    const newSelected = new Set(selectedDeleteIndices);
    if (newSelected.has(index)) newSelected.delete(index);
    else newSelected.add(index);
    setSelectedDeleteIndices(newSelected);
  };

  const handleBulkDelete = async () => {
    const idsToDelete = locationsToDelete.filter((_, i) => selectedDeleteIndices.has(i)).map(l => l.id);
    if (idsToDelete.length === 0) {
      alert('Please select at least one location to delete.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${idsToDelete.length} locations permanently?`)) {
      setIsDeleting(true);
      try {
        await axios.post('api/locations/bulk-delete', { ids: idsToDelete });
        alert(`Successfully deleted ${idsToDelete.length} locations.`);
        setShowDeleteCategory(false);
        setLocationsToDelete([]);
        fetchLocations();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Bulk delete failed.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setManualData({ ...manualData, lat: latitude, lng: longitude });
    });
  };

  const statuses = [
    'Unvisited',
    'AED status unknown - Follow-up',
    'AED located and mapped at aed.new - Done',
    'Refused or requested not to be mapped - Done',
    'AED located, not mapped yet - Follow up',
    'AED not present - Done'
  ];

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await axios.patch(`api/locations/${id}/status`, { status });
      if (status.includes('Done')) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      fetchLocations();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (window.confirm('Delete this location?')) {
      try {
        await axios.delete(`api/locations/${id}`);
        fetchLocations();
      } catch (err) {
        console.error('Failed to delete location', err);
        alert('Failed to delete location.');
      }
    }
  };

  const handleAssign = async (id: number, volunteerId: string) => {
    try {
      await axios.post(`api/locations/${id}/assign`, { volunteerId: volunteerId || null });
      fetchLocations();
    } catch (err) {
      console.error('Failed to assign location', err);
    }
  };

  const canAssign = ['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '');

  const filteredCandidates = (candidates || [])
    .map((c, originalIndex) => ({ ...c, originalIndex }))
    .filter(c => {
      const matchesText = (c.name || '').toLowerCase().includes(filterText.toLowerCase()) || 
                          (c.address || '').toLowerCase().includes(filterText.toLowerCase());
      const categories = c.categories || (c.category ? [c.category] : []);
      const matchesCat = filterCategory === 'All' || categories.includes(filterCategory);
      return matchesText && matchesCat;
    });

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="button-group">
            {['Application Administrator', 'City Coordinator'].includes(user?.role || '') && (
              <>
                <button onClick={() => setShowImport(true)}>Import by Category</button>
                <button onClick={() => setActiveTool('Circle')}>Import by Area</button>
                <button onClick={() => setShowManualAdd(true)}>Manually Add</button>
                <button onClick={() => { setShowDeleteCategory(true); setDeleteCategory(categories[0] || ''); setLocationsToDelete([]); }} style={{ backgroundColor: 'darkred' }}>Delete by Category</button>
                <button onClick={handleGenerateGridClick} style={{ backgroundColor: 'purple' }}>Generate Grid Area</button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #ddd', paddingLeft: '1rem' }}>
                <label style={{ whiteSpace: 'nowrap' }}>Assign to:</label>
                <select 
                  value={selectedVolunteer} 
                  onChange={(e) => setSelectedVolunteer(e.target.value)} 
                  style={{ marginBottom: 0 }}
                >
                  <option value="">Select Volunteer</option>
                  {volunteers.map(v => (
                    <option key={v.id} value={v.id}>{v.email} ({v.role})</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>Click a grid square to assign</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, height: '70vh', position: 'relative' }}>
        <MapContainer center={[38.0406, -84.5037]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {grids.map((grid) => (
            <Rectangle 
              key={grid.id} 
              bounds={[[grid.south, grid.west], [grid.north, grid.east]]}
              pathOptions={{ 
                 color: grid.assigned_volunteer_id ? 'blue' : 'gray', 
                 fillOpacity: grid.assigned_volunteer_id ? 0.3 : 0.1,
                 weight: 1
              }}
              eventHandlers={{
                 click: async () => {
                     const targetVolunteer = (['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '')) ? selectedVolunteer : user?.id;
                     try {
                         await axios.post(`api/grids/${grid.id}/assign`, { volunteerId: targetVolunteer || null });
                         fetchGrids();
                         fetchLocations();
                     } catch(err) { 
                         console.error('Failed to assign grid', err); 
                     }
                 }
              }}
            >
              {(grid.assigned_volunteer_email || grid.assigned_volunteer_id) && (
                 <Popup>{grid.assigned_volunteer_email || 'Assigned'}</Popup>
              )}
            </Rectangle>
          ))}
          {locations.map(loc => {
            const isAssignedToSelected = selectedVolunteer && Number(loc.assigned_volunteer_id) === Number(selectedVolunteer);
            return (
              <Marker 
                key={loc.id} 
                position={[loc.lat, loc.lng]} 
                icon={CustomMarkerIcon(getStatusColor(loc.status, !!loc.assigned_volunteer_id), !!isAssignedToSelected)}
              >
                <Popup>
                  <div className="popup-content" style={{ minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{loc.name}</h3>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem' }}>{loc.address}</p>
                    <div style={{ display: 'flex', gap: '5px', fontSize: '0.75rem', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ backgroundColor: '#666' }}>{formatCategoryName(loc.category)}</span>
                      {loc.assigned_volunteer_email && (
                        <span className="badge" style={{ backgroundColor: '#3498db' }}>{loc.assigned_volunteer_email}</span>
                      )}
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Status</label>
                      <select 
                        key={`${loc.id}-${loc.status}`}
                        defaultValue={loc.status} 
                        onChange={(e) => handleUpdateStatus(loc.id, e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '4px', marginBottom: 0 }}
                      >
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {canAssign && (
                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Assign To</label>
                        <select 
                          key={`${loc.id}-${loc.assigned_volunteer_id}`}
                          defaultValue={loc.assigned_volunteer_id || ''} 
                          onChange={(e) => handleAssign(loc.id, e.target.value)}
                          style={{ fontSize: '0.85rem', padding: '4px', marginBottom: 0 }}
                        >
                          <option value="">Unassigned</option>
                          {volunteers.map(v => (
                            <option key={v.id} value={v.id}>{v.email}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      <a
                        href="https://aed.new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button primary"
                        style={{ fontSize: '0.8rem', padding: '6px 10px', textDecoration: 'none', textAlign: 'center' }}
                      >
                        Verify at aed.new
                      </a>
                      {['Application Administrator', 'City Coordinator'].includes(user?.role || '') && (
                        <button 
                          onClick={() => handleDeleteLocation(loc.id)} 
                          className="danger-link" 
                          style={{ color: 'red', marginTop: '10px', background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Delete Location
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>

              </Marker>
            );
          })}
          <MapEvents 
            onDrawCreated={handleGridAreaCreated} 
            onCircleCreated={handleCircleCreated}
            activeTool={activeTool}
            onToolEnabled={setActiveTool}
          />
        </MapContainer>
      </div>

      {showImport && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <button className="close-btn" onClick={() => { setShowImport(false); setCandidates([]); }}>&times;</button>
            <h3>Import from Google Places</h3>
            {!candidates.length ? (
              <>
                <div className="form-group">
                  <label>Category</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>City/State</label>
                  <input type="text" value={importCity} onChange={(e) => setImportCity(e.target.value)} />
                </div>
                {isImporting ? (
                  <p>Searching... Please wait.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleSearch}>Search</button>
                    <button className="secondary" onClick={() => setShowImport(false)}>Cancel</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="filter-toolbar">
                  <input 
                    type="text" 
                    placeholder="Filter results..." 
                    value={filterText} 
                    onChange={e => setFilterText(e.target.value)} 
                  />
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="All">All Categories</option>
                    {[...new Set(candidates.flatMap(c => c.categories || (c.category ? [c.category] : [])))].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button onClick={() => setSelectedCandidates(new Set(filteredCandidates.map(c => c.originalIndex)))}>Select Filtered</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span>{selectedCandidates.size} of {candidates.length} selected</span>
                  <button className="secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={deselectAll}>Deselect All</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', marginBottom: '1rem', borderRadius: '4px' }}>
                  {filteredCandidates.map((c) => (
                    <div key={c.originalIndex} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedCandidates.has(c.originalIndex)} 
                        onChange={() => toggleCandidate(c.originalIndex)} 
                        style={{ width: 'auto' }}
                      />
                      <div>
                        <strong>{c.name}</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{c.address}</span><br />
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>Category: {formatCategoryName(c.category || (c.categories && c.categories[0]))}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {isImporting ? (
                  <p>Importing... Please wait.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleConfirmImport}>Confirm Import</button>
                    <button className="secondary" onClick={() => { setShowImport(false); setCandidates([]); }}>Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showManualAdd && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '500px' }}>
            <button className="close-btn" onClick={() => setShowManualAdd(false)}>&times;</button>
            <h3>Manually Add Location</h3>
            <div className="form-group">
              <label>Name *</label>
              <input 
                type="text" 
                value={manualData.name} 
                onChange={e => setManualData({ ...manualData, name: e.target.value })} 
                placeholder="Business Name"
              />
            </div>
            <div className="form-group">
              <label>Address *</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <div id="autocomplete-container" style={{ width: '100%', minHeight: '40px' }}>
                  {/* Google will inject the modern autocomplete here */}
                  <input 
                    type="text" 
                    value={manualData.address} 
                    onChange={e => setManualData({ ...manualData, address: e.target.value })} 
                    placeholder="Type address if suggestions don't appear..."
                    data-1p-ignore
                  />
                </div>
                <button onClick={useMyLocation} title="Use My Location" className="secondary" style={{ width: '100%', marginTop: '5px' }}>📍 Use My Current Location</button>
              </div>
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input 
                type="text" 
                value={manualData.phone} 
                onChange={e => setManualData({ ...manualData, phone: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={manualData.category} onChange={e => setManualData({ ...manualData, category: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={manualData.status} onChange={e => setManualData({ ...manualData, status: e.target.value })}>
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Assign to</label>
              <select 
                value={manualData.assigned_volunteer_id} 
                onChange={e => setManualData({ ...manualData, assigned_volunteer_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {volunteers.map(v => (
                  <option key={v.id} value={v.id}>{v.email}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={handleManualSubmit} disabled={!manualData.name || !manualData.address}>Add Location</button>
              <button className="secondary" onClick={() => setShowManualAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {gridPromptBounds && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '400px' }}>
            <button className="close-btn" onClick={() => setGridPromptBounds(null)}>&times;</button>
            <h3>Generate Grid Squares</h3>
            <p>Enter the desired size of each grid square in miles.</p>
            <div className="form-group">
              <label>Grid Square Size (Miles)</label>
              <input 
                type="number" 
                step="0.05"
                min="0.05"
                value={gridSizeInput} 
                onChange={(e) => setGridSizeInput(e.target.value)} 
              />
            </div>
            {isGeneratingGrid ? (
              <p>Generating... Please wait.</p>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={handleConfirmGridGeneration}>Generate Grids</button>
                <button className="secondary" onClick={() => setGridPromptBounds(null)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteCategory && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <button className="close-btn" onClick={() => { setShowDeleteCategory(false); setLocationsToDelete([]); }}>&times;</button>
            <h3 style={{ color: 'darkred' }}>Bulk Delete by Category</h3>
            {!locationsToDelete.length ? (
              <>
                <div className="form-group">
                  <label>Select Category to find locations</label>
                  <select value={deleteCategory} onChange={(e) => setDeleteCategory(e.target.value)}>
                    <option value="">-- Choose Category --</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button className="danger" onClick={handleFindDeleteCategory} style={{ backgroundColor: 'darkred' }}>Find Locations</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span>{selectedDeleteIndices.size} of {locationsToDelete.length} selected for deletion</span>
                  <button className="secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setSelectedDeleteIndices(new Set())}>Deselect All</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', marginBottom: '1rem', borderRadius: '4px' }}>
                  {locationsToDelete.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedDeleteIndices.has(i)} 
                        onChange={() => toggleDeleteCandidate(i)} 
                        style={{ width: 'auto' }}
                      />
                      <div>
                        <strong>{c.name}</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{c.address}</span><br />
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>Category: {formatCategoryName(c.category)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {isDeleting ? (
                  <p>Deleting... Please wait.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button style={{ backgroundColor: 'darkred' }} onClick={handleBulkDelete}>Delete Selected</button>
                    <button className="secondary" onClick={() => { setShowDeleteCategory(false); setLocationsToDelete([]); }}>Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;