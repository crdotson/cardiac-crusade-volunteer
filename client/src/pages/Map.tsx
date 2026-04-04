import React, { useState, useEffect } from 'react';
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
  if (!name) return 'N/A';
  return name.replace(/_/g, ' ')
             .split(' ')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
             .join(' ');
};

const MapEvents = ({ onDrawCreated, onCircleCreated, selectedVolunteer, activeTool, onToolEnabled }: { 
  onDrawCreated: (bounds: L.LatLngBounds) => void, 
  onCircleCreated: (center: L.LatLng, radius: number) => void,
  selectedVolunteer: string,
  activeTool: string | null,
  onToolEnabled: (tool: string | null) => void
}) => {
  const map = useMap();

  useEffect(() => {
    if (activeTool === 'Circle') {
      map.pm.enableDraw('Circle');
      onToolEnabled(null);
    } else if (activeTool === 'Rectangle') {
      map.pm.enableDraw('Rectangle');
      onToolEnabled(null);
    }
  }, [activeTool, map, onToolEnabled]);

  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: false,
      drawCircle: true,
      drawMarker: false,
      drawText: false,
      cutPolygon: false,
      editMode: true,
      dragMode: true,
      removalMode: true,
    });

    map.on('pm:drawstart', (e: any) => {
      if ((e.shape === 'Rectangle' || e.shape === 'Circle') && !selectedVolunteer) {
        alert('Please select a volunteer first.');
        map.pm.disableDraw();
      }
    });

    map.on('pm:create', (e: any) => {
      if (e.shape === 'Rectangle') {
        const layer = e.layer;
        const bounds = layer.getBounds();
        onDrawCreated(bounds);
        // Optionally remove the layer after capturing bounds if we don't want it to stay
        // layer.remove(); 
      } else if (e.shape === 'Circle') {
        onCircleCreated(e.layer.getLatLng(), e.layer.getRadius());
        e.layer.remove(); // Remove temporary circle after search
      }
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
      map.off('pm:drawstart');
    };
  }, [map, onDrawCreated, selectedVolunteer]);

  return null;
};

const Map: React.FC = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [userAssignments, setUserAssignments] = useState<any[]>([]);
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

  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualData, setManualData] = useState<any>({
    name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', lat: 38.0406, lng: -84.5037
  });

  useEffect(() => {
    if (showManualAdd) {
      const initAutocomplete = () => {
        if (!(window as any).google) {
          setTimeout(initAutocomplete, 100);
          return;
        }
        const google = (window as any).google;
        const input = document.getElementById('address') as HTMLInputElement;
        if (!input) return;
        
        const autocomplete = new google.maps.places.Autocomplete(input, {
          types: ['address'],
          fields: ['formatted_address', 'geometry']
        });
        
        // Fetch default_origin_city from settings to bias results
        axios.get('api/settings').then(res => {
          const city = res.data.default_origin_city;
          if (city) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: city }, (results: any, status: any) => {
              if (status === 'OK' && results![0].geometry.viewport) {
                autocomplete.setBounds(results![0].geometry.viewport);
              }
            });
          }
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            setManualData((prev: any) => ({
              ...prev,
              address: place.formatted_address || '',
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng()
            }));
          }
        });
      };
      initAutocomplete();
    }
  }, [showManualAdd]);

  const fetchLocations = async () => {
    try {
      const res = await axios.get('api/locations');
      setLocations(res.data);
    } catch (err) {
      console.error('Failed to fetch locations', err);
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

  useEffect(() => {
    fetchLocations();
    fetchVolunteers();
    fetchCategories();
  }, [user]);

  useEffect(() => {
    if (selectedVolunteer) {
      axios.get(`api/assignments/${selectedVolunteer}`).then(res => {
        setUserAssignments(res.data);
      }).catch(err => {
        console.error('Failed to fetch user assignments', err);
      });
    } else {
      setUserAssignments([]);
    }
  }, [selectedVolunteer]);

  const handleAreaAssignment = async (bounds: L.LatLngBounds) => {
    if (!selectedVolunteer) {
      alert('Please select a volunteer first.');
      return;
    }

    try {
      const res = await axios.post('api/assignments/area', {
        volunteerId: selectedVolunteer,
        bounds: bounds
      });
      alert(`Assigned ${res.data.assignedCount} locations.`);
      fetchLocations();
      // Refetch assignments for the current volunteer to show the new rectangle
      const assignRes = await axios.get(`api/assignments/${selectedVolunteer}`);
      setUserAssignments(assignRes.data);
    } catch (err) {
      console.error('Failed to assign locations', err);
      alert('Failed to assign locations.');
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
    try {
      await axios.post('api/locations', manualData);
      setShowManualAdd(false);
      setManualData({
        name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', lat: 38.0406, lng: -84.5037
      });
      fetchLocations();
    } catch (err) {
      alert('Failed to add location');
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
    'Pending',
    'AED Located and Mapped at AED.new - Done',
    'Follow-up Required'
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

  const filteredCandidates = candidates
    .map((c, originalIndex) => ({ ...c, originalIndex }))
    .filter(c => {
      const matchesText = c.name.toLowerCase().includes(filterText.toLowerCase()) || 
                          c.address.toLowerCase().includes(filterText.toLowerCase());
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
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #ddd', paddingLeft: '1rem' }}>
                <label style={{ whiteSpace: 'nowrap' }}>Assign to:</label>
                <select 
                  value={selectedVolunteer} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVolunteer(val);
                    if (val) setActiveTool('Rectangle');
                  }} 
                  style={{ marginBottom: 0 }}
                >
                  <option value="">Select Volunteer</option>
                  {volunteers.map(v => (
                    <option key={v.id} value={v.id}>{v.email} ({v.role})</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>Draw rectangle to assign</span>
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
          {userAssignments.map((assign, i) => (
            <Rectangle 
              key={i} 
              bounds={[[assign.geom._southWest.lat, assign.geom._southWest.lng], [assign.geom._northEast.lat, assign.geom._northEast.lng]]}
              pathOptions={{ color: 'red', fillOpacity: 0.1 }}
            />
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
            onDrawCreated={handleAreaAssignment} 
            onCircleCreated={handleCircleCreated}
            selectedVolunteer={selectedVolunteer} 
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  name="address"
                  id="address"
                  autoComplete="street-address"
                  data-1p-ignore
                  type="text" 
                  value={manualData.address} 
                  onChange={e => setManualData({ ...manualData, address: e.target.value })} 
                  placeholder="Street, City, State, Zip"
                />
                <button onClick={useMyLocation} title="Use My Location" style={{ padding: '0.5rem' }}>📍</button>
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
    </div>
  );
};

export default Map;